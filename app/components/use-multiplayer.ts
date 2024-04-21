import { useRevalidator } from '@remix-run/react'
import React from 'react'

export function useMultiplayer () {
  const [presence, setPresence] = React.useState({})
  const revalidator = useRevalidator()
  React.useEffect(() => {
    window.socket.on('refresh', () => {
      revalidator.revalidate()
    })
    window.socket.on('presence', setPresence)
    window.socket.emit('presence')
  }, [])
  const byFocused = {}
  for (const user of Object.values(presence)) {
    if (!user.focus) continue
    byFocused[user.focus] ??= []
    byFocused[user.focus].push(user)
  }
  const setFocus = id => window.socket.emit('focus', id)
  return [presence, byFocused, setFocus]
}
