import { Router } from "express";
import { JWT_SECRET } from "../../config/env.js";
import { verifyToken } from "../../middlewares/jwt.middleware.js";
import { ValidationMiddleware } from "../../middlewares/validation.middleware.js";
import { UploaderMiddleware } from "../../middlewares/uploader.middleware.js";
import { UserController } from "./user.controller.js";
import { UpdateProfileDTO } from "./dto/update-profile.dto.js";
import { ChangePasswordDTO } from "./dto/change-password.dto.js";
import { UpdateEmailDTO } from "./dto/update-email.dto.js";

export class UserRouter {
  private router: Router;

  constructor(
    private userController: UserController,
    private validationMiddleware: ValidationMiddleware,
    private uploaderMiddleware: UploaderMiddleware,
  ) {
    this.router = Router();
    this.initializedRoutes();
  }

  private initializedRoutes = () => {
    // Get all users (admin)
    this.router.get("/", verifyToken(JWT_SECRET), this.userController.getUsers);

    // Get user by ID
    this.router.get(
      "/:id",
      verifyToken(JWT_SECRET),
      this.userController.getUser,
    );

    // Get current user profile
    this.router.get(
      "/profile/me",
      verifyToken(JWT_SECRET),
      this.userController.getProfile,
    );

    // Update profile
    this.router.put(
      "/profile/me",
      verifyToken(JWT_SECRET),
      this.uploaderMiddleware.upload().single("photo"),
      this.validationMiddleware.validateBody(UpdateProfileDTO),
      this.userController.updateProfile,
    );

    // Change password
    this.router.put(
      "/profile/change-password",
      verifyToken(JWT_SECRET),
      this.validationMiddleware.validateBody(ChangePasswordDTO),
      this.userController.changePassword,
    );

    // Update email
    this.router.put(
      "/profile/update-email",
      verifyToken(JWT_SECRET),
      this.validationMiddleware.validateBody(UpdateEmailDTO),
      this.userController.updateEmail,
    );

    // Request email verification
    this.router.post(
      "/profile/request-verification",
      verifyToken(JWT_SECRET),
      this.userController.requestEmailVerification,
    );
  };

  getRouter = () => this.router;
}
