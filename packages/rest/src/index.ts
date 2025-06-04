import type { ValueOf } from 'type-fest'

import type { ApiRouter, ApiRouteResponse, ServerConfig } from '@kivotos/core'
import type { ApiRouteHandlerPayload, ApiRouteSchema } from '@kivotos/core'

import { withPathParams, withQueryParams } from './utils'

export interface CreateRestClientConfig {
  baseUrl: string
}

interface AnyPayload {
  body?: any
  query?: any
  headers?: any
  pathParams?: any
}

async function makeFetch(
  method: string,
  path: string,
  payload: AnyPayload,
  config: CreateRestClientConfig
) {
  const fullPath = withQueryParams(withPathParams(path, payload?.pathParams), payload?.query)
  const response = await fetch(`${config.baseUrl}${fullPath}`, {
    method: method,
    // TODO: Support uploading file and plain text
    headers: { 'Content-Type': 'application/json', ...payload?.headers },
    body: payload.body ? JSON.stringify(payload.body) : null,
  })
  return response.json() as any
}

export function createRestClient<TServerConfig extends ServerConfig<any, any, any, any>>(
  config: CreateRestClientConfig
): RestClient<TServerConfig['endpoints']> {
  return {
    GET: async (path: string, payload: AnyPayload) => {
      return makeFetch('GET', path, payload, config)
    },
    POST: async (path: string, payload: AnyPayload) => {
      return makeFetch('POST', path, payload, config)
    },
    PUT: async (path: string, payload: AnyPayload) => {
      return makeFetch('PUT', path, payload, config)
    },
    DELETE: async (path: string, payload: AnyPayload) => {
      return makeFetch('DELETE', path, payload, config)
    },
    PATCH: async (path: string, payload: AnyPayload) => {
      return makeFetch('PATCH', path, payload, config)
    },
  }
}

export type ExtractClientApiRouterPath<TApiRouter extends ApiRouter<any>> = ValueOf<{
  [TKey in keyof TApiRouter]: TApiRouter[TKey]['schema'] extends {
    path: infer TPath extends string
  }
    ? TPath
    : never
}>

export type RestResponse<TApiRouter extends ApiRouter<any>, TPath extends string> = ValueOf<{
  [TKey in keyof TApiRouter]: TApiRouter[TKey]['schema'] extends { path: TPath }
    ? TApiRouter[TKey]['schema'] extends infer TApiRouteSchema extends ApiRouteSchema
      ? ApiRouteResponse<TApiRouteSchema['responses']>
      : never
    : never
}>

export type RestPayload<TApiRouter extends ApiRouter<any>, TPath extends string> = ValueOf<{
  [TKey in keyof TApiRouter]: TApiRouter[TKey]['schema'] extends { path: TPath }
    ? TApiRouter[TKey]['schema'] extends infer TApiRouteSchema extends ApiRouteSchema
      ? ApiRouteHandlerPayload<TApiRouteSchema>
      : never
    : never
}>

export type RestMethod<TApiRouter extends ApiRouter<any>> = <
  TPath extends ExtractClientApiRouterPath<TApiRouter>,
>(
  path: TPath,
  payload: RestPayload<TApiRouter, TPath>
) => Promise<RestResponse<TApiRouter, TPath>>

export type FilterByMethod<TApiRouter extends ApiRouter<any>, TMethod extends string> = {
  [TKey in keyof TApiRouter as TApiRouter[TKey]['schema'] extends { method: TMethod }
    ? TKey
    : never]: TApiRouter[TKey]
}

export interface RestClient<TApiRouter extends ApiRouter<any>> {
  GET: RestMethod<FilterByMethod<TApiRouter, 'GET'>>
  POST: RestMethod<FilterByMethod<TApiRouter, 'POST'>>
  PUT: RestMethod<FilterByMethod<TApiRouter, 'PUT'>>
  DELETE: RestMethod<FilterByMethod<TApiRouter, 'DELETE'>>
  PATCH: RestMethod<FilterByMethod<TApiRouter, 'PATCH'>>
}
