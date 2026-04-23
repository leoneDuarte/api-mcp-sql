import type { Request, Response } from 'express';
import { z } from 'zod';
import { AssistantModel } from '../models/Assistant.js';

const RequireApprovalSchema = z.union([
  z.enum(['never', 'always']),
  z.object({
    never: z.object({ tool_names: z.array(z.string().min(1)).min(1) }).optional(),
    always: z.object({ tool_names: z.array(z.string().min(1)).min(1) }).optional()
  })
]);

const McpServerSchema = z
  .object({
    type: z.literal('mcp').optional().default('mcp'),
    server_label: z.string().min(1),
    server_description: z.string().optional(),
    server_url: z.string().url().optional(),
    connector_id: z.string().optional(),
    authorization: z.string().optional(),
    require_approval: RequireApprovalSchema.optional().default('never'),
    allowed_tools: z.array(z.string().min(1)).optional()
  })
  .refine((v) => Boolean(v.server_url) || Boolean(v.connector_id), {
    message: 'mcp server must provide server_url or connector_id'
  });

const CreateAssistantSchema = z.object({
  name: z.string().min(1),
  prompt: z.string().min(1),
  mcpServers: z.array(McpServerSchema).default([])
});

const UpdateAssistantSchema = CreateAssistantSchema.partial().refine((v) => Object.keys(v).length > 0, {
  message: 'At least one field must be provided'
});

export async function createAssistant(req: Request, res: Response) {
  const payload = CreateAssistantSchema.parse(req.body);
  const doc = await AssistantModel.create(payload);
  res.status(201).json(safeAssistant(doc.toObject()));
}

export async function getAssistant(req: Request, res: Response) {
  const id = z.string().regex(/^[a-fA-F0-9]{24}$/).parse(req.params.id);
  const assistant = await AssistantModel.findById(id).lean();
  if (!assistant) return res.status(404).json({ error: 'not_found' });
  res.json(safeAssistant(assistant));
}

export async function listAssistants(_req: Request, res: Response) {
  const docs = await AssistantModel.find({}).sort({ createdAt: -1 }).lean();
  res.json(docs.map(safeAssistant));
}

export async function updateAssistant(req: Request, res: Response) {
  const id = z.string().regex(/^[a-fA-F0-9]{24}$/).parse(req.params.id);
  const payload = UpdateAssistantSchema.parse(req.body);

  const doc = await AssistantModel.findByIdAndUpdate(id, payload, { new: true }).lean();
  if (!doc) return res.status(404).json({ error: 'not_found' });
  res.json(safeAssistant(doc));
}

function safeAssistant(doc: any) {
  if (!doc) return doc;
  const copy = { ...doc };
  if (Array.isArray(copy.mcpServers)) {
    copy.mcpServers = copy.mcpServers.map((s: any) => {
      const server = { ...s };
      delete server.authorization;
      return server;
    });
  }
  return copy;
}
