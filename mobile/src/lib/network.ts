import { useNetInfo, type NetInfoState } from "@react-native-community/netinfo";

/**
 * Single source of truth for "do we have a working internet connection".
 *
 * We pessimistically treat `isInternetReachable === null` (still measuring)
 * as connected — better to attempt the request and let it fail than to gate
 * everything on a measurement that may never resolve on flaky carrier links.
 *
 * Use this only for **UX hints** (banners, disabled buttons). Actual
 * mutations should still hit the API client and let the outbox / retry
 * machinery handle real network errors when they happen.
 */
export function useIsOffline(): boolean {
  const net = useNetInfo();
  return isOfflineFromState(net);
}

export function isOfflineFromState(net: Pick<NetInfoState, "isConnected" | "isInternetReachable">): boolean {
  if (net.isConnected === false) return true;
  // null on iOS = still measuring. Default to "online".
  return net.isInternetReachable === false;
}
