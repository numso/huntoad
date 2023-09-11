import React from 'react'

interface FocusDetails {
  id: string
  position: Position
  type: string
}
type Position = 'start' | 'end' | 'current' | number
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
    const el = document.getElementById(key) as HTMLDivElement
    if (!id || !el) return
    const pos = getPosition(position, el)
    el.focus()
    setPosition(el, pos)
  }

  const focusAfterMount = (id: _string, position: Position, type = 'item') => {
    if (!id || !ref) return
    position = resolveCurrent(position)
    ref.current = { id, position, type }
  }

  return { focus, focusAfterMount }
}

function resolveCurrent (position: Position): Position {
  if (position !== 'current') return position
  const selection = window.getSelection() as Selection
  return selection.anchorOffset
}

function getPosition (position: Position, el: HTMLElement): number {
  if (position === 'start') return 0
  if (position === 'end') return el.textContent?.length || 0
  if (position === 'current') {
    const selection = window.getSelection() as Selection
    return selection.anchorOffset
  }
  return position
}

function setPosition (el: HTMLDivElement, position: number) {
  const node = el.firstChild
  if (!node) return
  const range = document.createRange()
  range.setStart(node, position)
  range.setEnd(node, position)
  const selection = window.getSelection() as Selection
  selection.removeAllRanges()
  selection.addRange(range)
}
