# Fonts in this directory

Two different jobs live here, and it is worth not confusing them.

- **`Inter-Variable.ttf`** is both the site's own UI face (`src/ui/theme/fonts.ts`)
  and a seeded engraving face.
- **The other four are engraving faces only.** They are never used to render
  the site itself.

Every file is under the **SIL Open Font License 1.1**, and each family's own
`OFL.txt` sits beside it, unmodified, as that licence requires. None of the
files has been renamed, subset or otherwise altered - what is committed is
byte-for-byte what was downloaded.

## Provenance

All taken from Google's own font repository, `github.com/google/fonts`, on
the date shown. The same source the original Inter file came from.

| File | Family | Source path | Added |
|---|---|---|---|
| `Inter-Variable.ttf` | Inter | `ofl/inter` | 2026-08-24 |
| `Montserrat-Variable.ttf` | Montserrat | `ofl/montserrat` | 2026-09-13 |
| `EBGaramond-Variable.ttf` | EB Garamond | `ofl/ebgaramond` | 2026-09-13 |
| `PlayfairDisplay-Variable.ttf` | Playfair Display | `ofl/playfairdisplay` | 2026-09-13 |
| `Parisienne-Regular.ttf` | Parisienne | `ofl/parisienne` | 2026-09-13 |

## Before adding another

`prisma/seed.ts` parses each file's real cmap on every run and **refuses to
seed a face missing any of `ąćęłńóśźżĄĆĘŁŃÓŚŹŻ`**. Coverage is never inferred
from a font's name or its declared language support - only from what is
actually in the file. So adding a face is: drop the `.ttf` and its `OFL.txt`
here, add a row to `FONT_SEEDS`, re-seed, and let it fail if the face cannot
engrave a Polish name.

Check the licence too. OFL is not the only licence on that repository - a few
families there are Apache or Ubuntu-licensed - and „it was on Google Fonts" is
not the same as „we may ship it".

## One thing that is not real yet

`Font.minHeightUm` is **3 mm for every face**, and nobody measured it. It is a
placeholder in the same sense as `TODO_PRICING`, and it is very likely wrong
for `Parisienne`: a connected script with thin joins stops being legible well
above the size a grotesque does. See `docs/OPEN_ITEMS.md` §11 - it needs a
test cut per face, not a better guess.
