import fm from 'front-matter'
import path from 'node:path'
import * as uuid from 'uuid'

import * as listActions from './list-actions'
import * as sync from './sync.server'
import type { FrontMatterObject, Item } from './types'
import * as fs from './virtual-fs'

export async function loadItems (): Promise<Item[]> {
  const files = await fs.readdir('/', 'utf-8')
  const items = []
  for (const file of files) {
    if (file === '.keep') continue
    const raw = await fs.readFile(file.replace('.md', ''), 'utf-8')
    items.push(decode(raw, file))
  }
  items.sort((a, b) => a.order - b.order)
  return items
}

export async function getItem (id: string): Promise<Item | null> {
  try {
    const raw = await fs.readFile(id, 'utf-8')
    return decode(raw, id)
  } catch {
    return null
  }
}

const oneDayInMilliseconds = 24 * 60 * 60 * 1000

export async function getItemsForMonth (month: number, year: number) {
  const items = await loadItems()
  return items.filter(i => {
    return !!i.dates
      .map(d => new Date(d))
      .filter(d => d.getFullYear() === year && d.getMonth() === month).length
  })
}

export async function getItemsForWeek (date: Date) {
  const items = await loadItems()
  return items.filter(i => {
    return !!i.dates
      .map(d => {
        let date = new Date(d)
        date = new Date(+date - date.getDay() * oneDayInMilliseconds)
        return date
      })
      .filter(d => +d === +date).length
  })
}

export async function getItemsForDay (month: number, day: number, year: number) {
  const items = await loadItems()
  return items.filter(i => {
    return !!i.dates
      .map(d => new Date(d))
      .filter(d => d.getFullYear() === year && d.getDate() === day && d.getMonth() === month).length
  })
}

export function decode (raw: string, file: string): Item {
  const formatted = fm<FrontMatterObject>(raw)
  if (!formatted.attributes.tags) formatted.attributes.tags = []
  if (!formatted.attributes.dates) formatted.attributes.dates = []
  return {
    ...formatted.attributes,
    body: formatted.body,
    id: file.replace('.md', ''),
    children: []
  }
}

export function encode (item: Item): [string, string] {
  const { id, body, children, ...attributes } = item
  return [id, `${writeFrontMatter(attributes)}\n${body || ''}`]
}

