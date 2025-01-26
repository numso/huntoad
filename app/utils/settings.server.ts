import Conf from 'conf'
import path from 'path'

import type { Item } from './types'

const config = new Conf({
  projectName: process.env.PROJECT_NAME || 'huntoad',
  defaults: {
    darkmode: false,
    datadir: path.join(process.cwd(), 'data'),
    shareserver: '',
    favorites: [],
    name: 'Toad Hunter ' + `${Math.floor(Math.random() * 9999)}`.padStart(4, '0'),
    color:
      '#' +
      Math.floor(Math.random() * 16777215)
        .toString(16)
        .padStart(6, '0')
  }
})

export interface Favorite {
  type: string
  id: string
  title?: string
}

interface Settings {
  darkmode: boolean
  datadir: string
  shareserver: string
  favorites: Favorite[]
  name: string
  color: string
}

type Setting = string | boolean | Favorite[]

export function getAll (): Settings {
  return config.store
}

export function get (key: string): Setting {
  return config.get(key)
}

export function update (key: string, value: Setting): void {
  config.set(key, value)
}

export async function getAllFavorites (db): Promise<Favorite[]> {
  let items = []
  try {
    items = await db.loadItems()
  } catch {}
  const favorites: Favorite[] = config.get('favorites') || []
  return favorites.map(f => ({ ...f, title: getFavoriteTitle(f, items) }))
}

function getFavoriteTitle (f: Favorite, items: Item[]): string {
  if (f.title) return f.title
  if (f.type === 'list-tag') return '#' + f.id
  const calendar = capitalize(f.id.replace('/', ' ').replace('/', ', '))
  if (f.type === 'calendar-day') return calendar
  if (f.type === 'calendar-week') return 'Week of ' + calendar
  if (f.type === 'calendar-month') return calendar
  return items.find(i => i.id === f.id)?.title || ''
}

function capitalize (str: string): string {
  return str[0].toUpperCase() + str.slice(1)
}

export function getFavorite (type: string, id: string): boolean {
  const favorites: Favorite[] = config.get('favorites') || []
  return !!favorites.find(f => f.type === type && f.id === id)
}

export function toggleFavorite (type: string, id: string) {
  const favorites: Favorite[] = config.get('favorites') || []
  const i = favorites.findIndex(f => f.type === type && f.id === id)
  if (i === -1) favorites.push({ id, type })
  else favorites.splice(i, 1)
  config.set('favorites', favorites)
}

export function reorderFavorite (index: number, to: number) {
  const favorites: Favorite[] = config.get('favorites') || []
  const [fav] = favorites.splice(index, 1)
  favorites.splice(to > index ? to - 1 : to, 0, fav)
  config.set('favorites', favorites)
}
