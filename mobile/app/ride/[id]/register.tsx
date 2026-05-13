import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, router, Stack } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import QRCode from "react-native-qrcode-svg";
import { Screen } from "@/components/Screen";
import { TextField } from "@/components/TextField";
import { Button } from "@/components/Button";
import { getRide } from "@/api/rides";
import { apiFetch, ApiClientError } from "@/api/client";
import { uploadImage } from "@/api/upload";
import { useAuth } from "@/auth/AuthProvider";
import { useOutbox } from "@/outbox/useOutbox";
import { useIsOffline } from "@/lib/network";
import { colors, radius, spacing, text } from "@/theme";

type UpiConfig = {
  upiId?: string;
  qrUrl?: string;
  payeeName?: string;
};

function useUpiConfig() {
  return useQuery({
    queryKey: ["site-settings", "upi_config"],
    queryFn: () =>
      apiFetch<{ key: string; value: UpiConfig | null }>("/api/v1/site-settings/upi_config"),
  });
}

export default function RegisterScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const auth = useAuth();
  const outbox = useOutbox();
  const offline = useIsOffline();
  const ride = useQuery({
    queryKey: ["ride", id],
    queryFn: () => getRide(id),
    enabled: typeof id === "string",
  });
  const upi = useUpiConfig();

  const [riderName, setRiderName] = useState(
    auth.status === "authed" ? auth.user.name : "",
  );
  const [phone, setPhone] = useState(auth.status === "authed" ? auth.user.phone ?? "" : "");
  const [emergencyContactName, setEmergencyContactName] = useState("");
  const [emergencyContactPhone, setEmergencyContactPhone] = useState("");
  const [bloodGroup, setBloodGroup] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehicleRegNumber, setVehicleRegNumber] = useState("");
  const [upiTransactionId, setUpiTransactionId] = useState("");
  const [paymentScreenshot, setPaymentScreenshot] = useState<string | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [agreedCancellation, setAgreedCancellation] = useState(false);
  const [agreedIndemnity, setAgreedIndemnity] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pickPaymentProof() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission required", "T2W needs access to your photos to upload payment proof.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (result.canceled || result.assets.length === 0) return;

    setUploadBusy(true);
    try {
      const compressed = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 1200 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG },
      );
      const url = await uploadImage(compressed.uri, "payment-proof", { targetId: id });
      setPaymentScreenshot(url);
    } catch (err) {
      Alert.alert("Upload failed", err instanceof Error ? err.message : "Unknown error");
    } finally {
      setUploadBusy(false);
    }
  }

  async function submit() {
    setError(null);
    if (!agreedCancellation || !agreedIndemnity) {
      setError("Please agree to the cancellation terms and the indemnity.");
      return;
    }
    setSubmitting(true);
    try {
      // Always go through the outbox — if we're online the flusher fires
      // immediately and the queue clears in milliseconds, but if we're
      // offline the registration survives until we're back on signal.
      await outbox.enqueue({
        kind: "ride.register",
        rideId: id,
        body: {
          riderName: riderName.trim() || undefined,
          phone: phone.trim() || undefined,
          emergencyContactName: emergencyContactName.trim() || undefined,
          emergencyContactPhone: emergencyContactPhone.trim() || undefined,
          bloodGroup: bloodGroup.trim() || undefined,
          vehicleModel: vehicleModel.trim() || undefined,
          vehicleRegNumber: vehicleRegNumber.trim() || undefined,
          upiTransactionId: upiTransactionId.trim() || undefined,
          paymentScreenshot: paymentScreenshot ?? undefined,
          agreedCancellationTerms: true,
          agreedIndemnity: true,
        },
      });
      Alert.alert(
        offline ? "Saved" : "Submitted",
        offline
          ? "You're offline — your registration is queued and will submit automatically when you're back online."
          : "Your registration is being submitted.",
        [{ text: "OK", onPress: () => router.replace(`/ride/${id}`) }],
      );
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to queue registration.");
    } finally {
      setSubmitting(false);
    }
  }

  if (ride.isLoading || !ride.data) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    );
  }

  const r = ride.data;

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <Stack.Screen options={{ title: `Register · #${r.rideNumber}` }} />
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={[text.h2, { marginBottom: spacing.sm }]}>{r.title}</Text>
          <Text style={text.bodySecondary}>
            {new Date(r.startDate).toLocaleDateString()} · {r.distanceKm} km · ₹{r.fee}
          </Text>

          <Text style={styles.section}>Rider details</Text>
          <TextField label="Full name" value={riderName} onChangeText={setRiderName} />
          <TextField label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          <TextField
            label="Emergency contact name"
            value={emergencyContactName}
            onChangeText={setEmergencyContactName}
          />
          <TextField
            label="Emergency contact phone"
            value={emergencyContactPhone}
            onChangeText={setEmergencyContactPhone}
            keyboardType="phone-pad"
          />
          <TextField label="Blood group" value={bloodGroup} onChangeText={setBloodGroup} />

          <Text style={styles.section}>Motorcycle</Text>
          <TextField
            label="Make and model"
            value={vehicleModel}
            onChangeText={setVehicleModel}
            placeholder="e.g. Royal Enfield Himalayan"
          />
          <TextField
            label="Registration number"
            value={vehicleRegNumber}
            onChangeText={setVehicleRegNumber}
            autoCapitalize="characters"
          />

          <Text style={styles.section}>Payment (₹{r.fee})</Text>
          {upi.data?.value?.upiId ? (
            <View style={styles.upiBox}>
              <Text style={styles.upiLabel}>Pay to</Text>
              <Text style={styles.upiId}>{upi.data.value.upiId}</Text>
              {upi.data.value.payeeName ? (
                <Text style={styles.upiPayee}>{upi.data.value.payeeName}</Text>
              ) : null}
              <View style={styles.qrWrap}>
                <QRCode
                  value={`upi://pay?pa=${encodeURIComponent(upi.data.value.upiId)}&pn=${encodeURIComponent(upi.data.value.payeeName ?? "T2W")}&am=${r.fee}&cu=INR`}
                  size={160}
                  backgroundColor="#ffffff"
                  color="#000000"
                />
              </View>
              <Text style={[text.caption, { marginTop: spacing.sm, textAlign: "center" }]}>
                Scan with any UPI app to pay ₹{r.fee}
              </Text>
            </View>
          ) : (
            <Text style={text.bodySecondary}>
              UPI details not configured yet. Please contact a T2W admin for payment instructions.
            </Text>
          )}

          <TextField
            label="UPI transaction reference (UTR)"
            value={upiTransactionId}
            onChangeText={setUpiTransactionId}
            autoCapitalize="characters"
          />

          <Pressable onPress={pickPaymentProof} style={styles.uploadBox}>
            {paymentScreenshot ? (
              <Image source={{ uri: paymentScreenshot }} style={styles.uploadPreview} />
            ) : (
              <View style={styles.uploadPlaceholder}>
                {uploadBusy ? (
                  <ActivityIndicator color={colors.primary} />
                ) : (
                  <>
                    <Text style={styles.uploadCta}>Upload payment screenshot</Text>
                    <Text style={text.caption}>Tap to choose from photos</Text>
                  </>
                )}
              </View>
            )}
          </Pressable>

          <Text style={styles.section}>Agreements</Text>
          <Toggle
            label="I agree to the cancellation terms"
            value={agreedCancellation}
            onChange={setAgreedCancellation}
          />
          <Toggle
            label="I agree to the indemnity"
            value={agreedIndemnity}
            onChange={setAgreedIndemnity}
          />

          {error ? (
            <Text style={[styles.error, { marginTop: spacing.md }]}>{error}</Text>
          ) : null}

          <Button
            label={submitting ? "Submitting…" : "Submit registration"}
            onPress={submit}
            loading={submitting}
            style={{ marginTop: spacing.lg }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <Text style={[text.body, { flex: 1 }]}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.border, true: colors.primary }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.lg, paddingBottom: spacing.xl, gap: spacing.xs },
  section: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  upiBox: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    alignItems: "center",
    marginBottom: spacing.md,
  },
  upiLabel: { color: colors.textSecondary, fontSize: 12, textTransform: "uppercase" },
  upiId: { color: colors.primary, fontSize: 18, fontWeight: "700", marginTop: spacing.xs },
  upiPayee: { color: colors.textSecondary, fontSize: 13 },
  qrWrap: {
    marginTop: spacing.md,
    padding: spacing.sm,
    backgroundColor: "#fff",
    borderRadius: radius.md,
  },
  uploadBox: {
    marginTop: spacing.sm,
    height: 180,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  uploadPreview: { width: "100%", height: "100%" },
  uploadPlaceholder: { alignItems: "center", padding: spacing.md },
  uploadCta: { color: colors.primary, fontSize: 15, fontWeight: "600", marginBottom: spacing.xs },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  error: { color: colors.danger },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
});
