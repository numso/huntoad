import type { ActionArgs, LoaderArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import {
  Form,
  useFetcher,
  useLoaderData,
  useSearchParams
} from '@remix-run/react'
import cx from 'clsx'
import * as React from 'react'

import type { Item } from '../utils/db.server'
import * as db from '../utils/db.server'

interface Breadcrumb {
  id: string
  label: string
}

function getBreadcrumbs (items: Item[], id: string | null): Breadcrumb[] {
  const item = items.find(item => item.id == id)
  if (!item) return []
  return [
    ...getBreadcrumbs(items, item.parentId),
    { id: item.id, label: item.title }
  ]
}

function populateChildren (items: Item[], allItems: Item[]): Item[] {
  return items.map(item => {
    item.children = allItems.filter(i => i.parentId == item.id)
    item.children = populateChildren(item.children, allItems)
    return item
  })
}

export async function loader ({ request }: LoaderArgs) {
  const url = new URL(request.url)
  const id = url.searchParams.get('id')
  const items = await db.loadItems()

  return json({
    items: populateChildren(
      items.filter(item => item.parentId == id),
      items
    ),
    breadcrumbs: getBreadcrumbs(items, id)
  })
}

export async function action ({ context, params, request }: ActionArgs) {
  const body = await request.formData()
  const url = new URL(request.url)

  switch (body.get('_action')) {
    case 'updateTitle': {
      await db.updateTitle(body.get('id'), body.get('title'))
      break
    }
    case 'addItem': {
      await db.addItem(
        body.get('id') || undefined,
        +body.get('position'),
        body.get('title')
      )
      break
    }
    case 'share': {
      const id = url.searchParams.get('id')
      const steris = await db.convertToSteris(id)
      return json({ steris })
    }
    case 'setCompleted': {
      await db.setCompleted(body.get('id'), body.get('completed') === 'true')
      break
    }
    case 'setCollapsed': {
      await db.setCollapsed(body.get('id'), body.get('collapsed') === 'true')
      break
    }
    case 'indent': {
      await db.indent(body.get('id'))
      break
    }
    case 'outdent': {
      const id = url.searchParams.get('id')
      await db.outdent(body.get('id'), id)
      break
    }
  }

  return null
}

interface ItemMap {
  [key: string]: Item
}

function buildIdMap (items: Item[], obj: ItemMap) {
  for (let item of items) {
    obj[item.id] = item
    buildIdMap(item.children, obj)
  }
}

export default function Index () {
  const [searchParams] = useSearchParams()
  const { items, breadcrumbs } = useLoaderData<typeof loader>()
  const fetcher = useFetcher()

  const allItems: ItemMap = {}
  allItems[searchParams.get('id') || 'ROOT'] = { children: items }
  buildIdMap(items, allItems)

  React.useEffect(() => {
    if (!fetcher.data) return
    navigator.clipboard.writeText(fetcher.data.steris)
    // send toast
  }, [fetcher.data])

  return (
    <div className='p-4'>
      {!!breadcrumbs.length && (
        <ul className='group flex pb-4'>
          <li>
            <a className='hover:text-blue-500' href='/list'>
              @
            </a>
          </li>
          {breadcrumbs.map(crumb => (
            <React.Fragment key={crumb.id}>
              <li className='px-4 text-gray-300'>/</li>
              <li>
                <a
                  className='hover:text-blue-500'
                  href={`/list?id=${crumb.id}`}
                >
                  {crumb.label}
                </a>
              </li>
            </React.Fragment>
          ))}
          <li className='ml-10'>
            <button
              className='rounded-md bg-blue-700 px-2 text-sm text-white opacity-0 transition-all hover:bg-blue-800 active:bg-blue-900 group-hover:opacity-100'
              onClick={() =>
                fetcher.submit({ _action: 'share' }, { method: 'post' })
              }
            >
              share
            </button>
          </li>
        </ul>
      )}
      <List
        items={items}
        allItems={allItems}
        root
        rootId={searchParams.get('id') || ''}
      />
    </div>
  )
}

interface ListProps {
  items: Item[]
  allItems: ItemMap
  root?: boolean
  rootId?: string
}

function List ({ items, root, rootId, allItems }: ListProps) {
  return (
    <ul className={cx('ml-16', { 'border-l': !root })}>
      {items.map((item, i) => (
        <li key={item.id} className='-ml-6'>
          <div className='group flex items-center gap-2'>
            <Form method='POST'>
              <input type='hidden' name='_action' value='setCompleted' />
              <input type='hidden' name='id' value={item.id} />
              <input
                type='hidden'
                name='completed'
                value={'' + !item.completed}
              />
              <button
                type='submit'
                className='flex h-5 w-5 items-center justify-center rounded-full opacity-0 hover:bg-gray-300 group-hover:opacity-100'
              >
                {item.completed ? 'o' : 'x'}
              </button>
            </Form>
            <Form method='POST'>
              <input type='hidden' name='_action' value='setCollapsed' />
              <input type='hidden' name='id' value={item.id} />
              <input
                type='hidden'
                name='collapsed'
                value={'' + !item.collapsed}
              />
              <button
                type='submit'
                className='flex h-5 w-5 items-center justify-center rounded-full opacity-0 hover:bg-gray-300 group-hover:opacity-100'
              >
                {item.collapsed ? '>' : 'v'}
              </button>
            </Form>
            <a
              href={`/list?id=${item.id}`}
              className={cx(
                'flex h-5 w-5 items-center justify-center rounded-full hover:bg-gray-400',
                { 'bg-gray-300': item.collapsed }
              )}
            >
              <div className='h-2 w-2 rounded-full bg-gray-800' />
            </a>
            <ListItem
              item={item}
              i={i}
              allItems={allItems}
              className='flex-1'
            />
          </div>
          {!item.collapsed && (
            <List items={item.children} allItems={allItems} />
          )}
        </li>
      ))}
      {root && (
        <li className='ml-8 mt-2'>
          <Form method='POST'>
            <input type='hidden' name='_action' value='addItem' />
            <input type='hidden' name='id' value={rootId} />
            <input type='hidden' name='position' value={items.length} />
            <input type='hidden' name='title' value='' />
            <button
              type='submit'
              className='flex h-5 w-5 items-center justify-center rounded-full hover:bg-gray-300'
            >
              +
            </button>
          </Form>
        </li>
      )}
    </ul>
  )
}

interface ListItemProps {
  item: Item
  i: number
  allItems: ItemMap
  className: string
}

function ListItem ({ item, i, allItems, className }: ListItemProps) {
  const fetcher = useFetcher()
  function handleKeyDown (e: React.KeyboardEvent<HTMLInputElement>) {
    // indent item
    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault()
      fetcher.submit({ _action: 'indent', id: item.id }, { method: 'post' })
    }

    // outdent item
    if (e.key === 'Tab' && e.shiftKey) {
      e.preventDefault()
      fetcher.submit({ _action: 'outdent', id: item.id }, { method: 'post' })
    }

    // mark item as complete / not complete
    if (e.metaKey && e.key === 'Enter') {
      e.preventDefault()
      fetcher.submit(
        { _action: 'setCompleted', id: item.id, completed: !item.completed },
        { method: 'post' }
      )
    }

    // enter / exit note mode
    if (e.shiftKey && e.key === 'Enter') {
      // e.preventDefault()
    }

    // create new item
    if (e.key === 'Enter') {
      e.preventDefault()
      const title = e.target.value.slice(e.target.selectionStart)
      fetcher.submit(
        {
          _action: 'addItem',
          id: item.parentId,
          position: i + 1,
          title
        },
        { method: 'post' }
      )
    }

    // delete item
    if (e.key === 'Backspace') {
      // if cursor is at position 0, delete this item, append to prev item, focus accordingly
    }

    // move cursor up
    if (
      e.key === 'ArrowUp' ||
      (e.key === 'ArrowLeft' && e.target.selectionStart === 0)
    ) {
      const prevItem = getPrevItem(item, allItems)
      if (prevItem) {
        e.preventDefault()
        const elem = document.getElementById(`item-${prevItem.id}`)
        elem?.focus()
        if (e.key === 'ArrowLeft') {
          const maxLength = elem?.value.length
          elem?.setSelectionRange(maxLength, maxLength)
        }
      }
    }

    // move cursor down
    if (
      e.key === 'ArrowDown' ||
      (e.key === 'ArrowRight' &&
        e.target.selectionStart === e.target.value.length)
    ) {
      const nextItem = getNextItem(item, allItems, true)
      if (nextItem) {
        e.preventDefault()
        document.getElementById(`item-${nextItem.id}`)?.focus()
      }
    }
  }
  return (
    <>
      <input
        id={`item-${item.id}`}
        autoFocus
        onKeyDown={handleKeyDown}
        onChange={e => {
          fetcher.submit(
            { _action: 'updateTitle', id: item.id, title: e.target.value },
            { method: 'post' }
          )
        }}
        type='text'
        className={cx('w-full py-1 outline-none', className, {
          'text-gray-400 line-through': item.completed
        })}
        name='title'
        defaultValue={item.title}
      />
      {!!item.body && <p className='text-xs text-gray-400'>{item.body}</p>}
    </>
  )
}

function getNextItem (item: Item, items: ItemMap, root = false): Item | null {
  if (root && item.children.length && !item.collapsed) return item.children[0]
  if (!item.id) return null
  const parentItem = items[item.parentId || 'ROOT']
  const myIndex = parentItem.children.findIndex(i => i.id == item.id)
  if (parentItem.children[myIndex + 1]) return parentItem.children[myIndex + 1]
  return getNextItem(parentItem, items)
}

function getPrevItem (item: Item, items: ItemMap): Item | null {
  const parentItem = items[item.parentId || 'ROOT']
  const myIndex = parentItem.children.findIndex(i => i.id == item.id)
  if (myIndex === 0) return parentItem.id ? parentItem : null
  const prevSibling = parentItem.children[myIndex - 1]
  return furthestGrandchild(prevSibling)
}

function furthestGrandchild (item: Item): Item {
  if (item.collapsed) return item
  const lastChild = item.children.at(-1)
  return lastChild ? furthestGrandchild(lastChild) : item
}
