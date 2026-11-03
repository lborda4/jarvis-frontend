import { useContext, useEffect, useLayoutEffect, useRef } from 'react'
import { JarvisBackContext } from '../context/JarvisBackContext'

/** Permite cerrar una vista interna antes de retroceder de ruta. */
export function useJarvisBackAction(action: () => void, active: boolean) {
  const register = useContext(JarvisBackContext)
  const currentAction = useRef(action)
  useLayoutEffect(() => { currentAction.current = action }, [action])
  useEffect(() => {
    if (active && register) return register(() => currentAction.current())
  }, [active, register])
}
