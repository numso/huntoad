import fm from 'front-matter'
import fs from 'node:fs/promises'
import * as uuid from 'uuid'

interface FrontMatterObject {
  title: string
  order: number
  completed: boolean
  collapsed: boolean
  parentId: string | null
  tags: string[]
}

export type Item = FrontMatterObject & {
  id: string
  body: string
  children: Item[]
}

export async function loadItems (): Promise<Item[]> {
  const files = await fs.readdir('./data', 'utf-8')
  const items = []
  for (const file of files) {
    if (file === '.keep') continue
    const raw = await fs.readFile(`./data/${file}`, 'utf-8')
    items.push(decode(raw, file))
  }
  items.sort((a, b) => a.order - b.order)
  return items
}

export async function getItem (id: string): Promise<Item> {
  const raw = await fs.readFile(`./data/${id}.md`, 'utf-8')
  return decode(raw, id)
}

function decode (raw: string, file: string): Item {
  const formatted = fm<FrontMatterObject>(raw)
  if (!formatted.attributes.tags) formatted.attributes.tags = []
  return {
    ...formatted.attributes,
    body: formatted.body,
    id: file.replace('.md', ''),
    children: []
  }
}

function encode (item: Item): [string, string] {
  const { id, body, children, ...attributes } = item
  return [id, `${writeFrontMatter(attributes)}\n${body || ''}`]
}

function parseTags (title: string): string[] {
  return [...new Set([...title.matchAll(/#([\S]+)/g)].map(a => a[1]))]
}

export async function updateTitle (id: string, title: string) {
  const p = `./data/${id}.md`
  const contents = await fs.readFile(p, 'utf-8')
  const res = fm<FrontMatterObject>(contents)
  res.attributes.title = title
  res.attributes.tags = parseTags(title)
  const newContents = `${writeFrontMatter(res.attributes)}\n${res.body}`
  await fs.writeFile(p, newContents)
}

export async function updateBody (id: string, body: string) {
  const p = `./data/${id}.md`
  const raw = await fs.readFile(p, 'utf-8')
  const item = decode(raw, id)
  item.body = body
  const [, contents] = encode(item)
  await fs.writeFile(p, contents)
}

export async function setCompleted (id: string, completed: boolean) {
  const p = `./data/${id}.md`
  const contents = await fs.readFile(p, 'utf-8')
  const res = fm<FrontMatterObject>(contents)
  res.attributes.completed = completed
  const newContents = `${writeFrontMatter(res.attributes)}\n${res.body}`
  await fs.writeFile(p, newContents)
}

export async function setCollapsed (id: string, collapsed: boolean) {
  const p = `./data/${id}.md`
  const contents = await fs.readFile(p, 'utf-8')
  const res = fm<FrontMatterObject>(contents)
  res.attributes.collapsed = collapsed
  const newContents = `${writeFrontMatter(res.attributes)}\n${res.body}`
  await fs.writeFile(p, newContents)
}

export async function addItem (parentId: string | null, position: number, title: string) {
  if (!parentId) parentId = null
  const items = await loadItems()
  const newItem = { id: uuid.v4(), parentId, title, tags: parseTags(title) }
  const siblings = items.filter(i => i.parentId == parentId)
  const sibling = siblings[position]
  const siblingChildren = sibling ? items.filter(i => i.parentId === sibling.id) : []

  if (siblingChildren.length && !sibling.collapsed && !title) {
    newItem.parentId = sibling.id
    siblingChildren.unshift(newItem)
    await reorder(siblingChildren)
  } else {
    siblings.splice(position + 1, 0, newItem)
    if (sibling && title) {
      sibling.title = sibling.title.slice(0, -title.length)
      sibling.tags = parseTags(sibling.title)
      for (const child of siblingChildren) child.parentId = newItem.id
      await reorder(siblingChildren)
    }
    await reorder(siblings)
  }

  return newItem
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
  const item = items.find(i => i.id == id)
  if (!item) return
  const children = items.filter(i => i.parentId === item.id)
  if (item.title || children.length) {
    const siblings = items.filter(i => i.parentId === item.parentId)
    const index = siblings.findIndex(i => i.id == id)
    if (index === 0) return
    const prevSibling = siblings[index - 1]
    const prevChildren = items.filter(i => i.parentId == prevSibling.id)
    if (prevChildren.length) return
    prevSibling.title += item.title
    prevSibling.tags = parseTags(prevSibling.title)
    for (const child of children) child.parentId = prevSibling.id
    await reorder(children)
  }
  doDeleteItem(item, items)
}

async function doDeleteItem (item: Item, items: Item[]) {
  await fs.rm(`./data/${item.id}.md`)
  const children = items.filter(i => i.parentId === item.parentId && i.id !== item.id)
  await reorder(children)
}

async function reorder (children: Item[]) {
  for (let i = 0; i < children.length; ++i) {
    children[i].order = i
    const [id, contents] = encode(children[i])
    await fs.writeFile(`./data/${id}.md`, contents)
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
  const item = items.find(i => i.id == id)
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
  const parent = {
    id,
    collapsed: false,
    completed: false,
    tags: parseTags(title),
    title,
    children: fromSteris(rawItems, id, ''),
    body: '',
    order: siblings.length,
    parentId
  }
  const newItems = flattenItems(parent)
  for (const item of newItems) {
    const [id, contents] = encode(item)
    await fs.writeFile(`./data/${id}.md`, contents)
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
  return {
    id: uuid.v4(),
    collapsed,
    completed,
    tags: parseTags(title),
    title,
    children: [],
    body,
    order: i,
    parentId
  }
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
  if (Array.isArray(value)) {
    return ['', ...value.map(tag => `  - ${tag}`)].join('\n')
  }
  throw new Error('unknown value type')
}
