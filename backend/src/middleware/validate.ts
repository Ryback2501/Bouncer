import { z } from "zod";
import { Request, Response, NextFunction } from "express";

export function validateBody<T>(schema: z.ZodType<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ error: "validation_error", issues: result.error.issues });
      return;
    }
    req.body = result.data;
    next();
  };
}

export function validateQuery<T>(schema: z.ZodType<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      res.status(400).json({ error: "validation_error", issues: result.error.issues });
      return;
    }
    req.query = result.data as Record<string, string>;
    next();
  };
}
