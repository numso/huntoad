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
  for (let file of files) {
    if (file === '.keep') continue
    const raw = await fs.readFile(`./data/${file}`, 'utf-8')
    items.push(decode(raw, file))
  }
  items.sort((a, b) => a.order - b.order)
  return items
}

function decode (raw: string, file: string): Item {
  const formatted = fm<FrontMatterObject>(raw)
  return {
    ...formatted.attributes,
    body: formatted.body,
    id: file.replace('.md', ''),
    children: []
  }
}

function encode (item: Item): [string, string] {
  const { id, body, children, ...attributes } = item
  return [id, `${writeFrontMatter(attributes)}\n${body}`]
}

export async function updateTitle (id: string, title: string) {
  const p = `./data/${id}.md`
  const contents = await fs.readFile(p, 'utf-8')
  const res = fm<FrontMatterObject>(contents)
  res.attributes.title = title
  const newContents = `${writeFrontMatter(res.attributes)}\n${res.body}`
  await fs.writeFile(p, newContents)
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

export async function addItem (parentId: string | null) {
  const items = await loadItems()
  const children = items.filter(i => i.parentId === parentId)
  children.push({ id: uuid.v4(), parentId })
  for (let i = 0; i < children.length; ++i) {
    children[i].order = i
    const [id, contents] = encode(children[i])
    await fs.writeFile(`./data/${id}.md`, contents)
  }
}

export async function convertToSteris (id: string) {
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
${item.title}
---
${item.children.map(i => toSteris(i, '')).join('\n')}
  `.trim()
}

function toSteris (item: Item, indent: string): string {
  const children = item.children.map(i => toSteris(i, indent + '  '))
  const collapse = item.collapsed ? '<' : '>'
  const complete = item.completed ? 'x' : ' '
  return [
    `${indent}${collapse} [${complete}] ${item.title || ''}`,
    ...children
  ].join('\n')
}

interface StringKeyMap {
  [key: string]: string | string[] | boolean | number | null
}

function writeFrontMatter (
  attributes: FrontMatterObject | StringKeyMap
): string {
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
  if (typeof value == 'string') return `"${value.replace(/"/g, '\\"')}"`
  if (Array.isArray(value)) {
    return ['', ...value.map(tag => `  - ${tag}`)].join('\n')
  }
  throw new Error('unknown value type')
}
