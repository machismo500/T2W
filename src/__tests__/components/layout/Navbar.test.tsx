import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Navbar } from '@/components/layout/Navbar';

const mockPush = vi.fn();
const mockLogout = vi.fn();
let mockUser: any = null;
let mockLoading = false;

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/',
}));

// Mock auth context
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    loading: mockLoading,
    logout: mockLogout,
  }),
}));

// Mock lucide-react
vi.mock('lucide-react', () => ({
  Menu: () => <span data-testid="icon-menu" />,
  X: () => <span data-testid="icon-x" />,
  User: () => <span data-testid="icon-user" />,
  LogIn: () => <span data-testid="icon-login" />,
  LogOut: () => <span data-testid="icon-logout" />,
  Shield: () => <span data-testid="icon-shield" />,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockUser = null;
  mockLoading = false;
});

describe('Navbar', () => {
  it('renders navigation links', () => {
    render(<Navbar />);
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('T2W Tales')).toBeInTheDocument();
    expect(screen.getByText('Guidelines')).toBeInTheDocument();
    expect(screen.getByText('Blogs & Vlogs')).toBeInTheDocument();
  });

  it('shows Login link when not authenticated', () => {
    render(<Navbar />);
    expect(screen.getByText('Login')).toBeInTheDocument();
  });

  it('shows user first name when authenticated', () => {
    mockUser = { name: 'Test Rider', role: 'rider', linkedRiderId: null };
    render(<Navbar />);
    // Desktop nav shows first name only via user.name.split(" ")[0]
    expect(screen.getByText('Test')).toBeInTheDocument();
  });

  it('shows Admin link for admin users', () => {
    mockUser = { name: 'Super Boss', role: 'superadmin', linkedRiderId: null };
    render(<Navbar />);
    // Admin link in desktop nav
    expect(screen.getByText(/Admin/)).toBeInTheDocument();
  });

  it('has accessible navigation role', () => {
    render(<Navbar />);
    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });
});
