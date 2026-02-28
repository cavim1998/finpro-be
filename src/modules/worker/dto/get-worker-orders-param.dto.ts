import { Type } from "class-transformer";
import { IsEnum, IsInt, Min } from "class-validator";
import { StationType } from "../../../../generated/prisma/enums.js";

export class GetWorkerOrdersParamDto {
  @IsEnum(StationType)
  stationType!: StationType;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  outletId!: number;
}
