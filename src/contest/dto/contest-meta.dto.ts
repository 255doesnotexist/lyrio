import { ApiProperty } from "@nestjs/swagger";

import { ContestType } from "../contest-type.enum";

export class ContestMetaDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  title: string;

  @ApiProperty()
  description: string;

  @ApiProperty()
  startTime: Date;

  @ApiProperty()
  endTime: Date;

  @ApiProperty({ enum: ContestType })
  type: ContestType;

  @ApiProperty()
  isPublic: boolean;

  @ApiProperty()
  ownerId: number;

  @ApiProperty()
  ownerUsername: string;

  @ApiProperty()
  ownerRating?: number;

  @ApiProperty()
  createTime: Date;

  @ApiProperty()
  problemCount: number;
}
