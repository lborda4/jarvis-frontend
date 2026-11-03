import { useCallback, useRef, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { JarvisBackContext } from '../context/JarvisBackContext'
import { jarvisBackDestination, shouldShowJarvisBackNavigation } from '../utils/jarvisBackNavigation'
import { ChevronLeftIcon } from './icons/SidebarIcons'

export default function JarvisBackNavigation({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const navigate = useNavigate()
  const location = useLocation()
  const entryIndex = useRef<number>(window.history.state?.idx ?? 0)
  const actions = useRef(new Map<symbol, () => void>())
  const [actionCount, setActionCount] = useState(0)
  const register = useCallback((action: () => void) => {
    const id = Symbol()
    actions.current.set(id, action)
    setActionCount(actions.current.size)
    return () => { actions.current.delete(id); setActionCount(actions.current.size) }
  }, [])
  const back = () => {
    const action = [...actions.current.values()].at(-1)
    if (action) { action(); return }
    const target = jarvisBackDestination(location.pathname, window.history.state?.idx ?? 0, entryIndex.current)
    if (target === -1) navigate(-1)
    else navigate(target, { replace: true })
  }
  return <JarvisBackContext.Provider value={register}>
    {enabled && shouldShowJarvisBackNavigation(location.pathname, actionCount > 0) && <div className="app-layout__back-bar">
      <button type="button" className="app-layout__back-button" onClick={back}>
        <ChevronLeftIcon aria-hidden="true" />
        Atrás
      </button>
    </div>}
    {children}
  </JarvisBackContext.Provider>
}
