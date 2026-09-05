import { BaseSchema } from '@adonisjs/lucid/schema'

/** Remove only the unused legacy GLOBAL role; organization editor is unchanged. */
export default class extends BaseSchema {
  async up() {
    this.defer(async (db) => {
      if (!db.isTransaction) {
        throw new Error('Legacy role reconciliation requires transactional migrations')
      }
      await db.rawQuery("SET LOCAL lock_timeout = '5s'")
      await db.rawQuery("SET LOCAL statement_timeout = '60s'")
      // Prevent assignments/grants racing the check and being silently cascaded.
      await db.rawQuery(
        'LOCK TABLE roles, user_roles, role_permissions IN SHARE ROW EXCLUSIVE MODE'
      )
      await db.rawQuery(`
        DO $$
        DECLARE
          editor_id integer;
        BEGIN
          SELECT id INTO editor_id FROM roles WHERE slug = 'editor';
          IF NOT FOUND THEN RETURN; END IF;

          IF EXISTS (SELECT 1 FROM user_roles WHERE role_id = editor_id)
             OR EXISTS (SELECT 1 FROM role_permissions WHERE role_id = editor_id)
          THEN
            RAISE EXCEPTION 'Legacy editor removal refused: unexpected assignments or permissions';
          END IF;
          IF EXISTS (
            SELECT 1 FROM pg_constraint AS dependency
            LEFT JOIN pg_attribute AS reference_column
              ON reference_column.attrelid = dependency.conrelid
              AND reference_column.attname = 'role_id' AND NOT reference_column.attisdropped
            LEFT JOIN pg_attribute AS identity_column
              ON identity_column.attrelid = dependency.confrelid
              AND identity_column.attname = 'id' AND NOT identity_column.attisdropped
            WHERE dependency.contype = 'f' AND dependency.confrelid = 'roles'::regclass
              AND (
                dependency.conrelid NOT IN ('user_roles'::regclass, 'role_permissions'::regclass)
                OR dependency.conkey IS DISTINCT FROM ARRAY[reference_column.attnum]
                OR dependency.confkey IS DISTINCT FROM ARRAY[identity_column.attnum]
              )
          ) THEN
            RAISE EXCEPTION 'Legacy editor removal refused: unrecognized role references require review';
          END IF;

          DELETE FROM roles WHERE id = editor_id AND slug = 'editor';
        END;
        $$
      `)
    })
  }

  async down() {
    // Do not resurrect a role excluded by ADR-0007 or invent replacement grants.
  }
}
