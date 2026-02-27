import { PrismaClient } from "../../../generated/prisma/client.js";
import { MailService } from "../mail/mail.service.js";
import { comparePassword, hashPassword } from "../../utils/password.js";
import { FE_URL } from "../../config/env.js";
import { ApiError } from "../../utils/api-error.js";
import { ChangePasswordDTO } from "./dto/change-password.dto.js";
import { UpdateEmailDTO } from "./dto/update-email.dto.js";

export class UserEmailService {
  constructor(
    private prisma: PrismaClient,
    private mailService: MailService,
  ) {}

  async changePassword(userId: number, data: ChangePasswordDTO) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.passwordHash) {
      throw new ApiError(
        "User not found or account uses social login",
        400,
        "SOCIAL_LOGIN_USER",
      );
    }

    const isMatch = await comparePassword(
      data.currentPassword,
      user.passwordHash,
    );
    if (!isMatch) {
      throw new ApiError(
        "Current password is incorrect",
        400,
        "INVALID_PASSWORD",
      );
    }

    if (data.currentPassword === data.newPassword) {
      throw new ApiError(
        "New password must be different from current password",
        400,
        "PASSWORD_SAME_AS_OLD",
      );
    }

    const newPasswordHash = await hashPassword(data.newPassword);

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash },
    });

    return {
      status: "success",
      message: "Password changed successfully. Please login again.",
    };
  }

  async updateEmail(userId: number, data: UpdateEmailDTO) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!user) throw new ApiError("User not found", 404, "USER_NOT_FOUND");

    if (!user.passwordHash) {
      throw new ApiError(
        "This account uses social login. Email change not available.",
        400,
        "SOCIAL_LOGIN_USER",
      );
    }

    const isMatch = await comparePassword(data.password, user.passwordHash);
    if (!isMatch) {
      throw new ApiError(
        "Current password is incorrect",
        400,
        "INVALID_PASSWORD",
      );
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: data.newEmail },
    });

    if (existingUser && existingUser.id !== userId) {
      throw new ApiError(
        "Email already registered",
        409,
        "EMAIL_ALREADY_EXISTS",
      );
    }

    const oldEmail = user.email || "";

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        email: data.newEmail,
        isEmailVerified: false,
      },
    });

    const token = Math.floor(100000 + Math.random() * 900000).toString();

    await this.prisma.emailVerificationToken.deleteMany({
      where: { userId: userId },
    });

    const expiresAt = new Date(Date.now() + 3600000);
    await this.prisma.emailVerificationToken.create({
      data: {
        userId: userId,
        token,
        expiresAt,
      },
    });

    const verifyLink = `${FE_URL}/verify-email?email=${encodeURIComponent(
      data.newEmail,
    )}`;
    await this.mailService.sendVerificationEmail(
      data.newEmail,
      user.profile?.fullName || "User",
      verifyLink,
      token,
    );

    return {
      status: "success",
      message: "Verification email sent to new email address",
      data: {
        email: oldEmail,
        newEmail: data.newEmail,
        verified: false,
        expiresAt,
      },
    };
  }

  async requestEmailVerification(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!user) throw new ApiError("User not found", 404, "USER_NOT_FOUND");

    if (user.isEmailVerified) {
      throw new ApiError("Email already verified", 400, "ALREADY_VERIFIED");
    }

    const token = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 3600000);

    await this.prisma.emailVerificationToken.deleteMany({
      where: { userId: userId },
    });

    await this.prisma.emailVerificationToken.create({
      data: {
        userId: userId,
        token,
        expiresAt,
      },
    });

    const verifyLink = `${FE_URL}/verify-email?email=${encodeURIComponent(
      user.email || "",
    )}`;
    await this.mailService.sendVerificationEmail(
      user.email || "",
      user.profile?.fullName || "User",
      verifyLink,
      token,
    );

    return {
      status: "success",
      message: "Verification email sent",
      data: {
        email: user.email,
        expiresAt,
      },
    };
  }
}
