import { Injectable, Inject, forwardRef } from "@nestjs/common";
import { InjectRepository, InjectDataSource } from "@nestjs/typeorm";
import { Repository, DataSource, In, MoreThanOrEqual, LessThanOrEqual } from "typeorm";

import { UserEntity } from "@/user/user.entity";
import { ProblemEntity } from "@/problem/problem.entity";
import { SubmissionEntity } from "@/submission/submission.entity";
import { SubmissionStatus } from "@/submission/submission-status.enum";
import { LocalizedContentService } from "@/localized-content/localized-content.service";
import { LocalizedContentType } from "@/localized-content/localized-content.entity";

import { ContestEntity } from "./contest.entity";
import { ContestProblemEntity } from "./contest-problem.entity";
import { ContestRegistrationEntity } from "./contest-registration.entity";
import { ContestType } from "./contest-type.enum";
import {
  ContestMetaDto,
  ContestProblemMetaDto,
  ContestRanklistItemDto,
  ContestRanklistProblemStatusDto
} from "./dto";
import { RatingService } from "@/rating/rating.service";

@Injectable()
export class ContestService {
  constructor(
    @InjectDataSource()
    private readonly connection: DataSource,
    @InjectRepository(ContestEntity)
    private readonly contestRepository: Repository<ContestEntity>,
    @InjectRepository(ContestProblemEntity)
    private readonly contestProblemRepository: Repository<ContestProblemEntity>,
    @InjectRepository(ContestRegistrationEntity)
    private readonly contestRegistrationRepository: Repository<ContestRegistrationEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
    @InjectRepository(ProblemEntity)
    private readonly problemRepository: Repository<ProblemEntity>,
    @InjectRepository(SubmissionEntity)
    private readonly submissionRepository: Repository<SubmissionEntity>,
    @Inject(forwardRef(() => RatingService))
    private readonly ratingService: RatingService,
    private readonly localizedContentService: LocalizedContentService
  ) {}

  async findContestById(id: number): Promise<ContestEntity> {
    return await this.contestRepository.findOneBy({ id });
  }

  async getContestMeta(contest: ContestEntity): Promise<ContestMetaDto> {
    const owner = await contest.owner;
    const problems = await contest.problems;

    return {
      id: contest.id,
      title: contest.title,
      description: contest.description,
      startTime: contest.startTime,
      endTime: contest.endTime,
      type: contest.type,
      isPublic: contest.isPublic,
      ownerId: contest.ownerId,
      ownerUsername: owner.username,
      createTime: contest.createTime,
      problemCount: problems ? problems.length : 0
    };
  }

  async checkPermissionToManage(contest: ContestEntity, user: UserEntity): Promise<boolean> {
    if (!user) return false;
    if (user.isAdmin) return true;
    if (contest.ownerId === user.id) return true;
    return false;
  }

  async checkPermissionToView(contest: ContestEntity, user: UserEntity): Promise<boolean> {
    if (contest.isPublic) return true;
    return await this.checkPermissionToManage(contest, user);
  }

  async getContestList(
    skipCount: number,
    takeCount: number,
    currentUser?: UserEntity
  ): Promise<[ContestEntity[], number]> {
    const queryBuilder = this.contestRepository.createQueryBuilder("contest");

    if (currentUser) {
      // Show public contests OR contests owned by the current user
      queryBuilder.where("contest.isPublic = :isPublic OR contest.ownerId = :ownerId", {
        isPublic: true,
        ownerId: currentUser.id
      });
    } else {
      // Only show public contests for anonymous users
      queryBuilder.where("contest.isPublic = :isPublic", { isPublic: true });
    }

    queryBuilder.orderBy("contest.startTime", "DESC").skip(skipCount).take(takeCount);

    return await queryBuilder.getManyAndCount();
  }

