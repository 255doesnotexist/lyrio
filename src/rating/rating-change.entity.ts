import { Entity, PrimaryGeneratedColumn, Index, ManyToOne, Column, JoinColumn } from "typeorm";

import { UserEntity } from "@/user/user.entity";
import { ContestEntity } from "@/contest/contest.entity";

@Entity("rating_change")
@Index(["userId", "time"])
export class RatingChangeEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => UserEntity)
  @JoinColumn()
  user: Promise<UserEntity>;

  @Column()
  userId: number;

  @ManyToOne(() => ContestEntity)
  @JoinColumn()
  contest: Promise<ContestEntity>;

  @Column()
  contestId: number;

  @Column({ type: "datetime" })
  time: Date;

  @Column({ type: "integer" })
  oldRating: number;

  @Column({ type: "integer" })
  newRating: number;

  @Column({ type: "integer" })
  ratingChange: number;

  @Column({ type: "integer" })
  rank: number;

  @Column({ type: "integer" })
  participantCount: number;
}
