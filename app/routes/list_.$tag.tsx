import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { Link, useFetcher, useLoaderData, useParams } from '@remix-run/react'
import cx from 'clsx'

import * as Icons from '~/components/icons'
import * as db from '~/utils/db.server'
import * as settings from '~/utils/settings.server'

export async function loader ({ params }: LoaderFunctionArgs) {
  const items = await db.loadItems()
  const favorited = settings.getFavorite('list-tag', params.tag as string)
  return json({
    favorited,
    items: items.filter(item => item.tags.includes(params.tag as string))
  })
}

export async function action ({ request, params }: ActionFunctionArgs) {
  const form = await request.formData()
  switch (form.get('_action')) {
    case 'toggleFavorite': {
      settings.toggleFavorite('list-tag', params.tag as string)
      break
    }
    default: {
      throw new Error('unknown action')
    }
  }
  return null
}

export default function Index () {
  const { tag } = useParams()
  const { favorited, items } = useLoaderData<typeof loader>()
  const fetcher = useFetcher()
  return (
    <div className='p-4'>
      <h1 className='group flex items-center gap-4 pb-4 text-2xl'>
        <Link to='/' className='hover:text-blue-500'>
          <Icons.HomeModern className='h-8 w-8' />
        </Link>
        <Icons.ChevronRight className='h-4 w-4' />
        <span>#{tag}</span>
        <button
          className='group/inner rounded-full p-2 opacity-0 transition-all hover:bg-blue-200 group-hover:opacity-100'
          onClick={async () => fetcher.submit({ _action: 'toggleFavorite' }, { method: 'post' })}
        >
          <Icons.Heart
            className={cx('h-4 w-4', {
              'fill-red-500': favorited,
              'transition-all group-hover/inner:fill-red-300': !favorited
            })}
          />
        </button>
      </h1>
      <ul>
        {items.map(item => (
          <li
            key={item.id}
            className={cx('ml-6 list-disc py-2', { 'text-gray-400 line-through': item.completed })}
          >
            <a
              className='hover:text-blue-500'
              href={`/list?id=${item.id}`}
              target='_blank'
              rel='noopener noreferrer'
            >
              {item.title}
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
