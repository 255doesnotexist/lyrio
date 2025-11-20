import { ApiProperty } from "@nestjs/swagger";

import { IsInt } from "class-validator";

export class RegisterContestRequestDto {
  @ApiProperty()
  @IsInt()
  readonly contestId: number;
}
