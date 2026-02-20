import { PrismaClient, Prisma } from "../../../generated/prisma/client.js";
import { CreateItemDTO } from "./dto/create-item.dto.js";

export class LaundryItemService {
  constructor(private prisma: PrismaClient) {}

  getAllItems = async (params: {
    search?: string;
    page: number;
    limit: number;
    sortBy: string;
    sortOrder: "asc" | "desc";
  }) => {
    const skip = (params.page - 1) * params.limit;

    const where: Prisma.LaundryItemWhereInput = params.search
      ? {
          name: { contains: params.search, mode: "insensitive" },
        }
      : {};

    const data = await this.prisma.laundryItem.findMany({
      where,
      skip,
      take: params.limit,
      orderBy: { [params.sortBy]: params.sortOrder },
      include: {
        _count: {
          select: { orderItems: true },
        },
      },
    });

    const total = await this.prisma.laundryItem.count({ where });

    return {
      data,
      meta: {
        page: params.page,
        take: params.limit,
        total,
        totalPages: Math.ceil(total / params.limit),
      },
    };
  };

  createItem = async (data: CreateItemDTO) => {
    return await this.prisma.laundryItem.create({
      data: {
        name: data.name,
        unit: "PCS",
        price: data.price,
        isActive: true,
      },
    });
  };

  updateItem = async (id: number, data: any) => {
    return await this.prisma.laundryItem.update({
      where: { id },
      data,
    });
  };

  deleteItem = async (id: number) => {
    return await this.prisma.laundryItem.update({
      where: { id },
      data: { isActive: false },
    });
  };
}
