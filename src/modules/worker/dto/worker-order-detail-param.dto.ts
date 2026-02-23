import { IsString } from "class-validator";

export class WorkerOrderDetailParamDto {
  @IsString()
  orderId!: string;
}
