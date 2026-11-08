import type { Employee } from '../../services/payrollService'
import type { JarvisMunicipality, LookupJarvisTerceroNitResponse } from '../../types/jarvis'
import { matchMunicipalityId } from '../../utils/jarvisMunicipality'

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

export function employeeDetailsFromLookup(
  result: Pick<LookupJarvisTerceroNitResponse, 'found' | 'name' | 'email'> & Partial<Pick<LookupJarvisTerceroNitResponse, 'address' | 'cityCode' | 'cityName' | 'stateCode' | 'municipalityId'>>,
  municipalities: JarvisMunicipality[] = [],
) {
  const email = result.email?.trim() ?? ''
  return {
    names: result.found && result.name ? employeeNamesFromFullName(result.name) : null,
    address: result.found ? result.address?.trim() ?? '' : '',
    municipalityId: result.found ? matchMunicipalityId(municipalities, result.cityCode, result.cityName, result.municipalityId, result.stateCode) : undefined,
    email: result.found && email.length <= 254 && /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(email) ? email : '',
  }
}

/** Aplica una consulta solo a la identificación consultada y respeta lo escrito mientras esperaba. */
export function applyEmployeeLookup(current: Employee, requested: Employee, details: ReturnType<typeof employeeDetailsFromLookup>): Employee {
  if (current.id !== requested.id || current.identification !== requested.identification || current.documentTypeId !== requested.documentTypeId) return current
  const namesUnchanged = (['firstName', 'secondName', 'surname', 'secondSurname'] as const)
    .every(field => current[field] === requested[field])
  const fillEmail = details.email && !current.email?.trim() && (current.email ?? '') === (requested.email ?? '')
  const fillAddress = details.address && !current.address?.trim() && (current.address ?? '') === (requested.address ?? '')
  const fillCity = details.municipalityId && !current.municipalityId && current.municipalityId === requested.municipalityId
  return {
    ...current,
    ...(namesUnchanged ? details.names : null),
    ...(fillEmail ? { email: details.email } : null),
    ...(fillAddress ? { address: details.address } : null),
    ...(fillCity ? { municipalityId: details.municipalityId } : null),
  }
}
