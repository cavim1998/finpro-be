import {
  IsUUID,
  IsNumber,
  IsArray,
  ValidateNested,
  IsOptional,
  Min,
  IsEnum,
} from "class-validator";
import { Type } from "class-transformer";
import { ServiceType } from "../../../../generated/prisma/client.js";

class OrderItemDto {
  @IsNumber()
  itemId!: number;

  @IsNumber()
  @Min(1)
  qty!: number;
}

export class CreateOrderDTO {
  @IsUUID()
  pickupRequestId!: string;

  @IsEnum(ServiceType)
  serviceType!: ServiceType;

  @IsNumber()
  @Min(0.1)
  totalWeightKg!: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];

  @IsNumber()
  @IsOptional()
  deliveryFee?: number;
}
