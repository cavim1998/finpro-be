import { z } from "zod";

export class CompleteStationDto {
  static schema = z.object({
    itemCounts: z.array(
      z.object({
        itemId: z.number().int().positive(),
        qty: z.number().int().min(0),
      }),
    ),
  });
}
