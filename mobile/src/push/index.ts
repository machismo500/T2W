import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { router } from "expo-router";
import { apiFetch } from "@/api/client";
import { deviceStorage } from "@/api/storage";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Route a push payload (or cold-start `data`) to the right screen. Called
 * from the notification-tap subscription and also when the app launches
 * from a killed state via `getLastNotificationResponseAsync`.
 */
export function routeFromPushData(data: unknown) {
  if (!data || typeof data !== "object") return;
  const d = data as Record<string, unknown>;
  const kind = d.kind;
  if (kind === "ride" && typeof d.rideId === "string") {
    router.push(`/ride/${d.rideId}`);
  } else if (kind === "blog" && typeof d.blogId === "string") {
    router.push(`/blog/${d.blogId}`);
  } else if (kind === "account_approved") {
    router.push("/(tabs)");
  }
}

let tapSubscription: Notifications.Subscription | null = null;

/**
 * Wire up the global notification-tap handler. Returns a cleanup that
 * AuthProvider can call on sign-out — though leaving it attached is also
 * fine since unauth users won't receive pushes.
 */
export function installNotificationHandlers(): () => void {
  if (tapSubscription) {
    return () => {
      tapSubscription?.remove();
      tapSubscription = null;
    };
  }
  tapSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
    routeFromPushData(response.notification.request.content.data);
  });
  // Cold-start: if the app was launched by tapping a push, route once on mount.
  Notifications.getLastNotificationResponseAsync().then((response) => {
    if (response) routeFromPushData(response.notification.request.content.data);
  });
  return () => {
    tapSubscription?.remove();
    tapSubscription = null;
  };
}

/**
 * Ask for push permission, obtain an Expo push token, and register it with
 * the backend so server-side dispatch can find this device.
 *
 * Returns the Expo push token, or null if the user declined / we're on a
 * simulator that can't receive pushes.
 */
export async function registerForPushAsync(): Promise<string | null> {
  if (!Device.isDevice) {
    // Push doesn't work on iOS simulator / Android emulator with most setups.
    return null;
  }

  const settings = await Notifications.getPermissionsAsync();
  let status = settings.status;
  if (status !== "granted") {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }
  if (status !== "granted") {
    return null;
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#ff4757",
    });
  }

  const projectId =
    (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ??
    Constants.easConfig?.projectId;
  if (!projectId) {
    console.warn("[T2W][push] No EAS projectId in app config; skipping token request.");
    return null;
  }

  let pushToken: string;
  try {
    const t = await Notifications.getExpoPushTokenAsync({ projectId });
    pushToken = t.data;
  } catch (err) {
    console.warn("[T2W][push] Failed to obtain push token:", err);
    return null;
  }

  const deviceId = await deviceStorage.getDeviceId();
  if (!deviceId) {
    // AuthProvider always sets this on first login; if it's missing here we
    // haven't logged in yet — skip silently, this will be retried on next
    // app launch once we have a session.
    return pushToken;
  }

  try {
    await apiFetch<{ id: string }>("/api/v1/devices", {
      method: "POST",
      body: {
        token: pushToken,
        platform: Platform.OS === "ios" ? "ios" : "android",
        deviceId,
        appBuild: Constants.expoConfig?.version ?? null,
      },
    });
  } catch (err) {
    console.warn("[T2W][push] Failed to register device with backend:", err);
  }

  return pushToken;
}

export async function unregisterDevice(): Promise<void> {
  const deviceId = await deviceStorage.getDeviceId();
  if (!deviceId) return;
  try {
    await apiFetch<{ success: true }>(`/api/v1/devices`, {
      method: "DELETE",
      query: { deviceId },
    });
  } catch {
    // Best-effort.
  }
}
