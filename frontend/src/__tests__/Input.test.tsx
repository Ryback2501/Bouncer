import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Input } from '../components/shared/Input'

describe('Input', () => {
  it('renders label when provided', () => {
    render(<Input label="Email" />)
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
  })

  it('renders without label', () => {
    render(<Input placeholder="Enter text" />)
    expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument()
  })

  it('shows error message when error prop is set', () => {
    render(<Input label="Name" error="Name is required" />)
    expect(screen.getByText('Name is required')).toBeInTheDocument()
  })

  it('does not show error message when error is undefined', () => {
    render(<Input label="Name" />)
    expect(screen.queryByRole('paragraph')).not.toBeInTheDocument()
  })
})
