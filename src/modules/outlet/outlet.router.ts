import { Router } from "express";
import { ValidationMiddleware } from "../../middlewares/validation.middleware.js";
import { CreateOutletDto } from "./dto/create-outlet.dto.js";
// import { UpdateOutletDTO } from "./dto/update-outlet.dto.js";
import { OutletController } from "./outlet.controller.js";
import { UpdateOutletDto } from "./dto/update-outlet.dto.js";

export class OutletRouter {
  private router: Router;

  constructor(
    private outletController: OutletController,
    private validationMiddleware: ValidationMiddleware,
  ) {
    this.router = Router();
    this.initializedRoutes();
  }

  private initializedRoutes = () => {
    this.router.get("/", this.outletController.getOutlets);
    this.router.get("/:id", this.outletController.getOutletById);

    this.router.post(
      "/",
      this.validationMiddleware.validateBody(CreateOutletDto),
      this.outletController.createOutlet,
    );

    this.router.patch(
      "/:id",
      this.validationMiddleware.validateBody(UpdateOutletDto),
      this.outletController.updateOutlet,
    );

    this.router.delete("/:id", this.outletController.deleteOutlet);
  };

  getRouter = () => {
    return this.router;
  };
}
