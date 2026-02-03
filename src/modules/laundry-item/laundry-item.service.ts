import { PrismaClient } from "../../../generated/prisma/client.js";
import { CreateItemDTO } from "./dto/create-item.dto.js";

export class LaundryItemService {
  constructor(private prisma: PrismaClient) {}

  getAllItems = async () => {
    return await this.prisma.laundryItem.findMany({
      where: {
        isActive: true,
      },
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: { orderItems: true },
        },
      },
    });
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
