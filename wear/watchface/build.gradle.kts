plugins {
    alias(libs.plugins.android.application)
}

// Watch Face Format face: resources only (no code), its own package, as Wear OS requires.
android {
    namespace = "app.dailyflow.watchface"
    compileSdk = 36
    defaultConfig {
        applicationId = "app.dailyflow.watchface"
        minSdk = 36          // WFF v4 = Wear OS 6
        targetSdk = 36
        versionCode = 1
        versionName = "0.1.0"
    }
    buildTypes { release { isMinifyEnabled = false; signingConfig = signingConfigs.getByName("debug") } }
}