function parseTags (title: string): string[] {
  return [...new Set([...title.matchAll(/#([\S]+)/g)].map(a => a[1]))]
}

function parseDates (title: string): string[] {
  return [...new Set([...title.matchAll(/:(\d{1,2}-\d{1,2}-\d{4})/g)].map(a => a[1]))]
}

export async function updateTitle (id: string, title: string) {
  const contents = await fs.readFile(id, 'utf-8')
  const res = fm<FrontMatterObject>(contents)
  res.attributes.title = title
  res.attributes.tags = parseTags(title)
  res.attributes.dates = parseDates(title)
  const newContents = `${writeFrontMatter(res.attributes)}\n${res.body}`
  await fs.writeFile(id, newContents)
}

export async function updateBody (id: string, body: string) {
  const raw = await fs.readFile(id, 'utf-8')
  const item = decode(raw, id)
  item.body = body
  const [, contents] = encode(item)
  await fs.writeFile(id, contents)
}

export async function setCompleted (id: string, completed: boolean) {
  const contents = await fs.readFile(id, 'utf-8')
  const res = fm<FrontMatterObject>(contents)
  res.attributes.completed = completed
  const newContents = `${writeFrontMatter(res.attributes)}\n${res.body}`
  await fs.writeFile(id, newContents)
}

export async function setCollapsed (id: string, collapsed: boolean) {
  const contents = await fs.readFile(id, 'utf-8')
  const res = fm<FrontMatterObject>(contents)
  res.attributes.collapsed = collapsed
  const newContents = `${writeFrontMatter(res.attributes)}\n${res.body}`
  await fs.writeFile(id, newContents)
}

export async function share (id: string) {
  const items = await loadItems()
  function populateChildren (item: Item): void {
    item.children = items.filter(i => i.parentId == item.id)
    item.children.map(populateChildren)
  }
  const item = items.find(i => i.id == id)
  if (item?.share) return item.share
  populateChildren(item)
  const shareItems = flattenItems(item)
  const shareMap = {}
  for (const item of shareItems) {
    const [id, contents] = encode(item)
    shareMap[id] = { id, contents }
  }
  const secret = await sync.share(id, shareMap)
  const contents = await fs.readFile(id, 'utf-8')
  const res = fm<FrontMatterObject>(contents)
  res.attributes.share = secret
  res.attributes.share_type = 'host'
  const newContents = `${writeFrontMatter(res.attributes)}\n${res.body}`
  await fs.writeFile(id, newContents)
  return secret
}

export async function addItem (
  parentId: string | null,
  position: number,
  title: string,
  newId: string
) {
  const items = await loadItems()
  const resp = listActions.addItem(items, newId, parentId, title, position)
  await persist(resp.persist)
  return resp.item
}

export async function moveItem (dragId: string, dropId: string, direction: string) {
  if (dragId === dropId) return
  const items = await loadItems()
  const dragItem = items.find(i => i.id == dragId)
  const dropItem = items.find(i => i.id == dropId)
  if (!dragItem || !dropItem) return

  const siblings = items.filter(i => i.parentId == dragItem.parentId)
  const dragIndex = siblings.findIndex(i => i.id == dragId)
  siblings.splice(dragIndex, 1)
  await reorder(siblings)
  dragItem.parentId = 'TEMP'

  if (direction === 'child') {
    const newSiblings = items.filter(i => i.parentId == dropItem.id)
    newSiblings.unshift(dragItem)
    dragItem.parentId = dropItem.id
    await reorder(newSiblings)
  } else {
    const newSiblings = items.filter(i => i.parentId == dropItem.parentId)
    const dropIndex = newSiblings.findIndex(i => i.id == dropId)
    const index = direction == 'above' ? dropIndex : dropIndex + 1
    newSiblings.splice(index, 0, dragItem)
    dragItem.parentId = dropItem.parentId
    await reorder(newSiblings)
  }
}

export async function deleteItem (id: string) {
  const items = await loadItems()
  const resp = listActions.deleteItem(items, id)
  if (!resp) return
  await fs.rm(resp.item.id)
  await persist(resp.persist)
}

async function reorder (children: Item[]) {
  for (let i = 0; i < children.length; ++i) {
    children[i].order = i
    const [id, contents] = encode(children[i])
    await fs.writeFile(id, contents)
  }
}

async function persist (children: Item[]) {
  for (let i = 0; i < children.length; ++i) {
    const [id, contents] = encode(children[i])
    await fs.writeFile(id, contents)
  }
}

export async function indent (id: string): Promise<void> {
  const items = await loadItems()
  const item = items.find(i => i.id == id)
  if (!item) return
  const siblings = items.filter(i => i.parentId === item.parentId)
  const index = siblings.findIndex(i => i.id == id)
  if (index === 0) return
  const parent = siblings[index - 1]
  parent.collapsed = false
  const newSiblings = items.filter(i => i.parentId === parent.id)
  item.parentId = parent.id
  siblings.splice(index, 1)
  newSiblings.push(item)
  await reorder(siblings)
  await reorder(newSiblings)
}

export async function outdent (id: string, rootId: string | null): Promise<void> {
  const items = await loadItems()
  const item = items.find(i => i.id == id)
  if (!item || item.parentId == rootId) return
  const parent = items.find(i => i.id == item.parentId)
  if (!parent) return
  const siblings = items.filter(i => i.parentId === item.parentId)
  const index = siblings.findIndex(i => i.id == id)
  siblings.splice(index, 1)
  const newSiblings = items.filter(i => i.parentId === parent.parentId)
  const index2 = newSiblings.findIndex(i => i.id == parent.id)
  newSiblings.splice(index2 + 1, 0, item)
  item.parentId = parent.parentId
  await reorder(siblings)
  await reorder(newSiblings)
}

export async function exportToSteris (id: string) {
  const items = await loadItems()
  function populateChildren (item: Item): void {
    item.children = items.filter(i => i.parentId == item.id)
    item.children.map(populateChildren)
  }
  const item =
    id === '' ? { title: 'All Notes', parentId: null, children: [] } : items.find(i => i.id == id)
  if (!item) return ''
  populateChildren(item)
  return `
---
title: ${item.title}
---
${item.children.map(i => toSteris(i, '')).join('\n')}
  `.trim()
}

function toSteris (item: Item, indent: string): string {
  const children = item.children.map(i => toSteris(i, indent + '  '))
  const collapse = item.collapsed ? '<' : '>'
  const complete = item.completed ? 'x' : ' '
  const notes = item.body && `${indent}# ${item.body.replace(/\n/g, '↩')}`
  return [`${indent}${collapse} [${complete}] ${item.title || ''}`, notes, ...children]
    .filter(Boolean)
    .join('\n')
}

export async function importFromSteris (parentId: string, data: string) {
  const items = await loadItems()
  const siblings = items.filter(i => i.parentId === parentId)
  const [a, b, c, ...rawItems] = data.trim().split('\n')
  if (a !== '---' || c !== '---' || !b.startsWith('title: ')) throw new Error('invalid format, 1')
  const title = b.replace('title: ', '')
  const id = uuid.v4()
  const parent = listActions.newItem(id, parentId, title)
  parent.children = fromSteris(rawItems, id, '')
  parent.order = siblings.length
  const newItems = flattenItems(parent)
  for (const item of newItems) {
    const [id, contents] = encode(item)
    await fs.writeFile(id, contents)
  }
}

function flattenItems (item: Item): Item[] {
  return [item, ...item.children.flatMap(flattenItems)]
}

function fromSteris (data: string[], parentId: string, indent: string): Item[] {
  const children = []
  let i = 0
  while (data.length) {
    const item = parseItem(data, indent, parentId, i++)
    if (!item) break
    children.push(item)
    item.children = fromSteris(data, item.id, indent + '  ')
  }
  return children
}

function parseItem (data: string[], indent: string, parentId: string, i: number): Item | false {
  if (!data[0].startsWith(indent)) return false
  let title = data.shift()
  if (!title || !title.startsWith(indent)) throw new Error('invalid format, 2')
  title = title.replace(indent, '')
  let body = ''
  if (data[0]?.startsWith(indent + '# ')) {
    body = data.shift() as string
    body = body.replace(indent + '# ', '').replace(/↩/g, '\n')
  }
  if (title[0] !== '>' && title[0] !== '<') throw new Error('invalid format, 3')
  if (title[1] !== ' ') throw new Error('invalid format, 4')
  if (title[2] !== '[' || title[4] !== ']') throw new Error('invalid format, 5')
  if (title[3] !== 'x' && title[3] !== ' ') throw new Error('invalid format, 6')
  const collapsed = title[0] === '<'
  const completed = title[3] === 'x'
  title = title.slice(6)
  const item = listActions.newItem(uuid.v4(), parentId, title)
  item.collapsed = collapsed
  item.completed = completed
  item.body = body
  item.order = i
  return item
}

interface StringKeyMap {
  [key: string]: string | string[] | boolean | number | null
}

function writeFrontMatter (attributes: FrontMatterObject | StringKeyMap): string {
  const strings = []
  for (const key in attributes) {
    const value = attributes[key]
    if (value == null) continue
    strings.push(`${key}: ${formatValue(value)}`)
  }
  return ['---', ...strings, '---'].join('\n')
}

function formatValue (value: string | string[] | boolean | number): string {
  if (typeof value == 'boolean') return '' + value
  if (typeof value == 'number') return '' + value
  if (typeof value == 'string') return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
  if (Array.isArray(value)) return ['', ...value.map(tag => `  - ${formatValue(tag)}`)].join('\n')
  throw new Error('unknown value type')
}
