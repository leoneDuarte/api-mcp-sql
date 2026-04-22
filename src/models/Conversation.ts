import mongoose, { Schema } from 'mongoose';

export type ConversationMessage = {
  role: 'user' | 'assistant' | 'system';
  message: string;
  metadata?: Record<string, unknown>;
  timestamp: Date;
};

export type ConversationDoc = mongoose.InferSchemaType<typeof ConversationSchema>;

const MessageSchema = new Schema<ConversationMessage>(
  {
    role: { type: String, required: true, enum: ['user', 'assistant', 'system'] },
    message: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed, required: false },
    timestamp: { type: Date, required: true }
  },
  { _id: false }
);

export const ConversationSchema = new Schema(
  {
    clientId: { type: String, required: true, index: true },
    assistantId: { type: Schema.Types.ObjectId, required: true, index: true, ref: 'Assistant' },
    currentStep: { type: String, required: false, default: null },
    variables: { type: Schema.Types.Mixed, required: true, default: {} },
    history: { type: [MessageSchema], required: true, default: [] }
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } }
);

ConversationSchema.index({ clientId: 1, assistantId: 1 }, { unique: true });

export const ConversationModel =
  mongoose.models.Conversation ??
  mongoose.model('Conversation', ConversationSchema, 'conversations');

