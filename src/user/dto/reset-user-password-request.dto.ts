import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsString, IsOptional, IsBoolean } from "class-validator";

export class ResetUserPasswordRequestDto {
  @ApiProperty()
  @IsInt()
  userId: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  newPassword?: string;

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  requirePasswordChange?: boolean;
}
