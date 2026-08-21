# MIEWeb Auth — Handover

Everything needed to pick up the `mieauth.mieweb.org` instance and its mobile
apps. Written 2026-08-20.

Companion doc: [MIEAUTH_INSTANCE.md](MIEAUTH_INSTANCE.md) (setup/ops runbook).

---

## 1. What this is

A **second, independent deployment** of the MIEAuth codebase for MIE-internal
use. It is _not_ a migration of the opensource app — separate server, separate
database, separate user base, separate app identity.

|             | Opensource app                                       | MIEWeb Auth (this)                    |
| ----------- | ---------------------------------------------------- | ------------------------------------- |
| URL         | `mieauth-prod.os.mieweb.org`                         | `mieauth.mieweb.org`                  |
| Dev URL     | `mieauth-dev.os.mieweb.org`                          | —                                     |
| Host        | Proxmox container (SSH deploy)                       | `mie-fwdc-auth1` (self-hosted runner) |
| Workflow    | `release.yml` (targets `mie-os-prod` / `mie-os-dev`) | `release.yml` (target `mie`)          |
| Release tag | `mie-os-prod-v*` / `mie-os-dev-v*`                   | `mie-v*`                              |
| Android ID  | `com.mieweb.mieauth`                                 | `org.mieweb.auth`                     |
| iOS ID      | `org.mieweb.opensource`                              | `org.mieweb.auth`                     |
| App name    | MIEAuth                                              | MIEWeb Auth                           |
| URL scheme  | `mieauth://`                                         | `miewebauth://`                       |
| Database    | `mieweb_auth` (standalone)                           | `mieauth` (replica set, auth)         |
| LDAP        | `cluster.mieweb.org`                                 | `ldap.med-web.com`                    |
| Firebase    | `mieweb-auth-dev`                                    | `mieweb-auth`                         |

**The opensource app and its pipelines were deliberately left untouched.**

---

## 2. Status

| Area                                 | State                                       |
| ------------------------------------ | ------------------------------------------- |
| Server deployed + live               | ✅ `https://mieauth.mieweb.org` returns 200 |
| systemd service                      | ✅ `mieauth.service`, auto-restart, enabled |
| CI server deploy                     | ✅ self-hosted runner, no SSH keys          |
| MongoDB                              | ✅ replica set `mieauth-rs`, authenticated  |
| Admin LDAP login                     | ✅ working (`/admin`)                       |
| Push notifications (iOS device)      | ✅ verified end to end                      |
| Push (Android emulator)              | ⚠️ needs a Google Play system image         |
| Android keystore + first Play upload | ✅ done manually                            |
| Mobile CI (`mieweb/actions`)         | ⏳ written, never run                       |
| iOS distribution cert + profile      | ❌ not created                              |
| Play Store listing                   | ⚠️ rejected — privacy policy (see §7)       |

---

## 3. The server — `mie-fwdc-auth1`

SSH: `ssh aabrol@mie-fwdc-auth1.med-web.com` (password + YubiKey, port 22).

| Fact                      | Value                                                       |
| ------------------------- | ----------------------------------------------------------- |
| OS                        | Debian 12 (LXC container), 4 CPU / 4 GB RAM + 4 GB swap     |
| Sudo user                 | `aabrol` (uid 7548, group `mieremote`), passwordless sudo   |
| **Service + runner user** | **`actions`** — owns `/home/actions/{Builds,scripts,certs}` |
| Runner                    | `actions.runner.mieweb-mieweb_auth_app.mie-fwdc-auth1`      |
| Ingress                   | cloudflared tunnel (no nginx, no certbot)                   |
| Node / Meteor             | 20.19.6 via nvm, Meteor 3.5 — installed for `actions`       |

### Key paths

```
/home/actions/scripts/set-env.sh     environment (mode 600) — NOT in git
/home/actions/scripts/start-mieauth.sh
/home/actions/certs/med-web-ca.crt   internal CA for LDAPS
/home/actions/Builds/current         symlink → active build
/etc/systemd/system/mieauth.service
/etc/sudoers.d/mieauth               passwordless systemctl for `actions`
```

### Operating it

```bash
sudo systemctl status mieauth
sudo journalctl -u mieauth -f
sudo systemctl restart mieauth
```

### Ingress

