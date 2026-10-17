# Dependency security review

Review date: October 17, 2026. Audit both app and development dependencies with `pnpm audit`: the Lambda bundle imports AWS packages listed in devDependencies, and Expo includes build tools in its production dependency tree.

## Applied updates

The lockfile now uses compatible patched versions of `shell-quote` (1.12.0), `brace-expansion` (5.0.12), `source-map-js` (1.2.2), and `compression` (1.8.2). These remove the reported critical shell-quoting issue and the patchable high-severity findings without changing the Expo SDK family. Expo's compatibility check also recommended updating Expo to 57.0.30 and expo-linear-gradient to 57.0.2; those SDK 57 updates are included.

## Remaining upstream advisories

The following findings still need upstream resolution or a separately tested major dependency migration. They have not been suppressed in pnpm's audit configuration.

| Dependency | Severity | Advisory | Current dependency path |
| --- | --- | --- | --- |
| node-forge 1.4.0 | High | [RSA signature verification](https://github.com/advisories/GHSA-86w9-cpqp-85rv) | Expo CLI and its code-signing-certificate tooling |
| braces 3.0.3 | High | [Nested-pattern stack exhaustion](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) | Metro/micromatch and Tailwind file-pattern tooling |
| uuid 7.0.3 | Moderate | [Optional output-buffer bounds checks](https://github.com/advisories/GHSA-w5hq-g745-h8pq) | Expo build/development tooling |
| postcss-selector-parser 6.1.4 | Moderate | [Selector parsing complexity](https://github.com/advisories/GHSA-rj75-hqrm-r3gf) | Tailwind CSS tooling |

The advisory database lists no patched release for the two high-severity packages at the review date. The moderate findings require versions outside the parents' current major ranges. Avoid overriding major versions solely to make the audit output green.

Inspection of the dependency paths and application imports places these findings in the development/build toolchain; the public movie API does not import these libraries. That is an exposure assessment, not proof that the tools cannot be exploited. Do not expose the Expo/Metro development server publicly, and review untrusted dependency/configuration changes before running credentialed builds. Android signing is performed by Expo's native build service; this node-forge finding concerns the JavaScript toolchain's certificate routines.

Recheck the advisories before a versioned release and after Expo/Metro/Tailwind updates. A failed `pnpm audit --audit-level high` remains expected until the high findings are resolved. Record any future exception with its exact advisory and affected code path rather than disabling auditing globally.
