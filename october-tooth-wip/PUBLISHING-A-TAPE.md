# Publishing a tape

Everything you need to put a new practice tape on the site. No prior knowledge
assumed — every folder path, filename and command is written out in full.

If you only want the short version, jump to [The five-minute version](#the-five-minute-version)
at the bottom.

---

## 1. Where things live

The whole site is inside the `october-tooth-wip` folder of the repository. Every
path in this document is relative to that folder, so when you see
`src/tapes/tape-005.md`, the full path from the top of the repository is
`october-tooth-wip/src/tapes/tape-005.md`.

```
october-tooth-wip/
├── PUBLISHING-A-TAPE.md      ← this file
├── package.json              ← lists Eleventy as a dependency
├── eleventy.config.js        ← the site's build rules (you won't need to edit this)
└── src/
    ├── index.njk             ← the homepage
    ├── archive.njk           ← the archive list
    ├── about.njk             ← the about page
    ├── tapes/
    │   └── tape-004.md       ← one file per tape. THIS is what you copy.
    ├── images/
    │   └── tapes/
    │       └── tape-004/     ← one folder per tape, for photos and artwork
    ├── media/                ← audio files go here (see step 4)
    ├── css/main.css
    ├── js/deck.js            ← the cassette deck player
    └── _includes/            ← page templates
```

Two things worth knowing before you start:

- **The newest tape is the homepage.** You do not move anything or edit the
  homepage by hand. The site sorts all tapes by their `tapeNumber` and puts the
  highest one at `/`. The previous newest tape slides down to its own URL and
  into the archive automatically.
- **`src/media/` may not exist yet.** The site is already set up to copy it, but
  the folder itself only appears once someone adds the first audio file. If it
  isn't there, just create it (step 4).

---

## 2. Create the tape file

Each tape is a single Markdown file in `src/tapes/`. The filename sets nothing
on its own, but the convention is `tape-NNN.md` with a three-digit number, so
the next one after `tape-004.md` is:

```
src/tapes/tape-005.md
```

The easiest and safest way to start is to **copy the previous tape file and edit
it**, because it already has every field in the right shape and includes
commented-out examples.

From a terminal, inside the `october-tooth-wip` folder:

```bash
cp src/tapes/tape-004.md src/tapes/tape-005.md
```

Or in a file browser / editor: duplicate `tape-004.md` and rename the copy.

---

## 3. Fill in the front matter

Everything between the two `---` lines at the top of the file is the "front
matter" — the tape's data. Below is the full list of fields. Indentation is
meaningful: it must be **spaces, never tabs**, and lists must keep the exact
indentation shown.

### Required — the tape will be wrong or broken without these

| Field | What it is | Example |
| --- | --- | --- |
| `layout` | Never change this. | `layouts/tape.njk` |
| `permalink` | The tape's URL. Must match the slug and end with a slash. | `/tapes/tape-005/` |
| `title` | The tape's name, shown as the big heading. | `"side b, kitchen table"` |
| `date` | Recording/release date, `YYYY-MM-DD`. Shown on the page and in the archive. | `2026-10-02` |
| `tapeNumber` | A plain number, no quotes, no leading zeros. **This is what decides the order** — the highest number becomes the homepage. | `5` |
| `slug` | Must match the folder name you use for images and audio, and the `permalink`. | `tape-005` |

A minimal, valid tape is just those six fields plus a `tracks` list. Everything
below is optional.

### Optional

| Field | What it does |
| --- | --- |
| `headerImage` | Full path to the wide image at the top of the page, e.g. `"/images/tapes/tape-005/header.jpg"`. Leave it out and the page simply starts at the title. |
| `headerAlt` | Description of the header image for screen readers. Leave as `""` if the image is decorative. |
| `notes` | The writing about the tape, shown under the deck. Use the `|` block style (see `tape-001.md`) and leave a blank line between paragraphs — each one is set as its own paragraph, so this section can be as long as it needs to be. |
| `wavDownload` | Path to a zip of the raw files, e.g. `"/media/tape-005/tape-005.zip"`. Adds a "download wavs" button. |
| `bandcamp` | Full `https://` link. Adds a "bandcamp" button. |
| `soundcloud` | Full `https://` link. Adds a "soundcloud" button. |
| `tracks` | The tracklist, and what the deck plays. See below. |
| `media` | Photos, videos, and embedded playlists shown below the notes. See step 6. |
| `status` | Normally left out. The newest tape is marked **live** in the archive (the filled dot) and every older one **archived** (the hollow dot). Set `status: "archived"` on the newest tape if you want it to read as archived even while it is on the front page. |

### The tracklist

```yaml
tracks:
  - title: "arrangement idea, rough"
    duration: "2:14"
    audio: "track-01.mp3"
  - title: "second pass, tv on mute"
    duration: "1:41"
    audio: "track-02.mp3"
```

- `title` — shown in the tracklist and as the cued track above the clock.
- `duration` — written as `m:ss`. The deck reads this **before** the audio file
  loads, so it should match the real length. It is also what the deck counts
  against if there is no audio file at all.
- `audio` — either a bare filename (the site looks for it in
  `src/media/<slug>/`, so `"track-01.mp3"` on tape-005 resolves to
  `/media/tape-005/track-01.mp3`), a full path starting with `/`, or a full
  `https://` URL to a file hosted elsewhere.

**You can publish a tape with no audio files at all.** If a track has no
playable file, the player prints a small `no file` mark next to the clock and
runs the counter against the printed `duration`. The page looks and behaves
correctly; it just makes no sound. This is useful for putting a tape up before
the mixes are finished.

---

## 4. Add the audio

Audio lives in a folder named after the tape's slug, under `src/media/`:

```
src/media/tape-005/track-01.mp3
src/media/tape-005/track-02.mp3
```

If `src/media/` doesn't exist yet, create it along with the tape folder:

```bash
mkdir -p src/media/tape-005
```

Then copy your files in. A few practical notes:

- **Format:** use `.mp3` or `.m4a` for anything meant to play in the browser.
  `.wav` files work in some browsers and not others, and they are very large.
  Keep the `.wav` masters for the download zip instead.
- **Filenames:** lowercase, no spaces. `track-01.mp3`, not `Track 01.mp3`.
  Spaces and capitals cause links that work on your machine and break once
  deployed.
- **Size:** these files are committed to the repository, so keep an eye on it.
  If a tape's audio runs to hundreds of megabytes, host it on Bandcamp or
  SoundCloud and use an `embed` entry (step 6) instead.

Audio in `src/media/` is copied to the finished site as-is — no processing, no
renaming.

---

## 5. Add the images

Images live in a folder named after the slug, under `src/images/tapes/`:

```
src/images/tapes/tape-005/header.jpg
src/images/tapes/tape-005/cassette-front.png
```

Create it with:

```bash
mkdir -p src/images/tapes/tape-005
```

Same filename rules: lowercase, hyphens instead of spaces.

You do **not** need to resize or optimise anything. Photos are served through
Netlify's Image CDN, which resizes them and converts them to modern formats per
visitor automatically. Upload the full-resolution file and let the site handle
it. (SVG files skip this and are served directly, which is correct for them.)

For the header image, aim for something wide — roughly 1600×600 — since that is
the shape the page reserves for it.

---

## 6. Photos, playlists and videos (the `media` list)

The `media` block is the row of cards below the notes. Entries appear in the
order you write them. There are four kinds.

**A photo or piece of artwork** — the file goes in
`src/images/tapes/tape-005/` and you refer to it by bare filename:

```yaml
media:
  - type: "image"
    src: "cassette-front.png"
    label: "painting"
    alt: "the october cassette, front"
    note: |
      the longer story about this one, if there is one. blank lines make
      new paragraphs here too.
```

`label` is the short caption printed under the image, next to its number.
`alt` is the screen-reader description. `note` is optional: add it and the
caption line becomes clickable, opening the longer text underneath the image.
Leave it out and the item just shows its number and caption.

Photos and paintings are printed at their own proportions — a tall photo stays
tall, a wide one stays wide, and nothing is cropped or stretched to match its
neighbours. There is no `ratio` to set on an image; very tall images are simply
capped at roughly a screen-height so they don't run away down the page.

**An embedded playlist or video** — paste the ordinary share URL you copied out
of the app. Spotify, YouTube, Vimeo, Apple Music and SoundCloud are recognised
and turned into working players automatically. You do not need embed codes or
iframe snippets:

```yaml
  - type: "embed"
    url: "https://open.spotify.com/playlist/3IrXejj8iOObPS7zpgR2ju"
    label: "playlist"
```

If a URL isn't recognised, the site quietly falls back to a plain text link
rather than showing an empty box — so a mistake here is never ugly.

**A video file kept in this repository** — drop it in
`src/images/tapes/tape-005/` alongside the photos:

```yaml
  - type: "video"
    src: "practice-room.mp4"
    poster: "practice-room-poster.jpg"
    label: "practice room, tape 005"
    ratio: "16 / 9"
```

`ratio` still applies to video and to embeds, where it sets the frame's shape
before the file loads. `label` and `note` work on video and embeds exactly as
they do on images.

**A plain link out:**

```yaml
  - type: "link"
    url: "https://example.com/something"
    label: "the thing that started this"
```

`tape-004.md` carries all of these as commented-out examples. Uncommenting one
and editing it is usually faster than typing it from scratch.

---

## 7. Preview it locally

You need [Node.js](https://nodejs.org) installed. Check with:

```bash
node --version
```

Then, from inside the `october-tooth-wip` folder, install the dependencies once:

```bash
npm install
```

And start a local preview:

```bash
npx @11ty/eleventy --serve
```

It will print a local address — usually `http://localhost:8080` — which you open
in a browser. Leave the command running; it rebuilds and refreshes the page every
time you save the tape file. Stop it with `Ctrl+C`.

There is no `npm start` or `npm run dev` shortcut in this project, which is why
the command is spelled out in full.

### What to check before publishing

- The new tape is on the homepage at `/`, not just at its own URL.
- The date and tape number in the line above the title are right.
- Every track appears in the tracklist with the correct printed duration.
- Pressing **play** either plays audio, or shows the `no file` mark and runs
  the counter — both are fine, silence with no mark is not.
- Every photo loads (a broken image means a filename or folder-name mismatch —
  check capitals and the slug), and each one has a caption line under it.
- Any item with a `note` opens it when you click the caption line.
- The previous tape appears in `/archive/` and the `← tape 004` arrow at the
  bottom of the new tape goes to it.

---

## 8. Publish

Commit the new files and push to the `main` branch. That is the entire publish
step — Netlify builds the site and deploys it automatically within a minute or
two. There is nothing to upload by hand and no separate deploy button to press.

The files you are committing for a typical tape:

```
src/tapes/tape-005.md
src/media/tape-005/            (the audio)
src/images/tapes/tape-005/     (the photos)
```

If you open a pull request instead of pushing straight to `main`, Netlify builds
a preview of that branch and posts the link on the pull request — a good way to
look at the real thing before it goes live.

---

## 9. When something looks wrong

**The new tape isn't on the homepage.** Its `tapeNumber` isn't the highest one,
or it's quoted. It must be a bare number: `tapeNumber: 5`, not `tapeNumber: "5"`
or `tapeNumber: 005`.

**The tape page 404s.** The `permalink` and `slug` disagree, or the `permalink`
is missing its trailing slash. For tape 005 they must read
`permalink: /tapes/tape-005/` and `slug: tape-005`.

**Images don't load.** The folder under `src/images/tapes/` must exactly match
the `slug`, and the filename in the `media` entry must exactly match the file on
disk, including capitalisation. `Photo.PNG` and `photo.png` are different files
once deployed even if they look the same on your computer.

**Audio doesn't play but the deck runs anyway.** That's demo mode — the file
wasn't found or the browser can't decode it. Check the file is in
`src/media/<slug>/`, that the name matches, and that it's an `.mp3` or `.m4a`
rather than a `.wav`.

**The build fails.** It is almost always the front matter. YAML is strict:
consistent two-space indentation, no tabs, a space after every colon, and text
containing a colon or a `#` wrapped in double quotes. Compare against
`tape-004.md` line by line.

**An embed shows as a plain link.** The URL wasn't recognised. Make sure it's
the public share URL from the app, not a URL from a logged-in web player.

---

## The five-minute version

```bash
# inside october-tooth-wip/
cp src/tapes/tape-004.md src/tapes/tape-005.md
mkdir -p src/media/tape-005 src/images/tapes/tape-005
# copy audio into src/media/tape-005/, photos into src/images/tapes/tape-005/
# edit src/tapes/tape-005.md: permalink, title, date, tapeNumber: 5, slug, tracks, media
npx @11ty/eleventy --serve      # look at http://localhost:8080
# commit and push to main — Netlify deploys it
```
