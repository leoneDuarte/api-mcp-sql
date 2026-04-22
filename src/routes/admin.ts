import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getLogs } from '../controllers/adminController.js';

export const adminRouter = Router();

adminRouter.get('/admin/logs', asyncHandler(getLogs));

