import {
  PrismaClient,
  OrderStatus,
  StationType,
  StationStatus,
  PickupStatus,
  ServiceType,
  RoleCode,
} from "../../../generated/prisma/client.js";
import { CreateOrderDTO } from "./dto/create-order.dto.js";
import { ApiError } from "../../utils/api-error.js";

export class OrderService {
  constructor(private prisma: PrismaClient) {}

  private generateOrderNumber(): string {
    const today = new Date();
    const dateStr = today.toISOString().split("T")[0].replace(/-/g, ""); // YYYYMMDD
    const timeStr = today
      .toISOString()
      .split("T")[1]
      .substring(0, 6)
      .replace(/:/g, ""); // HHMMSS
    const random = Math.floor(Math.random() * 100000)
      .toString()
      .padStart(5, "0");

    return `INV-${dateStr}-${timeStr}-${random}`;
  }

  createOrder = async (data: CreateOrderDTO, adminId: string) => {
    return await this.prisma.$transaction(async (tx) => {
      const pickup = await tx.pickupRequest.findUnique({
        where: { id: data.pickupRequestId },
        include: { address: true, order: true },
      });

      if (!pickup) throw new ApiError("Pickup Request tidak ditemukan", 404);

      if (pickup.status !== PickupStatus.ARRIVED_OUTLET) {
        throw new ApiError("Pickup request belum sampai di outlet", 400);
      }

      if (pickup.order) {
        throw new ApiError("Order sudah dibuat untuk pickup request ini", 400);
      }

      let subtotal = 0;
      const orderItemsData = [];

      for (const itemDto of data.items) {
        const itemMaster = await tx.laundryItem.findUnique({
          where: { id: itemDto.itemId },
        });
        if (!itemMaster)
          throw new ApiError(`Item ID ${itemDto.itemId} tidak valid`, 400);

        const priceNow = Number(itemMaster.price);

        subtotal += priceNow * itemDto.qty;

        orderItemsData.push({
          itemId: itemDto.itemId,
          qty: itemDto.qty,
          price: priceNow,
        });
      }

      let premiumFee = 0;
      if (data.serviceType === ServiceType.PREMIUM) {
        premiumFee = subtotal * 0.2;
      }

      const deliveryFee = data.deliveryFee || 0;

      const totalAmount = subtotal + premiumFee + deliveryFee;

      const paymentDueAt = new Date();
      paymentDueAt.setDate(paymentDueAt.getDate() + 3);

      const orderNo = await this.generateOrderNumber();

      const newOrder = await tx.order.create({
        data: {
          orderNo,
          pickupRequestId: data.pickupRequestId,
          outletId: pickup.assignedOutletId,
          customerId: pickup.customerId,
          createdByOutletAdminId: Number(adminId),

          serviceType: data.serviceType,

          totalWeightKg: data.totalWeightKg,
          subtotalAmount: subtotal,
          deliveryFee: deliveryFee,
          totalAmount: totalAmount,

          status: OrderStatus.ARRIVED_AT_OUTLET,
          items: {
            create: orderItemsData,
          },
          paymentDueAt,
        },
      });

      await tx.pickupRequest.update({
        where: { id: data.pickupRequestId },
        data: { status: PickupStatus.ARRIVED_OUTLET },
      });

      const stations = [
        { stationType: StationType.WASHING },
        { stationType: StationType.IRONING },
        { stationType: StationType.PACKING },
      ];

      for (const station of stations) {
        await tx.orderStation.create({
          data: {
            orderId: newOrder.id,
            stationType: station.stationType,
            status: "PENDING",
          },
        });
      }

      return newOrder;
    });
  };

