import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { colors, radius, spacing } from "@/theme";

/**
 * Animated shimmer placeholder that matches the RideCard dimensions.
 * Used in lists while a query is loading without cached data.
 */
export function RideCardSkeleton() {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.8, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View style={[styles.card, { opacity }]} accessibilityRole="progressbar">
      <View style={styles.poster} />
      <View style={styles.body}>
        <View style={[styles.bar, { width: "30%" }]} />
        <View style={[styles.bar, { width: "85%", height: 22 }]} />
        <View style={[styles.bar, { width: "60%" }]} />
        <View style={[styles.bar, { width: "75%" }]} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
    overflow: "hidden",
  },
  poster: { width: "100%", height: 160, backgroundColor: colors.card },
  body: { padding: spacing.md, gap: spacing.sm },
  bar: { height: 12, borderRadius: 6, backgroundColor: colors.card },
});
