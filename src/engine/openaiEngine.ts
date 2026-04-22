import type { Types } from 'mongoose';
import { z } from 'zod';
import { env } from '../config/env.js';
import type { AssistantDoc, McpServerConfig } from '../models/Assistant.js';
import type { ConversationDoc } from '../models/Conversation.js';
import { appendHistory, setConversationState } from '../services/conversationService.js';
import { logAction } from '../services/logService.js';
import { fetchFn } from '../utils/fetch.js';

export type OpenAiEngineResult = {
  conversationId: string;
  responses: string[];
  variables: Record<string, unknown>;
  currentStep: string | null;
  openaiResponseId: string;
};

const ModelOutputSchema = z.object({
  responses: z.array(z.string()).default([]),
  setVariables: z.record(z.unknown()).optional().default({}),
  currentStep: z.string().nullable().optional().default(null)
});

type ResponsesCreateResult = {
  id: string;
  output?: any[];
};

export class OpenAiEngine {
  async runTurn(input: {
    assistant: AssistantDoc;
    conversation: ConversationDoc & { _id: Types.ObjectId };
    clientId: string;
    assistantId: string;
    message: string;
    metadata?: Record<string, unknown>;
  }): Promise<OpenAiEngineResult> {
    if (!env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is required');
    }

    await logAction({
      conversationId: input.conversation._id,
      action: 'message_received',
      payload: { message: input.message, metadata: input.metadata ?? {} }
    });

    await appendHistory(input.conversation._id, {
      role: 'user',
      message: input.message,
      metadata: input.metadata ?? {},
      timestamp: new Date()
    });

    const variables = { ...(((input.conversation.variables as any) ?? {}) as Record<string, unknown>) };
    const currentStep = (input.conversation.currentStep ?? null) as string | null;
    const previousResponseId = typeof variables.openai_previous_response_id === 'string' ? variables.openai_previous_response_id : null;

    const tools = buildMcpTools(input.assistant.mcpServers ?? []);

    const instructions = buildInstructions({
      flowPrompt: String(input.assistant.prompt ?? ''),
      clientId: input.clientId,
      assistantId: input.assistantId,
      currentStep,
      variables
    });

    const response = await createOpenAiResponse({
      model: env.OPENAI_MODEL,
      apiKey: env.OPENAI_API_KEY,
      tools,
      instructions,
      previous_response_id: previousResponseId ?? undefined,
      input: `json\n${input.message}`,
      tool_choice: coerceToolChoice(input.metadata),
      metadata: {
        clientId: input.clientId,
        assistantId: input.assistantId,
        conversationId: String(input.conversation._id)
      }
    });

    await logAction({
      conversationId: input.conversation._id,
      action: 'openai_response',
      payload: { responseId: response.id },
      response: { output: response.output ?? [] }
    });

    // Log MCP events (list/tools/calls/approval) when present
    for (const item of response.output ?? []) {
      const type = item?.type;
      if (type && String(type).startsWith('mcp_')) {
        await logAction({
          conversationId: input.conversation._id,
          action: 'openai_mcp_event',
          payload: { type },
          response: item
        });
      }
    }

    const modelJsonText = extractLastAssistantText(response.output ?? []);
    const parsed = safeParseJson(modelJsonText);
    const out = ModelOutputSchema.parse(parsed);

    const newVariables = { ...variables, ...out.setVariables, openai_previous_response_id: response.id };
    const newStep = out.currentStep ?? currentStep;

    for (const text of out.responses) {
      await appendHistory(input.conversation._id, {
        role: 'assistant',
        message: text,
        timestamp: new Date()
      });
    }

    await setConversationState({
      conversationId: input.conversation._id,
      currentStep: newStep,
      variables: newVariables
    });

    return {
      conversationId: String(input.conversation._id),
      responses: out.responses,
      variables: newVariables,
      currentStep: newStep,
      openaiResponseId: response.id
    };
  }
}

