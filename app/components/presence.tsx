import cx from 'clsx'
import React from 'react'

export function Presence ({ presence }) {
  return (
    <ul className='flex gap-2'>
      {Object.values(presence).map(user => (
        <PresenceUser key={user.id} user={user} />
      ))}
    </ul>
  )
}

export function PresenceUser ({ user, small }) {
  const initial = (user.name || '')[0] || '?'
  const color = user.color || '#ddd'
  return (
    <div
      className={cx('rounded-full border-zinc-600 flex items-center justify-center', {
        'border w-4 h-4 text-[8px]': small,
        'border-2 w-10 h-10': !small,
        'opacity-50': !user.focus
      })}
      style={{ background: color }}
    >
      {initial}
    </div>
  )
}
