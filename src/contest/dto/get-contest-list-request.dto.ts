import { ApiProperty } from "@nestjs/swagger";

import { IsInt, Min, Max } from "class-validator";

export class GetContestListRequestDto {
  @ApiProperty()
  @IsInt()
  @Min(0)
  readonly skipCount: number;

  @ApiProperty()
  @IsInt()
  @Min(1)
  @Max(100)
  readonly takeCount: number;
}
