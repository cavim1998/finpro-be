import { IsEnum, IsNotEmpty, IsUUID } from "class-validator";

export class CreatePaymentDTO {
  @IsNotEmpty()
  @IsUUID()
  orderId!: string;

  @IsNotEmpty()
  @IsEnum(["qris", "gopay", "dana", "ovo", "mastercard", "visa"])
  provider!: string;
}
