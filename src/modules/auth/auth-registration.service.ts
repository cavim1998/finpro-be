import { PrismaClient } from "../../../generated/prisma/client.js";
import { FE_URL } from "../../config/env.js";
import { ApiError } from "../../utils/api-error.js";
import { hashPassword } from "../../utils/password.js";
import { MailService } from "../mail/mail.service.js";
import { RegisterDTO } from "./dto/register.dto.js";
import { VerifyEmailDTO } from "./dto/verify-email.dto.js";
import { ResendVerificationDTO } from "./dto/resend-verification.dto.js";

export class AuthRegistrationService {
  constructor(
    private prisma: PrismaClient,
    private mailService: MailService,
  ) {}

  private generateVerificationCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  async register(data: RegisterDTO) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new ApiError(
        "Email already registered",
        409,
        "EMAIL_ALREADY_EXISTS",
      );
    }

    const user = await this.prisma.user.create({
      data: {
        email: data.email,
        passwordHash: null,
        role: "CUSTOMER",
        profile: {
          create: {
            fullName: data.name,
          },
        },
        identities: {
          create: {
            provider: "EMAIL",
            providerUserId: data.email,
          },
        },
      },
      include: {
        profile: true,
      },
    });

    const verificationCode = this.generateVerificationCode();
    const expiresAt = new Date(Date.now() + 3600000);

    await this.prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        token: verificationCode,
        expiresAt,
      },
    });

    const verifyLink = `${FE_URL}/verify-email?email=${encodeURIComponent(
      data.email,
    )}`;
    await this.mailService.sendVerificationEmail(
      data.email,
      data.name,
      verifyLink,
      verificationCode,
    );

    return {
      status: "success",
      message: "Registration successful. Please check your email to verify.",
      data: {
        id: user.id,
        email: user.email,
        name: user.profile?.fullName || "",
        verificationSent: true,
        expiresAt,
      },
    };
  }

  async verifyEmail(data: VerifyEmailDTO) {
    const user = await this.prisma.user.findUnique({
      where: { email: data.email },
      include: { profile: true },
    });

    if (!user || user.isEmailVerified) {
      throw new ApiError(
        "Verification code expired or invalid",
        400,
        "VERIFICATION_FAILED",
      );
    }

    const verifyToken = await this.prisma.emailVerificationToken.findFirst({
      where: {
        userId: user.id,
        token: data.verificationCode,
      },
    });

    if (
      !verifyToken ||
      verifyToken.usedAt ||
      verifyToken.expiresAt < new Date()
    ) {
      throw new ApiError(
        "Verification code expired or invalid",
        400,
        "VERIFICATION_FAILED",
      );
    }

    const passwordHash = await hashPassword(data.password);
    await this.prisma.user.update({
      where: { id: verifyToken.userId },
      data: { isEmailVerified: true, passwordHash },
    });

    await this.prisma.emailVerificationToken.update({
      where: { token: verifyToken.token },
      data: { usedAt: new Date() },
    });

    const dashboardLink = `${FE_URL}/dashboard`;
    await this.mailService.sendWelcomeEmail(
      user.email || "",
      user.profile?.fullName || "User",
      dashboardLink,
    );

    return {
      status: "success",
      message: "Email verified successfully. Please login.",
      data: {
        id: user.id,
        email: user.email,
        verified: true,
      },
    };
  }

  async resendVerificationEmail(data: ResendVerificationDTO) {
    const user = await this.prisma.user.findUnique({
      where: { email: data.email },
      include: { profile: true },
    });

    if (!user) {
      throw new ApiError("Email not found", 404, "EMAIL_NOT_FOUND");
    }

    if (user.isEmailVerified) {
      throw new ApiError("Email already verified", 400, "ALREADY_VERIFIED");
    }

    const token = this.generateVerificationCode();
    const expiresAt = new Date(Date.now() + 3600000);

    await this.prisma.emailVerificationToken.deleteMany({
      where: { userId: user.id },
    });

    await this.prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
      },
    });

    const verifyLink = `${FE_URL}/verify-email?email=${encodeURIComponent(
      user.email || "",
    )}`;
    await this.mailService.sendVerificationEmail(
      data.email,
      user.profile?.fullName || "User",
      verifyLink,
      token,
    );

    return {
      status: "success",
      message: "Verification email sent",
      data: {
        email: data.email,
        expiresAt,
      },
    };
  }
}
