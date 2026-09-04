import { test } from '@japa/runner'
import type { HttpContext } from '@adonisjs/core/http'

import SessionsController from '#modules/auth/controllers/sessions_controller'
import type SignInService from '#modules/auth/services/sign_in_service'

test.group('Sessions controller', () => {
  test('rethrows unexpected sign-in service failures by identity', async ({ assert }) => {
    const unexpectedFailure = new Error('unexpected sign-in dependency failure')
    const body = { uid: 'valid-shape@example.com', password: 'password123' }
    const signInService = {
      run: async () => {
        throw unexpectedFailure
      },
    } as unknown as SignInService
    const controller = new SessionsController(signInService)
    let badRequestCalled = false
    const ctx = {
      request: {
        body: () => body,
        validateUsing: async (_validator: unknown, options: { data: typeof body }) => options.data,
      },
      response: {
        badRequest: () => {
          badRequestCalled = true
        },
      },
    } as unknown as HttpContext

    let failure: unknown
    try {
      await controller.signIn(ctx)
    } catch (error) {
      failure = error
    }

    assert.strictEqual(failure, unexpectedFailure)
    assert.isFalse(badRequestCalled)
  })
})
