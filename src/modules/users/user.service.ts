import { PrismaClient } from "../../../generated/prisma/client.js";

export class UserService {
  constructor(private prisma: PrismaClient) {}

  getUsers = async () => {
    const users = await this.prisma.user.findMany({
      include: { profile: true },
      orderBy: { createdAt: "desc" },
    });

    return users.map(({ passwordHash, ...rest }) => rest);
  };

  getUser = async (id: string) => {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { profile: true },
    });

    if (!user) throw new Error("User not found");

    const { passwordHash, ...rest } = user;
    return rest;
  };
}
