import type { LoaderArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { Link, useLoaderData } from '@remix-run/react'
import cx from 'clsx'

import * as Icons from '../components/icons'
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
  if (isNaN(day) || day < 1 || day > lastDate.getDate()) throw new Error('bad day')
  const items = await db.getItemsForDay(monthNum, day, year)
  const currentDate = new Date(year, monthNum, day)
  const prev = new Date(+currentDate - oneDayInMilliseconds)
  const next = new Date(+currentDate + oneDayInMilliseconds * 1.5)
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
      <h1 className='group flex items-center bg-white p-4 text-2xl'>
        <Link to='/' className='mr-8 hover:text-blue-500'>
          <Icons.HomeModern className='h-8 w-8' />
        </Link>
        <Link to={prevUrl} className='rotate-180 hover:text-blue-500'>
          <Icons.ChevronRight className='h-4 w-4' />
        </Link>
        <span className='w-56 text-center capitalize'>
          {month.toLowerCase()} {day}, {year}
        </span>
        <Link to={nextUrl} className='hover:text-blue-500'>
          <Icons.ChevronRight className='h-4 w-4' />
        </Link>
        <Link
          className='ml-4 rounded-md bg-blue-400 px-3 py-1 text-sm text-white opacity-0 transition-all hover:bg-blue-500 group-hover:opacity-100'
          to={`/calendar/week/${month}/${day}/${year}`}
        >
          Week View
        </Link>
        <Link
          className='ml-4 rounded-md bg-blue-400 px-3 py-1 text-sm text-white opacity-0 transition-all hover:bg-blue-500 group-hover:opacity-100'
          to={`/calendar/month/${month}/${year}`}
        >
          Month View
        </Link>
      </h1>
      <div className='mx-auto my-10 max-w-2xl'>
        {items.map(item => {
          let title = item.title
          for (const date of item.dates) title = title.replaceAll(':' + date, '')
          return (
            <Link
              key={item.id}
              className={cx('m-1 block rounded-full bg-blue-300 px-2 text-xs hover:bg-blue-400', {
                'text-gray-400 line-through': item.completed
              })}
              to={`/list?id=${item.id}`}
              target='_blank'
              rel='noopener noreferrer'
            >
              {title}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
