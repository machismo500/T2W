import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { Link } from "expo-router";
import { Screen } from "@/components/Screen";
import { Button } from "@/components/Button";
import { TextField } from "@/components/TextField";
import { useAuth } from "@/auth/AuthProvider";
import { ApiClientError } from "@/api/client";
import { colors, spacing, text } from "@/theme";

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : "Login failed. Please try again.";
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={[text.h1, styles.title]}>Tales on 2 Wheels</Text>
          <Text style={styles.subtitle}>Sign in to ride with the brotherhood.</Text>

          <View style={styles.form}>
            <TextField
              label="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoComplete="email"
              textContentType="emailAddress"
            />
            <TextField
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="current-password"
              textContentType="password"
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button label="Sign in" onPress={submit} loading={busy} />
          </View>

          <View style={styles.links}>
            <Link href="/(auth)/forgot-password" style={styles.link}>Forgot password?</Link>
            <Link href="/(auth)/register" style={styles.link}>Create an account</Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.lg, paddingTop: spacing.xxl, gap: spacing.lg },
  title: { textAlign: "center" },
  subtitle: { color: colors.textSecondary, textAlign: "center", marginBottom: spacing.lg },
  form: { gap: spacing.sm },
  error: { color: colors.danger, marginBottom: spacing.sm },
  links: { gap: spacing.md, alignItems: "center", marginTop: spacing.md },
  link: { color: colors.primary, fontSize: 15 },
});
