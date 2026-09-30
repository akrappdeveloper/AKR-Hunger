plugins {
    id("com.android.application")
    id("com.google.gms.google-services")
    id("com.google.firebase.crashlytics")
    id("com.google.firebase.firebase-perf")
}

android {
    namespace = "com.ssr.hunger"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.ssr.hunger"
        minSdk = 24
        targetSdk = 34
        versionCode = 1
        versionName = "1.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            // Enable Crashlytics mapping file upload for release builds
            configure<com.google.firebase.crashlytics.buildtools.gradle.CrashlyticsExtension> {
                mappingFileUploadEnabled = true
            }
        }
        debug {
            // Disable Crashlytics mapping in debug for faster builds
            configure<com.google.firebase.crashlytics.buildtools.gradle.CrashlyticsExtension> {
                mappingFileUploadEnabled = false
            }
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_1_8
        targetCompatibility = JavaVersion.VERSION_1_8
    }
    buildFeatures {
        viewBinding = true
        buildConfig = true
    }
}

dependencies {
    // AndroidX Core
    implementation("androidx.core:core-ktx:1.12.0")
    implementation("androidx.appcompat:appcompat:1.6.1")
    implementation("com.google.android.material:material:1.11.0")
    implementation("androidx.constraintlayout:constraintlayout:2.1.4")
    implementation("androidx.recyclerview:recyclerview:1.3.2")
    implementation("androidx.cardview:cardview:1.0.0")
    implementation("androidx.swiperefreshlayout:swiperefreshlayout:1.1.0")
    implementation("androidx.viewpager2:viewpager2:1.0.0")

    // Navigation Component
    implementation("androidx.navigation:navigation-fragment:2.7.6")
    implementation("androidx.navigation:navigation-ui:2.7.6")

    // Lifecycle
    implementation("androidx.lifecycle:lifecycle-viewmodel:2.7.0")
    implementation("androidx.lifecycle:lifecycle-livedata:2.7.0")
    implementation("androidx.lifecycle:lifecycle-runtime:2.7.0")

    // Firebase BOM (manages all Firebase SDK versions)
    implementation(platform("com.google.firebase:firebase-bom:32.7.0"))

    // Firebase Core Services
    implementation("com.google.firebase:firebase-auth")
    implementation("com.google.firebase:firebase-firestore")
    implementation("com.google.firebase:firebase-storage")
    implementation("com.google.firebase:firebase-database")

    // Firebase Cloud Messaging (FCM)
    implementation("com.google.firebase:firebase-messaging")

    // Firebase Analytics (Realtime Analytics + Events)
    implementation("com.google.firebase:firebase-analytics")

    // Firebase Crashlytics (Crash Reporting + Release Monitoring)
    implementation("com.google.firebase:firebase-crashlytics")

    // Firebase Performance Monitoring (Network, App Start, Screen Rendering)
    implementation("com.google.firebase:firebase-perf")

    // Firebase In-App Messaging (optional - for engagement)
    implementation("com.google.firebase:firebase-inappmessaging-display")

    // Firebase Remote Config (for A/B testing and feature flags)
    implementation("com.google.firebase:firebase-config")

    // Google Sign-In
    implementation("com.google.android.gms:play-services-auth:20.7.0")

    // Google Location Services (for delivery address GPS)
    implementation("com.google.android.gms:play-services-location:21.0.1")

    // Image Loading - Glide
    implementation("com.github.bumptech.glide:glide:4.16.0")
    annotationProcessor("com.github.bumptech.glide:compiler:4.16.0")

    // Lottie Animations
    implementation("com.airbnb.android:lottie:6.3.0")

    // CircleImageView
    implementation("de.hdodenhof:circleimageview:3.1.0")

    // Shimmer Loading Effect
    implementation("com.facebook.shimmer:shimmer:0.5.0")

    // Razorpay Payment Gateway
    implementation("com.razorpay:checkout:1.6.33")

    // Gson
    implementation("com.google.code.gson:gson:2.10.1")

    // Testing
    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test.ext:junit:1.1.5")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.5.1")
}
