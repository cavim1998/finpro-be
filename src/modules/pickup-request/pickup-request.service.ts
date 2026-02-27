import {
  PrismaClient,
  PickupStatus,
} from "../../../generated/prisma/client.js";
import { ApiError } from "../../utils/api-error.js";
import { findNearestOutlet } from "../../utils/distance-calculator.js";
import { CreatePickupRequestDTO } from "./dto/create-pickup-request.dto.js";

export class PickupRequestService {
  constructor(private prisma: PrismaClient) {}

  async createPickupRequest(dto: CreatePickupRequestDTO, customerId: number) {
    // 1. Validate address belongs to customer
    const address = await this.prisma.userAddress.findFirst({
      where: { id: dto.addressId, userId: customerId },
    });

    if (!address) {
      throw new ApiError("Alamat tidak ditemukan", 404);
    }

    if (!address.latitude || !address.longitude) {
      throw new ApiError("Alamat tidak memiliki koordinat yang valid", 400);
    }

    // 2. Find nearest outlet within service radius
    const outlets = await this.prisma.outlet.findMany({
      where: { isActive: true },
    });

    const nearestOutlet = findNearestOutlet(
      Number(address.latitude),
      Number(address.longitude),
      outlets,
    );

    if (!nearestOutlet) {
      throw new ApiError(
        "Maaf, tidak ada outlet yang dapat melayani alamat Anda saat ini",
        400,
      );
    }

    // 3. Validate scheduled time is in the future
    const scheduledTime = new Date(dto.scheduledPickupAt);
    if (scheduledTime <= new Date()) {
      throw new ApiError("Waktu penjemputan harus di masa depan", 400);
    }

    // 4. Create pickup request
    const pickupRequest = await this.prisma.pickupRequest.create({
      data: {
        customerId,
        addressId: dto.addressId,
        scheduledPickupAt: scheduledTime,
        notes: dto.notes,
        assignedOutletId: nearestOutlet.id,
        status: PickupStatus.WAITING_DRIVER,
      },
      include: {
        customer: {
          select: {
            id: true,
            email: true,
            profile: {
              select: {
                fullName: true,
                phone: true,
              },
            },
          },
        },
        address: true,
        outlet: true,
      },
    });

    // TODO: Send notification to drivers at this outlet

    return {
      ...pickupRequest,
      distance: nearestOutlet.distance,
    };
  }

  async getPickupRequests(customerId: number, status?: PickupStatus) {
    const where: any = { customerId };
    if (status) {
      where.status = status;
    }

    const pickupRequests = await this.prisma.pickupRequest.findMany({
      where,
      include: {
        address: true,
        outlet: {
          select: {
            id: true,
            name: true,
            addressText: true,
          },
        },
        order: {
          select: {
            id: true,
            orderNo: true,
            status: true,
            totalAmount: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return pickupRequests;
  }

  async getPickupRequestById(id: string, customerId: number) {
    const pickupRequest = await this.prisma.pickupRequest.findFirst({
      where: { id, customerId },
      include: {
        customer: {
          select: {
            id: true,
            email: true,
            profile: {
              select: {
                fullName: true,
                phone: true,
              },
            },
          },
        },
        address: true,
        outlet: true,
        order: {
          include: {
            items: {
              include: {
                item: true,
              },
            },
            payments: true,
          },
        },
        driverTasks: {
          include: {
            driver: {
              select: {
                id: true,
                profile: {
                  select: {
                    fullName: true,
                    phone: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!pickupRequest) {
      throw new ApiError("Pickup request tidak ditemukan", 404);
    }

    return pickupRequest;
  }

  async getArrivedPickupsForOutlet(userId: number, outletIdParam?: number) {
    // Get outlet staff record to find outlet
    const outletStaff = await this.prisma.outletStaff.findFirst({
      where: {
        userId,
        isActive: true,
        ...(outletIdParam ? { outletId: outletIdParam } : {}),
      },
      select: { outletId: true },
    });

    if (!outletStaff) {
      throw new ApiError("Anda tidak terdaftar sebagai staff outlet", 403);
    }

    const pickupRequests = await this.prisma.pickupRequest.findMany({
      where: {
        assignedOutletId: outletStaff.outletId,
        status: PickupStatus.ARRIVED_OUTLET,
        order: null, // Not yet processed into order
      },
      include: {
        customer: {
          select: {
            id: true,
            email: true,
            profile: {
              select: {
                fullName: true,
                phone: true,
              },
            },
          },
        },
        address: true,
      },
      orderBy: { updatedAt: "asc" },
    });

    return pickupRequests;
  }
}
