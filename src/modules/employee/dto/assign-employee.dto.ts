import { IsString, IsNotEmpty, IsEnum, IsNumber } from "class-validator";
import { RoleCode } from "../../../../generated/prisma/client.js";

export class AssignEmployeeDTO {
  @IsNumber()
  @IsNotEmpty()
  userId!: string;

  @IsNumber()
  @IsNotEmpty()
  outletId!: number;

  @IsEnum(RoleCode)
  @IsNotEmpty()
  role!: RoleCode;

  @IsString()
  @IsNotEmpty()
  shiftTemplateId!: string;
}
