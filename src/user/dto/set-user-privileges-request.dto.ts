import { ApiProperty } from "@nestjs/swagger";

import { IsInt, IsEnum, ArrayUnique, IsBoolean, IsOptional } from "class-validator";

import { UserPrivilegeType } from "../user-privilege.entity";

export class SetUserPrivilegesRequestDto {
  @ApiProperty()
  @IsInt()
  readonly userId: number;

  @ApiProperty({ enum: UserPrivilegeType, isArray: true })
  @IsEnum(UserPrivilegeType, {
    each: true
  })
  @ArrayUnique()
  readonly privileges: UserPrivilegeType[];

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  readonly isHiddenFromHomeRanking?: boolean;
}
