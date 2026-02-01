import { PrismaClient } from "../../../generated/prisma/client.js";
import { randomBytes } from "crypto";
import { CloudinaryService } from "../cloudinary/cloudinary.service.js";
import { MailService } from "../mail/mail.service.js";
import { comparePassword, hashPassword } from "../../utils/password.js";
import { FE_URL } from "../../config/env.js";
import { UpdateProfileDTO } from "./dto/update-profile.dto.js";
import { ChangePasswordDTO } from "./dto/change-password.dto.js";
import { UpdateEmailDTO } from "./dto/update-email.dto.js";

export class UserService {
  constructor(
    private prisma: PrismaClient,
    private cloudinaryService: CloudinaryService,
    private mailService: MailService,
  ) {}

  getUsers = async () => {
    const users = await this.prisma.user.findMany({
      include: { profile: true },
      orderBy: { createdAt: "desc" },
    });

    return users.map(({ passwordHash, ...rest }) => rest);
  };

  getUser = async (id: string) => {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { profile: true },
    });

    if (!user) throw new Error("User not found");

    const { passwordHash, ...rest } = user;
    return rest;
  };

  getProfile = async (userId: string) => {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!user) throw new Error("User not found");

    const { passwordHash, ...rest } = user;
    return rest;
  };

  updateProfile = async (
    userId: string,
    data: UpdateProfileDTO,
    file?: Express.Multer.File,
  ) => {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!user) throw new Error("User not found");

    let photoUrl = user.profile?.photoUrl;

    // Upload new photo if provided
    if (file) {
      // Delete old photo if exists
      if (photoUrl) {
        await this.cloudinaryService.remove(photoUrl);
      }

      const uploadResult = await this.cloudinaryService.upload(file);
      photoUrl = uploadResult.secure_url;
    }

    // Update profile
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        profile: {
          update: {
            fullName: data.fullName,
            phone: data.phoneNumber,
            photoUrl: photoUrl,
          },
        },
      },
      include: { profile: true },
    });

    const { passwordHash, ...rest } = updatedUser;
    return rest;
  };

  changePassword = async (userId: string, data: ChangePasswordDTO) => {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.passwordHash) {
      throw new Error("User not found or account uses social login");
    }

    // Verify current password
    const isMatch = await comparePassword(
      data.currentPassword,
      user.passwordHash,
    );
    if (!isMatch) {
      throw new Error("Current password is incorrect");
    }

    // Hash new password
    const newPasswordHash = await hashPassword(data.newPassword);

    // Update password
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash },
    });

    return { success: true, message: "Password changed successfully" };
  };

  updateEmail = async (userId: string, data: UpdateEmailDTO) => {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!user) throw new Error("User not found");

    // Check if new email already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: data.newEmail },
    });

    if (existingUser && existingUser.id !== userId) {
      throw new Error("Email already in use");
    }

    // Update email and set isEmailVerified to false
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        email: data.newEmail,
        isEmailVerified: false,
      },
    });

    // Generate verification token
    const token = randomBytes(32).toString("hex");

    // Delete old verification tokens
    await this.prisma.emailVerificationToken.deleteMany({
      where: { userId: userId },
    });

    // Create new verification token
    await this.prisma.emailVerificationToken.create({
      data: {
        userId: userId,
        token,
        expiresAt: new Date(Date.now() + 3600000), // 1 hour
      },
    });

    // Send verification email
    const verifyLink = `${FE_URL}/verify-email?token=${token}`;
    await this.mailService.sendVerificationEmail(
      data.newEmail,
      user.profile?.fullName || "User",
      verifyLink,
    );

    return {
      success: true,
      message: "Email updated. Please verify your new email address.",
    };
  };

  requestEmailVerification = async (userId: string) => {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!user) throw new Error("User not found");

    if (user.isEmailVerified) {
      throw new Error("Email is already verified");
    }

    // Generate new verification token
    const token = randomBytes(32).toString("hex");

    // Delete old tokens
    await this.prisma.emailVerificationToken.deleteMany({
      where: { userId: userId },
    });

    // Create new verification token
    await this.prisma.emailVerificationToken.create({
      data: {
        userId: userId,
        token,
        expiresAt: new Date(Date.now() + 3600000), // 1 hour
      },
    });

    // Send verification email
    const verifyLink = `${FE_URL}/verify-email?token=${token}`;
    await this.mailService.sendVerificationEmail(
      user.email || "",
      user.profile?.fullName || "User",
      verifyLink,
    );

    return {
      success: true,
      message: "Verification email sent",
    };
  };
}
