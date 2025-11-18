import { ApiProperty } from "@nestjs/swagger";

import { IsString, MaxLength, IsEnum, IsBoolean, IsInt, IsDateString, IsArray, IsOptional } from "class-validator";

import { ContestType } from "../contest-type.enum";

export class UpdateContestRequestDto {
  @ApiProperty()
  @IsInt()
  readonly contestId: number;

  @ApiProperty()
  @IsString()
  @MaxLength(120)
  @IsOptional()
  readonly title?: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  readonly description?: string;

  @ApiProperty()
  @IsDateString()
  @IsOptional()
  readonly startTime?: string;

  @ApiProperty()
  @IsDateString()
  @IsOptional()
  readonly endTime?: string;

  @ApiProperty({ enum: ContestType })
  @IsEnum(ContestType)
  @IsOptional()
  readonly type?: ContestType;

  @ApiProperty()
  @IsBoolean()
  @IsOptional()
  readonly isPublic?: boolean;

  @ApiProperty()
  @IsString()
  @IsOptional()
  readonly announcement?: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  readonly editorial?: string;

  @ApiProperty({ type: [Number] })
  @IsArray()
  @IsInt({ each: true })
  @IsOptional()
  readonly problemIds?: number[];
}
