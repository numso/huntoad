import { json } from '@remix-run/node'
import { Links, Meta, Outlet, Scripts, ScrollRestoration, useLoaderData } from '@remix-run/react'

import { Shortcuts } from '~/components/shortcuts'
import { Toaster } from '~/components/toasts'
import * as db from '~/utils/db.server'
import * as settings from '~/utils/settings.server'
import * as sync from '~/utils/sync.server'
import * as fs from '~/utils/virtual-fs'

import './tailwind.css'

export async function loader () {
  await sync.init(settings.get('shareserver') as string, db, fs)
  return json({ darkmode: settings.get('darkmode') })
}

export default function App () {
  const { darkmode } = useLoaderData<typeof loader>()
  return (
    <html lang='en' className={darkmode ? 'dark' : ''}>
      <head>
        <meta charSet='utf-8' />
        <meta name='viewport' content='width=device-width,initial-scale=1' />
        <Meta />
        <Links />
      </head>
      <body className='dark:bg-gray-800 dark:text-white'>
        <Shortcuts>
          <Toaster>
            <Outlet />
          </Toaster>
        </Shortcuts>
        <ScrollRestoration />
        <Scripts />
        <script src='/socket.io/socket.io.js'></script>
        <script>window.socket = io()</script>
      </body>
    </html>
  )
}
