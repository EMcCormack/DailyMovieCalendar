# Repository Guidelines

## Project Structure

The Expo app entry point is `App.tsx`; reusable UI and client logic live in `src/`, shared domain types and validation in `shared/`, and static images in `assets/`. Backend code is TypeScript under `server/`: `handler.ts` is the AWS Lambda adapter, `api.ts` contains request logic, and `collections-store.ts` reads DynamoDB. AWS SAM infrastructure is defined in `template.yaml`. Tests sit beside the code they cover (`src/*.test.ts` and `server/*.test.ts`); deployment guidance is in `docs/backend.md`.

## Development Commands

Use mise-managed pnpm (`pnpm-lock.yaml` is authoritative). Run `mise install` after cloning.

```sh
pnpm install                 # install dependencies
pnpm start                   # start Expo development server
pnpm android | pnpm ios     # run a native target
pnpm web                     # run the web target
pnpm server                  # run the local TypeScript API
pnpm typecheck               # check app and backend TypeScript
pnpm test                    # run all Node test suites
pnpm backend:build           # bundle the Lambda handler
```

For Expo changes, read the versioned [Expo SDK 57 documentation](https://docs.expo.dev/versions/v57.0.0/) before editing code. Run `pnpm exec expo export --platform all` for a production-style bundle check.

## Style and Naming

Use TypeScript, two-space indentation, double quotes, and Biome formatting. Components and types use `PascalCase`; functions, hooks, variables, and files use `camelCase` (React component files may use `PascalCase`). Keep NativeWind classes in `className` and use explicit accessibility labels and roles for interactive controls. Run `pnpm format` before submitting.

## Testing

Tests use Node’s built-in test runner through `tsx`. Name tests `*.test.ts` and cover validation, date boundaries, API behavior, DynamoDB pagination, Lambda adaptation, and infrastructure assumptions. Add regression tests for backend changes; run `pnpm typecheck && pnpm test`.

## Commits and Pull Requests

Use short imperative commit subjects, for example `Add TMDB search pagination`. Pull requests should explain the user-visible change, list validation commands, identify configuration or AWS changes, and include screenshots or a short screen recording for UI work. Never commit `.env`, TMDB tokens, AWS credentials, build output, or generated native folders.

## Security and Configuration

Copy `.env.example` for local settings. Keep `TMDB_READ_TOKEN` server-side; deployed Lambda reads it from SSM Parameter Store. Do not add a VPC or NAT gateway without documenting the cost and networking impact. Treat `template.yaml` changes as infrastructure changes and review IAM permissions carefully.
