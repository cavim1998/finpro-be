import { IsEnum, IsNotEmpty, IsUUID } from "class-validator";

export class CreatePaymentDTO {
  @IsNotEmpty()
  @IsUUID()
  orderId!: string;
}
