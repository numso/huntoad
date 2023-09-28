import type { Item } from './types'

export function addItem (
  items: Item[],
  id: string,
  parentId: string | null,
  title: string,
  position: number
) {
  if (!parentId) parentId = null
  const item = newItem(id, parentId, title)
  const siblings = items.filter(i => i.parentId == parentId)
  const sibling = siblings[position]
  const siblingChildren = sibling ? items.filter(i => i.parentId === sibling.id) : []
  if (siblingChildren.length && !sibling.collapsed && !title) {
    item.parentId = sibling.id
    siblingChildren.unshift(item)
    reorder(siblingChildren)
    return { item, persist: siblingChildren }
  }
  siblings.splice(position + 1, 0, item)
  reorder(siblings)
  if (!sibling || !title) return { item, persist: siblings }
  sibling.title = sibling.title.slice(0, -title.length)
  sibling.tags = parseTags(sibling.title)
  sibling.dates = parseDates(sibling.title)
  for (const child of siblingChildren) child.parentId = item.id
  reorder(siblingChildren)
  return { item, persist: [...siblings, ...siblingChildren] }
}

export function deleteItem (items: Item[], id: string) {
  const item = items.find(i => i.id == id)
  if (!item) return
  const children = items.filter(i => i.parentId === item.id)
  if (!item.title && !children.length) {
    const siblings = items.filter(i => i.parentId === item.parentId && i.id !== item.id)
    reorder(siblings)
    return { item, persist: siblings }
  }
  const siblings = items.filter(i => i.parentId === item.parentId)
  const index = siblings.findIndex(i => i.id == id)
  if (index === 0) return
  const prevSibling = siblings[index - 1]
  const prevChildren = items.filter(i => i.parentId == prevSibling.id)
  if (prevChildren.length) return
  prevSibling.title += item.title
  prevSibling.tags = parseTags(prevSibling.title)
  prevSibling.dates = parseDates(prevSibling.title)
  for (const child of children) child.parentId = prevSibling.id
  reorder(children)
  const siblings2 = items.filter(i => i.parentId === item.parentId && i.id !== item.id)
  reorder(siblings2)
  return { item, persist: [...children, ...siblings2] }
}

function reorder (children: Item[]) {
  for (let i = 0; i < children.length; ++i) {
    children[i].order = i
  }
}

export function newItem (id: string, parentId: string | null, title: string): Item {
  return {
    id,
    parentId,
    title,
    body: '',
    completed: false,
    collapsed: false,
    tags: parseTags(title),
    dates: parseDates(title),
    children: [],
    order: -1
  }
}

export function parseTags (title: string): string[] {
  return [...new Set([...title.matchAll(/#([\S]+)/g)].map(a => a[1]))]
}

export function parseDates (title: string): string[] {
  return [...new Set([...title.matchAll(/:(\d{1,2}-\d{1,2}-\d{4})/g)].map(a => a[1]))]
}
