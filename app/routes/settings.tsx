import type { ActionArgs } from '@remix-run/node'
import { json } from '@remix-run/node'
import { useFetcher, useLoaderData } from '@remix-run/react'
import cx from 'clsx'
import React from 'react'

import * as settings from '../utils/settings.server'

export function loader () {
  const value = settings.getAll()
  return json(value)
}

export async function action ({ request }: ActionArgs) {
  const form = await request.formData()
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
  }
  return null
}

export default function Settings () {
  const data = useLoaderData<typeof loader>()
  const fetcher = useFetcher()
  return (
    <div className='flex max-w-sm flex-col gap-4 p-4'>
      <h1 className='pb-4 text-2xl'>Settings</h1>
      <Toggle
        id='dark-mode'
        label='Dark mode'
        enabled={data.darkmode}
        onChange={() =>
          fetcher.submit({ key: 'darkmode', value: !data.darkmode }, { method: 'post' })
        }
      />
      <Input
        id='datadir'
        label='Data directory'
        value={data.datadir}
        onChange={e =>
          fetcher.submit({ key: 'datadir', value: e.target.value }, { method: 'post' })
        }
      />
      <Input
        id='name'
        label='Name'
        value={data.name}
        onChange={e => fetcher.submit({ key: 'name', value: e.target.value }, { method: 'post' })}
      />
      <Input
        id='color'
        label='Color'
        type='color'
        value={data.color}
        onChange={e => fetcher.submit({ key: 'color', value: e.target.value }, { method: 'post' })}
      />
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
      <label htmlFor={id} className='block text-sm font-medium leading-6 text-gray-900'>
        {label}
      </label>
      <input
        type={type}
        defaultValue={value}
        name={id}
        id={id}
        onChange={onChange}
        className={cx(
          'block w-full rounded-md border-0 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6',
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

      <span className='ml-3 text-sm font-medium text-gray-900' id={id}>
        {label}
      </span>
    </div>
  )
}
