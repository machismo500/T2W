import { Image } from "expo-image";
import type { QueryClient } from "@tanstack/react-query";
import { fetchMe } from "@/api/auth";
import { listRides } from "@/api/rides";
import { listGuidelines, leaderboard } from "@/api/misc";
import { apiFetch } from "@/api/client";

/**
 * Pull down the rider's essentials so the cache has real data for an
 * offline cold-launch. Runs once per session — TanStack Query then keeps
 * everything fresh on focus.
 *
 * Image prefetch is fire-and-forget; failures are silent. The disk cache
 * is what we actually want populated.
 */
export async function prefetchEssentials(queryClient: QueryClient): Promise<void> {
  await Promise.allSettled([
    queryClient.prefetchQuery({ queryKey: ["me"], queryFn: fetchMe }),
    queryClient.prefetchQuery({
      queryKey: ["rides", "upcoming", "home"],
      queryFn: () => listRides({ status: "upcoming", limit: 5 }),
    }),
    queryClient.prefetchInfiniteQuery({
      queryKey: ["rides", "upcoming"],
      queryFn: () => listRides({ status: "upcoming", limit: 20 }),
      initialPageParam: undefined,
    }),
    queryClient.prefetchQuery({
      queryKey: ["leaderboard", "all"],
      queryFn: () => leaderboard("all"),
    }),
    queryClient.prefetchQuery({ queryKey: ["guidelines"], queryFn: listGuidelines }),
    queryClient.prefetchQuery({
      queryKey: ["notifications"],
      queryFn: () => apiFetch("/api/v1/notifications"),
    }),
  ]);

  // After the rides query lands in cache, prefetch poster images for any
  // upcoming ride. We cap at the first 5 to avoid hammering the network on
  // initial sign-in.
  const upcomingHome = queryClient.getQueryData<{
    items: Array<{ posterUrl: string | null }>;
  }>(["rides", "upcoming", "home"]);

  const urls = (upcomingHome?.items ?? [])
    .map((r) => r.posterUrl)
    .filter((u): u is string => Boolean(u))
    .slice(0, 5);

  void Image.prefetch(urls);
}
