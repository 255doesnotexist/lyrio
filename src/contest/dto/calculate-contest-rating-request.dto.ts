import { ApiProperty } from "@nestjs/swagger";

import { IsInt } from "class-validator";

export class CalculateContestRatingRequestDto {
  @ApiProperty()
  @IsInt()
  contestId: number;
}
