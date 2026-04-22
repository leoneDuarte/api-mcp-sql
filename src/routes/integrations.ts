import { Router } from 'express';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  createIntegration,
  deleteIntegration,
  getIntegration,
  listIntegrations,
  updateIntegration
} from '../controllers/integrationController.js';

export const integrationsRouter = Router();

integrationsRouter.post('/integrations', asyncHandler(createIntegration));
integrationsRouter.get('/integrations', asyncHandler(listIntegrations));
integrationsRouter.get('/integrations/:id', asyncHandler(getIntegration));
integrationsRouter.patch('/integrations/:id', asyncHandler(updateIntegration));
integrationsRouter.delete('/integrations/:id', asyncHandler(deleteIntegration));

