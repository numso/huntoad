import * as Icons from '../components/icons'

export default function Index () {
  return (
    <div className='flex flex-wrap'>
      {Object.keys(Icons).map(key => {
        const Component = Icons[key]
        return (
          <div
            key={key}
            className='m-4 flex flex-col items-center gap-2 rounded-md border border-black p-4'
          >
            <Component className='h-10 w-10' />
            <div>{key}</div>
          </div>
        )
      })}
    </div>
  )
}
