import mongoose, { Schema } from 'mongoose';

export type LogDoc = mongoose.InferSchemaType<typeof LogSchema>;

export const LogSchema = new Schema(
  {
    conversationId: { type: Schema.Types.ObjectId, required: true, index: true, ref: 'Conversation' },
    action: { type: String, required: true },
    payload: { type: Schema.Types.Mixed, required: false },
    response: { type: Schema.Types.Mixed, required: false },
    timestamp: { type: Date, required: true }
  },
  { versionKey: false }
);

export const LogModel = mongoose.models.Log ?? mongoose.model('Log', LogSchema, 'logs');

