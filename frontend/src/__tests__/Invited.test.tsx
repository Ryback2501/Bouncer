import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Invited } from '../pages/Invited'

function renderInvited(search = '') {
  return render(
    <MemoryRouter initialEntries={[`/invited${search}`]}>
      <Invited />
    </MemoryRouter>
  )
}

describe('Invited', () => {
  it('shows the success heading', () => {
    renderInvited()
    expect(screen.getByText("You're all set")).toBeInTheDocument()
    expect(screen.getByText('Access granted')).toBeInTheDocument()
  })

  it('names the application when provided via the app query param', () => {
    renderInvited('?app=my-app')
    expect(screen.getByText('my-app')).toBeInTheDocument()
  })
})
