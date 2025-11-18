import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsBoolean, IsString, IsOptional } from "class-validator";

export class BanUserRequestDto {
  @ApiProperty()
  @IsInt()
  readonly userId: number;

  @ApiProperty()
  @IsBoolean()
  readonly isBanned: boolean;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  readonly banReason?: string;
}
