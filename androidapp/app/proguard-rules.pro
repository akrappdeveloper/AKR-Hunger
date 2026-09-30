# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.kts.

# Keep Firebase classes
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }

# Firebase Crashlytics (Release Monitoring & De-obfuscation)
-keepattributes SourceFile,LineNumberTable
-keep public class * extends java.lang.Exception
-keepclassmembers class * {
    @com.google.firebase.crashlytics.** *;
}

# Firebase Performance Monitoring
-keep class com.google.firebase.perf.** { *; }
-keepclassmembers class * {
    @com.google.firebase.perf.metrics.AddTrace *;
}

# Firebase Remote Config & In-App Messaging
-keepattributes *Annotation*
-keep class com.google.firebase.remoteconfig.** { *; }
-keep class com.google.firebase.inappmessaging.** { *; }

# Keep Razorpay classes
-keep class com.razorpay.** { *; }
-keepclassmembers class com.razorpay.** { *; }

# Keep Glide
-keep public class * implements com.bumptech.glide.module.GlideModule
-keep class * extends com.bumptech.glide.module.AppGlideModule { *; }

# Keep model classes
-keep class com.ssr.hunger.models.** { *; }
