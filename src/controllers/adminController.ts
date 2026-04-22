import type { Request, Response } from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';
import { listLogs } from '../services/logService.js';

function requireAdmin(req: Request) {
  const configured = env.ADMIN_TOKEN;
  if (!configured) {
    throw Object.assign(new Error('ADMIN_TOKEN not configured'), { statusCode: 403 });
  }
  const token = String(req.header('x-admin-token') ?? '');
  if (token !== configured) {
    throw Object.assign(new Error('Forbidden'), { statusCode: 403 });
  }
}

export async function getLogs(req: Request, res: Response) {
  requireAdmin(req);

  const QuerySchema = z.object({
    conversationId: z.string().regex(/^[a-fA-F0-9]{24}$/),
    limit: z.coerce.number().int().min(1).max(500).optional().default(100),
    order: z.enum(['asc', 'desc']).optional().default('desc')
  });

  const query = QuerySchema.parse(req.query);
  const logs = await listLogs({
    conversationId: query.conversationId,
    limit: query.limit,
    order: query.order
  });

  res.json({ logs });
}

