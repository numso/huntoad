import crypto from 'node:crypto'
import { io } from 'socket.io-client'

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
    g.socket = io(url)
    g.socket.on('connect', () => {
      clearTimeout(timeout)
      resolve(true)
      g.db = db
      g.fs = fs
      g.url = url
      setup()
    })
    g.socket.on('connect_error', () => {
      clearTimeout(timeout)
      resolve(false)
      g.socket.disconnect()
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
    g.socket.emit('join', { id, secret, version: -1 }, async status => {
      if (status === 'ok') {
        const allItems = await g.db.loadItems()
        g.__shares__[id] = gatherShareIds(allItems, id)
        const item = allItems.find(i => i.id == id)
        delete item.parentId
        item.order = allItems.filter(i => !i.parentId).length
        item.share = secret
        item.share_type = 'join'
        const [_, contents] = g.db.encode(item)
        g.fs.writeFile(id, contents, true)
        resolve(secret)
      } else reject(status)
    })
  })
}

async function setup () {
  const allItems = await g.db.loadItems()
  const sharedItems = allItems.filter(item => item.share)
  for (const item of sharedItems) {
    g.socket.emit('join', { id: item.id, secret: item.share }, status => {
      if (status === 'ok') console.log(`Joined share: ${item.id}`)
      else console.error(`failed to join share: ${item.id}, reason: ${status}`)
    })
    g.__shares__[item.id] = gatherShareIds(allItems, item.id)
  }

  g.socket.on('update', async ({ id, type, data }) => {
    switch (type) {
      case 'WRITEFILE': {
        if (data.id === id) {
          savePartial(data.id, data.contents, [
            'order',
            'share',
            'share_type',
            'parentId',
            'collapsed'
          ])
        } else {
          savePartial(data.id, data.contents, ['collapsed'])
        }
        break
      }
      case 'RM': {
        g.fs.rm(data.id, true)
        break
      }
      default: {
        console.error({ id, type, data })
        throw new Error(`UNKNOWN STATE: ${type}`)
      }
    }
  })
}

async function savePartial (id, contents, omitList) {
  const newItem = g.db.decode(contents, '')
  const existingItem = (await g.db.getItem(id)) || {}
  for (const key in newItem) {
    if (omitList.includes(key)) continue
    existingItem[key] = newItem[key]
  }
  const [_, contents2] = g.db.encode(existingItem)
  g.fs.writeFile(id, contents2, true)
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
