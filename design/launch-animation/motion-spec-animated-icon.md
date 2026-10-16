# Expenses launch animation v2: the icon draws itself

Asset: `ic_launcher_rounded.svg` (approved icon). Only the line draw-on is added. The last frame is the approved icon.
Background: app home background (#EDF2EF light, #0C1411 dark). Easing: reveal `cubic-bezier(.16,1,.3,1)`, draw `cubic-bezier(.5,0,.2,1)`, hand-over `cubic-bezier(.65,0,.35,1)`.

## First launch (about 2.57 s)
| Part | Start | Duration | Motion |
|---|---|---|---|
| Glow | 0 | 300 (to 55%), full by 1,200 | soft green glow behind the icon |
| Tile | 250 | 450 | fade in, scale 94% to 100%, rise 8 px |
| Roof | 400 | 300 | white line draws from the left eave over the apex to the right eave |
| Walls | 520 | 380 | white line draws down the left wall, across the floor, up the right wall |
| Rupee bars | 850 | 260 | both gold bars draw left to right |
| Rupee leg | 960 | 280 | gold bowl and leg draw in one stroke |
| Name | 1,000 | 500 | fade in, rise 10 px |
| Gold rule | 1,250 | 600 | draws from the centre, then fades |
| Open app | 1,800 | 400 | icon and name fade out, home screen fades up in blocks |

## Returning user (about 1.45 s)
Same drawing, compressed: tile 0-250, roof 60-240, walls 130-330, rupee 290-510, name 300-560, hand-over at 760.

## Reduced motion (about 0.9 s)
No drawing. The finished icon fades in, then a plain cross-fade to the app.

## Rules
- During the draw the stroke uses a dash technique; the last keyframe removes it so the final frame is the plain approved icon.
- App lock on: ends on the lock screen. No sound, no haptics, no network requests.
- Android native splash: background colour only, no icon (not implemented yet).
