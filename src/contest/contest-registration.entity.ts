import { Entity, PrimaryColumn, Index, ManyToOne, Column, JoinColumn } from "typeorm";

import { UserEntity } from "@/user/user.entity";
import { ContestEntity } from "./contest.entity";

@Entity("contest_registration")
@Index(["userId", "registrationTime"])
export class ContestRegistrationEntity {
  @PrimaryColumn()
  contestId: number;

  @PrimaryColumn()
  userId: number;

  @ManyToOne(() => ContestEntity, { onDelete: "CASCADE" })
  @JoinColumn()
  contest: Promise<ContestEntity>;

  @ManyToOne(() => UserEntity, { onDelete: "CASCADE" })
  @JoinColumn()
  user: Promise<UserEntity>;

  @Column({ type: "datetime" })
  registrationTime: Date;
}
