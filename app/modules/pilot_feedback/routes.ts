import router from '@adonisjs/core/services/router'

import IPermission from '#modules/permissions/interfaces/permission_interface'
import { middleware } from '#start/kernel'

const PilotFeedbackController = () =>
  import('#modules/pilot_feedback/controllers/pilot_feedback_controller')

const permission = (action: IPermission.Actions) =>
  middleware.permission({
    permissions: `${IPermission.Resources.PILOT_FEEDBACK}.${action}`,
  })

router
  .post('/api/v1/pilot-feedback', [PilotFeedbackController, 'store'])
  .use(middleware.auth())
  .use(middleware.tenant({ required: true }))
  .use(permission(IPermission.Actions.CREATE))

router
  .get('/api/v1/admin/pilot-feedback', [PilotFeedbackController, 'index'])
  .use(middleware.auth())
  .use(middleware.tenant({ required: true }))
  .use(permission(IPermission.Actions.LIST))

router
  .patch('/api/v1/admin/pilot-feedback/:id', [PilotFeedbackController, 'update'])
  .use(middleware.auth())
  .use(middleware.tenant({ required: true }))
  .use(permission(IPermission.Actions.UPDATE))
