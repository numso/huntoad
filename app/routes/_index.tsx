import { json } from '@remix-run/node'
import { Link, useLoaderData } from '@remix-run/react'
import cx from 'clsx'

import { FavoriteLink } from '../components/favorite'
import * as Icons from '../components/icons'
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
          className='bg-blue-50 hover:bg-blue-100 dark:bg-blue-900 dark:hover:bg-blue-800'
        >
          <Icons.BookOpen className='h-20 w-20' />
        </FancyLink>
        <FancyLink
          to='/markdown'
          label='New Note'
          description='Jot down a more complex idea'
          className='bg-green-50 hover:bg-green-100 dark:bg-green-900 dark:hover:bg-green-800'
        >
          <Icons.PencilSquare className='h-20 w-20' />
        </FancyLink>
        <FancyLink
          to='/calendar'
          label='Calendar View'
          description='See your items in a schedule'
          className='bg-purple-50 hover:bg-purple-100 dark:bg-purple-900 dark:hover:bg-purple-800'
        >
          <Icons.CalendarDays className='h-20 w-20' />
        </FancyLink>
        <FancyLink
          to='/integrity'
          label='Integrity Check'
          description='Ensures data correctness'
          className='bg-red-50 hover:bg-red-100 dark:bg-red-900 dark:hover:bg-red-800'
        >
          <Icons.WrenchScrewdriver className='h-20 w-20' />
        </FancyLink>
        <FancyLink
          to='/settings'
          label='Settings'
          className='bg-yellow-50 hover:bg-yellow-100 dark:bg-yellow-900 dark:hover:bg-yellow-800'
        >
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
