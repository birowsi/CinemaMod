// CinemaMod player-host restoration for this fork by @birowsi.

(function () {
  "use strict";

  var service = document.body.dataset.service;
  var testMode = new URLSearchParams(location.search).has("cinema_test");
  var DRIFT_CHECK_MS = 5000;
  var DRIFT_LIMIT_SECONDS = 1.25;
  var volumePercent = 100;
  var live = false;
  var anchor = null;
  var player = null;
  var hls = null;
  var ready = false;
  var lastError = null;

  function now() {
    return performance.now();
  }

  function clamp(value, minimum, maximum) {
    var number = Number(value);
    if (!Number.isFinite(number)) {
      number = 0;
    }
    return Math.max(minimum, Math.min(maximum, number));
  }

  function setAnchor(seconds) {
    anchor = {
      seconds: clamp(seconds, 0, Number.MAX_SAFE_INTEGER),
      requestedAt: now()
    };
  }

  function targetTime() {
    if (!anchor) {
      return 0;
    }
    return anchor.seconds + (now() - anchor.requestedAt) / 1000;
  }

  function showError(text) {
    lastError = String(text);
    var message = document.getElementById("message");
    if (message) {
      message.textContent = lastError;
      message.style.display = "flex";
    }
  }

  function clearError() {
    lastError = null;
    var message = document.getElementById("message");
    if (message) {
      message.style.display = "none";
    }
  }

  function loadScript(source, onError) {
    var script = document.createElement("script");
    script.src = source;
    script.async = true;
    script.onerror = function () {
      showError(onError);
    };
    document.head.appendChild(script);
  }

  function youtubeAdapter() {
    var pendingId = null;
    var apiReady = false;

    function applyVolume() {
      if (player && typeof player.setVolume === "function") {
        player.setVolume(volumePercent);
      }
    }

    function seekToAnchor(force) {
      if (!player || live || !anchor || typeof player.seekTo !== "function") {
        return;
      }
      var target = targetTime();
      var current = typeof player.getCurrentTime === "function"
        ? Number(player.getCurrentTime())
        : NaN;
      if (force || !Number.isFinite(current) || Math.abs(current - target) > DRIFT_LIMIT_SECONDS) {
        player.seekTo(target, true);
      }
    }

    function onReady(event) {
      ready = true;
      player = event.target;
      applyVolume();
      seekToAnchor(true);
      if (typeof player.playVideo === "function") {
        player.playVideo();
      }
    }

    function createOrLoad() {
      if (!apiReady || !pendingId) {
        return;
      }

      var id = pendingId;
      pendingId = null;
      clearError();

      if (player && typeof player.loadVideoById === "function") {
        player.loadVideoById({
          videoId: id,
          startSeconds: live || !anchor ? 0 : targetTime()
        });
        applyVolume();
        seekToAnchor(true);
        if (typeof player.playVideo === "function") {
          player.playVideo();
        }
        return;
      }

      player = new YT.Player("player", {
        width: "100%",
        height: "100%",
        videoId: id,
        playerVars: {
          autoplay: 1,
          hl: "ja",
          controls: 0,
          disablekb: 1,
          fs: 0,
          iv_load_policy: 3,
          playsinline: 1,
          rel: 0,
          start: live || !anchor ? 0 : Math.floor(targetTime())
        },
        events: {
          onReady: onReady,
          onError: function (event) {
            showError("CinemaMod YouTube playback error: " + event.data);
          },
          onAutoplayBlocked: function () {
            showError("CinemaMod YouTube autoplay was blocked.");
          }
        }
      });
    }

    window.onYouTubeIframeAPIReady = function () {
      apiReady = true;
      createOrLoad();
    };

    window.th_video = function (id, isLive) {
      live = Boolean(isLive);
      pendingId = String(id);
      createOrLoad();
    };

    window.th_volume = function (value) {
      volumePercent = clamp(value, 0, 100);
      applyVolume();
    };

    window.th_seek = function (seconds) {
      if (live) {
        return;
      }
      setAnchor(seconds);
      seekToAnchor(true);
    };

    setInterval(function () {
      if (ready && !live && anchor) {
        seekToAnchor(false);
      }
    }, DRIFT_CHECK_MS);

    if (testMode) {
      installYouTubeMock();
    } else {
      loadScript(
        "https://www.youtube.com/iframe_api",
        "CinemaMod could not load the YouTube Player API."
      );
    }
  }

  function twitchAdapter() {
    var pendingId = null;
    var apiReady = false;

    function applyVolume() {
      if (player && typeof player.setVolume === "function") {
        player.setVolume(volumePercent / 100);
      }
    }

    function seekToAnchor(force) {
      if (!player || live || !anchor || typeof player.seek !== "function") {
        return;
      }
      var target = targetTime();
      var current = typeof player.getCurrentTime === "function"
        ? Number(player.getCurrentTime())
        : NaN;
      if (force || !Number.isFinite(current) || Math.abs(current - target) > DRIFT_LIMIT_SECONDS) {
        player.seek(target);
      }
    }

    function createOrLoad() {
      if (!apiReady || !pendingId) {
        return;
      }

      var id = pendingId;
      pendingId = null;
      clearError();

      if (player) {
        if (live && typeof player.setChannel === "function") {
          player.setChannel(id);
        } else if (!live && typeof player.setVideo === "function") {
          player.setVideo(id.startsWith("v") ? id : "v" + id, targetTime());
        }
        applyVolume();
        return;
      }

      var options = {
        width: "100%",
        height: "100%",
        autoplay: true,
        muted: false,
        parent: [location.hostname]
      };
      if (live) {
        options.channel = id;
      } else {
        options.video = id.startsWith("v") ? id : "v" + id;
        options.time = Math.floor(targetTime()) + "s";
      }

      player = new Twitch.Player("player", options);
      player.addEventListener(Twitch.Player.READY, function () {
        ready = true;
        applyVolume();
        seekToAnchor(true);
        if (typeof player.play === "function") {
          player.play();
        }
      });
      player.addEventListener(Twitch.Player.PLAYBACK_BLOCKED, function () {
        showError("CinemaMod Twitch autoplay was blocked.");
      });
    }

    window.th_video = function (id, isLive) {
      live = isLive === undefined ? true : Boolean(isLive);
      pendingId = String(id).replace(/[^A-Za-z0-9_]/g, "");
      createOrLoad();
    };

    window.th_volume = function (value) {
      volumePercent = clamp(value, 0, 100);
      applyVolume();
    };

    window.th_seek = function (seconds) {
      if (live) {
        return;
      }
      setAnchor(seconds);
      seekToAnchor(true);
    };

    setInterval(function () {
      if (ready && !live && anchor) {
        seekToAnchor(false);
      }
    }, DRIFT_CHECK_MS);

    window.__twitchApiReady = function () {
      apiReady = true;
      createOrLoad();
    };

    if (testMode) {
      installTwitchMock();
    } else {
      loadScript(
        "https://player.twitch.tv/js/embed/v1.js",
        "CinemaMod could not load the Twitch Player API."
      );
      var twitchWait = setInterval(function () {
        if (window.Twitch && window.Twitch.Player) {
          clearInterval(twitchWait);
          apiReady = true;
          createOrLoad();
        }
      }, 25);
    }
  }

  function mediaAdapter(preferHls) {
    var video = document.getElementById("video");
    var pendingUrl = null;

    function applyVolume() {
      video.volume = volumePercent / 100;
    }

    function seekToAnchor(force) {
      if (live || !anchor || video.readyState < 1) {
        return;
      }
      var target = targetTime();
      var current = Number(video.currentTime);
      if (force || !Number.isFinite(current) || Math.abs(current - target) > DRIFT_LIMIT_SECONDS) {
        try {
          video.currentTime = target;
        } catch (_) {
          // loadedmetadata will retry.
        }
      }
    }

    function beginPlayback() {
      ready = true;
      applyVolume();
      seekToAnchor(true);
      var play = video.play();
      if (play && typeof play.catch === "function") {
        play.catch(function () {
          showError("CinemaMod media autoplay was blocked.");
        });
      }
    }

    function playUrl(url) {
      pendingUrl = String(url);
      clearError();
      ready = false;
      if (hls) {
        hls.destroy();
        hls = null;
      }

      var isHls = preferHls || /\.m3u8(?:$|[?#])/i.test(pendingUrl);
      if (isHls && window.Hls && Hls.isSupported()) {
        hls = new Hls({ enableWorker: true, lowLatencyMode: true });
        hls.loadSource(pendingUrl);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, beginPlayback);
        hls.on(Hls.Events.ERROR, function (_, data) {
          if (data.fatal) {
            showError("CinemaMod HLS playback error: " + data.type);
          }
        });
      } else {
        video.src = pendingUrl;
        video.load();
      }
    }

    window.th_video = function (url, isLive) {
      live = Boolean(isLive);
      playUrl(url);
    };

    window.th_volume = function (value) {
      volumePercent = clamp(value, 0, 100);
      applyVolume();
    };

    window.th_seek = function (seconds) {
      if (live) {
        return;
      }
      setAnchor(seconds);
      seekToAnchor(true);
    };

    video.addEventListener("loadedmetadata", beginPlayback);
    video.addEventListener("error", function () {
      showError("CinemaMod could not play this media file.");
    });
    setInterval(function () {
      if (ready && !live && anchor && !video.paused) {
        seekToAnchor(false);
      }
    }, DRIFT_CHECK_MS);

    if (!testMode) {
      loadScript(
        "https://cdn.jsdelivr.net/npm/hls.js@1/dist/hls.min.js",
        "CinemaMod could not load HLS.js."
      );
    }
  }

  function installYouTubeMock() {
    var mockTime = 0;
    window.YT = {
      Player: function (_, options) {
        var target = {
          volume: 100,
          videoId: options.videoId,
          playing: false,
          setVolume: function (value) { this.volume = value; },
          playVideo: function () { this.playing = true; },
          seekTo: function (seconds) { mockTime = seconds; },
          getCurrentTime: function () { return mockTime; },
          loadVideoById: function (request) {
            this.videoId = request.videoId;
            mockTime = request.startSeconds || 0;
          }
        };
        setTimeout(function () { options.events.onReady({ target: target }); }, 50);
        return target;
      }
    };
    setTimeout(window.onYouTubeIframeAPIReady, 50);
  }

  function installTwitchMock() {
    var mockTime = 0;
    window.Twitch = {
      Player: function (_, options) {
        var listeners = {};
        var target = {
          options: options,
          volume: 1,
          setVolume: function (value) { this.volume = value; },
          play: function () {},
          seek: function (seconds) { mockTime = seconds; },
          getCurrentTime: function () { return mockTime; },
          setChannel: function (channel) { this.channel = channel; },
          setVideo: function (video, seconds) {
            this.video = video;
            mockTime = seconds || 0;
          },
          addEventListener: function (name, callback) { listeners[name] = callback; }
        };
        setTimeout(function () { listeners.ready && listeners.ready(); }, 50);
        return target;
      }
    };
    window.Twitch.Player.READY = "ready";
    window.Twitch.Player.PLAYBACK_BLOCKED = "blocked";
    window.__twitchApiReady();
  }

  window.__cinemaDebug = function () {
    var currentTime = null;
    if (service === "youtube" && player && typeof player.getCurrentTime === "function") {
      currentTime = player.getCurrentTime();
    } else if (service === "twitch" && player && typeof player.getCurrentTime === "function") {
      currentTime = player.getCurrentTime();
    } else if (service === "file" || service === "hls") {
      currentTime = document.getElementById("video").currentTime;
    }
    return {
      service: service,
      ready: ready,
      live: live,
      volumePercent: volumePercent,
      anchorSeconds: anchor ? anchor.seconds : null,
      targetTime: anchor ? targetTime() : null,
      currentTime: currentTime,
      error: lastError
    };
  };

  if (service === "youtube") {
    youtubeAdapter();
  } else if (service === "twitch") {
    twitchAdapter();
  } else if (service === "file") {
    mediaAdapter(false);
  } else if (service === "hls") {
    mediaAdapter(true);
  } else {
    showError("Unknown CinemaMod video service.");
  }

  if (testMode) {
    var testParams = new URLSearchParams(location.search);
    setTimeout(function () {
      if (testParams.has("volume")) {
        window.th_volume(testParams.get("volume"));
      }
      if (testParams.has("id")) {
        window.th_video(
          testParams.get("id"),
          testParams.get("live") === "1"
        );
      }
      if (testParams.has("startedAt")) {
        window.th_seek(
          Math.max(0, Math.floor((Date.now() - Number(testParams.get("startedAt"))) / 1000))
        );
      } else if (testParams.has("seek")) {
        window.th_seek(testParams.get("seek"));
      }
    }, 10);
  }
})();
