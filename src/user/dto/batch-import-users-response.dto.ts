import { ApiProperty } from "@nestjs/swagger";

export enum BatchImportUsersResponseError {
  PERMISSION_DENIED = "PERMISSION_DENIED",
  INVALID_CSV_FORMAT = "INVALID_CSV_FORMAT",
  DUPLICATE_USERNAME = "DUPLICATE_USERNAME",
  DUPLICATE_EMAIL = "DUPLICATE_EMAIL"
}

export interface ImportedUserInfo {
  username: string;
  email: string;
  success: boolean;
  error?: string;
}

export class BatchImportUsersResponseDto {
  @ApiProperty({ enum: BatchImportUsersResponseError })
  error?: BatchImportUsersResponseError;

  @ApiProperty()
  importedUsers?: ImportedUserInfo[];

  @ApiProperty()
  successCount?: number;

  @ApiProperty()
  failureCount?: number;
}
