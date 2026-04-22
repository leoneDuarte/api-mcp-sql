import { Router } from 'express';
import { handleMessage } from '../controllers/messageController.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const messageRouter = Router();

messageRouter.post('/message', asyncHandler(handleMessage));
