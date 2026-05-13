import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Screen } from "@/components/Screen";
import { Button } from "@/components/Button";
import { TextField } from "@/components/TextField";
import { sendOtp, verifyOtp } from "@/api/auth";
import { useAuth } from "@/auth/AuthProvider";
import { ApiClientError } from "@/api/client";
import { colors, spacing, text } from "@/theme";

type Step = "details" | "otp";

export default function RegisterScreen() {
  const { register } = useAuth();
  const [step, setStep] = useState<Step>("details");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function startOtp() {
    setError(null);
    if (!name.trim() || !email.trim() || password.length < 12) {
      setError("Name, email, and a 12+ character password are required.");
      return;
    }
    setBusy(true);
    try {
      await sendOtp(email.trim());
      setStep("otp");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to send verification code.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyAndCreate() {
    setError(null);
    setBusy(true);
    try {
      await verifyOtp(email.trim(), code.trim());
      await register({
        email: email.trim(),
        name: name.trim(),
        password,
        phone: phone.trim() || undefined,
        city: city.trim() || undefined,
      });
      router.replace("/(tabs)");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Registration failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={[text.h1, styles.title]}>Create your account</Text>
          {step === "details" ? (
            <View style={styles.form}>
              <TextField label="Full name" value={name} onChangeText={setName} autoCapitalize="words" />
              <TextField
                label="Email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                textContentType="emailAddress"
              />
              <TextField label="Phone (optional)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
              <TextField label="City (optional)" value={city} onChangeText={setCity} autoCapitalize="words" />
              <TextField
                label="Password (12+ characters)"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                textContentType="newPassword"
              />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <Button label="Send verification code" onPress={startOtp} loading={busy} />
            </View>
          ) : (
            <View style={styles.form}>
              <Text style={styles.helper}>
                Enter the 6-digit code sent to <Text style={styles.helperStrong}>{email}</Text>.
              </Text>
              <TextField
                label="Verification code"
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                maxLength={6}
              />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <Button label="Verify & create account" onPress={verifyAndCreate} loading={busy} />
              <Button
                label="Use a different email"
                variant="ghost"
                onPress={() => setStep("details")}
              />
            </View>
          )}
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
  helperStrong: { color: colors.textPrimary, fontWeight: "600" },
});
