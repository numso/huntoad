import type { ActionArgs, LoaderArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import {
  Form,
  useFetcher,
  useLoaderData,
  useSearchParams
} from '@remix-run/react'
import cx from 'clsx'
import React from 'react'

import type { Item } from '../utils/db.server'
import * as db from '../utils/db.server'
import { DndContext, useDragger } from '../utils/dnd'
import * as Icons from '../utils/icons'

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
    case 'updateBody': {
      await db.updateBody(body.get('id'), body.get('body'))
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
    case 'moveItem': {
      await db.moveItem(
        body.get('dragId'),
        body.get('dropId'),
        body.get('direction')
      )
      break
    }
    case 'deleteItem': {
      await db.deleteItem(body.get('id'))
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
  for (const item of items) {
    obj[item.id] = item
    buildIdMap(item.children, obj)
  }
}

function findSuitableDroparea (
  x: number,
  y: number
): [Element, string, string] | null {
  const dragZone = document.querySelector('[data-dragging=true]')
  const zones = [...document.querySelectorAll('.dz')].reverse()
  const zone = zones.find(el => y > el.offsetTop)
  if (!zone) return [zones.at(-1), zones.at(-1).dataset.id, 'above']
  if (dragZone.contains(zone)) return null
  if (zone.dataset.collapsed === 'true') return null
  return [
    zone,
    zone.dataset.id,
    window.scrollX + zone.offsetLeft + 50 > x && zone.dataset.childcount === '0'
      ? 'below'
      : 'child'
  ]
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
    <DndContext
      onMove={e => {
        const droparea = findSuitableDroparea(
          window.scrollX + e.clientX,
          window.scrollY + e.clientY
        )
        if (!droparea) {
          const dropzone = document.getElementById('dropzone')
          if (dropzone) dropzone.style.top = '-10px'
          return null
        }
        const [el, id, direction] = droparea
        const dropzone = document.getElementById('dropzone')
        if (dropzone) {
          dropzone.style.top =
            el.offsetTop + (direction === 'above' ? -8 : 25) + 'px'
          dropzone.style.left =
            el.offsetLeft + (direction === 'child' ? 50 : 10) + 'px'
          dropzone.style.width = '400px'
        }
        return [id, direction]
      }}
      onDrop={(e, state, dragItem) => {
        if (!state) return
        const dropzone = document.getElementById('dropzone')
        if (dropzone) dropzone.style.top = '-10px'
        fetcher.submit(
          {
            _action: 'moveItem',
            dragId: dragItem.id,
            dropId: state[0],
            direction: state[1]
          },
          { method: 'post' }
        )
      }}
      onCancel={() => {
        const dropzone = document.getElementById('dropzone')
        if (dropzone) dropzone.style.top = '-10px'
      }}
    >
      <div
        id='dropzone'
        className='absolute -top-3 left-0 h-1 rounded-full bg-gray-500'
      />
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
    </DndContext>
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
        <ListItem key={item.id} item={item} i={i} allItems={allItems} />
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
              className='flex h-5 w-5 items-center justify-center rounded-full hover:bg-gray-300 dark:hover:bg-gray-600'
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
}
function ListItem ({ item, i, allItems }: ListItemProps) {
  const [startDrag, dragItem] = useDragger()
  return (
    <li
      key={item.id}
      data-dragging={item === dragItem}
      className={cx('-ml-6 transition-all', {
        'bg-gray-200 dark:bg-gray-600': item === dragItem
      })}
    >
      <div className='group flex items-center gap-2'>
        <Form method='POST'>
          <input type='hidden' name='_action' value='setCompleted' />
          <input type='hidden' name='id' value={item.id} />
          <input type='hidden' name='completed' value={'' + !item.completed} />
          <button
            type='submit'
            className='flex h-5 w-5 items-center justify-center rounded-full opacity-0 hover:bg-gray-100 dark:hover:bg-gray-600 group-hover:opacity-100'
          >
            {item.completed ? (
              <Icons.Undo className='h-3 w-3' />
            ) : (
              <Icons.Check className='h-3 w-3' />
            )}
          </button>
        </Form>
        <Form method='POST'>
          <input type='hidden' name='_action' value='setCollapsed' />
          <input type='hidden' name='id' value={item.id} />
          <input type='hidden' name='collapsed' value={'' + !item.collapsed} />
          <button
            type='submit'
            className='flex h-5 w-5 items-center justify-center rounded-full opacity-0 hover:bg-gray-100 dark:hover:bg-gray-600  group-hover:opacity-100'
          >
            <Icons.ChevronRight
              className={cx('h-3 w-3 transition-all', {
                'rotate-90': !item.collapsed
              })}
            />
          </button>
        </Form>
        <a
          data-id={item.id}
          data-collapsed={item.collapsed}
          data-childcount={item.children.length}
          href={`/list?id=${item.id}`}
          className={cx(
            'dz flex h-5 w-5 items-center justify-center rounded-full hover:bg-gray-400 dark:hover:bg-gray-600',
            { 'bg-gray-300 dark:bg-gray-500': item.collapsed }
          )}
          onMouseDown={e => {
            e.preventDefault()
            startDrag(item)
          }}
        >
          <div className='h-2 w-2 rounded-full bg-gray-800 dark:bg-white' />
        </a>
        <SuperInput item={item} i={i} allItems={allItems} />
      </div>
      {!item.collapsed && <List items={item.children} allItems={allItems} />}
    </li>
  )
}

interface SuperInputProps {
  item: Item
  i: number
  allItems: ItemMap
}

function SuperInput ({ item, i, allItems }: SuperInputProps) {
  const fetcher = useFetcher()
  function handleKeyDown (e: React.KeyboardEvent<HTMLInputElement>) {
    // indent item
    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault()
      return fetcher.submit(
        { _action: 'indent', id: item.id },
        { method: 'post' }
      )
    }

    // outdent item
    if (e.key === 'Tab' && e.shiftKey) {
      e.preventDefault()
      return fetcher.submit(
        { _action: 'outdent', id: item.id },
        { method: 'post' }
      )
    }

    // mark item as complete / not complete
    if (e.metaKey && e.key === 'Enter') {
      e.preventDefault()
      return fetcher.submit(
        { _action: 'setCompleted', id: item.id, completed: !item.completed },
        { method: 'post' }
      )
    }

    // enter note mode
    if (e.shiftKey && e.key === 'Enter') {
      e.preventDefault()
      document.getElementById(`body-${item.id}`)?.focus()
      return
    }

    // create new item
    if (e.key === 'Enter') {
      e.preventDefault()
      const title = e.target.value.slice(e.target.selectionStart)
      if(item.title === '' && item.body === '') {
        return fetcher.submit(
          { _action: 'outdent', id: item.id },
          { method: 'post' }
        )
      }
      return fetcher.submit(
        {
          _action: 'addItem',
          id: item.parentId,
          position: i,
          title
        },
        { method: 'post' }
      )
    }

    // delete item
    if (e.key === 'Backspace') {
      if (e.target.selectionStart === 0) {
        return fetcher.submit(
          { _action: 'deleteItem', id: item.id },
          { method: 'post' }
        )
      }
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

  function handleBodyKeyDown (e: React.KeyboardEvent<HTMLInputElement>) {
    // mark item as complete / not complete
    if (e.metaKey && e.key === 'Enter') {
      e.preventDefault()
      return fetcher.submit(
        { _action: 'setCompleted', id: item.id, completed: !item.completed },
        { method: 'post' }
      )
    }

    // exit note mode
    if (e.shiftKey && e.key === 'Enter') {
      e.preventDefault()
      document.getElementById(`item-${item.id}`)?.focus()
    }

    // exit note mode
    if (e.key === 'Backspace' && e.target.value === '') {
      e.preventDefault()
      document.getElementById(`item-${item.id}`)?.focus()
    }

    // move cursor up
    if (
      (e.key === 'ArrowUp' || e.key === 'ArrowLeft') &&
      e.target.selectionStart === 0
    ) {
      e.preventDefault()
      const elem = document.getElementById(`item-${item.id}`)
      elem?.focus()
      if (e.key === 'ArrowLeft') {
        const maxLength = elem?.value.length
        elem?.setSelectionRange(maxLength, maxLength)
      }
    }

    // move cursor down
    if (
      (e.key === 'ArrowDown' || e.key === 'ArrowRight') &&
      e.target.selectionStart === e.target.value.length
    ) {
      const nextItem = getNextItem(item, allItems, true)
      if (nextItem) {
        e.preventDefault()
        document.getElementById(`item-${nextItem.id}`)?.focus()
      }
    }
  }
  return (
    <div className='flex-1'>
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
        className={cx('w-full bg-transparent py-1 outline-none', {
          'text-gray-400 line-through': item.completed
        })}
        name='title'
        defaultValue={item.title}
      />
      <input
        id={`body-${item.id}`}
        onKeyDown={handleBodyKeyDown}
        onChange={e => {
          fetcher.submit(
            { _action: 'updateBody', id: item.id, body: e.target.value },
            { method: 'post' }
          )
        }}
        type='text'
        className={cx(
          'bg-transparent text-xs text-gray-400 outline-none focus:not-sr-only focus:w-full',
          { 'sr-only': !item.body, 'w-full': item.body }
        )}
        defaultValue={item.body}
      />
    </div>
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
