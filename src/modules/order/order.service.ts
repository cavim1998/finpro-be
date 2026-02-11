import {
  PrismaClient,
  OrderStatus,
  StationType,
  StationStatus,
  PickupStatus,
  ServiceType,
} from "../../../generated/prisma/client.js";
import { CreateOrderDTO } from "./dto/create-order.dto.js";
import { ApiError } from "../../utils/api-error.js";

export class OrderService {
  constructor(private prisma: PrismaClient) {}

  private async generateOrderNo(outletId: number): Promise<string> {
    const date = new Date();
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    const prefix = `ORD-${yyyy}${mm}${dd}`;

    const lastOrder = await this.prisma.order.findFirst({
      where: { orderNo: { startsWith: prefix } },
      orderBy: { orderNo: "desc" },
    });

    const sequence = lastOrder
      ? parseInt(lastOrder.orderNo.split("-")[2]) + 1
      : 1;
    return `${prefix}-${String(sequence).padStart(4, "0")}`;
  }

  createOrder = async (data: CreateOrderDTO, adminId: string) => {
    return await this.prisma.$transaction(async (tx) => {
      const pickup = await tx.pickupRequest.findUnique({
        where: { id: data.pickupRequestId },
        include: { address: true },
      });

      if (!pickup) throw new ApiError("Pickup Request tidak ditemukan", 404);

      const existingOrder = await tx.order.findUnique({
        where: { pickupRequestId: data.pickupRequestId },
      });
      if (existingOrder)
        throw new ApiError("Order untuk pickup ini sudah dibuat", 400);

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

      const orderNo = await this.generateOrderNo(pickup.assignedOutletId);

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
        },
      });

      await tx.pickupRequest.update({
        where: { id: data.pickupRequestId },
        data: { status: PickupStatus.ARRIVED_OUTLET },
      });

      await tx.orderStation.createMany({
        data: [
          {
            orderId: newOrder.id,
            stationType: StationType.WASHING,
            status: StationStatus.PENDING,
          },
          {
            orderId: newOrder.id,
            stationType: StationType.IRONING,
            status: StationStatus.PENDING,
          },
          {
            orderId: newOrder.id,
            stationType: StationType.PACKING,
            status: StationStatus.PENDING,
          },
        ],
      });

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
  }) => {
    const { outletId, page, limit, sortBy, sortOrder, status } = params;

    const skip = (page - 1) * limit;

    const whereClause: any = {};

    if (outletId) {
      whereClause.outletId = outletId;
    }

    if (status) {
      whereClause.orderStatus = status;
    }

    const orders = await this.prisma.order.findMany({
      where: whereClause,
      include: {
        customer: { include: { profile: true } },
        items: true,
        outlet: true,
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
      data: orders,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  };

  findOne = async (id: string) => {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        customer: { include: { profile: true, addresses: true } },
        pickupRequest: {
          include: {
            driverTasks: {
              include: { driver: { include: { profile: true } } },
            },
          },
        },
        items: { include: { item: true } },
        stations: {
          include: { worker: { include: { profile: true } } },
          orderBy: { id: "asc" },
        },
        payments: true,
      },
    });

    if (!order) throw new ApiError("Order not found", 404);
    return order;
  };

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
}
