import React from 'react'

const context = React.createContext<unknown>(null)

interface DnDContextProps<DropState, DragItem> {
  children: React.ReactNode
  onMove: (e: MouseEvent) => DropState | null
  onDrop: (e: MouseEvent, state: DropState | null, dragging: DragItem) => void
  onCancel: () => void
}

export function DndContext <DragItem, DropState>({
  children,
  onMove,
  onDrop,
  onCancel
}: DnDContextProps<DropState, DragItem>): React.ReactNode {
  const [dragging, setDragging] = React.useState<DragItem | null>(null)
  const dragRef = React.useRef<DragItem | null>(null)
  dragRef.current = dragging

  React.useEffect(() => {
    let state: DropState | null
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

interface ContextValue<DragItem> {
  startDrag: (value: DragItem) => void
  dragItem: DragItem | null
}

export function useDragger <DragItem>(): ContextValue<DragItem> {
  return React.useContext(context) as ContextValue<DragItem>
}
