import { NextRequest } from 'next/server';

export function createNextRequest(
  url: string,
  options?: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
  }
): NextRequest {
  const { method = 'GET', body, headers = {} } = options || {};
  const init: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
  };
  if (body) init.body = JSON.stringify(body);
  return new NextRequest(new URL(url, 'http://localhost:3000'), init);
}

export async function parseResponse(response: Response) {
  const data = await response.json();
  return { status: response.status, data };
}

// Common mock user objects for tests
export const mockSuperAdmin = {
  id: 'user-1',
  name: 'Super Admin',
  email: 'admin@t2w.com',
  role: 'superadmin' as const,
  isApproved: true,
  totalKm: 5000,
  ridesCompleted: 20,
  linkedRiderId: 'rider-1',
  joinDate: new Date('2024-01-01'),
  motorcycles: [],
  earnedBadges: [],
};

export const mockCoreMember = {
  ...mockSuperAdmin,
  id: 'user-2',
  name: 'Core Member',
  email: 'core@t2w.com',
  role: 'core_member' as const,
};

export const mockRider = {
  ...mockSuperAdmin,
  id: 'user-3',
  name: 'Test Rider',
  email: 'rider@t2w.com',
  role: 'rider' as const,
  totalKm: 100,
  ridesCompleted: 2,
};

export const mockT2WRider = {
  ...mockSuperAdmin,
  id: 'user-4',
  name: 'T2W Rider',
  email: 't2wrider@t2w.com',
  role: 't2w_rider' as const,
  totalKm: 500,
  ridesCompleted: 5,
};
