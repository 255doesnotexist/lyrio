import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsString } from "class-validator";

export class BatchImportUsersRequestDto {
  @ApiProperty({
    description: "CSV content with format: username,email,password (one user per line, no header row)"
  })
  @IsString()
  csvContent: string;

  @ApiProperty({
    description: "Whether imported users should be required to change password on first login"
  })
  @IsBoolean()
  requirePasswordChange: boolean;
}
