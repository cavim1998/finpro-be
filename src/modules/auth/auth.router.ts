import { Router } from "express";
import { UploaderMiddleware } from "../../middlewares/uploader.middleware.js";
import { ValidationMiddleware } from "../../middlewares/validation.middleware.js";
import { AuthController } from "./auth.controller.js";
import { ForgotPasswordDTO } from "./dto/forgot-password.dto.js";
import { LoginDTO } from "./dto/login.dto.js";
import { RegisterDTO } from "./dto/register.dto.js";
import { ResetPasswordDTO } from "./dto/reset-password.dto.js";
import { VerifyEmailDTO } from "./dto/verify-email.dto.js";
import { ResendVerificationDTO } from "./dto/resend-verification.dto.js";

export class AuthRouter {
  private router: Router;

  constructor(
    private authController: AuthController,
    private validationMiddleware: ValidationMiddleware,
    private uploaderMiddleware: UploaderMiddleware,
  ) {
    this.router = Router();
    this.initializedRoutes();
  }

  private initializedRoutes = () => {
    this.router.post(
      "/register",
      this.uploaderMiddleware.upload().single("profileImage"),
      this.validationMiddleware.validateBody(RegisterDTO),
      this.authController.register,
    );
    this.router.post(
      "/login",
      this.validationMiddleware.validateBody(LoginDTO),
      this.authController.login,
    );
    this.router.post(
      "/verify-email",
      this.validationMiddleware.validateBody(VerifyEmailDTO),
      this.authController.verifyEmail,
    );
    this.router.post(
      "/resend-verification",
      this.validationMiddleware.validateBody(ResendVerificationDTO),
      this.authController.resendVerificationEmail,
    );
    this.router.post(
      "/forgot-password",
      this.validationMiddleware.validateBody(ForgotPasswordDTO),
      this.authController.forgotPassword,
    );
    this.router.post(
      "/reset-password",
      this.validationMiddleware.validateBody(ResetPasswordDTO),
      this.authController.resetPassword,
    );
  };

  getRouter = () => {
    return this.router;
  };
}
