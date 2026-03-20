import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Modal } from '../components/shared/Modal'

describe('Modal', () => {
  it('renders nothing when closed', () => {
    render(<Modal open={false} onClose={() => {}} title="Test"><p>Content</p></Modal>)
    expect(screen.queryByText('Content')).not.toBeInTheDocument()
  })

  it('renders title and children when open', () => {
    render(<Modal open={true} onClose={() => {}} title="My Dialog"><p>Modal body</p></Modal>)
    expect(screen.getByText('My Dialog')).toBeInTheDocument()
    expect(screen.getByText('Modal body')).toBeInTheDocument()
  })

  it('calls onClose when X button is clicked', () => {
    const onClose = vi.fn()
    render(<Modal open={true} onClose={onClose} title="Test"><p>Body</p></Modal>)
    fireEvent.click(screen.getAllByRole('button')[0])
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn()
    render(<Modal open={true} onClose={onClose} title="Test"><p>Body</p></Modal>)
    const backdrop = document.querySelector('.absolute.inset-0')!
    fireEvent.click(backdrop)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls onClose on Escape key press', () => {
    const onClose = vi.fn()
    render(<Modal open={true} onClose={onClose} title="Test"><p>Body</p></Modal>)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })
})
