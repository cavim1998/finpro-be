import { Type } from "class-transformer";
import { IsInt, Min } from "class-validator";

export class TaskIdParamDTO {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  taskId!: number;
}