The tunnel is **dashboard-managed** (`cloudflared tunnel run --token-file
/etc/cloudflared/token`) — there is **no `config.yml` on the box**. Routing lives
in Cloudflare Zero Trust → Networks → Tunnels → Public Hostname:

> `mieauth.mieweb.org` → HTTP → `localhost:3000`

A **502** from the site means nothing is listening on :3000, not a tunnel fault.

---

## 4. Configuration

`/home/actions/scripts/set-env.sh` is the single source of runtime config. The
repo's `set-env.sh` is a gitignored template with the same shape.

| Variable                        | Note                                                                                                     |
| ------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `ROOT_URL` / `APP_URL`          | `https://mieauth.mieweb.org`                                                                             |
| `PORT`                          | 3000 (must match the tunnel)                                                                             |
| `MONGO_URL`                     | `mongodb://mieauth:<pw>@mie-fwdc-auth1.med-web.com:27017/mieauth?replicaSet=mieauth-rs&authSource=admin` |
| `MONGO_OPLOG_URL`               | same host, `/local` db — enables oplog tailing                                                           |
| `MAIL_URL`                      | `smtp://smtp-lb.med-web.com:25`                                                                          |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | project **`mieweb-auth`**                                                                                |
| `NODE_EXTRA_CA_CERTS`           | `/home/actions/certs/med-web-ca.crt` — required, see §8                                                  |
| `LDAP_*`                        | see below                                                                                                |

### LDAP (admin panel only)

```
LDAP_URL              ldaps://ldap.med-web.com:636
LDAP_BASE_DN          dc=med-web,dc=com
LDAP_USER_BASE_DN     ou=people,dc=med-web,dc=com
LDAP_USER_RDN_ATTR    uid
LDAP_BIND_DN          uid=proxyuser,dc=med-web,dc=com     (no ou=people — correct)
LDAP_BIND_PASSWORD    from /etc/sssd/sssd.conf on the server
LDAP_ADMIN_GROUP_DN   cn=mie,ou=secgroup,dc=med-web,dc=com
LDAP_GROUP_MEMBER_ATTR uniqueMember
LDAP_REJECT_UNAUTHORIZED true
```

- The **service bind is mandatory** — anonymous reads of the admin group return
  `50 Insufficient access`.
- Admins log in with their **SSO / Active Directory** password, and must be a
  member of `cn=mie,ou=secgroup`.
- The app checks group membership _before_ binding as the user (deliberate — so
  a non-admin never triggers a push).
- Diagnose with `bash scripts/diagnose-ldap-login.sh <username>` on the server; it
  isolates TLS, service bind, user bind, and membership separately.

---

## 5. Mobile

### Identity

Applied at build time by
[`scripts/apply-variant.sh mie`](../scripts/apply-variant.sh), which reads
[`variants/mie.env`](../variants/mie.env):

| Field             | Value                                                    |
| ----------------- | -------------------------------------------------------- |
| Bundle/package ID | `org.mieweb.auth` (both platforms)                       |
| Display name      | MIEWeb Auth                                              |
| URL scheme        | `miewebauth` (must differ from the opensource `mieauth`) |
| Server            | `https://mieauth.mieweb.org`                             |

`mobile-config.js`, `public/resources/`, and `public/logo.png` in git stay
**opensource**. The prebuild rewrites them; the local build script restores them
on exit via a `trap`. Never commit those files from an MIE build.

### Branding

Only `branding/mieauth/logo.png` is committed. Icons and splash screens are
generated at build time into `branding/mieauth/resources/` (gitignored). To
change the logo: replace `logo.png`, delete `resources/`, rebuild.

### Firebase — project `mieweb-auth`

- `private/android/google-services.json` and
  `private/ios/GoogleService-Info.plist` (both gitignored) — the Cordova build
  requires **both** files even for a single-platform build.
- APNs auth key (`.p8`, Sandbox **and** Production) uploaded in Firebase →
  Cloud Messaging → iOS app, with the correct Key ID and Team ID.
- The server's `FIREBASE_SERVICE_ACCOUNT_JSON` must be from the **same project**
  as those two files.

### Android signing

- Keystore `miewebauth-release.jks`, alias `miewebauth` — **new, separate from
  the opensource keystore**. Held by @aabrol; must be backed up to a vault.
  Losing it means `org.mieweb.auth` can never be updated on Play again.
