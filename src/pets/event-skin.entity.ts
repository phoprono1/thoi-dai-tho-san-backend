import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { PetDefinition } from './pet-definition.entity';

@Entity('event_skins')
export class EventSkin {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'pet_definition_id' })
  petDefinitionId: number;

  @ManyToOne(() => PetDefinition, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pet_definition_id' })
  petDefinition: PetDefinition;

  @Column({ name: 'event_name' })
  eventName: string;

  @Column({ name: 'skin_name', nullable: true })
  skinName: string;

  @Column({ name: 'skin_image' })
  skinImage: string;

  @Column({ nullable: true })
  description: string;

  @Column({ name: 'start_date', type: 'timestamp', nullable: true })
  startDate: Date;

  @Column({ name: 'end_date', type: 'timestamp', nullable: true })
  endDate: Date;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'sort_order', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
