import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
  IsEnum,
} from "class-validator";
import { Type } from "class-transformer";
import { ServiceType } from "../../../../generated/prisma/client.js";

class OrderItemDTO {
  @IsNotEmpty()
  @IsNumber()
  itemId!: number;

  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  qty!: number;
}

export class CreateOrderDTO {
  @IsNotEmpty()
  @IsUUID()
  pickupRequestId!: string;

  @IsEnum(ServiceType)
  serviceType!: ServiceType;

  @IsNotEmpty()
  @IsNumber()
  @Min(0.1)
  totalWeightKg!: number;

  @IsNotEmpty()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDTO)
  items!: OrderItemDTO[];

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  deliveryFee!: number;
}
