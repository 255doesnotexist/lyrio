import { ApiProperty } from "@nestjs/swagger";

import { IsInt } from "class-validator";

export class GetContestDetailRequestDto {
  @ApiProperty()
  @IsInt()
  readonly contestId: number;
}
