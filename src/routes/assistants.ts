import { Router } from 'express';
import {
  createAssistant,
  getAssistant,
  listAssistants,
  updateAssistant
} from '../controllers/assistantController.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const assistantsRouter = Router();

assistantsRouter.post('/assistants', asyncHandler(createAssistant));
assistantsRouter.get('/assistants', asyncHandler(listAssistants));
assistantsRouter.get('/assistants/:id', asyncHandler(getAssistant));
assistantsRouter.patch('/assistants/:id', asyncHandler(updateAssistant));
