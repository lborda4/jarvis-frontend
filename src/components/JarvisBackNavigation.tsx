import { useCallback, useRef, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { JarvisBackContext } from '../context/JarvisBackContext'
import { jarvisBackDestination } from '../utils/jarvisBackNavigation'
import { ChevronLeftIcon } from './icons/SidebarIcons'

export default function JarvisBackNavigation({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const navigate = useNavigate()
  const location = useLocation()
  const entryIndex = useRef<number>(window.history.state?.idx ?? 0)
  const actions = useRef(new Map<symbol, () => void>())
  const register = useCallback((action: () => void) => {
    const id = Symbol()
    actions.current.set(id, action)
    return () => { actions.current.delete(id) }
  }, [])
  const back = () => {
    const action = [...actions.current.values()].at(-1)
    if (action) { action(); return }
    const target = jarvisBackDestination(location.pathname, window.history.state?.idx ?? 0, entryIndex.current)
    if (target === -1) navigate(-1)
    else navigate(target, { replace: true })
  }
  return <JarvisBackContext.Provider value={register}>
    {enabled && <div className="app-layout__back-bar">
      <button type="button" className="app-layout__back-button" onClick={back}>
        <ChevronLeftIcon aria-hidden="true" />
        Atrás
      </button>
    </div>}
    {children}
  </JarvisBackContext.Provider>
}
