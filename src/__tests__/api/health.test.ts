import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseResponse } from '@/__tests__/helpers';

vi.mock('@/lib/db', () => ({
  prisma: {
    $queryRaw: vi.fn(),
  },
}));

import { GET } from '@/app/api/health/route';
import { prisma } from '@/lib/db';

const mockQueryRaw = prisma.$queryRaw as ReturnType<typeof vi.fn>;

describe('GET /api/health', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 with database.status="connected" when DB query succeeds', async () => {
    mockQueryRaw.mockResolvedValue([{ ok: 1 }]);

    const { status, data } = await parseResponse(await GET());

    expect(status).toBe(200);
    expect(data.database.status).toBe('connected');
    expect(data.timestamp).toBeDefined();
  });

  it('returns 503 with database.status="error" when DB query fails', async () => {
    mockQueryRaw.mockRejectedValue(new Error('Connection refused'));

    const { status, data } = await parseResponse(await GET());

    expect(status).toBe(503);
    expect(data.database.status).toBe('error');
    expect(data.database.message).toBe('Connection refused');
  });
});
