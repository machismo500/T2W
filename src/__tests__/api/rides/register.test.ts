import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createNextRequest, parseResponse, mockSuperAdmin, mockRider, mockT2WRider } from '@/__tests__/helpers';

vi.mock('@/lib/db', () => ({
  prisma: {
    ride: {
      findUnique: vi.fn(),
    },
    rideRegistration: {
      create: vi.fn(),
    },
  },
}));

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn(() => ({
      sendMail: vi.fn().mockResolvedValue({}),
    })),
  },
}));

import { POST } from '@/app/api/rides/[id]/register/route';
import { prisma } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

const mockGetCurrentUser = getCurrentUser as ReturnType<typeof vi.fn>;
const mockFindUnique = prisma.ride.findUnique as ReturnType<typeof vi.fn>;
const mockCreateRegistration = prisma.rideRegistration.create as ReturnType<typeof vi.fn>;

// Helper to call the route handler with params
function callPOST(rideId: string, body: Record<string, unknown>) {
  const req = createNextRequest(`http://localhost:3000/api/rides/${rideId}/register`, {
    method: 'POST',
    body,
  });
  return POST(req, { params: Promise.resolve({ id: rideId }) });
}

const futureStart = new Date(Date.now() + 7 * 86400000); // 7 days from now
const futureEnd = new Date(Date.now() + 10 * 86400000); // 10 days from now

const baseRide = {
  id: 'ride-1',
  title: 'Test Ride',
  status: 'upcoming',
  startDate: futureStart,
  endDate: futureEnd,
  maxRiders: 10,
  regOpenCore: null,
  regOpenT2w: null,
  regOpenRider: null,
  registrations: [],
};

const baseRegBody = {
  riderName: 'Test Rider',
  email: 'test@example.com',
  phone: '9999999999',
  foodPreference: 'vegetarian',
  ridingType: 'solo',
  agreedCancellationTerms: true,
  agreedIndemnity: true,
  paymentScreenshot: 'data:image/png;base64,abc',
};

