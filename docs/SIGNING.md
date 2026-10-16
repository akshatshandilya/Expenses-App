# Signing

Android only installs an update over an existing app if both APKs use the same key.

**Default.** Builds use `android/expenses-stable.jks` (alias `expenses`, password `expenses-stable`). Anyone who can read your repository can read this key, so keep the repository private. It is not suitable for Google Play.

**Your own key.**
1. `keytool -genkeypair -v -keystore my.jks -alias expenses -keyalg RSA -keysize 2048 -validity 10950`
2. In GitHub (Settings, Secrets and variables, Actions) add `EXPENSES_KEYSTORE_BASE64` (output of `base64 -w0 my.jks`), `EXPENSES_KEYSTORE_PASSWORD`, `EXPENSES_KEY_ALIAS`, `EXPENSES_KEY_PASSWORD`. The workflows use them automatically.

Changing the key later means Android refuses to install over the old app: make a backup in the app, uninstall, install the new APK, restore.
