import { ApiProperty } from "@nestjs/swagger";

import { IsString, MaxLength, IsEnum, IsBoolean, IsInt, IsDateString, IsArray, IsOptional } from "class-validator";

import { ContestType } from "../contest-type.enum";

export class CreateContestRequestDto {
  @ApiProperty()
  @IsString()
  @MaxLength(120)
  readonly title: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  readonly description?: string;

  @ApiProperty()
  @IsDateString()
  readonly startTime: string;

  @ApiProperty()
  @IsDateString()
  readonly endTime: string;

  @ApiProperty({ enum: ContestType })
  @IsEnum(ContestType)
  readonly type: ContestType;

  @ApiProperty()
  @IsBoolean()
  readonly isPublic: boolean;

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
  readonly problemIds: number[];
}
