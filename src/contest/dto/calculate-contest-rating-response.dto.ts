import { ApiProperty } from "@nestjs/swagger";

export enum CalculateContestRatingResponseError {
  NO_SUCH_CONTEST = "NO_SUCH_CONTEST",
  PERMISSION_DENIED = "PERMISSION_DENIED",
  CONTEST_NOT_ENDED = "CONTEST_NOT_ENDED"
}

export class CalculateContestRatingResponseDto {
  @ApiProperty({ enum: CalculateContestRatingResponseError, required: false })
  error?: CalculateContestRatingResponseError;
}
