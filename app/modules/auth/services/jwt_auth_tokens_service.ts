import { createHmac, randomBytes, randomUUID } from 'node:crypto'

import { inject } from '@adonisjs/core'
import { errors as authErrors } from '@adonisjs/auth'
import db from '@adonisjs/lucid/services/db'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import { DateTime } from 'luxon'

import UnauthorizedException from '#exceptions/unauthorized_exception'
import RefreshToken from '#modules/auth/models/refresh_token'
import RefreshTokenRepository from '#modules/auth/repositories/refresh_token_repository'
import { isCanonicalRefreshToken, REFRESH_TOKEN_BYTES } from '#modules/auth/utils/refresh_token'
import UsersRepository from '#modules/users/repositories/users_repository'
import {
  API_ACCESS_TOKEN_EXPIRES_IN,
  API_ACCESS_TOKEN_TTL_SECONDS,
  JWT_AUDIENCE,
  JWT_ISSUER,
  REFRESH_TOKEN_TTL_SECONDS,
} from '#shared/jwt/constants'
import JwtService from '#shared/jwt/jwt_service'
import type { JwtContent } from '#shared/jwt/types'
import env from '#start/env'

export type GenerateAuthTokensResponse = {
  access_token: string
  refresh_token: string
  token_type: 'Bearer'
  expires_in: number
  refresh_expires_in: number
}

type RefreshTokenIssueOptions = {
  client?: TransactionClientContract
  rotatedFromId?: number
}

export type StartRefreshChainOptions = {
  expectedPasswordHash: string
}

type RefreshRotationContext<T> = {
  tenantId?: number
  value: T
}

export type RefreshRotationResult<T> = {
  value: T
  auth: GenerateAuthTokensResponse
}

const INVALID_REFRESH_TOKEN_MESSAGE = 'Invalid or expired refresh token'

@inject()
export default class JwtAuthTokensService {
  constructor(
    private jwtService: JwtService,
    private refreshTokenRepository: RefreshTokenRepository,
    private usersRepository: UsersRepository
  ) {}

  /**
   * Starts a renewable credential chain only while the password snapshot that
   * was just verified is still current. The user row is the mutex shared by
   * login, password changes, refresh rotation, logout, and account deletion.
   */
  async startChain(
    payload: JwtContent,
    options: StartRefreshChainOptions
  ): Promise<GenerateAuthTokensResponse> {
    return db.transaction(async (client) => {
      const userId = Number(payload.userId)
      const user = await this.usersRepository.findActiveByIdForUpdate(userId, client)

      if (!user || user.password !== options.expectedPasswordHash) {
        throw new authErrors.E_INVALID_CREDENTIALS('Invalid user credentials')
      }

      const accessToken = await this.generateAccessToken(payload)
      const refreshToken = await this.issueRefreshToken(payload, { client })

      return this.toResponse(accessToken, refreshToken)
    })
  }

  /**
   * Atomically consumes a refresh token and returns a rotated token pair. Only
   * the HMAC of the opaque refresh token is persisted, so a database leak does
   * not expose reusable credentials.
   */
  async refresh(refreshToken: string): Promise<GenerateAuthTokensResponse> {
    const { auth } = await this.rotate(refreshToken, undefined, async (_client, current) => ({
      tenantId: current.tenant_id ?? undefined,
      value: undefined,
    }))

    return auth
  }

  /**
   * Rotates a credential while an authenticated operation resolves its new
   * tenant context in the same transaction. Binding the refresh credential to
   * the bearer identity prevents a stolen access token from opening a new
   * long-lived session chain.
   */
  async rotateForAuthenticatedUser<T>(
    refreshToken: string,
    expectedUserId: number,
    resolveContext: (
      client: TransactionClientContract,
      current: RefreshToken
    ) => Promise<RefreshRotationContext<T>>
  ): Promise<RefreshRotationResult<T>> {
    return this.rotate(refreshToken, expectedUserId, resolveContext)
  }

