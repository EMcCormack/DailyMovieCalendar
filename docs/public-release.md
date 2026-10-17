# Preparing a public repository and Android releases

The repository remains private until its owner changes visibility. Building an APK, creating a Git tag, preparing a draft release, and publishing a release are separate actions.

## Automated checks

`CI` runs on pushes to `master` and on pull requests, including forks. It checks formatting, lint, TypeScript, tests, Lambda bundling, and Android/iOS/web production exports. It also scans Git history with a checksum-verified Gitleaks binary. The job has read-only repository access and no Expo or AWS environment credentials.

Third-party actions are pinned to commit SHAs. Dependabot checks those action pins weekly. Review action changes before merging them; Expo dependency upgrades still require the SDK 57 compatibility checks in the README.

Local audit on October 17, 2026: Gitleaks scanned all 13 existing commits and found no leaks. Git history contained `.env.example` but no tracked `.env`, keystore, AWS credential file, or Expo `credentials.json`. This is a point-in-time scan, not a guarantee about every possible secret format or future commit.

The staged release-preparation changes, five completed historical build/deployment/CI logs, issue/PR descriptions, and discussion/review comments were also scanned with no leaks found. The production environment's restrictions were verified as `master` branches and `v*` tags, and the repository's default workflow token permissions were already read-only with pull-request approval disabled. Human review of author metadata and attachments remains part of the visibility decision.

## Before changing visibility

1. Confirm the `CI` workflow succeeds on the commit you intend to publish.
   Review the [dependency security report](dependency-security.md), including the remaining upstream advisories, before publishing a versioned binary.
2. Review Git author metadata, historical commits, closed issues, pull requests, and Actions logs/artifacts; those may become public along with the source. The Expo project ID and account identifiers in configuration are intentionally public configuration. Keep personal credentials and signing backups outside the repository.
3. Review the existing MIT license and third-party attribution. The original Expo copyright is retained; project contributions have their own copyright line. TMDB artwork/data and logos are not relicensed by this repository.
4. In GitHub's `production` environment, allow only `master` and intended `v*` tags. Keep `EXPO_TOKEN` there; backend deployments use the existing scoped AWS OIDC role. Keep fork builds out of that environment. Publishing a stable release also runs **Deploy backend** and can update AWS resources.
5. After the repository is public, enable GitHub secret scanning/push protection and private vulnerability reporting under **Settings → Advanced Security**. Verify those settings are enabled rather than assuming they changed with visibility. Consider a branch ruleset requiring the `CI / validate` check before changes reach `master`.

Visibility is changed through **Settings → General → Danger Zone → Change repository visibility**. Review GitHub's confirmation screen and [visibility implications](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/managing-repository-settings/setting-repository-visibility) before making that final change.

## Manual APK builds

```sh
gh workflow run android-build.yml --ref master
```

The workflow waits for Expo's actual result, with a 60-minute build-job timeout including queue time. A successful run has an `android-apk` artifact containing the signed APK, `SHA256SUMS.txt`, and `build-info.json`. Download it from the run's **Artifacts** section and extract the ZIP. The artifact expires after seven days. The job summary identifies the EAS build and source commit.

If GitHub times out or a run is cancelled, the Expo cloud build may continue; check Expo before starting another paid/quota-consuming build. Public-repository standard runner time is free, but Expo allowances and GitHub artifact storage still apply.

## Versioned APK releases

Use a draft first so the APK is present before publication, including when immutable releases are enabled:

1. Set the intended version in both `app.json` (`expo.version`) and `package.json`. Increase `expo.android.versionCode` for every versioned release. Keep the Android package name and signing key stable so users can install updates without uninstalling and losing local data.
2. Commit, push, and wait for `CI` to pass. Create the tag from that tested `master` commit. The tag must match `app.json`: for version `1.0.0`, use `v1.0.0`. For later releases, substitute the new version throughout:

   ```sh
   git tag v1.0.0
   git push origin v1.0.0
   gh release create v1.0.0 --verify-tag --draft --title "v1.0.0" --generate-notes
   gh workflow run android-build.yml --ref master -f release_tag=v1.0.0
   ```

3. Wait for all Android workflow jobs to succeed. The workflow verifies the tag's commit belongs to `master`, validates the release version before spending an EAS build, and attaches the APK, checksum, and build metadata to the draft. It does not publish the draft. Existing assets are never overwritten automatically.
4. Download and install the APK, verify calendar creation/search, movie reveals, watch progress after restart, and an upgrade over the previous APK when available. Review release notes and configuration changes.
5. Publish the prepared draft when ready:

   ```sh
   gh release edit v1.0.0 --draft=false
   ```

   Publication starts the existing backend deployment workflow. The Android workflow recognizes a complete asset set and skips a duplicate Expo build. Release assets stay with the release instead of following the seven-day Actions artifact retention.

A published, mutable stable `v*` release without prepared APK assets can still trigger the Android build automatically. A published immutable release cannot accept new assets; prepare its draft first. Partial or existing APK assets cause a clear failure so maintainers can inspect them before retrying. Updating or replacing already published binaries is a separate maintainer decision.

The current `preview` profile produces a signed release APK suitable for direct installation. This flow does not submit to Google Play or configure OTA updates.
