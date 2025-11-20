import { ApiProperty } from "@nestjs/swagger";

import { IsInt } from "class-validator";

export class GetContestRanklistRequestDto {
  @ApiProperty()
  @IsInt()
  readonly contestId: number;
}
