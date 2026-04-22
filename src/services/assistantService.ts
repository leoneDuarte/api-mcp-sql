import { z } from 'zod';
import { AssistantModel, type AssistantDoc } from '../models/Assistant.js';

export const AssistantIdSchema = z.string().regex(/^[a-fA-F0-9]{24}$/);

export async function getAssistantOrThrow(assistantId: string): Promise<AssistantDoc> {
  const assistant = await AssistantModel.findById(assistantId)
    .select('+mcpServers.authorization')
    .lean<AssistantDoc>()
    .exec();
  if (!assistant) {
    const error = new Error('Assistant not found');
    (error as any).statusCode = 404;
    throw error;
  }
  return assistant;
}
