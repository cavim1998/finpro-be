import { Request, Response, NextFunction } from "express";
import { ApiError } from "../../utils/api-error.js";
import { UserService } from "./user.service.js";

export class UserController {
  constructor(private userService: UserService) {}

  getUsers = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const authUser = res.locals.user as { sub?: string };
      if (!authUser?.sub) throw new ApiError("Unauthorized", 401);

      const data = await this.userService.getUser(authUser.sub);
      res.status(200).send({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  getUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authUser = res.locals.user as { sub?: string };
      if (!authUser?.sub) throw new ApiError("Unauthorized", 401);

      if (authUser.sub !== req.params.id) {
        throw new ApiError("Forbidden", 403);
      }

      const data = await this.userService.getUser(req.params.id);
      res.status(200).send({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  getProfile = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const authUser = res.locals.user as { sub?: string };
      if (!authUser?.sub) throw new ApiError("Unauthorized", 401);

      const data = await this.userService.getProfile(authUser.sub);
      res.status(200).send({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  updateProfile = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authUser = res.locals.user as { sub?: string };
      if (!authUser?.sub) throw new ApiError("Unauthorized", 401);

      const data = await this.userService.updateProfile(
        authUser.sub,
        req.body,
        req.file,
      );
      res.status(200).send({ success: true, data });
    } catch (err) {
      next(err);
    }
  };

  changePassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authUser = res.locals.user as { sub?: string };
      if (!authUser?.sub) throw new ApiError("Unauthorized", 401);

      const result = await this.userService.changePassword(
        authUser.sub,
        req.body,
      );
      res.status(200).send(result);
    } catch (err) {
      next(err);
    }
  };

  updateEmail = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authUser = res.locals.user as { sub?: string };
      if (!authUser?.sub) throw new ApiError("Unauthorized", 401);

      const result = await this.userService.updateEmail(authUser.sub, req.body);
      res.status(200).send(result);
    } catch (err) {
      next(err);
    }
  };

  requestEmailVerification = async (
    _req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const authUser = res.locals.user as { sub?: string };
      if (!authUser?.sub) throw new ApiError("Unauthorized", 401);

      const result = await this.userService.requestEmailVerification(
        authUser.sub,
      );
      res.status(200).send(result);
    } catch (err) {
      next(err);
    }
  };
}
