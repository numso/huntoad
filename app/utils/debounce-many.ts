export default function debounceMany (fn: Function, ms: number) {
  interface DebounceCache {
    [key: string]: { timeout: NodeJS.Timeout; resolves: Function[] } | undefined
  }

  const myCache: DebounceCache = {}

  function debouncedFn (key: string, ...args: any) {
    return new Promise(resolve => {
      const resolves = [...resetCache(key), resolve]
      const timeout = setTimeout(() => {
        delete myCache[key]
        fn(key, ...args).then(() => resolves.map(fn => fn()))
      }, ms)
      myCache[key] = { timeout, resolves }
    })
  }

  function resetCache (key: string) {
    const pendingFile = myCache[key]
    if (!pendingFile) return []
    const { timeout, resolves } = pendingFile
    clearTimeout(timeout)
    delete myCache[key]
    return resolves
  }

  function clearCache (key: string) {
    const resolves = resetCache(key)
    resolves.map(fn => fn())
  }

  return { fn: debouncedFn, clear: clearCache }
}
