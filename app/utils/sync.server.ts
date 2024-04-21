import crypto from 'node:crypto'
import { io } from 'socket.io-client'

import * as settings from './settings.server'
import type { Item } from './types'

const g = global as any

export function connected () {
  return !!g.url
}

export async function init (url: string, db: any, fs: any) {
  if (!url) return false
  if (g.url === url) return true
  g.url = ''
  g.__shares__ = {}
  return new Promise(resolve => {
    g.socket?.disconnect()
    const timeout = setTimeout(() => resolve(false), 3000)
    g.socket = io(url, {
      query: {
        name: settings.get('name'),
        color: settings.get('color')
      }
    })
    g.socket.on('connect', () => {
      clearTimeout(timeout)
      resolve(true)
      g.db = db
      g.fs = fs
      g.url = url
      setupPresence()
      setup()
    })
    g.socket.on('connect_error', () => {
      clearTimeout(timeout)
      resolve(false)
      g.socket.disconnect()
    })
    g.socket.on('disconnect', () => {
      g.url = ''
    })
  })
}

export async function share (id: string, data) {
  return new Promise((resolve, reject) => {
    const secret = crypto.randomBytes(20).toString('hex')
    g.socket.emit('share', { id, secret, data }, async status => {
      if (status === 'ok') {
        const allItems = await g.db.loadItems()
        g.__shares__[id] = gatherShareIds(allItems, id)
        resolve(secret)
      } else reject(status)
    })
  })
}

export async function join (id: string, secret: string) {
  return new Promise((resolve, reject) => {
    g.socket.emit('join', { id, secret, version: -1 }, async (status, records) => {
      if (status === 'ok') {
        const allItems = await doJoin(id, records)
        const item = allItems.find(i => i.id == id)
        delete item.parentId
        item.order = allItems.filter(i => !i.parentId).length
        item.share = secret
        item.share_type = 'join'
        const [_, contents] = g.db.encode(item)
        g.fs.writeFile(id, contents, true)
        resolve(null)
      } else reject(status)
    })
  })
}

async function setup () {
  const allItems = await g.db.loadItems()
  const sharedItems = allItems.filter(item => item.share)
  for (const item of sharedItems) {
    g.socket.emit('join', { id: item.id, secret: item.share }, async (status, records) => {
      if (status === 'ok') {
        await doJoin(item.id, records)
        console.log(`Joined share: ${item.id}`)
        g.io.emit('refresh')
        setTimeout(() => {
          // this timeout won't be needed once we call setup on server start
          g.io.emit('refresh')
        }, 1000)
      } else {
        console.error(`failed to join share: ${item.id}, reason: ${status}`)
      }
    })
  }
  g.socket.on('update', async ({ id, type, data }) => {
    await doUpdate(id, type, data)
    g.io.emit('refresh')
  })
}

async function doJoin (id, records) {
  for (const row of Object.values(records)) {
    if (row.deleted) continue
    await doUpdate(id, 'WRITEFILE', row)
  }
  const allItems = await g.db.loadItems()
  g.__shares__[id] = gatherShareIds(allItems, id)
  for (const row of Object.values(records)) {
    if (row.deleted && g.__shares__[id].includes(row.id)) {
      await doUpdate(id, 'RM', row)
      g.__shares__[id] = g.__shares__[id].filter(i => i !== row.id)
    }
  }
  const serverIds = Object.keys(records)
  for (const itemId of g.__shares__[id]) {
    if (!serverIds.includes(itemId)) {
      const item = allItems.find(i => i.id == itemId)
      const [_, contents] = g.db.encode(item)
      writeFile(id, itemId, contents)
    }
  }
  return allItems
}

async function doUpdate (id, type, data) {
  switch (type) {
    case 'WRITEFILE': {
      if (data.id === id) {
        await savePartial(data.id, data.contents, [
          'order',
          'share',
          'share_type',
          'parentId',
          'collapsed'
        ])
      } else {
        await savePartial(data.id, data.contents, ['collapsed'])
      }
      break
    }
    case 'RM': {
      await g.fs.rm(data.id, true)
      break
    }
    default: {
      console.error({ id, type, data })
      throw new Error(`UNKNOWN STATE: ${type}`)
    }
  }
}

async function savePartial (id, contents, omitList) {
  const newItem = g.db.decode(contents, '')
  const existingItem = (await g.db.getItem(id)) || {}
  for (const key in newItem) {
    if (omitList.includes(key)) continue
    existingItem[key] = newItem[key]
  }
  const [_, contents2] = g.db.encode(existingItem)
  return g.fs.writeFile(id, contents2, true)
}

function flattenItems (item: Item): Item[] {
  return [item, ...item.children.flatMap(flattenItems)]
}

function gatherShareIds (items: Item[], id: string) {
  function populateChildren (item: Item): void {
    item.children = items.filter(i => i.parentId == item.id)
    item.children.map(populateChildren)
  }
  const item = items.find(i => i.id == id)
  populateChildren(item)
  return flattenItems(item).map(i => i.id)
}

export async function sync (id: string, syncServer: boolean) {
  if (!connected()) return
  const allItems = await g.db.loadItems()
  for (const share in g.__shares__) {
    const currentIds = g.__shares__[share]
    const newIds = gatherShareIds(allItems, share)
    g.__shares__[share] = newIds
    if (currentIds.includes(id) || newIds.includes(id)) {
      if (!syncServer) {
        for (const id of currentIds) {
          if (!newIds.includes(id)) {
            rm(share, id)
          }
        }
        for (const id of newIds) {
          if (!currentIds.includes(id)) {
            const item = allItems.find(i => i.id == id)
            const [_, contents] = g.db.encode(item)
            writeFile(share, id, contents)
          }
        }
        if (currentIds.includes(id) && newIds.includes(id)) {
          const item = allItems.find(i => i.id == id)
          const [_, contents] = g.db.encode(item)
          writeFile(share, id, contents)
        }
      }
    }
  }
}

async function rm (share, id) {
  g.socket.emit('update', { id: share, type: 'RM', data: { id } })
}

async function writeFile (share, id, contents) {
  g.socket.emit('update', { id: share, type: 'WRITEFILE', data: { id, contents } })
}

async function setupPresence () {
  let data = {}
  g.socket.on('presence', async users => {
    data = users
    g.io.emit('presence', data)
  })
  g.socket.on('user:join', async user => {
    data[user.id] = user
    g.io.emit('presence', data)
  })
  g.socket.on('user:update', async user => {
    data[user.id] = user
    g.io.emit('presence', data)
  })
  g.socket.on('user:leave', async id => {
    delete data[id]
    g.io.emit('presence', data)
  })
  g.io.on('connection', socket => {
    socket.on('presence', () => {
      socket.emit('presence', data)
    })
    socket.on('focus', id => {
      g.socket.emit('user:focus', id)
    })
  })
}

export function updateUser (key, value) {
  if (!connected()) return
  if (key === 'name') g.socket.emit('user:update', { name: value })
  if (key === 'color') g.socket.emit('user:update', { color: value })
}
