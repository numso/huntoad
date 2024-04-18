import type { LinksFunction } from '@remix-run/node'
import { json } from '@remix-run/node'
import {
  Links,
  LiveReload,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData
} from '@remix-run/react'

import { Toaster } from '~/components/toasts'
import * as settings from '~/utils/settings.server'

import { Shortcuts } from './components/shortcuts'
import styles from './tailwind.css'

export const links: LinksFunction = () => [{ rel: 'stylesheet', href: styles }]

export function loader () {
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
        <LiveReload />
      </body>
    </html>
  )
}
