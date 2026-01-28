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
}
