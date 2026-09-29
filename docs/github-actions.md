# GitHub Actions releases

The backend and Android app have separate GitHub Actions workflows in this repository. The backend workflow deploys the existing AWS SAM template (`template.yaml`) through CloudFormation. GitHub Releases do not deploy anything until these workflows and their account settings are in place.

## Backend: one-time setup

1. Create the Standard SecureString TMDB token described in [backend.md](backend.md). The workflow only receives the SSM parameter **name**, never its value.
2. In GitHub, create an environment named `production`. Restrict deployments to the `master` branch and version tags matching `v*`; add required reviewers if desired.
3. Set these `production` environment variables:

   | Variable | Example | Purpose |
   | --- | --- | --- |
   | `AWS_REGION` | `us-east-1` | Region containing the stack and SSM parameter |
   | `AWS_STACK_NAME` | `daily-movie-calendar-prod` | Stable CloudFormation stack name |
   | `AWS_ARTIFACT_BUCKET` | `example-sam-artifacts` | S3 bucket created by pipeline bootstrap |
   | `CLOUDFORMATION_EXECUTION_ROLE_ARN` | `arn:aws:iam::...:role/...` | Role created by pipeline bootstrap |
   | `AWS_DEPLOY_ROLE_ARN` | `arn:aws:iam::...:role/...` | GitHub OIDC pipeline execution role ARN |
   | `ALLOWED_ORIGIN` | `https://example.com` | Exact browser origin for API CORS |
   | `TMDB_TOKEN_PARAMETER` | `/daily-movie-calendar/tmdb-token` | Existing SSM parameter name |

4. Bootstrap a GitHub OIDC deployment role, CloudFormation execution role, and artifact bucket with [AWS SAM pipeline bootstrap](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/deploying-with-oidc.html), or provision equivalent scoped roles using your AWS account's IAM process. For this GitHub repository, start with:

   ```sh
   sam pipeline bootstrap --stage production --region us-east-1 --permissions-provider oidc --oidc-provider github-actions --github-org EMcCormack --github-repo DailyMovieCalendar --deployment-branch master
   ```

   The deploy role needs to upload Lambda artifacts and create/execute CloudFormation change sets; the CloudFormation execution role needs permission to manage the resources in `template.yaml`. AWS account credentials and the TMDB token must not be stored in GitHub.
5. Configure the OIDC role trust for `token.actions.githubusercontent.com` with audience `sts.amazonaws.com` and subject `repo:OWNER/REPO:environment:production`. Because this workflow uses a GitHub environment, a branch-only subject such as `repo:OWNER/REPO:ref:refs/heads/master` will fail. GitHub's [AWS OIDC guide](https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-aws) documents the trust condition and newer immutable subject formats. This repository uses the immutable subject `repo:EMcCormack@20711436/DailyMovieCalendar@1359758293:environment:production`. Also restrict the `ref` claim to `refs/heads/master` and `refs/tags/v*`. Set the role and bucket values from pipeline bootstrap as the environment variables above. SAM bootstrap asks for a deployment branch and initially creates branch-based OIDC trust; update that trust to the `production` environment subject before running this workflow. Review the resulting IAM policy against the resources in `template.yaml`.
6. Run **Deploy backend** manually from `master` once. It installs locked dependencies, typechecks, tests, bundles `server/handler.ts`, validates the SAM template, deploys the CloudFormation stack, and checks `/health` and a DynamoDB-backed collections route. A non-prerelease GitHub Release with a `v*` tag runs the same deployment. The release deploys the tagged commit, so create tags from the tested `master` branch.
7. Read the stack's `ApiUrl` output in the workflow log or CloudFormation outputs and set `EXPO_PUBLIC_MOVIE_API_URL` for client builds. Publish starter collections separately using [backend.md](backend.md); the backend workflow does not write collection data.

The workflow's `production` environment can be the approval point for deployments when required reviewers are enabled. A failed first run may need an IAM or configuration correction; CloudFormation stack events show the underlying resource failure. An already deployed stack is updated in place on later runs. The DynamoDB table uses a retain policy, so deleting the stack does not delete its data.

## Local backend deploy

You can run the same build and deployment without GitHub Actions minutes using local AWS credentials:

```sh
pnpm install --frozen-lockfile
pnpm typecheck && pnpm test
pnpm backend:build
sam validate --lint --template-file template.yaml --region us-east-1
sam deploy --template-file template.yaml --guided --region us-east-1
```

The guided deployment writes `samconfig.toml`, which is intentionally ignored by Git. The GitHub workflow passes its deployment settings explicitly and does not use that local file.

## Android with EAS Build

GitHub Actions tests the tagged or selected commit and queues an [EAS Build](https://docs.expo.dev/build/building-on-ci/). Android compilation, signing, and artifacts live on Expo's build service. This is GitHub Actions orchestration, not EAS Workflows. The GitHub job uses `--no-wait`, so a green GitHub run means EAS accepted the request; check the EAS build dashboard for the final build result.

The `preview` profile in `eas.json` produces an installable APK. A manual **Build Android with EAS** run from `master` or a published, non-prerelease `v*` GitHub Release queues one APK and consumes one Android build from your EAS plan allowance. No Play Store AAB or submission runs yet. When Play publishing is needed, add a production profile with `android.buildType: "app-bundle"` and use EAS Submit.

### One-time setup

1. Deploy the backend and copy its `ApiUrl` output. The client API URL is public and embedded in the Android bundle; the TMDB token remains server-side.
2. Create or sign in to an Expo account. From this repository, run `pnpm dlx eas-cli@latest login` and then `pnpm dlx eas-cli@latest init`. Commit the `extra.eas.projectId` that `eas init` adds to `app.json`. Keep the app's Android package ID `com.emccormack.dailymoviecalendar` stable once distributed.
3. Set `EXPO_PUBLIC_MOVIE_API_URL` in the EAS project's **production** environment to the backend `ApiUrl` using the Expo dashboard or `pnpm dlx eas-cli@latest env:set --name EXPO_PUBLIC_MOVIE_API_URL --value https://YOUR_API_URL --environment production --visibility plaintext`. The APK build profile selects that environment in `eas.json`. Rebuild after changing the URL.
4. Run `pnpm dlx eas-cli@latest build --platform android --profile preview` locally once and complete the interactive EAS project and Android signing credential setup. EAS can generate and manage the Android keystore. This initial APK counts as one EAS Android build. When a future Play Store build is added, increase `android.versionCode` in `app.json` for each store release.
5. Create an Expo personal access token and save it as the `EXPO_TOKEN` secret in the GitHub `production` environment. The environment can require reviewers and should allow `master` plus `v*` tags. Run **Build Android with EAS** manually from `master` to verify CI authentication.

No Android keystore or passwords need to be stored in GitHub. The `pnpm` and Node versions in `eas.json` match this repository's toolchain rather than the EAS image defaults. A native EAS build has not run until the account setup and first interactive build are completed.

EAS Update (OTA) is not configured. This app does not currently depend on `expo-updates`, and `app.json` has no update URL or runtime version. APKs built now will need a new APK installation if OTA is added later. If OTA becomes useful, install `expo-updates`, run `eas update:configure` after linking the Expo project, add an update channel to the APK build profile, and build a new APK before publishing any OTA update.
