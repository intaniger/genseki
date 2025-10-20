'use client'

import { Banner } from './banner'
import { CollectionListTableContainer } from './container'
import { useCollectionList } from './context'
import { CollectionListTable } from './table'
import { CollectionListPagination } from './table/pagination'
import { CollectionListToolbar } from './toolbar'

import { useNavigation } from '../../../providers'

export function DefaultCollectionListPage() {
  const context = useCollectionList()
  const { navigate } = useNavigation()

  return (
    <>
      <Banner
        slug={context.slug}
        title={context.banner?.title}
        description={context.banner?.description}
      />
      <CollectionListTableContainer>
        <CollectionListToolbar />
        <CollectionListTable<any>
          columns={context.columns}
          onRowClick={(r) => navigate(`./${context.slug}/${r.original.__id}`)}
        />
        <CollectionListPagination />
      </CollectionListTableContainer>
    </>
  )
}
