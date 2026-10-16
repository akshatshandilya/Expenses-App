# Expenses launch animation: motion specification (preview v1)

Asset: `ic_launcher_rounded.svg` (the approved icon, unchanged), shown at 112 px.
Background: the app's home background. Light `#EDF2EF`, dark `#0C1411`. It never changes during the launch.
Name: "Expenses", Bricolage Grotesque 800, 36 px, letter-spacing -0.025em, colour = app ink.
Accent line: 44 x 2 px, app gold (`#B8790A` light, `#E3B341` dark).
Easing: reveal `cubic-bezier(.16, 1, .3, 1)`, hand-over `cubic-bezier(.65, 0, .35, 1)`.

## First launch (about 2.47 s)
| Stage | Start | Duration | Motion |
|---|---|---|---|
| 1 Background | 0 | 300 | Soft green glow fades to 55%, then to full by 1,200 ms |
| 2 Icon | 300 | 600 | opacity 0 to 1, scale 94% to 100%, rise 8 px |
| 3 Name | 700 | 600 | opacity 0 to 1, rise 10 px |
| 4 Finish | 1,000 | 700 | Gold rule draws from the centre, then fades |
| 5 Open app | 1,700 | 400 | Icon and name fade out (280 ms); home blocks fade up 90 ms later, 40 ms apart |

## Returning user (about 1.3 s)
Icon 0-300, name 120-400, no glow, no rule, hand-over at 640 for 340.

## Reduced motion (about 0.9 s)
Fades only. No scale, rise, glow or rule. Icon 0-250, name 80-330, hand-over at 550 for 200.

## Rules
- App lock on: the sequence ends on the lock screen. No household figures are drawn before unlock.
- No sound, no haptics, no network requests, no analytics.
- Home screen is built before the animation ends; the animation never delays interaction once it is ready.
- Native Android splash: plan is background colour only (no icon, no animation) so it matches this first frame. Not implemented yet.
