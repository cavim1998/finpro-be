import { Type } from "class-transformer";
import { IsInt, Min } from "class-validator";

export class OutletStaffParamDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  outletStaffId!: number;
}
