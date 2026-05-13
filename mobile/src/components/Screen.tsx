import React from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@/theme";

export function Screen({ children, edges }: { children: React.ReactNode; edges?: ("top" | "bottom" | "left" | "right")[] }) {
  return (
    <SafeAreaView style={styles.safe} edges={edges ?? ["top", "left", "right"]}>
      <View style={styles.body}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  body: { flex: 1, backgroundColor: colors.bg },
});
