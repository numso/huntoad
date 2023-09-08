import React from 'react'

type Position = 'start' | 'end' | 'current' | number

const context = React.createContext<any>(null)

export function FocusManager ({ children }) {
  const ref = React.useRef()
  return <context.Provider value={ref}>{children}</context.Provider>
}

export function useFocuser (id: string) {
  const ref = React.useContext(context)
  React.useEffect(() => {
    if (ref.current?.id === id || ref.current?.id === 'new') {
      const { position, type } = ref.current
      focus(id, position, type)
      ref.current = null
    }
  }, [])

  const focus = (
    id: string | undefined,
    position: Position = 'start',
    type = 'item'
  ) => {
    if (!id) return
    const elem = document.getElementById(`${type}-${id}`)
    if (!elem) return
    elem.focus()
    position = getPosition(position, elem)
    elem.setSelectionRange(position, position)
  }

  const focusAfterMount = (
    id: string | undefined,
    position: Position = 'start',
    type = 'item'
  ) => {
    if (!id) return
    const elem = document.getElementById(`${type}-${id}`)
    position = getPosition(position, elem)
    ref.current = { id, position, type }
  }

  return [focus, focusAfterMount]
}

function getPosition (position: Position, elem) {
  if (position === 'start') return 0
  if (position === 'end') return elem.value.length
  if (position === 'current') return elem.selectionStart
  return position
}
