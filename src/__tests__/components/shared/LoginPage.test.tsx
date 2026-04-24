import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginPage } from '@/components/shared/LoginPage';

const mockPush = vi.fn();
const mockLogin = vi.fn();
const mockSendResetOtp = vi.fn();
const mockVerifyResetOtp = vi.fn();
const mockResetPassword = vi.fn();

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    login: mockLogin,
    sendResetOtp: mockSendResetOtp,
    verifyResetOtp: mockVerifyResetOtp,
    resetPassword: mockResetPassword,
  }),
}));

vi.mock('lucide-react', () => ({
  Mail: () => <span data-testid="icon-mail" />,
  Lock: () => <span data-testid="icon-lock" />,
  Eye: () => <span data-testid="icon-eye" />,
  EyeOff: () => <span data-testid="icon-eyeoff" />,
  ArrowRight: () => <span data-testid="icon-arrowright" />,
  ArrowLeft: () => <span data-testid="icon-arrowleft" />,
  X: () => <span data-testid="icon-x" />,
  CheckCircle: () => <span data-testid="icon-check" />,
  AlertCircle: () => <span data-testid="icon-alert" />,
  KeyRound: () => <span data-testid="icon-key" />,
  ShieldCheck: () => <span data-testid="icon-shield" />,
  XCircle: () => <span data-testid="icon-xcircle" />,
  AlertTriangle: () => <span data-testid="icon-alerttriangle" />,
  Info: () => <span data-testid="icon-info" />,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('LoginPage', () => {
  it('renders email and password inputs', () => {
    render(<LoginPage />);
    expect(screen.getByPlaceholderText('rider@example.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter your password')).toBeInTheDocument();
  });

  it('renders login button', () => {
    render(<LoginPage />);
    expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
  });

  it('shows error message on failed login', async () => {
    mockLogin.mockRejectedValueOnce(new Error('Invalid credentials'));
    const user = userEvent.setup();

    render(<LoginPage />);

    await user.type(screen.getByPlaceholderText('rider@example.com'), 'test@test.com');
    await user.type(screen.getByPlaceholderText('Enter your password'), 'wrongpass');
    await user.click(screen.getByRole('button', { name: /login/i }));

    await waitFor(() => {
      expect(screen.getByText(/Invalid credentials/i)).toBeInTheDocument();
    });
  });

  it('calls login on form submit', async () => {
    mockLogin.mockResolvedValueOnce({ user: { id: '1', name: 'Test' } });
    const user = userEvent.setup();

    render(<LoginPage />);

    await user.type(screen.getByPlaceholderText('rider@example.com'), 'test@test.com');
    await user.type(screen.getByPlaceholderText('Enter your password'), 'password123');
    await user.click(screen.getByRole('button', { name: /login/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('test@test.com', 'password123');
    });
  });

  it('redirects on successful login', async () => {
    mockLogin.mockResolvedValueOnce({ user: { id: '1', name: 'Test', linkedRiderId: null } });
    const user = userEvent.setup();

    render(<LoginPage />);

    await user.type(screen.getByPlaceholderText('rider@example.com'), 'test@test.com');
    await user.type(screen.getByPlaceholderText('Enter your password'), 'password123');
    await user.click(screen.getByRole('button', { name: /login/i }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/rides');
    });
  });

  it('shows forgot password link', () => {
    render(<LoginPage />);
    expect(screen.getByText(/forgot password/i)).toBeInTheDocument();
  });

  it('shows register link', () => {
    render(<LoginPage />);
    expect(screen.getByText(/create an account/i)).toBeInTheDocument();
  });
});
