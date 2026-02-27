import { PrismaClient } from "../../../generated/prisma/client.js";
import { MailService } from "../mail/mail.service.js";
import { CloudinaryService } from "../cloudinary/cloudinary.service.js";
import { LoginDTO } from "./dto/login.dto.js";
import { RegisterDTO } from "./dto/register.dto.js";
import { ForgotPasswordDTO } from "./dto/forgot-password.dto.js";
import { ResetPasswordDTO } from "./dto/reset-password.dto.js";
import { VerifyEmailDTO } from "./dto/verify-email.dto.js";
import { ResendVerificationDTO } from "./dto/resend-verification.dto.js";
import { GoogleLoginDTO } from "./dto/google-login.dto.js";
import { AuthSessionService } from "./auth-session.service.js";
import { AuthPasswordService } from "./auth-password.service.js";
import { AuthRegistrationService } from "./auth-registration.service.js";
import { AuthGoogleService } from "./auth-google.service.js";

export class AuthService {
  private sessionService: AuthSessionService;
  private passwordService: AuthPasswordService;
  private registrationService: AuthRegistrationService;
  private googleService: AuthGoogleService;

  constructor(
    private prisma: PrismaClient,
    private cloudinaryService: CloudinaryService,
    private mailService: MailService,
  ) {
    this.sessionService = new AuthSessionService(this.prisma);
    this.passwordService = new AuthPasswordService(
      this.prisma,
      this.mailService,
    );
    this.registrationService = new AuthRegistrationService(
      this.prisma,
      this.mailService,
    );
    this.googleService = new AuthGoogleService(
      this.prisma,
      this.sessionService,
    );
  }

  async register(data: RegisterDTO) {
    return this.registrationService.register(data);
  }

  async login(data: LoginDTO) {
    return this.sessionService.login(data);
  }

  async forgotPassword(data: ForgotPasswordDTO) {
    return this.passwordService.forgotPassword(data);
  }

  async resetPassword(data: ResetPasswordDTO) {
    return this.passwordService.resetPassword(data);
  }

  async verifyEmail(data: VerifyEmailDTO) {
    return this.registrationService.verifyEmail(data);
  }

  async resendVerificationEmail(data: ResendVerificationDTO) {
    return this.registrationService.resendVerificationEmail(data);
  }

  async googleLogin(data: GoogleLoginDTO) {
    return this.googleService.googleLogin(data);
  }

  async googleSignup(data: GoogleLoginDTO) {
    return this.googleService.googleSignup(data);
  }

  async logout() {
    return this.sessionService.logout();
  }
}
