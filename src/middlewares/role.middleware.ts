import { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/api-error.js";
import { RoleCode } from "../../generated/prisma/enums.js";

export const requireRole = (allowedRoles: RoleCode[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = res.locals.user;

    if (!user) {
      throw new ApiError("Authentication required", 401);
    }

    // user.role harus RoleCode (number) juga
    if (!allowedRoles.includes(user.role as RoleCode)) {
      throw new ApiError(
        "You do not have permission to access this resource",
        403,
      );
    }

    next();
  };
};
