export function employeeNamesFromFullName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length < 2) return null
  // La consulta por cédula de NextPyme devuelve apellidos antes de los nombres.
  // El texto no permite resolver todas las combinaciones; sigue siendo editable.
  const firstNameIndex = parts.length === 2 ? 1 : 2
  return {
    firstName: parts[firstNameIndex],
    secondName: parts.slice(firstNameIndex + 1).join(' '),
    surname: parts[0],
    secondSurname: firstNameIndex === 2 ? parts[1] : '',
  }
}
