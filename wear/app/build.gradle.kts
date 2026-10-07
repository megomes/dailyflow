plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.google.services)
}

// The DailyFlow server: dailyflow.host in wear/local.properties (git-ignored).
val dailyflowHost: String = java.util.Properties().apply {
    rootProject.file("local.properties").takeIf { it.exists() }?.inputStream()?.use { load(it) }
}.getProperty("dailyflow.host", "")

android {
    namespace = "app.dailyflow.wear"
    compileSdk = 36
    defaultConfig {
        applicationId = "app.dailyflow"   // same id as the phone app: Wear pairs them in the Play/sideload flow
        minSdk = 30                        // Wear OS 3+
        targetSdk = 35
        versionCode = 7
        versionName = "0.3.4"
        buildConfigField("String", "DEFAULT_HOST", "\"$dailyflowHost\"")
    }
    buildTypes {
        // Release is what goes on the watch: R8 + the libraries' startup profiles (debug Compose is very slow).
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"))
            signingConfig = signingConfigs.getByName("debug")
        }
    }
    buildFeatures { compose = true; buildConfig = true }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}

dependencies {
    implementation(platform(libs.compose.bom))
    implementation(libs.compose.foundation)
    implementation(libs.compose.ui.tooling.preview)
    implementation(libs.activity.compose)
    implementation(libs.wear.compose.material)
    implementation(libs.wear.compose.foundation)
    implementation(libs.wear.tiles)
    implementation(libs.wear.protolayout)
    implementation(libs.wear.protolayout.material)
    implementation(libs.wear.complications)
    implementation(libs.wear.watchface.data)
    implementation(libs.wear.protolayout.expression)
    implementation(libs.profileinstaller)
    implementation(libs.concurrent.futures)
    implementation(libs.coroutines.android)
    implementation(libs.coroutines.guava)
    // Live sync: FCM “something changed” from the server (no polling for complications and the tile).
    implementation(platform(libs.firebase.bom))
    implementation(libs.firebase.messaging)
}
