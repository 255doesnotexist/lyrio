import { ApiProperty } from "@nestjs/swagger";

import { ContestMetaDto } from "./contest-meta.dto";

export class GetContestListResponseDto {
  @ApiProperty({ type: [ContestMetaDto] })
  contests: ContestMetaDto[];

  @ApiProperty()
  count: number;
}
