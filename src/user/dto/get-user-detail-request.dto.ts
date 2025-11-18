import { ApiProperty } from "@nestjs/swagger";

import { IsInt, IsDateString, IsString, MaxLength, IsOptional } from "class-validator";

import { IsUsername } from "@/common/validators";

export class GetUserDetailRequestDto {
  @ApiProperty()
  @IsInt()
  @IsOptional()
  userId?: number;

  @ApiProperty()
  @IsUsername()
  @IsOptional()
  username?: string;

  // Below props are for the data for subway graph
  @ApiProperty({ required: false })
  @IsString()
  @MaxLength(50)
  @IsOptional()
  timezone?: string;

  @ApiProperty({ required: false })
  @IsDateString()
  @IsOptional()
  now?: string;
}
