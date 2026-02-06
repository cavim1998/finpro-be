import { Router } from "express";
import { JWT_SECRET } from "../../config/env.js";
import { verifyToken } from "../../middlewares/jwt.middleware.js";
import { ValidationMiddleware } from "../../middlewares/validation.middleware.js";
import { UploaderMiddleware } from "../../middlewares/uploader.middleware.js";
import { UserController } from "./user.controller.js";
import { UpdateProfileDTO } from "./dto/update-profile.dto.js";
import { ChangePasswordDTO } from "./dto/change-password.dto.js";
import { UpdateEmailDTO } from "./dto/update-email.dto.js";
import { CreateAddressDTO } from "./dto/create-address.dto.js";
import { UpdateAddressDTO } from "./dto/update-address.dto.js";
import { SetPrimaryAddressDTO } from "./dto/set-primary-address.dto.js";

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

    // Get current user profile (MUST be before /:id route)
    this.router.get(
      "/profile",
      verifyToken(JWT_SECRET),
      this.userController.getProfile,
    );

    /**
     * =========================
     * ADDRESS MANAGEMENT ROUTES
     * (MUST be before /:id route to avoid conflicts)
     * =========================
     */

    // Get all addresses
    this.router.get(
      "/addresses",
      verifyToken(JWT_SECRET),
      this.userController.getAddresses,
    );

    // Create new address
    this.router.post(
      "/addresses",
      verifyToken(JWT_SECRET),
      this.validationMiddleware.validateBody(CreateAddressDTO),
      this.userController.createAddress,
    );

    // Update address
    this.router.put(
      "/addresses/:id",
      verifyToken(JWT_SECRET),
      this.validationMiddleware.validateBody(UpdateAddressDTO),
      this.userController.updateAddress,
    );

    // Delete address
    this.router.delete(
      "/addresses/:id",
      verifyToken(JWT_SECRET),
      this.userController.deleteAddress,
    );

    // Set address as primary (PATCH version)
    this.router.patch(
      "/addresses/:id/set-primary",
      verifyToken(JWT_SECRET),
      this.validationMiddleware.validateBody(SetPrimaryAddressDTO),
      this.userController.setPrimaryAddress,
    );

    // Set address as primary (PUT version - /primary endpoint)
    this.router.put(
      "/addresses/:id/primary",
      verifyToken(JWT_SECRET),
      this.userController.setPrimaryAddress,
    );

    // Get user by ID
    this.router.get(
      "/:id",
      verifyToken(JWT_SECRET),
      this.userController.getUser,
    );

    // Update profile (name, phone, address)
    this.router.put(
      "/profile",
      verifyToken(JWT_SECRET),
      this.validationMiddleware.validateBody(UpdateProfileDTO),
      this.userController.updateProfile,
    );

    // Upload profile photo
    this.router.post(
      "/profile/photo",
      verifyToken(JWT_SECRET),
      this.uploaderMiddleware.upload().single("file"),
      this.userController.uploadProfilePhoto,
    );

    // Change email
    this.router.put(
      "/profile/email",
      verifyToken(JWT_SECRET),
      this.validationMiddleware.validateBody(UpdateEmailDTO),
      this.userController.updateEmail,
    );

    // Change password
    this.router.put(
      "/profile/password",
      verifyToken(JWT_SECRET),
      this.validationMiddleware.validateBody(ChangePasswordDTO),
      this.userController.changePassword,
    );

    // Request email verification (optional helper)
    this.router.post(
      "/profile/request-verification",
      verifyToken(JWT_SECRET),
      this.userController.requestEmailVerification,
    );
  };

  getRouter = () => this.router;
}
