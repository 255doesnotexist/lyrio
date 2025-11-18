import { ApiProperty } from "@nestjs/swagger";

export enum CreateContestResponseError {
  PERMISSION_DENIED = "PERMISSION_DENIED",
  INVALID_TIME_RANGE = "INVALID_TIME_RANGE",
  NO_SUCH_PROBLEM = "NO_SUCH_PROBLEM"
}

export class CreateContestResponseDto {
  @ApiProperty({ enum: CreateContestResponseError })
  error?: CreateContestResponseError;

  @ApiProperty()
  contestId?: number;
}
