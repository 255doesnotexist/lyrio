import { ApiProperty } from "@nestjs/swagger";

export enum BanUserResponseError {
  PERMISSION_DENIED = "PERMISSION_DENIED",
  NO_SUCH_USER = "NO_SUCH_USER",
  CANNOT_BAN_ADMIN = "CANNOT_BAN_ADMIN"
}

export class BanUserResponseDto {
  @ApiProperty({ enum: BanUserResponseError })
  error?: BanUserResponseError;
}
