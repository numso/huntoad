import { json } from '@remix-run/node'
import { Link, useLoaderData } from '@remix-run/react'
import cx from 'clsx'

import * as Icons from '../components/icons'
import type { Favorite } from '../utils/settings.server'
import * as settings from '../utils/settings.server'

export async function loader () {
  return json({
    favorites: await settings.getAllFavorites()
  })
}

export default function Index () {
  const { favorites } = useLoaderData<typeof loader>()
  return (
    <div className='flex flex-col items-center'>
      <Icons.HomeModern className='h-52 w-52 transition-all [transition-duration:10s] hover:h-[1000px] hover:w-[1000px]' />
      <div className='flex flex-wrap justify-center gap-4 p-4'>
        {favorites.map(f => (
          <FavoriteLink key={`${f.type}-${f.id}`} favorite={f} />
        ))}
      </div>
      <div className='flex flex-wrap justify-center gap-4 p-4'>
        <FancyLink
          to='/list'
          label='Infinite List'
          description='Take all the notes!'
          className='bg-blue-50 hover:bg-blue-100'
        >
          <Icons.BookOpen className='h-20 w-20' />
        </FancyLink>
        <FancyLink
          to='/markdown'
          label='New Note'
          description='Jot down a more complex idea'
          className='bg-green-50 hover:bg-green-100'
        >
          <Icons.PencilSquare className='h-20 w-20' />
        </FancyLink>
        <FancyLink
          to='/calendar'
          label='Calendar View'
          description='See your items in a schedule'
          className='bg-purple-50 hover:bg-purple-100'
        >
          <Icons.CalendarDays className='h-20 w-20' />
        </FancyLink>
        <FancyLink
          to='/integrity'
          label='Integrity Check'
          description='Ensures data correctness'
          className='bg-red-50 hover:bg-red-100'
        >
          <Icons.WrenchScrewdriver className='h-20 w-20' />
        </FancyLink>
        <FancyLink to='/settings' label='Settings' className='bg-yellow-50 hover:bg-yellow-100'>
          <Icons.Cog6Tooth className='h-20 w-20' />
        </FancyLink>
      </div>
    </div>
  )
}

interface FancyLinkProps {
  to: string
  label: string
  description?: string
  children: React.ReactNode
  className?: string
}

function FancyLink ({ to, label, description, children, className }: FancyLinkProps) {
  return (
    <Link
      to={to}
      className={cx(
        'flex w-72 flex-col items-center rounded-md border border-black px-8 py-4 transition-all [transition-duration:.3s]',
        className
      )}
    >
      {children}
      <div className='pt-2 text-xl'>{label}</div>
      <div className='text-gray-400'>{description}</div>
    </Link>
  )
}

interface FavoriteLinkProps {
  favorite: Favorite
}

const favClasses = `flex w-72 items-center gap-1 rounded-md border border-black px-4 py-2 transition-all [transition-duration:.3s]`

function FavoriteLink ({ favorite }: FavoriteLinkProps) {
  if (favorite.type === 'list') {
    return (
      <Link
        to={`/list?id=${favorite.id}`}
        className={cx(favClasses, 'bg-blue-50 hover:bg-blue-100')}
      >
        <Icons.BookOpen className='h-4 w-4' />
        <div>{favorite.title}</div>
      </Link>
    )
  }
  if (favorite.type === 'markdown') {
    return (
      <Link
        to={`/markdown/${favorite.id}`}
        className={cx(favClasses, 'bg-green-50 hover:bg-green-100')}
      >
        <Icons.PencilSquare className='h-4 w-4' />
        <div>{favorite.title}</div>
      </Link>
    )
  }
  return <div>Error, unknown favorite type: {favorite.type}</div>
}
