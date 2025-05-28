import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import * as R from 'remeda'
import type { Simplify } from 'type-fest'

import {
  type AuthClient,
  type AuthConfig,
  type AuthHandlers,
  createAuth,
  getAuthClient,
} from './auth'
import {
  type ClientCollection,
  type Collection,
  type ExtractAllCollectionCustomEndpoints,
  type ExtractAllCollectionDefaultEndpoints,
  getAllCollectionEndpoints,
  type ToClientCollection,
  type ToClientCollectionList,
} from './collection'
import { Context } from './context'
import {
  type ApiRoute,
  type ApiRouter,
  type ClientApiRouter,
  getClientEndpoint,
  type ToClientApiRouteSchema,
  type ToRecordApiRouteSchema,
} from './endpoint'
import type { Field, FieldClient, Fields, FieldsClient } from './field'
import type { KivotosPlugin, MergePlugins } from './plugins'
import { isRelationField } from './utils'

export type MinimalContext<
  TFullSchema extends Record<string, unknown> = Record<string, unknown>,
  TContext extends Record<string, unknown> = Record<string, unknown>,
> = Simplify<
  TContext & {
    db: NodePgDatabase<TFullSchema>
  }
>

export interface BaseConfigOptions<
  TFullSchema extends Record<string, unknown> = Record<string, unknown>,
  TContext extends Record<string, unknown> = Record<string, unknown>,
> {
  db: NodePgDatabase<TFullSchema>
  schema: TFullSchema
  context?: TContext
  auth: AuthConfig
}

export interface BaseConfig<
  TFullSchema extends Record<string, unknown> = Record<string, unknown>,
  TContext extends MinimalContext<TFullSchema> = MinimalContext<TFullSchema>,
> extends BaseConfigOptions<TFullSchema> {
  context: TContext
}

export interface ServerConfig<
  TFullSchema extends Record<string, unknown> = Record<string, unknown>,
  TContext extends MinimalContext<TFullSchema> = MinimalContext<TFullSchema>,
  TCollections extends Record<string, Collection<any, any, any, any, any, any>> = Record<
    string,
    Collection<any, any, any, any, any, any>
  >,
  TApiRouter extends ApiRouter<TContext> = AuthHandlers & ApiRouter<any>,
> extends Omit<BaseConfig<TFullSchema, TContext>, 'context'> {
  context: Context<TFullSchema, TContext>
  collections: TCollections
  endpoints: TApiRouter
}

export type InferApiRouterFromServerConfig<TServerConfig extends ServerConfig<any, any, any, any>> =
  TServerConfig extends ServerConfig<any, any, any, infer TApiRouter>
    ? TApiRouter extends ApiRouter<any>
      ? TApiRouter
      : never
    : never

export function defineBaseConfig<
  TFullSchema extends Record<string, unknown> = Record<string, unknown>,
  TContext extends Record<string, unknown> = Record<string, unknown>,
>(
  config: BaseConfigOptions<TFullSchema, TContext>
): BaseConfig<TFullSchema, MinimalContext<TFullSchema, TContext>> {
  const context = {
    ...config.context,
    db: config.db,
  } as MinimalContext<TFullSchema, TContext>

  return {
    ...config,
    context,
  }
}

export function defineServerConfig<
  TFullSchema extends Record<string, unknown> = Record<string, unknown>,
  TContext extends MinimalContext<TFullSchema> = MinimalContext<TFullSchema>,
  const TCollections extends Record<string, Collection<any, any, any, any, any, any>> = Record<
    string,
    Collection<any, any, any, any, any, any>
  >,
  const TEndpoints extends ApiRouter<MinimalContext<TFullSchema, TContext>> = {},
  const TPlugins extends KivotosPlugin<any>[] = [],
