import mongoose, { Schema } from 'mongoose';

export type IntegrationAuth =
  | { type: 'none' }
  | { type: 'bearer'; token: string; headerName?: string };

export type IntegrationTool = {
  name: string;
  description?: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  headers?: Record<string, string>;
  query?: Record<string, unknown>;
  body?: unknown;
  inputSchema?: unknown;
};

export type IntegrationDoc = mongoose.InferSchemaType<typeof IntegrationSchema>;

const AuthSchema = new Schema<IntegrationAuth>(
  {
    type: { type: String, required: true, enum: ['none', 'bearer'] },
    token: { type: String, required: false, select: false },
    headerName: { type: String, required: false }
  },
  { _id: false }
);

const ToolSchema = new Schema<IntegrationTool>(
  {
    name: { type: String, required: true },
    description: { type: String, required: false },
    method: { type: String, required: true, enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] },
    path: { type: String, required: true },
    headers: { type: Schema.Types.Mixed, required: false },
    query: { type: Schema.Types.Mixed, required: false },
    body: { type: Schema.Types.Mixed, required: false },
    inputSchema: { type: Schema.Types.Mixed, required: false }
  },
  { _id: false }
);

export const IntegrationSchema = new Schema(
  {
    name: { type: String, required: true },
    baseUrl: { type: String, required: true },
    auth: { type: AuthSchema, required: true, default: { type: 'none' } },
    headers: { type: Schema.Types.Mixed, required: false, default: {} },
    tools: { type: [ToolSchema], required: true, default: [] }
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } }
);

IntegrationSchema.index({ name: 1 }, { unique: true });

export const IntegrationModel =
  mongoose.models.Integration ?? mongoose.model('Integration', IntegrationSchema, 'integrations');

