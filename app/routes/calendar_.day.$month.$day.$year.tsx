import type { LoaderArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { Link, useLoaderData } from '@remix-run/react'
import cx from 'clsx'

import * as Icons from '../components/icons'
import type { Item } from '../utils/db.server'
import * as db from '../utils/db.server'

const months = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december'
]

const oneDayInMilliseconds = 24 * 60 * 60 * 1000

export async function loader ({ params }: LoaderArgs) {
  const month = (params.month as string).toLowerCase()
  const day = +(params.day as string)
  const year = +(params.year as string)
  if (months.indexOf(month) === -1) throw new Error('bad month')
  if (isNaN(year) || year < 1970 || year > 3000) throw new Error('bad year')
  const monthNum = months.indexOf(month)
  const lastDate = new Date(year, monthNum + 1, 0)
  if (isNaN(day) || day < 0 || day > lastDate.getDate()) throw new Error('bad day')
  const items = await db.getItemsForDay(monthNum, day, year)
  const currentDate = new Date(year, monthNum, day)
  const prev = new Date(+currentDate - oneDayInMilliseconds)
  const next = new Date(+currentDate + oneDayInMilliseconds)
  return json({
    items,
    month,
    day,
    year,
    prevUrl: `/calendar/day/${months[prev.getMonth()]}/${prev.getDate()}/${prev.getFullYear()}`,
    nextUrl: `/calendar/day/${months[next.getMonth()]}/${next.getDate()}/${next.getFullYear()}`
  })
}

export default function Calendar () {
  const { items, month, day, year, prevUrl, nextUrl } = useLoaderData<typeof loader>()
  return (
    <div className='min-h-screen bg-gray-100'>
      <h1 className='flex items-center bg-white p-4 text-2xl'>
        <Link to='/' className='mr-8 hover:text-blue-500'>
          <Icons.HomeModern className='h-8 w-8' />
        </Link>
        <Link to={prevUrl} className='rotate-180 hover:text-blue-500'>
          <Icons.ChevronRight className='h-4 w-4' />
        </Link>
        <span className='w-56 text-center capitalize'>
          <Link
            to={`/calendar/month/${month}/${year}`}
            className='rounded-md p-1 pl-2 transition-all hover:bg-slate-200'
          >
            {month.toLowerCase()}
          </Link>{' '}
          {day}, {year}
        </span>
        <Link to={nextUrl} className='hover:text-blue-500'>
          <Icons.ChevronRight className='h-4 w-4' />
        </Link>
      </h1>
      <div className='my-10 w-full overflow-auto'>
        <ul>
          {items.map(item => (
            <li
              key={item.id}
              className={cx('ml-6 list-disc py-2', {
                'text-gray-400 line-through': item.completed
              })}
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
    </div>
  )
}
