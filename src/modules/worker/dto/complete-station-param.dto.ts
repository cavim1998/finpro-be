import { IsInt } from "class-validator";
import { Type } from "class-transformer";

export class CompleteStationParamDto {
  @Type(() => Number)
  @IsInt()
  orderStationId!: number;
}
