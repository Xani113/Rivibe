# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Keep Capacitor plugin & native audio engine classes intact
-keep class com.rivibe.app.nativeaudio.** { *; }
-keep class org.schabi.newpipe.** { *; }
-dontwarn org.mozilla.javascript.**
-dontwarn javax.annotation.**