- First AAB was signed and uploaded to the Play internal track **manually**
  (Play requires this before the API will accept automated uploads).

### Local build

```bash
bash scripts/build-mobile-local.sh mie            # both platforms
bash scripts/build-mobile-local.sh mie ios
bash scripts/sign-android-release.sh              # signs the AAB/APK
```

Output in `mie-build/`. Open `mie-build/ios/project/*.xcworkspace` in Xcode or
`mie-build/android/project` in Android Studio.

---

## 6. CI

### `release.yml` — the unified pipeline

One workflow serves every target. It resolves the release tag (or a
`workflow_dispatch` input) into a target through
[`scripts/resolve-release-target.sh`](../scripts/resolve-release-target.sh) and
reads every parameter from `variants/<target>.env`. See the Releasing section of
the README for the tag table and the manual re-run recipes.

- **Triggers:** `mie-os-dev-v*`, `mie-os-prod-v*`, `mie-v*` release tags, or
  manual dispatch. The retired `v*` / `dev-v*` tags fail loudly rather than
  being silently skipped.
- **Dispatch inputs:** `target`, `deploy_server`, `include_mobile`, `platforms`,
  `publish` — so the server can be deployed without touching the app stores, or
  a store build can be dry-run with `publish: false`.
- **Server job:** one job keyed on the variant's `DEPLOY_MODE`. `ssh` for the
  opensource containers; `self-hosted` for `mie`, which builds locally on
  `mie-fwdc-auth1` with `TOOL_NODE_FLAGS=--max-old-space-size=3072` (4 GB box).
- **Mobile job:** composes the individual `mieweb/actions` steps
  (`prepare-*-env` → `apply-variant.sh` → `write-firebase-config.sh` →
  `run-meteor-build` → sign/publish), pinned to an exact tag rather than the
  moving `@v2`. It composes rather than calling the reusable
  `build-mobile-from-meteor.yml` because that workflow has no channel for
  `GoogleService-Info.plist`, and Meteor evaluates `mobile-config.js` on every
  Cordova build — so an Android build fails on a missing iOS plist too.

**Secrets are mapped explicitly, NOT `secrets: inherit`.** The conventional
names (`ANDROID_KEYSTORE_BASE64`, `APPLE_TEAM_ID`, …) belong at repo level to the
**opensource** app. Inheriting would sign MIEWeb Auth with the wrong keystore and
certificate. `release.yml` selects per target with a ternary: `MIE_*` for `mie`,
unprefixed otherwise. An unset secret resolves to an empty string rather than
failing, so a mapping mistake surfaces deep inside signing or upload — the two
targets producing _different_ signing certificates is what proves the mapping is
right.

iOS signs via `match` with the **team-level** App Store Connect key and match
repo, so no per-app `MIE_APPLE_*` or `MIE_IOS_*` cert secrets exist or are
needed — only the shared `APPLE_*` and `MATCH_*` ones.

Play publishing uses `github-com-mieweb-auth-app@mieweb-auth-prod`, which holds
grants on all three listings. Both `GOOGLE_PLAY_JSON_KEY_BASE64` and
`MIE_GOOGLE_PLAY_JSON_KEY_BASE64` carry that same credential; they are kept
separate only so the listings can be rotated independently later.

`workflow_dispatch` only appears in the Actions UI once the workflow file is on
the **default branch** — that is why the first version had to be merged before it
could be run.

Rejected: separate long-lived branches per app. The apps differ by ~4 strings and
a logo; branching would force every fix to be merged twice and would conflict on
`mobile-config.js` and `public/resources` every time.

---

## 7. Open items

1. **Play Store rejection — privacy policy.** `client/web/PrivacyPolicyPage.jsx`
   never names the app, the developer, or the legal entity, which Play requires.
   It also does not disclose what data is collected, which must match the Data
   Safety form (name, email, username, device ID, FCM token — all collected,
   stored, required, not ephemeral). The page is served from the app, so fixing
   it needs a **server deploy**, not a new mobile build. It is shared with the
   opensource app, so it should name both apps and the shared legal entity.
2. **iOS distribution signing.** Only a _development_ profile exists. TestFlight
   needs a distribution certificate + App Store provisioning profile for
   `org.mieweb.auth`, plus an App Store Connect app record.
