#!/usr/bin/env node
/**
 * Fixes @react-native-voice/voice Android build.gradle for Gradle 9 compatibility.
 * - Removes jcenter() (removed in Gradle 9)
 * - Uses compileSdk instead of compileSdkVersion (new AGP syntax)
 * - Adds namespace declaration
 */
const fs = require('fs');
const path = require('path');

const target = path.join(
  __dirname,
  '../node_modules/@react-native-voice/voice/android/build.gradle',
);

const fixed = `apply plugin: 'com.android.library'

def DEFAULT_COMPILE_SDK_VERSION = 36
def DEFAULT_BUILD_TOOLS_VERSION = "36.0.0"
def DEFAULT_TARGET_SDK_VERSION = 36
def DEFAULT_SUPPORT_LIB_VERSION = "28.0.0"

android {
    compileSdk rootProject.hasProperty('compileSdkVersion') ? rootProject.compileSdkVersion : DEFAULT_COMPILE_SDK_VERSION
    buildToolsVersion rootProject.hasProperty('buildToolsVersion') ? rootProject.buildToolsVersion : DEFAULT_BUILD_TOOLS_VERSION

    defaultConfig {
        minSdkVersion 24
        targetSdkVersion rootProject.hasProperty('targetSdkVersion') ? rootProject.targetSdkVersion : DEFAULT_TARGET_SDK_VERSION
        versionCode 1
        versionName "1.0"
    }
    buildTypes {
        release {
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
        }
    }
    namespace 'com.wenkesj.voice'
    lint {
        abortOnError false
    }
}

dependencies {
    implementation fileTree(dir: 'libs', include: ['*.jar'])
    testImplementation 'junit:junit:4.12'
    implementation 'com.facebook.react:react-native:+'
}
`;

if (!fs.existsSync(target)) {
  console.warn('[fix-voice-gradle] File not found, skipping:', target);
  process.exit(0);
}

fs.writeFileSync(target, fixed, 'utf8');
console.log('[fix-voice-gradle] Patched @react-native-voice/voice build.gradle');
