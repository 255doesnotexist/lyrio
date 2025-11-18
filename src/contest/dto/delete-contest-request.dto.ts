import { ApiProperty } from "@nestjs/swagger";

import { IsInt } from "class-validator";

export class DeleteContestRequestDto {
  @ApiProperty()
  @IsInt()
  readonly contestId: number;
}
