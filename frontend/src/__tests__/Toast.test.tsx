import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { ToastProvider } from '../components/shared/Toast'
import { useToast } from '../components/shared/useToast'

function TestComponent() {
  const toast = useToast()
  return (
    <div>
      <button onClick={() => toast.success('Saved!')}>success</button>
      <button onClick={() => toast.error('Failed!')}>error</button>
    </div>
  )
}

function renderToast() {
  return render(
    <ToastProvider>
      <TestComponent />
    </ToastProvider>
  )
}

describe('ToastProvider', () => {
  it('shows success toast when success() is called', () => {
    renderToast()
    fireEvent.click(screen.getByRole('button', { name: 'success' }))
    expect(screen.getByText('Saved!')).toBeInTheDocument()
  })

  it('shows error toast when error() is called', () => {
    renderToast()
    fireEvent.click(screen.getByRole('button', { name: 'error' }))
    expect(screen.getByText('Failed!')).toBeInTheDocument()
  })

  it('removes toast when X button is clicked', () => {
    renderToast()
    fireEvent.click(screen.getByRole('button', { name: 'success' }))
    expect(screen.getByText('Saved!')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '' }))  // X button has no text
    expect(screen.queryByText('Saved!')).not.toBeInTheDocument()
  })

  it('auto-removes toast after 4 seconds', async () => {
    vi.useFakeTimers()
    renderToast()
    fireEvent.click(screen.getByRole('button', { name: 'success' }))
    expect(screen.getByText('Saved!')).toBeInTheDocument()
    act(() => { vi.advanceTimersByTime(4001) })
    expect(screen.queryByText('Saved!')).not.toBeInTheDocument()
    vi.useRealTimers()
  })
})
