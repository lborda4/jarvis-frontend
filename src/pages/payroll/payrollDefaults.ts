import type {
  Concept,
  Employee,
  Parameters,
  PayrollState,
} from '../../services/payrollService'
export const contractLabels: Record<string, string> = {
  INDEFINITE: 'Término indefinido',
  FIXED: 'Término fijo',
  WORK: 'Obra o labor',
  APPRENTICE: 'Aprendizaje',
  OCCASIONAL: 'Ocasional, accidental o transitorio',
}
export const statusLabels: Record<string, string> = {
  DRAFT: 'Borrador',
  PENDING: 'Pendiente de envío',
  PROCESSING: 'En procesamiento',
  ACCEPTED: 'Aceptada',
  REJECTED: 'Rechazada',
  UNCERTAIN: 'Por confirmar',
}
export const employeeName = (
  e: Pick<Employee, 'firstName' | 'surname' | 'secondName' | 'secondSurname'>,
) =>
  [e.firstName, e.secondName, e.surname, e.secondSurname]
    .filter(Boolean)
    .join(' ')
export const currency = (value: string | number) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value))
export const localDate = () =>
  new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Bogota' }).format(
    new Date(),
  )
export function blankEmployee(identifications: { id: number; name: string; code?: string }[] = [], date = localDate()): Employee {
  const citizenshipCard = identifications.find(document =>
    document.code === '31' || document.code?.toUpperCase() === 'CC' ||
    /cedula (de )?ciudadania/.test(document.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()),
  )
  return {
    id: crypto.randomUUID(),
    identification: '',
    documentTypeId: citizenshipCard?.id ?? 0,
    firstName: '',
    secondName: '',
    surname: '',
    secondSurname: '',
    typeWorkerId: 0,
    subTypeWorkerId: 0,
    contractType: 'INDEFINITE',
    positionId: '',
    admittanceDate: date,
    retirementDate: '',
    salary: blankParameters(date).minimumSalary,
    integralSalary: false,
    highRiskPension: false,
    active: true,
    paymentMethodId: 0,
    bankName: '',
    accountType: '',
    accountNumber: '',
    apprenticeMode: 'TRADITIONAL',
    apprenticeStage: 'LECTIVE',
    universityStudent: false,
    stageStart: '',
    stageEnd: '',
  }
}
const names = [
  ['salary', 'Salario básico', 'Salario'],
  ['transportation_allowance', 'Auxilio de transporte', 'Salario'],
  ['commissions', 'Comisiones', 'Otros ingresos'],
  ['salary_bonus', 'Bonificación salarial', 'Otros ingresos'],
  ['non_salary_bonus', 'Bonificación no salarial', 'Otros ingresos'],
  ['allowance', 'Auxilio extralegal', 'Otros ingresos'],
  ['travel', 'Viáticos', 'Otros ingresos'],
  ['overtime_day', 'Hora extra diurna', 'Horas extras'],
  ['overtime_night', 'Hora extra nocturna', 'Horas extras'],
  ['night_surcharge', 'Recargo nocturno', 'Horas extras'],
  ['holiday_day', 'Recargo diurno dominical o festivo', 'Horas extras'],
  ['holiday_night', 'Recargo nocturno dominical o festivo', 'Horas extras'],
  [
    'overtime_holiday_day',
    'Hora extra diurna dominical o festiva',
    'Horas extras',
  ],
  [
    'overtime_holiday_night',
    'Hora extra nocturna dominical o festiva',
    'Horas extras',
  ],
  ['disability', 'Incapacidad', 'Incapacidades'],
  ['vacation', 'Vacaciones disfrutadas', 'Vacaciones'],
  ['vacation_paid', 'Vacaciones compensadas', 'Vacaciones'],
  ['paid_leave', 'Licencia remunerada', 'Licencias'],
  ['unpaid_leave', 'Licencia no remunerada', 'Licencias'],
  ['parental_leave', 'Licencia de maternidad o paternidad', 'Licencias'],
  ['premium', 'Prima', 'Liquidación'],
  ['severance', 'Cesantías', 'Liquidación'],
  ['severance_interest', 'Intereses sobre cesantías', 'Liquidación'],
  ['compensation', 'Indemnización', 'Liquidación'],
  ['retirement_bonus', 'Bonificación por retiro', 'Liquidación'],
  ['other', 'Otros devengados', 'Otros ingresos'],
]
export const defaultConcepts: Concept[] = [
  ...names.map(
    ([code, name, category]): Concept => ({
      code,
      name,
      category,
      kind: 'accrued',
      factor: '',
      percentage: '',
      base: 'manual',
      salaried: !['non_salary_bonus', 'allowance'].includes(code),
      active: true,
      calculationMode: [
        'night_surcharge',
        'holiday_day',
        'holiday_night',
      ].includes(code)
        ? 'additional'
        : 'total',
    }),
  ),
  ...[
    ['eps', 'Salud'],
    ['pension', 'Pensión'],
    ['solidarity', 'Fondo de Solidaridad Pensional'],
    ['subsistence', 'Fondo de Subsistencia'],
    ['withholding', 'Retención en la fuente'],
    ['loan', 'Libranza'],
    ['garnishment', 'Embargo'],
    ['advance', 'Anticipo'],
    ['cooperative', 'Cooperativa'],
    ['voluntary', 'Aporte voluntario'],
    ['other_deduction', 'Otras deducciones'],
  ].map(
    ([code, name]): Concept => ({
      code,
      name,
      category: 'Deducciones',
      kind: 'deduction',
      factor: '',
      percentage: '',
      base: 'manual',
      salaried: false,
      active: true,
    }),
  ),
]
// Salario mínimo mensual, sin auxilio de transporte. Decreto 159 de 2026:
// https://www.cancilleria.gov.co/normograma/compilacion/docs/decreto_0159_2026.htm
const minimumSalaryByYear: Record<string, string> = { '2026': '1750905' }
// Decreto 1470 de 2025, auxilio mensual de transporte para 2026:
// https://www.cancilleria.gov.co/normograma/compilacion/docs/decreto_1470_2025.htm
const transportAllowanceByYear: Record<string, string> = { '2026': '249095' }

