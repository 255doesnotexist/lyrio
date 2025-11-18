import { ApiProperty } from "@nestjs/swagger";
import { IsInt } from "class-validator";

export class UnregisterContestRequestDto {
  @ApiProperty()
  @IsInt()
  readonly contestId: number;
}
