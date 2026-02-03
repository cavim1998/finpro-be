import { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/api-error.js";

export const requireEmailVerified = () => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = res.locals.user;

    if (!user) {
      throw new ApiError("Authentication required", 401);
    }

    // Check if user has verified email - this would need to be fetched from DB
    // For now, we'll add a flag in the JWT token or fetch from DB
    // This is a placeholder - you'll need to modify based on your JWT structure

    next();
  };
};

export const requireRole = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = res.locals.user;

    if (!user) {
      throw new ApiError("Authentication required", 401);
    }

    if (!allowedRoles.includes(user.role)) {
      throw new ApiError(
        "You do not have permission to access this resource",
        403,
      );
    }

    next();
  };
};
