import { IsUUID } from "class-validator";

export class OrderIdParamDTO {
  @IsUUID()
  orderId!: string;
}
