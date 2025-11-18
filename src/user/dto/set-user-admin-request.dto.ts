import { ApiProperty } from "@nestjs/swagger";

import { IsInt, IsBoolean } from "class-validator";

export class SetUserAdminRequestDto {
  @ApiProperty()
  @IsInt()
  readonly userId: number;

  @ApiProperty()
  @IsBoolean()
  readonly isAdmin: boolean;
}
