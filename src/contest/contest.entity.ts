import { Entity, PrimaryGeneratedColumn, Index, ManyToOne, Column, JoinColumn, OneToMany } from "typeorm";

import { UserEntity } from "@/user/user.entity";

import { ContestType } from "./contest-type.enum";
import { ContestProblemEntity } from "./contest-problem.entity";

@Entity("contest")
@Index(["isPublic", "startTime"])
@Index(["isPublic", "endTime"])
export class ContestEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "varchar", length: 120 })
  title: string;

  @Column({ type: "text", nullable: true })
  description: string;

  @Column({ type: "datetime" })
  startTime: Date;

  @Column({ type: "datetime" })
  endTime: Date;

  @Column({ type: "enum", enum: ContestType })
  type: ContestType;

  @Column({ type: "boolean" })
  @Index()
  isPublic: boolean;

  @Column({ type: "text", nullable: true })
  announcement: string;

  @Column({ type: "text", nullable: true })
  editorial: string;

  @ManyToOne(() => UserEntity)
  @JoinColumn()
  owner: Promise<UserEntity>;

  @Column()
  @Index()
  ownerId: number;

  @Column({ type: "datetime" })
  createTime: Date;

  @OneToMany(() => ContestProblemEntity, contestProblem => contestProblem.contest)
  problems: Promise<ContestProblemEntity[]>;
}
