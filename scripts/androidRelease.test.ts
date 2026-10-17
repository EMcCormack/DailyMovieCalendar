import test from "node:test";
import assert from "node:assert/strict";
import { parseAndroidBuild, releaseAssetName, validateRelease } from "./androidRelease";

const expected = {
  commit: "a".repeat(40),
  projectId: "test-project",
  version: "1.0.0",
  versionCode: 1,
};
const build = {
  id: "2c57ea14-b5c1-4555-adbc-ececa9c9c173",
  status: "FINISHED",
  platform: "ANDROID",
  buildProfile: "preview",
  gitCommitHash: expected.commit,
  app: { id: expected.projectId },
  appVersion: "1.0.0",
  appBuildVersion: "1",
  artifacts: { applicationArchiveUrl: "https://expo.dev/artifacts/eas/example.apk" },
};
const release = { tag_name: "v1.0.0", draft: true, prerelease: false, assets: [] };

test("APK collection accepts only the finished build for this project, commit, and version", () => {
  assert.equal(parseAndroidBuild([build], expected).id, build.id);
  for (const change of [
    { status: "ERRORED" },
    { status: "IN_PROGRESS" },
    { platform: "IOS" },
    { buildProfile: "other" },
    { gitCommitHash: "b".repeat(40) },
    { app: { id: "another-project" } },
    { appVersion: "2.0.0" },
    { appBuildVersion: "2" },
  ])
    assert.throws(() => parseAndroidBuild([{ ...build, ...change }], expected));
  assert.throws(() => parseAndroidBuild([], expected));
  assert.throws(() => parseAndroidBuild([build, build], expected));
  for (const url of [
    "http://expo.dev/app.apk",
    "https://example.com/app.apk",
    "https://expo.dev/app.aab",
  ])
    assert.throws(() => parseAndroidBuild([{ ...build, artifacts: { buildUrl: url } }], expected));
});

test("release preparation requires matching stable version and refuses existing or immutable assets", () => {
  assert.deepEqual(validateRelease(release, "v1.0.0", "1.0.0", "workflow_dispatch"), {
    skip: false,
  });
  assert.throws(() => validateRelease(release, "v2.0.0", "1.0.0", "workflow_dispatch"));
  assert.throws(() =>
    validateRelease({ ...release, immutable: true }, "v1.0.0", "1.0.0", "release"),
  );
  assert.throws(() =>
    validateRelease({ ...release, draft: false }, "v1.0.0", "1.0.0", "workflow_dispatch"),
  );
  assert.throws(() =>
    validateRelease({ ...release, prerelease: true }, "v1.0.0", "1.0.0", "release"),
  );
  assert.throws(() =>
    validateRelease(
      { ...release, assets: [{ name: "SHA256SUMS.txt" }] },
      "v1.0.0",
      "1.0.0",
      "release",
    ),
  );
  assert.throws(() => releaseAssetName("../other"));
});

test("publishing a prepared draft skips a duplicate build, including immutable releases", () => {
  const prepared = {
    ...release,
    draft: false,
    immutable: true,
    assets: ["daily-movie-calendar-1.0.0.apk", "SHA256SUMS.txt", "build-info.json"].map((name) => ({
      name,
    })),
  };
  assert.deepEqual(validateRelease(prepared, "v1.0.0", "1.0.0", "release"), { skip: true });
  assert.throws(() => validateRelease(prepared, "v1.0.0", "1.0.0", "workflow_dispatch"));
});
