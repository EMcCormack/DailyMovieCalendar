import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, open, readFile, writeFile } from "node:fs/promises";
import { createReadStream, createWriteStream } from "node:fs";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";

export function releaseAssetName(version: string): string {
  assert.match(version, /^\d+\.\d+\.\d+$/, "App version must be MAJOR.MINOR.PATCH");
  return `daily-movie-calendar-${version}.apk`;
}

export function validateRelease(
  release: {
    tag_name: string;
    draft: boolean;
    prerelease: boolean;
    immutable?: boolean;
    assets: { name: string }[];
  },
  tag: string,
  version: string,
  event: string,
): { skip: boolean } {
  assert.equal(tag, `v${version}`, "Release tag must match app.json version");
  assert.equal(release.tag_name, tag, "Release does not match the requested tag");
  assert.equal(release.prerelease, false, "Use a stable release for APK publishing");
  const expected = [releaseAssetName(version), "SHA256SUMS.txt", "build-info.json"];
  const existing = expected.filter((name) => release.assets.some((asset) => asset.name === name));
  // Publishing a prepared draft must not spend another EAS build or replace its APK.
  if (event === "release" && existing.length === expected.length) return { skip: true };
  assert.equal(existing.length, 0, "Release already contains APK assets; do not overwrite them");
  assert.ok(!release.immutable, "Immutable release: build and attach assets to a draft first");
  if (event === "workflow_dispatch")
    assert.equal(release.draft, true, "Manual release builds require a draft release");
  return { skip: false };
}

export function parseAndroidBuild(
  input: unknown,
  expected: { commit: string; projectId: string; version: string; versionCode: number },
): { id: string; url: string } {
  assert.ok(Array.isArray(input) && input.length === 1, "Expected exactly one Android build");
  const build = input[0];
  assert.equal(build?.status, "FINISHED", "EAS build did not finish successfully");
  assert.equal(build.platform, "ANDROID", "Unexpected build platform");
  assert.equal(build.buildProfile, "preview", "Unexpected build profile");
  assert.equal(build.gitCommitHash, expected.commit, "EAS build commit does not match checkout");
  assert.equal(build.app?.id, expected.projectId, "EAS build belongs to another project");
  assert.equal(build.appVersion, expected.version, "EAS app version does not match checkout");
  assert.equal(
    String(build.appBuildVersion),
    String(expected.versionCode),
    "Wrong Android versionCode",
  );
  assert.match(build.id, /^[a-f0-9-]{36}$/, "Invalid EAS build ID");
  const url = new URL(build.artifacts?.applicationArchiveUrl ?? build.artifacts?.buildUrl);
  assert.equal(url.protocol, "https:", "APK download must use HTTPS");
  assert.equal(url.hostname, "expo.dev", "Expected an Expo-hosted APK download");
  assert.ok(url.pathname.endsWith(".apk"), "Expected an APK artifact");
  assert.equal(url.username + url.password, "", "Unexpected download credentials");
  return { id: build.id, url: url.href };
}

export async function collectAndroidBuild(
  buildFile: string,
  expected: { commit: string; projectId: string; version: string; versionCode: number },
  outputDirectory: string,
): Promise<{ name: string; buildId: string; sha256: string }> {
  const build = parseAndroidBuild(JSON.parse(await readFile(buildFile, "utf8")), expected);
  const name = releaseAssetName(expected.version);
  await mkdir(outputDirectory, { recursive: true });
  const destination = join(outputDirectory, name);
  const response = await fetch(build.url, { signal: AbortSignal.timeout(300_000) });
  assert.ok(response.ok && response.body, `APK download failed: HTTP ${response.status}`);
  assert.equal(new URL(response.url).protocol, "https:", "APK redirect must use HTTPS");
  const reader = response.body.getReader();
  async function* chunks() {
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) return;
        yield chunk.value;
      }
    } finally {
      reader.releaseLock();
    }
  }
  await pipeline(chunks(), createWriteStream(destination));
  const file = await open(destination, "r");
  try {
    const header = Buffer.alloc(4);
    await file.read(header, 0, 4, 0);
    assert.ok(header.equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])), "Download is not an APK/ZIP");
  } finally {
    await file.close();
  }
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(destination)) hash.update(chunk);
  const sha256 = hash.digest("hex");
  await writeFile(join(outputDirectory, "SHA256SUMS.txt"), `${sha256}  ${name}\n`);
  await writeFile(
    join(outputDirectory, "build-info.json"),
    `${JSON.stringify({ ...expected, buildId: build.id, apk: name, sha256 }, null, 2)}\n`,
  );
  return { name, buildId: build.id, sha256 };
}
