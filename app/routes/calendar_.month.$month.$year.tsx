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

export async function loader ({ params }: LoaderArgs) {
  const month = (params.month as string).toLowerCase()
  const year = +(params.year as string)
  if (months.indexOf(month) === -1) throw new Error('bad month')
  if (isNaN(year) || year < 1970 || year > 3000) throw new Error('bad year')
  const monthNum = months.indexOf(month)
  const items = await db.getItemsForMonth(monthNum, year)
  return json({
    items,
    month,
    year,
    monthNum,
    prevUrl: `/calendar/month/${months[(monthNum + 11) % 12]}/${monthNum == 0 ? year - 1 : year}`,
    nextUrl: `/calendar/month/${months[(monthNum + 1) % 12]}/${monthNum == 11 ? year + 1 : year}`
  })
}

export default function Calendar () {
  const { items, month, year, monthNum, prevUrl, nextUrl } = useLoaderData<typeof loader>()
  const firstDate = new Date(year, monthNum, 1)
  const lastDate = new Date(year, monthNum + 1, 0)
  const offset = firstDate.getDay()
  const days = [...new Array(lastDate.getDate())].map((_, i) => i + 1)
  return (
    <div className='min-h-screen bg-gray-100'>
      <h1 className='flex items-center bg-white p-4 text-2xl'>
        <Link to='/' className='mr-8 hover:text-blue-500'>
          <Icons.HomeModern className='h-8 w-8' />
        </Link>
        <Link to={prevUrl} className='rotate-180 hover:text-blue-500'>
          <Icons.ChevronRight className='h-4 w-4' />
        </Link>
        <span className='w-48 text-center capitalize'>
          {month.toLowerCase()} {year}
        </span>
        <Link to={nextUrl} className='hover:text-blue-500'>
          <Icons.ChevronRight className='h-4 w-4' />
        </Link>
      </h1>
      <div className='my-10 w-full overflow-auto'>
        <div className='mx-auto grid w-full min-w-[600px] max-w-5xl grid-cols-7 gap-1'>
          {!!offset && <div style={{ gridColumn: `span ${offset} / span ${offset}` }} />}
          {days.map(i => (
            <Day
              key={i}
              month={month}
              date={i}
              year={year}
              items={items.filter(item =>
                item.dates.map(d => +new Date(d)).includes(+new Date(year, monthNum, i))
              )}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

interface DayProps {
  month: string
  date: number
  year: number
  items: Item[]
}

function Day ({ month, date, year, items }: DayProps) {
  return (
    <Link
      to={`/calendar/day/${month}/${date}/${year}`}
      className='aspect-square overflow-hidden bg-white transition-all hover:bg-yellow-50'
    >
      <h2>{date}</h2>
      {items.slice(0, 5).map((item, i) => (
        <Link
          key={item.id}
          to={`/list?id=${item.id}`}
          className={cx(
            'mb-1 ml-2 whitespace-nowrap rounded-l-full bg-blue-300 pl-2 text-xs hover:bg-blue-400',
            {
              'hidden lg:block': i === 4 || i === 5,
              'hidden min-[900px]:block': i === 3,
              'hidden md:block': i === 2,
              'block ': i === 0 || i === 1
            }
          )}
          title={item.title}
        >
          {item.title}
        </Link>
      ))}
      {items.length > 2 && (
        <div className='mr-2 block text-right text-xs md:hidden'>{items.length - 2} more</div>
      )}
      {items.length > 3 && (
        <div className='mr-2 hidden text-right text-xs md:block min-[900px]:hidden'>
          {items.length - 3} more
        </div>
      )}
      {items.length > 4 && (
        <div className='mr-2 hidden text-right text-xs min-[900px]:block lg:hidden'>
          {items.length - 4} more
        </div>
      )}
      {items.length > 5 && (
        <div className='mr-2 hidden text-right text-xs lg:block'>{items.length - 5} more</div>
      )}
    </Link>
  )
}
