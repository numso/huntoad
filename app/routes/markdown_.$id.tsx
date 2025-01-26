import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node'
import { json, redirect } from '@remix-run/node'
import { Link, useFetcher, useLoaderData } from '@remix-run/react'
import cx from 'clsx'
import styles from 'easymde/dist/easymde.min.css?url'

import { ClientOnly } from '~/components/client-only'
import * as Icons from '~/components/icons'
import { SimpleMdeReact } from '~/components/md-editor.client'
import * as db from '~/utils/db.server'
import * as settings from '~/utils/settings.server'

export function links () {
  return [{ rel: 'stylesheet', href: styles }]
}

export async function loader ({ params }: LoaderFunctionArgs) {
  const item = await db.getItem(params.id as string)
  if (!item) return redirect('/list')
  const favorited = settings.getFavorite('markdown', params.id as string)
  return json({ item, favorited })
}

export async function action ({ request, params }: ActionFunctionArgs) {
  const form = await request.formData()

  switch (form.get('_action')) {
    case 'updateBody': {
      const id = form.get('id')
      const body = form.get('body')
      if (typeof id !== 'string' || typeof body !== 'string') return
      await db.updateBody(id, body)
      break
    }
    case 'toggleFavorite': {
      settings.toggleFavorite('markdown', params.id as string)
      break
    }
    default: {
      throw new Error('unknown action')
    }
  }
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
  const { item, favorited } = useLoaderData<typeof loader>()
  const fetcher = useFetcher()

  return (
    <div>
      <h1
        className={cx('group flex items-center bg-gray-100 p-4 text-2xl dark:bg-gray-900', {
          'text-gray-500': !item.title || item.completed,
          italic: !item.title,
          'line-through': item.completed
        })}
      >
        <div className='flex items-center gap-4'>
          <Link to='/' className='hover:text-blue-500'>
            <Icons.HomeModern className='h-8 w-8' />
          </Link>
          <Icons.ChevronRight className='h-4 w-4' />
          <span>{item.title || 'unnamed'}</span>
        </div>
        <Link
          to={item.parentId ? `/list?id=${item.parentId}` : '/list'}
          className='ml-2 rounded-full p-2 opacity-0 transition-all hover:bg-blue-200 group-hover:opacity-100 dark:bg-blue-800'
        >
          <Icons.ArrowUpLeft className='h-4 w-4 stroke-blue-600 dark:stroke-blue-300' />
        </Link>
        <button
          className='group/inner rounded-full p-2 opacity-0 transition-all hover:bg-blue-200 group-hover:opacity-100 dark:hover:bg-blue-800'
          onClick={async () => fetcher.submit({ _action: 'toggleFavorite' }, { method: 'post' })}
        >
          <Icons.Heart
            className={cx('h-4 w-4', {
              'fill-red-500': favorited,
              'transition-all group-hover/inner:fill-red-300 dark:group-hover/inner:fill-red-900':
                !favorited
            })}
          />
        </button>
      </h1>
      <ClientOnly>
        {() => (
          <SimpleMdeReact
            value={item.body}
            onChange={value => {
              fetcher.submit(
                { _action: 'updateBody', id: item.id, body: value },
                { method: 'post' }
              )
            }}
            options={options}
          />
        )}
      </ClientOnly>
    </div>
  )
}
