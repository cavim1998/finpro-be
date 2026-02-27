import { randomBytes } from "crypto";
import { PrismaClient } from "../../../generated/prisma/client.js";
import { FE_URL } from "../../config/env.js";
import { ApiError } from "../../utils/api-error.js";
import { hashPassword } from "../../utils/password.js";
import { MailService } from "../mail/mail.service.js";
import { ForgotPasswordDTO } from "./dto/forgot-password.dto.js";
import { ResetPasswordDTO } from "./dto/reset-password.dto.js";

export class AuthPasswordService {
  constructor(
    private prisma: PrismaClient,
    private mailService: MailService,
  ) {}

  async forgotPassword(data: ForgotPasswordDTO) {
    const user = await this.prisma.user.findUnique({
      where: { email: data.email },
      include: { profile: true },
    });

    if (!user) {
      throw new ApiError("Email not found", 404, "EMAIL_NOT_FOUND");
    }

    if (!user.passwordHash) {
      throw new ApiError(
        "This account uses social login. Password reset not available.",
        400,
        "SOCIAL_LOGIN_USER",
      );
    }

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 3600000);

    await this.prisma.passwordResetToken.deleteMany({
      where: { userId: user.id },
    });

    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
      },
    });

    const resetLink = `${FE_URL}/confirm-reset-password?token=${token}`;
    await this.mailService.sendResetPasswordEmail(
      data.email,
      resetLink,
      user.profile?.fullName || "User",
    );

    return {
      status: "success",
      message: "Password reset link has been sent to your email",
      data: {
        email: data.email,
        expiresAt,
      },
    };
  }

  async resetPassword(data: ResetPasswordDTO) {
    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: { token: data.token },
      include: { user: true },
    });

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
      throw new ApiError("Reset token expired", 400, "TOKEN_EXPIRED");
    }

    if (!resetToken.user.passwordHash) {
      throw new ApiError(
        "This account uses social login. Password reset not available.",
        400,
        "SOCIAL_LOGIN_USER",
      );
    }

    const passwordHash = await hashPassword(data.password);

    await this.prisma.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash },
    });

    await this.prisma.passwordResetToken.update({
      where: { token: data.token },
      data: { usedAt: new Date() },
    });

    return {
      status: "success",
      message:
        "Password reset successful. Please login with your new password.",
      data: {
        email: resetToken.user.email,
      },
    };
  }
}
