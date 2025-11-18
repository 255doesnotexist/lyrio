import { ApiProperty } from "@nestjs/swagger";

import { IsInt } from "class-validator";

export class GetUserRatingHistoryRequestDto {
  @ApiProperty()
  @IsInt()
  userId: number;
}
