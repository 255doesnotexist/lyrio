import { ApiProperty } from "@nestjs/swagger";

export enum UpdateContestResponseError {
  PERMISSION_DENIED = "PERMISSION_DENIED",
  NO_SUCH_CONTEST = "NO_SUCH_CONTEST",
  INVALID_TIME_RANGE = "INVALID_TIME_RANGE",
  NO_SUCH_PROBLEM = "NO_SUCH_PROBLEM"
}

export class UpdateContestResponseDto {
  @ApiProperty({ enum: UpdateContestResponseError })
  error?: UpdateContestResponseError;
}
