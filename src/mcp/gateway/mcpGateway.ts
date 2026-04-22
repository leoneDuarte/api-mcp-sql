import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { IntegrationDoc } from '../../models/Integration.js';
import { IntegrationModel } from '../../models/Integration.js';
import { fetchFn } from '../../utils/fetch.js';
import { resolveObjectTemplates, resolveTemplate } from '../../engine/variableResolver.js';

const JsonRpcRequestSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => (v === undefined ? undefined : String(v))),
  method: z.string(),
  params: z.unknown().optional()
});

function ok(id: string, result: unknown) {
  return { jsonrpc: '2.0', id, result };
}

function rpcError(id: string, code: number, message: string, data?: unknown) {
  return { jsonrpc: '2.0', id, error: { code, message, data } };
}

export async function handleMcpGatewayRequest(integrationId: string, body: unknown) {
  const parsed = JsonRpcRequestSchema.safeParse(body);
  if (!parsed.success) {
    return rpcError('unknown', -32600, 'Invalid Request');
  }

  const req = parsed.data;
  const id = req.id ?? 'notification';

  const integration = await IntegrationModel.findById(integrationId).select('+auth.token').lean<IntegrationDoc>().exec();
  if (!integration) {
    return rpcError(id, -32004, 'Integration not found');
  }

  // MCP handshake (Streamable HTTP / HTTP+SSE clients commonly call initialize first)
  if (req.method === 'initialize') {
    return ok(id, {
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: {}
      },
      serverInfo: {
        name: `integration:${integration.name}`,
        version: '1.0.0'
      }
    });
  }

  // MCP initialize notification (no response required, but we return an ok envelope for compatibility)
  if (req.method === 'notifications/initialized') {
    return ok(id, {});
  }

  if (req.method === 'tools/list') {
    return ok(id, {
      tools: (integration.tools ?? []).map((t: any) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema ?? { type: 'object', properties: {} }
      }))
    });
  }

  if (req.method === 'tools/call') {
    const params: any = req.params ?? {};
    const toolName = String(params.name ?? '');
    const args = (params.arguments ?? {}) as Record<string, unknown>;

    const tool = (integration.tools ?? []).find((t: any) => t.name === toolName);
    if (!tool) {
      return ok(id, { isError: true, errorMessage: `Unknown tool: ${toolName}` });
    }

    try {
      const result = await callHttpTool(integration as any, tool as any, args);
      return ok(id, result);
    } catch (error) {
      return ok(id, { isError: true, errorMessage: error instanceof Error ? error.message : 'Tool call failed' });
    }
  }

  // helpful: ping
  if (req.method === 'ping') {
    return ok(id, { ok: true, nonce: randomUUID() });
  }

  return rpcError(id, -32601, `Method not found: ${req.method}`);
}

async function callHttpTool(integration: any, tool: any, args: Record<string, unknown>) {
  const baseUrl = String(integration.baseUrl ?? '').replace(/\/+$/, '');
  const path = resolveTemplate(String(tool.path ?? ''), args);
  const url = new URL(baseUrl + (path.startsWith('/') ? path : `/${path}`));

  const headers: Record<string, string> = {
    'content-type': 'application/json',
    ...(integration.headers ?? {}),
    ...(tool.headers ?? {})
  };

  if (integration.auth?.type === 'bearer' && integration.auth.token) {
    headers[integration.auth.headerName ?? 'authorization'] = `Bearer ${integration.auth.token}`;
  }

  const resolvedQuery = resolveObjectTemplates(tool.query ?? {}, args) as Record<string, unknown>;
  for (const [k, v] of Object.entries(resolvedQuery)) {
    if (v === undefined || v === null) continue;
    url.searchParams.set(k, typeof v === 'string' ? v : JSON.stringify(v));
  }

  const method = String(tool.method ?? 'GET').toUpperCase();
  const init: RequestInit = { method, headers };

  if (!['GET', 'HEAD'].includes(method)) {
    const resolvedBody = resolveObjectTemplates(tool.body ?? {}, args);
    init.body = JSON.stringify(resolvedBody);
  }

  const res = await fetchFn(url.toString(), init);
  const contentType = res.headers.get('content-type') ?? '';
  const rawText = await res.text();

  let parsed: unknown = rawText;
  if (contentType.includes('application/json')) {
    try {
      parsed = JSON.parse(rawText);
    } catch {
      parsed = rawText;
    }
  }

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${typeof parsed === 'string' ? parsed : JSON.stringify(parsed)}`);
  }

  return { content: parsed, raw: { status: res.status, headers: slimHeaders(res.headers) } };
}

function slimHeaders(headers: Headers) {
  const out: Record<string, string> = {};
  for (const [k, v] of headers.entries()) {
    if (k.toLowerCase() === 'set-cookie') continue;
    out[k] = v;
  }
  return out;
}
