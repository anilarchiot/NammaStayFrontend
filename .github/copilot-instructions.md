# Project conventions

## Typography (marketplace / NammaBookings and any new screen)
- One type system lives at the end of `marketplace/travel.css` ("TYPE SYSTEM"). Use its CSS variables only: `--font-head` (Sora) for headings, brand and numbers; `--font-body` (Manrope) for everything else.
- Sizes: `--fs-display`, `--fs-h1`, `--fs-h2`, `--fs-h3`, `--fs-body` (15px), `--fs-small`, `--fs-label`, `--fs-kicker`, `--fs-input` (16px), `--fs-btn`. Weights: `--fw-heading` (800), `--fw-strong` (700), `--fw-body` (500).
- Do not hard-code new font sizes, weights or families in page CSS or JS. Every new page must load `travel.css` last.
