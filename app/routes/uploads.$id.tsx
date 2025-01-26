import { LoaderFunctionArgs } from '@remix-run/node'
import fs from 'fs'
import path from 'path'

import * as settings from '~/utils/settings.server'

export function loader ({ params }: LoaderFunctionArgs) {
  const uploaddir = path.join(settings.get('datadir') as string, 'uploads')
  const file = path.join(uploaddir, params.id as string)
  const stream = fs.createReadStream(file)
  return new Response(stream)
}
