---
"@object-ui/plugin-detail": minor
---

Phase Q: unify record-detail visual rhythm — one canvas, one box idiom.

Audit revealed three competing chrome treatments fighting on the same
page: the highlight strip was a filled Card, the discussion panel was
another filled Card, the related-list cards used heavy borders — while
the title chip, field grid, and history timeline were naked. The
result was visually noisy ("有的下划线，有的有边框，有的没边框").

This change commits to a single design language:

- **Highlights** (`HeaderHighlight`): drop the `Card`/`CardContent`
  wrapper. Render as a borderless `<section>` of stat cells with a
  subtle `border-b` separator. The tab strip below now carries the
  only visible anchor in that vertical band.
- **Discussion / activity feed** (`RecordActivityTimeline`): drop the
  `Card`/`CardHeader`/`CardContent` wrapper. Render as a borderless
  `<section>` with a top divider and a semantic `<header>` for the
  title. Right-side chatter panel still wraps with its own border so
  no chrome is lost in pinned mode.
- **Related list** (`RelatedList`): keep the card grouping (each is a
  table of child records — earned chrome), but tone it down to
  `border-border/60 bg-transparent` so the boxes recede instead of
  competing with the rest of the canvas.

Net effect: title / highlights / details / history sit on one
continuous bg-background canvas separated by whitespace + hairline
dividers; related lists are the one (subtle) boxed treatment, justified
by their tabular content. No internal package APIs changed.
