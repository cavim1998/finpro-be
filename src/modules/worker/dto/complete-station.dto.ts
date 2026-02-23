import { Type } from "class-transformer";
import { IsArray, IsInt, Min, ValidateNested } from "class-validator";

class CompleteStationItemCountDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  itemId!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  qty!: number;
}

export class CompleteStationDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CompleteStationItemCountDto)
  itemCounts!: CompleteStationItemCountDto[];
}
