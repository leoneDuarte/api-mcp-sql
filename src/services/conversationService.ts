import { Types } from 'mongoose';
import { ConversationModel, type ConversationMessage } from '../models/Conversation.js';

export async function getOrCreateConversation(input: {
  clientId: string;
  assistantId: string;
}) {
  const assistantObjectId = new Types.ObjectId(input.assistantId);

  const conversation = await ConversationModel.findOneAndUpdate(
    { clientId: input.clientId, assistantId: assistantObjectId },
    {
      $setOnInsert: {
        clientId: input.clientId,
        assistantId: assistantObjectId,
        currentStep: null,
        variables: {},
        history: []
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).exec();

  if (!conversation) {
    throw new Error('Failed to create conversation');
  }
  return conversation;
}

export async function appendHistory(conversationId: Types.ObjectId, message: ConversationMessage) {
  await ConversationModel.updateOne(
    { _id: conversationId },
    { $push: { history: message }, $set: { updatedAt: new Date() } }
  );
}

export async function setConversationState(input: {
  conversationId: Types.ObjectId;
  currentStep?: string | null;
  variables?: Record<string, unknown>;
}) {
  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (input.currentStep !== undefined) update.currentStep = input.currentStep;
  if (input.variables !== undefined) update.variables = input.variables;

  await ConversationModel.updateOne({ _id: input.conversationId }, { $set: update });
}
