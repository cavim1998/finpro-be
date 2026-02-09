import {
  PrismaClient,
  OrderStatus,
  StationType,
  PickupStatus,
} from "../../../generated/prisma/client.js";
import { ApiError } from "../../utils/api-error.js";
import { CreateOrderDTO } from "./dto/create-order.dto.js";
import { GetOrdersDTO } from "./dto/get-orders.dto.js";

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

  async createOrder(dto: CreateOrderDTO, outletAdminId: number) {
    // 1. Validate pickup request exists and status is ARRIVED_OUTLET
    const pickupRequest = await this.prisma.pickupRequest.findUnique({
      where: { id: dto.pickupRequestId },
      include: {
        customer: true,
        outlet: true,
        order: true,
      },
    });

    if (!pickupRequest) {
      throw new ApiError("Pickup request tidak ditemukan", 404);
    }

    if (pickupRequest.status !== PickupStatus.ARRIVED_OUTLET) {
      throw new ApiError("Pickup request belum sampai di outlet", 400);
    }

    if (pickupRequest.order) {
      throw new ApiError("Order sudah dibuat untuk pickup request ini", 400);
    }

    // 2. Validate all items exist
    const itemIds = dto.items.map((item) => item.itemId);
    const laundryItems = await this.prisma.laundryItem.findMany({
      where: {
        id: { in: itemIds },
        isActive: true,
      },
    });

    if (laundryItems.length !== itemIds.length) {
      throw new ApiError("Beberapa item tidak ditemukan atau tidak aktif", 400);
    }

    // 3. Calculate amounts
    let subtotalAmount = 0;
    for (const orderItem of dto.items) {
      const laundryItem = laundryItems.find(
        (item) => item.id === orderItem.itemId,
      );
      if (laundryItem) {
        subtotalAmount += orderItem.qty * Number(laundryItem.price);
      }
    }

    const totalAmount = subtotalAmount + dto.deliveryFee;

    // 4. Calculate payment deadline (after packing complete + 2 hours buffer)
    // Estimate: washing (1 day) + ironing (1 day) + packing (0.5 day) = 2.5 days
    const paymentDueAt = new Date();
    paymentDueAt.setDate(paymentDueAt.getDate() + 3); // 2.5 days + buffer

    // 5. Create order with transaction
    const order = await this.prisma.$transaction(async (tx) => {
      // Generate order number inside transaction
      const orderNo = this.generateOrderNumber();

      // Create order
      const newOrder = await tx.order.create({
        data: {
          orderNo,
          pickupRequestId: dto.pickupRequestId,
          outletId: pickupRequest.assignedOutletId,
          customerId: pickupRequest.customerId,
          createdByOutletAdminId: outletAdminId,
          totalWeightKg: dto.totalWeightKg,
          subtotalAmount,
          deliveryFee: dto.deliveryFee,
          totalAmount,
          status: OrderStatus.ARRIVED_AT_OUTLET,
          paymentDueAt,
        },
      });

      // Create order items
      await tx.orderItem.createMany({
        data: dto.items.map((item) => ({
          orderId: newOrder.id,
          itemId: item.itemId,
          qty: item.qty,
        })),
      });

      // Create order stations
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

    // 7. Get full order with relations
    const fullOrder = await this.prisma.order.findUnique({
      where: { id: order.id },
      include: {
        items: {
          include: {
            item: true,
          },
        },
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
        stations: true,
      },
    });

    // TODO: Send notification to customer about order creation

    return fullOrder;
  }

  async getOrders(customerId: number, dto: GetOrdersDTO) {
    const { status, search, startDate, endDate, page = 1, limit = 10 } = dto;

    const where: any = { customerId };

    if (status) {
      where.status = status;
    }

    if (search) {
      where.orderNo = { contains: search, mode: "insensitive" };
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate);
      }
    }

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: {
          outlet: {
            select: {
              id: true,
              name: true,
              addressText: true,
            },
          },
          items: {
            include: {
              item: true,
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
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      data: orders.map((order) => ({
        ...order,
        deliveryDate: order.deliveredAt, // Alias for FE requirement
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
  }

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
}
