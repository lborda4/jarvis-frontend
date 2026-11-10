import type { Employee, PayrollWorkerCatalogs, Position } from '../../services/payrollService'
import type { JarvisMunicipality } from '../../types/jarvis'
import { cents, validDate } from '../../utils/payrollDomain'
import { employeePaymentType } from './employeePayment'

export function canSavePayrollEmployee(
  employee: Employee | null,
  catalogs: PayrollWorkerCatalogs | null,
  municipalities: JarvisMunicipality[],
  positions: Position[],
): boolean {
  if (!employee || !catalogs) return false
  if (!/^\d{5,20}$/.test(employee.identification) ||
    !employee.firstName.trim() || !employee.surname.trim() || !employee.address?.trim()) return false
  if (!catalogs.identifications?.some(item => item.id === employee.documentTypeId) ||
    !catalogs.workerTypes.some(item => item.id === employee.typeWorkerId) ||
    !catalogs.workerSubtypes.some(item => item.id === employee.subTypeWorkerId) ||
    !catalogs.contractTypes?.some(item => item.key === employee.contractType) ||
    !catalogs.paymentMethods?.some(item => item.id === employee.paymentMethodId) ||
    !municipalities.some(item => item.id === employee.municipalityId) ||
    (Boolean(employee.positionId) && !positions.some(item => item.id === employee.positionId))) return false
  if (!validDate(employee.admittanceDate) || employee.retirementDate &&
    (!validDate(employee.retirementDate) || employee.retirementDate < employee.admittanceDate)) return false
  try {
    if (cents(employee.salary) <= 0n) return false
  } catch { return false }
  const email = employee.email?.trim()
  if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) return false
  if (employeePaymentType(employee.paymentMethodId, catalogs.paymentMethods) === 'transfer' &&
    (!employee.bankName?.trim() || !['AHORROS', 'CORRIENTE'].includes(employee.accountType) ||
      !/^\d+$/.test(employee.accountNumber))) return false
  if (employee.contractType === 'APPRENTICE' && (
    !['TRADITIONAL', 'DUAL'].includes(employee.apprenticeMode) ||
    !['LECTIVE', 'PRACTICAL'].includes(employee.apprenticeStage) ||
    !validDate(employee.stageStart) || !validDate(employee.stageEnd) || employee.stageStart > employee.stageEnd
  )) return false
  return true
}
