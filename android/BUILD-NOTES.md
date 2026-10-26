# APK build (v2.0)

APK එක GitHub Actions එකෙන් build වෙනවා — `.github/workflows/android-apk.yml`.
PC එකේ Android Studio ඕන නැහැ.

1. GitHub repo → **Actions** → **Build APK** → **Run workflow**
2. ඉවර වුණාම run එක ඇතුළේ **Artifacts → geda-badu-apk** download කරන්න (zip එකක් ඇතුළේ APK එක).

## Signing
- Package name: `lk.gedabaduapp` (දැනට ෆෝන්වල තියෙන app එකේ නමමයි).
- පරණ APK එක sign කරලා තියෙන්නේ "CN=Geda Badu, OU=Home, L=Colombo, C=LK" key එකෙන්
  (SHA-256 `E8:42:1C:82:…:E5:49:F8`). ඒ keystore file එක තියෙනවා නම් repo secrets වලට දාන්න
  (`GEDA_KEYSTORE_BASE64`, `GEDA_KEYSTORE_PASSWORD`, `GEDA_KEY_ALIAS`, `GEDA_KEY_PASSWORD`) — එතකොට
  අලුත් APK එක පරණ එකට උඩින් update වෙනවා.
- Keystore එක නැත්නම්: පරණ app එක uninstall කරලා අලුත් එක install කරන්න. ලිස්ට් එක server එකේ තියෙන නිසා කිසිම දෙයක් නැතිවෙන්නේ නැහැ.

## App එක වැඩ කරන විදිහ
- App එක `SERVER` (MainActivity.java) එකෙන් load කරනවා → web app එක අලුත් කළාම (Coolify deploy) ෆෝන් ඔක්කොම auto update.
- නෙට් නැත්නම්: service worker cache → ඒකත් නැත්නම් APK එකේ `assets/` copy එක (build එකේදී `public/` එකෙන් copy වෙනවා).
- පරණ v1.7 (versionCode 8) APK එකත් server එකේ `APP_VERSION:9` දැක්කාම අලුත් web app එක load කරනවා.
