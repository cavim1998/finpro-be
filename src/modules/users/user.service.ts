import { PrismaClient } from "../../../generated/prisma/client.js";
import { CloudinaryService } from "../cloudinary/cloudinary.service.js";
import { MailService } from "../mail/mail.service.js";
import { comparePassword, hashPassword } from "../../utils/password.js";
import { FE_URL } from "../../config/env.js";
import { ApiError } from "../../utils/api-error.js";
import { UpdateProfileDTO } from "./dto/update-profile.dto.js";
import { ChangePasswordDTO } from "./dto/change-password.dto.js";
import { UpdateEmailDTO } from "./dto/update-email.dto.js";
import { CreateAddressDTO } from "./dto/create-address.dto.js";
import { UpdateAddressDTO } from "./dto/update-address.dto.js";

export class UserService {
  constructor(
    private prisma: PrismaClient,
    private cloudinaryService: CloudinaryService,
    private mailService: MailService,
  ) {}

  getUsers = async () => {
    const users = await this.prisma.user.findMany({
      include: { profile: true, addresses: true },
      orderBy: { createdAt: "desc" },
    });

    return users.map(({ passwordHash, ...rest }) => rest);
  };

  getUser = async (id: number) => {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { profile: true, addresses: true },
    });

    if (!user) throw new ApiError("User not found", 404, "USER_NOT_FOUND");

    const primaryAddress =
      user.addresses.find((address) => address.isPrimary) || user.addresses[0];

    return {
      id: user.id,
      name: user.profile?.fullName || "",
      email: user.email,
      phone: user.profile?.phone,
      address: primaryAddress?.addressText,
      profileImage: user.profile?.photoUrl || undefined,
      verified: user.isEmailVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  };

  getProfile = async (userId: number) => {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true, addresses: true },
    });

    if (!user) throw new ApiError("User not found", 404, "USER_NOT_FOUND");

    const primaryAddress =
      user.addresses.find((address) => address.isPrimary) || user.addresses[0];

    return {
      id: user.id,
      name: user.profile?.fullName || "",
      email: user.email,
      phone: user.profile?.phone,
      address: primaryAddress?.addressText,
      profileImage: user.profile?.photoUrl || undefined,
      verified: user.isEmailVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  };

  updateProfile = async (userId: number, data: UpdateProfileDTO) => {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!user) throw new ApiError("User not found", 404, "USER_NOT_FOUND");

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        profile: {
          update: {
            fullName: data.name ?? user.profile?.fullName,
            phone: data.phone ?? user.profile?.phone,
          },
        },
      },
      include: { profile: true, addresses: true },
    });

    if (data.address) {
      const primaryAddress = await this.prisma.userAddress.findFirst({
        where: { userId, isPrimary: true },
      });

      if (primaryAddress) {
        await this.prisma.userAddress.update({
          where: { id: primaryAddress.id },
          data: { addressText: data.address, isPrimary: true },
        });
      } else {
        await this.prisma.userAddress.create({
          data: {
            userId,
            addressText: data.address,
            isPrimary: true,
          },
        });
      }
    }

    const refreshed = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true, addresses: true },
    });

    const primaryAddress =
      refreshed?.addresses.find((address) => address.isPrimary) ||
      refreshed?.addresses[0];

    return {
      id: updatedUser.id,
      name: updatedUser.profile?.fullName || "",
      email: updatedUser.email,
      phone: updatedUser.profile?.phone,
      address: primaryAddress?.addressText,
      profileImage: updatedUser.profile?.photoUrl || undefined,
      verified: updatedUser.isEmailVerified,
      createdAt: updatedUser.createdAt,
      updatedAt: updatedUser.updatedAt,
    };
  };

  updateProfilePhoto = async (userId: number, file?: Express.Multer.File) => {
    if (!file) {
      throw new ApiError("Invalid file type or size", 400, "INVALID_FILE");
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!user) throw new ApiError("User not found", 404, "USER_NOT_FOUND");

    if (user.profile?.photoUrl) {
      await this.cloudinaryService.remove(user.profile.photoUrl);
    }

    const uploadResult = await this.cloudinaryService.upload(file);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        profile: {
          update: {
            photoUrl: uploadResult.secure_url,
            photoMime: file.mimetype,
            photoSizeBytes: file.size,
          },
        },
      },
    });

    return { url: uploadResult.secure_url };
  };

  changePassword = async (userId: number, data: ChangePasswordDTO) => {
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

    // Verify current password
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

    // Hash new password
    const newPasswordHash = await hashPassword(data.newPassword);

    // Update password
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash },
    });

    return {
      status: "success",
      message: "Password changed successfully. Please login again.",
    };
  };

  updateEmail = async (userId: number, data: UpdateEmailDTO) => {
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

    // Check if new email already exists
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

    // Update email and set isEmailVerified to false
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        email: data.newEmail,
        isEmailVerified: false,
      },
    });

    // Generate verification token
    const token = Math.floor(100000 + Math.random() * 900000).toString();

    // Delete old verification tokens
    await this.prisma.emailVerificationToken.deleteMany({
      where: { userId: userId },
    });

    // Create new verification token
    const expiresAt = new Date(Date.now() + 3600000);
    await this.prisma.emailVerificationToken.create({
      data: {
        userId: userId,
        token,
        expiresAt,
      },
    });

    // Send verification email
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
  };

  requestEmailVerification = async (userId: number) => {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!user) throw new ApiError("User not found", 404, "USER_NOT_FOUND");

    if (user.isEmailVerified) {
      throw new ApiError("Email already verified", 400, "ALREADY_VERIFIED");
    }

    // Generate new verification token
    const token = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 3600000);

    // Delete old tokens
    await this.prisma.emailVerificationToken.deleteMany({
      where: { userId: userId },
    });

    // Create new verification token
    await this.prisma.emailVerificationToken.create({
      data: {
        userId: userId,
        token,
        expiresAt,
      },
    });

    // Send verification email
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
  };

  /**
   * =========================
   * USER ADDRESS MANAGEMENT
   * =========================
   */

  getAddresses = async (userId: number) => {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) throw new ApiError("User not found", 404, "USER_NOT_FOUND");

    const addresses = await this.prisma.userAddress.findMany({
      where: { userId },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
    });

    return addresses;
  };

  createAddress = async (userId: number, data: CreateAddressDTO) => {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) throw new ApiError("User not found", 404, "USER_NOT_FOUND");

    // Jika isPrimary true dan user sudah punya address primary, set yang lama menjadi false
    if (data.isPrimary) {
      await this.prisma.userAddress.updateMany({
        where: { userId, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    // Jika user belum punya address, set ini sebagai primary
    const existingAddresses = await this.prisma.userAddress.findMany({
      where: { userId },
    });

    const newAddress = await this.prisma.userAddress.create({
      data: {
        userId,
        label: data.label,
        receiverName: data.receiverName,
        receiverPhone: data.receiverPhone,
        addressText: data.addressText,
        latitude: data.latitude,
        longitude: data.longitude,
        isPrimary: data.isPrimary || existingAddresses.length === 0, // Default true jika address pertama
      },
    });

    return newAddress;
  };

  updateAddress = async (
    userId: number,
    addressId: number,
    data: UpdateAddressDTO,
  ) => {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) throw new ApiError("User not found", 404, "USER_NOT_FOUND");

    // Validasi ownership
    const address = await this.prisma.userAddress.findUnique({
      where: { id: addressId },
    });

    if (!address) {
      throw new ApiError("Address not found", 404, "ADDRESS_NOT_FOUND");
    }

    if (address.userId !== userId) {
      throw new ApiError(
        "Unauthorized to update this address",
        403,
        "FORBIDDEN",
      );
    }

    // Jika ingin set sebagai primary
    if (data.isPrimary) {
      await this.prisma.userAddress.updateMany({
        where: { userId, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    const updatedAddress = await this.prisma.userAddress.update({
      where: { id: addressId },
      data: {
        label: data.label ?? address.label,
        receiverName: data.receiverName ?? address.receiverName,
        receiverPhone: data.receiverPhone ?? address.receiverPhone,
        addressText: data.addressText ?? address.addressText,
        latitude: data.latitude ?? address.latitude,
        longitude: data.longitude ?? address.longitude,
        isPrimary: data.isPrimary ?? address.isPrimary,
      },
    });

    return updatedAddress;
  };

  deleteAddress = async (userId: number, addressId: number) => {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) throw new ApiError("User not found", 404, "USER_NOT_FOUND");

    const address = await this.prisma.userAddress.findUnique({
      where: { id: addressId },
    });

    if (!address) {
      throw new ApiError("Address not found", 404, "ADDRESS_NOT_FOUND");
    }

    if (address.userId !== userId) {
      throw new ApiError(
        "Unauthorized to delete this address",
        403,
        "FORBIDDEN",
      );
    }

    await this.prisma.userAddress.delete({
      where: { id: addressId },
    });

    // Jika address yang dihapus adalah primary, set address lain sebagai primary
    if (address.isPrimary) {
      const otherAddress = await this.prisma.userAddress.findFirst({
        where: { userId },
        orderBy: { createdAt: "asc" },
      });

      if (otherAddress) {
        await this.prisma.userAddress.update({
          where: { id: otherAddress.id },
          data: { isPrimary: true },
        });
      }
    }

    return {
      status: "success",
      message: "Address deleted successfully",
    };
  };

  setPrimaryAddress = async (userId: number, addressId: number) => {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) throw new ApiError("User not found", 404, "USER_NOT_FOUND");

    const address = await this.prisma.userAddress.findUnique({
      where: { id: addressId },
    });

    if (!address) {
      throw new ApiError("Address not found", 404, "ADDRESS_NOT_FOUND");
    }

    if (address.userId !== userId) {
      throw new ApiError(
        "Unauthorized to update this address",
        403,
        "FORBIDDEN",
      );
    }

    // Set semua address user menjadi false
    await this.prisma.userAddress.updateMany({
      where: { userId },
      data: { isPrimary: false },
    });

    // Set address yang dipilih menjadi primary
    const updatedAddress = await this.prisma.userAddress.update({
      where: { id: addressId },
      data: { isPrimary: true },
    });

    return updatedAddress;
  };
}
