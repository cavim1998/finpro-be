import { Router } from "express";
import { ShiftController } from "./shift.controller.js";
import { ValidationMiddleware } from "../../middlewares/validation.middleware.js";
import { CreateShiftDTO } from "./dto/create-shift.dto.js";

export class ShiftRouter {
  private router: Router;

  constructor(
    private shiftController: ShiftController,
    private validationMiddleware: ValidationMiddleware,
  ) {
    this.router = Router();
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.get("/", this.shiftController.getShifts);

    this.router.post(
      "/",
      this.validationMiddleware.validateBody(CreateShiftDTO),
      this.shiftController.createShift,
    );

    this.router.delete("/:id", this.shiftController.deleteShift);
  }

  getRouter() {
    return this.router;
  }
}
