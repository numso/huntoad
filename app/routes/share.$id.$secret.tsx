import type { LoaderFunctionArgs } from '@remix-run/node'
import { json, redirect } from '@remix-run/node'

import * as db from '~/utils/db.server'
import * as sync from '~/utils/sync.server'

export async function loader ({ params }: LoaderFunctionArgs) {
  if (!sync.connected()) return json({ error: 'Share Server not configured in Settings' })
  const id = params.id as string
  const secret = params.secret as string
  const item = await db.getItem(id)
  if (item && item.share === secret) return redirect(`/list?id=${id}`)
  if (item) return json({ error: 'conflicting id' })
  await sync.join(id, secret)
  return redirect(`/list?id=${id}`)
}
