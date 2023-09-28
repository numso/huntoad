import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import type { Fetcher } from '@remix-run/react'
import {
  Form,
  Link,
  useFetcher,
  useFetchers,
  useLoaderData,
  useSearchParams
} from '@remix-run/react'
import cx from 'clsx'
import React from 'react'
import * as uuid from 'uuid'
import { useToast } from '~/components/toasts'

import { DndContext, useDragger } from '../components/dnd'
import { FocusManager, useFocuser } from '../components/focus-manager'
import * as Icons from '../components/icons'
import * as db from '../utils/db.server'
import * as listActions from '../utils/list-actions'
import * as settings from '../utils/settings.server'
import type { Item } from '../utils/types'

interface Breadcrumb {
  id: string
  title: string
  completed: boolean
}

function getBreadcrumbs (items: Item[], id: string | null): Breadcrumb[] {
  const item = items.find(item => item.id == id)
  if (!item) return []
  return [...getBreadcrumbs(items, item.parentId), item]
}

function populateChildren (items: Item[], allItems: Item[]): Item[] {
  return items.map(item => {
    item.children = allItems.filter(i => i.parentId == item.id)
    item.children = populateChildren(item.children, allItems)
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
  const relevantItems = allItems.filter(item => item.parentId == id)
  const items = populateChildren(relevantItems, allItems)
  const flattenedItems = flattenItems(items)
  return json({
    favorited: id ? settings.getFavorite('list', id) : false,
    items: flattenedItems,
    breadcrumbs: getBreadcrumbs(allItems, id)
  })
}

export async function action ({ request }: ActionFunctionArgs) {
  const form = await request.formData()
  const url = new URL(request.url)

  switch (form.get('_action')) {
    case 'updateTitle': {
      const id = form.get('id')
      const title = form.get('title')
      if (typeof id !== 'string' || typeof title !== 'string') return
      await db.updateTitle(id, title)
      break
    }
    case 'updateBody': {
      const id = form.get('id')
      const body = form.get('body')
      if (typeof id !== 'string' || typeof body !== 'string') return
      await db.updateBody(id, body)
      break
    }
    case 'addItem': {
      const id = form.get('id')
      const newId = form.get('newId')
      const position = form.get('position')
      const title = form.get('title')
      if (
        typeof id !== 'string' ||
        typeof position !== 'string' ||
        typeof title !== 'string' ||
        typeof newId !== 'string'
      ) {
        return
      }
      await db.addItem(id, +position, title, newId)
      break
    }
    case 'moveItem': {
      const dragId = form.get('dragId')
      const dropId = form.get('dropId')
      const direction = form.get('direction')
      if (typeof dragId !== 'string' || typeof dropId !== 'string' || typeof direction !== 'string')
        return
      await db.moveItem(dragId, dropId, direction)
      break
    }
    case 'deleteItem': {
      const id = form.get('id')
      if (typeof id !== 'string') return
      await db.deleteItem(id)
      break
    }
    case 'export': {
      const id = url.searchParams.get('id') || ''
      const steris = await db.exportToSteris(id)
      return json({ steris })
    }
    case 'import': {
      const id = url.searchParams.get('id') as string
      const data = form.get('data')
      if (typeof id !== 'string' || typeof data !== 'string') return
      await db.importFromSteris(id, data)
      break
    }
    case 'setCompleted': {
      const id = form.get('id')
      if (typeof id !== 'string') return
      await db.setCompleted(id, form.get('completed') === 'true')
      break
    }
    case 'setCollapsed': {
      const id = form.get('id')
      if (typeof id !== 'string') return
      await db.setCollapsed(id, form.get('collapsed') === 'true')
      break
    }
    case 'indent': {
      const id = form.get('id')
      if (typeof id !== 'string') return
      await db.indent(id)
      break
    }
    case 'outdent': {
      const id = form.get('id')
      if (typeof id !== 'string') return
      const parentId = url.searchParams.get('id')
      await db.outdent(id, parentId)
      break
    }
    case 'toggleFavorite': {
      const id = url.searchParams.get('id')
      if (id) settings.toggleFavorite('list', id)
      break
    }
    default: {
      throw new Error('unknown action')
    }
  }

  return null
}

interface ItemIsh {
  id?: string
  parentId?: string | null
  collapsed?: boolean
  children: ItemIsh[]
}

interface ItemMap {
  [key: string]: ItemIsh
}

function buildIdMap (items: Item[], obj: ItemMap) {
  for (const item of items) {
    obj[item.id] = item
    buildIdMap(item.children, obj)
  }
}

function findSuitableDroparea (x: number, y: number): [HTMLAnchorElement, string, string] | null {
  const dragZone = document.querySelector('[data-dragging=true]')
  if (!dragZone) return null
  const zones = [...document.querySelectorAll<HTMLAnchorElement>('.dz')].reverse()
  let zone = zones.find(el => y > el.offsetTop)
  if (!zone) {
    zone = zones.at(-1)
    if (!zone) return null
    return [zone, zone.dataset.id || '', 'above']
  }
  if (dragZone.contains(zone)) return null
  const hoveringLeft = window.scrollX + zone.offsetLeft + 50 > x
  const hasChildren = zone.dataset.childcount !== '0'
  const collapsed = zone.dataset.collapsed === 'true'
  return [
    zone,
    zone.dataset.id || '',
    (hoveringLeft && (!hasChildren || collapsed)) || (hasChildren && collapsed) ? 'below' : 'child'
  ]
}

function clone <T>(data: T): T {
  return JSON.parse(JSON.stringify(data))
}

function optimisticUpdates (items: Item[], fetchers: Fetcher[]): Item[] {
  let newItems = clone(items)
  for (const f of fetchers) {
    const form = f.formData
    if (!form) continue
    switch (form.get('_action')) {
      case 'addItem': {
        const id = form.get('id')
        const newId = form.get('newId')
        const position = form.get('position')
        const title = form.get('title')
        if (
          typeof id !== 'string' ||
          typeof position !== 'string' ||
          typeof title !== 'string' ||
          typeof newId !== 'string'
        ) {
          continue
        }
        const { item } = listActions.addItem(newItems, newId, id, title, +position)
        const existing = newItems.find(i => i.id === newId)
        if (!existing) newItems.push(item)
        break
      }
      case 'deleteItem': {
        const id = form.get('id')
        if (typeof id !== 'string') continue
        const resp = listActions.deleteItem(newItems, id)
        if (resp) resp.item.deleted = true
        break
      }
    }
  }
  newItems.sort((a, b) => a.order - b.order)
  return newItems
}

interface SterisData {
  steris: string
}

export default function Index () {
  const [searchParams] = useSearchParams()
  const { items: flattenedItems, breadcrumbs, favorited } = useLoaderData<typeof loader>()
  const fetcher = useFetcher<SterisData>()
  const fetchers = useFetchers()
  const addToast = useToast()
  const updatedItems = optimisticUpdates(flattenedItems, fetchers)
  const id = searchParams.get('id')
  const relevantItems = updatedItems.filter(item => item.parentId == id)
  const items = populateChildren(relevantItems, updatedItems)

  const allItems: ItemMap = {}
  allItems[searchParams.get('id') || 'ROOT'] = { children: items }
  buildIdMap(items, allItems)

  React.useEffect(() => {
    if (!fetcher.data) return
    navigator.clipboard.writeText(fetcher.data.steris)
    addToast('Items copied to clipboard')
  }, [fetcher.data])

  return (
    <FocusManager>
      <DndContext<Item, [string, string]>
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
            const note = el.dataset.hasnotes === 'true'
            dropzone.style.top = el.offsetTop + (direction === 'above' ? -8 : note ? 50 : 25) + 'px'
            dropzone.style.left = el.offsetLeft + (direction === 'child' ? 50 : 10) + 'px'
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
        <div id='dropzone' className='absolute -top-3 left-0 h-1 rounded-full bg-gray-500' />
        <div className='p-4 pb-96'>
          <h1 className='group flex items-center gap-4 pb-4'>
            <Link to='/' className='hover:text-blue-500'>
              <Icons.HomeModern className='h-8 w-8' />
            </Link>
            <Icons.ChevronRight className='h-4 w-4' />
            <ul className='flex items-center'>
              <li>
                <Link to='/list' className='hover:text-blue-500'>
                  <Icons.BookOpen className='h-6 w-6' />
                </Link>
              </li>
              {breadcrumbs.map(crumb => (
                <React.Fragment key={crumb.id}>
                  <li className='px-4 text-gray-300'>/</li>
                  <li>
                    <a
                      className={cx('hover:text-blue-500', {
                        'text-gray-400': !crumb.title || crumb.completed,
                        'italic ': !crumb.title,
                        'line-through': crumb.completed
                      })}
                      href={`/list?id=${crumb.id}`}
                    >
                      {crumb.title || 'unnamed'}
                    </a>
                  </li>
                </React.Fragment>
              ))}
              <li className='ml-2'>
                <button
                  className='rounded-full p-2 opacity-0 transition-all hover:bg-blue-200 group-hover:opacity-100'
                  onClick={() => fetcher.submit({ _action: 'export' }, { method: 'post' })}
                  title='Export items to clipboard'
                >
                  <Icons.ArrowUpOnSquareStack className='h-4 w-4' />
                </button>
              </li>
              <li>
                <button
                  className='rounded-full p-2 opacity-0 transition-all hover:bg-blue-200 group-hover:opacity-100'
                  onClick={async () => {
                    const data = await navigator.clipboard.readText()
                    fetcher.submit({ _action: 'import', data }, { method: 'post' })
                  }}
                  title='Import items from clipboard'
                >
                  <Icons.ArrowDownOnSquareStack className='h-4 w-4' />
                </button>
              </li>
              {!!searchParams.get('id') && (
                <li>
                  <button
                    className='group/inner rounded-full p-2 opacity-0 transition-all hover:bg-blue-200 group-hover:opacity-100'
                    onClick={async () =>
                      fetcher.submit({ _action: 'toggleFavorite' }, { method: 'post' })
                    }
                  >
                    <Icons.Heart
                      className={cx('h-4 w-4', {
                        'fill-red-500': favorited,
                        'transition-all group-hover/inner:fill-red-300': !favorited
                      })}
                    />
                  </button>
                </li>
              )}
            </ul>
          </h1>

          <List items={items} allItems={allItems} root rootId={searchParams.get('id') || ''} />
        </div>
      </DndContext>
    </FocusManager>
  )
}

interface ListProps {
  items: Item[]
  allItems: ItemMap
  root?: boolean
  rootId?: string
}

function List ({ items, root, rootId, allItems }: ListProps) {
  const { focusAfterMount } = useFocuser('--')
  const newId = uuid.v4()
  return (
    <ul className={cx('ml-16', { 'border-l': !root })}>
      {items.map((item, i) => (
        <ListItem key={item.id} item={item} i={i} allItems={allItems} />
      ))}
      {root && (
        <li className='ml-8 mt-2'>
          <Form method='POST'>
            <input type='hidden' name='_action' value='addItem' />
            <input type='hidden' name='newId' value={newId} />
            <input type='hidden' name='id' value={rootId} />
            <input type='hidden' name='position' value={items.length} />
            <input type='hidden' name='title' value='' />
            <button
              type='submit'
              onClick={() => focusAfterMount(newId, 'start')}
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
  const { startDrag, dragItem } = useDragger<Item>()
  return (
    <li
      key={item.id}
      data-dragging={item === dragItem}
      className={cx('-ml-6 transition-all', {
        'bg-gray-200 dark:bg-gray-600': item === dragItem,
        'hidden ': item.deleted
      })}
    >
      <div className='group flex gap-2'>
        <Form method='POST'>
          <input type='hidden' name='_action' value='setCompleted' />
          <input type='hidden' name='id' value={item.id} />
          <input type='hidden' name='completed' value={'' + !item.completed} />
          <button
            type='submit'
            className='mt-1.5 flex h-5 w-5 items-center justify-center rounded-full opacity-0 hover:bg-gray-100 group-hover:opacity-100 dark:hover:bg-gray-600'
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
            className='mt-1.5 flex h-5 w-5 items-center justify-center rounded-full opacity-0 hover:bg-gray-100 group-hover:opacity-100  dark:hover:bg-gray-600'
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
          data-hasnotes={!!item.body.length}
          data-childcount={item.children.length}
          href={`/list?id=${item.id}`}
          className={cx(
            'dz mt-1.5 flex h-5 w-5 items-center justify-center rounded-full hover:bg-gray-400 dark:hover:bg-gray-600',
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

type HandleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => void

function SuperInput ({ item, i, allItems }: SuperInputProps) {
  const onKeyDownRef = React.useRef<HandleKeyDown>()
  const onBodyKeyDownRef = React.useRef<HandleKeyDown>()
  const fetcher = useFetcher()
  const { focus, focusAfterMount } = useFocuser(item.id)
  onKeyDownRef.current = function (e: React.KeyboardEvent<HTMLDivElement>) {
    const input = e.currentTarget
    const value = input.textContent as string
    const selection = window.getSelection() as Selection
    const { anchorOffset: startPos, focusOffset: endPos } = selection

    // indent item
    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault()
      focusAfterMount(item.id, 'current')
      return fetcher.submit({ _action: 'indent', id: item.id }, { method: 'post' })
    }

    // outdent item
    if (e.key === 'Tab' && e.shiftKey) {
      e.preventDefault()
      focusAfterMount(item.id, 'current')
      return fetcher.submit({ _action: 'outdent', id: item.id }, { method: 'post' })
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
      focus(item.id, 'end', 'body')
      return
    }

    // create new item
    if (e.key === 'Enter') {
      e.preventDefault()
      // But first check if you should just indent.
      if (item.title === '' && item.body === '') {
        if (
          item.parentId &&
          (item.order == allItems?.[item?.parentId]?.children?.length - 1 ||
            allItems?.[item?.parentId]?.children?.length == 1)
        ) {
          focusAfterMount(item.id, 'current')
          return fetcher.submit({ _action: 'outdent', id: item.id }, { method: 'post' })
        }
      }
      const title = value.slice(startPos || 0)
      input.textContent = value.slice(0, startPos || 0)

      const newId = uuid.v4()
      focusAfterMount(newId, 'start')
      return fetcher.submit(
        {
          _action: 'addItem',
          newId,
          position: i,
          title,
          id: item.parentId || ''
        },
        { method: 'post' }
      )
    }

    // delete item
    if (e.key === 'Backspace') {
      if (startPos === 0 && endPos === 0) {
        e.preventDefault()
        const prevItem = getPrevItem(item, allItems)
        if (value) {
          const prev = document.getElementById(`item-${prevItem?.id}`) as HTMLInputElement | null
          if (prev) {
            const len = prev.textContent?.length || 0
            prev.textContent += value
            focus(prevItem?.id, len)
          }
        } else {
          focus(prevItem?.id, 'end')
        }
        fetcher.submit({ _action: 'deleteItem', id: item.id }, { method: 'post' })
        return
      }
    }

    // move cursor up
    if (e.key === 'ArrowUp' || (e.key === 'ArrowLeft' && startPos === 0)) {
      e.preventDefault()
      const prevItem = getPrevItem(item, allItems)
      focus(prevItem?.id, e.key === 'ArrowLeft' ? 'end' : 'start')
      return
    }

    // move cursor down
    if (e.key === 'ArrowDown' || (e.key === 'ArrowRight' && startPos === value.length)) {
      e.preventDefault()
      const nextItem = getNextItem(item, allItems, true)
      if (nextItem) focus(nextItem.id, 'start')
      else focus(item.id, 'end')
      return
    }
  }
  onBodyKeyDownRef.current = function (e: React.KeyboardEvent<HTMLDivElement>) {
    const input = e.currentTarget
    const value = input.textContent as string
    const selection = window.getSelection() as Selection
    const { anchorOffset: startPos } = selection

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
      focus(item.id, 'end')
    }

    // exit note mode
    if (e.key === 'Backspace' && value === '') {
      e.preventDefault()
      focus(item.id, 'end')
    }

    // move cursor up
    if ((e.key === 'ArrowUp' || e.key === 'ArrowLeft') && startPos === 0) {
      e.preventDefault()
      focus(item.id, e.key === 'ArrowLeft' ? 'end' : 'start')
    }

    // move cursor down
    if ((e.key === 'ArrowDown' || e.key === 'ArrowRight') && startPos === value.length) {
      e.preventDefault()
      const nextItem = getNextItem(item, allItems, true)
      focus(nextItem?.id, 'start')
    }
  }

  React.useEffect(() => {
    const el = document.getElementById(`item-${item.id}`) as HTMLDivElement
    if (item.completed) {
      el.classList.add('text-gray-400')
      el.classList.add('line-through')
    } else {
      el.classList.remove('text-gray-400')
      el.classList.remove('line-through')
    }
  }, [item.id, item.completed])

  React.useEffect(() => {
    const el = document.getElementById(`body-${item.id}`) as HTMLDivElement
    if (item.body) el.classList.remove('sr-only')
    else el.classList.add('sr-only')
  }, [item.id, item.body])

  return (
    <div className='relative flex-1'>
      <FrozenDiv
        dangerouslySetInnerHTML={{ __html: item.title }}
        contentEditable
        id={`item-${item.id}`}
        onKeyDownRef={onKeyDownRef}
        onInput={e => {
          fetcher.submit(
            { _action: 'updateTitle', id: item.id, title: e.currentTarget.textContent },
            { method: 'post' }
          )
        }}
        className={cx('bg-transparent py-1 outline-none [overflow-wrap:anywhere]', {
          'text-gray-400 line-through': item.completed
        })}
      />
      {item.body && (
        <Link
          to={`/markdown/${item.id}`}
          className='absolute -left-4 mt-0.5 hidden rounded-full bg-blue-100 p-0.5 group-hover:block'
        >
          <Icons.ArrowUpLeft className='h-2 w-2 stroke-blue-500' />
        </Link>
      )}
      <FrozenDiv
        dangerouslySetInnerHTML={{ __html: item.body }}
        contentEditable
        id={`body-${item.id}`}
        onKeyDownRef={onBodyKeyDownRef}
        onInput={e => {
          fetcher.submit(
            { _action: 'updateBody', id: item.id, body: e.currentTarget.textContent },
            { method: 'post' }
          )
        }}
        className={cx(
          'bg-transparent text-xs text-gray-400 outline-none [overflow-wrap:anywhere] focus:not-sr-only focus:w-full',
          { 'sr-only': !item.body }
        )}
      />
    </div>
  )
}

type DivProps = React.DetailedHTMLProps<React.HTMLAttributes<HTMLDivElement>, HTMLDivElement>
type FrozenDivProps = DivProps & { onKeyDownRef: React.MutableRefObject<HandleKeyDown | undefined> }

const FrozenDiv = React.memo(
  function FrozenDiv ({ onKeyDownRef, ...props }: FrozenDivProps) {
    return <div {...props} onKeyDown={e => onKeyDownRef.current?.(e)} />
  },
  () => true
)

function getNextItem (item: ItemIsh, items: ItemMap, root = false): ItemIsh | null {
  if (root && item.children.length && !item.collapsed) return item.children[0]
  if (!item.id) return null
  const parentItem = items[item.parentId || 'ROOT']
  const myIndex = parentItem.children.findIndex(i => i.id == item.id)
  if (parentItem.children[myIndex + 1]) return parentItem.children[myIndex + 1]
  return getNextItem(parentItem, items)
}

function getPrevItem (item: ItemIsh, items: ItemMap): ItemIsh | null {
  const parentItem = items[item.parentId || 'ROOT']
  const myIndex = parentItem.children.findIndex(i => i.id == item.id)
  if (myIndex === 0) return parentItem.id ? parentItem : null
  const prevSibling = parentItem.children[myIndex - 1]
  return furthestGrandchild(prevSibling)
}

function furthestGrandchild (item: ItemIsh): ItemIsh {
  if (item.collapsed) return item
  const lastChild = item.children.at(-1)
  return lastChild ? furthestGrandchild(lastChild) : item
}
