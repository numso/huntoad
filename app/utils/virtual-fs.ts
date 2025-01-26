import fs from 'node:fs/promises'
import pathmodule from 'node:path'

import debounceMany from './debounce-many'
import * as settings from './settings.server'

// import * as sync from './sync.server'

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

export async function readdir (_path: string, encoding: 'utf-8') {
  const path = pathmodule.join(settings.get('datadir') as string, 'notes')
  const { directories } = getCache()
  if (!directories[path]) directories[path] = await fs.readdir(path, encoding)
  return directories[path]
}

export async function readFile (id: string, encoding: 'utf-8') {
  const datadir = pathmodule.join(settings.get('datadir') as string, 'notes')
  const path = pathmodule.join(datadir, `${id}.md`)
  const { files } = getCache()
  if (!files[path]) files[path] = await fs.readFile(path, encoding)
  return files[path]
}

const { fn: debouncedWriteFile, clear: clearCache } = debounceMany(fs.writeFile, 1_000)

export async function writeFile (id: string, contents: string, syncServer: boolean = false) {
  const datadir = pathmodule.join(settings.get('datadir') as string, 'notes')
  const path = pathmodule.join(datadir, `${id}.md`)
  const { directories, files } = getCache()
  const directory = directories[pathmodule.dirname(path)]
  if (!files[path] && directory) {
    directory.push(pathmodule.basename(path))
  }
  files[path] = contents

  // await sync.sync(id, syncServer)
  if (syncServer) {
    fs.writeFile(path, contents)
  } else {
    // if you await this then actions take a while which delays loader getting called again. Makes the UI a little buggy
    debouncedWriteFile(path, contents)
  }
}

export async function rm (id: string, syncServer: boolean = false) {
  const datadir = pathmodule.join(settings.get('datadir') as string, 'notes')
  const path = pathmodule.join(datadir, `${id}.md`)
  const { directories, files } = getCache()
  const directory = directories[pathmodule.dirname(path)]
  if (directory) {
    const i = directory.findIndex(p => p === pathmodule.basename(path))
    directory.splice(i, 1)
  }
  delete files[path]
  clearCache(path)
  // await sync.sync(id, syncServer)
  // because we debounce writes, we might be deleting an item that was never persisted to disk
  return fs.rm(path).catch(() => null)
}
