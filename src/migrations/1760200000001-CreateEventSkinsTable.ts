import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEventSkinsTable1760200000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE event_skins (
        id SERIAL PRIMARY KEY,
        pet_definition_id INTEGER NOT NULL REFERENCES pet_definitions(id) ON DELETE CASCADE,
        event_name VARCHAR(255) NOT NULL,
        skin_name VARCHAR(255),
        skin_image TEXT NOT NULL,
        description TEXT,
        start_date TIMESTAMP,
        end_date TIMESTAMP,
        is_active BOOLEAN DEFAULT true,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Add index for pet_definition_id
    await queryRunner.query(`
      CREATE INDEX idx_event_skins_pet_definition_id 
      ON event_skins(pet_definition_id);
    `);

    // Add index for active event skins
    await queryRunner.query(`
      CREATE INDEX idx_event_skins_active 
      ON event_skins(is_active, start_date, end_date);
    `);

    // Add comment
    await queryRunner.query(`
      COMMENT ON TABLE event_skins IS 
      'Time-limited event skins for pets (Halloween, Christmas, etc.)';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS event_skins;`);
  }
}
