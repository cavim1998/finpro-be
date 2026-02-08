import { IsInt, IsOptional, Max, Min } from "class-validator";
import { Type } from "class-transformer";

export class DriverDashboardQueryDTO {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  taskPage?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pickupPage?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize?: number;
}
