import { Link } from '@remix-run/react'
import cx from 'clsx'

import * as Icons from '../components/icons'
import type { Favorite } from '../utils/settings.server'

interface FavoriteLinkProps {
  favorite: Favorite
}

const favClasses = `flex w-72 items-center gap-1 rounded-md border border-black px-4 py-2 transition-all [transition-duration:.3s] dark:border-slate-500`

export function FavoriteLink ({ favorite }: FavoriteLinkProps) {
  if (favorite.type === 'list') {
    return (
      <Link
        to={`/list?id=${favorite.id}`}
        className={cx(
          favClasses,
          'bg-blue-50 hover:bg-blue-100 dark:bg-blue-900 dark:hover:bg-blue-800'
        )}
      >
        <Icons.BookOpen className='h-4 w-4' />
        <div className='overflow-hidden text-ellipsis whitespace-nowrap'>{favorite.title}</div>
      </Link>
    )
  }
  if (favorite.type === 'list-tag') {
    return (
      <Link
        to={`/list/${favorite.id}`}
        className={cx(
          favClasses,
          'bg-blue-50 hover:bg-blue-100 dark:bg-blue-900 dark:hover:bg-blue-800'
        )}
      >
        <Icons.BookOpen className='h-4 w-4' />
        <div className='overflow-hidden text-ellipsis whitespace-nowrap'>{favorite.title}</div>
      </Link>
    )
  }
  if (favorite.type === 'markdown') {
    return (
      <Link
        to={`/markdown/${favorite.id}`}
        className={cx(
          favClasses,
          'bg-green-50 hover:bg-green-100 dark:bg-green-900 dark:hover:bg-green-800'
        )}
      >
        <Icons.PencilSquare className='h-4 w-4' />
        <div className='overflow-hidden text-ellipsis whitespace-nowrap'>{favorite.title}</div>
      </Link>
    )
  }
  if (favorite.type === 'calendar-day') {
    return (
      <Link
        to={`/calendar/day/${favorite.id}`}
        className={cx(
          favClasses,
          'bg-purple-50 hover:bg-purple-100 dark:bg-purple-900 dark:hover:bg-purple-800'
        )}
      >
        <Icons.CalendarDays className='h-4 w-4' />
        <div className='overflow-hidden text-ellipsis whitespace-nowrap'>{favorite.title}</div>
      </Link>
    )
  }
  if (favorite.type === 'calendar-week') {
    return (
      <Link
        to={`/calendar/week/${favorite.id}`}
        className={cx(
          favClasses,
          'bg-purple-50 hover:bg-purple-100 dark:bg-purple-900 dark:hover:bg-purple-800'
        )}
      >
        <Icons.CalendarDays className='h-4 w-4' />
        <div className='overflow-hidden text-ellipsis whitespace-nowrap'>{favorite.title}</div>
      </Link>
    )
  }
  if (favorite.type === 'calendar-month') {
    return (
      <Link
        to={`/calendar/month/${favorite.id}`}
        className={cx(
          favClasses,
          'bg-purple-50 hover:bg-purple-100 dark:bg-purple-900 dark:hover:bg-purple-800'
        )}
      >
        <Icons.CalendarDays className='h-4 w-4' />
        <div className='overflow-hidden text-ellipsis whitespace-nowrap'>{favorite.title}</div>
      </Link>
    )
  }
  return <div>Error, unknown favorite type: {favorite.type}</div>
}
