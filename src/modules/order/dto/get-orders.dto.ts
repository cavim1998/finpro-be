import {
  IsEnum,
  IsOptional,
  IsString,
  IsDateString,
  IsInt,
  Min,
} from "class-validator";
import { Type } from "class-transformer";

export class GetOrdersDTO {
  @IsOptional()
  @IsEnum([
    "WAITING_DRIVER_PICKUP",
    "ON_THE_WAY_TO_OUTLET",
    "ARRIVED_AT_OUTLET",
    "WASHING",
    "IRONING",
    "PACKING",
    "WAITING_PAYMENT",
    "READY_TO_DELIVER",
    "DELIVERING_TO_CUSTOMER",
    "RECEIVED_BY_CUSTOMER",
    "CANCELED",
  ])
  status?: string;

  @IsOptional()
  @IsString()
  search?: string; // Search by orderNo

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;
}
