import React from 'react'

type SetShortcutFunc = (key: string, fn: Function) => void
type ShortcutsMap = { [key: string]: Function }

const context = React.createContext<SetShortcutFunc | null>(null)

interface ShortcutsProps {
  children: React.ReactNode
}

export function Shortcuts ({ children }: ShortcutsProps) {
  const [shortcuts, setShortcuts] = React.useState<ShortcutsMap>({})
  React.useEffect(() => {
    function checkShortcut (e: KeyboardEvent) {
      for (const key in shortcuts) {
        if (e.key === key) shortcuts[key]()
      }
    }
    window.addEventListener('keydown', checkShortcut)
    return () => {
      window.removeEventListener('keydown', checkShortcut)
    }
  }, [shortcuts])

  const setShortcut: SetShortcutFunc = React.useCallback(function setShortcut (key, fn) {
    setShortcuts(shortcuts => ({ ...shortcuts, [key]: fn }))
    return () => {
      setShortcuts(shortcuts => {
        const newShortcuts = { ...shortcuts }
        delete newShortcuts[key]
        return newShortcuts
      })
    }
  }, [])

  return <context.Provider value={setShortcut}>{children}</context.Provider>
}

export function useShortcut (key: string, fn: Function) {
  const setShortcut = React.useContext(context)
  React.useEffect(() => setShortcut?.(key, fn), [])
}
