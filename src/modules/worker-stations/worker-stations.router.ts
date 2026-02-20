import { Router } from "express";
import { verifyToken } from "../../middlewares/jwt.middleware.js";
import { WorkerStationsController } from "./worker-stations.controller.js";
import { requireRole } from "../../middlewares/auth.middleware.js";
import { ValidationMiddleware } from "../../middlewares/validation.middleware.js";
import { PrismaClient } from "../../../generated/prisma/client.js";
import { WorkerStationsService } from "./worker-stations.service.js";

export class WorkerStationsRouter {
  private router: Router;
  private workerStationsController: WorkerStationsController;
  private validationMiddleware: ValidationMiddleware;

  constructor(
    prisma: PrismaClient,
    validationMiddleware: ValidationMiddleware,
  ) {
    this.router = Router();
    this.validationMiddleware = validationMiddleware;

    const workerStationsService = new WorkerStationsService(prisma);
    this.workerStationsController = new WorkerStationsController(
      workerStationsService,
    );
    this.initializedRoutes();
  }

  private initializedRoutes() {
    this.router.use(verifyToken);
    this.router.use(requireRole(["WORKER"]));

    // list
    this.router.get(
      "/:stationType/incoming",
      this.workerStationsController.getIncoming,
    );
    this.router.get(
      "/:stationType/my-tasks",
      this.workerStationsController.getMyTasks,
    );

    // actions
    this.router.post(
      "/:stationType/:orderId/start",
      this.workerStationsController.startTask,
    );
    this.router.post(
      "/:stationType/:orderId/complete",
      this.workerStationsController.completeTask,
    );
  }

  getRouter = () => {
    return this.router;
  };
}
