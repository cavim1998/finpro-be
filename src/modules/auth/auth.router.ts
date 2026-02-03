import { Router } from "express";
import { ValidationMiddleware } from "../../middlewares/validation.middleware.js";
import { AuthController } from "./auth.controller.js";
import { ForgotPasswordDTO } from "./dto/forgot-password.dto.js";
import { LoginDTO } from "./dto/login.dto.js";
import { RegisterDTO } from "./dto/register.dto.js";
import { ResetPasswordDTO } from "./dto/reset-password.dto.js";
import { VerifyEmailDTO } from "./dto/verify-email.dto.js";
import { ResendVerificationDTO } from "./dto/resend-verification.dto.js";
import { GoogleLoginDTO } from "./dto/google-login.dto.js";
import { verifyToken } from "../../middlewares/jwt.middleware.js";
import { JWT_SECRET } from "../../config/env.js";

export class AuthRouter {
  private router: Router;

  constructor(
    private authController: AuthController,
    private validationMiddleware: ValidationMiddleware,
  ) {
    this.router = Router();
    this.initializedRoutes();
  }

  private initializedRoutes = () => {
    this.router.post(
      "/register",
      this.validationMiddleware.validateBody(RegisterDTO),
      this.authController.register,
    );
    this.router.post(
      "/login",
      this.validationMiddleware.validateBody(LoginDTO),
      this.authController.login,
    );
    this.router.post(
      "/google",
      this.validationMiddleware.validateBody(GoogleLoginDTO),
      this.authController.googleLogin,
    );
    this.router.post(
      "/google/login",
      this.validationMiddleware.validateBody(GoogleLoginDTO),
      this.authController.googleLogin,
    );
    this.router.post(
      "/google/signup",
      this.validationMiddleware.validateBody(GoogleLoginDTO),
      this.authController.googleSignup,
    );

    this.router.post(
      "/logout",
      verifyToken(JWT_SECRET),
      this.authController.logout,
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
    this.router.put(
      "/reset-password",
      this.validationMiddleware.validateBody(ResetPasswordDTO),
      this.authController.resetPassword,
    );
  };

  getRouter = () => {
    return this.router;
  };
}