  async getContestProblems(contestId: number): Promise<ContestProblemMetaDto[]> {
    const contestProblems = await this.contestProblemRepository.find({
      where: { contestId },
      order: { orderIndex: "ASC" }
    });

    const result: ContestProblemMetaDto[] = [];
    for (const cp of contestProblems) {
      const problem = await cp.problem;

      // Get the problem title from localized content (any locale)
      const localizedTitle = await this.localizedContentService.getOfAnyLocale(
        problem.id,
        LocalizedContentType.ProblemTitle
      );

      // Use the localized title if available, otherwise fall back to "Problem A/B/C"
      const problemTitle = localizedTitle
        ? localizedTitle[1]
        : `Problem ${String.fromCharCode(65 + cp.orderIndex)}`;

      result.push({
        contestProblemId: cp.id,
        orderIndex: cp.orderIndex,
        problemId: problem.id,
        problemDisplayId: problem.displayId,
        problemTitle
      });
    }

    return result;
  }

  async createContest(
    title: string,
    description: string,
    startTime: Date,
    endTime: Date,
    type: ContestType,
    isPublic: boolean,
    announcement: string,
    editorial: string,
    ownerId: number,
    problemIds: number[]
  ): Promise<ContestEntity> {
    return await this.connection.transaction("READ COMMITTED", async transactionalEntityManager => {
      const contest = new ContestEntity();
      contest.title = title;
      contest.description = description;
      contest.startTime = startTime;
      contest.endTime = endTime;
      contest.type = type;
      contest.isPublic = isPublic;
      contest.announcement = announcement;
      contest.editorial = editorial;
      contest.ownerId = ownerId;
      contest.createTime = new Date();

      await transactionalEntityManager.save(contest);

      // Add problems to contest
      for (let i = 0; i < problemIds.length; i++) {
        const contestProblem = new ContestProblemEntity();
        contestProblem.contestId = contest.id;
        contestProblem.problemId = problemIds[i];
        contestProblem.orderIndex = i;
        await transactionalEntityManager.save(contestProblem);
      }

      return contest;
    });
  }

  async updateContest(
    contest: ContestEntity,
    updates: {
      title?: string;
      description?: string;
      startTime?: Date;
      endTime?: Date;
      type?: ContestType;
      isPublic?: boolean;
      announcement?: string;
      editorial?: string;
      problemIds?: number[];
    }
  ): Promise<void> {
    await this.connection.transaction("READ COMMITTED", async transactionalEntityManager => {
      if (updates.title !== undefined) contest.title = updates.title;
      if (updates.description !== undefined) contest.description = updates.description;
      if (updates.startTime !== undefined) contest.startTime = updates.startTime;
      if (updates.endTime !== undefined) contest.endTime = updates.endTime;
      if (updates.type !== undefined) contest.type = updates.type;
      if (updates.isPublic !== undefined) contest.isPublic = updates.isPublic;
      if (updates.announcement !== undefined) contest.announcement = updates.announcement;
      if (updates.editorial !== undefined) contest.editorial = updates.editorial;

      await transactionalEntityManager.save(contest);

      // Update problems if provided
      if (updates.problemIds !== undefined) {
        // Remove existing problems
        await transactionalEntityManager.delete(ContestProblemEntity, { contestId: contest.id });

        // Add new problems
        for (let i = 0; i < updates.problemIds.length; i++) {
          const contestProblem = new ContestProblemEntity();
          contestProblem.contestId = contest.id;
          contestProblem.problemId = updates.problemIds[i];
          contestProblem.orderIndex = i;
          await transactionalEntityManager.save(contestProblem);
        }
      }
    });
  }

  async deleteContest(contest: ContestEntity): Promise<void> {
    await this.contestRepository.remove(contest);
  }

  async checkProblemsExist(problemIds: number[]): Promise<boolean> {
    if (problemIds.length === 0) return true;
    const count = await this.problemRepository.count({
      where: { id: In(problemIds) }
    });
    return count === problemIds.length;
  }

