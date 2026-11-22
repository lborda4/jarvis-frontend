import type { ButtonHTMLAttributes } from 'react'
import { useSubscriptionAccess } from '../context/SubscriptionAccessContext'
import './Button.css'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  writeAction?: boolean
  variant?:
    | 'primary'
    | 'secondary'
    | 'ghost'
    | 'danger'
    | 'outline'
    | 'outline-danger'
    | 'outline-warning'
    | 'warning'
  size?: 'sm' | 'md'
}

function Button({
  variant = 'primary',
  size = 'md',
  className,
  type = 'button',
  disabled,
  writeAction = false,
  ...rest
}: ButtonProps) {
  const { readOnly } = useSubscriptionAccess()
  const classes = [
    'btn',
    `btn--${variant}`,
    `btn--${size}`,
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return <button type={type} className={classes} disabled={disabled || (readOnly && (writeAction || type === 'submit'))} {...rest} />
}

export default Button
