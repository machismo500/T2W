import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import * as Sentry from "@sentry/react-native";
import { captureException } from "@/sentry";
import { colors, radius, spacing, text } from "@/theme";

type Props = { children: React.ReactNode };
type State = { error: Error | null };

/**
 * Renders a friendly fallback screen when a route's render throws, and
 * forwards the error to Sentry with breadcrumb context. Use sparingly —
 * usually only at the root of each top-level screen tree.
 */
export class RouteErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    captureException(error, { extra: { componentStack: info.componentStack } });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <View style={styles.wrap}>
        <Text style={[text.h2, styles.title]}>Something went wrong</Text>
        <Text style={styles.body}>
          We've sent a report. Try going back, or restart the app if it keeps happening.
        </Text>
        <Text style={styles.errText} numberOfLines={3}>
          {this.state.error.message}
        </Text>
        <Pressable
          onPress={() => this.setState({ error: null })}
          style={styles.btn}
          accessibilityLabel="Try again"
        >
          <Text style={styles.btnText}>Try again</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },
  title: { color: colors.danger, textAlign: "center" },
  body: { color: colors.textSecondary, textAlign: "center", fontSize: 15 },
  errText: {
    color: colors.textMuted,
    fontSize: 12,
    fontFamily: "monospace",
    textAlign: "center",
    marginTop: spacing.sm,
  },
  btn: {
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  btnText: { color: "#fff", fontWeight: "600", fontSize: 15 },
});
