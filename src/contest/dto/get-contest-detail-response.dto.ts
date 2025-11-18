import { ApiProperty } from "@nestjs/swagger";

import { ContestType } from "../contest-type.enum";
import { ContestProblemMetaDto } from "./contest-problem-meta.dto";

export enum GetContestDetailResponseError {
  NO_SUCH_CONTEST = "NO_SUCH_CONTEST",
  PERMISSION_DENIED = "PERMISSION_DENIED"
}

export class GetContestDetailResponseDto {
  @ApiProperty({ enum: GetContestDetailResponseError })
  error?: GetContestDetailResponseError;

  @ApiProperty()
  id?: number;

  @ApiProperty()
  title?: string;

  @ApiProperty()
  description?: string;

  @ApiProperty()
  startTime?: Date;

  @ApiProperty()
  endTime?: Date;

  @ApiProperty({ enum: ContestType })
  type?: ContestType;

  @ApiProperty()
  isPublic?: boolean;

  @ApiProperty()
  announcement?: string;

  @ApiProperty()
  editorial?: string;

  @ApiProperty()
  ownerId?: number;

  @ApiProperty()
  ownerUsername?: string;

  @ApiProperty()
  createTime?: Date;

  @ApiProperty({ type: [ContestProblemMetaDto] })
  problems?: ContestProblemMetaDto[];

  @ApiProperty()
  hasPermissionToManage?: boolean;

  @ApiProperty()
  isRegistered?: boolean;
}
