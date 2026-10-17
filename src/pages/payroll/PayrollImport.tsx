import { useState } from 'react'
import * as XLSX from 'xlsx'
import {
  payrollService,
  type Employee,
  type PayrollBootstrap,
  type PayrollState,
} from '../../services/payrollService'
import { cents, validDate, validatePayroll } from '../../utils/payrollDomain'
import { blankEmployee, blankPayroll, employeeName } from './payrollDefaults'
import { Field, Modal } from './PayrollPage'
interface Props {
  kind: 'employees' | 'documents'
  data: PayrollBootstrap
  busy: boolean
  run: (action: () => Promise<unknown>, message?: string) => Promise<boolean>
  onClose: () => void
}
interface Preview {
  row: number
  id: string
  label: string
  errors: string[]
  employee?: Employee
  state?: PayrollState
  saved?: boolean
}
type ExcelRow = Record<string, string>
export default function PayrollImport({
  kind,
  data,
  busy,
  run,
  onClose,
}: Props) {
  const [preview, setPreview] = useState<Preview[]>([]),
    [error, setError] = useState('')
  const template = () => {
    const book = XLSX.utils.book_new()
    if (kind === 'employees')
      XLSX.utils.book_append_sheet(
        book,
        XLSX.utils.json_to_sheet([
          {
            identificacion: '',
            tipo_documento: '',
            primer_nombre: '',
            segundo_nombre: '',
            primer_apellido: '',
            segundo_apellido: '',
            tipo_trabajador: '',
            subtipo_trabajador: '',
            contrato: 'INDEFINITE',
            fecha_ingreso: 'AAAA-MM-DD',
            salario: '0.00',
            metodo_pago: '',
            banco: '',
            tipo_cuenta: '',
            numero_cuenta: '',
          },
        ]),
        'Empleados',
      )
    else {
      XLSX.utils.book_append_sheet(
        book,
        XLSX.utils.json_to_sheet([
          {
            registro: 'N001',
            identificacion: '',
            periodo: 'AAAA-MM',
            fecha_inicial: 'AAAA-MM-DD',
            fecha_final: 'AAAA-MM-DD',
            fecha_emision: 'AAAA-MM-DD',
            dias: '30',
            salario: '0.00',
            auxilio_transporte: '0.00',
            salud: '0.00',
            porcentaje_salud: '0',
            pension: '0.00',
            porcentaje_pension: '0',
            fecha_pago: 'AAAA-MM-DD',
          },
        ]),
        'Nominas',
      )
      for (const name of [
        'Devengados adicionales',
        'Deducciones adicionales',
        'Novedades',
      ])
        XLSX.utils.book_append_sheet(
          book,
          XLSX.utils.json_to_sheet([
            {
              registro: 'N001',
              concepto: '',
              cantidad: '1',
              valor: '0.00',
              porcentaje: '0',
              fecha_inicial: '',
              fecha_final: '',
            },
          ]),
          name,
        )
    }
    XLSX.writeFile(
      book,
      kind === 'employees'
        ? 'Plantilla-empleados.xlsx'
        : 'Plantilla-nominas.xlsx',
    )
  }
  const read = async (file?: File) => {
    if (!file) return
    setError('')
    setPreview([])
    if (file.size > 5 * 1024 * 1024) {
      setError('El archivo no debe superar 5 MB.')
      return
    }
    try {
      const book = XLSX.read(await file.arrayBuffer(), {
        type: 'array',
        cellDates: false,
      })
      const readSheet = (name: string): ExcelRow[] =>
        book.Sheets[name]
          ? XLSX.utils.sheet_to_json<ExcelRow>(book.Sheets[name], {
              defval: '',
              raw: false,
            })
          : []
      const rows = readSheet(kind === 'employees' ? 'Empleados' : 'Nominas')
      if (!rows.length || rows.length > 1000)
        throw new Error('La hoja debe contener entre 1 y 1.000 registros.')
      const keys = new Set<string>(),
        existing = new Set(data.employees.map((e) => e.identification))
      const periods = [
        ...new Set(
          rows
            .map((r) => r.periodo)
            .filter((p) => /^\d{4}-\d{2}$/.test(p ?? '')),
        ),
      ]
      if (kind === 'documents' && periods.length > 12)
        throw new Error('Importa máximo doce períodos por archivo.')
      const existingDocuments =
        kind === 'documents'
          ? (
              await Promise.all(periods.map((p) => payrollService.list(p)))
            ).flat()
          : []
      const existingPayroll = new Set(
        existingDocuments
          .filter((d) => !d.originalId)
          .map(
            (d) =>
              `${d.employee.identification}|${d.state.startDate}|${d.state.endDate}`,
          ),
      )
      const additional = [
        'Devengados adicionales',
        'Deducciones adicionales',
        'Novedades',
      ].flatMap((sheet) => readSheet(sheet).map((row) => ({ sheet, row })))
      const unknown = additional.filter(
        ({ row }) =>
          row.concepto && !rows.some((r) => r.registro === row.registro),
      )
      if (unknown.length)
        throw new Error(
          'Hay novedades cuyo registro no existe en la hoja Nominas.',
        )
      const result = rows.map((row, index): Preview => {
        const errors: string[] = []
        const identification = String(row.identificacion).trim()
        const id = crypto.randomUUID()
        if (kind === 'employees') {
          const e: Employee = {
            ...blankEmployee(),
            id,
            identification,
            documentTypeId: Number(row.tipo_documento),
            firstName: (row.primer_nombre ?? '').trim(),
            secondName: row.segundo_nombre?.trim() ?? '',
            surname: (row.primer_apellido ?? '').trim(),
            secondSurname: row.segundo_apellido?.trim() ?? '',
            typeWorkerId: Number(row.tipo_trabajador),
            subTypeWorkerId: Number(row.subtipo_trabajador),
            contractType: row.contrato || 'INDEFINITE',
            admittanceDate: row.fecha_ingreso,
            salary: row.salario,
            paymentMethodId: Number(row.metodo_pago),
            bankName: row.banco ?? '',
            accountType: row.tipo_cuenta ?? '',
            accountNumber: row.numero_cuenta ?? '',
          }
          if (keys.has(identification) || existing.has(identification))
            errors.push('Identificación duplicada')
          keys.add(identification)
          if (!/^\d{5,20}$/.test(identification) || !e.firstName || !e.surname)
            errors.push('Identificación o nombres incompletos')
          if (
            !e.typeWorkerId ||
            !e.subTypeWorkerId ||
            !e.documentTypeId ||
            !e.paymentMethodId
          )
            errors.push('Completa los códigos NextPyme')
          if (e.contractType === 'APPRENTICE')
            errors.push(
              'Registra el aprendiz individualmente para completar su modalidad y etapa',
            )
          if (!validDate(e.admittanceDate))
            errors.push('Fecha de ingreso inválida')
          try {
            cents(e.salary)
          } catch {
            errors.push('Salario inválido')
          }
          return {
            row: index + 2,
            id,
            label: employeeName(e),
            errors,
            employee: e,
          }
        }
        const employee = data.employees.find(
          (e) => e.identification === identification,
        )
        if (!row.registro || keys.has(row.registro))
          errors.push('Identificador de registro vacío o duplicado')
        keys.add(row.registro)
        const duplicateKey = `${identification}|${row.fecha_inicial}|${row.fecha_final}`
        if (keys.has(duplicateKey) || existingPayroll.has(duplicateKey))
          errors.push('Empleado y período duplicados')
        keys.add(duplicateKey)
        const state: PayrollState = {
          ...blankPayroll(),
          employeeId: employee?.id ?? '',
          period: row.periodo,
          startDate: row.fecha_inicial,
          endDate: row.fecha_final,
          issueDate: row.fecha_emision,
          workedDays: row.dias,
          paymentDates: [row.fecha_pago],
          lines: [],
        }
        for (const [column, concept, kind] of [
          ['salario', 'salary', 'accrued'],
          ['auxilio_transporte', 'transportation_allowance', 'accrued'],
          ['salud', 'eps', 'deduction'],
          ['pension', 'pension', 'deduction'],
        ] as const)
          if (row[column] && Number(row[column]) !== 0)
            state.lines.push({
              id: crypto.randomUUID(),
              concept,
              kind,
              quantity: row.dias,
              amount: row[column],
              percentage:
                column === 'salud'
                  ? row.porcentaje_salud
                  : column === 'pension'
                    ? row.porcentaje_pension
                    : undefined,
              manual: true,
            })
        for (const { row: r, sheet } of additional.filter(
          (a) => a.row.registro === row.registro && a.row.concepto,
        )) {
          const c = data.parameters
            .find((p) => p.validFrom <= state.startDate)
            ?.data.concepts.find((c) => c.code === r.concepto)
          if (!c) {
            errors.push(`Concepto desconocido: ${r.concepto}`)
            continue
          }
          if (
            (sheet === 'Deducciones adicionales' && c.kind !== 'deduction') ||
            (sheet === 'Devengados adicionales' && c.kind !== 'accrued')
          ) {
            errors.push('Naturaleza de concepto incorrecta')
            continue
          }
          state.lines.push({
            id: crypto.randomUUID(),
            concept: c.code,
            mapping: c.code.startsWith('internal_') ? c.category : c.code,
            kind: c.kind,
            quantity: r.cantidad || '1',
            amount: r.valor,
            percentage: r.porcentaje || '0',
            startDate: r.fecha_inicial,
            endDate: r.fecha_final,
            manual: true,
          })
        }
        errors.push(...validatePayroll(state, employee))
        if (!data.parameters.some((p) => p.validFrom <= state.startDate))
          errors.push('No hay parámetros vigentes')
        return {
          row: index + 2,
          id,
          label: employee ? employeeName(employee) : identification,
          errors,
          state,
        }
      })
      setPreview(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo leer el archivo.')
    }
  }
  const save = async () => {
    await run(
      async () => {
        for (const row of preview.filter((p) => !p.errors.length && !p.saved)) {
          try {
            if (row.employee) await payrollService.employees(row.employee)
            else if (row.state) await payrollService.save(row.id, row.state)
            setPreview((old) =>
              old.map((p) => (p.id === row.id ? { ...p, saved: true } : p)),
            )
          } catch {
            setPreview((old) =>
              old.map((p) =>
                p.id === row.id
                  ? {
                      ...p,
                      errors: [
                        'No se guardó. Revisa duplicados, fechas y configuración.',
                      ],
                    }
                  : p,
              ),
            )
          }
        }
      },
      kind === 'employees'
        ? 'Importación de empleados procesada.'
        : 'Importación procesada. Los documentos se guardaron como borradores.',
    )
  }
  return (
    <Modal
      title={kind === 'employees' ? 'Importar empleados' : 'Importar nóminas'}
      subtitle="Revisa la vista previa antes de guardar. Esta acción no envía documentos a la DIAN."
      onClose={onClose}
    >
      <div className="payroll__toolbar">
        <button className="payroll__button" onClick={template}>
          Descargar plantilla Excel
        </button>
        <Field label="Archivo Excel">
          <input
            type="file"
            accept=".xlsx,.xls"
            disabled={busy}
            onChange={(e) => void read(e.target.files?.[0])}
          />
        </Field>
      </div>
      <p className="payroll__muted">
        Usa fechas AAAA-MM-DD y valores numéricos sin separadores de miles. Los
        conceptos adicionales usan el código del catálogo de configuración.
      </p>
      {error && (
        <p className="payroll__notice payroll__notice--error" role="alert">
          {error}
        </p>
      )}
      {!!preview.length && (
        <>
          <div className="payroll__scroll">
            <table>
              <thead>
                <tr>
                  <th>Fila</th>
                  <th>Empleado</th>
                  <th>Resultado</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((p) => (
                  <tr key={p.id}>
                    <td>{p.row}</td>
                    <td>{p.label}</td>
                    <td>
                      {p.saved
                        ? 'Guardado'
                        : p.errors.length
                          ? p.errors.join('. ')
                          : 'Listo para guardar'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="payroll__footer">
            <span>
              {preview.filter((p) => !p.errors.length && !p.saved).length}{' '}
              registros válidos pendientes
            </span>
            <button
              className="payroll__button payroll__button--primary"
              disabled={
                busy || !preview.some((p) => !p.errors.length && !p.saved)
              }
              onClick={() => void save()}
            >
              Guardar registros válidos
            </button>
          </div>
        </>
      )}
    </Modal>
  )
}
