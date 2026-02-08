import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

class OrderItemDTO {
  @IsNotEmpty()
  @IsInt()
  itemId!: number;

  @IsNotEmpty()
  @IsInt()
  @Min(1)
  qty!: number;
}

export class CreateOrderDTO {
  @IsNotEmpty()
  @IsUUID()
  pickupRequestId!: string;

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