3. **Mobile CI has never run.** Suggested first run: dispatch with
   `include_mobile: true`, `platforms: android`, `publish: false`, and check the
   signing fingerprint matches the manual upload before enabling publish.
4. **App naming.** "MIEWeb Auth" vs the existing "MIEAuth" listing — confirm with
   Robert Gingras before the listing goes public.
5. **Verify `MIE_GOOGLE_PLAY_JSON_KEY_BASE64` is base64-encoded**, not raw JSON.
6. **Back up the Android keystore** to a shared vault.

---

## 8. Gotchas already hit (do not re-debug these)

| Symptom                                                                                                          | Cause / fix                                                                                                                         |
| ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `UNABLE_TO_VERIFY_LEAF_SIGNATURE` on LDAP                                                                        | Node ignores the system CA store. `ldapsearch` works, the app does not. Set `NODE_EXTRA_CA_CERTS` to the MIE CA and restart.        |
| `sudo: a terminal is required to read the password` in CI, "Server failed to start" while the service is healthy | sudoers matches arguments **exactly**; `is-active --quiet mieauth` ≠ `is-active mieauth`. Every flag form must be listed.           |
| `50 Insufficient access` on the admin group                                                                      | Anonymous search is refused; the proxyuser service bind is required.                                                                |
| `Invalid credentials (49)` binding as a user                                                                     | Admin passwords are **SSO/AD**, not the old opensource ones.                                                                        |
| `Invalid APNs credential` from FCM                                                                               | Firebase→Apple, _after_ the service account authenticated. Check APNs key, Key ID, Team ID in Firebase.                             |
| `Device information or FCM token not available` (Android)                                                        | Emulator without Google Play Services cannot get an FCM token. Use a Play-enabled image or a real device.                           |
| Cordova: `product name change is not supported dynamically`                                                      | Renaming the app invalidates the cached platform. The local build script stamps the cache and wipes `platforms/` on a brand switch. |
| Meteor installer hangs on a sudo prompt                                                                          | It tries to write `/usr/local/bin/meteor`. The provisioner passes a no-op `sudo` shim and links the launcher separately.            |
| `swapon: Operation not permitted`                                                                                | LXC container — swap is a host-level setting. Also `swapon` lives in `/sbin`.                                                       |
| `sssd.conf not present` from the inventory script                                                                | It was testing readability as a non-root user; the file is `0600`. Test existence with `sudo`.                                      |
| Opensource logo/icons showing up in a diff                                                                       | An interrupted MIE build. `git checkout -- mobile-config.js public/resources public/logo.png`.                                      |

---

## 9. Scripts

| Script                              | Purpose                                                                                                                                             |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/audit-server.sh`           | Read-only host audit — toolchain, DB, ports, tunnel, runner. Safe on prod.                                                                          |
| `scripts/provision-server.sh`       | Idempotent provisioner. `TARGET_USER=actions bash …` — installs the toolchain for the runner's user, which is not the sudo user.                    |
| `scripts/install-service.sh`        | Installs the systemd service. `SVC_USER=actions bash …`. `mieauth.service` is a template (`__USER__`/`__GROUP__`/`__HOME__`).                       |
| `scripts/start-mieauth.sh`          | The service's `ExecStart` — sources `set-env.sh` and runs the bundle. Deployed to `~/scripts/` on the server; the name is baked into the unit file. |
| `scripts/apply-variant.sh`          | Rebrands the checkout for a target (`mie`, `mie-os-dev`, `mie-os-prod`). Used by **both** CI and the local build.                                   |
| `scripts/build-mobile-local.sh`     | Local mobile build with automatic restore of opensource files.                                                                                      |
| `scripts/sign-android-release.sh`   | Signs the AAB (jarsigner) and/or APK (zipalign + apksigner).                                                                                        |
| `scripts/diagnose-ldap-login.sh`    | Six-step LDAP isolation. Run on the server.                                                                                                         |
| `scripts/send-test-notification.sh` | Smoke-tests `POST /send-notification` with a curl push.                                                                                             |

---

## 10. People

- **Robert Gingras** — LDAP/AD, DNS, Cloudflare tunnel, infrastructure.
- **Anshul Abrol** — this work; holds the Android keystore and Firebase access.
