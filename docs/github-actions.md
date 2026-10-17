# GitHub Actions releases

The backend and Android app have separate GitHub Actions workflows in this repository. The backend workflow deploys the existing AWS SAM template (`template.yaml`) through CloudFormation. GitHub Releases do not deploy anything until these workflows and their account settings are in place.

Both workflows use actions that target Node.js 24. `pnpm/setup` installs pnpm 12.3.4 and Node.js 24 and caches the pnpm store; dependency installation remains an explicit `pnpm install --frozen-lockfile` step.

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

The workflow reads the exact EAS CLI version from `cli.version` in `eas.json` and runs it through `pnpm dlx`. The CLI stays outside the app's dependencies. This avoids the Expo setup action's internal `npm info` lookup, which fails this project's pnpm-only `devEngines` check. When upgrading the pinned CLI, update the local command examples below as well.

The `preview` profile in `eas.json` produces an installable APK. A manual **Build Android with EAS** run from `master` or a published, non-prerelease `v*` GitHub Release queues one APK and consumes one Android build from your EAS plan allowance. No Play Store AAB or submission runs yet. When Play publishing is needed, add a production profile with `android.buildType: "app-bundle"` and use EAS Submit.

### One-time setup for an installable Android APK

The existing `preview` profile is ready for a standalone APK that runs without an Expo development server. You need an Expo account; a Google Play developer account is not required. Run these commands from the repository root.

1. Install the project's Node 24 and pnpm 12.3.4 toolchain and locked dependencies:

   ```sh
   mise install
   pnpm install --frozen-lockfile
   ```

   If a `pnpm dlx` command below stops with `ERR_PNPM_IGNORED_BUILDS` for `dtrace-provider` and `protobufjs`, add `--allow-build=dtrace-provider --allow-build=protobufjs` immediately after `dlx`. For example: `pnpm dlx --allow-build=dtrace-provider --allow-build=protobufjs eas-cli@25.0.0 login`. These flags allow those dependencies' installation scripts in the temporary CLI environment.

2. Create an account at [expo.dev](https://expo.dev/signup), or sign in to your existing account, then create or link the EAS project:

   ```sh
   pnpm dlx eas-cli@25.0.0 login
   pnpm dlx eas-cli@25.0.0 init
   ```

   Choose the Expo account that should own the app. Review and commit the `app.json` changes, including `extra.eas.projectId`, before building through GitHub. Keep the Android package ID `com.emccormack.dailymoviecalendar` stable and reuse the same signing keystore for subsequent APK updates.

3. Copy the deployed backend's `ApiUrl` output and save it in the EAS project's **production** environment. Replace the example URL below with that public HTTPS endpoint, not localhost or a development computer's LAN address:

   ```sh
   pnpm dlx eas-cli@25.0.0 env:set production --name EXPO_PUBLIC_MOVIE_API_URL --value https://YOUR_API_URL --visibility plaintext
   ```

   You can also set it through the Expo dashboard. The `preview` profile inherits `environment: "production"` from `base` in `eas.json`, so use the production environment even though the profile is named preview. The API URL is embedded in the app; rebuild after changing it. Keep `TMDB_READ_TOKEN` on the backend. See [backend.md](backend.md) if the backend still needs deployment.

4. Start the first build interactively so EAS can set up Android signing:

   ```sh
   pnpm dlx eas-cli@25.0.0 build --platform android --profile preview
   ```

   For a new app without an existing keystore, choose **Generate new keystore** and let EAS manage it. Follow the build link and wait for the EAS status to become **Finished**. This command uploads the project and queues a cloud build against your EAS plan allowance; it does not require a local Android SDK.

   To configure signing now and trigger the build through GitHub instead, run `pnpm dlx eas-cli@25.0.0 credentials:configure-build --platform android --profile preview`, choose **Generate new keystore**, then follow the GitHub build automation steps below.

5. Open the finished build's install link on your Android phone, download the APK, and allow installation from your browser when Android prompts. Launch it and check movie search, posters, and calendar persistence after closing and reopening the app. For later APKs, rerun the same build command and install the new APK over the existing app to preserve local calendars and progress.

Expo references: [first build and signing](https://docs.expo.dev/build/setup/), [installable APKs](https://docs.expo.dev/build/internal-distribution/), and [EAS CLI environment commands](https://docs.expo.dev/eas/cli/#eas-envset-environment).

### Optional GitHub build automation

Once Android signing credentials are configured, create an [Expo personal access token](https://docs.expo.dev/accounts/programmatic-access/#personal-access-tokens) through your personal account settings. In GitHub, go to **Settings → Environments → production** and add it as the environment secret `EXPO_TOKEN`, or run `gh secret set EXPO_TOKEN --env production` and paste the token into the prompt. The environment should allow `master` plus `v*` tags. Commit and push the EAS project configuration, then run **Actions → Build Android with EAS → Run workflow** from `master`, or use the GitHub CLI:

```sh
gh workflow run android-build.yml --ref master
```

This queues an APK build. The workflow uses `--no-wait`; check Expo for the completed APK even if GitHub is green. No Android keystore or passwords need to be stored in GitHub. The `pnpm` and Node versions in `eas.json` match this repository's toolchain rather than the EAS image defaults.

EAS Update (OTA) is not configured. This app does not currently depend on `expo-updates`, and `app.json` has no update URL or runtime version. APKs built now will need a new APK installation if OTA is added later. If OTA becomes useful, install `expo-updates`, run `eas update:configure` after linking the Expo project, add an update channel to the APK build profile, and build a new APK before publishing any OTA update.
