module.exports = function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy("src/css");
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

  eleventyConfig.addFilter("readableDate", function (date) {
    const d = new Date(date);
    return d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }).toLowerCase();
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
