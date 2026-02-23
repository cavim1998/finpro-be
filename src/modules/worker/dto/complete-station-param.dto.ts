import { IsEnum, IsString } from "class-validator";
import { StationType } from "../../../../generated/prisma/enums.js";

export class CompleteStationParamDto {
  @IsEnum(StationType)
  stationType!: StationType;

  @IsString()
  orderId!: string;
}
