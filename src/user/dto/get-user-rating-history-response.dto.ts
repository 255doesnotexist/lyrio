import { ApiProperty } from "@nestjs/swagger";

export enum GetUserRatingHistoryResponseError {
  NO_SUCH_USER = "NO_SUCH_USER"
}

export class RatingChangeDto {
  @ApiProperty()
  contestId: number;

  @ApiProperty()
  contestTitle: string;

  @ApiProperty()
  time: Date;

  @ApiProperty()
  oldRating: number;

  @ApiProperty()
  newRating: number;

  @ApiProperty()
  ratingChange: number;

  @ApiProperty()
  rank: number;

  @ApiProperty()
  participantCount: number;
}

export class GetUserRatingHistoryResponseDto {
  @ApiProperty({ enum: GetUserRatingHistoryResponseError, required: false })
  error?: GetUserRatingHistoryResponseError;

  @ApiProperty({ type: [RatingChangeDto], required: false })
  ratingHistory?: RatingChangeDto[];
}
