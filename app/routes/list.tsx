import type { ActionArgs, LoaderArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { Form, useLoaderData } from '@remix-run/react'

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
      const id = url.searchParams.get('id')
      await db.addItem(id)
      break
    }
  }

  return null
}

export default function Index () {
  const { items, breadcrumbs } = useLoaderData<typeof loader>()
  return (
    <div>
      {!!breadcrumbs.length && (
        <ul className='flex p-4'>
          <li>
            <a className='hover:text-blue-500' href='/list'>
              @
            </a>
          </li>
          {breadcrumbs.map(crumb => (
            <>
              <li className='px-4 text-gray-300'>/</li>
              <li key={crumb.id}>
                <a
                  className='hover:text-blue-500'
                  href={`/list?id=${crumb.id}`}
                >
                  {crumb.label}
                </a>
              </li>
            </>
          ))}
        </ul>
      )}

      <List items={items} root />
    </div>
  )
}

interface ListProps {
  items: Item[]
  root?: boolean
}

function List ({ items, root }: ListProps) {
  return (
    <ul>
      {items.map(item => (
        <li key={item.id} className='ml-6'>
          <div className='flex items-center gap-2'>
            <a
              href={`/list?id=${item.id}`}
              className='flex h-5 w-5 items-center justify-center rounded-full hover:bg-gray-300'
            >
              <div className='h-2 w-2 rounded-full bg-gray-800' />
            </a>
            <Form method='POST' className='flex-1'>
              <input type='hidden' name='_action' value='updateTitle' />
              <input type='hidden' name='id' value={item.id} />
              <ListItem item={item} />
            </Form>
          </div>
          <List items={item.children} />
        </li>
      ))}
      {root && (
        <li className='ml-6 mt-2'>
          <Form method='POST'>
            <input type='hidden' name='_action' value='addItem' />
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
}

function ListItem ({ item }: ListItemProps) {
  function handleKeyDown (e: React.KeyboardEvent<HTMLInputElement>) {
    console.log({ key: e.key })
    switch (e.key) {
      case 'Tab': {
        e.preventDefault()
        // indent/outdent based on if e.shiftKey == true
        break
      }
      case 'Enter': {
        // e.preventDefault()
        // create new item after this one
        // separate content at cursor
        break
      }
      case 'Backspace': {
        // if cursor is at position 0, delete this item, append to prev item, focus accordingly
        break
      }
      case 'ArrowUp': {
        e.preventDefault()
        // move focus to item above
        break
      }
      case 'ArrowDown': {
        e.preventDefault()
        // move focus to item below
        break
      }
    }
  }
  return (
    <input
      onKeyDown={handleKeyDown}
      type='text'
      className='w-full'
      name='title'
      defaultValue={item.title}
    />
  )
}
