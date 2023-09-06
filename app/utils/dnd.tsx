import React from 'react'

interface DndContext {
  setDragging: Function
  dragging: any
}

const context = React.createContext<DndContext>({})

interface DnDContextProps {
  children: React.ReactNode
  onMove: Function
  onDrop: Function
  onCancel: Function
}

export function DndContext ({
  children,
  onMove,
  onDrop,
  onCancel
}: DnDContextProps) {
  const [dragging, setDragging] = React.useState(null)
  const dragRef = React.useRef({ dragging: null })
  dragRef.current.dragging = dragging

  React.useEffect(() => {
    let state: any
    function handleKeydown (e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setDragging(null)
        state = null
        onCancel()
      }
    }
    function handleMousemove (e: MouseEvent) {
      if (!dragRef.current.dragging) return
      state = onMove(e)
    }
    function handleMouseup (e: MouseEvent) {
      if (!dragRef.current.dragging) return
      onDrop(e, state, dragRef.current.dragging)
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
    <context.Provider value={{ dragging, setDragging }}>
      {children}
    </context.Provider>
  )
}

export function useDragger () {
  const { dragging, setDragging } = React.useContext(context)
  return [setDragging, dragging]
}
