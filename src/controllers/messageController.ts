import type { Request, Response } from 'express';
import { z } from 'zod';
import { getAssistantOrThrow } from '../services/assistantService.js';
import { getOrCreateConversation } from '../services/conversationService.js';
import { OpenAiEngine } from '../engine/openaiEngine.js';
import { logAction } from '../services/logService.js';

const MessagePayloadSchema = z.object({
  clientId: z.string().min(1),
  assistantId: z.string().regex(/^[a-fA-F0-9]{24}$/),
  message: z.string().min(1),
  metadata: z.record(z.unknown()).optional().default({})
});

const engine = new OpenAiEngine();

export async function handleMessage(req: Request, res: Response) {
  const payload = MessagePayloadSchema.parse(req.body);

  const assistant = await getAssistantOrThrow(payload.assistantId);
  const conversation = await getOrCreateConversation({
    clientId: payload.clientId,
    assistantId: payload.assistantId
  });

  await logAction({
    conversationId: conversation._id,
    action: 'request',
    payload
  });

  const result = await engine.runTurn({
    assistant,
    conversation: conversation as any,
    clientId: payload.clientId,
    assistantId: payload.assistantId,
    message: payload.message,
    metadata: payload.metadata
  });

  res.json({
    conversationId: result.conversationId,
    currentStep: result.currentStep,
    variables: result.variables,
    responses: result.responses,
    openaiResponseId: (result as any).openaiResponseId
  });
}
