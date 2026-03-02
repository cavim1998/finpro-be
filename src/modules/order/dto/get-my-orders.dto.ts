import { Type } from "class-transformer";
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";

export enum MyOrderSortBy {
  CREATED_AT = "createdAt",
  UPDATED_AT = "updatedAt",
  ORDER_NO = "orderNo",
  STATUS = "status",
  TOTAL_AMOUNT = "totalAmount",
}

export enum MyOrderSortOrder {
  ASC = "asc",
  DESC = "desc",
}

export const MAX_MY_ORDER_LIMIT = 50;

export class GetMyOrdersDTO {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_MY_ORDER_LIMIT)
  limit?: number = 10;

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
  search?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsEnum(MyOrderSortBy)
  sortBy?: MyOrderSortBy = MyOrderSortBy.CREATED_AT;

  @IsOptional()
  @IsEnum(MyOrderSortOrder)
  sortOrder?: MyOrderSortOrder = MyOrderSortOrder.DESC;
}
