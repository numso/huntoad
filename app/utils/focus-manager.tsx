import React from 'react'

interface FocusDetails {
  id: string
  position: number
  type: string
}
type Position = 'start' | 'end' | 'current' | number
type _HTMLInputElement = HTMLInputElement | undefined
type _FocusDetails = FocusDetails | null
type _string = string | undefined

const context = React.createContext<React.MutableRefObject<_FocusDetails> | null>(null)

interface FocusManagerProps {
  children: React.ReactNode
}

export function FocusManager ({ children }: FocusManagerProps) {
  const ref = React.useRef<_FocusDetails>(null)
  return <context.Provider value={ref}>{children}</context.Provider>
}

export function useFocuser (id: string) {
  const ref = React.useContext(context)
  React.useEffect(() => {
    if (ref?.current?.id === id || ref?.current?.id === 'new') {
      const { position, type } = ref.current
      focus(id, position, type)
      ref.current = null
    }
  }, [])

  const focus = (id: _string, position: Position, type = 'item') => {
    const key = `${type}-${id}`
    const el = document.getElementById(key) as _HTMLInputElement
    if (!id || !el) return
    position = getPosition(position, el)
    el.focus()
    el.setSelectionRange(position, position)
  }

  const focusAfterMount = (id: _string, position: Position, type = 'item') => {
    if (!id || !ref) return
    position = getPosition(position, `${type}-${id}`)
    ref.current = { id, position, type }
  }

  return [focus, focusAfterMount]
}

function getPosition (position: Position, elementOrKey: string | HTMLInputElement): number {
  if (position === 'start') return 0
  if (typeof position == 'number') return position

  let el: _HTMLInputElement
  if (typeof elementOrKey === 'string') {
    el = document.getElementById(elementOrKey) as _HTMLInputElement
  } else {
    el = elementOrKey
  }

  if (el && position === 'end') return el.value.length
  if (el && position === 'current') return el.selectionStart || 0
  return 0
}