  private async rotate<T>(
    refreshToken: string,
    expectedUserId: number | undefined,
    resolveContext: (
      client: TransactionClientContract,
      current: RefreshToken
    ) => Promise<RefreshRotationContext<T>>
  ): Promise<RefreshRotationResult<T>> {
    if (!isCanonicalRefreshToken(refreshToken)) {
      throw new UnauthorizedException(INVALID_REFRESH_TOKEN_MESSAGE)
    }

    const tokenHash = this.hashRefreshToken(refreshToken)
    const ownerUserId = await this.refreshTokenRepository.findOwnerByHash(tokenHash)

    if (ownerUserId === null || (expectedUserId !== undefined && ownerUserId !== expectedUserId)) {
      throw new UnauthorizedException(INVALID_REFRESH_TOKEN_MESSAGE)
    }

    return db.transaction(async (client) => {
      const user = await this.usersRepository.findActiveByIdForUpdate(ownerUserId, client)
      if (!user) {
        throw new UnauthorizedException(INVALID_REFRESH_TOKEN_MESSAGE)
      }

      const current = await this.refreshTokenRepository.findByHashAndUserForUpdate(
        tokenHash,
        ownerUserId,
        client
      )
      const now = DateTime.now()

      if (
        !current ||
        current.revoked_at ||
        current.expires_at.toMillis() <= now.toMillis() ||
        (expectedUserId !== undefined && current.user_id !== expectedUserId)
      ) {
        throw new UnauthorizedException(INVALID_REFRESH_TOKEN_MESSAGE)
      }

      const context = await resolveContext(client, current)

      current.useTransaction(client)
      current.revoked_at = now
      await current.save()

      const payload: JwtContent = {
        userId: user.id,
        tenantId: context.tenantId,
      }

      const accessToken = await this.generateAccessToken(payload)
      const rotatedRefreshToken = await this.issueRefreshToken(payload, {
        client,
        rotatedFromId: current.id,
      })

      return {
        value: context.value,
        auth: this.toResponse(accessToken, rotatedRefreshToken),
      }
    })
  }

  async revoke(refreshToken: string): Promise<void> {
    if (!isCanonicalRefreshToken(refreshToken)) {
      return
    }

    const tokenHash = this.hashRefreshToken(refreshToken)
    const ownerUserId = await this.refreshTokenRepository.findOwnerByHash(tokenHash)
    if (ownerUserId === null) {
      return
    }

    await db.transaction(async (client) => {
      const user = await this.usersRepository.findActiveByIdForUpdate(ownerUserId, client)
      if (!user) {
        return
      }

      const current = await this.refreshTokenRepository.findByHashAndUserForUpdate(
        tokenHash,
        ownerUserId,
        client
      )
      if (!current) {
        return
      }

      await this.refreshTokenRepository.revokeChainFrom(current.id, ownerUserId, client)
    })
  }

  private generateAccessToken(payload: JwtContent): Promise<string> {
    return this.jwtService.sign(
      {
        ...payload,
        sub: String(payload.userId),
        token_use: 'access',
      },
      env.get('ACCESS_TOKEN_SECRET', env.get('APP_KEY')),
      {
        expiresIn: API_ACCESS_TOKEN_EXPIRES_IN,
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
        jwtid: randomUUID(),
      }
    )
  }

  private async issueRefreshToken(
    payload: JwtContent,
    options: RefreshTokenIssueOptions = {}
  ): Promise<string> {
    const token = randomBytes(REFRESH_TOKEN_BYTES).toString('base64url')

    await this.refreshTokenRepository.create(
      {
        user_id: Number(payload.userId),
        tenant_id: payload.tenantId ?? null,
        token_hash: this.hashRefreshToken(token),
        expires_at: DateTime.now().plus({ seconds: REFRESH_TOKEN_TTL_SECONDS }),
        revoked_at: null,
        rotated_from_id: options.rotatedFromId ?? null,
      },
      options.client ? { client: options.client } : undefined
    )

    return token
  }

  private hashRefreshToken(token: string): string {
    return createHmac('sha256', env.get('REFRESH_TOKEN_SECRET', env.get('APP_KEY')))
      .update(token)
      .digest('hex')
  }

  private toResponse(accessToken: string, refreshToken: string): GenerateAuthTokensResponse {
    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'Bearer',
      expires_in: API_ACCESS_TOKEN_TTL_SECONDS,
      refresh_expires_in: REFRESH_TOKEN_TTL_SECONDS,
    }
  }
}
