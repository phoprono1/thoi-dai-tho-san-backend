import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'story_event_user_contrib' })
export class StoryEventUserContrib {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'integer' })
  storyEventId: number;

  @Column({ type: 'integer' })
  userId: number;

  @Column({ type: 'bigint', default: 0 })
  dungeonClears: number;

  @Column({ type: 'bigint', default: 0 })
  enemyKills: number;

  @Column({ type: 'bigint', default: 0 })
  itemsContributed: number;

  @Column({ type: 'bigint', default: 0 })
  totalScore: number;

  @Column({ type: 'timestamptz', nullable: true })
  lastContributionAt?: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
