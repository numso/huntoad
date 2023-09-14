import React from 'react'

import type { Item } from '../utils/db.server'

type State = [string, string] | null
type _Item = Item | null
interface DndContext {
  startDrag: (value: _Item) => void
  dragItem: _Item
}
type _DndContext = DndContext | null

const context = React.createContext<_DndContext>(null)

interface DnDContextProps {
  children: React.ReactNode
  onMove: (e: MouseEvent) => State
  onDrop: (e: MouseEvent, state: State, dragging: Item) => void
  onCancel: () => void
}

export function DndContext ({
  children,
  onMove,
  onDrop,
  onCancel
}: DnDContextProps): React.ReactNode {
  const [dragging, setDragging] = React.useState<_Item>(null)
  const dragRef = React.useRef<_Item>(null)
  dragRef.current = dragging

  React.useEffect(() => {
    let state: State
    function handleKeydown (e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setDragging(null)
        state = null
        onCancel()
      }
    }
    function handleMousemove (e: MouseEvent) {
      if (!dragRef.current) return
      state = onMove(e)
    }
    function handleMouseup (e: MouseEvent) {
      if (!dragRef.current) return
      onDrop(e, state, dragRef.current)
      setDragging(null)
      state = null
    }

    document.addEventListener('keydown', handleKeydown)
    document.addEventListener('mousemove', handleMousemove)
    document.addEventListener('mouseup', handleMouseup)
    return () => {
      document.removeEventListener('keydown', handleKeydown)
      document.removeEventListener('mousemove', handleMousemove)
      document.removeEventListener('mouseup', handleMouseup)
    }
  }, [])
  return (
    <context.Provider value={{ startDrag: setDragging, dragItem: dragging }}>
      {children}
    </context.Provider>
  )
}

export function useDragger (): _DndContext {
  return React.useContext(context)
}
