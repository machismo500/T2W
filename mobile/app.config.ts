import type { ExpoConfig, ConfigContext } from "expo/config";
import base from "./app.json";

/**
 * Per-build overrides on top of the committed app.json.
 *
 * Why this exists: when sideloading with a free Apple ID via Xcode, the
 * default bundle id (com.taleson2wheels.app) may collide with what's already
 * registered on Apple's servers. Set EXPO_PUBLIC_BUILD_VARIANT=personal in
 * your local .env (which is gitignored) to swap in a unique bundle id.
 *
 * Variants:
 *   - production  (default — uses app.json values, paid Apple Dev path)
 *   - personal    (free Apple ID + Xcode, no remote push, no universal links)
 *   - staging     (EAS preview channel, same backend posture as production)
 */
type BuildVariant = "production" | "personal" | "staging";

function getVariant(): BuildVariant {
  const v = process.env.EXPO_PUBLIC_BUILD_VARIANT;
  if (v === "personal" || v === "staging") return v;
  return "production";
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const expo = base.expo as unknown as ExpoConfig;
  const variant = getVariant();

  const isPersonal = variant === "personal";

  const bundleId = isPersonal
    ? process.env.EXPO_PUBLIC_PERSONAL_BUNDLE_ID ?? "com.t2w.sideload"
    : expo.ios?.bundleIdentifier;

  const androidPackage = isPersonal
    ? process.env.EXPO_PUBLIC_PERSONAL_BUNDLE_ID ?? "com.t2w.sideload"
    : expo.android?.package;

  // Sideload builds skip the associatedDomains entry — universal links need
  // an Apple Team ID that free Apple IDs don't have. The deep-link scheme
  // (t2w://) still works for push tap routing inside the app.
  const ios: ExpoConfig["ios"] = {
    ...expo.ios,
    bundleIdentifier: bundleId,
    associatedDomains: isPersonal ? undefined : expo.ios?.associatedDomains,
  };

  // Strip the Android universal-link intent filter for the same reason —
  // it requires `autoVerify=true` which fails without a valid assetlinks.json
  // served from the production domain.
  const android: ExpoConfig["android"] = {
    ...expo.android,
    package: androidPackage,
    intentFilters: isPersonal ? undefined : expo.android?.intentFilters,
  };

  return {
    ...expo,
    ...config,
    name: isPersonal ? `${expo.name} (Sideload)` : expo.name,
    ios,
    android,
    extra: {
      ...(expo.extra ?? {}),
      buildVariant: variant,
    },
  };
};