  // Ranklist calculation methods
  async getContestRanklist(contestId: number): Promise<ContestRanklistItemDto[]> {
    const contest = await this.findContestById(contestId);
    if (!contest) return [];

    switch (contest.type) {
      case ContestType.OI:
        return await this.getRanklistOI(contest);
      case ContestType.IOI:
        return await this.getRanklistIOI(contest);
      case ContestType.ACM:
        return await this.getRanklistACM(contest);
      default:
        return [];
    }
  }

  private async getRanklistOI(contest: ContestEntity): Promise<ContestRanklistItemDto[]> {
    const contestProblems = await this.contestProblemRepository.find({
      where: { contestId: contest.id },
      order: { orderIndex: "ASC" }
    });

    const problemIds = contestProblems.map(cp => cp.problemId);
    if (problemIds.length === 0) return [];

    // Check if contest has ended
    const now = new Date();
    const hasEnded = now > new Date(contest.endTime);

    // Get all participants (users who submitted during contest time)
    const participants = await this.connection
      .createQueryBuilder(SubmissionEntity, "s")
      .select("DISTINCT s.submitterId", "userId")
      .where("s.contestId = :contestId", { contestId: contest.id })
      .andWhere("s.submitTime >= :startTime", { startTime: contest.startTime })
      .andWhere("s.submitTime <= :endTime", { endTime: contest.endTime })
      .getRawMany();

    const ranklist: ContestRanklistItemDto[] = [];

    for (const participant of participants) {
      const user = await this.userRepository.findOneBy({ id: participant.userId });
      if (!user) continue;

      const problemStatuses: ContestRanklistProblemStatusDto[] = [];
      let totalScore = 0;

      for (const cp of contestProblems) {
        // Check if user has submitted this problem
        const hasSubmitted = await this.submissionRepository
          .createQueryBuilder("s")
          .where("s.contestId = :contestId", { contestId: contest.id })
          .andWhere("s.submitterId = :userId", { userId: user.id })
          .andWhere("s.problemId = :problemId", { problemId: cp.problemId })
          .andWhere("s.submitTime >= :startTime", { startTime: contest.startTime })
          .andWhere("s.submitTime <= :endTime", { endTime: contest.endTime })
          .getCount();

        let score = 0;
        if (hasEnded) {
          // Get max score for this problem during contest time
          const maxScoreResult = await this.submissionRepository
            .createQueryBuilder("s")
            .select("MAX(s.score)", "maxScore")
            .where("s.contestId = :contestId", { contestId: contest.id })
            .andWhere("s.submitterId = :userId", { userId: user.id })
            .andWhere("s.problemId = :problemId", { problemId: cp.problemId })
            .andWhere("s.submitTime >= :startTime", { startTime: contest.startTime })
            .andWhere("s.submitTime <= :endTime", { endTime: contest.endTime })
            .andWhere("s.status != :pending", { pending: SubmissionStatus.Pending })
            .getRawOne();

          score = maxScoreResult?.maxScore || 0;
          totalScore += score;
        }

        problemStatuses.push({
          problemId: cp.problemId,
          orderIndex: cp.orderIndex,
          score: hasEnded ? score : null,
          status: hasSubmitted > 0 ? "submitted" : null
        });
      }

      ranklist.push({
        rank: 0,
        userId: user.id,
        username: user.username,
        totalScore: hasEnded ? totalScore : null,
        problemStatuses
      });
    }

    if (hasEnded) {
      // Sort by total score (descending)
      ranklist.sort((a, b) => b.totalScore - a.totalScore);

      // Assign ranks
      for (let i = 0; i < ranklist.length; i++) {
        ranklist[i].rank = i + 1;
      }
    } else {
      // During contest, don't assign meaningful ranks
      for (let i = 0; i < ranklist.length; i++) {
        ranklist[i].rank = 0;
      }
    }

    return ranklist;
  }