function buildMcpTools(servers: McpServerConfig[]) {
  return servers.map((s) => {
    const tool: any = {
      type: 'mcp',
      server_label: s.server_label,
      require_approval: s.require_approval ?? 'never'
    };
    if (s.server_description) tool.server_description = s.server_description;
    if (s.allowed_tools) tool.allowed_tools = s.allowed_tools;
    if (s.authorization) tool.authorization = s.authorization;
    if (s.server_url) tool.server_url = s.server_url;
    if (s.connector_id) tool.connector_id = s.connector_id;
    return tool;
  });
}

function buildInstructions(input: {
  flowPrompt: string;
  clientId: string;
  assistantId: string;
  currentStep: string | null;
  variables: Record<string, unknown>;
}) {
  return [
    'Você é um motor de automação (Flow Engine).',
    'Siga fielmente o FLOW_PROMPT abaixo para decidir o que fazer.',
    'Use ferramentas MCP quando necessário. Você pode chamar tools MCP durante a resposta.',
    'No final, responda SOMENTE em JSON (sem texto extra) com o formato:',
    JSON.stringify(
      {
        responses: ['mensagem para o usuário'],
        setVariables: { any: 'value' },
        currentStep: 'string or null'
      },
      null,
      2
    ),
    'Regras:',
    '- Se precisar evitar repetir uma ação, use flags em setVariables (ex: dados_buscados=true).',
    '- responses deve conter 0..N mensagens para o usuário.',
    '- setVariables deve conter apenas o delta (o que mudar).',
    '',
    'STATE:',
    JSON.stringify(
      {
        clientId: input.clientId,
        assistantId: input.assistantId,
        currentStep: input.currentStep,
        variables: input.variables
      },
      null,
      2
    ),
    '',
    'FLOW_PROMPT:',
    input.flowPrompt
  ].join('\n');
}

async function createOpenAiResponse(input: {
  apiKey: string;
  model: string;
  instructions: string;
  tools: any[];
  previous_response_id?: string;
  input: string;
  tool_choice?: any;
  metadata?: Record<string, string>;
}): Promise<ResponsesCreateResult> {
  const body: any = {
    model: input.model,
    instructions: input.instructions,
    tools: input.tools,
    input: input.input,
    text: { format: { type: 'json_object' } },
    parallel_tool_calls: true,
    max_tool_calls: 20,
    tool_choice: 'auto'
  };
  if (input.tool_choice) body.tool_choice = input.tool_choice;
  if (input.previous_response_id) body.previous_response_id = input.previous_response_id;
  if (input.metadata) body.metadata = input.metadata;

  const res = await fetchFn('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${input.apiKey}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  const json = (await res.json()) as any;
  if (!res.ok) {
    throw new Error(`OpenAI Responses error: ${JSON.stringify(json)}`);
  }
  return json as ResponsesCreateResult;
}

function coerceToolChoice(metadata?: Record<string, unknown>) {
  const ForceSchema = z
    .object({
      type: z.literal('mcp'),
      server_label: z.string().min(1),
      name: z.string().min(1).optional()
    })
    .strict();

  const value = (metadata as any)?.forceToolChoice;
  const parsed = ForceSchema.safeParse(value);
  if (!parsed.success) return undefined;
  return parsed.data;
}

function extractLastAssistantText(output: any[]) {
  // Heuristic: find last "message" output with text content.
  for (let i = output.length - 1; i >= 0; i--) {
    const item = output[i];
    if (item?.type === 'message' && item?.role === 'assistant' && Array.isArray(item?.content)) {
      const textParts = item.content.filter((c: any) => c?.type === 'output_text' && typeof c?.text === 'string');
      const joined = textParts.map((p: any) => p.text).join('');
      if (joined.trim()) return joined;
    }
  }
  // fallback: nothing
  return '';
}

function safeParseJson(text: string) {
  const trimmed = (text ?? '').trim();
  if (!trimmed) return {};
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error('Failed to parse model JSON');
  }
}
