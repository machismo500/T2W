# Sideloading T2W to your iPhone (free Apple ID)

This is the fastest path to get the app on **your** iPhone for personal use,
without paying for an Apple Developer account. The trade-off: the build
expires after 7 days, you need to re-run the install from Xcode weekly, and
some features that need paid Apple Dev are disabled (see [Limitations](#limitations)).

If you want to distribute to other riders, see `docs/sideload-and-offline-plan.md` §5 for the TestFlight / EAS path instead.

## Requirements

- A Mac running macOS 14+ (Sonoma) or 15+ (Sequoia)
- Xcode 16+ from the App Store
- Xcode Command Line Tools: `xcode-select --install`
- Node.js 22+ and npm
- A free Apple ID signed into Xcode (`Xcode → Settings → Accounts`)
- Your iPhone, unlocked, with the cable / USB-C connection

## One-time setup

```bash
git clone <this repo>
cd T2W/mobile

# Install dependencies (the root T2W npm install does NOT cover mobile/)
npm install

# Make sure Expo / RN versions are aligned
npx expo install --check

# Generate the icon / splash assets from the canonical logo
npm run assets

# Write the local env file for personal builds
cat > .env <<EOF
EXPO_PUBLIC_API_BASE_URL=https://taleson2wheels.com
EXPO_PUBLIC_BUILD_VARIANT=personal
EXPO_PUBLIC_PERSONAL_BUNDLE_ID=com.<yourgithub>.t2w
EOF
```

> **Bundle ID tip.** Use a unique reverse-DNS that you control, e.g.
> `com.machismo500.t2w` or `dev.<yourname>.t2w`. Apple registers the bundle
> id against your Apple ID the first time you install; using `com.taleson2wheels.app`
> would collide if the production app is already registered.

## Build & install

```bash
# From mobile/
npm run prebuild:sideload    # generates ios/ project with personal variant
npm run ios:sideload         # builds and runs on the connected device
```

If `expo run:ios --device` doesn't auto-detect your phone:

```bash
open ios/T2W.xcworkspace
```

Then in Xcode:

1. Select the **T2W** target in the sidebar.
2. **Signing & Capabilities** tab → set **Team** to your personal Apple ID.
3. **Bundle Identifier** should already match what you set in `.env`. If
   Xcode shows a signing error, change the bundle id to anything that
   includes your Apple ID's email prefix, e.g. `com.yourname.t2w`.
4. Toggle **Automatically manage signing** if it isn't already on.
5. Top toolbar → choose your iPhone (not a simulator).
6. **Product → Run** (⌘R).

The first build takes ~5–10 minutes. After that, JS-only changes hot-reload
without rebuilding.

## Trusting the developer on the phone

After the first install, the app icon appears but tapping it shows an
"Untrusted Developer" message. To fix:

1. iPhone → **Settings → General → VPN & Device Management**
2. Under **Developer App**, tap your Apple ID email.
3. **Trust "<your Apple ID>"** → confirm.
4. Open the app from the home screen.

## Background-location permission

T2W asks for **Always Allow** location only when you start a live ride.
Grant it from the system prompt, or after the fact:

- **Settings → T2W → Location → Always**
- Toggle **Precise Location** on (the route gets jaggy without it).
- **Settings → T2W → Background App Refresh → on**.

On Indian carrier networks, also disable **Low Data Mode** for your SIM
during multi-day rides, otherwise iOS aggressively delays the breadcrumb
flushes.

## After the first install — weekly maintenance

Free certs expire 7 days after the install. When the app fails to launch:

```bash
cd mobile
npm run ios:sideload
```

That's it — Xcode re-signs and overwrites the existing install. No data is
lost; AsyncStorage + Keychain survive the reinstall.

## Verifying the build

Open the app → **Profile** tab. The header should show:

- Your name
- Email
- A small "Sideload" pill next to the role badge (added in `(tabs)/profile.tsx`)
- "Approved" or "Pending approval" depending on the backend state

If the "Sideload" pill is missing, the variant didn't get picked up — check
that `EXPO_PUBLIC_BUILD_VARIANT=personal` is actually exported in the shell
that ran `prebuild`.

## Limitations

These features are intentionally disabled on personal builds:

| Feature | Reason | What you'll see |
|---|---|---|
| Remote push notifications | APNs entitlement requires paid Apple Dev | No banners arrive when admins approve registrations; you'll see them in the in-app notification feed next time you open the app |
| Universal Links (`taleson2wheels.com/ride/...` → app) | Needs Apple Team ID for the `apple-app-site-association` file | The `t2w://` deep-link scheme still works inside the app from push tap payloads (which don't arrive — see above) |
| App Store submission | This is a development install, not a distribution build | N/A — you wouldn't be using sideload if you were going to ship |

Everything else — live GPS tracking, background location, sharing, registrations, admin moderation — works identically to production.

## Troubleshooting

- **"Failed to create provisioning profile"** — your Apple ID hasn't accepted the developer terms. Open Xcode → Settings → Accounts → Manage Certificates → ensure your Apple ID has at least one personal team. If not, log in once to https://developer.apple.com with the Apple ID and accept the terms.
- **"Bundle id is already in use"** — change `EXPO_PUBLIC_PERSONAL_BUNDLE_ID` in `.env` to something unique and re-run `npm run prebuild:sideload`.
- **App launches but everything is grey** — likely a metro bundler error. Run `npx expo start --dev-client` in one terminal and rerun the Xcode build.
- **Location tracking stops when screen sleeps** — Settings → T2W → Location must be **Always**, not **While Using**. iOS quietly downgrades the permission if you tap "Allow Once" during the first prompt.
- **App quits after 7 days** — that's the free-cert expiry. Re-run `npm run ios:sideload` to re-sign.

## Where to go next

- `docs/sideload-and-offline-plan.md` — the full plan for offline-first hardening and the eventual move to TestFlight.
- `mobile/.maestro/README.md` — running the smoke flows against your sideloaded build.
