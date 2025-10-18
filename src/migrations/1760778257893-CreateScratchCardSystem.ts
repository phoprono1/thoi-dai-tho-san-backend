import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateScratchCardSystem1760778257893
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Scratch card types table
    await queryRunner.createTable(
      new Table({
        name: 'scratch_card_types',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'name',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'background_image_url',
            type: 'varchar',
            length: '500',
            isNullable: true,
          },
          {
            name: 'cost_gold',
            type: 'int',
            isNullable: false,
            default: 100,
          },
          {
            name: 'grid_rows',
            type: 'int',
            isNullable: false,
            default: 3,
          },
          {
            name: 'grid_cols',
            type: 'int',
            isNullable: false,
            default: 3,
          },
          {
            name: 'is_active',
            type: 'boolean',
            isNullable: false,
            default: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
    );

    // Scratch card type prizes table
    await queryRunner.createTable(
      new Table({
        name: 'scratch_card_type_prizes',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'card_type_id',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'prize_type',
            type: 'enum',
            enum: ['gold', 'item', 'title', 'consumable'],
            isNullable: false,
          },
          {
            name: 'prize_value',
            type: 'int',
            isNullable: false,
            comment: 'Gold amount, item ID, title ID, or consumable ID',
          },
          {
            name: 'prize_quantity',
            type: 'int',
            isNullable: false,
            default: 1,
          },
          {
            name: 'probability_weight',
            type: 'int',
            isNullable: false,
            default: 1,
            comment: 'Higher weight = higher chance',
          },
          {
            name: 'tax_rate',
            type: 'decimal',
            precision: 5,
            scale: 2,
            isNullable: false,
            default: '0.10',
            comment: 'Tax rate as decimal (0.10 = 10%)',
          },
          {
            name: 'max_claims',
            type: 'int',
            isNullable: true,
            comment:
              'Maximum times this prize can be claimed, null = unlimited',
          },
          {
            name: 'claims_count',
            type: 'int',
            isNullable: false,
            default: 0,
          },
          {
            name: 'position_row',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'position_col',
            type: 'int',
            isNullable: false,
          },
        ],
        foreignKeys: [
          {
            columnNames: ['card_type_id'],
            referencedTableName: 'scratch_card_types',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
    );

    // User scratch cards table
    await queryRunner.createTable(
      new Table({
        name: 'user_scratch_cards',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'user_id',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'card_type_id',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'player_number',
            type: 'int',
            isNullable: false,
            comment: 'The lucky number assigned to player (1-100)',
          },
          {
            name: 'scratched_positions',
            type: 'json',
            isNullable: false,
            default: "'[]'",
            comment: 'Array of scratched position indices',
          },
          {
            name: 'revealed_prizes',
            type: 'json',
            isNullable: false,
            default: "'[]'",
            comment: 'Array of revealed prize objects',
          },
          {
            name: 'is_completed',
            type: 'boolean',
            isNullable: false,
            default: false,
          },
          {
            name: 'total_gold_won',
            type: 'int',
            isNullable: false,
            default: 0,
          },
          {
            name: 'total_items_won',
            type: 'json',
            isNullable: false,
            default: "'[]'",
          },
          {
            name: 'tax_deducted',
            type: 'int',
            isNullable: false,
            default: 0,
            comment: 'Total gold deducted as tax',
          },
          {
            name: 'final_gold_received',
            type: 'int',
            isNullable: false,
            default: 0,
            comment: 'Gold after tax deduction',
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'completed_at',
            type: 'timestamp',
            isNullable: true,
          },
        ],
        foreignKeys: [
          {
            columnNames: ['user_id'],
            referencedTableName: 'user',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
          {
            columnNames: ['card_type_id'],
            referencedTableName: 'scratch_card_types',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
    );

    // Title tax reductions table
    await queryRunner.createTable(
      new Table({
        name: 'title_tax_reductions',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'title_id',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'tax_reduction_percentage',
            type: 'decimal',
            precision: 5,
            scale: 2,
            isNullable: false,
            default: '0.00',
            comment: 'Tax reduction as decimal (0.50 = 50% reduction)',
          },
          {
            name: 'is_active',
            type: 'boolean',
            isNullable: false,
            default: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
        foreignKeys: [
          {
            columnNames: ['title_id'],
            referencedTableName: 'title',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
    );

    // Create indexes for performance
    await queryRunner.query(`
      CREATE INDEX "IDX_scratch_card_types_active" ON "scratch_card_types" ("is_active");
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_scratch_card_type_prizes_card_type" ON "scratch_card_type_prizes" ("card_type_id");
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_user_scratch_cards_user" ON "user_scratch_cards" ("user_id");
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_user_scratch_cards_completed" ON "user_scratch_cards" ("is_completed");
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_title_tax_reductions_title" ON "title_tax_reductions" ("title_id");
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_title_tax_reductions_active" ON "title_tax_reductions" ("is_active");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('title_tax_reductions');
    await queryRunner.dropTable('user_scratch_cards');
    await queryRunner.dropTable('scratch_card_type_prizes');
    await queryRunner.dropTable('scratch_card_types');
  }
}
