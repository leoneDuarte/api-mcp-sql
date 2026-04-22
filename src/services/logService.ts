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

export async function listLogs(input: {
  conversationId: string;
  limit?: number;
  order?: 'asc' | 'desc';
}) {
  const limit = input.limit ?? 100;
  const sort = input.order === 'asc' ? 1 : -1;

  return LogModel.find({ conversationId: new Types.ObjectId(input.conversationId) })
    .sort({ timestamp: sort })
    .limit(limit)
    .lean()
    .exec();
}
