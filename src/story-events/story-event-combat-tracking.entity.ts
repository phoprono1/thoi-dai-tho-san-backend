import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity({ name: 'story_event_combat_tracking' })
export class StoryEventCombatTracking {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'integer' })
  storyEventId: number;

  @Column({ type: 'integer' })
  userId: number;

  @Column({ type: 'integer' })
  combatResultId: number;
}
