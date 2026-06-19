import { describe, it, expect, vi, beforeEach } from 'vitest'
import React from 'react'
import { render, screen } from '@testing-library/react'
import AuthGuard from '../components/AuthGuard'

// Mock react-router-dom so Navigate and useLocation don't need a real router
const mockNavigate = vi.fn()
vi.mock('react-router-dom', () => ({
  Navigate: ({ to }: { to: string }) => {
    mockNavigate(to)
    return <div data-testid="navigate-mock" data-to={to} />
  },
  useLocation: () => ({ pathname: '/campaign_main/test-campaign' }),
}))

// Factory that configures useAuthStore mock per-test
const mockUseAuthStore = vi.fn()
vi.mock('../store/authStore', () => ({
  useAuthStore: (...args: any[]) => mockUseAuthStore(...args),
}))

const setAuthState = (overrides: Record<string, unknown> = {}) => {
  const state = {
    user: { uid: 'user-123' },
    profile: { username: 'TestUser', status: 'active' },
    isLoading: false,
    signOut: vi.fn(),
    ...overrides,
  }
  mockUseAuthStore.mockImplementation((selector: any) =>
    typeof selector === 'function' ? selector(state) : state
  )
}

describe('AuthGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders a loading spinner when auth state is initializing', () => {
    setAuthState({ isLoading: true, user: null })

    render(
      <AuthGuard>
        <div>Protected Content</div>
      </AuthGuard>
    )

    // Spinner is a div with animate-spin class
    const spinner = document.querySelector('.animate-spin')
    expect(spinner).toBeTruthy()
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
  })

  it('redirects to /login when user is not authenticated', () => {
    setAuthState({ user: null, profile: null, isLoading: false })

    render(
      <AuthGuard>
        <div>Protected Content</div>
      </AuthGuard>
    )

    expect(screen.getByTestId('navigate-mock')).toHaveAttribute('data-to', '/login')
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
  })

  it('renders children when user is authenticated with an active profile', () => {
    setAuthState({ user: { uid: 'user-123' }, profile: { username: 'Gimli', status: 'active' }, isLoading: false })

    render(
      <AuthGuard>
        <div>Protected Content</div>
      </AuthGuard>
    )

    expect(screen.getByText('Protected Content')).toBeInTheDocument()
    expect(screen.queryByTestId('navigate-mock')).not.toBeInTheDocument()
  })

  it('renders the "Access Under Review" block when profile status is "interested"', () => {
    setAuthState({
      user: { uid: 'user-123' },
      profile: { username: 'NewUser', status: 'interested' },
      isLoading: false,
    })

    render(
      <AuthGuard>
        <div>Protected Content</div>
      </AuthGuard>
    )

    expect(screen.getByText('Access Under Review')).toBeInTheDocument()
    expect(screen.getByText(/Interested/i)).toBeInTheDocument()
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
  })

  it('renders children when user is authenticated and profile is null (admin bootstrap edge case)', () => {
    // Profile may be null briefly right after first login before it loads
    setAuthState({ user: { uid: 'user-123' }, profile: null, isLoading: false })

    render(
      <AuthGuard>
        <div>Protected Content</div>
      </AuthGuard>
    )

    // With null profile, the 'interested' guard is not triggered, children should render
    expect(screen.getByText('Protected Content')).toBeInTheDocument()
  })
})
