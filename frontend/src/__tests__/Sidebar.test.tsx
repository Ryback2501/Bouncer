import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Sidebar } from '../components/layout/Sidebar'

function renderSidebar(open = true) {
  return render(
    <MemoryRouter>
      <Sidebar open={open} onClose={vi.fn()} />
    </MemoryRouter>
  )
}

describe('Sidebar', () => {
  it('renders the Bouncer logo text', () => {
    renderSidebar()
    expect(screen.getByText('Bouncer')).toBeInTheDocument()
  })

  it('renders all navigation links', () => {
    renderSidebar()
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Applications')).toBeInTheDocument()
    expect(screen.getByText('Users')).toBeInTheDocument()
    expect(screen.getByText('Admin Access')).toBeInTheDocument()
  })

  it('calls onClose when mobile close button is clicked', () => {
    const onClose = vi.fn()
    render(
      <MemoryRouter>
        <Sidebar open={true} onClose={onClose} />
      </MemoryRouter>
    )
    // X close button (lg:hidden)
    const xButton = screen.getAllByRole('button')[0]
    fireEvent.click(xButton)
    expect(onClose).toHaveBeenCalled()
  })

  it('shows overlay when open on mobile', () => {
    const { container } = renderSidebar(true)
    expect(container.querySelector('.bg-black\\/40')).toBeInTheDocument()
  })

  it('hides overlay when closed', () => {
    const { container } = renderSidebar(false)
    expect(container.querySelector('.bg-black\\/40')).not.toBeInTheDocument()
  })
})
