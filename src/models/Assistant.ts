import mongoose, { Schema } from 'mongoose';

export type McpServerConfig = {
  type: 'mcp';
  server_label: string;
  server_description?: string;
  server_url?: string;
  connector_id?: string;
  authorization?: string;
  require_approval?:
    | 'never'
    | 'always'
    | {
        never?: { tool_names: string[] };
        always?: { tool_names: string[] };
      };
  allowed_tools?: string[];
};

export type AssistantDoc = mongoose.InferSchemaType<typeof AssistantSchema>;

const McpServerSchema = new Schema<McpServerConfig>(
  {
    type: { type: String, required: true, enum: ['mcp'], default: 'mcp' },
    server_label: { type: String, required: true },
    server_description: { type: String, required: false },
    server_url: { type: String, required: false },
    connector_id: { type: String, required: false },
    authorization: { type: String, required: false, select: false },
    require_approval: { type: Schema.Types.Mixed, required: false },
    allowed_tools: { type: [String], required: false }
  },
  { _id: false }
);

export const AssistantSchema = new Schema(
  {
    name: { type: String, required: true },
    prompt: { type: String, required: true },
    mcpServers: { type: [McpServerSchema], required: true, default: [] }
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } }
);

export const AssistantModel =
  mongoose.models.Assistant ?? mongoose.model('Assistant', AssistantSchema, 'assistants');
