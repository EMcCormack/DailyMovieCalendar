# TypeScript backend on AWS

Daily Movie Calendar uses API Gateway HTTP API → Lambda → DynamoDB, with Lambda also calling TMDB. All backend source, tests, and publishing scripts are TypeScript. The deployment artifact is generated JavaScript; the old handwritten `.mjs` server files have been removed.

Lambda has **no customer VPC configuration**. No NAT gateway, RDS instance, load balancer, or provisioned Lambda concurrency is created. DynamoDB uses on-demand billing. This is the architecture behind the small-usage cost estimate; actual charges depend on requests, compute, database usage, logs, and transfer. API throttling and concurrency settings limit load but are not a spending cap.

## Local development

Requires Node 24+, pnpm 11.5.0.

1. `pnpm install`
2. Copy `.env.example` to `.env`.
3. Set `TMDB_READ_TOKEN` to your TMDB developer API read token. Never use an `EXPO_PUBLIC_` prefix for credentials.
4. Set `EXPO_PUBLIC_MOVIE_API_URL=http://localhost:3001` for web. Use your computer's LAN IP for physical phones.
5. Run `pnpm server` and `pnpm start` in separate terminals.

Without `COLLECTIONS_TABLE`, the local server serves the bundled fixture collections. With `COLLECTIONS_TABLE` and AWS credentials configured, it reads the specified DynamoDB table. The deployed Lambda always requires DynamoDB and never substitutes fixtures when the table fails.

## Deploy when ready

The [GitHub Actions deployment guide](github-actions.md) covers the repeatable backend release workflow and its one-time AWS/GitHub setup. The commands below remain useful for a first local deployment or troubleshooting. Both paths deploy this SAM template through CloudFormation.

No AWS resources are provisioned merely by building or testing this repository. The following deployment and publishing commands create cloud resources or write cloud data when you run them.

Prerequisites: AWS CLI credentials, AWS SAM CLI, and permissions to create the stack's resources. Use a single region, for example `us-east-1`.

1. In AWS Systems Manager Parameter Store, create a **Standard SecureString** named `/daily-movie-calendar/tmdb-token`. Enter the TMDB token through the console; use the default `aws/ssm` encryption key. The stack references this existing parameter and does not contain the token. A custom KMS key needs an additional scoped `kms:Decrypt` permission.
2. Build and validate locally:

   ```sh
   pnpm typecheck
   pnpm test
   pnpm backend:build
   sam validate --lint --template-file template.yaml --region us-east-1
   ```

3. Deploy the prebuilt bundle:

   ```sh
   sam deploy --template-file template.yaml --guided --region us-east-1
   ```

   Choose a stack name such as `daily-movie-calendar-dev`, provide your exact web origin for `AllowedOrigin`, and the parameter name for `TmdbTokenParameterName`. Allow SAM to create the Lambda execution role. SAM uploads `build/server/`; no separate npm install or SAM build step is required. Run `pnpm backend:build` before every deployment. The guided command saves local settings in the ignored `samconfig.toml`; later local deployments can use `sam deploy --template-file template.yaml`.

4. Set `EXPO_PUBLIC_MOVIE_API_URL` to the stack's `ApiUrl` output and restart/rebuild the app.
5. Publish the starter collections using the process below.

The stack creates:

- Node.js 24 Lambda on ARM64, 256 MB, 25-second timeout, reserved concurrency 5. Accounts with unusually low concurrency quotas may need to adjust this reservation.
- HTTP API with five GET routes, CORS, 5 requests/second steady throttling and a burst of 10.
- A DynamoDB table with `pk` and `sk` keys, on-demand billing, and encryption at rest.
- Seven-day Lambda log retention.
- A runtime role allowed only to query the collection table and read the one SSM parameter, plus standard Lambda logging permissions.

The API is public and read-only. Publishing is a separate administrator command using AWS credentials, never a public write endpoint. User calendars and watched progress remain device-local; account authentication and synchronization are not part of this migration.

Deleting the stack **retains its DynamoDB table** to avoid losing collections. Retained table storage continues to be billed until you explicitly remove it. The SSM parameter was created separately and is also retained.

## Publish curated collections

Set these server-side environment variables in `.env` or your shell:

```dotenv
AWS_REGION=us-east-1
COLLECTIONS_TABLE=<CollectionsTableName stack output>
TMDB_TOKEN_PARAMETER=/daily-movie-calendar/tmdb-token
```

The script uses `TMDB_READ_TOKEN` if set; otherwise it reads the SSM parameter. Your CLI identity needs `ssm:GetParameter` when using SSM and `dynamodb:PutItem` on the collection table when publishing. The Lambda role deliberately has no write access.

```sh
pnpm backend:seed
# Review successful title/year matches; this command does not write DynamoDB.
pnpm backend:seed --publish
```

The publisher resolves all starter titles to exact TMDB IDs before starting any writes. Ambiguous/missing matches abort with the title that needs review. You can supply a verified `tmdbId` in the source data to resolve an ambiguity. Duplicate movie lookups are reused. Publishing inserts missing collections and preserves existing items with a conditional write, so retrying after a partial write is safe. It does not overwrite an edited live collection.

Each item has this shape:

```text
pk: SEASON#christmas
sk: COLLECTION#cozy
published: true
version: 1
collection: { id, name, season, description, badge, emoji, color, movies: [...] }
```

A movie contains `{ id: "tmdb:38", tmdbId: 38, title, year, genre }`, with optional description/poster URL. Metadata and availability can be refreshed from TMDB on reveal. Lists contain at most 25 Christmas or 31 Halloween movies.

For edits, use an administrator workflow or the DynamoDB console to update the collection and increment its version. Set `published: false` to hide it. Keep the collection's season consistent with its partition. The API queries one seasonal partition, follows pagination, and omits drafts. Editing collections changes future choices; existing user calendars keep their copied movie order and progress. Already downloaded offline collections may still be visible offline.

## API routes

- `GET /health`: process liveness; not a credential/database health check.
- `GET /api/collections?season=halloween`: published DynamoDB collections. Empty table returns an empty list; database failures return 503.
- `GET /api/movies/search?q=Elf&page=1`: TMDB movie search, excluding adult entries.
- `GET /api/movie?id=38`: poster and synopsis by TMDB ID.
- `GET /api/providers?id=38&region=US`: TMDB watch providers grouped into stream/free/ads/rent/buy. Regions: US, GB, CA, AU.

Legacy saved calendars may use title/year instead of ID. Only unambiguous matches are accepted. TMDB availability supplies a watch-page URL, not per-service deep links or prices. JustWatch and Google search remain labeled fallbacks.

TMDB responses use bounded caches per warm Lambda instance (five minutes for search; one hour for details/providers). SSM tokens refresh every five minutes. These caches are temporary optimizations, not persistent database state. Posters load directly from TMDB's CDN.

## Attribution and license

This is a noncommercial app using TMDB's developer API. TMDB account registration and accepting its terms are done by the account owner. Settings → About & credits includes the approved unmodified TMDB logo and required notice; JustWatch is credited there and beside availability results.

References:

- https://docs.aws.amazon.com/lambda/latest/dg/configuration-vpc-internet.html
- https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/sam-resource-httpapi.html
- https://developer.themoviedb.org/docs/faq
- https://developer.themoviedb.org/reference/movie-watch-providers
