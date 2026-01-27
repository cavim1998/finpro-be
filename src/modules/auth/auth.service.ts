import { PrismaClient } from "../../../generated/prisma/client.js";

export class AuthService {
  constructor(private prisma: PrismaClient) {}

  register = async () => {
    // Registration logic to be implemented
    return true;
  };
}
