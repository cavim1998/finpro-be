import { Router } from "express";
import { ValidationMiddleware } from "../../middlewares/validation.middleware.js";
import { CreateItemDTO } from "./dto/create-item.dto.js";
import { LaundryItemController } from "./laundry-item.controller.js";

export class LaundryItemRouter {
  private router: Router;

  constructor(
    private laundryItemController: LaundryItemController,
    private validationMiddleware: ValidationMiddleware,
  ) {
    this.router = Router();
    this.initializedRoutes();
  }

  private initializedRoutes = () => {
    this.router.get("/", this.laundryItemController.getItems);

    this.router.post(
      "/",
      this.validationMiddleware.validateBody(CreateItemDTO),
      this.laundryItemController.createItem,
    );

    this.router.patch("/:id", this.laundryItemController.updateItem);

    this.router.delete("/:id", this.laundryItemController.deleteItem);
  };

  getRouter = () => {
    return this.router;
  };
}
