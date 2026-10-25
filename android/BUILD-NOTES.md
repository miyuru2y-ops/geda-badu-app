# APK build — state (2026-10-25)

Done already:
- public/index.html patched: server-link setting (localStorage geda_server, apiBase/apiUrl),
  export/import sync-box, polling only re-renders on version change.
- android/app/src/main/assets/index.html = copy of that patched file.
- android/app/src/main/java/lk/gedabadu/MainActivity.java (WebView, JS + DOM storage, file access)
- android/app/src/main/AndroidManifest.xml (package lk.gedabadu, label ගෙදර බඩු, INTERNET)
- android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png (green house icon)

Still needed when JDK is ready:
1. Android cmdline-tools + sdkmanager install platforms;android-34 + build-tools;34.0.0
2. javac MainActivity.java against android.jar, d8 to classes.dex
3. aapt2 compile/link resources + assets, zipalign, apksigner with a fresh keystore
4. Verify with aapt2 dump badging + unzip -l, then copy APK to ~/workspace/your_files/Geda-Badu-App.apk
5. Deliver in Sinhala: install = allow "Install unknown apps" for the browser/files app, open APK,
   then (a) offline use immediately, or (b) paste Coolify link in the server-link field for 3-phone auto-sync.
