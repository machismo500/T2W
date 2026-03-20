import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Footer } from '@/components/layout/Footer';

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Mail: () => <span data-testid="icon-mail" />,
  Phone: () => <span data-testid="icon-phone" />,
  MapPin: () => <span data-testid="icon-mappin" />,
  Instagram: () => <span data-testid="icon-instagram" />,
  Youtube: () => <span data-testid="icon-youtube" />,
  Facebook: () => <span data-testid="icon-facebook" />,
  Twitter: () => <span data-testid="icon-twitter" />,
  Heart: () => <span data-testid="icon-heart" />,
  ArrowUpRight: () => <span data-testid="icon-arrow" />,
}));

describe('Footer', () => {
  it('renders the brand name', () => {
    render(<Footer />);
    expect(screen.getByText('Tales on 2 Wheels')).toBeInTheDocument();
  });

  it('renders copyright text with current year', () => {
    render(<Footer />);
    const year = new Date().getFullYear();
    expect(screen.getByText(new RegExp(`${year}`))).toBeInTheDocument();
  });

  it('renders social links', () => {
    render(<Footer />);
    expect(screen.getByLabelText('Instagram')).toBeInTheDocument();
    expect(screen.getByLabelText('YouTube')).toBeInTheDocument();
    expect(screen.getByLabelText('Facebook')).toBeInTheDocument();
    expect(screen.getByLabelText('Twitter')).toBeInTheDocument();
  });

  it('renders navigation sections', () => {
    render(<Footer />);
    expect(screen.getByText('Rides')).toBeInTheDocument();
    expect(screen.getByText('Community')).toBeInTheDocument();
    expect(screen.getByText('Company')).toBeInTheDocument();
  });

  it('renders ride links', () => {
    render(<Footer />);
    expect(screen.getByText('Upcoming Rides')).toBeInTheDocument();
    expect(screen.getByText('Past Rides')).toBeInTheDocument();
  });

  it('renders community links', () => {
    render(<Footer />);
    expect(screen.getByText('Blog')).toBeInTheDocument();
    expect(screen.getByText('Guidelines')).toBeInTheDocument();
  });

  it('renders contact information', () => {
    render(<Footer />);
    expect(screen.getByText('Info@taleson2wheels.com')).toBeInTheDocument();
    expect(screen.getByText('+91 98801 41543')).toBeInTheDocument();
  });

  it('renders popular routes section', () => {
    render(<Footer />);
    expect(screen.getByText('Popular Motorcycle Routes from Bangalore')).toBeInTheDocument();
    expect(screen.getByText('Bangalore to Goa')).toBeInTheDocument();
  });

  it('renders "Made with heart" text', () => {
    render(<Footer />);
    expect(screen.getByText(/Made with/)).toBeInTheDocument();
    expect(screen.getByText(/by riders/)).toBeInTheDocument();
  });
});
