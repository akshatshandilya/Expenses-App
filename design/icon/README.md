# Expenses app icon

A house outline with a gold rupee inside: household money, kept private and calm.

Colours: background `#0E6B58` (the app's green), house `#FFFFFF`, rupee `#F2C766`.

## Android (native)
Copy `android/res/*` into `app/src/main/res/`, then point the manifest at it:
`android:icon="@mipmap/ic_launcher"` and `android:roundIcon="@mipmap/ic_launcher_round"`.
- `mipmap-anydpi-v26/` adaptive icon (background colour, vector foreground, monochrome layer for Android 13+ themed icons)
- `mipmap-*dpi/` PNG icons for Android 7.1 and older
- `drawable/` vector foreground and monochrome layers, `values/` background colour

## Flutter / React Native / other tools
Use `png/foreground-432.png` (transparent, keep inside the centre 66 of 108 safe zone), the background colour `#0E6B58`, and `png/monochrome-432.png`. `png/foreground/` has all five densities.

## Play Store
`png/playstore-512.png` (square, full bleed, no rounded corners; the store applies its own mask).

## Sources
`svg/` holds editable vector files. Everything is generated from the same shapes, so change the colours in one place and re-export.

Not yet tested inside a built Android project; the XML follows the standard adaptive-icon format.
