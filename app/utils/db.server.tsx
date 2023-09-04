import fm from 'front-matter'
import fs from 'node:fs/promises'
import * as uuid from 'uuid'

interface FrontMatterObject {
  title: string
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
    const formatted = fm<FrontMatterObject>(raw)
    items.push({
      ...formatted.attributes,
      body: formatted.body,
      id: file.replace('.md', ''),
      children: []
    })
  }
  return items
}

export async function updateTitle (id: string, title: string) {
  const p = `./data/${id}.md`
  const contents = await fs.readFile(p, 'utf-8')
  const res = fm<{ title: string }>(contents)
  res.attributes.title = title
  const newContents = `${writeFrontMatter(res.attributes)}\n${res.body}`
  await fs.writeFile(p, newContents)
}

export async function addItem (parentId: string | null) {
  const id = uuid.v4()
  const contents = `${writeFrontMatter({ parentId })}\n`
  await fs.writeFile(`./data/${id}.md`, contents)
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
  return [`${indent}> [ ] ${item.title || ''}`, ...children].join('\n')
}

interface StringMap {
  [key: string]: string | null
}

function writeFrontMatter (attributes: StringMap): string {
  const strings = []
  for (const key in attributes) {
    const value = attributes[key]
    if (value == null) continue
    strings.push(`${key}: ${formatValue(value)}`)
  }
  return ['---', ...strings, '---'].join('\n')
}

function formatValue (value: string | string[]): string {
  if (typeof value == 'string') return value
  if (Array.isArray(value)) {
    return ['', ...value.map(tag => `  - ${tag}`)].join('\n')
  }
  throw new Error('unknown value type')
}
