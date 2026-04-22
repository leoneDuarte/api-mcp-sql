import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'validation_error',
      issues: err.issues
    });
  }

  const statusCode =
    typeof err === 'object' && err && 'statusCode' in err ? Number((err as any).statusCode) : 500;

  return res.status(statusCode).json({
    error: statusCode === 500 ? 'internal_error' : 'request_error',
    message: err instanceof Error ? err.message : 'Unknown error'
  });
}

