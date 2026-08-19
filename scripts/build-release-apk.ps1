# Build a standalone release APK for Android TV devices (真机安装).
# arm64-v8a: 64-bit devices | armeabi-v7a: 32-bit ARM (Android 9 等老电视盒子)
param(
  [string]$Arch = "arm64-v8a"
)

$env:EXPO_TV = "1"
$env:NODE_ENV = "production"
$env:ANDROID_HOME = "K:\Android\Sdk"
$env:ANDROID_SDK_ROOT = "K:\Android\Sdk"
$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot"
$gradleHome = "E:\g"
New-Item -ItemType Directory -Force -Path $gradleHome | Out-Null
$env:GRADLE_USER_HOME = $gradleHome
$env:Path = @(
  "$env:JAVA_HOME\bin",
  "$env:ANDROID_HOME\platform-tools",
  "$env:ANDROID_HOME\emulator",
  "$env:ANDROID_HOME\cmdline-tools\latest\bin",
  $env:Path
) -join ";"

$root = Split-Path $PSScriptRoot -Parent
$androidDir = Join-Path $root "android"
$expoCli = Join-Path $root "node_modules\.bin\expo.cmd"
$version = (Get-Content (Join-Path $root "package.json") -Raw | ConvertFrom-Json).version
$distDir = Join-Path $root "dist"
$apkName = "vauldy-tv-$version-$Arch-release.apk"
$srcApk = Join-Path $androidDir "app\build\outputs\apk\release\app-release.apk"
$destApk = Join-Path $distDir $apkName

if (-not (Test-Path $expoCli)) {
  Write-Error "Local Expo CLI not found: $expoCli. Run npm install first."
  exit 1
}

Push-Location $root
try {
  & $expoCli prebuild --platform android --clean
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} finally {
  Pop-Location
}

Push-Location $androidDir
try {
  & .\gradlew.bat assembleRelease "-PreactNativeArchitectures=$Arch" -x lint -x test
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} finally {
  Pop-Location
}

if (-not (Test-Path $srcApk)) {
  Write-Error "Release APK not found: $srcApk"
  exit 1
}

New-Item -ItemType Directory -Force -Path $distDir | Out-Null
Copy-Item $srcApk $destApk -Force
Write-Host ""
Write-Host "Release APK: $destApk"
Write-Host "Size: $([math]::Round((Get-Item $destApk).Length / 1MB, 2)) MB"
