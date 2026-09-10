/* october tooth — transport
   play / pause / stop, a seekable position line, a level line, and a running
   counter. state is reported the way the rest of the site reports state: a
   word and a small dot, filled while the tape runs. no lamps, no meters. */
(function () {
  "use strict";

  var deck = document.querySelector("[data-deck]");
  if (!deck) return;

  var audio = document.getElementById("player");
  var rows = Array.prototype.slice.call(deck.querySelectorAll("[data-track]"));
  if (!audio || !rows.length) return;

  var counterEl = deck.querySelector("[data-counter]");
  var totalEl = deck.querySelector("[data-total]");
  var cueTitle = deck.querySelector("[data-cass-title]");
  var np = deck.querySelector("[data-sticker]");
  var npName = deck.querySelector("[data-sticker-track]");
  var stateWord = deck.querySelector("[data-deck-state]");
  var stateDot = deck.querySelector("[data-state-dot]");
  var flag = deck.querySelector('[data-lamp="demo"]');
  var seekInput = deck.querySelector("[data-seek]");
  var levelInput = deck.querySelector("[data-level]");
  var playLegend = deck.querySelector("[data-play-legend]");

  var keys = {};
  Array.prototype.forEach.call(deck.querySelectorAll("[data-act]"), function (btn) {
    keys[btn.getAttribute("data-act")] = btn;
  });

  var SEEK_STEPS = 1000; // the position line's resolution

  var idx = -1;
  var mode = "stop"; // stop | play | pause
  var demo = false; // no decodable file: run the counter against the printed duration
  // every transport action takes a ticket, so a play request rejected after the
  // next press can be told apart from one that still matters
  var playToken = 0;
  var reloaded = false; // a reload is already spent: the next failure is real
  var reloading = false; // a reload is in flight: leave the counter where it is
  var reloadAt = 0; // where the last reload picked up, so real progress re-arms it
  var pos = 0;
  var dur = 0;
  var frame = null;
  var lastFrame = 0;
  var shownSecond = -1;
  var dragging = false;

  /* ---------- helpers ---------- */

  function fmt(seconds) {
    var s = Math.max(0, Math.round(seconds || 0));
    var m = Math.floor(s / 60);
    s = s % 60;
    return (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
  }

  function clamp(v) {
    if (v < 0) return 0;
    return dur > 0 ? Math.min(v, dur) : v;
  }

  function trackTitle() {
    return idx >= 0 ? rows[idx].getAttribute("data-title") || "" : "";
  }

  function paintLine(input, fraction) {
    if (input) input.style.setProperty("--p", (fraction * 100).toFixed(2) + "%");
  }

  /* ---------- painting ---------- */

  function paint() {
    var second = Math.round(pos);
    if (second !== shownSecond) {
      shownSecond = second;
      if (counterEl) counterEl.textContent = fmt(pos);
    }
    if (totalEl) totalEl.textContent = fmt(dur);

    var p = dur > 0 ? Math.max(0, Math.min(1, pos / dur)) : 0;
    if (seekInput && !dragging) seekInput.value = String(Math.round(p * SEEK_STEPS));
    paintLine(seekInput, p);
  }

  function paintState() {
    var word = mode === "play" ? "playing" : mode === "pause" ? "paused" : "cued";
    if (stateWord) stateWord.textContent = word;
    if (stateDot) {
      stateDot.classList.toggle("is-on", mode === "play");
      stateDot.classList.toggle("is-half", mode === "pause");
    }
    if (playLegend) playLegend.textContent = mode === "play" ? "pause" : "play";
    if (keys.play) {
      keys.play.classList.toggle("is-down", mode === "play");
      keys.play.setAttribute("aria-label", mode === "play" ? "pause" : "play");
    }
    if (keys.stop) keys.stop.classList.toggle("is-down", mode === "stop");
    deck.classList.toggle("is-playing", mode === "play");
    if (np && npName && mode === "play") npName.textContent = trackTitle();
  }

  /* ---------- the loop ---------- */

  function tick(now) {
    frame = window.requestAnimationFrame(tick);
    var dt = lastFrame ? Math.min((now - lastFrame) / 1000, 0.25) : 0;
    lastFrame = now;

    if (mode === "play") {
      if (demo) {
        pos = pos + dt;
        if (dur > 0 && pos >= dur) return endOfTape();
      } else {
        if (!dragging && !reloading) pos = audio.currentTime;
        if (isFinite(audio.duration) && audio.duration > 0) dur = audio.duration;
      }
    }
    paint();
  }

  function runLoop() {
    if (mode === "play" && frame === null) {
      lastFrame = 0;
      frame = window.requestAnimationFrame(tick);
    } else if (mode !== "play" && frame !== null) {
      window.cancelAnimationFrame(frame);
      frame = null;
      paint();
    }
  }

  /* ---------- transport ---------- */

  function writeAudioPos() {
    if (demo) return;
    try {
      var limit = isFinite(audio.duration) && audio.duration > 0 ? audio.duration - 0.05 : pos;
      var target = Math.max(0, Math.min(pos, limit));
      // a seek left pending when play() is called is what makes a browser reject
      // the play request, so don't ask for one we don't need
      if (Math.abs(audio.currentTime - target) < 0.25) return;
      audio.currentTime = target;
    } catch (err) {
      /* not seekable yet */
    }
  }

  function goDemo() {
    if (demo) return;
    demo = true;
    reloading = false;
    if (flag) {
      flag.classList.add("is-on");
      flag.removeAttribute("aria-hidden");
    }
    try {
      audio.pause();
    } catch (err) {
      /* nothing loaded */
    }
  }

  // demo is a fact about the cued track, not about the page: a track with no
  // file must never silence the ones that do have one.
  function leaveDemo() {
    if (!demo) return;
    demo = false;
    if (flag) flag.classList.remove("is-on");
  }

  /* only a genuinely unplayable file should drop the deck into the demo
     counter. a rejected play request with no error on the element — the
     browser aborting a request because of a pending seek or a re-load, a
     dropped range request — is a hiccup, and worth one quiet reload. */
  function fatal(err) {
    if (audio.error) return audio.error.code !== 2; // 2 = network, retryable
    return !!(err && err.name === "NotSupportedError");
  }

  function setMode(next) {
    mode = next;
    if (next !== "play") {
      playToken++; // anything still in flight for the old mode is now stale
      reloading = false;
      if (!demo) audio.pause();
    }
    paintState();
    runLoop();
    paint();
  }

  // reload the cued file from scratch and pick playback back up where it was.
  // used once per cue, after a rejected play request or a dropped connection.
  function reloadAndPlay() {
    var src = idx >= 0 ? rows[idx].getAttribute("data-src") : null;
    if (reloaded || !src) {
      goDemo();
      setMode("play");
      return;
    }
    reloaded = true;
    reloading = true;
    var resume = pos;
    reloadAt = resume;
    var onReady = function () {
      audio.removeEventListener("loadeddata", onReady);
      reloading = false;
      if (mode !== "play") return;
      pos = resume;
      attemptPlay();
    };
    audio.addEventListener("loadeddata", onReady);
    audio.src = src;
    audio.load();
  }

  function attemptPlay() {
    writeAudioPos();
    var token = ++playToken;
    var started = audio.play();
    if (!started || !started.catch) return;
    started.catch(function (err) {
      // superseded by a later press, or we're no longer meant to be running
      if (token !== playToken || mode !== "play") return;
      if (err && err.name === "NotAllowedError") {
        setMode("pause");
        return;
      }
      if (!fatal(err)) {
        reloadAndPlay();
        return;
      }
      goDemo();
      setMode("play");
    });
  }

  function play() {
    if (idx < 0) cue(0, false);
    if (!demo) attemptPlay();
    setMode("play");
  }

  function stop() {
    pos = 0;
    shownSecond = -1;
    if (!demo) {
      audio.pause();
      writeAudioPos();
    }
    setMode("stop");
  }

  function toggle() {
    if (mode === "play") setMode("pause");
    else play();
  }

  function endOfTape() {
    if (idx + 1 < rows.length) {
      cue(idx + 1, true);
    } else {
      cue(0, false);
      stop();
    }
  }

  function cue(i, autoplay) {
    idx = i;
    var row = rows[i];
    pos = 0;
    shownSecond = -1;
    dur = Number(row.getAttribute("data-seconds")) || 0;
    rows.forEach(function (r) {
      var on = r === row;
      r.classList.toggle("is-cued", on);
      r.setAttribute("aria-pressed", on ? "true" : "false");
      var dot = r.querySelector(".dot");
      if (dot) dot.classList.toggle("is-on", on);
    });
    if (cueTitle) cueTitle.textContent = trackTitle();
    if (npName && mode === "play") npName.textContent = trackTitle();

    var src = row.getAttribute("data-src");
    reloaded = false;
    reloading = false;
    playToken++;
    if (src) {
      leaveDemo();
      // re-cueing the track that is already loaded keeps everything the browser
      // has already downloaded; re-loading it would throw the buffer away
      if (audio.getAttribute("src") !== src) {
        audio.src = src;
        audio.load();
      }
    } else {
      goDemo();
    }

    if (autoplay) play();
    else setMode("stop");
  }

  /* ---------- wiring ---------- */

  if (keys.play) keys.play.addEventListener("click", toggle);
  if (keys.stop) keys.stop.addEventListener("click", stop);

  rows.forEach(function (row, i) {
    row.addEventListener("click", function () {
      if (i === idx && mode === "play") {
        toggle();
        return;
      }
      cue(i, true);
    });
  });

  if (seekInput) {
    var seekTo = function () {
      var fraction = Number(seekInput.value) / SEEK_STEPS;
      pos = clamp(dur > 0 ? fraction * dur : 0);
      shownSecond = -1;
      paintLine(seekInput, fraction);
      if (counterEl) counterEl.textContent = fmt(pos);
    };
    seekInput.addEventListener("pointerdown", function () {
      dragging = true;
    });
    seekInput.addEventListener("input", seekTo);
    seekInput.addEventListener("change", function () {
      dragging = false;
      seekTo();
      writeAudioPos();
    });
    window.addEventListener("pointerup", function () {
      if (!dragging) return;
      dragging = false;
      writeAudioPos();
    });
  }

  if (levelInput) {
    var applyLevel = function () {
      var v = Number(levelInput.value);
      audio.volume = v;
      paintLine(levelInput, v);
    };
    levelInput.addEventListener("input", applyLevel);
    applyLevel();
  }

  audio.addEventListener("loadedmetadata", function () {
    if (isFinite(audio.duration) && audio.duration > 0) {
      dur = audio.duration;
      paint();
    }
  });
  audio.addEventListener("timeupdate", function () {
    if (reloaded && !reloading && audio.currentTime > reloadAt + 3) reloaded = false;
  });

  audio.addEventListener("ended", endOfTape);

  audio.addEventListener("error", function () {
    if (!fatal(null) && mode === "play") {
      reloadAndPlay(); // connection dropped mid-tape
      return;
    }
    goDemo();
    if (mode === "play") setMode("play");
  });

  // the file turned out to be playable after all — come back out of the counter
  audio.addEventListener("canplay", function () {
    if (!demo || audio.error) return;
    if (idx < 0 || !rows[idx].getAttribute("data-src")) return;
    leaveDemo();
    if (isFinite(audio.duration) && audio.duration > 0) dur = audio.duration;
    if (mode === "play") attemptPlay();
    paint();
  });

  cue(0, false);
})();
