import { ApiProperty } from "@nestjs/swagger";

export enum SetUserAdminResponseError {
  PERMISSION_DENIED = "PERMISSION_DENIED",
  NO_SUCH_USER = "NO_SUCH_USER",
  CANNOT_MODIFY_OWNER = "CANNOT_MODIFY_OWNER"
}

export class SetUserAdminResponseDto {
  @ApiProperty({ enum: SetUserAdminResponseError })
  error?: SetUserAdminResponseError;
}
