import type { LoaderFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { Link, useLoaderData, useSearchParams } from '@remix-run/react'
import cx from 'clsx'
import React from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import * as Icons from '~/components/icons'
import { useShortcut } from '~/components/shortcuts'
import * as db from '~/utils/db.server'
import type { Item } from '~/utils/types'

interface ItemsMap {
  [key: string]: Item[]
}

function keyByParentId (items: Item[]): ItemsMap {
  const itemMap: ItemsMap = {}
  for (let item of items) {
    itemMap[item.parentId || 'ROOT'] = itemMap[item.parentId || 'ROOT'] || []
    itemMap[item.parentId || 'ROOT'].push(item)
  }
  return itemMap
}

function populateChildren (items: Item[]): Item[] {
  const itemMap = keyByParentId(items)
  return items.map(item => {
    item.children = itemMap[item.id] || []
    return item
  })
}

function flattenItems (items: Item[]): Item[] {
  return items.flatMap(item => [{ ...item, children: [] }, ...flattenItems(item.children)])
}

export async function loader ({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url)
  const id = url.searchParams.get('id')
  const allItems = await db.loadItems()
  const populated = populateChildren(allItems)
  const self = populated.find(item => item.id == id)
  const siblings = populated
    .filter(item => item.parentId == self.parentId)
    .map(item => {
      return {
        id: item.id,
        title: item.title.replaceAll(/#[\S]+/g, ''),
        completed: item.completed,
        body: item.body,
        bg: item.tags.length == 1 ? `#${item.tags[0]}` : 'white'
      }
    })
  const items = populated.filter(item => item.parentId == id)
  const flattenedItems = flattenItems(items)
  return json({
    items: flattenedItems,
    breadcrumbs: siblings
  })
}

export default function Index () {
  const [searchParams, setSearchParams] = useSearchParams()
  const { items: updatedItems, breadcrumbs } = useLoaderData<typeof loader>()
  const id = searchParams.get('id')
  const me = breadcrumbs.find(crumb => crumb.id === id)
  const idRef = React.useRef(id)
  idRef.current = id
  const populated = populateChildren(updatedItems)
  const items = populated.filter(item => item.parentId == id)
  const bg = me.bg

  useShortcut('ArrowLeft', () => {
    const i = breadcrumbs.findIndex(crumb => crumb.id === idRef.current)
    if (i > 0) setSearchParams({ id: breadcrumbs[i - 1].id })
  })
  useShortcut('ArrowRight', () => {
    const i = breadcrumbs.findIndex(crumb => crumb.id === idRef.current)
    if (i < breadcrumbs.length - 1) setSearchParams({ id: breadcrumbs[i + 1].id })
  })

  return (
    <div className='min-h-screen p-4' style={{ background: bg }}>
      <h1 className='group flex items-center gap-4 pb-4'>
        <Link to='/' className='hover:text-blue-500'>
          <Icons.HomeModern className='h-8 w-8' />
        </Link>
        <Icons.ChevronRight className='h-4 w-4' />
        <ul className='flex items-center'>
          {breadcrumbs.map((crumb, i) => (
            <React.Fragment key={crumb.id}>
              {i !== 0 && <li className='px-2 text-gray-300'>/</li>}
              <li>
                <a
                  className={cx('flex items-center gap-2 rounded px-2 py-0.5 hover:bg-blue-100', {
                    'text-gray-400': !crumb.title || crumb.completed,
                    'italic ': !crumb.title,
                    'line-through': crumb.completed,
                    'text-blue-500': crumb.id === id
                  })}
                  href={`/slides?id=${crumb.id}`}
                >
                  {crumb.title || 'unnamed'}
                </a>
              </li>
            </React.Fragment>
          ))}
        </ul>
      </h1>

      {me.body ? (
        <Markdown remarkPlugins={[remarkGfm]} className='prose mx-auto max-w-3xl pb-48 pt-4'>
          {me.body}
        </Markdown>
      ) : (
        <div className='mx-auto max-w-3xl pb-48 pt-4'>
          <List items={items} />
        </div>
      )}
    </div>
  )
}

interface ListProps {
  items: Item[]
}

function List ({ items }: ListProps) {
  return (
    <ul className='mx-10'>
      {items.map(item => (
        <ListItem key={item.id} item={item} />
      ))}
    </ul>
  )
}

interface ListItemProps {
  item: Item
}

function ListItem ({ item }: ListItemProps) {
  return (
    <li key={item.id} className={cx({ 'hidden ': item.deleted })}>
      <div className='group flex gap-2'>
        <div className='mt-1.5 flex h-5 w-5 items-center justify-center rounded-full'>
          <div className='h-2 w-2 rounded-full bg-gray-800 dark:bg-white' />
        </div>
        <SuperInput item={item} />
      </div>
      <List items={item.children} />
    </li>
  )
}

interface SuperInputProps {
  item: Item
}

function SuperInput ({ item }: SuperInputProps) {
  return (
    <div className='relative flex-1'>
      <FrozenDiv
        value={item.title}
        id={`item-${item.id}`}
        className={cx('bg-transparent py-1 outline-none [overflow-wrap:anywhere]', {
          'text-gray-400 line-through': item.completed
        })}
      />
      <FrozenDiv
        value={item.body}
        id={`body-${item.id}`}
        className={cx(
          'bg-transparent text-xs text-gray-400 outline-none [overflow-wrap:anywhere] focus:not-sr-only focus:w-full',
          { 'sr-only': !item.body }
        )}
      />
    </div>
  )
}

function FrozenDiv ({ value, ...props }) {
  const valueRef = React.useRef({ __html: value })
  const ref = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    ref.current.innerHTML = value
  }, [value])
  return <div dangerouslySetInnerHTML={valueRef.current} ref={ref} {...props} />
}
