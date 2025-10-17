import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity({ name: 'story_event_reward_distribution' })
export class StoryEventRewardDistribution {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  storyEventId: number;

  @CreateDateColumn({ type: 'timestamptz' })
  distributedAt: Date;

  @Column({ nullable: true })
  executedBy: number;

  @Column({ type: 'jsonb', nullable: true })
  config: any;

  @Column({ type: 'jsonb', nullable: true })
  summary: any;
}
