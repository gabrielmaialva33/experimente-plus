import { test } from '@japa/runner'

import IRole from '#modules/roles/interfaces/role_interface'

test.group('Canonical platform role hierarchy', () => {
  test('uses only the product platform roles from ADR-0007', ({ assert }) => {
    assert.sameMembers(
      [...IRole.CANONICAL_SLUGS],
      [
        IRole.Slugs.ROOT,
        IRole.Slugs.ADMIN,
        IRole.Slugs.MODERATOR,
        IRole.Slugs.USER,
        IRole.Slugs.GUEST,
      ]
    )
    assert.isTrue(IRole.dominates(IRole.Slugs.ADMIN, IRole.Slugs.MODERATOR))
    assert.isTrue(IRole.dominates(IRole.Slugs.MODERATOR, IRole.Slugs.USER))
    assert.isFalse(IRole.isCanonicalSlug('editor'))
  })

  test('recognizes only canonical Root and Admin actors as platform administrators', ({
    assert,
  }) => {
    assert.isTrue(IRole.isPlatformAdministrator([IRole.Slugs.ROOT]))
    assert.isTrue(IRole.isPlatformAdministrator([IRole.Slugs.ADMIN, IRole.Slugs.USER]))
    assert.isFalse(IRole.isPlatformAdministrator([IRole.Slugs.MODERATOR]))
    assert.isFalse(IRole.isPlatformAdministrator([IRole.Slugs.USER]))
    assert.isFalse(IRole.isPlatformAdministrator([IRole.Slugs.GUEST]))
    assert.isFalse(IRole.isPlatformAdministrator([IRole.Slugs.ROOT, 'custom-operator']))
  })

  test('fails closed for custom role slugs', ({ assert }) => {
    assert.isFalse(IRole.isCanonicalSlug('custom-operator'))
    assert.isFalse(IRole.dominates(IRole.Slugs.ROOT, 'custom-operator'))
    assert.isFalse(IRole.dominates('custom-operator', IRole.Slugs.GUEST))
  })
})
