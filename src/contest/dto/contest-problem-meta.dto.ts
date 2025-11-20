import { ApiProperty } from "@nestjs/swagger";

export class ContestProblemMetaDto {
  @ApiProperty()
  contestProblemId: number;

  @ApiProperty()
  orderIndex: number;

  @ApiProperty()
  problemId: number;

  @ApiProperty()
  problemDisplayId: number;

  @ApiProperty()
  problemTitle: string;
}
