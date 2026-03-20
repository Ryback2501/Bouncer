import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { CopyableCode } from '../components/shared/CopyableCode'

describe('CopyableCode', () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
  })

  it('renders the value', () => {
    render(<CopyableCode value="bncr_abc123" />)
    expect(screen.getByText('bncr_abc123')).toBeInTheDocument()
  })

  it('copies value to clipboard when button clicked', async () => {
    render(<CopyableCode value="bncr_abc123" />)
    fireEvent.click(screen.getByRole('button', { name: /copy/i }))
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('bncr_abc123')
    })
  })
})
