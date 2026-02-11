import { IsIn, IsInt, IsOptional, Max, Min } from "class-validator";

export class GetWorkerOrdersDto {
  @IsOptional()
  @IsIn(["incoming", "my", "completed"])
  scope?: "incoming" | "my" | "completed";

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 10;
}
