import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'story_events' })
export class StoryEvent {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('text')
  title: string;

  @Column({ type: 'text', nullable: true })
  slug?: string;

  @Column({ type: 'varchar', length: 32, default: 'event' })
  storyType: string;

  @Column({ type: 'text', nullable: true })
  descriptionHtml?: string;

  @Column({ type: 'text', nullable: true })
  contentHtml?: string;

  @Column({ type: 'timestamptz', nullable: true })
  eventStart?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  eventEnd?: Date;

  @Column({ type: 'varchar', length: 32, default: 'visible' })
  visibilityMode: string;

  @Column({ type: 'boolean', default: false })
  participationRequired: boolean;

  @Column({ type: 'boolean', default: false })
  globalEnabled: boolean;

  @Column({ type: 'bigint', nullable: true })
  globalTarget?: number;

  @Column({ type: 'jsonb', nullable: true })
  requirements?: any;

  @Column({ name: 'scoring_weights', type: 'jsonb', nullable: true })
  scoringWeights?: any;

  @Column({ type: 'jsonb', nullable: true })
  rewardConfig?: any;

  @Column({ type: 'integer', nullable: true })
  createdBy?: number;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  rewardDistributedAt?: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