// Reducción gradual, Ley 2101 de 2021; 42 horas desde el 15 de julio de 2026.
// https://www1.funcionpublica.gov.co/eva/gestornormativo/norma.php?i=166506
export function defaultWeeklyHours(date = localDate()): string {
  if (date >= '2026-07-15') return '42'
  if (date >= '2025-07-15') return '44'
  if (date >= '2024-07-15') return '46'
  if (date >= '2023-07-15') return '47'
  return '48'
}

export function monthlyHoursForWeek(weeklyHours: string): string {
  const hours = Number(weeklyHours)
  return hours > 0 && Number.isFinite(hours) ? String(hours * 5) : ''
}

export function blankParameters(date = localDate()): Parameters {
  return {
    validFrom: date,
    minimumSalary: minimumSalaryByYear[date.slice(0, 4)] ?? '0',
    transportAllowance: transportAllowanceByYear[date.slice(0, 4)] ?? '0',
    weeklyHours: defaultWeeklyHours(date),
    monthlyHours: monthlyHoursForWeek(defaultWeeklyHours(date)),
    monthlyDays: '30',
    nightStart: '',
    paymentMethodId: 0,
    concepts: defaultConcepts.map((c) => ({ ...c })),
  }
}

export function payrollParametersForSettings(saved?: Parameters, date = localDate()): Parameters {
  const defaults = blankParameters(date)
  if (!saved) return defaults
  return {
    ...saved,
    minimumSalary: saved.minimumSalary.trim() && Number(saved.minimumSalary) > 0
      ? saved.minimumSalary
      : defaults.minimumSalary,
    transportAllowance: saved.transportAllowance.trim() && Number(saved.transportAllowance) > 0
      ? saved.transportAllowance
      : defaults.transportAllowance,
    weeklyHours: Number(saved.weeklyHours) > 0 ? saved.weeklyHours : defaults.weeklyHours,
    monthlyHours: Number(saved.monthlyHours) > 0 ? saved.monthlyHours : monthlyHoursForWeek(Number(saved.weeklyHours) > 0 ? saved.weeklyHours : defaults.weeklyHours),
  }
}
export function blankPayroll(period = localDate().slice(0, 7)): PayrollState {
  const [year, month] = period.split('-').map(Number)
  return {
    employeeId: '',
    period,
    startDate: `${period}-01`,
    endDate: `${period}-${new Date(year, month, 0).getDate()}`,
    issueDate: localDate(),
    workedDays: '30',
    paymentDates: [localDate()],
    lines: [],
  }
}
