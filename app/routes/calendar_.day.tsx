import { redirect } from '@remix-run/node'

const months = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december'
]

export function loader () {
  const today = new Date()
  const month = months[today.getMonth()]
  const year = today.getFullYear()
  console.log(today)
  console.log(today.getDate())
  return redirect(`/calendar/day/${month}/${today.getDate()}/${year}`)
}
