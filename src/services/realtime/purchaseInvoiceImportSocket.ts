import { io, type Socket } from 'socket.io-client'
import { API_BASE_URL } from '../../constants/api'
import { getAccessToken } from '../authStorage'

let socket: Socket | null = null

/** Socket único para el progreso de importación de Factura de compra — se
 * conecta perezosamente (recién cuando hay un job para trackear) y no se
 * reconstruye entre llamadas, para que la reconexión automática de
 * socket.io y las suscripciones activas sobrevivan a la navegación entre
 * pantallas del SPA. El token se relee en cada intento de conexión (no solo
 * una vez al crear el socket) para tolerar una renovación de token entre
 * medio. */
export function getPurchaseInvoiceImportSocket(): Socket {
  if (socket) {
    return socket
  }

  socket = io(`${API_BASE_URL}/ws/purchase-invoice-imports`, {
    autoConnect: false,
    auth: (callback) => callback({ token: getAccessToken() }),
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10_000,
  })

  return socket
}

export function ensurePurchaseInvoiceImportSocketConnected(): Socket {
  const client = getPurchaseInvoiceImportSocket()

  if (!client.connected && !client.active) {
    client.connect()
  }

  return client
}
