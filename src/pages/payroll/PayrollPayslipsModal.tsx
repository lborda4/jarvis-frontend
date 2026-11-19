import { useEffect, useId, useRef, useState } from 'react'
import Modal from '../../components/Modal'
import Button from '../../components/Button'
import { payrollService, type PayrollDocument, type PayrollPayslipRecipient } from '../../services/payrollService'
import { getApiErrorMessage } from '../../services/apiClient'
import { triggerBrowserDownload } from '../../utils/downloadFile'
import { shouldShowTablePagination } from '../../utils/tablePagination'
import { sendPayrollPayslipEmails } from './payrollPayslipEmail'
import PayrollNotice from './PayrollNotice'
import { CheckIcon } from '../../components/icons/SidebarIcons'

const dateLabel = (date?: string) => date?.split('-').reverse().join('/') ?? ''

export default function PayrollPayslipsModal({ documents, onClose }: { documents: PayrollDocument[]; onClose: () => void }) {
  const title = useId()
  const [recipientEntry, setRecipientEntry] = useState<{ key: string; rows: PayrollPayslipRecipient[]; error: string } | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [activity, setActivity] = useState<{ kind: 'send' | 'download'; ids: string[] } | null>(null)
  const busy = activity !== null
  const [downloadError, setDownloadError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [progress, setProgress] = useState('')
  const [notice, setNotice] = useState<{ message: string; variant: 'success' | 'warning' } | null>(null)
  const [results, setResults] = useState<Record<string, { sent: boolean; message: string }>>({})
  const [page, setPage] = useState(1)
  const selectAll = useRef<HTMLInputElement>(null)
  const operation = useRef(false)
  const requests = useRef(new Map<string, string>())
  const ids = documents.map(document => document.id)
  const idsKey = JSON.stringify(ids)
  const loadKey = JSON.stringify([idsKey, attempt])
  const loading = recipientEntry?.key !== loadKey
  const recipients = recipientEntry?.key === loadKey ? recipientEntry.rows : []
  const error = recipientEntry?.key === loadKey ? recipientEntry.error : ''
  useEffect(() => {
    let active = true
    void payrollService.payslipRecipients(JSON.parse(idsKey))
      .then(rows => { if (active) setRecipientEntry({ key: loadKey, rows, error: '' }) })
      .catch(cause => { if (active) setRecipientEntry({ key: loadKey, rows: [], error: getApiErrorMessage(cause, 'No se pudieron consultar los correos de los empleados.') }) })
    return () => { active = false }
  }, [idsKey, loadKey])
  const chosen = recipients.filter(row => selected.includes(row.id))
  const pendingEmails = chosen.filter(row => !results[row.id]?.sent)
  const allSent = recipients.length > 0 && recipients.every(row => results[row.id]?.sent)
  const allSelected = recipients.length > 0 && chosen.length === recipients.length
  useEffect(() => { if (selectAll.current) selectAll.current.indeterminate = chosen.length > 0 && !allSelected }, [chosen.length, allSelected])
  const pageSize = 10
  const pages = Math.max(1, Math.ceil(recipients.length / pageSize))
  const currentPage = Math.min(page, pages)
  const send = async (rows: PayrollPayslipRecipient[]) => {
    if (operation.current || !rows.length || rows.some(row => !row.canEmail)) return
    operation.current = true; setActivity({ kind: 'send', ids: rows.map(row => row.id) }); setNotice(null); setDownloadError(''); setProgress('Enviando correos…')
    try {
      const succeeded = await sendPayrollPayslipEmails(rows, requests.current,
        (id, result) => setResults(current => ({ ...current, [id]: result })),
        completed => setProgress(`${completed} de ${rows.length} correos procesados`))
      setSelected(current => current.filter(id => !succeeded.includes(id)))
      setNotice(succeeded.length === rows.length
        ? { variant: 'success', message: rows.length === 1 ? 'Envío exitoso. El desprendible fue enviado al correo del empleado.' : `Envío exitoso. Se enviaron los ${succeeded.length} desprendibles a los correos de los empleados.` }
        : { variant: 'warning', message: `${succeeded.length} de ${rows.length} correos enviados. Revisa los empleados con error y reintenta su envío.` })
    } catch (cause) { setDownloadError(getApiErrorMessage(cause, 'No se pudieron enviar los correos.')); setProgress('') }
    finally { operation.current = false; setActivity(null); setProgress('') }
  }
  const download = async (downloadIds: string[], individual = false) => {
    if (operation.current || !downloadIds.length) return
    operation.current = true; setActivity({ kind: 'download', ids: downloadIds }); setNotice(null); setDownloadError(''); setProgress('Generando desprendibles…')
    try {
      const blob = individual ? await payrollService.payslipPdf(downloadIds[0]) : await payrollService.payslipZip(downloadIds)
      const document = documents.find(document => document.id === downloadIds[0])!
      const period = `${document.state.startDate}-${document.state.endDate}`
      triggerBrowserDownload(blob, individual ? `Desprendible-${document.employee.identification.replace(/[^a-zA-Z0-9_-]/g, '_')}-${period}.pdf` : `Desprendibles-${period}.zip`)
      setNotice({ variant: 'success', message: 'Descarga generada.' })
    } catch (cause) { setDownloadError(getApiErrorMessage(cause, 'No se pudieron generar los desprendibles. Intenta nuevamente.')); setProgress('') }
    finally { operation.current = false; setActivity(null); setProgress('') }
  }
  return <Modal isOpen size="lg" busy={busy} onClose={onClose} labelledBy={title} className="payroll-period-modal">
    <h2 className="modal-dialog__title" id={title}>Desprendibles</h2>
    <p className="payroll__muted">{documents[0]?.state.payrollName} · {dateLabel(documents[0]?.state.startDate)} al {dateLabel(documents[0]?.state.endDate)}</p>
    <p>Selecciona uno o todos los empleados. Cada correo incluye únicamente el desprendible de ese empleado.</p>
    {loading ? <p role="status">Consultando empleados y correos…</p> : error ? <div className="payroll__notice payroll__notice--error" role="alert">{error} <Button variant="outline" onClick={() => setAttempt(value => value + 1)}>Reintentar</Button></div> : <>
      <div className="payroll-period-modal__toolbar"><span>{chosen.length} de {recipients.length} seleccionados</span><div className="payroll__toolbar">
        <Button aria-busy={activity?.kind === 'send'} disabled={busy || !pendingEmails.length || pendingEmails.some(row => !row.canEmail)} onClick={() => void send(pendingEmails)}>{activity?.kind === 'send' ? 'Enviando correos…' : allSent ? <><CheckIcon />Envío completado</> : `Enviar seleccionados (${pendingEmails.length})`}</Button>
        <Button variant="outline" aria-busy={activity?.kind === 'download' && activity.ids.length > 1} disabled={busy || !chosen.length} onClick={() => void download(chosen.map(row => row.id))}>Descargar ZIP ({chosen.length})</Button>
      </div></div>
      {chosen.some(row => !row.canEmail) && <p className="payroll__muted">Para enviar, configura un correo válido para todos los empleados seleccionados. Puedes descargar sus PDF mientras tanto.</p>}
      <div className="payroll-register-table" role="region" aria-label="Empleados y desprendibles" tabIndex={0}><table>
        <thead><tr><th><input ref={selectAll} type="checkbox" aria-label="Seleccionar todos los empleados" checked={allSelected} disabled={busy || !recipients.length} onChange={event => setSelected(event.target.checked ? recipients.map(row => row.id) : [])} /></th><th>Empleado</th><th>Correo</th><th>Resultado</th><th>Acciones</th></tr></thead>
        <tbody>{recipients.slice((currentPage - 1) * pageSize, currentPage * pageSize).map(row => <tr key={row.id}>
          <td><input type="checkbox" aria-label={`Seleccionar a ${row.name}`} checked={selected.includes(row.id)} disabled={busy} onChange={event => setSelected(current => event.target.checked ? [...current, row.id] : current.filter(id => id !== row.id))} /></td>
          <td>{row.name}<small>{row.identification}</small></td><td>{row.email || 'Sin correo configurado'}{row.email && !row.canEmail && <small>Revisa el correo del empleado</small>}</td>
          <td>{results[row.id]?.sent ? <span className="payroll__badge payroll__badge--ACCEPTED">Envío exitoso</span> : results[row.id]?.message ?? '—'}</td>
          <td><div className="payroll__toolbar"><Button variant="ghost" aria-label={results[row.id]?.sent ? `Desprendible enviado a ${row.name}` : `Enviar desprendible a ${row.name}`} aria-busy={activity?.kind === 'send' && activity.ids.includes(row.id) && !results[row.id]?.sent} disabled={busy || !row.canEmail || results[row.id]?.sent} onClick={() => void send([row])}>{results[row.id]?.sent ? <><CheckIcon />Enviado</> : activity?.kind === 'send' && activity.ids.includes(row.id) ? 'Enviando…' : 'Enviar correo'}</Button><Button variant="ghost" aria-label={`Descargar desprendible de ${row.name}`} aria-busy={activity?.kind === 'download' && activity.ids.includes(row.id)} disabled={busy} onClick={() => void download([row.id], true)}>Descargar PDF</Button></div></td>
        </tr>)}</tbody>
      </table></div>
      {shouldShowTablePagination(recipients.length, pageSize) && <nav className="payroll__pagination" aria-label="Páginas de desprendibles"><Button variant="outline" disabled={busy || currentPage <= 1} onClick={() => setPage(currentPage - 1)}>Anterior</Button><span>{currentPage} / {pages}</span><Button variant="outline" disabled={busy || currentPage >= pages} onClick={() => setPage(currentPage + 1)}>Siguiente</Button></nav>}
    </>}
    {busy && progress && <p role="status" className="payroll__muted">{progress}</p>}
    {notice && <PayrollNotice message={notice.message} variant={notice.variant} />}
    {downloadError && <p role="alert" className="payroll__notice payroll__notice--error">{downloadError}</p>}
  </Modal>
}
