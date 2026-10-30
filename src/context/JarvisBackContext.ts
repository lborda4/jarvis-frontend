import { createContext } from 'react'

export const JarvisBackContext = createContext<((action: () => void) => () => void) | null>(null)
