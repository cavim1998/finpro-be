import { PrismaClient } from "../../../generated/prisma/client.js";
import { CloudinaryService } from "../cloudinary/cloudinary.service.js";
import { ApiError } from "../../utils/api-error.js";
import { UpdateProfileDTO } from "./dto/update-profile.dto.js";

export class UserProfileService {
  constructor(
    private prisma: PrismaClient,
    private cloudinaryService: CloudinaryService,
  ) {}

  async updateProfile(userId: number, data: UpdateProfileDTO) {
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
  }

  async updateProfilePhoto(userId: number, file?: Express.Multer.File) {
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
  }
}
