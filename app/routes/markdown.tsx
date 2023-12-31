import { redirect } from '@remix-run/node'
import * as uuid from 'uuid'

import * as db from '~/utils/db.server'

export async function loader () {
  const allItems = await db.loadItems()
  const parentItems = allItems.filter(i => !i.parentId)
  const title = `New Note ${new Date().toLocaleDateString()}`
  const item = await db.addItem(null, parentItems.length, title, uuid.v4())
  return redirect(`/markdown/${item.id}`)
}
