const accountOracle =
  /no existe|no encontr|registrad|not found|inactive|inactiv|cuenta con ese/i

export function publicAuthResetError(message: string, fallback: string): string {
  if (accountOracle.test(message)) return fallback
  return message
}
