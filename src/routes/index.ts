import type { Express } from 'express';
import { messageRouter } from './message.js';
import { assistantsRouter } from './assistants.js';
import { integrationsRouter } from './integrations.js';
import { mcpGatewayRouter } from './mcpGateway.js';
import { errorHandler } from '../middlewares/errorHandler.js';

export function registerRoutes(app: Express) {
  app.get('/health', (_req, res) => res.json({ ok: true }));
  app.use(assistantsRouter);
  app.use(integrationsRouter);
  app.use(mcpGatewayRouter);
  app.use(messageRouter);
  app.use(errorHandler);
}
