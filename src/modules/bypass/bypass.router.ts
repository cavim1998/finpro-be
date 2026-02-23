import { Router } from "express";
import { BypassController } from "./bypass.controller.js";
import { RoleCode } from "../../../generated/prisma/client.js";
import {
  verifyToken,
  authorizeRole,
} from "../../middlewares/jwt.middleware.js";

export class BypassRouter {
  private router: Router;

  constructor(private bypassController: BypassController) {
    this.router = Router();
    this.initRoutes();
  }

  private initRoutes() {
    this.router.use(verifyToken(process.env.JWT_SECRET!));

    this.router.get(
      "/",
      authorizeRole([RoleCode.SUPER_ADMIN, RoleCode.OUTLET_ADMIN]),
      this.bypassController.findAll,
    );

    this.router.patch(
      "/:id/decision",
      authorizeRole([RoleCode.SUPER_ADMIN, RoleCode.OUTLET_ADMIN]),
      this.bypassController.decision,
    );
  }

  getRouter() {
    return this.router;
  }
}
