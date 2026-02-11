import { IsInt } from "class-validator";
import { Type } from "class-transformer";

export class ClaimOrderParamDto {
  @Type(() => Number)
  @IsInt()
  orderId!: number;
}
