import { ApiProperty } from "@nestjs/swagger";

import { ContestType } from "../contest-type.enum";

export enum GetContestRanklistResponseError {
  NO_SUCH_CONTEST = "NO_SUCH_CONTEST",
  PERMISSION_DENIED = "PERMISSION_DENIED"
}

export class ContestRanklistProblemStatusDto {
  @ApiProperty()
  problemId: number;

  @ApiProperty()
  orderIndex: number;

  @ApiProperty()
  score?: number;

  @ApiProperty()
  accepted?: boolean;

  @ApiProperty()
  wrongAttempts?: number;

  @ApiProperty()
  solveTime?: number;

  @ApiProperty()
  firstAcceptTime?: number;

  @ApiProperty()
  lastSubmitTime?: number;

  @ApiProperty()
  status?: string;
}

export class ContestRanklistItemDto {
  @ApiProperty()
  rank: number;

  @ApiProperty()
  userId: number;

  @ApiProperty()
  username: string;

  @ApiProperty()
  totalScore?: number;

  @ApiProperty()
  solvedCount?: number;

  @ApiProperty()
  totalPenalty?: number;

  @ApiProperty({ type: [ContestRanklistProblemStatusDto] })
  problemStatuses: ContestRanklistProblemStatusDto[];
}

export class GetContestRanklistResponseDto {
  @ApiProperty({ enum: GetContestRanklistResponseError })
  error?: GetContestRanklistResponseError;

  @ApiProperty()
  contestTitle?: string;

  @ApiProperty({ enum: ContestType })
  contestType?: ContestType;

  @ApiProperty({ type: [ContestRanklistItemDto] })
  ranklist?: ContestRanklistItemDto[];

  @ApiProperty({ type: [Number] })
  problemIds?: number[];
}
