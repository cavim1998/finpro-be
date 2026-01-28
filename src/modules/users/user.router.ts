import { Router } from "express";
import { JWT_SECRET } from "../../config/env.js";
import { verifyToken } from "../../middlewares/jwt.middleware.js";
import { UserController } from "./user.controller.js";

export class UserRouter {
  private router: Router;

  constructor(private userController: UserController) {
    this.router = Router();
    this.initializedRoutes();
  }

  private initializedRoutes = () => {
    this.router.get("/", verifyToken(JWT_SECRET), this.userController.getUsers);
    this.router.get(
      "/:id",
      verifyToken(JWT_SECRET),
      this.userController.getUser,
    );
  };

  getRouter = () => this.router;
}
