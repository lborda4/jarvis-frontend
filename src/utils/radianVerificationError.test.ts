import { expect, it } from 'vitest'
import { radianVerificationError } from './radianVerificationError'

it.each(['RADIAN_AUTH', 'RADIAN_TIMEOUT', 'RADIAN_RATE_LIMIT', 'RADIAN_UNAVAILABLE', 'RADIAN_RESPONSE'])('muestra un mensaje seguro para %s sin exponer la respuesta original', code => {
  const result = radianVerificationError({ code, message: 'private-token', response: '<html>private</html>' })
  expect(result).toBeTruthy()
  expect(result).not.toMatch(/private|html/)
})

it.each([null, {}, { code: 'UNKNOWN', message: 'private-token' }, { code: 'constructor' }, { code: '__proto__' }])('ignora respuestas desconocidas: %j', data => {
  expect(radianVerificationError(data)).toBeNull()
})
