App.info({
  id: "org.mieweb.opensource",
  name: "MIEAuth",
  description: "MIEAuth - Secure Two-Factor Authentication Made Simple",
  author: "Anshul Abrol",
  email: "abrol.anshul10@gmail.com",
  website: "https://mieauth-prod.os.mieweb.org",
  version: "1.2.9",
});

App.setPreference("android-targetSdkVersion", "35");
// Preferences per latest Meteor docs
App.setPreference("BackgroundColor", "#000000ff");
App.setPreference("HideKeyboardFormAccessoryBar", true);
App.setPreference("Orientation", "default");
App.setPreference("Orientation", "all", "ios");

App.setPreference("FadeSplashScreen", true);
App.setPreference("AutoHideSplashScreen", true);
App.setPreference("SplashScreenBackgroundColor", "#27AAE1");

// Set up resources such as icons based on generated files in `resources/`
App.icons({
  // iOS Main App Icons
  app_store: "public/resources/app_store.icon.png",
  iphone_2x: "public/resources/iphone_2x.icon.png",
  iphone_3x: "public/resources/iphone_3x.icon.png",
  ipad: "public/resources/ipad.icon.png",
  ipad_2x: "public/resources/ipad_2x.icon.png",
  ipad_pro: "public/resources/ipad_pro.icon.png",

  // iOS Settings Icons
  ios_settings: "public/resources/ios_settings.icon.png",
  ios_settings_2x: "public/resources/ios_settings_2x.icon.png",
  ios_settings_3x: "public/resources/ios_settings_3x.icon.png",

  // iOS Spotlight Icons
  ios_spotlight: "public/resources/ios_spotlight.icon.png",
  ios_spotlight_2x: "public/resources/ios_spotlight_2x.icon.png",
  ios_spotlight_3x: "public/resources/ios_spotlight_3x.icon.png",

  // iOS Notification Icons
  ios_notification: "public/resources/ios_notification.icon.png",
  ios_notification_2x: "public/resources/ios_notification_2x.icon.png",
  ios_notification_3x: "public/resources/ios_notification_3x.icon.png",

  // Legacy iOS Icons
  iphone_legacy: "public/resources/iphone_legacy.icon.png",
  iphone_legacy_2x: "public/resources/iphone_legacy_2x.icon.png",
  ipad_spotlight_legacy: "public/resources/ipad_spotlight_legacy.icon.png",
  ipad_spotlight_legacy_2x:
    "public/resources/ipad_spotlight_legacy_2x.icon.png",
  ipad_app_legacy: "public/resources/ipad_app_legacy.icon.png",
  ipad_app_legacy_2x: "public/resources/ipad_app_legacy_2x.icon.png",

  // Android Icons
  android_mdpi: "public/resources/android_mdpi.icon.png",
  android_hdpi: "public/resources/android_hdpi.icon.png",
  android_xhdpi: "public/resources/android_xhdpi.icon.png",
  android_xxhdpi: "public/resources/android_xxhdpi.icon.png",
  android_xxxhdpi: "public/resources/android_xxxhdpi.icon.png",
});

// Launch screens configuration (Meteor >=2.6 uses storyboards on iOS)
App.launchScreens({
  // iOS universal (using generated resources)
  ios_universal: "public/resources/Default@2x~universal~anyany.png",
  ios_universal_3x: "public/resources/Default@3x~universal~anyany.png",

  // Android
  android_universal: "public/resources/android_universal.splash.png",
});

App.configurePlugin("cordova-plugin-device", {
  version: "2.0.5",
});

App.configurePlugin("@havesource/cordova-plugin-push", {
  IOS_FIREBASE_MESSAGING_VERSION: "10.24.0",
});

App.configurePlugin("cordova-plugin-inappbrowser", {});

App.addResourceFile(
  "private/android/google-services.json",
  "app/google-services.json",
  "android",
);
App.addResourceFile(
  "private/ios/GoogleService-Info.plist",
  "GoogleService-Info.plist",
  "ios",
);
