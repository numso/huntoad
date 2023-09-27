import fs from 'node:fs/promises'
import pathmodule from 'node:path'

import debounceMany from './debounce-many'

interface Global {
  __huntoad__: {
    directories: { [path: string]: string[] | undefined }
    files: { [path: string]: string | undefined }
  }
}

function getCache () {
  const g: Global = global as any
  if (!g.__huntoad__) g.__huntoad__ = { directories: {}, files: {} }
  return g.__huntoad__
}

export async function readdir (path: string, encoding: 'utf-8') {
  const { directories } = getCache()
  if (!directories[path]) directories[path] = await fs.readdir(path, encoding)
  return directories[path]
}

export async function readFile (path: string, encoding: 'utf-8') {
  const { files } = getCache()
  if (!files[path]) files[path] = await fs.readFile(path, encoding)
  return files[path]
}

const { fn: debouncedWriteFile, clear: clearCache } = debounceMany(fs.writeFile, 1_000)

export async function writeFile (path: string, contents: string) {
  const { directories, files } = getCache()
  const directory = directories[pathmodule.dirname(path)]
  if (!files[path] && directory) {
    directory.push(pathmodule.basename(path))
  }
  files[path] = contents
  // if you await this then actions take a while which delays loader getting called again. Makes the UI a little buggy
  debouncedWriteFile(path, contents)
}

export async function rm (path: string) {
  const { directories, files } = getCache()
  const directory = directories[pathmodule.dirname(path)]
  if (directory) {
    const i = directory.findIndex(p => p === pathmodule.basename(path))
    directory.splice(i, 1)
  }
  delete files[path]
  clearCache(path)
  // because we debounce writes, we might be deleting an item that was never persisted to disk
  return fs.rm(path).catch(() => null)
}
