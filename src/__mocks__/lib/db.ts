import { vi } from 'vitest';

const cache = new Map<string, ReturnType<typeof vi.fn>>();

function createPrismaMock(): unknown {
  return new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === 'then') return undefined;
        if (prop === '$queryRaw' || prop === '$executeRaw' || prop === '$transaction') {
          const key = String(prop);
          if (!cache.has(key)) cache.set(key, vi.fn());
          return cache.get(key);
        }
        return new Proxy(
          {},
          {
            get(_t, method) {
              const key = `${String(prop)}.${String(method)}`;
              if (!cache.has(key)) cache.set(key, vi.fn());
              return cache.get(key);
            },
          }
        );
      },
    }
  );
}

export const prisma = createPrismaMock();

export function resetPrismaMock() {
  cache.forEach((fn) => fn.mockReset());
  cache.clear();
}

export function getPrismaMock(model: string, method: string) {
  const key = `${model}.${method}`;
  if (!cache.has(key)) cache.set(key, vi.fn());
  return cache.get(key)!;
}
