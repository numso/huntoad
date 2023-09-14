import type { LoaderArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { useLoaderData } from '@remix-run/react'

import * as db from '../utils/db.server'

export async function loader ({ request }: LoaderArgs) {
  const items = await db.loadItems()
  return json({ exampleItem: items[0] })
}

export default function Index () {
  const { exampleItem } = useLoaderData<typeof loader>()
  return (
    <div className='flex flex-col gap-4 p-4'>
      <h1 className='pb-4 text-3xl'>Examples</h1>
      <a href='/list' className='text-blue-400 underline hover:text-blue-500'>
        Infinite List
      </a>

      <a href={`/markdown`} className='text-blue-400 underline hover:text-blue-500'>
        Creates a brand new item at the root and puts you in markdown editing mode for that item's
        notes
      </a>

      <a href='/list/bug' className='text-blue-400 underline hover:text-blue-500'>
        Flat list of items tagged with #bug
      </a>

      <a href='/integrity' className='text-blue-400 underline hover:text-blue-500'>
        Integrity check to make sure your data is good
      </a>

      <a href='/settings' className='text-blue-400 underline hover:text-blue-500'>
        Settings page
      </a>

      {exampleItem ? (
        <>
          <a
            href={`/markdown/${exampleItem.id}`}
            className='text-blue-400 underline hover:text-blue-500'
          >
            Markdown editor for a single (existing) item's notes
          </a>
        </>
      ) : (
        <div>
          Add some items to{' '}
          <a href='/list' className='text-blue-400 underline hover:text-blue-500'>
            your list
          </a>{' '}
          to see more examples
        </div>
      )}
    </div>
  )
}
