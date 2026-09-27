import { useId } from 'react'
import Button from './Button'
import {
  MAX_AI_RULES,
  MAX_AI_RULE_LENGTH,
  MAX_COMPANY_DESCRIPTION_LENGTH,
  type CompanyAiContext,
} from '../types/companyAiContext'
import './CompanyAiContextFields.css'

interface Props {
  value: CompanyAiContext
  onChange: (value: CompanyAiContext) => void
  disabled?: boolean
}
export default function CompanyAiContextFields({
  value,
  onChange,
  disabled,
}: Props) {
  const id = useId()
  return (
    <div className="company-ai-fields">
      <label htmlFor={id + '-description'}>Descripción de la empresa</label>
      <textarea
        id={id + '-description'}
        value={value.description}
        onChange={(event) =>
          onChange({ ...value, description: event.target.value })
        }
        maxLength={MAX_COMPANY_DESCRIPTION_LENGTH}
        rows={4}
        disabled={disabled}
        placeholder="Describe a qué se dedica la empresa y para qué utiliza sus compras."
      />
      <small>
        {value.description.length} / {MAX_COMPANY_DESCRIPTION_LENGTH}
      </small>
      <p>
        Reglas para sugerir cuentas contables ({value.rules.length}/
        {MAX_AI_RULES})
      </p>
      {value.rules.map((rule, index) => (
        <div className="company-ai-fields__rule" key={index}>
          <label htmlFor={id + '-rule-' + index}>Regla {index + 1}</label>
          <textarea
            id={id + '-rule-' + index}
            value={rule}
            onChange={(event) =>
              onChange({
                ...value,
                rules: value.rules.map((entry, position) =>
                  position === index ? event.target.value : entry,
                ),
              })
            }
            rows={2}
            maxLength={MAX_AI_RULE_LENGTH}
            disabled={disabled}
            placeholder="Ej.: los alimentos destinados a los almuerzos se registran en Costo Almuerzos."
          />
          <Button
            variant="ghost"
            size="sm"
            disabled={disabled}
            aria-label={'Eliminar regla ' + (index + 1)}
            onClick={() =>
              onChange({
                ...value,
                rules: value.rules.filter((_, position) => position !== index),
              })
            }
          >
            Eliminar
          </Button>
        </div>
      ))}
      <Button
        variant="secondary"
        disabled={disabled || value.rules.length >= MAX_AI_RULES}
        onClick={() => onChange({ ...value, rules: [...value.rules, ''] })}
      >
        + Agregar regla
      </Button>
      <small>
        Máximo 10 reglas de 500 caracteres. Se aplican a las nuevas solicitudes
        de sugerencias.
      </small>
    </div>
  )
}
