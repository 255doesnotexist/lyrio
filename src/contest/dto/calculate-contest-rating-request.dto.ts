import { ApiProperty } from "@nestjs/swagger";

import { IsInt, IsBoolean, IsOptional } from "class-validator";

export class CalculateContestRatingRequestDto {
  @ApiProperty()
  @IsInt()
  contestId: number;

  @ApiProperty({ required: false, description: "If true, recalculate this contest and all subsequent contests" })
  @IsBoolean()
  @IsOptional()
  recalculate?: boolean;
}
