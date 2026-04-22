import mongoose from 'mongoose';
import type { Logger } from 'pino';

let connectPromise: Promise<typeof mongoose> | null = null;

export async function connectMongo(uri: string, logger: Logger) {
  mongoose.set('strictQuery', true);
  const connectedState: number = (mongoose.ConnectionStates as any)?.connected ?? 1;
  if (Number(mongoose.connection.readyState) === connectedState) return;

  if (!connectPromise) {
    connectPromise = mongoose.connect(uri, {
      autoIndex: true
    });
  }

  await connectPromise;
  if (Number(mongoose.connection.readyState) === connectedState) {
    logger.info({ uri: redactMongoUri(uri) }, 'mongo connected');
  }
}

function redactMongoUri(uri: string) {
  try {
    const url = new URL(uri);
    if (url.password) url.password = '***';
    return url.toString();
  } catch {
    return uri.replace(/\/\/([^@]+)@/g, '//***@');
  }
}
