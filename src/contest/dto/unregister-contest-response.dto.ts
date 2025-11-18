import { ApiProperty } from "@nestjs/swagger";

export enum UnregisterContestResponseError {
  PERMISSION_DENIED = "PERMISSION_DENIED",
  NO_SUCH_CONTEST = "NO_SUCH_CONTEST",
  NOT_REGISTERED = "NOT_REGISTERED",
  CONTEST_STARTED = "CONTEST_STARTED"
}

export class UnregisterContestResponseDto {
  @ApiProperty({ enum: UnregisterContestResponseError })
  error?: UnregisterContestResponseError;
}
