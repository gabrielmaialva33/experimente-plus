import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Partner content the Explorer favourites — ADR-0030, Anexo I item 10
 * ("favoritar estabelecimentos e conteúdos previstos no aplicativo").
 *
 * A table of its own rather than a wider `explorer_favorites`. That table
 * points at establishments with a real foreign key, and turning its target into
 * "establishment or experience or event" would either drop the key — the
 * polymorphic reference ADR-0030 rejected, where the database stops knowing
 * what a row points at — or push nullable columns and a species check into a
 * table whose rows are, today, all the same thing.
 *
 * Here each species has its own nullable column with its own composite key to
 * the content table, and exactly one is set: the shape `partner_content_media`
 * already uses for the same three tables. Showcase items are deliberately not
 * a column. A showcase item is a displayed product with an informational
 * price, and favouriting it is a wishlist — the first step of the cart and
 * checkout the contract places outside the delivery (Anexo I item 16).
 */
export default class extends BaseSchema {
  protected tableName = 'explorer_content_favorites'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('tenant_id').unsigned().notNullable()
      table.integer('user_id').unsigned().notNullable()
      table.integer('experience_id').unsigned().nullable()
      table.integer('event_id').unsigned().nullable()
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(this.now())
      table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(this.now())

      table.unique(['id', 'tenant_id'], 'explorer_content_favorites_id_tenant_unique')
      // NULLs are distinct in a PostgreSQL unique constraint, so each key only
      // constrains the rows of its own species. Favouriting twice is one row.
      table.unique(
        ['tenant_id', 'user_id', 'experience_id'],
        'explorer_content_favorites_experience_unique'
      )
      table.unique(['tenant_id', 'user_id', 'event_id'], 'explorer_content_favorites_event_unique')

      table
        .foreign('tenant_id', 'explorer_content_favorites_tenant_foreign')
        .references('id')
        .inTable('tenants')
        .onDelete('CASCADE')
      table
        .foreign(['user_id', 'tenant_id'], 'explorer_content_favorites_user_tenant_foreign')
        .references(['user_id', 'tenant_id'])
        .inTable('user_tenants')
        .onDelete('CASCADE')
      table
        .foreign(['experience_id', 'tenant_id'], 'explorer_content_favorites_experience_foreign')
        .references(['id', 'tenant_id'])
        .inTable('establishment_experiences')
        .onDelete('RESTRICT')
      table
        .foreign(['event_id', 'tenant_id'], 'explorer_content_favorites_event_foreign')
        .references(['id', 'tenant_id'])
        .inTable('establishment_events')
        .onDelete('RESTRICT')

      table.index(['tenant_id', 'user_id', 'created_at'], 'explorer_content_favorites_owner_index')
      table.check(
        'num_nonnulls(experience_id, event_id) = 1',
        [],
        'explorer_content_favorites_one_target_check'
      )
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
