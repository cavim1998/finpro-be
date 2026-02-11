import { Router } from "express";
import { verifyToken } from "../../middlewares/jwt.middleware.js";
import { WorkerStationsController } from "./worker-stations.controller.js";
import { requireRole } from "../../middlewares/auth.middleware.js";

export class WorkerStationsRouter {
  public router: Router;
  private controller: WorkerStationsController;

  constructor() {
    this.router = Router();
    this.controller = new WorkerStationsController();
    this.initRoutes();
  }

  private initRoutes() {
    this.router.use(verifyToken);
    this.router.use(requireRole(["WORKER"]));

    // list
    this.router.get("/:stationType/incoming", this.controller.getIncoming);
    this.router.get("/:stationType/my-tasks", this.controller.getMyTasks);

    // actions
    this.router.post("/:stationType/:orderId/start", this.controller.startTask);
    this.router.post(
      "/:stationType/:orderId/complete",
      this.controller.completeTask,
    );
  }
}
