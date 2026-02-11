import { IsEnum } from "class-validator";
import { StationType } from "../../../../generated/prisma/enums.js";

export class StationParamDto {
  @IsEnum(StationType)
  stationType!: StationType;
}
