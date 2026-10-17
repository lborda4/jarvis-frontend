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
    maximumFractionDigits: 2,
  }).format(Number(value))
export const localDate = () =>
  new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Bogota' }).format(
    new Date(),
  )
export function blankEmployee(): Employee {
  return {
    id: crypto.randomUUID(),
    identification: '',
    documentTypeId: 0,
    firstName: '',
    secondName: '',
    surname: '',
    secondSurname: '',
    typeWorkerId: 0,
    subTypeWorkerId: 0,
    contractType: 'INDEFINITE',
    positionId: '',
    admittanceDate: localDate(),
    retirementDate: '',
    salary: '0',
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
export function blankParameters(): Parameters {
  return {
    validFrom: localDate(),
    minimumSalary: '0',
    transportAllowance: '0',
    weeklyHours: '',
    monthlyHours: '',
    monthlyDays: '30',
    nightStart: '',
    paymentMethodId: 0,
    concepts: defaultConcepts.map((c) => ({ ...c })),
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
