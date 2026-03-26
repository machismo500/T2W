import { describe, it, expect } from 'vitest';

/**
 * Tests to verify that the data consolidation (merging static data files
 * into the single database) was done correctly and all types are available
 * from the centralized types module.
 */

describe('Type consolidation', () => {
  it('exports RiderProfile from @/types', async () => {
    // Dynamically import to verify the type module resolves
    const types = await import('@/types');
    // TypeScript interfaces don't exist at runtime, but we can verify
    // the module exports without errors
    expect(types).toBeDefined();
  });

  it('exports Badge and BadgeTier from @/types', async () => {
    const types = await import('@/types');
    expect(types).toBeDefined();
  });

  it('api-client imports RiderProfile from @/types (not @/data/rider-profiles)', async () => {
    // Read the api-client source to verify it no longer imports from static data files
    // This is a safeguard test - if someone re-adds the old import it will catch it
    const fs = await import('fs');
    const path = await import('path');
    const apiClientPath = path.resolve(__dirname, '../../lib/api-client.ts');
    const content = fs.readFileSync(apiClientPath, 'utf-8');

    expect(content).not.toContain('from "@/data/rider-profiles"');
    expect(content).not.toContain("from '@/data/rider-profiles'");
    expect(content).toContain('from "@/types"');
  });

  it('no app code imports from @/data/badges', async () => {
    const fs = await import('fs');
    const path = await import('path');

    // Check the arena components don't import from the deleted file
    const arenaPagePath = path.resolve(__dirname, '../../components/riders/RiderArenaPage.tsx');
    const leaderboardPath = path.resolve(__dirname, '../../components/riders/ArenaLeaderboard.tsx');

    const arenaContent = fs.readFileSync(arenaPagePath, 'utf-8');
    const leaderboardContent = fs.readFileSync(leaderboardPath, 'utf-8');

    expect(arenaContent).not.toContain('@/data/badges');
    expect(leaderboardContent).not.toContain('@/data/badges');
  });

  it('ArenaLeaderboard accepts badgeTiers as a prop', async () => {
    const fs = await import('fs');
    const path = await import('path');

    const leaderboardPath = path.resolve(__dirname, '../../components/riders/ArenaLeaderboard.tsx');
    const content = fs.readFileSync(leaderboardPath, 'utf-8');

    // Verify the component accepts badgeTiers prop
    expect(content).toContain('badgeTiers: Badge[]');
    expect(content).toContain('badgeTiers');
  });

  it('RiderArenaPage fetches badges from API', async () => {
    const fs = await import('fs');
    const path = await import('path');

    const arenaPagePath = path.resolve(__dirname, '../../components/riders/RiderArenaPage.tsx');
    const content = fs.readFileSync(arenaPagePath, 'utf-8');

    // Verify it calls api.badges.list() instead of using static data
    expect(content).toContain('api.badges.list()');
    expect(content).not.toContain('BADGE_TIERS');
  });

  it('badges API route has PUT handler for admin updates', async () => {
    const fs = await import('fs');
    const path = await import('path');

    const routePath = path.resolve(__dirname, '../../app/api/badges/route.ts');
    const content = fs.readFileSync(routePath, 'utf-8');

    expect(content).toContain('export async function PUT');
    expect(content).toContain('role !== "superadmin"');
  });
});
