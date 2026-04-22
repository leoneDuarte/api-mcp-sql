import { Types } from 'mongoose';
import { LogModel } from '../models/Log.js';

export async function logAction(input: {
  conversationId: Types.ObjectId;
  action: string;
  payload?: unknown;
  response?: unknown;
}) {
  await LogModel.create({
    conversationId: input.conversationId,
    action: input.action,
    payload: input.payload,
    response: input.response,
    timestamp: new Date()
  });
}

