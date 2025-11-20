import { Entity, PrimaryGeneratedColumn, Index, ManyToOne, Column, JoinColumn } from "typeorm";

import { ProblemEntity } from "@/problem/problem.entity";

import { ContestEntity } from "./contest.entity";

@Entity("contest_problem")
@Index(["contestId", "problemId"], { unique: true })
export class ContestProblemEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => ContestEntity, contest => contest.problems, { onDelete: "CASCADE" })
  @JoinColumn()
  contest: Promise<ContestEntity>;

  @Column()
  @Index()
  contestId: number;

  @ManyToOne(() => ProblemEntity, { onDelete: "CASCADE" })
  @JoinColumn()
  problem: Promise<ProblemEntity>;

  @Column()
  @Index()
  problemId: number;

  @Column({ type: "integer" })
  orderIndex: number;
}
