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

export enum PickupRequestSortBy {
  CREATED_AT = "createdAt",
  UPDATED_AT = "updatedAt",
  SCHEDULED_PICKUP_AT = "scheduledPickupAt",
  STATUS = "status",
}

export enum SortOrder {
  ASC = "asc",
  DESC = "desc",
}

export const MAX_LIST_LIMIT = 50;

export class GetPickupRequestsDTO {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_LIST_LIMIT)
  limit?: number = 10;

  @IsOptional()
  @IsEnum([
    "WAITING_DRIVER",
    "DRIVER_ASSIGNED",
    "PICKED_UP",
    "ARRIVED_OUTLET",
    "CANCELED",
  ])
  status?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  @IsEnum(PickupRequestSortBy)
  sortBy?: PickupRequestSortBy = PickupRequestSortBy.CREATED_AT;

  @IsOptional()
  @IsString()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder = SortOrder.DESC;
}
