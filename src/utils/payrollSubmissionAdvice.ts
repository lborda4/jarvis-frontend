export function payrollSubmissionAdvice(errors: string[]): string[] {
  const text = errors.join('\n')
  const advice: string[] = []
  if (/\bNIE017\b/i.test(text)) advice.push('NIE017: revisa en NextPyme el NIT del propietario del software de nómina. Debe coincidir con el registrado en la DIAN y estar sin guiones ni dígito de verificación.')
  if (/\b(?:Regla\s*:\s*92|NIE092)\b/i.test(text)) advice.push('Regla 92: verifica que la empresa esté habilitada para nómina electrónica en la DIAN y que el software esté asociado al emisor en el ambiente de nómina que usa NextPyme.')
  if (/\bNIE033\b/i.test(text)) advice.push('NIE033: revisa el NIT del empleador configurado en NextPyme y que el token corresponda a esa empresa. El NIT debe ir sin guiones ni dígito de verificación.')
  if (/\bNIE020\b/i.test(text)) advice.push('NIE020: verifica el ID y el PIN del software de nómina en NextPyme contra los registrados en la DIAN. Con esos datos NextPyme genera el código de seguridad del documento.')
  return advice
}