>(
  baseConfig: BaseConfig<TFullSchema, TContext>,
  config: { collections: TCollections; endpoints?: TEndpoints; plugins?: TPlugins }
) {
  const auth = createAuth(baseConfig.auth, baseConfig.context)
  const collectionEndpoints = getAllCollectionEndpoints(config.collections)

  const context = new Context<TFullSchema, TContext>(
    baseConfig.db,
    baseConfig.context,
    auth.authContext
  )

  let serverConfig = {
    ...baseConfig,
    collections: config.collections,
    context,
    endpoints: {
      ...config.endpoints,
      ...auth.handlers,
      ...collectionEndpoints,
    } as TEndpoints &
      typeof auth.handlers &
      ExtractAllCollectionCustomEndpoints<TCollections> &
      ExtractAllCollectionDefaultEndpoints<TCollections>,
  } satisfies ServerConfig<
    TFullSchema,
    MinimalContext<TFullSchema, TContext>,
    TCollections,
    TEndpoints &
      typeof auth.handlers &
      ExtractAllCollectionCustomEndpoints<TCollections> &
      ExtractAllCollectionDefaultEndpoints<TCollections>
  >

  for (const plugin of config.plugins ?? []) {
    serverConfig = plugin(serverConfig)
  }

  return serverConfig as MergePlugins<typeof serverConfig, TPlugins>
}

export interface ClientConfig<
  TCollections extends Record<string, ClientCollection<any, any, any, any, any, any>> = Record<
    string,
    ClientCollection<any, any, any, any, any, any>
  >,
  TApiRouter extends ClientApiRouter = ClientApiRouter,
> {
  auth: AuthClient
  collections: TCollections
  endpoints: TApiRouter
}

export function getFieldClient(name: string, field: Field): FieldClient & { fieldName: string } {
  if (isRelationField(field)) {
    if (field._.source === 'relation') {
      const sanitizedFields = Object.fromEntries(
        Object.entries(field.fields).map(([key, value]) => {
          return [key, getFieldClient(key, value)]
        })
      )

      return R.omit(
        {
          ...field,
          fields: sanitizedFields,
        },
        ['_', 'options' as any]
      ) as FieldClient & { fieldName: string }
    }

    return R.omit(
      {
        ...field,
        label: field.label ?? name,
        placeholder: field.placeholder ?? name,
      },
      ['_', 'options' as any]
    ) as FieldClient & { fieldName: string }
  }

  return R.omit(
    {
      ...field,
      label: field.label ?? name,
      placeholder: field.placeholder ?? name,
    },
    ['_', 'options' as any]
  ) as FieldClient & { fieldName: string }
}

export function getFieldsClient(fields: Fields<any>): FieldsClient {
  return R.mapValues(fields, (value, key) => getFieldClient(key, value))
}

export function getClientCollection<
  const TCollection extends Collection<any, any, any, any, any, any>,
>(collection: TCollection): ToClientCollection<TCollection> {
  return R.pipe(collection, R.omit(['_', 'admin']), (collection) => ({
    ...collection,
    fields: getFieldsClient(collection.fields),
  })) as unknown as ToClientCollection<TCollection>
}

export function getClientConfig<
  TCollections extends Record<string, Collection<any, any, any, any, any, any>>,
  TApiRouter extends ApiRouter<any>,
>(
  serverConfig: ServerConfig<any, any, TCollections, TApiRouter>
): ClientConfig<ToClientCollectionList<TCollections>, ToClientApiRouteSchema<TApiRouter>> & {
  $types: ToRecordApiRouteSchema<TApiRouter>
} {
  const collections = serverConfig.collections

  const clientEndpoints = R.mapValues(serverConfig.endpoints, (value) =>
    getClientEndpoint(value as ApiRoute<any>)
  ) as ToClientApiRouteSchema<TApiRouter>

  return {
    auth: getAuthClient(serverConfig.auth),
    collections: R.mapValues(collections, (s) =>
      getClientCollection(s as Collection<any, any, any, any, any, any>)
    ) as ToClientCollectionList<TCollections>,
    endpoints: clientEndpoints,
    $types: undefined as any,
  }
}
