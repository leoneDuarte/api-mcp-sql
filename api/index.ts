import type { VercelRequest, VercelResponse } from '@vercel/node';
import { env } from '../src/config/env.js';
import { createApp } from '../src/app.js';
import { connectMongo } from '../src/services/mongo.js';

const { app, logger } = createApp();
let mongoReady: Promise<void> | null = null;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!mongoReady) mongoReady = connectMongo(env.MONGODB_URI, logger);
  await mongoReady;
  // Express app is a function (req,res)
  return (app as any)(req, res);
}

