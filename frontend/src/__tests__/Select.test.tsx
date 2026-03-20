import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Select } from '../components/shared/Select'

describe('Select', () => {
  it('renders with label', () => {
    render(
      <Select label="Provider">
        <option value="google">Google</option>
      </Select>
    )
    expect(screen.getByLabelText('Provider')).toBeInTheDocument()
  })

  it('renders children as options', () => {
    render(
      <Select label="Provider">
        <option value="google">Google</option>
        <option value="microsoft">Microsoft</option>
      </Select>
    )
    expect(screen.getByRole('option', { name: 'Google' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Microsoft' })).toBeInTheDocument()
  })

  it('shows error message when error prop is set', () => {
    render(<Select label="Provider" error="Required"><option value="">—</option></Select>)
    expect(screen.getByText('Required')).toBeInTheDocument()
  })
})
