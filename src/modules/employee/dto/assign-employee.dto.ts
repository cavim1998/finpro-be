import { IsInt, IsNotEmpty, IsEnum, IsNumber } from "class-validator";
import { Type } from "class-transformer";
import { RoleCode } from "../../../../generated/prisma/client.js";

export class AssignEmployeeDTO {
  @IsNumber()
  @IsNotEmpty()
  userId!: number;

  @IsNumber()
  @IsNotEmpty()
  outletId!: number;

  @IsEnum(RoleCode)
  @IsNotEmpty()
  role!: RoleCode;

  @Type(() => Number)
  @IsInt()
  @IsNotEmpty()
  shiftTemplateId!: number;
}
