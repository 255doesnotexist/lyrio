import { Module, forwardRef } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { UserModule } from "@/user/user.module";
import { UserEntity } from "@/user/user.entity";
import { ProblemModule } from "@/problem/problem.module";
import { ProblemEntity } from "@/problem/problem.entity";
import { SubmissionModule } from "@/submission/submission.module";
import { SubmissionEntity } from "@/submission/submission.entity";
import { LocalizedContentModule } from "@/localized-content/localized-content.module";
import { RatingModule } from "@/rating/rating.module";

import { ContestEntity } from "./contest.entity";
import { ContestProblemEntity } from "./contest-problem.entity";
import { ContestRegistrationEntity } from "./contest-registration.entity";
import { ContestService } from "./contest.service";
import { ContestController } from "./contest.controller";

@Module({
  imports: [
    TypeOrmModule.forFeature([ContestEntity]),
    TypeOrmModule.forFeature([ContestProblemEntity]),
    TypeOrmModule.forFeature([ContestRegistrationEntity]),
    TypeOrmModule.forFeature([UserEntity]),
    TypeOrmModule.forFeature([ProblemEntity]),
    TypeOrmModule.forFeature([SubmissionEntity]),
    LocalizedContentModule,
    forwardRef(() => UserModule),
    forwardRef(() => ProblemModule),
    forwardRef(() => SubmissionModule),
    forwardRef(() => RatingModule)
  ],
  providers: [ContestService],
  controllers: [ContestController],
  exports: [ContestService]
})
export class ContestModule {}
