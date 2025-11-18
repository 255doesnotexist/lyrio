import { ApiProperty } from "@nestjs/swagger";

import { UserAvatarDto } from "./user-avatar.dto";

export class UserMetaDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  username: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  nickname: string;

  @ApiProperty()
  bio: string;

  @ApiProperty()
  avatar: UserAvatarDto;

  @ApiProperty()
  isAdmin: boolean;

  @ApiProperty()
  isOwner: boolean;

  @ApiProperty()
  isBanned: boolean;

  @ApiProperty()
  banReason: string;

  @ApiProperty()
  acceptedProblemCount: number;

  @ApiProperty()
  submissionCount: number;

  @ApiProperty()
  rating: number;

  @ApiProperty()
  registrationTime: Date;
}
