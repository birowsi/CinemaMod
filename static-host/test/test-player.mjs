import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const sourcePath = new URL("../public/assets/player.js", import.meta.url);
const source = (await readFile(sourcePath, "utf8")).replace(
  'var testMode = new URLSearchParams(location.search).has("cinema_test");',
  "var testMode = true;"
);

function createElement(id = "") {
  const listeners = new Map();
  return {
    id,
    dataset: {},
    style: {},
    textContent: "",
    innerHTML: "",
    volume: 1,
    currentTime: 0,
    readyState: 0,
    paused: false,
    src: "",
    appendChild() {},
    addEventListener(name, callback) {
      listeners.set(name, callback);
    },
    dispatch(name) {
      listeners.get(name)?.();
    },
    load() {},
    play() {
      this.paused = false;
      return Promise.resolve();
    }
  };
}

function createPlayerContext(service) {
  const elements = {
    player: createElement("player"),
    message: createElement("message"),
    video: createElement("video")
  };
  const intervals = [];
  const clock = { milliseconds: 0 };

  const document = {
    body: { dataset: { service } },
    head: createElement("head"),
    createElement,
    getElementById(id) {
      return elements[id] ?? null;
    }
  };

  const context = vm.createContext({
    console,
    document,
    location: {
      search: "?cinema_test=1",
      hostname: "cinemamod-player.pages.dev"
    },
    performance: {
      now() {
        return clock.milliseconds;
      }
    },
    URLSearchParams,
    Number,
    String,
    Boolean,
    Math,
    Date,
    Promise,
    setTimeout,
    clearTimeout,
    setInterval(callback) {
      intervals.push(callback);
      return intervals.length;
    },
    clearInterval() {},
    window: null
  });
  context.window = context;
  vm.runInContext(source, context, { filename: "player.js" });

  return {
    context,
    elements,
    intervals,
    clock,
    advance(milliseconds) {
      clock.milliseconds += milliseconds;
    }
  };
}

function assertApi(context) {
  for (const name of ["th_video", "th_volume", "th_seek", "__cinemaDebug"]) {
    assert.equal(typeof context[name], "function", `${name} must be global`);
  }
}

async function testYouTube() {
  const test = createPlayerContext("youtube");
  assertApi(test.context);

  test.context.th_volume(35);
  test.context.th_video("M7lc1UVf-VE", false);
  test.context.th_seek(120);
  test.advance(80);
  await new Promise(resolve => setTimeout(resolve, 120));

  let debug = test.context.__cinemaDebug();
  assert.equal(debug.ready, true);
  assert.equal(debug.volumePercent, 35);
  assert.equal(debug.live, false);
  assert.equal(debug.error, null);
  assert.ok(Math.abs(debug.currentTime - debug.targetTime) < 0.25);

  test.advance(5000);
  test.intervals.forEach(callback => callback());
  debug = test.context.__cinemaDebug();
  assert.ok(
    Math.abs(debug.currentTime - debug.targetTime) < 0.01,
    "periodic drift correction must catch up"
  );
  return debug;
}

async function testTwitch() {
  const test = createPlayerContext("twitch");
  assertApi(test.context);

  test.context.th_volume(42);
  test.context.th_video("v123456", false);
  test.context.th_seek(75);
  test.advance(80);
  await new Promise(resolve => setTimeout(resolve, 120));

  const debug = test.context.__cinemaDebug();
  assert.equal(debug.ready, true);
  assert.equal(debug.volumePercent, 42);
  assert.equal(debug.live, false);
  assert.equal(debug.error, null);
  assert.ok(Math.abs(debug.currentTime - debug.targetTime) < 0.25);
  return debug;
}

async function testMedia(service) {
  const test = createPlayerContext(service);
  assertApi(test.context);

  test.context.th_volume(27);
  test.context.th_seek(33);
  test.context.th_video("https://media.example/video.mp4", false);
  test.elements.video.readyState = 1;
  test.advance(50);
  test.elements.video.dispatch("loadedmetadata");
  await Promise.resolve();

  const debug = test.context.__cinemaDebug();
  assert.equal(debug.ready, true);
  assert.equal(debug.volumePercent, 27);
  assert.equal(test.elements.video.volume, 0.27);
  assert.ok(Math.abs(debug.currentTime - debug.targetTime) < 0.01);
  assert.equal(debug.error, null);
  return debug;
}

async function testTwoClientSync() {
  const first = createPlayerContext("youtube");
  const second = createPlayerContext("youtube");

  first.context.th_video("M7lc1UVf-VE", false);
  first.context.th_seek(100);
  first.advance(1450);
  await new Promise(resolve => setTimeout(resolve, 80));

  second.advance(1450);
  second.context.th_video("M7lc1UVf-VE", false);
  second.context.th_seek(101);
  await new Promise(resolve => setTimeout(resolve, 80));

  const firstDebug = first.context.__cinemaDebug();
  const secondDebug = second.context.__cinemaDebug();
  const difference = Math.abs(firstDebug.targetTime - secondDebug.targetTime);
  assert.ok(
    difference <= 0.55,
    `two-client target difference was ${difference.toFixed(3)} seconds`
  );
  return { difference, first: firstDebug, second: secondDebug };
}

const results = {
  youtube: await testYouTube(),
  twitch: await testTwitch(),
  file: await testMedia("file"),
  hls: await testMedia("hls"),
  sync: await testTwoClientSync()
};

console.log(JSON.stringify({ passed: true, results }, null, 2));
