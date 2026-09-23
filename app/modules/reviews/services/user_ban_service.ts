import { inject } from '@adonisjs/core'
import db from '@adonisjs/lucid/services/db'

import BadRequestException from '#exceptions/bad_request_exception'
import NotFoundException from '#exceptions/not_found_exception'
import OrganizationPolicyService from '#modules/organizations/services/organization_policy_service'
import type IReview from '#modules/reviews/interfaces/review_interface'
import UserBanRepository from '#modules/reviews/repositories/user_ban_repository'
import type User from '#modules/users/models/user'

/**
 * Banning and lifting a ban — ADR-0027 §6, Anexo I items 8 and 14.
 *
 * What a ban does is deliberately narrow and matches the contract word for
 * word: the person's reviews leave public areas and the averages. It does not
 * delete them, does not rewrite their status and does not stop the person from
 * using the rest of the product. Anything wider would be a decision the
 * contract does not contain.
 */
@inject()
export default class UserBanService {
  constructor(
    private bans: UserBanRepository,
    private organizationPolicy: OrganizationPolicyService
  ) {}

  async state(tenantId: number, actor: User, userId: number): Promise<IReview.BanState> {
    await this.organizationPolicy.requirePlatformModerator(actor)
    const membership = await this.bans.membership(tenantId, userId)
    if (!membership) throw new NotFoundException('User not found')
    return this.project(userId, membership)
  }

  async history(tenantId: number, actor: User, userId: number): Promise<IReview.BanEvent[]> {
    await this.organizationPolicy.requirePlatformModerator(actor)
    const membership = await this.bans.membership(tenantId, userId)
    if (!membership) throw new NotFoundException('User not found')
    return this.bans.history(tenantId, userId)
  }

  /**
   * Banning an already banned person changes nothing and records nothing.
   *
   * The original author, date and reason are the ones that matter for audit;
   * letting a second click overwrite them would erase who decided and why.
   */
  async ban(
    tenantId: number,
    actor: User,
    userId: number,
    payload: IReview.BanPayload
  ): Promise<IReview.BanState> {
    await this.organizationPolicy.requirePlatformModerator(actor)
    if (actor.id === userId) {
      throw new BadRequestException('Não é possível banir a própria conta')
    }

    return db.transaction(async (client) => {
      const membership = await this.bans.membership(tenantId, userId, client, true)
      if (!membership) throw new NotFoundException('User not found')
      if (membership.banned_at) return this.project(userId, membership)

      const reason = payload.reason.trim()
      await this.bans.setBan(tenantId, userId, actor.id, reason, client)
      await this.bans.recordEvent(
        { tenantId, userId, actorId: actor.id, action: 'banned', reason },
        client
      )

      return this.project(userId, await this.bans.membership(tenantId, userId, client))
    })
  }

  async unban(
    tenantId: number,
    actor: User,
    userId: number,
    payload: IReview.UnbanPayload
  ): Promise<IReview.BanState> {
    await this.organizationPolicy.requirePlatformModerator(actor)

    return db.transaction(async (client) => {
      const membership = await this.bans.membership(tenantId, userId, client, true)
      if (!membership) throw new NotFoundException('User not found')
      if (!membership.banned_at) return this.project(userId, membership)

      await this.bans.clearBan(tenantId, userId, client)
      await this.bans.recordEvent(
        {
          tenantId,
          userId,
          actorId: actor.id,
          action: 'unbanned',
          reason: payload.reason?.trim() || null,
        },
        client
      )

      return this.project(userId, await this.bans.membership(tenantId, userId, client))
    })
  }

  private project(userId: number, membership: Record<string, any>): IReview.BanState {
    return {
      user_id: userId,
      banned: Boolean(membership.banned_at),
      banned_at: membership.banned_at ? new Date(membership.banned_at).toISOString() : null,
      banned_by: membership.banned_by ? Number(membership.banned_by) : null,
      reason: membership.ban_reason ?? null,
    }
  }
}
