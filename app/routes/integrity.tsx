import { json } from '@remix-run/node'
import { Link, useLoaderData } from '@remix-run/react'

import * as Icons from '../components/icons'
import * as db from '../utils/db.server'
import type { Item } from '../utils/types'

interface LabelMap {
  [key: string]: string
}

interface ItemMap {
  [key: string]: Item
}

interface ErrorMap {
  [key: string]: string[]
}

const requiredAttributes = ['order', 'title', 'parentId', 'body', 'id']

const errorLabels: LabelMap = {
  recursive: 'Item is connected recursively',
  'missing-parent': 'Item references a missing parent'
}
for (const attr of requiredAttributes) {
  errorLabels[`missing-attr-${attr}`] = `Item is missing attribute: ${attr}`
}

function isRecursive (item: Item, itemMap: ItemMap, cache: any) {
  if (!item || !item.parentId) return false
  if (cache[item.id]) return true
  cache[item.id] = true
  const parent = itemMap[item.parentId]
  return isRecursive(parent, itemMap, cache)
}

export async function loader () {
  const items = await db.loadItems()
  const itemMap: ItemMap = {}
  for (const item of items) itemMap[item.id] = item
  const errorMap: ErrorMap = {}

  // check for recursively linked parents
  for (const item of items) {
    if (isRecursive(item, itemMap, {})) {
      if (!errorMap['recursive']) errorMap['recursive'] = []
      errorMap['recursive'].push(item.id)
    }
  }

  // check for missing parents
  for (const item of items) {
    if (item.parentId && !itemMap[item.parentId]) {
      if (!errorMap['missing-parent']) errorMap['missing-parent'] = []
      errorMap['missing-parent'].push(item.id)
    }
  }

  // check for missing attributes
  for (const attr of requiredAttributes) {
    const key = `missing-attr-${attr}`
    for (const item of items) {
      if (!(attr in item)) {
        if (!errorMap[key]) errorMap[key] = []
        errorMap[key].push(item.id)
      }
    }
  }

  const errors = []
  for (const key in errorMap) {
    errors.push({ id: key, label: errorLabels[key], culprits: errorMap[key] })
  }

  return json({ ok: !errors.length, errors })
}

export default function Index () {
  const { ok, errors } = useLoaderData<typeof loader>()
  if (ok) return <div className='p-4'>ok</div>
  return (
    <div className='p-4'>
      <Link to='/' className='hover:text-blue-500'>
        <Icons.HomeModern className='h-8 w-8' />
      </Link>
      <div className='pl-8 pt-8'>not ok</div>
      <ul className='flex flex-col gap-8 p-8'>
        {errors.map(error => (
          <li key={error.id}>
            <h2 className='text-xl font-bold'>{error.label}</h2>
            <ul>
              {error.culprits.map(culprit => (
                <li key={culprit} className='my-2 ml-6 list-disc'>
                  {culprit}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  )
}
