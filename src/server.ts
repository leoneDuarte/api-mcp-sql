import { env } from './config/env.js';
import { connectMongo } from './services/mongo.js';
import { createApp } from './app.js';

const { app, logger } = createApp();

async function main() {
  await connectMongo(env.MONGODB_URI, logger);

  app.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, 'server listening');
  });
}

main().catch((error) => {
  logger.error({ error }, 'fatal');
  process.exitCode = 1;
});
