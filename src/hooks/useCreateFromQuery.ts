import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'

/** Let creation links open the existing catalog modal and clear the URL on close. */
export function useCreateFromQuery(): [boolean, (open: boolean) => void] {
  const [params, setParams] = useSearchParams()
  const [open, setOpen] = useState(false)
  return [open || params.get('create') === '1', (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (params.has('create')) {
      const nextParams = new URLSearchParams(params)
      nextParams.delete('create')
      setParams(nextParams, { replace: true })
    }
  }]
}
