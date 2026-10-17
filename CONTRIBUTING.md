# Contributing

Use Node.js 24 and pnpm 12.3.4 from `mise.toml`:

```sh
mise install
pnpm install --frozen-lockfile
cp .env.example .env
```

The app can use local demo collections without credentials. Movie search, posters, and streaming providers need your own TMDB token and backend configuration; see [README.md](README.md) and [docs/backend.md](docs/backend.md). Forks must create their own Expo project and backend rather than building against the maintainer's accounts.

Before opening a pull request, run:

```sh
pnpm format
pnpm lint
pnpm typecheck
pnpm test
pnpm backend:build
pnpm exec expo export --platform all
```

For Expo changes, read the [SDK 57 documentation](https://docs.expo.dev/versions/v57.0.0/). Keep native dependency versions compatible with that SDK. Tests belong beside the code they cover; release tooling tests live in `scripts/`. Include screenshots for UI changes and regression coverage for API and release behavior.

Pull-request CI runs without deployment credentials. Android builds and AWS deployments are maintainer workflows scoped to the `production` environment. Do not add deployment secrets to pull-request workflows or use `pull_request_target` to execute contributor code.

Keep `.env` files, AWS credentials, signing keys, `credentials.json`, APKs, build output, and generated native directories out of Git. Report security problems through the process in [SECURITY.md](SECURITY.md).
