import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { ApiError } from "../utils/api-error.js";

export const verifyToken = (secretKey: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const authHeader = (req.headers.authorization ?? "").trim();
    const parts = authHeader.split(/\s+/).filter(Boolean);

    let token = "";
    if (parts.length === 1) {
      token = parts[0];
    } else if (parts.length >= 2 && parts[0].toLowerCase() === "bearer") {
      token = parts[parts.length - 1];
    }

    // Handle accidentally quoted tokens, e.g. "eyJ..."
    token = token.replace(/^"(.*)"$/, "$1");

    if (!token || token === "undefined" || token === "null") {
      throw new ApiError("No token provided", 401);
    }

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
