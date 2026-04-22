import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler.js';
import { handleMcpGatewayRequest } from '../mcp/gateway/mcpGateway.js';

export const mcpGatewayRouter = Router();

mcpGatewayRouter.get(
  '/mcp/:integrationId',
  asyncHandler(async (req, res) => {
    // Minimal Streamable HTTP GET handler (SSE-capable clients may probe with GET).
    // We respond with a tiny SSE stream and close immediately.
    z.string().regex(/^[a-fA-F0-9]{24}$/).parse(req.params.integrationId);
    res.status(200);
    res.setHeader('content-type', 'text/event-stream; charset=utf-8');
    res.setHeader('cache-control', 'no-cache, no-transform');
    res.setHeader('connection', 'keep-alive');
    res.write(`: ok\n\n`);
    res.end();
  })
);

mcpGatewayRouter.delete(
  '/mcp/:integrationId',
  asyncHandler(async (req, res) => {
    z.string().regex(/^[a-fA-F0-9]{24}$/).parse(req.params.integrationId);
    res.status(200).json({ ok: true });
  })
);

mcpGatewayRouter.post(
  '/mcp/:integrationId',
  asyncHandler(async (req, res) => {
    const integrationId = z.string().regex(/^[a-fA-F0-9]{24}$/).parse(req.params.integrationId);
    const response = await handleMcpGatewayRequest(integrationId, req.body);
    res.json(response);
  })
);
