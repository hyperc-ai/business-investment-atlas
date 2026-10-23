"use client"

import * as React from "react"

import { liveValue, settledValue } from "@/lib/number-draft"

type NumberFieldProps = Omit<
  React.ComponentProps<"input">,
  "type" | "value" | "defaultValue" | "onChange" | "min" | "max"
> & {
  value: number
  min: number
  max: number
  onValueChange: (value: number) => void
}

// A number input that keeps what is being typed. In-range values update the
// model as they are typed; anything else waits for blur or Enter, where it is
// clamped into range, and an empty or unreadable entry reverts.
function NumberField({ value, min, max, onValueChange, onBlur, onKeyDown, ...props }: NumberFieldProps) {
  const [draft, setDraft] = React.useState<string | null>(null)

  const settle = (raw: string) => {
    const next = settledValue(raw, min, max)
    if (next !== null && next !== value) onValueChange(next)
    setDraft(null)
  }

  return (
    <input
      {...props}
      type="number"
      min={min}
      max={max}
      value={draft ?? String(value)}
      onChange={(event) => {
        const raw = event.currentTarget.value
        setDraft(raw)
        const next = liveValue(raw, min, max)
        if (next !== null && next !== value) onValueChange(next)
      }}
      onBlur={(event) => {
        if (draft !== null) settle(event.currentTarget.value)
        onBlur?.(event)
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" && draft !== null) settle(event.currentTarget.value)
        onKeyDown?.(event)
      }}
    />
  )
}

export { NumberField }
