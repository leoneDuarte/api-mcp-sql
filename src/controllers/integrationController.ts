import type { Request, Response } from 'express';
import { z } from 'zod';
import { IntegrationModel } from '../models/Integration.js';

const JsonValue: z.ZodType<unknown> = z.lazy(() =>
  z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(JsonValue), z.record(JsonValue)])
);

const ToolSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
  path: z.string().min(1),
  headers: z.record(z.string()).optional(),
  query: z.record(JsonValue).optional(),
  body: JsonValue.optional(),
  inputSchema: JsonValue.optional()
});

const AuthSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('none') }),
  z.object({ type: z.literal('bearer'), token: z.string().min(1), headerName: z.string().min(1).optional() })
]);

const CreateIntegrationSchema = z.object({
  name: z.string().min(1),
  baseUrl: z.string().url(),
  auth: AuthSchema.optional().default({ type: 'none' }),
  headers: z.record(z.string()).optional().default({}),
  tools: z.array(ToolSchema).optional().default([])
});

const UpdateIntegrationSchema = CreateIntegrationSchema.partial();

export async function createIntegration(req: Request, res: Response) {
  const payload = CreateIntegrationSchema.parse(req.body);
  const doc = await IntegrationModel.create(payload);
  res.status(201).json(safeIntegration(doc.toObject()));
}

export async function listIntegrations(_req: Request, res: Response) {
  const docs = await IntegrationModel.find({}).lean();
  res.json(docs.map(safeIntegration));
}

export async function getIntegration(req: Request, res: Response) {
  const id = z.string().regex(/^[a-fA-F0-9]{24}$/).parse(req.params.id);
  const doc = await IntegrationModel.findById(id).lean();
  if (!doc) return res.status(404).json({ error: 'not_found' });
  res.json(safeIntegration(doc));
}

export async function updateIntegration(req: Request, res: Response) {
  const id = z.string().regex(/^[a-fA-F0-9]{24}$/).parse(req.params.id);
  const payload = UpdateIntegrationSchema.parse(req.body);
  const doc = await IntegrationModel.findByIdAndUpdate(id, payload, { new: true }).lean();
  if (!doc) return res.status(404).json({ error: 'not_found' });
  res.json(safeIntegration(doc));
}

export async function deleteIntegration(req: Request, res: Response) {
  const id = z.string().regex(/^[a-fA-F0-9]{24}$/).parse(req.params.id);
  const result = await IntegrationModel.deleteOne({ _id: id });
  res.json({ deleted: result.deletedCount === 1 });
}

function safeIntegration(doc: any) {
  if (!doc) return doc;
  const copy = { ...doc };
  if (copy.auth && typeof copy.auth === 'object') {
    // never return token
    copy.auth = { ...copy.auth };
    delete copy.auth.token;
  }
  return copy;
}

