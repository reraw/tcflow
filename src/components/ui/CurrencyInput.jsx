import { useState, useCallback } from 'react'

function formatUSD(value) {
  if (value === '' || value == null) return ''
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return ''
  return num.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function stripToNumber(str) {
  const cleaned = str.replace(/[^0-9.]/g, '')
  // Only allow one decimal point
  const parts = cleaned.split('.')
  if (parts.length > 2) return parts[0] + '.' + parts.slice(1).join('')
  return cleaned
}

export default function CurrencyInput({ value, onChange, className, ...props }) {
  const [focused, setFocused] = useState(false)
  const [displayValue, setDisplayValue] = useState('')

  const rawNum = value === '' || value == null ? '' : String(value)

  const handleFocus = useCallback(() => {
    setFocused(true)
    setDisplayValue(rawNum)
  }, [rawNum])

  const handleBlur = useCallback(() => {
    setFocused(false)
  }, [])

  const handleChange = useCallback((e) => {
    const raw = stripToNumber(e.target.value)
    setDisplayValue(raw)
    // Pass raw numeric value up
    if (raw === '' || raw === '.') {
      onChange({ target: { value: '' } })
    } else {
      onChange({ target: { value: raw } })
    }
  }, [onChange])

  const shown = focused ? displayValue : formatUSD(rawNum)

  return (
    <input
      {...props}
      type="text"
      inputMode="decimal"
      className={className}
      value={shown}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onChange={handleChange}
    />
  )
}
