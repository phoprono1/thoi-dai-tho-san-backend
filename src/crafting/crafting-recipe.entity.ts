import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Item } from '../items/item.entity';

export interface CraftingMaterial {
  itemId: number;
  quantity: number;
  item?: Item; // For population
}

@Entity('crafting_recipes')
export class CraftingRecipe {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string; // Tên công thức (VD: "Bình Thuốc Hồi Máu Lớn")

  @Column({ type: 'text', nullable: true })
  description?: string; // Mô tả công thức

  @ManyToOne(() => Item, { eager: true })
  @JoinColumn({ name: 'resultItemId' })
  resultItem: Item; // Item được tạo ra

  @Column()
  resultItemId: number;

  @Column({ type: 'int', default: 1 })
  resultQuantity: number; // Số lượng item được tạo ra

  @Column({ type: 'jsonb' })
  materials: CraftingMaterial[]; // Danh sách nguyên liệu cần thiết

  @Column({ type: 'int', default: 1 })
  craftingLevel: number; // Level crafting cần thiết (1-10)

  @Column({ type: 'int', default: 0 })
  goldCost: number; // Chi phí vàng để craft

  @Column({ type: 'int', default: 60 }) // 60 giây
  craftingTime: number; // Thời gian craft (giây)

  @Column({ type: 'boolean', default: true })
  isActive: boolean; // Có thể craft được không

  @Column({ type: 'int', default: 0 })
  category: number; // Phân loại: 0=Consumables, 1=Equipment, 2=Materials

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

// Default crafting recipes
export const DEFAULT_CRAFTING_RECIPES = [
  // Consumables - Potions
  {
    name: 'Bình Thuốc Hồi Máu Nhỏ',
    description: 'Hồi phục 50 HP',
    resultItemId: 1, // Cần tạo item này trước
    resultQuantity: 1,
    materials: [
      { itemId: 101, quantity: 2 }, // Thảo dược đỏ
      { itemId: 102, quantity: 1 }, // Nước tinh khiết
    ],
    craftingLevel: 1,
    goldCost: 10,
    craftingTime: 30,
    category: 0,
  },
  {
    name: 'Bình Thuốc Hồi Thể Lực Nhỏ',
    description: 'Hồi phục 30 Energy',
    resultItemId: 2,
    resultQuantity: 1,
    materials: [
      { itemId: 103, quantity: 2 }, // Thảo dược xanh
      { itemId: 102, quantity: 1 }, // Nước tinh khiết
    ],
    craftingLevel: 1,
    goldCost: 15,
    craftingTime: 30,
    category: 0,
  },
  {
    name: 'Thuốc Tăng Sức Mạnh',
    description: 'Tăng vĩnh viễn 1 điểm STR',
    resultItemId: 3,
    resultQuantity: 1,
    materials: [
      { itemId: 104, quantity: 5 }, // Tinh chất sức mạnh
      { itemId: 105, quantity: 3 }, // Bột kim cương
      { itemId: 102, quantity: 2 }, // Nước tinh khiết
    ],
    craftingLevel: 5,
    goldCost: 1000,
    craftingTime: 300,
    category: 0,
  },
  {
    name: 'Thuốc Tăng Trí Tuệ',
    description: 'Tăng vĩnh viễn 1 điểm INT',
    resultItemId: 4,
    resultQuantity: 1,
    materials: [
      { itemId: 106, quantity: 5 }, // Tinh chất trí tuệ
      { itemId: 107, quantity: 3 }, // Bột sapphire
      { itemId: 102, quantity: 2 }, // Nước tinh khiết
    ],
    craftingLevel: 5,
    goldCost: 1000,
    craftingTime: 300,
    category: 0,
  },
];
