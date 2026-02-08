import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/api-error.js";

type DtoCtor<T> = new () => T;

async function validateDto<T>(dtoClass: DtoCtor<T>, payload: unknown) {
  if (payload === undefined || payload === null) {
    throw new ApiError("Validation payload is required", 400);
  }

  const dtoInstance = plainToInstance(dtoClass, payload, {
    enableImplicitConversion: true,
  });

  const errors = await validate(dtoInstance as any);

  if (errors.length > 0) {
    const message = errors
      .map((error) => Object.values(error.constraints || {}))
      .flat()
      .join(", ");

    throw new ApiError(message, 400);
  }

  return dtoInstance;
}

export class ValidationMiddleware {
  validateBody<T>(dtoClass: DtoCtor<T>) {
    return async (req: Request, _res: Response, next: NextFunction) => {
      if (!req.body) throw new ApiError("Request body is required", 400);

      req.body = await validateDto(dtoClass, req.body);
      next();
    };
  }

  validateQuery<T>(dtoClass: new () => T) {
    return async (req: Request, _res: Response, next: NextFunction) => {
      const dtoInstance = plainToInstance(dtoClass, req.query);
      const errors = await validate(dtoInstance as any);
      if (errors.length > 0) {
        const message = errors
          .map((e) => Object.values(e.constraints || {}))
          .flat()
          .join(", ");
        throw new ApiError(message, 400);
      }
      req.query = dtoInstance as any;
      next();
    };
  }

  validateParams<T>(dtoClass: new () => T) {
    return async (req: Request, _res: Response, next: NextFunction) => {
      const dtoInstance = plainToInstance(dtoClass, req.params);
      const errors = await validate(dtoInstance as any);
      if (errors.length > 0) {
        const message = errors
          .map((e) => Object.values(e.constraints || {}))
          .flat()
          .join(", ");
        throw new ApiError(message, 400);
      }
      req.params = dtoInstance as any;
      next();
    };
  }
}
