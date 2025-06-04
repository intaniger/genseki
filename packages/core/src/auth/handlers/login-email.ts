import z from 'zod'

import { type ApiRouteHandler, type ApiRouteSchema, createEndpoint } from '../../endpoint'
import type { AuthConfig } from '..'
import { AccountProvider } from '../constant'
import { type AuthContext } from '../context'
import { setSessionCookie, verifyPassword } from '../utils'

export function loginEmail<const TOptions extends AuthConfig>(options: TOptions) {
  const schema = {
    method: 'POST',
    path: '/api/auth/login-email',
    body: z.object({
      email: z.string(),
      password: z.string(),
    }),
    responses: {
      200: z.object({
        token: z.string().nullable(),
        user: z.object({
          id: z.string(),
          name: z.string(),
          email: z.string(),
          image: z.string().nullable().optional(),
        }),
      }),
    },
  } as const satisfies ApiRouteSchema

  const handler: ApiRouteHandler<AuthContext, typeof schema> = async (args) => {
    const account = await args.context.internalHandlers.account.findByUserEmailAndProvider(
      args.body.email,
      AccountProvider.CREDENTIAL
    )

    const verifyStatus = await verifyPassword(args.body.password, account.password as string)
    if (!verifyStatus) {
      throw new Error('Invalid password')
    }

    const session = await args.context.internalHandlers.session.create({
      userId: account.user.id,
      // TODO: Customize expiresAt
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
    })

    const responseHeaders = {}
    setSessionCookie(responseHeaders, session.token)

    return {
      status: 200,
      headers: responseHeaders,
      body: {
        token: session.token,
        user: account.user,
      },
    }
  }

  return createEndpoint(schema, handler)
}
