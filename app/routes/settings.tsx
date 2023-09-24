import type { ActionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { Link, useFetcher, useLoaderData } from '@remix-run/react'
import cx from 'clsx'
import React from 'react'

import { DndContext, useDragger } from '../components/dnd'
import { FavoriteLink } from '../components/favorite'
import * as Icons from '../components/icons'
import type { Favorite } from '../utils/settings.server'
import * as settings from '../utils/settings.server'

export async function loader () {
  const value = settings.getAll()
  const favorites = await settings.getAllFavorites()
  return json({ ...value, favorites })
}

export async function action ({ request }: ActionArgs) {
  const form = await request.formData()
  switch (form.get('_action')) {
    case 'updateSetting': {
      const key = form.get('key')
      const value = form.get('value')
      if (typeof key !== 'string' || typeof value !== 'string') return
      switch (key) {
        case 'darkmode':
          settings.update('darkmode', value === 'true')
          break
        case 'datadir':
        case 'name':
        case 'color':
          settings.update(key, value)
          break
        default: {
          throw new Error('unknown setting key')
        }
      }
      break
    }
    case 'removeFavorite': {
      const type = form.get('type')
      const id = form.get('id')
      if (typeof type !== 'string' || typeof id !== 'string') return
      settings.toggleFavorite(type, id)
      break
    }
    case 'reorderFavorite': {
      const index = +(form.get('index') || 'NaN')
      const to = +(form.get('to') || 'NaN')
      if (isNaN(index) || isNaN(to)) return
      settings.reorderFavorite(index, to)
      break
    }
    default: {
      throw new Error('unknown action')
    }
  }
  return null
}

export default function Settings () {
  const data = useLoaderData<typeof loader>()
  const fetcher = useFetcher()
  return (
    <div className='flex max-w-md flex-col gap-4 p-4'>
      <h1 className='flex items-center gap-4 pb-4 text-2xl'>
        <Link to='/' className='hover:text-blue-500'>
          <Icons.HomeModern className='h-8 w-8' />
        </Link>
        <Icons.ChevronRight className='h-4 w-4' />
        <span>Settings</span>
      </h1>
      <Toggle
        id='dark-mode'
        label='Dark mode'
        enabled={data.darkmode}
        onChange={() =>
          fetcher.submit(
            { _action: 'updateSetting', key: 'darkmode', value: !data.darkmode },
            { method: 'post' }
          )
        }
      />
      <Input
        id='datadir'
        label='Data directory'
        value={data.datadir}
        onChange={e =>
          fetcher.submit(
            { _action: 'updateSetting', key: 'datadir', value: e.target.value },
            { method: 'post' }
          )
        }
      />
      <Input
        id='name'
        label='Name'
        value={data.name}
        onChange={e =>
          fetcher.submit(
            { _action: 'updateSetting', key: 'name', value: e.target.value },
            { method: 'post' }
          )
        }
      />
      <Input
        id='color'
        label='Color'
        type='color'
        value={data.color}
        onChange={e =>
          fetcher.submit(
            { _action: 'updateSetting', key: 'color', value: e.target.value },
            { method: 'post' }
          )
        }
      />
      {!!data.favorites.length && (
        <>
          <div>Favorites</div>
          <DndContext<{ index: number }, { to: number }>
            onMove={e => {
              const dropzone = document.getElementById('dropzone')
              const y = window.scrollY + e.clientY - dropzone?.parentNode?.offsetTop
              let to = Math.floor((y + 36) / 64)
              if (to < 0) to = 0
              if (to > data.favorites.length) to = data.favorites.length
              if (dropzone) dropzone.style.top = -4 + 64 * to + 'px'
              return { to }
            }}
            onDrop={(e, state, dragItem) => {
              if (!state) return
              const dropzone = document.getElementById('dropzone')
              if (dropzone) dropzone.style.top = '-9999px'
              if (dragItem.index === state.to) return
              if (dragItem.index === state.to - 1) return
              fetcher.submit(
                { _action: 'reorderFavorite', index: dragItem.index, to: state.to },
                { method: 'post' }
              )
            }}
            onCancel={() => {
              const dropzone = document.getElementById('dropzone')
              if (dropzone) dropzone.style.top = '-9999px'
            }}
          >
            <div className='relative'>
              <div
                id='dropzone'
                className='absolute left-5 top-[-9999px] h-1 w-96 rounded-full bg-gray-500'
              />
              <FavoriteSettings favorites={data.favorites} />
            </div>
          </DndContext>
        </>
      )}
    </div>
  )
}

interface FavoriteSettingsProps {
  favorites: Favorite[]
}

function FavoriteSettings ({ favorites }: FavoriteSettingsProps) {
  const fetcher = useFetcher()
  const { startDrag, dragItem } = useDragger<{ index: number }>()
  return (
    <div className='flex flex-col gap-1'>
      {favorites.map((f, index) => (
        <div
          key={`${f.type}-${f.id}`}
          className={cx(
            'flex items-center gap-4 rounded-lg p-2 transition-all [&:has(.drag:hover)]:bg-gray-100 [&:has(.drag:hover)]:dark:bg-gray-600',
            { 'opacity-20': index === dragItem?.index }
          )}
          data-index={index}
        >
          <div
            onMouseDown={e => {
              e.preventDefault()
              startDrag({ index })
            }}
          >
            <Icons.Bars2 className='drag h-9 w-9 cursor-grab p-2' />
          </div>
          <FavoriteLink favorite={f} />
          <button
            className='rounded-md bg-red-200 p-3 hover:bg-red-400 dark:bg-red-900 dark:hover:bg-red-800'
            onClick={() =>
              fetcher.submit(
                { _action: 'removeFavorite', type: f.type, id: f.id },
                { method: 'post' }
              )
            }
          >
            <Icons.Trash className='h-5 w-5' />
          </button>
        </div>
      ))}
    </div>
  )
}

interface InputProps {
  id: string
  label: string
  value: string
  type?: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}

function Input ({ id, label, value, onChange, type = 'text' }: InputProps) {
  return (
    <div>
      <label
        htmlFor={id}
        className='block text-sm font-medium leading-6 text-gray-900 dark:text-white'
      >
        {label}
      </label>
      <input
        type={type}
        defaultValue={value}
        name={id}
        id={id}
        onChange={onChange}
        className={cx(
          'block w-full rounded-md border-0 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 dark:bg-slate-700 dark:text-white dark:ring-slate-500 sm:text-sm sm:leading-6',
          { 'py-1.5': type === 'text' }
        )}
      />
    </div>
  )
}

interface ToggleProps {
  id: string
  label: React.ReactNode
  enabled: boolean
  onChange: () => void
}

function Toggle ({ id, enabled, onChange, label }: ToggleProps) {
  return (
    <div className='flex items-center'>
      <button
        type='button'
        className={cx(
          'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2',
          { 'bg-indigo-600': enabled, 'bg-gray-200': !enabled }
        )}
        role='switch'
        aria-checked={enabled}
        aria-labelledby={id}
        onClick={onChange}
      >
        <span
          className={cx(
            'pointer-events-none relative inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
            { 'translate-x-5': enabled, 'translate-x-0': !enabled }
          )}
        >
          <span
            className={cx(
              'absolute inset-0 flex h-full w-full items-center justify-center transition-opacity',
              {
                'opacity-0 duration-100 ease-out': enabled,
                'opacity-100 duration-200 ease-in': !enabled
              }
            )}
            aria-hidden='true'
          >
            <svg className='h-3 w-3 text-gray-400' fill='none' viewBox='0 0 12 12'>
              <path
                d='M4 8l2-2m0 0l2-2M6 6L4 4m2 2l2 2'
                stroke='currentColor'
                strokeWidth='2'
                strokeLinecap='round'
                strokeLinejoin='round'
              />
            </svg>
          </span>
          <span
            className={cx(
              'absolute inset-0 flex h-full w-full items-center justify-center transition-opacity',
              {
                'opacity-100 duration-200 ease-in': enabled,
                'opacity-0 duration-100 ease-out': !enabled
              }
            )}
            aria-hidden='true'
          >
            <svg className='h-3 w-3 text-indigo-600' fill='currentColor' viewBox='0 0 12 12'>
              <path d='M3.707 5.293a1 1 0 00-1.414 1.414l1.414-1.414zM5 8l-.707.707a1 1 0 001.414 0L5 8zm4.707-3.293a1 1 0 00-1.414-1.414l1.414 1.414zm-7.414 2l2 2 1.414-1.414-2-2-1.414 1.414zm3.414 2l4-4-1.414-1.414-4 4 1.414 1.414z' />
            </svg>
          </span>
        </span>
      </button>

      <span className='ml-3 text-sm font-medium text-gray-900 dark:text-white' id={id}>
        {label}
      </span>
    </div>
  )
}
