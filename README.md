# deepchesstheory-viewer

The board and move viewer of [deepchesstheory.com](https://deepchesstheory.com), an opening study site.

The viewer is built on [chessground](https://github.com/lichess-org/chessground) and
[chessops](https://github.com/niklasf/chessops), both licensed under the GNU GPL 3.0 or later.
This code is therefore distributed under the same licence: **GPL-3.0-or-later** (see `LICENSE`).
The licences of the other software, fonts and images it uses are in `THIRD-PARTY-NOTICES`.

Each version published on the site has a matching tag here (`v2026.10.28` and so on).

## What is not here

The course content (chapters, plan cards, annotated games, statistics) is not part of this repository and is
not covered by the code licence. The viewer loads it at run time from separate files. `content/example/` is a
small sample, written for this repository, that shows the file formats.

## Running it

Node.js 20 or later:

```bash
npm --prefix web install
npm --prefix web run dev
```

The site opens at http://127.0.0.1:5180 with the example study. `npm --prefix web run build` writes the static
site to `web/dist`.

## Content format

- `content/<study>/study.json`: title, chapters (`line`, `game` or `prose`) and their files.
- Chapters of type `line` and `game` are PGN files. Comments in braces, variations in brackets, arrows and
  marked squares with `[%cal]` and `[%csl]` as on Lichess.
- Chapters of type `prose` are Markdown.