  findAll = async (params: {
    outletId?: number;
    page: number;
    limit: number;
    sortBy: string;
    sortOrder: "asc" | "desc";
    status?: OrderStatus;
    search?: string;
    startDate?: string;
    endDate?: string;
  }) => {
    const {
      outletId,
      page,
      limit,
      sortBy,
      sortOrder,
      status,
      search,
      startDate,
      endDate,
    } = params;

    const skip = (page - 1) * limit;

    const whereClause: any = {};

    if (outletId) {
      whereClause.outletId = outletId;
    }

    if (status) {
      whereClause.orderStatus = status;
    }

    if (search) {
      whereClause.orderNo = { contains: search, mode: "insensitive" };
    }

    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) {
        whereClause.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        whereClause.createdAt.lte = new Date(endDate);
      }
    }

    const orders = await this.prisma.order.findMany({
      where: whereClause,
      include: {
        customer: { include: { profile: true } },
        items: {
          include: {
            item: true,
          },
        },
        outlet: {
          select: {
            id: true,
            name: true,
            addressText: true,
          },
        },
        payments: {
          where: { status: "PAID" },
          select: {
            id: true,
            paidAt: true,
          },
        },
      },
      skip: skip,
      take: limit,
      orderBy: {
        [sortBy]: sortOrder,
      },
    });

    const total = await this.prisma.order.count({
      where: whereClause,
    });

    return {
      data: orders.map((order) => ({
        ...order,
        deliveryDate: order.deliveredAt,
        isPaid: order.payments.length > 0,
        itemCount: order.items.reduce((sum, item) => sum + item.qty, 0),
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  };

  async getOrderById(orderId: string, customerId: number) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, customerId },
      include: {
        outlet: true,
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
        items: {
          include: {
            item: true,
          },
        },
        stations: {
          include: {
            worker: {
              select: {
                id: true,
                profile: {
                  select: {
                    fullName: true,
                  },
                },
              },
            },
          },
          orderBy: { id: "asc" },
        },
        payments: {
          orderBy: { createdAt: "desc" },
        },
        pickupRequest: {
          include: {
            address: true,
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
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!order) {
      throw new ApiError("Order tidak ditemukan", 404);
    }

    return {
      ...order,
      deliveryDate: order.deliveredAt, // Alias for FE requirement
      isPaid: order.payments.some((p) => p.status === "PAID"),
      itemCount: order.items.reduce((sum, item) => sum + item.qty, 0),
    };
  }

  updateStatus = async (orderId: string, newStatus: OrderStatus) => {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order) throw new ApiError("Order tidak ditemukan", 404);

    return await this.prisma.order.update({
      where: { id: orderId },
      data: { status: newStatus },
    });
  };

  async confirmOrderReceived(orderId: string, customerId: number) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, customerId },
    });

    if (!order) {
      throw new ApiError("Order tidak ditemukan", 404);
    }

    // Customer only can confirm when order is being delivered
    if (order.status !== OrderStatus.DELIVERING_TO_CUSTOMER) {
      throw new ApiError("Order belum dalam status pengiriman", 400);
    }

    if (order.receivedConfirmedAt) {
      throw new ApiError("Order sudah dikonfirmasi sebelumnya", 400);
    }

    const updatedOrder = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.RECEIVED_BY_CUSTOMER,
        receivedConfirmedAt: new Date(),
      },
      include: {
        outlet: true,
        items: {
          include: {
            item: true,
          },
        },
      },
    });

    // TODO: Send notification about confirmation

    return updatedOrder;
  }

  async autoConfirmOrders() {
    // Find orders that need auto-confirmation (48 hours after delivery)
    const twoDaysAgo = new Date();
    twoDaysAgo.setHours(twoDaysAgo.getHours() - 48);

    const ordersToConfirm = await this.prisma.order.findMany({
      where: {
        status: OrderStatus.DELIVERING_TO_CUSTOMER,
        deliveredAt: {
          not: null,
          lte: twoDaysAgo,
        },
        receivedConfirmedAt: null,
      },
    });

    if (ordersToConfirm.length === 0) {
      return { count: 0 };
    }

    await this.prisma.order.updateMany({
      where: {
        id: {
          in: ordersToConfirm.map((o) => o.id),
        },
      },
      data: {
        status: OrderStatus.RECEIVED_BY_CUSTOMER,
        receivedConfirmedAt: new Date(),
      },
    });

    // TODO: Send notifications to customers

    return { count: ordersToConfirm.length };
  }

  private readonly adminOrderInclude = {
    customer: { select: { id: true, email: true, profile: true } },
    outlet: true,
    pickupRequest: { include: { address: true } },
    items: { include: { item: true } },
    stations: {
      include: { worker: { include: { profile: true } } },
      orderBy: { id: "asc" as const },
    },
    driverTasks: {
      include: { driver: { include: { profile: true } } },
      orderBy: { createdAt: "asc" as const },
    },
    payments: { orderBy: { createdAt: "desc" as const } },
  };

  async getAdminOrderById(orderId: string, role: RoleCode, outletId?: number) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: this.adminOrderInclude,
    });

    if (!order) throw new ApiError("Order tidak ditemukan", 404);

    if (role === RoleCode.OUTLET_ADMIN && order.outletId !== outletId) {
      throw new ApiError("Forbidden: Order bukan dari outlet Anda", 403);
    }

    return order;
  }
}
