# Security policy

## Reporting a vulnerability

Use the repository's **Security → Advisories → Report a vulnerability** form when private reporting is enabled. Include the affected commit or release, reproduction steps, and the impact. If that form is unavailable, open an issue asking for a private contact channel without including exploit details, tokens, or personal data.

Do not include secrets in issues, pull requests, screenshots, build logs, or sample configuration. If a credential has been exposed, revoke it at its provider and replace it in the relevant secret store; removing the text from the latest commit does not revoke the credential.

## Supported versions and boundaries

Security fixes target the latest release and `master`. This is a small noncommercial project with no guaranteed response or support period.

Known dependency findings and the latest review are recorded in [docs/dependency-security.md](docs/dependency-security.md). Run `pnpm audit` to check the current advisory database.

User calendars and watch progress are stored locally on the device. Date locks use the device clock. The backend is a public, read-only API for collections and TMDB movie information; it does not provide accounts or calendar synchronization. API throttling is not a spending cap.

`EXPO_PUBLIC_MOVIE_API_URL`, the Expo project ID, Android package name, AWS resource names, and public GitHub account identifiers are configuration, not secrets. TMDB tokens stay in backend configuration/SSM, Expo access tokens stay in the GitHub production environment, and Android signing credentials stay in Expo or the owner's encrypted backup.

The MIT license applies to the project's code. TMDB and JustWatch names, logos, movie artwork, and supplied data remain subject to their owners' terms and attribution requirements.
