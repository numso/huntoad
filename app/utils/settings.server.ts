import Conf from 'conf'

const config = new Conf({
  projectName: 'huntoad',
  defaults: {
    darkmode: false,
    datadir: process.cwd() + '/data',
    name: 'Toad Hunter ' + `${Math.floor(Math.random() * 9999)}`.padStart(4, '0'),
    color:
      '#' +
      Math.floor(Math.random() * 16777215)
        .toString(16)
        .padStart(6, '0')
  }
})

interface Settings {
  darkmode: boolean
  datadir: string
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
