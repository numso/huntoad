import type { LoaderArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { useLoaderData, useParams } from '@remix-run/react'
import cx from 'clsx'

import * as db from '../utils/db.server'

export async function loader ({ params }: LoaderArgs) {
  const items = await db.loadItems()
  return json({
    items: items.filter(item => item.tags.includes(params.tag))
  })
}

export default function Index () {
  const { tag } = useParams()
  const { items } = useLoaderData<typeof loader>()
  return (
    <div className='p-4'>
      <h1 className='pb-4 text-2xl'>#{tag}</h1>
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
