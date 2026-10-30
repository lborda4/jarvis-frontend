import { useContext, useEffect } from 'react'
import { JarvisBackContext } from '../context/JarvisBackContext'

/** Permite cerrar una vista interna antes de retroceder de ruta. */
export function useJarvisBackAction(action: () => void, active: boolean) {
  const register = useContext(JarvisBackContext)
  useEffect(() => {
    if (active && register) return register(action)
  }, [action, active, register])
}
