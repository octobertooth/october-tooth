const fs = require("node:fs");
const path = require("node:path");

module.exports = function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy("src/css");
  eleventyConfig.addPassthroughCopy("src/js");
  eleventyConfig.addPassthroughCopy("src/fonts");
  eleventyConfig.addPassthroughCopy("src/images");
  eleventyConfig.addPassthroughCopy("src/media");

  // "tapes" collection, sorted newest first, each item knows its neighbors
  eleventyConfig.addCollection("tapes", function (collectionApi) {
    return collectionApi.getFilteredByGlob("src/tapes/*.md").sort((a, b) => {
      return (b.data.tapeNumber || 0) - (a.data.tapeNumber || 0);
    });
  });

  // renders the prev/next row for a tape page, given collections.tapes + this tape's number
  eleventyConfig.addShortcode("tapeNav", function (tapes, currentNumber) {
    const idx = tapes.findIndex((t) => t.data.tapeNumber === currentNumber);
    const older = tapes[idx + 1]; // next in array = lower number = older
    const newer = tapes[idx - 1]; // prev in array = higher number = newer
    const left = older
      ? `<a class="pager-key" href="/tapes/${older.data.slug}/"><span aria-hidden="true">&#8592;</span> tape ${String(older.data.tapeNumber).padStart(3, "0")}</a>`
      : `<span class="pager-key is-off" aria-hidden="true"><span>&#8592;</span> tape 000</span>`;
    const right = newer
      ? `<a class="pager-key" href="/tapes/${newer.data.slug}/">tape ${String(newer.data.tapeNumber).padStart(3, "0")} <span aria-hidden="true">&#8594;</span></a>`
      : `<span class="pager-key is-off" aria-hidden="true">newest tape</span>`;
    return `${left}${right}`;
  });

  eleventyConfig.addFilter("pad2", function (n) {
    return String(n).padStart(2, "0");
  });

  eleventyConfig.addFilter("pad3", function (n) {
    return String(n).padStart(3, "0");
  });

  // first n items — used by the archive hover panel in the masthead
  eleventyConfig.addFilter("limit", function (list, n) {
    return Array.isArray(list) ? list.slice(0, n) : list;
  });

  // notes and per-item captions are plain text in the front matter, and often
  // run to several paragraphs. blank lines become paragraphs; everything is
  // escaped, so a stray < or & in a note can't break the page.
  eleventyConfig.addFilter("prose", function (text) {
    if (!text) return "";
    const escape = (s) =>
      String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return String(text)
      .trim()
      .split(/\n\s*\n/)
      .map((para) => `<p>${escape(para.trim()).replace(/\s*\n\s*/g, " ")}</p>`)
      .join("\n");
  });

  eleventyConfig.addFilter("readableDate", function (date) {
    const d = new Date(date);
    return d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }).toLowerCase();
  });

  // "2:14" -> 134 seconds, so the deck knows a track length before the file loads
  eleventyConfig.addFilter("seconds", function (stamp) {
    if (!stamp) return "";
    const parts = String(stamp).split(":").map(Number);
    if (parts.some(isNaN)) return "";
    return parts.reduce((total, part) => total * 60 + part, 0);
  });

  // media entries may be a bare filename (living beside the tape) or a full path
  eleventyConfig.addFilter("mediaSrc", function (src, slug) {
    if (!src) return "";
    return src.startsWith("/") || src.startsWith("http") ? src : `/images/tapes/${slug}/${src}`;
  });

  // audio works the same way, but out of src/media/<slug>/ so big files stay
  // out of the image folder: "track-01.mp3" -> "/media/tape-004/track-01.mp3"
  eleventyConfig.addFilter("audioSrc", function (src, slug) {
    if (!src) return "";
    return src.startsWith("/") || src.startsWith("http") ? src : `/media/${slug}/${src}`;
  });

  /* ---------- real image proportions ----------
     photos and paintings are printed at their own shape, so the page needs to
     know that shape at build time: it sets the width/height attributes (no
     layout shift while loading) and the --ar custom property the stylesheet
     uses to cap a tall image without cropping it. png / jpeg / gif / webp
     headers are read straight off disk — no image library involved. */

  const dimCache = new Map();

  function readDims(sitePath) {
    if (!sitePath || /^https?:/i.test(sitePath)) return null;
    if (dimCache.has(sitePath)) return dimCache.get(sitePath);

    let dims = null;
    try {
      const file = path.join(__dirname, "src", sitePath.replace(/^\//, ""));
      const buf = fs.readFileSync(file);

      if (/\.svg$/i.test(file)) {
        const head = buf.toString("utf8", 0, 2000);
        const box = head.match(/viewBox\s*=\s*["']\s*[-\d.]+[ ,]+[-\d.]+[ ,]+([\d.]+)[ ,]+([\d.]+)/i);
        if (box) dims = { w: Number(box[1]), h: Number(box[2]) };
      } else if (buf.length > 24 && buf.toString("ascii", 1, 4) === "PNG") {
        dims = { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
      } else if (buf[0] === 0xff && buf[1] === 0xd8) {
        // jpeg: walk the segment chain to the start-of-frame marker
        let i = 2;
        while (i + 9 < buf.length) {
          if (buf[i] !== 0xff) {
            i++;
            continue;
          }
          const marker = buf[i + 1];
          const size = buf.readUInt16BE(i + 2);
          if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
            dims = { w: buf.readUInt16BE(i + 7), h: buf.readUInt16BE(i + 5) };
            break;
          }
          i += 2 + size;
        }
      } else if (buf.length > 10 && buf.toString("ascii", 0, 3) === "GIF") {
        dims = { w: buf.readUInt16LE(6), h: buf.readUInt16LE(8) };
      } else if (buf.length > 30 && buf.toString("ascii", 8, 12) === "WEBP") {
        const chunk = buf.toString("ascii", 12, 16);
        if (chunk === "VP8X") {
          dims = {
            w: 1 + (buf.readUIntLE(24, 3) & 0xffffff),
            h: 1 + (buf.readUIntLE(27, 3) & 0xffffff),
          };
        } else if (chunk === "VP8 ") {
          dims = { w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff };
        }
      }
    } catch (err) {
      dims = null; // missing or unreadable file — the page falls back to full width
    }

    if (dims && !(dims.w > 0 && dims.h > 0)) dims = null;
    dimCache.set(sitePath, dims);
    return dims;
  }

  // "0.667" for a portrait photo, "" when the shape can't be read
  eleventyConfig.addFilter("aspect", function (sitePath) {
    const dims = readDims(sitePath);
    return dims ? String(Math.round((dims.w / dims.h) * 1e4) / 1e4) : "";
  });

  eleventyConfig.addFilter("pixelWidth", function (sitePath) {
    const dims = readDims(sitePath);
    return dims ? dims.w : "";
  });

  eleventyConfig.addFilter("pixelHeight", function (sitePath) {
    const dims = readDims(sitePath);
    return dims ? dims.h : "";
  });

  // netlify image cdn — resize + format-negotiate on the edge. svgs pass straight through.
  const transformable = (src) => Boolean(src) && !/\.svg(\?|$)/i.test(src) && !src.startsWith("http");
  const cdnUrl = (src, width, quality) =>
    `/.netlify/images?url=${encodeURIComponent(src)}&w=${width}&q=${quality || 74}`;

  eleventyConfig.addFilter("cdn", function (src, width, quality) {
    return transformable(src) ? cdnUrl(src, width, quality) : src;
  });

  eleventyConfig.addFilter("cdnSet", function (src, widths) {
    if (!transformable(src)) return "";
    return widths.map((w) => `${cdnUrl(src, w)} ${w}w`).join(", ");
  });

  /* ---------- embeds ----------
     a media entry of type "embed" carries the ordinary share url you copied out
     of spotify / youtube / vimeo / apple music / soundcloud. this turns that url
     into the player url the service actually allows in an iframe, plus the shape
     the player wants to be. anything unrecognised comes back empty, and the
     template falls back to a plain link rather than an empty frame. */

  const players = [
    {
      // spotify: /playlist/<id>, /album/<id>, /track/<id>, /episode/<id> ...
      test: /open\.spotify\.com\/(?:intl-[a-z-]{2,7}\/)?(track|album|playlist|artist|episode|show)\/([A-Za-z0-9]+)/i,
      build: ([, kind, id]) => ({
        src: `https://open.spotify.com/embed/${kind.toLowerCase()}/${id}`,
        height: /^(track)$/i.test(kind) ? 152 : /^(episode|show)$/i.test(kind) ? 232 : 380,
      }),
    },
    {
      // youtube playlist — has to be checked before the single-video patterns
      test: /(?:youtube\.com|youtu\.be)\/.*[?&]list=([A-Za-z0-9_-]+)/i,
      build: ([, id]) => ({ src: `https://www.youtube-nocookie.com/embed/videoseries?list=${id}`, ratio: "16 / 9" }),
    },
    {
      // youtube video: watch?v=, youtu.be/, /shorts/, /embed/, /live/
      test: /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([A-Za-z0-9_-]{6,})/i,
      build: ([, id]) => ({ src: `https://www.youtube-nocookie.com/embed/${id}`, ratio: "16 / 9" }),
    },
    {
      test: /vimeo\.com\/(?:video\/)?(\d+)/i,
      build: ([, id]) => ({ src: `https://player.vimeo.com/video/${id}`, ratio: "16 / 9" }),
    },
    {
      // apple music: the embed host mirrors the whole public path
      test: /music\.apple\.com\/(.+)$/i,
      build: ([, rest], url) => ({
        src: `https://embed.music.apple.com/${rest}`,
        height: /[?&]i=/.test(url) ? 175 : 450,
      }),
    },
    {
      // soundcloud resolves the share url server-side, so it gets passed whole
      test: /soundcloud\.com\/[^/]+/i,
      build: (_m, url) => ({
        src:
          "https://w.soundcloud.com/player/?url=" +
          encodeURIComponent(url) +
          "&color=%23101010&auto_play=false&hide_related=true&show_comments=false&show_teaser=false",
        height: /\/sets\//i.test(url) ? 320 : 166,
      }),
    },
  ];

  eleventyConfig.addFilter("embedInfo", function (item) {
    if (!item) return {};

    // an explicit embedUrl skips detection entirely — for anything not listed above
    if (item.embedUrl) {
      return {
        src: item.embedUrl,
        height: Number(item.height) || 0,
        ratio: item.ratio || (item.height ? "" : "16 / 9"),
      };
    }

    const url = String(item.url || "").trim();
    if (!/^https?:\/\//i.test(url)) return {};

    for (const player of players) {
      const match = url.match(player.test);
      if (match) {
        const built = player.build(match, url);
        return {
          src: built.src,
          height: Number(item.height) || built.height || 0,
          ratio: item.ratio || built.ratio || "",
        };
      }
    }
    return {};
  });

  return {
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes",
      data: "_data",
    },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
  };
};
