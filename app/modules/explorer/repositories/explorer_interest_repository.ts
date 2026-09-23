import db from '@adonisjs/lucid/services/db'

import type IExplorer from '#modules/explorer/interfaces/explorer_interface'
import { instant } from '#modules/explorer/repositories/explorer_cards'

/**
 * Discovery interests — ADR-0030.
 *
 * An interest points at a category of the operation itself. Choosing interests
 * is a set operation, so the write replaces the whole set rather than accepting
 * one addition at a time: the screen shows every category with a checkmark, and
 * modelling that as a stream of individual toggles invents an order the person
 * never expressed.
 */
export default class ExplorerInterestRepository {
  async list(tenantId: number, userId: number): Promise<IExplorer.InterestProjection[]> {
    const rows = await db
      .from('explorer_interests as interest')
      .join('categories as category', (join) => {
        join
          .on('category.id', 'interest.category_id')
          .andOn('category.tenant_id', 'interest.tenant_id')
      })
      .where('interest.tenant_id', tenantId)
      .where('interest.user_id', userId)
      .orderBy('category.sort_order', 'asc')
      .orderBy('category.name', 'asc')
      .select(
        'interest.id',
        'interest.created_at',
        'category.slug as category_slug',
        'category.name as category_name',
        'category.is_active as category_is_active'
      )

    return rows.map((row) => ({
      id: Number(row.id),
      category: {
        slug: row.category_slug,
        name: row.category_name,
        is_active: Boolean(row.category_is_active),
      },
      created_at: instant(row.created_at),
    }))
  }

  /**
   * Resolves slugs to this operation's categories.
   *
   * Slug is unique per tenant, so a slug of another operation simply does not
   * resolve here — it is a miss, not a category someone else owns.
   */
  async categoryIdsForSlugs(tenantId: number, slugs: string[]): Promise<Map<string, number>> {
    if (slugs.length === 0) return new Map()
    const rows = await db
      .from('categories')
      .where('tenant_id', tenantId)
      .whereIn('slug', slugs)
      .select('id', 'slug')

    return new Map(rows.map((row) => [String(row.slug), Number(row.id)]))
  }

  /**
   * Replaces the whole set in one transaction.
   *
   * A category that was deactivated after the person chose it stays chosen: the
   * preference was theirs and the deactivation is the operation's, so dropping
   * it here would quietly rewrite someone's profile because of an unrelated
   * administrative act. It is simply not offered again.
   */
  async replace(tenantId: number, userId: number, categoryIds: number[]): Promise<void> {
    await db.transaction(async (client) => {
      await client
        .from('explorer_interests')
        .where('tenant_id', tenantId)
        .where('user_id', userId)
        .whereNotIn('category_id', categoryIds.length > 0 ? categoryIds : [-1])
        .delete()

      if (categoryIds.length === 0) return

      const values = categoryIds.map((categoryId) => ({
        tenant_id: tenantId,
        user_id: userId,
        category_id: categoryId,
        created_at: new Date(),
        updated_at: new Date(),
      }))

      await client
        .table('explorer_interests')
        .multiInsert(values)
        .onConflict(['tenant_id', 'user_id', 'category_id'])
        .ignore()
    })
  }

  async purgeForUser(userId: number, client: any): Promise<void> {
    await client.from('explorer_interests').where('user_id', userId).delete()
  }
}
