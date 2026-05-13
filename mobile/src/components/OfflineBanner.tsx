import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { WifiOff } from "lucide-react-native";
import { useIsOffline } from "@/lib/network";
import { useOutbox } from "@/outbox/useOutbox";
import { colors, spacing } from "@/theme";

/**
 * Global thin banner that surfaces network state above every screen.
 *
 * Two states:
 *   - Offline: "No connection. Changes will sync when you're back online."
 *   - Pending sync: online but the outbox has unsynced writes (flusher will
 *     pick them up momentarily). Useful confirmation while a registration is
 *     being submitted.
 */
export function OfflineBanner() {
  const offline = useIsOffline();
  const { pendingCount } = useOutbox();

  if (!offline && pendingCount === 0) return null;

  return (
    <View style={[styles.bar, offline ? styles.bgOffline : styles.bgSyncing]}>
      <WifiOff color="#fff" size={14} />
      <Text style={styles.text}>
        {offline
          ? pendingCount > 0
            ? `Offline · ${pendingCount} pending change${pendingCount === 1 ? "" : "s"} will sync when online`
            : "No connection — viewing cached data"
          : `Syncing ${pendingCount} pending change${pendingCount === 1 ? "" : "s"}…`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  bgOffline: { backgroundColor: colors.warning },
  bgSyncing: { backgroundColor: colors.primaryDim },
  text: { color: "#fff", fontSize: 12, fontWeight: "600", flex: 1 },
});
