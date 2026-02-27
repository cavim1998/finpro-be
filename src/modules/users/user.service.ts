import { PrismaClient } from "../../../generated/prisma/client.js";
import { ApiError } from "../../utils/api-error.js";

export class UserService {
  constructor(private prisma: PrismaClient) {}

  async getUsers() {
    const users = await this.prisma.user.findMany({
      include: { profile: true, addresses: true },
      orderBy: { createdAt: "desc" },
    });

    return users.map(({ passwordHash, ...rest }) => rest);
  }

  async getUser(id: number) {
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
  }

  async getProfile(userId: number) {
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
  }
}
