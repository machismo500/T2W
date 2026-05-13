import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Screen } from "@/components/Screen";
import { Button } from "@/components/Button";
import { TextField } from "@/components/TextField";
import { resetPassword, sendResetOtp, verifyResetOtp } from "@/api/auth";
import { ApiClientError } from "@/api/client";
import { colors, spacing, text } from "@/theme";

type Step = "email" | "otp" | "password" | "done";

export default function ForgotPasswordScreen() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function send() {
    setError(null);
    setBusy(true);
    try {
      await sendResetOtp(email.trim());
      setStep("otp");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to send reset code.");
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setError(null);
    setBusy(true);
    try {
      await verifyResetOtp(email.trim(), code.trim());
      setStep("password");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Invalid or expired code.");
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    setError(null);
    if (newPassword.length < 12) {
      setError("Password must be at least 12 characters.");
      return;
    }
    setBusy(true);
    try {
      await resetPassword(email.trim(), newPassword);
      setStep("done");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to reset password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={[text.h1, styles.title]}>Reset password</Text>
          <View style={styles.form}>
            {step === "email" && (
              <>
                <TextField
                  label="Email"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  textContentType="emailAddress"
                />
                {error ? <Text style={styles.error}>{error}</Text> : null}
                <Button label="Send reset code" onPress={send} loading={busy} />
              </>
            )}
            {step === "otp" && (
              <>
                <Text style={styles.helper}>Enter the 6-digit code sent to {email}.</Text>
                <TextField
                  label="Reset code"
                  value={code}
                  onChangeText={setCode}
                  keyboardType="number-pad"
                  textContentType="oneTimeCode"
                  maxLength={6}
                />
                {error ? <Text style={styles.error}>{error}</Text> : null}
                <Button label="Verify" onPress={verify} loading={busy} />
              </>
            )}
            {step === "password" && (
              <>
                <TextField
                  label="New password (12+ characters)"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry
                  textContentType="newPassword"
                />
                {error ? <Text style={styles.error}>{error}</Text> : null}
                <Button label="Set new password" onPress={reset} loading={busy} />
              </>
            )}
            {step === "done" && (
              <>
                <Text style={styles.helper}>
                  Password updated. Sign in with your new password.
                </Text>
                <Button label="Back to sign in" onPress={() => router.replace("/(auth)/login")} />
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.lg, paddingTop: spacing.xxl, gap: spacing.lg },
  title: { textAlign: "center", marginBottom: spacing.md },
  form: { gap: spacing.sm },
  error: { color: colors.danger, marginBottom: spacing.sm },
  helper: { color: colors.textSecondary },
});
