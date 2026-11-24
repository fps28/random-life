#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

sdk="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-}}"
: "${sdk:?Укажите путь к Android SDK в ANDROID_SDK_ROOT}"
tools="$sdk/build-tools/35.0.0"
platform="$sdk/platforms/android-35/android.jar"
out="$PWD/build"
key="${LIFE_KEYSTORE:-$out/prototype.jks}"
mkdir -p "$out/classes" "$out/dex"

"$tools/aapt2" compile --dir android/res -o "$out/resources.zip"
"$tools/aapt2" link -I "$platform" --manifest android/AndroidManifest.xml \
  -A web -o "$out/base.apk" "$out/resources.zip"
javac --release 8 -classpath "$platform" -d "$out/classes" android/MainActivity.java
jar cf "$out/classes.jar" -C "$out/classes" .
"$tools/d8" --min-api 23 --lib "$platform" --output "$out/dex" "$out/classes.jar"
zip -q -j "$out/base.apk" "$out/dex/classes.dex"
"$tools/zipalign" -f 4 "$out/base.apk" "$out/aligned.apk"

if [[ ! -f "$key" ]]; then
  keytool -genkeypair -keystore "$key" -storepass android -keypass android \
    -alias random-life -keyalg RSA -keysize 2048 -validity 10000 \
    -dname 'CN=Random Life Prototype'
fi
"$tools/apksigner" sign --ks "$key" --ks-key-alias random-life \
  --ks-pass pass:android --key-pass pass:android --out "$out/random-life.apk" "$out/aligned.apk"
"$tools/apksigner" verify --verbose "$out/random-life.apk"
