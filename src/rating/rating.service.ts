import { Injectable } from "@nestjs/common";
import { InjectRepository, InjectConnection } from "@nestjs/typeorm";

import { Repository, Connection } from "typeorm";

import { UserEntity } from "@/user/user.entity";
import { ContestEntity } from "@/contest/contest.entity";

import { RatingChangeEntity } from "./rating-change.entity";

interface RatingCalculationInput {
  userId: number;
  rank: number;
  oldRating: number;
  contestParticipationCount: number; // Number of rated contests the user has participated in before this one
}

interface RatingCalculationResult {
  userId: number;
  oldRating: number;
  newRating: number;
  ratingChange: number;
  rank: number;
}

@Injectable()
export class RatingService {
  constructor(
    @InjectConnection() private connection: Connection,
    @InjectRepository(RatingChangeEntity) private ratingChangeRepository: Repository<RatingChangeEntity>,
    @InjectRepository(UserEntity) private userRepository: Repository<UserEntity>
  ) {}

  /**
   * Calculate expected rank (seed) for a user given their rating and opponents' ratings
   */
  private calculateSeed(userRating: number, opponentRatings: number[]): number {
    let seed = 1;
    for (const opponentRating of opponentRatings) {
      seed += this.getWinProbability(opponentRating, userRating);
    }
    return seed;
  }

  /**
   * Calculate probability that user A beats user B
   * P(A beats B) = 1 / (1 + 10^((ratingB - ratingA) / 400))
   */
  private getWinProbability(ratingA: number, ratingB: number): number {
    return 1.0 / (1.0 + 10 ** ((ratingB - ratingA) / 400.0));
  }

  /**
   * Binary search to find the rating that would result in a given seed
   */
  private getRatingToAchieveSeed(opponentRatings: number[], targetSeed: number): number {
    let left = -10000;
    let right = 10000;

    // Binary search for rating
    for (let i = 0; i < 100; i++) {
      const mid = (left + right) / 2;
      const seed = this.calculateSeed(mid, opponentRatings);

      if (seed < targetSeed) {
        right = mid;
      } else {
        left = mid;
      }
    }

    return (left + right) / 2;
  }

  /**
   * Calculate rating changes for all participants in a contest using Codeforces algorithm
   */
  async calculateRatingChanges(
    contest: ContestEntity,
    participants: RatingCalculationInput[]
  ): Promise<RatingCalculationResult[]> {
    const n = participants.length;

    if (n === 0) {
      return [];
    }

    // Sort by rank
    participants.sort((a, b) => a.rank - b.rank);

    // Calculate seeds (expected ranks)
    const seeds: number[] = [];
    for (let i = 0; i < n; i++) {
      const opponentRatings = participants.filter((_, j) => j !== i).map(p => p.oldRating);
      seeds.push(this.calculateSeed(participants[i].oldRating, opponentRatings));
    }

    // Calculate geometric mean of seed and actual rank
    const midRanks: number[] = [];
    for (let i = 0; i < n; i++) {
      midRanks.push(Math.sqrt(seeds[i] * participants[i].rank));
    }

    // Calculate new ratings before adjustments
    const opponentRatingsArray = participants.map(p => p.oldRating);
    const deltas: number[] = [];
    for (let i = 0; i < n; i++) {
      const needRating = this.getRatingToAchieveSeed(
        opponentRatingsArray.filter((_, j) => j !== i),
        midRanks[i]
      );
      deltas.push((needRating - participants[i].oldRating) / 2);
    }

    // Zero-sum correction: make average change close to 0 with slight deflation
    // This follows the Codeforces Legacy algorithm
    const sumDelta = deltas.reduce((sum, d) => sum + d, 0);
    const inc = -sumDelta / n - 1;

    // Apply correction to all deltas
    const finalDeltas = deltas.map(d => Math.round(d + inc));

    // Build results (no special handling for new users in Legacy version)
    const results: RatingCalculationResult[] = [];
    for (let i = 0; i < n; i++) {
      const participant = participants[i];
      const delta = finalDeltas[i];
      let newRating = participant.oldRating + delta;

      // Ensure rating doesn't go below 0
      newRating = Math.max(0, newRating);

      results.push({
        userId: participant.userId,
        oldRating: participant.oldRating,
        newRating,
        ratingChange: delta,
        rank: participant.rank
      });
    }

    return results;
  }

  /**
   * Get rating history for a user
   */
  async getUserRatingHistory(userId: number): Promise<RatingChangeEntity[]> {
    return await this.ratingChangeRepository.find({
      where: { userId },
      order: { time: "ASC" }
    });
  }

