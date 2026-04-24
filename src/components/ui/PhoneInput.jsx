import { useState, useCallback } from 'react'

function formatPhone(value) {
  const digits = (value || '').replace(/\D/g, '').slice(0, 10)
  if (digits.length === 0) return ''
  if (digits.length <= 3) return `(${digits}`
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

export default function PhoneInput({ value, onChange, className, ...props }) {
  const handleChange = useCallback((e) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 10)
    const formatted = formatPhone(raw)
    onChange({ target: { value: formatted } })
  }, [onChange])

  return (
    <input
      {...props}
      type="tel"
      className={className}
      value={formatPhone(value)}
      onChange={handleChange}
    />
  )
}
