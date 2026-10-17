# Daily Movie Calendar

A seasonal movie advent calendar for Android, iOS, and web, built with Expo 57, React Native, TypeScript, and NativeWind. Uses pnpm exclusively.

## Run

Requires Node.js 24 and pnpm 12.3.4, managed by `mise.toml`.

```sh
mise install
pnpm install
pnpm start
# Or:
pnpm android
pnpm ios
pnpm web
```

Use an Expo client compatible with SDK 57, or a native development build. Local iOS builds require macOS and Xcode; Android builds require the Android SDK. This repository includes JavaScript app code, not signed store binaries.

## Features

- Separate Halloween (October 1–31) and Christmas (December 1–25) calendars.
- Local-midnight unlocking, movie reveals, and watched/unwatched tracking.
- Curated collections served from DynamoDB through the TypeScript API, with local demo fixtures and downloaded offline fallback.
- Create and edit calendars on a dedicated screen with TMDB search, adjustable start dates, and drag-and-drop movie ordering. Hold a movie row to drag it; swipe normally to scroll. Start mid-season to fill the remaining dates.
- Preserve the supplied order or shuffle when starting a calendar.
- Edit the start date or movie order while keeping watch progress for movies that remain on the same date. Changes are saved only when you press Save changes.
- Device-local persistence with AsyncStorage; switching seasons preserves both calendars.
- Preview all days outside the season without changing real watch progress.
- JustWatch and Google links for streaming, rental, and purchase searches.
- Movie posters and brief synopses on reveal, fetched from TMDB when the optional server is configured. Missing images and descriptions have fallback states.
- Optional live provider listings for US, UK, Canada, and Australia.

Starting a new calendar resets its watch progress. Changing its year prompts before resetting progress. Lists and progress do not sync between devices. Calendar locks use the device clock and are intended for anticipation, not tamper-proof access control.

## TMDB configuration

Movie search, metadata, and provider listings require the backend configuration below. External watch-search links work without credentials.

1. Obtain a TMDB API read-access token.
2. Copy `.env.example` to `.env` and set `TMDB_READ_TOKEN`.
3. Set `EXPO_PUBLIC_MOVIE_API_URL` to the API server URL. Physical phones need your computer's LAN IP for local development, not localhost.
4. Run `pnpm server`, then restart Expo.

The same configuration enables movie posters and synopses through `/api/movie`. Metadata loads independently of streaming availability, so movies can have a poster and description even when there are no regional providers. Published curated lists are handpicked records in DynamoDB. `src/collections.ts` supplies the local fixtures and starter publishing data; TMDB supplies movie metadata. New custom selections store TMDB IDs for exact lookups. Existing title/year calendars remain supported.

The Node server looks up selected movies by TMDB ID. For legacy calendars, it accepts only an unambiguous exact normalized title match (and supplied year) before querying regional providers. It caches availability for one hour and returns no match instead of guessing. The app falls back to search links if data is unavailable. The token stays on the server; never use an `EXPO_PUBLIC_` prefix for it.

Deploy the TypeScript Lambda backend using `template.yaml` (an AWS SAM/CloudFormation template) and the [GitHub Actions deployment workflow](docs/github-actions.md). It uses API Gateway HTTP API, on-demand DynamoDB, and SSM Parameter Store with no customer VPC or NAT gateway. See the backend guide for local development and collection publishing steps. Mobile API calls do not depend on browser CORS. Availability data comes from JustWatch via TMDB and uses TMDB's supplied watch-page link; it does not invent individual service deep links or prices. TMDB and JustWatch attribution is included in Settings → About & credits, with JustWatch also credited beside watch results.

## Validation

```sh
pnpm typecheck
pnpm test
pnpm exec expo install --check
pnpm exec expo export --platform all
pnpm backend:build
```

Native packages follow the SDK 57 compatibility matrix, even when newer standalone versions exist. NativeWind 4.2.6 is the latest stable release at setup; its documented integration requires Tailwind 3.4.19. NativeWind 5 is a preview. TypeScript is 7.0.2. Dependency versions are pinned by `pnpm-lock.yaml`.

References: [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/), [NativeWind setup](https://www.nativewind.dev/docs/getting-started/installation), [TMDB watch providers](https://developer.themoviedb.org/reference/movie-watch-providers).

TypeScript 7 is intentionally excluded from Expo's dependency-version check (which recommends TypeScript 6). It is checked separately with `pnpm typecheck`.

For backend deployment and GitHub-orchestrated EAS Android builds, see [GitHub Actions releases](docs/github-actions.md). For API routes and publishing curated collections, see [Backend setup](docs/backend.md). This project is noncommercial and uses TMDB’s developer API.
