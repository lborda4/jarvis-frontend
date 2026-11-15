import { payrollSubmissionAdvice } from '../../utils/payrollSubmissionAdvice'
import { payrollSubmissionErrors } from '../../utils/payrollSubmissionErrors'

export default function PayrollSubmissionFeedback({ errors }: { errors: string[] }) {
  const messages = payrollSubmissionErrors(errors)
  const advice = payrollSubmissionAdvice(messages)
  if (!messages.length) return null
  return (
    <details className="payroll-submission-error" open>
      <summary>Revisa el envío · {messages.length} {messages.length === 1 ? 'aviso' : 'avisos'}</summary>
      {advice.length ? <>
        <p>Revisa la configuración de la empresa y del software de nómina en NextPyme:</p>
        <ul>{advice.map(message => <li key={message}>{message}</li>)}</ul>
        <p>La generación del archivo adjunto no significa que la DIAN haya aceptado la nómina.</p>
        <details><summary>Ver rechazo original</summary><ul>{messages.map(error => <li key={error}>{error}</li>)}</ul></details>
      </> : <ul>{messages.map(error => <li key={error}>{error}</li>)}</ul>}
    </details>
  )
}
