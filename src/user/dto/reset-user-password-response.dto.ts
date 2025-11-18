import { ApiProperty } from "@nestjs/swagger";

export enum ResetUserPasswordResponseError {
  PERMISSION_DENIED = "PERMISSION_DENIED",
  NO_SUCH_USER = "NO_SUCH_USER"
}

export class ResetUserPasswordResponseDto {
  @ApiProperty({ enum: ResetUserPasswordResponseError })
  error?: ResetUserPasswordResponseError;

  @ApiProperty()
  generatedPassword?: string;
}