  private async getRanklistIOI(contest: ContestEntity): Promise<ContestRanklistItemDto[]> {
    const contestProblems = await this.contestProblemRepository.find({
      where: { contestId: contest.id },
      order: { orderIndex: "ASC" }
    });

    const problemIds = contestProblems.map(cp => cp.problemId);
    if (problemIds.length === 0) return [];

    // Get all participants (users who submitted during contest time)
    const participants = await this.connection
      .createQueryBuilder(SubmissionEntity, "s")
      .select("DISTINCT s.submitterId", "userId")
      .where("s.contestId = :contestId", { contestId: contest.id })
      .andWhere("s.submitTime >= :startTime", { startTime: contest.startTime })
      .andWhere("s.submitTime <= :endTime", { endTime: contest.endTime })
      .getRawMany();

    const ranklist: ContestRanklistItemDto[] = [];

    for (const participant of participants) {
      const user = await this.userRepository.findOneBy({ id: participant.userId });
      if (!user) continue;

      const problemStatuses: ContestRanklistProblemStatusDto[] = [];
      let totalScore = 0;

      for (const cp of contestProblems) {
        // Get max score for this problem during contest time (IOI always shows scores)
        const maxScoreResult = await this.submissionRepository
          .createQueryBuilder("s")
          .select("MAX(s.score)", "maxScore")
          .where("s.contestId = :contestId", { contestId: contest.id })
          .andWhere("s.submitterId = :userId", { userId: user.id })
          .andWhere("s.problemId = :problemId", { problemId: cp.problemId })
          .andWhere("s.submitTime >= :startTime", { startTime: contest.startTime })
          .andWhere("s.submitTime <= :endTime", { endTime: contest.endTime })
          .andWhere("s.status != :pending", { pending: SubmissionStatus.Pending })
          .getRawOne();

        const score = maxScoreResult?.maxScore || 0;
        totalScore += score;

        // Get first AC time (score = 100)
        let firstAcceptTime: number = null;
        if (score === 100) {
          const firstFullScore = await this.submissionRepository
            .createQueryBuilder("s")
            .where("s.contestId = :contestId", { contestId: contest.id })
            .andWhere("s.submitterId = :userId", { userId: user.id })
            .andWhere("s.problemId = :problemId", { problemId: cp.problemId })
            .andWhere("s.score = 100")
            .andWhere("s.submitTime >= :startTime", { startTime: contest.startTime })
            .andWhere("s.submitTime <= :endTime", { endTime: contest.endTime })
            .orderBy("s.submitTime", "ASC")
            .getOne();

          if (firstFullScore) {
            firstAcceptTime = Math.floor(
              (firstFullScore.submitTime.getTime() - contest.startTime.getTime()) / (1000 * 60)
            );
          }
        }

        problemStatuses.push({
          problemId: cp.problemId,
          orderIndex: cp.orderIndex,
          score: score,
          firstAcceptTime,
          status: score > 0 ? "solved" : null
        });
      }

      ranklist.push({
        rank: 0,
        userId: user.id,
        username: user.username,
        totalScore: totalScore,
        problemStatuses
      });
    }

    // Sort by total score (descending)
    ranklist.sort((a, b) => b.totalScore - a.totalScore);

    // Assign ranks
    for (let i = 0; i < ranklist.length; i++) {
      ranklist[i].rank = i + 1;
    }

    return ranklist;
  }

