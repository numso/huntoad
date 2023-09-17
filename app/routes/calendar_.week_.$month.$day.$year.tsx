import type { LoaderArgs } from '@remix-run/node'
import { json, redirect } from '@remix-run/node'
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
  const currentDate = new Date(year, monthNum, day)
  if (currentDate.getDay() !== 0) {
    const actual = new Date(+currentDate - currentDate.getDay() * oneDayInMilliseconds)
    return redirect(
      `/calendar/week/${months[actual.getMonth()]}/${actual.getDate()}/${actual.getFullYear()}`
    )
  }
  const prev = new Date(+currentDate - 7 * oneDayInMilliseconds)
  const next = new Date(+currentDate + 7.5 * oneDayInMilliseconds)
  const items = await db.getItemsForWeek(currentDate)
  return json({
    items,
    monthNum,
    month,
    day,
    year,
    prevUrl: `/calendar/week/${months[prev.getMonth()]}/${prev.getDate()}/${prev.getFullYear()}`,
    nextUrl: `/calendar/week/${months[next.getMonth()]}/${next.getDate()}/${next.getFullYear()}`
  })
}

export default function Calendar () {
  const { items, monthNum, month, day, year, prevUrl, nextUrl } = useLoaderData<typeof loader>()
  const days = [0, 1, 2, 3, 4, 5, 6]
  const firstDate = new Date(year, monthNum, day)
  return (
    <div className='min-h-screen bg-gray-100'>
      <h1 className='group flex items-center bg-white p-4 text-2xl'>
        <Link to='/' className='mr-8 hover:text-blue-500'>
          <Icons.HomeModern className='h-8 w-8' />
        </Link>
        <Link to={prevUrl} className='rotate-180 hover:text-blue-500'>
          <Icons.ChevronRight className='h-4 w-4' />
        </Link>
        <span className='w-80 text-center capitalize'>
          Week of {month.toLowerCase()} {day}, {year}
        </span>
        <Link to={nextUrl} className='hover:text-blue-500'>
          <Icons.ChevronRight className='h-4 w-4' />
        </Link>
        <Link
          className='ml-4 rounded-md bg-blue-400 px-3 py-1 text-sm text-white opacity-0 transition-all hover:bg-blue-500 group-hover:opacity-100'
          to={`/calendar/month/${month}/${year}`}
        >
          Month View
        </Link>
      </h1>
      <div className='my-10'>
        <div className='grid grid-cols-7 gap-0.5'>
          {days.map(day => {
            let date = new Date(+firstDate + oneDayInMilliseconds * (day + 0.5))
            date = new Date(date.getFullYear(), date.getMonth(), date.getDate())
            const month = months[date.getMonth()]
            const myItems = items.filter(item => item.dates.map(d => +new Date(d)).includes(+date))
            return (
              <div key={day} className='bg-white'>
                <div className='text-center text-lg font-medium'>
                  {date.toLocaleDateString('en-US', { weekday: 'long' })}
                </div>
                <Link
                  to={`/calendar/day/${month}/${date.getDate()}/${date.getFullYear()}`}
                  className='block text-center text-xs capitalize hover:text-blue-500'
                >
                  {month} {date.getDate()}, {date.getFullYear()}
                </Link>
                <ul>
                  {myItems.map(item => (
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
            )
          })}
        </div>
      </div>
    </div>
  )
}