describe('POST /api/rides/[id]/register', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: SMTP not configured (no email sending)
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
  });

  it('returns 401 for unauthenticated user', async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const { status, data } = await parseResponse(await callPOST('ride-1', baseRegBody));

    expect(status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('returns 404 when ride not found', async () => {
    mockGetCurrentUser.mockResolvedValue(mockRider);
    mockFindUnique.mockResolvedValue(null);

    const { status, data } = await parseResponse(await callPOST('nonexistent', baseRegBody));

    expect(status).toBe(404);
    expect(data.error).toBe('Ride not found');
  });

  it('returns 400 for non-upcoming ride', async () => {
    mockGetCurrentUser.mockResolvedValue(mockRider);
    const pastStart = new Date(Date.now() - 10 * 86400000);
    const pastEnd = new Date(Date.now() - 3 * 86400000);
    mockFindUnique.mockResolvedValue({ ...baseRide, status: 'completed', startDate: pastStart, endDate: pastEnd });

    const { status, data } = await parseResponse(await callPOST('ride-1', baseRegBody));

    expect(status).toBe(400);
    expect(data.error).toContain('Registration is closed');
  });

  it('returns 403 when registration not yet open for user tier', async () => {
    mockGetCurrentUser.mockResolvedValue(mockRider);
    const futureDate = new Date(Date.now() + 86400000); // tomorrow
    mockFindUnique.mockResolvedValue({
      ...baseRide,
      regOpenRider: futureDate,
    });

    const { status, data } = await parseResponse(await callPOST('ride-1', baseRegBody));

    expect(status).toBe(403);
    expect(data.error).toContain('not yet open');
  });

  it('allows registration when spots available', async () => {
    mockGetCurrentUser.mockResolvedValue(mockRider);
    mockFindUnique.mockResolvedValue({
      ...baseRide,
      maxRiders: 10,
      registrations: [
        { id: 'reg-1', approvalStatus: 'confirmed' },
        { id: 'reg-2', approvalStatus: 'confirmed' },
      ],
    });
    mockCreateRegistration.mockResolvedValue({
      id: 'reg-new',
      confirmationCode: 'T2W-RIDE1-ABC123',
      registeredAt: new Date(),
    });

    const { status, data } = await parseResponse(await callPOST('ride-1', baseRegBody));

    expect(status).toBe(200);
    expect(data.confirmationCode).toBeDefined();
    expect(data.registration.id).toBe('reg-new');
  });

  it('returns 400 when ride is full (all confirmed)', async () => {
    mockGetCurrentUser.mockResolvedValue(mockRider);
    mockFindUnique.mockResolvedValue({
      ...baseRide,
      maxRiders: 3,
      registrations: [
        { id: 'reg-1', approvalStatus: 'confirmed' },
        { id: 'reg-2', approvalStatus: 'confirmed' },
        { id: 'reg-3', approvalStatus: 'confirmed' },
      ],
    });

    const { status, data } = await parseResponse(await callPOST('ride-1', baseRegBody));

    expect(status).toBe(400);
    expect(data.error).toContain('full');
  });

  it('returns 400 when ride is full (mix of pending + confirmed)', async () => {
    mockGetCurrentUser.mockResolvedValue(mockRider);
    mockFindUnique.mockResolvedValue({
      ...baseRide,
      maxRiders: 3,
      registrations: [
        { id: 'reg-1', approvalStatus: 'confirmed' },
        { id: 'reg-2', approvalStatus: 'pending' },
        { id: 'reg-3', approvalStatus: 'pending' },
      ],
    });

    const { status, data } = await parseResponse(await callPOST('ride-1', baseRegBody));

    expect(status).toBe(400);
    expect(data.error).toContain('full');
  });

  // ── KEY FIX: dropout and rejected registrations don't count toward capacity ──

  it('allows registration when a rider dropped out (frees a spot)', async () => {
    mockGetCurrentUser.mockResolvedValue(mockRider);
    mockFindUnique.mockResolvedValue({
      ...baseRide,
      maxRiders: 3,
      registrations: [
        { id: 'reg-1', approvalStatus: 'confirmed' },
        { id: 'reg-2', approvalStatus: 'confirmed' },
        { id: 'reg-3', approvalStatus: 'dropout' }, // dropped out — spot freed
      ],
    });
    mockCreateRegistration.mockResolvedValue({
      id: 'reg-new',
      confirmationCode: 'T2W-RIDE1-XYZ789',
      registeredAt: new Date(),
    });

    const { status, data } = await parseResponse(await callPOST('ride-1', baseRegBody));

    expect(status).toBe(200);
    expect(data.confirmationCode).toBeDefined();
  });

  it('allows registration when a rider is rejected (frees a spot)', async () => {
    mockGetCurrentUser.mockResolvedValue(mockRider);
    mockFindUnique.mockResolvedValue({
      ...baseRide,
      maxRiders: 3,
      registrations: [
        { id: 'reg-1', approvalStatus: 'confirmed' },
        { id: 'reg-2', approvalStatus: 'confirmed' },
        { id: 'reg-3', approvalStatus: 'rejected' }, // rejected — spot freed
      ],
    });
    mockCreateRegistration.mockResolvedValue({
      id: 'reg-new',
      confirmationCode: 'T2W-RIDE1-DEF456',
      registeredAt: new Date(),
    });

    const { status, data } = await parseResponse(await callPOST('ride-1', baseRegBody));

    expect(status).toBe(200);
    expect(data.confirmationCode).toBeDefined();
  });

  it('still blocks when active registrations fill capacity despite dropouts existing', async () => {
    mockGetCurrentUser.mockResolvedValue(mockRider);
    mockFindUnique.mockResolvedValue({
      ...baseRide,
      maxRiders: 3,
      registrations: [
        { id: 'reg-1', approvalStatus: 'confirmed' },
        { id: 'reg-2', approvalStatus: 'confirmed' },
        { id: 'reg-3', approvalStatus: 'pending' },
        { id: 'reg-4', approvalStatus: 'dropout' },  // doesn't count
        { id: 'reg-5', approvalStatus: 'rejected' },  // doesn't count
      ],
    });

    const { status, data } = await parseResponse(await callPOST('ride-1', baseRegBody));

    expect(status).toBe(400);
    expect(data.error).toContain('full');
  });

  it('allows registration when multiple dropouts free multiple spots', async () => {
    mockGetCurrentUser.mockResolvedValue(mockRider);
    mockFindUnique.mockResolvedValue({
      ...baseRide,
      maxRiders: 5,
      registrations: [
        { id: 'reg-1', approvalStatus: 'confirmed' },
        { id: 'reg-2', approvalStatus: 'confirmed' },
        { id: 'reg-3', approvalStatus: 'dropout' },
        { id: 'reg-4', approvalStatus: 'dropout' },
        { id: 'reg-5', approvalStatus: 'rejected' },
      ],
    });
    mockCreateRegistration.mockResolvedValue({
      id: 'reg-new',
      confirmationCode: 'T2W-RIDE1-GHI789',
      registeredAt: new Date(),
    });

    const { status } = await parseResponse(await callPOST('ride-1', baseRegBody));

    // Active: 2 confirmed, max: 5 → 3 spots left
    expect(status).toBe(200);
  });

  it('handles ride with zero registrations', async () => {
    mockGetCurrentUser.mockResolvedValue(mockRider);
    mockFindUnique.mockResolvedValue({
      ...baseRide,
      maxRiders: 10,
      registrations: [],
    });
    mockCreateRegistration.mockResolvedValue({
      id: 'reg-first',
      confirmationCode: 'T2W-RIDE1-FIRST1',
      registeredAt: new Date(),
    });

    const { status } = await parseResponse(await callPOST('ride-1', baseRegBody));

    expect(status).toBe(200);
  });

  it('handles ride with all dropouts (all spots available)', async () => {
    mockGetCurrentUser.mockResolvedValue(mockRider);
    mockFindUnique.mockResolvedValue({
      ...baseRide,
      maxRiders: 3,
      registrations: [
        { id: 'reg-1', approvalStatus: 'dropout' },
        { id: 'reg-2', approvalStatus: 'dropout' },
        { id: 'reg-3', approvalStatus: 'dropout' },
      ],
    });
    mockCreateRegistration.mockResolvedValue({
      id: 'reg-new',
      confirmationCode: 'T2W-RIDE1-NEW123',
      registeredAt: new Date(),
    });

    const { status } = await parseResponse(await callPOST('ride-1', baseRegBody));

    // All dropouts — 0 active, 3 max → should succeed
    expect(status).toBe(200);
  });

  // ── Staggered registration schedule tests ──

  it('allows superadmin when regOpenCore is in the past', async () => {
    mockGetCurrentUser.mockResolvedValue(mockSuperAdmin);
    const pastDate = new Date(Date.now() - 86400000); // yesterday
    mockFindUnique.mockResolvedValue({
      ...baseRide,
      regOpenCore: pastDate,
      regOpenT2w: new Date(Date.now() + 86400000),
      regOpenRider: new Date(Date.now() + 172800000),
    });
    mockCreateRegistration.mockResolvedValue({
      id: 'reg-admin',
      confirmationCode: 'T2W-RIDE1-ADMIN1',
      registeredAt: new Date(),
    });

    const { status } = await parseResponse(await callPOST('ride-1', baseRegBody));

    expect(status).toBe(200);
  });

  it('blocks t2w_rider when regOpenT2w is in the future', async () => {
    mockGetCurrentUser.mockResolvedValue(mockT2WRider);
    const futureDate = new Date(Date.now() + 86400000);
    mockFindUnique.mockResolvedValue({
      ...baseRide,
      regOpenCore: new Date(Date.now() - 86400000),
      regOpenT2w: futureDate,
      regOpenRider: new Date(Date.now() + 172800000),
    });

    const { status, data } = await parseResponse(await callPOST('ride-1', baseRegBody));

    expect(status).toBe(403);
    expect(data.error).toContain('not yet open');
  });

  // ── Duplicate registration ──

  it('returns 409 for duplicate registration (P2002 error)', async () => {
    mockGetCurrentUser.mockResolvedValue(mockRider);
    mockFindUnique.mockResolvedValue(baseRide);
    const prismaError = new Error('Unique constraint failed');
    Object.assign(prismaError, { code: 'P2002' });
    mockCreateRegistration.mockRejectedValue(prismaError);

    const { status, data } = await parseResponse(await callPOST('ride-1', baseRegBody));

    expect(status).toBe(409);
    expect(data.error).toBe('You are already registered for this ride');
  });

  // ── Registration data passed to prisma correctly ──

  it('passes correct registration data to prisma', async () => {
    mockGetCurrentUser.mockResolvedValue(mockRider);
    mockFindUnique.mockResolvedValue(baseRide);
    mockCreateRegistration.mockResolvedValue({
      id: 'reg-detail',
      confirmationCode: 'T2W-RIDE1-DET123',
      registeredAt: new Date(),
    });

    await callPOST('ride-1', {
      ...baseRegBody,
      address: '123 Main St',
      bloodGroup: 'O+',
      vehicleModel: 'Royal Enfield Himalayan',
    });

    expect(mockCreateRegistration).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: mockRider.id,
        rideId: 'ride-1',
        riderName: 'Test Rider',
        email: 'test@example.com',
        phone: '9999999999',
        address: '123 Main St',
        bloodGroup: 'O+',
        vehicleModel: 'Royal Enfield Himalayan',
        approvalStatus: 'pending',
      }),
    });
  });
});
