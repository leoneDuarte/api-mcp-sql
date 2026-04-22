import cors from 'cors';
import express from 'express';
import pino from 'pino';
import pinoHttp from 'pino-http';
import { registerRoutes } from './routes/index.js';

export function createApp() {
  const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' });

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  const httpLogger = (pinoHttp as unknown as (opts: any) => any)({ logger });
  app.use(httpLogger);

  registerRoutes(app);

  return { app, logger };
}

