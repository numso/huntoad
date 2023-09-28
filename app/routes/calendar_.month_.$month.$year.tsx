import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { Link, useFetcher, useLoaderData } from '@remix-run/react'
import cx from 'clsx'

import * as Icons from '~/components/icons'
import * as db from '~/utils/db.server'
import * as settings from '~/utils/settings.server'
import type { Item } from '~/utils/types'

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

export async function loader ({ params }: LoaderFunctionArgs) {
  const month = (params.month as string).toLowerCase()
  const year = +(params.year as string)
  if (months.indexOf(month) === -1) throw new Error('bad month')
  if (isNaN(year) || year < 1970 || year > 3000) throw new Error('bad year')
  const monthNum = months.indexOf(month)
  const items = await db.getItemsForMonth(monthNum, year)
  const favorited = settings.getFavorite('calendar-month', `${month}/${year}`)
  return json({
    favorited,
    items,
    month,
    year,
    monthNum,
    prevUrl: `/calendar/month/${months[(monthNum + 11) % 12]}/${monthNum == 0 ? year - 1 : year}`,
    nextUrl: `/calendar/month/${months[(monthNum + 1) % 12]}/${monthNum == 11 ? year + 1 : year}`
  })
}

export async function action ({ request, params }: ActionFunctionArgs) {
  const form = await request.formData()
  switch (form.get('_action')) {
    case 'toggleFavorite': {
      const month = (params.month as string).toLowerCase()
      const year = +(params.year as string)
      settings.toggleFavorite('calendar-month', `${month}/${year}`)
      break
    }
    default: {
      throw new Error('unknown action')
    }
  }
  return null
}

export default function Calendar () {
  const { favorited, items, month, year, monthNum, prevUrl, nextUrl } =
    useLoaderData<typeof loader>()
  const fetcher = useFetcher()
  const firstDate = new Date(year, monthNum, 1)
  const lastDate = new Date(year, monthNum + 1, 0)
  const offset = firstDate.getDay()
  const days = [...new Array(lastDate.getDate())].map((_, i) => i + 1)
  return (
    <div className='min-h-screen bg-gray-100'>
      <h1 className='group flex items-center bg-white p-4 text-2xl'>
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
        <button
          className='group/inner ml-2 rounded-full p-2 opacity-0 transition-all hover:bg-blue-200 group-hover:opacity-100'
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
      <div className='my-10 w-full overflow-auto'>
        <div className='mx-auto grid w-full min-w-[600px] max-w-5xl grid-cols-7 gap-1'>
          {!!offset && (
            <div
              className='relative'
              style={{ gridColumn: `span ${offset} / span ${offset}` }}
              data-week-anchor='1'
            >
              <Link
                data-week-link
                to={`/calendar/week/${month}/1/${year}`}
                className='absolute -left-28 flex h-full w-28 items-center justify-center bg-blue-100 opacity-0 transition-all hover:opacity-100'
              >
                Show Week
              </Link>
            </div>
          )}
          {days.map(i => (
            <Day
              key={i}
              month={month}
              date={i}
              year={year}
              weekAnchor={(offset + i + 6) % 7 === 0 ? (offset + i + 6) / 7 : null}
              weekNum={Math.floor((offset + i + 6) / 7)}
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
  weekAnchor: number | null
  weekNum: number
}

function Day ({ month, date, year, items, weekAnchor, weekNum }: DayProps) {
  return (
    <div
      className='relative aspect-square bg-white transition-all hover:bg-yellow-50'
      data-week-anchor={weekAnchor}
      data-week-num={weekNum}
    >
      <Link to={`/calendar/day/${month}/${date}/${year}`} className='absolute h-full w-full' />
      {weekAnchor && (
        <Link
          data-week-link
          to={`/calendar/week/${month}/${date}/${year}`}
          className='absolute -left-28 flex h-full w-28 items-center justify-center bg-blue-100 opacity-0 transition-all hover:bg-blue-200 hover:opacity-100'
        >
          Show Week
        </Link>
      )}
      <h2>{date}</h2>
      {items.slice(0, 5).map((item, i) => {
        let title = item.title
        for (const date of item.dates) title = title.replaceAll(':' + date, '')
        return (
          <Link
            key={item.id}
            to={`/list?id=${item.id}`}
            className={cx(
              'relative mb-1 ml-2 overflow-hidden whitespace-nowrap rounded-l-full bg-blue-300 pl-2 text-xs hover:bg-blue-400',
              {
                'text-gray-400 line-through': item.completed,
                'hidden lg:block': i === 4 || i === 5,
                'hidden min-[900px]:block': i === 3,
                'hidden md:block': i === 2,
                'block ': i === 0 || i === 1
              }
            )}
            title={title}
          >
            {title}
          </Link>
        )
      })}
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
    </div>
  )
}
