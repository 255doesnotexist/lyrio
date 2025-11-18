import { ApiProperty } from "@nestjs/swagger";

export enum RegisterContestResponseError {
  PERMISSION_DENIED = "PERMISSION_DENIED",
  NO_SUCH_CONTEST = "NO_SUCH_CONTEST",
  ALREADY_REGISTERED = "ALREADY_REGISTERED",
  CONTEST_NOT_STARTED = "CONTEST_NOT_STARTED"
}

export class RegisterContestResponseDto {
  @ApiProperty({ enum: RegisterContestResponseError })
  error?: RegisterContestResponseError;
}
