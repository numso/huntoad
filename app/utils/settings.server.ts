import Conf from 'conf'

import * as db from './db.server'

const config = new Conf({
  projectName: 'huntoad',
  defaults: {
    darkmode: false,
    datadir: process.cwd() + '/data',
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

export async function getAllFavorites (): Promise<Favorite[]> {
  const items = await db.loadItems()
  const favorites: Favorite[] = config.get('favorites') || []
  return favorites.map(f => ({ ...f, title: items.find(i => i.id === f.id)?.title }))
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
