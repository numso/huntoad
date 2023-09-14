import type { ActionArgs, LoaderArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { Link, useFetcher, useLoaderData } from '@remix-run/react'
import cx from 'clsx'
import styles from 'easymde/dist/easymde.min.css'

import { ClientOnly } from '../components/client-only'
import * as Icons from '../components/icons'
import { SimpleMdeReact } from '../components/md-editor.client'
import * as db from '../utils/db.server'

export function links () {
  return [{ rel: 'stylesheet', href: styles }]
}

export async function loader ({ params }: LoaderArgs) {
  const item = await db.getItem(params.id as string)
  return json({ item })
}

export async function action ({ request }: ActionArgs) {
  const form = await request.formData()
  const id = form.get('id')
  const body = form.get('body')
  if (typeof id !== 'string' || typeof body !== 'string') return
  await db.updateBody(id, body)
  return null
}

const options = {
  toolbar: false,
  status: false,
  placeholder: 'Your note goes here...',
  spellChecker: false,
  autoDownloadFontAwesome: false,
  autofocus: true,
  unorderedListStyle: '-',
  indentWithTabs: false
}

export default function Index () {
  const { item } = useLoaderData<typeof loader>()
  const fetcher = useFetcher()

  return (
    <div>
      <h1
        className={cx('group flex items-center gap-4 bg-gray-100 p-4 text-2xl', {
          'italic text-gray-500': !item.title
        })}
      >
        {item.title || 'unnamed'}
        <Link
          to={item.parentId ? `/list?id=${item.parentId}` : '/list'}
          className='hidden rounded-full bg-blue-100 p-1 group-hover:block'
        >
          <Icons.ArrowUpLeft className='h-4 w-4 stroke-blue-500' />
        </Link>
      </h1>
      <ClientOnly>
        {() => (
          <SimpleMdeReact
            value={item.body}
            onChange={value => {
              fetcher.submit({ id: item.id, body: value }, { method: 'post' })
            }}
            options={options}
          />
        )}
      </ClientOnly>
    </div>
  )
}
