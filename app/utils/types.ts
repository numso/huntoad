export interface FrontMatterObject {
  title: string
  order: number
  completed: boolean
  collapsed: boolean
  parentId: string | null
  tags: string[]
  dates: string[]
  deleted?: boolean
}

export type Item = FrontMatterObject & {
  id: string
  body: string
  children: Item[]
}
