import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const publicDirectory = path.resolve(testDirectory, "../public");
const services = ["youtube", "twitch", "file", "hls"];

const results = [];
for (const service of services) {
  const pagePath = path.join(publicDirectory, "service", "v1", `${service}.html`);
  const page = await readFile(pagePath, "utf8");
  assert.match(page, new RegExp(`data-service="${service}"`));

  const references = [...page.matchAll(/(?:href|src)="([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(
    references.sort(),
    ["../../assets/player.css", "../../assets/player.js"].sort()
  );

  for (const reference of references) {
    const target = path.resolve(path.dirname(pagePath), reference);
    assert.ok(
      target.startsWith(publicDirectory + path.sep),
      `${reference} escaped the public directory`
    );
    await access(target);
  }

  results.push({
    path: `/service/v1/${service}.html`,
    service,
    references
  });
}

const playerSource = await readFile(
  path.join(publicDirectory, "assets", "player.js"),
  "utf8"
);
for (const api of ["th_video", "th_volume", "th_seek"]) {
  assert.match(playerSource, new RegExp(`window\\.${api}\\s*=`));
}
assert.match(playerSource, /DRIFT_CHECK_MS\s*=\s*5000/);
assert.match(playerSource, /DRIFT_LIMIT_SECONDS\s*=\s*1\.25/);
assert.doesNotMatch(playerSource, /\uFFFD/);

console.log(JSON.stringify({ passed: true, results }, null, 2));
