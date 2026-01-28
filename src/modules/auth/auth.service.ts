import jwt from "jsonwebtoken";
import { randomBytes } from "crypto";
import { PrismaClient } from "../../../generated/prisma/client.js";
import { JWT_SECRET, FE_URL } from "../../config/env.js";
import { comparePassword, hashPassword } from "../../utils/password.js";
import { MailService } from "../mail/mail.service.js";
import { CloudinaryService } from "../cloudinary/cloudinary.service.js";
import { LoginDTO } from "./dto/login.dto.js";
import { RegisterDTO } from "./dto/register.dto.js";
import { ForgotPasswordDTO } from "./dto/forgot-password.dto.js";
import { ResetPasswordDTO } from "./dto/reset-password.dto.js";
import { VerifyEmailDTO } from "./dto/verify-email.dto.js";
import { ResendVerificationDTO } from "./dto/resend-verification.dto.js";

export class AuthService {
  constructor(
    private prisma: PrismaClient,
    private cloudinaryService: CloudinaryService,
    private mailService: MailService,
  ) {}

  register = async (data: RegisterDTO, file?: Express.Multer.File) => {
    // Check if email already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new Error("Email already registered");
    }

    // Hash password with argon2
    const passwordHash = await hashPassword(data.password);

    // Upload profile image to Cloudinary if provided
    let photoUrl: string | undefined;
    if (file) {
      const uploadResult = await this.cloudinaryService.upload(file);
      photoUrl = uploadResult.secure_url;
    }

    // Create user with profile
    const user = await this.prisma.user.create({
      data: {
        email: data.email,
        passwordHash: passwordHash,
        role: "CUSTOMER",
        profile: {
          create: {
            fullName: data.fullName,
            photoUrl: photoUrl,
          },
        },
      },
      include: {
        profile: true,
      },
    });

    // Remove passwordHash from response
    const { passwordHash: _, ...userWithoutPassword } = user;

    // Generate verification token
    const verifyToken = randomBytes(32).toString("hex");

    // Save verification token with 24 hour expiry
    await this.prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        token: verifyToken,
        expiresAt: new Date(Date.now() + 86400000), // 24 hours
      },
    });

    // Send verification email
    const verifyLink = `${FE_URL}/verify-email?token=${verifyToken}`;
    await this.mailService.sendVerificationEmail(
      data.email,
      data.fullName,
      verifyLink,
    );

    return {
      success: true,
      message: "Registration successful. Please verify your email.",
      data: userWithoutPassword,
    };
  };

  login = async (data: LoginDTO) => {
    // Find user by email
    const user = await this.prisma.user.findUnique({
      where: { email: data.email },
      include: {
        profile: true,
      },
    });

    if (!user) {
      throw new Error("Invalid email or password");
    }

    // Verify password
    const isMatch = await comparePassword(data.password, user.passwordHash!);
    if (!isMatch) {
      throw new Error("Invalid email or password");
    }

    // Check user status
    if (user.status !== "ACTIVE") {
      throw new Error("Account is not active");
    }

    // Check if email verified
    if (!user.isEmailVerified) {
      throw new Error("Email not verified. Please verify your email to login.");
    }

    // Remove passwordHash from response
    const { passwordHash: _, ...userWithoutPassword } = user;

    const token = jwt.sign(
      { sub: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      {
        expiresIn: "1d",
      },
    );

    return {
      success: true,
      message: "Login successful",
      data: userWithoutPassword,
      token,
    };
  };

  forgotPassword = async (data: ForgotPasswordDTO) => {
    const user = await this.prisma.user.findUnique({
      where: { email: data.email },
    });

    if (!user) {
      throw new Error("Email not found");
    }

    // Generate reset token
    const token = randomBytes(32).toString("hex");

    // Save reset token with 1 hour expiry
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt: new Date(Date.now() + 3600000), // 1 hour
      },
    });

    // Send email with reset link
    const resetLink = `${FE_URL}/reset-password?token=${token}`;
    await this.mailService.sendResetPasswordEmail(data.email, resetLink);

    return {
      success: true,
      message: "Reset link sent to your email",
    };
  };

  resetPassword = async (data: ResetPasswordDTO) => {
    // Find reset token
    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: { token: data.token },
      include: { user: true },
    });

    if (!resetToken) {
      throw new Error("Invalid reset token");
    }

    // Check if token expired
    if (resetToken.expiresAt < new Date()) {
      throw new Error("Reset token expired");
    }

    // Hash new password
    const passwordHash = await hashPassword(data.newPassword);

    // Update user password
    await this.prisma.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash },
    });

    // Delete used token
    await this.prisma.passwordResetToken.delete({
      where: { token: data.token },
    });

    return {
      success: true,
      message: "Password reset successful",
    };
  };

  verifyEmail = async (data: VerifyEmailDTO) => {
    // Find verification token
    const verifyToken = await this.prisma.emailVerificationToken.findUnique({
      where: { token: data.token },
      include: {
        user: {
          include: {
            profile: true,
          },
        },
      },
    });

    if (!verifyToken) {
      throw new Error("Invalid verification token");
    }

    // Check if token expired
    if (verifyToken.expiresAt < new Date()) {
      throw new Error("Verification token expired");
    }

    // Update user email verified
    await this.prisma.user.update({
      where: { id: verifyToken.userId },
      data: { isEmailVerified: true },
    });

    // Delete used token
    await this.prisma.emailVerificationToken.delete({
      where: { token: data.token },
    });

    // Send welcome email
    const dashboardLink = `${FE_URL}/dashboard`;
    await this.mailService.sendWelcomeEmail(
      verifyToken.user.email || "",
      verifyToken.user.profile?.fullName || "User",
      dashboardLink,
    );

    return {
      success: true,
      message: "Email verified successfully",
    };
  };

  resendVerificationEmail = async (data: ResendVerificationDTO) => {
    const user = await this.prisma.user.findUnique({
      where: { email: data.email },
      include: { profile: true },
    });

    if (!user) {
      throw new Error("Email not found");
    }

    if (user.isEmailVerified) {
      throw new Error("Email already verified");
    }

    // Generate new verification token
    const token = randomBytes(32).toString("hex");

    // Delete old tokens
    await this.prisma.emailVerificationToken.deleteMany({
      where: { userId: user.id },
    });

    // Create new verification token
    await this.prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt: new Date(Date.now() + 86400000), // 24 hours
      },
    });

    // Send verification email
    const verifyLink = `${FE_URL}/verify-email?token=${token}`;
    await this.mailService.sendVerificationEmail(
      data.email,
      user.profile?.fullName || "User",
      verifyLink,
    );

    return {
      success: true,
      message: "Verification email sent",
    };
  };
}
