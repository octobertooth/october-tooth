module.exports = function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy("src/css");
  eleventyConfig.addPassthroughCopy("src/js");
  eleventyConfig.addPassthroughCopy("src/admin");
  eleventyConfig.addPassthroughCopy("src/images");

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
      ? `<a href="/tapes/${older.data.slug}/">← ${String(older.data.tapeNumber).padStart(3, "0")}</a>`
      : "<span></span>";
    const right = newer
      ? `<a href="/tapes/${newer.data.slug}/">${String(newer.data.tapeNumber).padStart(3, "0")} →</a>`
      : "";
    return `${left}${right}`;
  });

  eleventyConfig.addFilter("pad2", function (n) {
    return String(n).padStart(2, "0");
  });

  eleventyConfig.addFilter("pad3", function (n) {
    return String(n).padStart(3, "0");
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
