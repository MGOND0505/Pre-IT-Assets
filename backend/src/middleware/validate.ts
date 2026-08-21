import type { NextFunction, Request, Response } from "express";
import type { ZodType } from "zod";
import { ApiError } from "../utils/ApiError";

type ValidationTargets = {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
};

export function validate(schemas: ValidationTargets) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (schemas.body) {
      const result = schemas.body.safeParse(req.body);
      if (!result.success) {
        return next(new ApiError(422, "Validation failed", result.error.flatten()));
      }
      req.body = result.data;
    }

    if (schemas.query) {
      const result = schemas.query.safeParse(req.query);
      if (!result.success) {
        return next(new ApiError(422, "Validation failed", result.error.flatten()));
      }
      req.query = result.data as typeof req.query;
    }

    if (schemas.params) {
      const result = schemas.params.safeParse(req.params);
      if (!result.success) {
        return next(new ApiError(422, "Validation failed", result.error.flatten()));
      }
      req.params = result.data as typeof req.params;
    }

    next();
  };
}
