import z from 'zod'

import { type ApiRouteHandler, type ApiRouteSchema, createEndpoint } from '../../endpoint'
import { type AuthContext } from '../context'

interface InternalRouteOptions {
  prefix?: string
}

export function forgotPasswordEmail<const TOptions extends InternalRouteOptions>(
  options: TOptions
) {
  const schema = {
    method: 'POST',
    path: '/api/auth/forgot-password',
    body: z.object({
      email: z.string(),
    }),
    responses: {
      200: z.object({
        status: z.string(),
      }),
      400: z.object({
        status: z.string(),
      }),
    },
  } as const satisfies ApiRouteSchema

  const handler: ApiRouteHandler<AuthContext, typeof schema> = async (args) => {
    const authConfig = args.context.get('authConfig')
    if (!authConfig.resetPassword?.enabled) {
      // TODO: Log not enabled
      return {
        status: 400,
        body: { status: 'reset password not enabled' },
      }
    }

    const internalHandlers = args.context.get('internalHandlers')

    const user = await internalHandlers.user.findByEmail(args.body.email)

    const token = ''
    const identifier = `reset-password:${token}`
    await internalHandlers.verification.create({
      identifier,
      value: user.id,
      expiresAt: new Date(
        Date.now() + (authConfig.resetPassword?.expiresInMs ?? 1000 * 60 * 60 * 24)
      ),
    })

    const resetPasswordLink = `${authConfig.resetPassword?.resetPasswordUrl ?? '/auth/reset-password'}?token=${token}`
    // Send email

    return {
      status: 200,
      body: {
        status: 'ok',
      },
    }
  }

  return createEndpoint(schema, handler)
}