  private async getRanklistACM(contest: ContestEntity): Promise<ContestRanklistItemDto[]> {
    const contestProblems = await this.contestProblemRepository.find({
      where: { contestId: contest.id },
      order: { orderIndex: "ASC" }
    });

    const problemIds = contestProblems.map(cp => cp.problemId);
    if (problemIds.length === 0) return [];

    // Get all participants
    const participants = await this.connection
      .createQueryBuilder(SubmissionEntity, "s")
      .select("DISTINCT s.submitterId", "userId")
      .where("s.contestId = :contestId", { contestId: contest.id })
      .andWhere("s.submitTime >= :startTime", { startTime: contest.startTime })
      .andWhere("s.submitTime <= :endTime", { endTime: contest.endTime })
      .getRawMany();

    const ranklist: ContestRanklistItemDto[] = [];

    for (const participant of participants) {
      const user = await this.userRepository.findOneBy({ id: participant.userId });
      if (!user) continue;

      const problemStatuses: ContestRanklistProblemStatusDto[] = [];
      let solvedCount = 0;
      let totalPenalty = 0;

      for (const cp of contestProblems) {
        // Check if user has AC submission during contest time
        const firstAC = await this.submissionRepository
          .createQueryBuilder("s")
          .where("s.contestId = :contestId", { contestId: contest.id })
          .andWhere("s.submitterId = :userId", { userId: user.id })
          .andWhere("s.problemId = :problemId", { problemId: cp.problemId })
          .andWhere("s.status = :accepted", { accepted: SubmissionStatus.Accepted })
          .andWhere("s.submitTime >= :startTime", { startTime: contest.startTime })
          .andWhere("s.submitTime <= :endTime", { endTime: contest.endTime })
          .orderBy("s.submitTime", "ASC")
          .getOne();

        if (firstAC) {
          solvedCount++;

          // Calculate penalty time (in minutes from contest start)
          const solveTime = Math.floor(
            (firstAC.submitTime.getTime() - contest.startTime.getTime()) / (1000 * 60)
          );

          // Count wrong attempts before first AC
          const wrongAttempts = await this.submissionRepository
            .createQueryBuilder("s")
            .where("s.contestId = :contestId", { contestId: contest.id })
            .andWhere("s.submitterId = :userId", { userId: user.id })
            .andWhere("s.problemId = :problemId", { problemId: cp.problemId })
            .andWhere("s.status IN (:...wrongStatuses)", {
              wrongStatuses: [
                SubmissionStatus.WrongAnswer,
                SubmissionStatus.RuntimeError,
                SubmissionStatus.TimeLimitExceeded,
                SubmissionStatus.MemoryLimitExceeded
              ]
            })
            .andWhere("s.submitTime >= :startTime", { startTime: contest.startTime })
            .andWhere("s.submitTime < :firstACTime", { firstACTime: firstAC.submitTime })
            .getCount();

          const penalty = solveTime + wrongAttempts * 20;
          totalPenalty += penalty;

          problemStatuses.push({
            problemId: cp.problemId,
            orderIndex: cp.orderIndex,
            accepted: true,
            wrongAttempts,
            solveTime
          });
        } else {
          // Count wrong attempts (no AC)
          const wrongAttempts = await this.submissionRepository
            .createQueryBuilder("s")
            .where("s.contestId = :contestId", { contestId: contest.id })
            .andWhere("s.submitterId = :userId", { userId: user.id })
            .andWhere("s.problemId = :problemId", { problemId: cp.problemId })
            .andWhere("s.status IN (:...wrongStatuses)", {
              wrongStatuses: [
                SubmissionStatus.WrongAnswer,
                SubmissionStatus.RuntimeError,
                SubmissionStatus.TimeLimitExceeded,
                SubmissionStatus.MemoryLimitExceeded
              ]
            })
            .andWhere("s.submitTime >= :startTime", { startTime: contest.startTime })
            .andWhere("s.submitTime <= :endTime", { endTime: contest.endTime })
            .getCount();

          // Get last submit time
          let lastSubmitTime: number = null;
          if (wrongAttempts > 0) {
            const lastSubmission = await this.submissionRepository
              .createQueryBuilder("s")
              .where("s.contestId = :contestId", { contestId: contest.id })
              .andWhere("s.submitterId = :userId", { userId: user.id })
              .andWhere("s.problemId = :problemId", { problemId: cp.problemId })
              .andWhere("s.submitTime >= :startTime", { startTime: contest.startTime })
              .andWhere("s.submitTime <= :endTime", { endTime: contest.endTime })
              .orderBy("s.submitTime", "DESC")
              .getOne();

            if (lastSubmission) {
              lastSubmitTime = Math.floor(
                (lastSubmission.submitTime.getTime() - contest.startTime.getTime()) / (1000 * 60)
              );
            }
          }

          problemStatuses.push({
            problemId: cp.problemId,
            orderIndex: cp.orderIndex,
            accepted: false,
            wrongAttempts,
            lastSubmitTime
          });
        }
      }

      ranklist.push({
        rank: 0,
        userId: user.id,
        username: user.username,
        solvedCount,
        totalPenalty,
        problemStatuses
      });
    }

    // Sort by solved count (descending), then by total penalty (ascending)
    ranklist.sort((a, b) => {
      if (b.solvedCount !== a.solvedCount) {
        return b.solvedCount - a.solvedCount;
      }
      return a.totalPenalty - b.totalPenalty;
    });

    // Assign ranks
    for (let i = 0; i < ranklist.length; i++) {
      ranklist[i].rank = i + 1;
    }

    return ranklist;
  }

