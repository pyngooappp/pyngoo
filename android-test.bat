@echo off
chcp 65001 >nul
REM Pyngoo - Android test: derle, BlueStacks'e yukle, bildirim kayitlarini goster
cd /d "%~dp0"
set ADB=%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe

echo.
echo === 1/5 Web derleniyor ===
call npm run build || goto :hata

echo.
echo === 2/5 Android'e kopyalaniyor ===
call npx cap sync android || goto :hata

echo.
echo === 3/5 APK olusturuluyor ===
if exist "C:\Program Files\Android\Android Studio\jbr\bin\java.exe" (
  set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
  pushd android
  call gradlew.bat assembleDebug || (popd & goto :hata)
  popd
) else (
  echo Android Studio Java bulunamadi. Android Studio'da Build - Generate APKs yap,
  echo bitince bu pencerede bir tusa bas.
  pause
)

echo.
echo === 4/5 BlueStacks'e yukleniyor ===
for %%P in (5555 5556 5565 5575 5585) do "%ADB%" connect 127.0.0.1:%%P >nul 2>&1
"%ADB%" devices
"%ADB%" install -r "android\app\build\outputs\apk\debug\app-debug.apk" || goto :hata
"%ADB%" logcat -c

echo.
echo === 5/5 SIMDI: BlueStacks'te Pyngoo'yu ac ve denemek istedigin seyi yap ===
echo (ornegin Profil - fotograf yukle). Bitince bu pencereye donup bir tusa bas.
pause

echo.
echo ===== BILDIRIM KAYITLARI =====
"%ADB%" logcat -d -s Capacitor/Console:* | findstr /i "push firebase photo"
echo ==============================
pause
exit /b 0

:hata
echo.
echo HATA OLUSTU - yukaridaki kirmizi yazilarin ekran goruntusunu gonder.
pause
exit /b 1
