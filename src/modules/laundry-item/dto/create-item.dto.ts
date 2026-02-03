import {
  IsString,
  IsNotEmpty,
  IsNumber,
  Min,
  IsOptional,
} from "class-validator";

export class CreateItemDTO {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  unit?: string = "PCS";

  @IsNumber()
  @Min(0)
  price!: number;
}
