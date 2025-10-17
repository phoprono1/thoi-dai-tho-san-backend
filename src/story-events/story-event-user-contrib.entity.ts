import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm';

@Entity({ name: 'story_event_user_contrib' })
export class StoryEventUserContrib {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'integer' })
  storyEventId: number;

  @Column({ type: 'integer' })
  userId: number;

  @Column({
    type: 'bigint',
    default: 0,
    transformer: {
      from: (value: string | number | null) => Number(value || 0),
      to: (value: number) => Number(value || 0),
    },
  })
  dungeonClears: number;

  @Column({
    type: 'bigint',
    default: 0,
    transformer: {
      from: (value: string | number | null) => Number(value || 0),
      to: (value: number) => Number(value || 0),
    },
  })
  enemyKills: number;

  @Column({
    type: 'bigint',
    default: 0,
    transformer: {
      from: (value: string | number | null) => Number(value || 0),
      to: (value: number) => Number(value || 0),
    },
  })
  itemsContributed: number;

  @Column({
    type: 'bigint',
    default: 0,
    transformer: {
      from: (value: string | number | null) => Number(value || 0),
      to: (value: number) => Number(value || 0),
    },
  })
  totalScore: number;

  @Column({ type: 'timestamptz', nullable: true })
  lastContributionAt?: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @BeforeInsert()
  @BeforeUpdate()
  ensureNumbers() {
    this.dungeonClears = Number(this.dungeonClears || 0);
    this.enemyKills = Number(this.enemyKills || 0);
    this.itemsContributed = Number(this.itemsContributed || 0);
    this.totalScore = Number(this.totalScore || 0);
  }
}
