import Conf from 'conf'

const config = new Conf({ projectName: 'huntoad' })

interface Settings {
  darkmode: boolean
  name: string
  color: string
}

export function getAll (): Settings {
  return config.store
}

export function get (key: string): string | boolean {
  return config.get(key)
}

export function update (key: string, value: string | boolean): void {
  config.set(key, value)
}