  /**
   * Get contest participation count for a user (number of rated contests)
   */
  async getUserContestParticipationCount(userId: number): Promise<number> {
    return await this.ratingChangeRepository.count({
      where: { userId }
    });
  }

  /**
   * Save rating changes to database and update user ratings
   * If rating changes already exist for this contest+user, update them instead of creating new ones
   */
  async saveRatingChanges(contest: ContestEntity, ratingChanges: RatingCalculationResult[]): Promise<void> {
    await this.connection.transaction(async manager => {
      const time = new Date();

      for (const change of ratingChanges) {
        // Check if rating change already exists for this contest and user
        const existingChange = await manager.findOne(RatingChangeEntity, {
          where: { userId: change.userId, contestId: contest.id }
        });

        if (existingChange) {
          // UPDATE existing rating change record
          await manager.update(
            RatingChangeEntity,
            { userId: change.userId, contestId: contest.id },
            {
              time,
              oldRating: change.oldRating,
              newRating: change.newRating,
              ratingChange: change.ratingChange,
              rank: change.rank,
              participantCount: ratingChanges.length
            }
          );
        } else {
          // CREATE new rating change record
          const ratingChangeEntity = new RatingChangeEntity();
          ratingChangeEntity.userId = change.userId;
          ratingChangeEntity.contestId = contest.id;
          ratingChangeEntity.time = time;
          ratingChangeEntity.oldRating = change.oldRating;
          ratingChangeEntity.newRating = change.newRating;
          ratingChangeEntity.ratingChange = change.ratingChange;
          ratingChangeEntity.rank = change.rank;
          ratingChangeEntity.participantCount = ratingChanges.length;

          await manager.save(RatingChangeEntity, ratingChangeEntity);
        }

        // Update user rating
        await manager.update(UserEntity, { id: change.userId }, { rating: change.newRating });
      }
    });
  }

  /**
   * Delete rating changes for a specific contest
   */
  async deleteRatingChangesForContest(contestId: number): Promise<void> {
    await this.connection.transaction(async manager => {
      await manager.delete(RatingChangeEntity, { contestId });
    });
  }

  /**
   * Delete rating changes for a contest and all contests after it (ordered by end time)
   * This is used when recalculating ratings after rejudging
   */
  async deleteRatingChangesFromContestOnwards(contestId: number, contestEndTime: Date): Promise<number[]> {
    return await this.connection.transaction(async manager => {
      // Find all contests that ended at or after this contest
      const contests = await manager
        .createQueryBuilder(ContestEntity, "contest")
        .where("contest.endTime >= :endTime", { endTime: contestEndTime })
        .orderBy("contest.endTime", "ASC")
        .addOrderBy("contest.id", "ASC")
        .getMany();

      const contestIds = contests.map(c => c.id);

      if (contestIds.length > 0) {
        // First, get all affected users BEFORE deleting rating changes
        const affectedUserIds = await manager
          .createQueryBuilder(RatingChangeEntity, "rc")
          .select("DISTINCT rc.userId", "userId")
          .where("rc.contestId IN (:...contestIds)", { contestIds })
          .getRawMany();

        // Delete all rating changes for these contests
        await manager
          .createQueryBuilder()
          .delete()
          .from(RatingChangeEntity)
          .where("contestId IN (:...contestIds)", { contestIds })
          .execute();

        // Reset all users' ratings based on their rating before the recalculation point
        if (affectedUserIds.length > 0) {
          const userIds = affectedUserIds.map(u => u.userId);

          // For each affected user, we need to:
          // 1. Get their rating changes before this contest
          // 2. Set their rating to the last rating change before this contest, or 1500 if none
          for (const userId of userIds) {
            const lastRatingChange = await manager
              .createQueryBuilder(RatingChangeEntity, "rc")
              .where("rc.userId = :userId", { userId })
              .orderBy("rc.time", "DESC")
              .limit(1)
              .getOne();

            const rating = lastRatingChange ? lastRatingChange.newRating : 1500;
            await manager.update(UserEntity, { id: userId }, { rating });
          }
        }
      }

      return contestIds;
    });
  }

  /**
   * Get current rating for a user at a specific point in time (before a contest)
   * Returns 1500 if the user has no rating history
   */
  async getUserRatingBeforeContest(userId: number, contestEndTime: Date): Promise<number> {
    const lastRatingChange = await this.ratingChangeRepository
      .createQueryBuilder("rc")
      .innerJoin("rc.contest", "contest")
      .where("rc.userId = :userId", { userId })
      .andWhere("contest.endTime < :endTime", { endTime: contestEndTime })
      .orderBy("contest.endTime", "DESC")
      .addOrderBy("rc.time", "DESC")
      .limit(1)
      .getOne();

    return lastRatingChange ? lastRatingChange.newRating : 1500;
  }
}
