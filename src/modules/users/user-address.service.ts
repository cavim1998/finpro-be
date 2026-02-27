import { PrismaClient } from "../../../generated/prisma/client.js";
import { ApiError } from "../../utils/api-error.js";
import { CreateAddressDTO } from "./dto/create-address.dto.js";
import { UpdateAddressDTO } from "./dto/update-address.dto.js";

export class UserAddressService {
  constructor(private prisma: PrismaClient) {}

  async getAddresses(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) throw new ApiError("User not found", 404, "USER_NOT_FOUND");

    const addresses = await this.prisma.userAddress.findMany({
      where: { userId },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
    });

    return addresses;
  }

  async createAddress(userId: number, data: CreateAddressDTO) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) throw new ApiError("User not found", 404, "USER_NOT_FOUND");

    if (data.isPrimary) {
      await this.prisma.userAddress.updateMany({
        where: { userId, isPrimary: true },
        data: { isPrimary: false },
      });
    }

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
        isPrimary: data.isPrimary || existingAddresses.length === 0,
      },
    });

    return newAddress;
  }

  async updateAddress(
    userId: number,
    addressId: number,
    data: UpdateAddressDTO,
  ) {
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
  }

  async deleteAddress(userId: number, addressId: number) {
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
  }

  async setPrimaryAddress(userId: number, addressId: number) {
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

    await this.prisma.userAddress.updateMany({
      where: { userId },
      data: { isPrimary: false },
    });

    const updatedAddress = await this.prisma.userAddress.update({
      where: { id: addressId },
      data: { isPrimary: true },
    });

    return updatedAddress;
  }
}
