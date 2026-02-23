import { IsEnum, IsString } from "class-validator";
import { StationType } from "../../../../generated/prisma/enums.js";

export class ClaimOrderParamDto {
  @IsEnum(StationType)
  stationType!: StationType;

  @IsString()
  orderId!: string;
}
