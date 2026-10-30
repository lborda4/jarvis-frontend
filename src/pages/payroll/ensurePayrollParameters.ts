import { payrollService } from '../../services/payrollService'
import { blankParameters } from './payrollDefaults'

/** Guarda los valores iniciales antes de crear documentos que necesitan capturarlos. */
export async function ensurePayrollParameters(startDate: string) {
  const current = await payrollService.bootstrap()
  if (current.parameters.some(parameter => parameter.validFrom <= startDate)) return

  const defaults = blankParameters(startDate)
  if (Number(defaults.minimumSalary) <= 0) {
    throw new Error(`Configura el salario mínimo para ${startDate.slice(0, 4)}: aún no hay valores predeterminados para ese año.`)
  }
  try {
    await payrollService.parameters(defaults)
  } catch (error) {
    // Otra pestaña puede haber guardado la configuración mientras se creaba.
    // También permite reintentar si el servidor guardó y se perdió la respuesta.
    const refreshed = await payrollService.bootstrap()
    if (!refreshed.parameters.some(parameter => parameter.validFrom <= startDate)) throw error
  }
}
