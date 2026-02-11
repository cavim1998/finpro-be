import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { ApiError } from "../utils/api-error.js";

export const verifyToken = (secretKey: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) throw new ApiError("No token provided", 401);

    jwt.verify(token, secretKey, (err, payload) => {
      if (err) {
        throw new ApiError("Invalid token / token expired", 401);
      }

      res.locals.user = payload;
      next();
    });
  };
};

export const authorizeRole = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = res.locals.user;
    if (!user || !allowedRoles.includes(user.role)) {
      throw new ApiError(
        `Access Denied: You don't have permission, ${user}`,
        403,
      );
    }

    next();
  };
};
