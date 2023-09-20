import cx from 'clsx'
import React from 'react'

import * as Icons from './icons'

const id = () => 'id-' + Math.floor(Math.random() * 9999999)

interface Toast {
  id: string
  text: string
}

interface ToasterProps {
  children: React.ReactNode
}

const context = React.createContext<unknown>(null)

export function Toaster ({ children }: ToasterProps) {
  const [toasts, setToasts] = React.useState<Toast[]>([])
  const addToast = React.useCallback(
    (text: string) => setToasts(toasts => [{ id: id(), text }, ...toasts]),
    []
  )
  return (
    <context.Provider value={addToast}>
      <div aria-live='assertive' className='pointer-events-none fixed inset-0 z-10 sm:px-6'>
        <div className='flex w-full flex-col items-center sm:items-end'>
          {toasts.map((t, i) => (
            <Toast
              key={t.id}
              text={t.text}
              i={i}
              clear={() => setToasts(toasts => toasts.filter(({ id }) => id !== t.id))}
            />
          ))}
        </div>
      </div>
      {children}
    </context.Provider>
  )
}

export function useToast () {
  return React.useContext(context) as (text: string) => void
}

interface ToastProps {
  text: string
  i: number
  clear: () => void
}

function Toast ({ text, i, clear }: ToastProps) {
  const [state, setState] = React.useState('enter')
  React.useEffect(() => {
    setTimeout(() => setState('entering'), 0)
    setTimeout(() => setState('leave'), 3000)
    setTimeout(() => setState('leaving'), 3001)
    setTimeout(() => clear(), 3300)
  }, [])
  return (
    <div
      className={cx(
        'pointer-events-auto absolute bottom-[--alert-position] w-full max-w-sm overflow-hidden rounded-lg bg-white shadow-lg ring-1 ring-black ring-opacity-5 transition-all duration-300 sm:bottom-auto sm:top-[--alert-position]',
        {
          'transform ease-out': state === 'enter' || state === 'entering',
          'translate-y-2 opacity-0 sm:translate-x-2 sm:translate-y-0': state === 'enter',
          'translate-y-0 opacity-100 sm:translate-x-0': state === 'entering',

          'ease-in': state === 'leave' || state === 'leaving',
          'opacity-100': state === 'leave',
          'opacity-0': state === 'leaving'
        }
      )}
      style={{ '--alert-position': 20 + i * 70 + 'px' } as React.CSSProperties}
    >
      <div className='p-4'>
        <div className='flex items-center gap-2'>
          <Icons.CircleCheck className='h-5 w-5 text-green-600' />
          <p className='w-0 flex-1 text-sm font-medium text-gray-900'>{text}</p>
        </div>
      </div>
    </div>
  )
}
