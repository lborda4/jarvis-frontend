import MoneyInput from '../../components/MoneyInput'
import type { ComponentProps } from 'react'

export default function PayrollMoneyInput(props: ComponentProps<typeof MoneyInput>) {
  return <span className="payroll__money-input"><span aria-hidden="true">$</span><MoneyInput {...props} padDecimals /></span>
}
