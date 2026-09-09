/* october tooth — 424 mkIII transport
   play / stop / pause / rewind / fast forward, a running counter, spinning hubs
   and l/r meters taken off the real audio when there is audio to take them off. */
(function () {
  "use strict";

  var deck = document.querySelector("[data-deck]");
  if (!deck) return;

  var audio = document.getElementById("player");
  var rows = Array.prototype.slice.call(deck.querySelectorAll("[data-track]"));
  if (!audio || !rows.length) return;

  var cassette = deck.querySelector("[data-cassette]");
  var counterEl = deck.querySelector("[data-counter]");
  var totalEl = deck.querySelector("[data-total]");
  var cassTitle = deck.querySelector("[data-cass-title]");
  var packL = deck.querySelector('[data-pack="l"]');
  var packR = deck.querySelector('[data-pack="r"]');
  var sticker = deck.querySelector("[data-sticker]");
  var stickerName = deck.querySelector("[data-sticker-track]");
  var levelInput = deck.querySelector("[data-level]");
  var pitchInput = deck.querySelector("[data-pitch]");
  var bars = {
    l: deck.querySelector('[data-meter="l"] .meter-bar'),
    r: deck.querySelector('[data-meter="r"] .meter-bar')
  };
  var lamp = {
    play: deck.querySelector('[data-lamp="play"]'),
    pause: deck.querySelector('[data-lamp="pause"]'),
    demo: deck.querySelector('[data-lamp="demo"]')
  };
  var keys = {};
  Array.prototype.forEach.call(deck.querySelectorAll("[data-act]"), function (btn) {
    keys[btn.getAttribute("data-act")] = btn;
  });

  var SCRUB_RATE = 7; // times playback speed while rew / f fwd is held
  var TAP_SECONDS = 10; // a tap, rather than a hold, jumps this far
  var TAP_MS = 240;

  var idx = -1;
  var mode = "stop"; // stop | play | pause
  var scrub = 0; // -1 rewinding, 1 fast forwarding
  var demo = false; // no decodable file: run the mechanism against the printed duration
  var pos = 0;
  var dur = 0;
  var rate = 1;
  var frame = null;
  var lastFrame = 0;
  var shownSecond = -1;
  var lvl = { l: 0, r: 0 };
  var packState = { l: -1, r: -1 };

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

  /* ---------- meters ---------- */

  var actx = null;
  var anL = null;
  var anR = null;
  var bufL = null;
  var bufR = null;

  function openAudioGraph() {
    if (actx || demo) return;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      actx = new AC();
      var source = actx.createMediaElementSource(audio);
      var splitter = actx.createChannelSplitter(2);
      anL = actx.createAnalyser();
      anR = actx.createAnalyser();
      anL.fftSize = 512;
      anR.fftSize = 512;
      source.connect(splitter);
      splitter.connect(anL, 0);
      splitter.connect(anR, 1);
      source.connect(actx.destination);
      bufL = new Uint8Array(anL.fftSize);
      bufR = new Uint8Array(anR.fftSize);
    } catch (err) {
      actx = null;
      anL = null;
      anR = null;
    }
  }

  function rms(analyser, buf) {
    analyser.getByteTimeDomainData(buf);
    var sum = 0;
    for (var i = 0; i < buf.length; i++) {
      var v = (buf[i] - 128) / 128;
      sum += v * v;
    }
    return Math.min(1, Math.sqrt(sum / buf.length) * 3.2);
  }

  function paintMeters() {
    var tl = 0;
    var tr = 0;
    if (anL && !demo && mode === "play" && !scrub) {
      tl = rms(anL, bufL);
      tr = rms(anR, bufR);
    } else if (mode === "play" || scrub) {
      // nothing to measure — a slow needle drift so the deck reads as running
      var s = performance.now() / 1000;
      tl = 0.44 + 0.18 * Math.sin(s * 5.1) + 0.1 * Math.sin(s * 11.3);
      tr = 0.41 + 0.19 * Math.sin(s * 4.3 + 1) + 0.09 * Math.sin(s * 9.7);
      if (scrub) {
        tl *= 0.3;
        tr *= 0.3;
      }
    }
    ["l", "r"].forEach(function (side) {
      var target = side === "l" ? tl : tr;
      var ease = target > lvl[side] ? 0.55 : 0.12; // fast attack, slow release
      lvl[side] += (target - lvl[side]) * ease;
      if (bars[side]) bars[side].style.setProperty("--lvl", lvl[side].toFixed(3));
    });
  }

  /* ---------- painting ---------- */

  function paintReels() {
    if (!cassette) return;
    cassette.classList.toggle("is-moving", mode === "play" || scrub !== 0);
    cassette.classList.toggle("is-fast", scrub !== 0);
    cassette.classList.toggle("is-back", scrub === -1);
  }

  function paint() {
    var second = Math.round(pos);
    if (second !== shownSecond) {
      shownSecond = second;
      if (counterEl) counterEl.textContent = fmt(pos);
    }
    if (totalEl) totalEl.textContent = "/ " + fmt(dur);

    var p = dur > 0 ? Math.max(0, Math.min(1, pos / dur)) : 0;
    var left = 1 - 0.42 * p;
    var right = 0.58 + 0.42 * p;
    if (packL && Math.abs(left - packState.l) > 0.008) {
      packState.l = left;
      packL.style.setProperty("--pack", left.toFixed(3));
    }
    if (packR && Math.abs(right - packState.r) > 0.008) {
      packState.r = right;
      packR.style.setProperty("--pack", right.toFixed(3));
    }
  }

  function paintKeys() {
    if (keys.play) keys.play.classList.toggle("is-down", mode === "play");
    if (keys.pause) keys.pause.classList.toggle("is-down", mode === "pause");
    if (keys.stop) keys.stop.classList.toggle("is-down", mode === "stop" && !scrub);
    if (lamp.play) lamp.play.classList.toggle("is-on", mode === "play");
    if (lamp.pause) lamp.pause.classList.toggle("is-on", mode === "pause");
    deck.classList.toggle("is-playing", mode === "play");
    if (sticker) sticker.classList.toggle("is-stuck", mode === "play");
  }

  /* ---------- the loop ---------- */

  function tick(now) {
    frame = window.requestAnimationFrame(tick);
    var dt = lastFrame ? Math.min((now - lastFrame) / 1000, 0.25) : 0;
    lastFrame = now;

    if (scrub) {
      pos = clamp(pos + dt * SCRUB_RATE * scrub);
      if (!demo) writeAudioPos();
    } else if (mode === "play") {
      if (demo) {
        pos = pos + dt * rate;
        if (dur > 0 && pos >= dur) return endOfTape();
      } else {
        pos = audio.currentTime;
        if (isFinite(audio.duration) && audio.duration > 0) dur = audio.duration;
      }
    }

    paint();
    paintMeters();
  }

  function runLoop() {
    var wants = mode === "play" || scrub !== 0;
    if (wants && frame === null) {
      lastFrame = 0;
      frame = window.requestAnimationFrame(tick);
    } else if (!wants && frame !== null) {
      window.cancelAnimationFrame(frame);
      frame = null;
      paint();
      paintMeters();
    }
  }

  /* ---------- transport ---------- */

  function writeAudioPos() {
    if (demo) return;
    try {
      var limit = isFinite(audio.duration) && audio.duration > 0 ? audio.duration - 0.05 : pos;
      audio.currentTime = Math.max(0, Math.min(pos, limit));
    } catch (err) {
      /* not seekable yet */
    }
  }

  function goDemo() {
    if (demo) return;
    demo = true;
    if (lamp.demo) {
      lamp.demo.classList.add("is-on");
      lamp.demo.removeAttribute("aria-hidden");
    }
    try {
      audio.pause();
    } catch (err) {
      /* nothing loaded */
    }
  }

  function setMode(next) {
    mode = next;
    if (next !== "play" && !demo) audio.pause();
    paintKeys();
    paintReels();
    runLoop();
    paint();
  }

  function play() {
    if (idx < 0) cue(0, false);
    if (stickerName) stickerName.textContent = trackTitle();
    if (!demo) {
      openAudioGraph();
      if (actx && actx.state === "suspended") actx.resume();
      writeAudioPos();
      var started = audio.play();
      if (started && started.catch) {
        started.catch(function (err) {
          if (err && err.name === "NotAllowedError") {
            setMode("pause");
            return;
          }
          goDemo();
          setMode("play");
        });
      }
    }
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

  function pause() {
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
    });
    if (cassTitle) cassTitle.textContent = trackTitle();
    if (stickerName && mode === "play") stickerName.textContent = trackTitle();

    var src = row.getAttribute("data-src");
    if (src) {
      audio.src = src;
      audio.load();
    } else {
      goDemo();
    }

    if (autoplay) play();
    else setMode("stop");
  }

  /* ---------- wiring ---------- */

  function bindScrub(btn, dir) {
    if (!btn) return;
    var pressAt = 0;
    var pressPos = 0;
    var pressMode = "stop";
    var fromPointer = false;

    function end() {
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      scrub = 0;
      btn.classList.remove("is-down");
      if (Date.now() - pressAt < TAP_MS) pos = clamp(pressPos + dir * TAP_SECONDS);
      writeAudioPos();
      if (pressMode === "play") play();
      else setMode(pressMode);
      // the click that follows this pointerup is ours to swallow; anything later is a keypress
      window.setTimeout(function () {
        fromPointer = false;
      }, 0);
    }

    btn.addEventListener("pointerdown", function (e) {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      e.preventDefault();
      fromPointer = true;
      pressAt = Date.now();
      pressPos = pos;
      pressMode = mode;
      scrub = dir;
      btn.classList.add("is-down");
      if (!demo) audio.pause();
      paintReels();
      runLoop();
      window.addEventListener("pointerup", end);
      window.addEventListener("pointercancel", end);
    });

    // keyboard activation: no press to hold, so a keypress steps the tape
    btn.addEventListener("click", function () {
      if (fromPointer) {
        fromPointer = false;
        return;
      }
      pos = clamp(pos + dir * TAP_SECONDS);
      writeAudioPos();
      paint();
    });
  }

  if (keys.play) keys.play.addEventListener("click", play);
  if (keys.stop) keys.stop.addEventListener("click", stop);
  if (keys.pause) keys.pause.addEventListener("click", pause);
  if (keys.rtz)
    keys.rtz.addEventListener("click", function () {
      pos = 0;
      shownSecond = -1;
      writeAudioPos();
      paint();
    });
  bindScrub(keys.rew, -1);
  bindScrub(keys.ffwd, 1);

  rows.forEach(function (row, i) {
    row.addEventListener("click", function () {
      if (i === idx && mode === "play") {
        pause();
        return;
      }
      cue(i, true);
    });
  });

  audio.addEventListener("loadedmetadata", function () {
    if (isFinite(audio.duration) && audio.duration > 0) {
      dur = audio.duration;
      paint();
    }
  });
  audio.addEventListener("ended", endOfTape);
  audio.addEventListener("error", function () {
    goDemo();
    if (mode === "play") setMode("play");
  });

  if (levelInput) {
    audio.volume = Number(levelInput.value);
    levelInput.addEventListener("input", function () {
      audio.volume = Number(levelInput.value);
    });
  }
  if (pitchInput) {
    var applyPitch = function () {
      var pct = Number(pitchInput.value);
      rate = 1 + pct / 100;
      audio.playbackRate = rate;
      pitchInput.setAttribute("aria-valuetext", (pct > 0 ? "+" : "") + pct + "%");
    };
    pitchInput.addEventListener("input", applyPitch);
    pitchInput.addEventListener("dblclick", function () {
      pitchInput.value = "0";
      applyPitch();
    });
    applyPitch();
  }

  cue(0, false);
})();
