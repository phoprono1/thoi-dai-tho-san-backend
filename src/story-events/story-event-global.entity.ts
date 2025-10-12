import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity({ name: 'story_event_global' })
export class StoryEventGlobal {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'integer' })
  storyEventId: number;

  @Column({ type: 'bigint', default: 0 })
  totalDungeonClears: number;

  @Column({ type: 'bigint', default: 0 })
  totalEnemyKills: number;

  @Column({ type: 'bigint', default: 0 })
  totalItemsContributed: number;
}