  async getProblemIdsByContestId(contestId: number): Promise<number[]> {
    const contestProblems = await this.contestProblemRepository.find({
      where: { contestId },
      order: { orderIndex: "ASC" }
    });
    return contestProblems.map(cp => cp.problemId);
  }

  async getContestIdByProblemId(problemId: number): Promise<number[]> {
    const contestProblems = await this.contestProblemRepository.find({
      where: { problemId }
    });
    return contestProblems.map(cp => cp.contestId);
  }

  async isUserRegisteredForContest(contestId: number, userId: number): Promise<boolean> {
    if (!userId) return false;
    const registration = await this.contestRegistrationRepository.findOneBy({
      contestId,
      userId
    });
    return !!registration;
  }

  async isProblemInContest(contestId: number, problemId: number): Promise<boolean> {
    const contestProblem = await this.contestProblemRepository.findOneBy({
      contestId,
      problemId
    });
    return !!contestProblem;
  }

  async registerUserForContest(contest: ContestEntity, user: UserEntity): Promise<void> {
    const registration = new ContestRegistrationEntity();
    registration.contestId = contest.id;
    registration.userId = user.id;
    registration.registrationTime = new Date();
    await this.contestRegistrationRepository.save(registration);
  }

  async unregisterUserFromContest(contestId: number, userId: number): Promise<void> {
    await this.contestRegistrationRepository.delete({
      contestId,
      userId
    });
  }

  /**
   * Calculate rating changes for a contest after it ends
   * This should be called manually by an admin after the contest finishes
   */
  async calculateContestRatings(contest: ContestEntity): Promise<void> {
    // Check if contest has ended
    const now = new Date();
    if (now < contest.endTime) {
      throw new Error("Cannot calculate ratings for a contest that has not ended yet");
    }

    // Get contest ranklist
    const ranklist = await this.getContestRanklist(contest.id);

    if (ranklist.length === 0) {
      return; // No participants, nothing to calculate
    }

    // Prepare rating calculation inputs
    const participants = await Promise.all(
      ranklist.map(async item => {
        const user = await this.userRepository.findOneBy({ id: item.userId });
        const contestParticipationCount = await this.ratingService.getUserContestParticipationCount(user.id);

        return {
          userId: user.id,
          rank: item.rank,
          oldRating: user.rating,
          contestParticipationCount
        };
      })
    );

    // Calculate rating changes
    const ratingChanges = await this.ratingService.calculateRatingChanges(contest, participants);

    // Save rating changes and update user ratings
    await this.ratingService.saveRatingChanges(contest, ratingChanges);
  }
}
