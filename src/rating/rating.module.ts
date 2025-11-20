import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { UserEntity } from "@/user/user.entity";

import { ContestModule } from "@/contest/contest.module";

import { RatingService } from "./rating.service";
import { RatingChangeEntity } from "./rating-change.entity";

@Module({
  imports: [TypeOrmModule.forFeature([RatingChangeEntity, UserEntity]), forwardRef(() => ContestModule)],
  providers: [RatingService],
  exports: [RatingService]
})
export class RatingModule {}
