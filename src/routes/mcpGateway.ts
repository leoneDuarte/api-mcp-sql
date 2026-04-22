import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler.js';
import { handleMcpGatewayRequest } from '../mcp/gateway/mcpGateway.js';

export const mcpGatewayRouter = Router();

mcpGatewayRouter.post(
  '/mcp/:integrationId',
  asyncHandler(async (req, res) => {
    const integrationId = z.string().regex(/^[a-fA-F0-9]{24}$/).parse(req.params.integrationId);
    const response = await handleMcpGatewayRequest(integrationId, req.body);
    res.json(response);
  })
);

