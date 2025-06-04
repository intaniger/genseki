'use client'

import { UIPlayground } from '@kivotos/next'

import { queryClient } from '../../../../drizzlify/client'

interface PlaygroundPageProps {
  params: Promise<{ segments: string[] }>
  searchParams: Promise<{ [key: string]: string | string[] }>
}

export default function Playground(props: PlaygroundPageProps) {
  const result = queryClient.useQuery('GET', '/api/hello2', {})
  console.log(result.data)
  return <UIPlayground />
}
