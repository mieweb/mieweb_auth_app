App.info({
  id: 'com.tickle.guard',
  name: 'Tickle Guard',
  description: 'Community-friendly authentication and identity app with Meteor + Cordova',
  author: 'Anshul Abrol',
  email: 'abrol.anshul10@gmail.com',
  website: 'https://mie-2fa.opensource.mieweb.org',
  version: '0.0.2',
});

App.configurePlugin('cordova-plugin-device', {
  version: '2.0.5',
});

// App Icons (replace Meteor defaults)
// All files referenced below already exist in the project's `resources/` directory.
App.icons({
  // iOS icons
  iphone_2x: 'resources/iphone_2x.icon.png',
  iphone_3x: 'resources/iphone_3x.icon.png',
  ipad: 'resources/ipad.icon.png',
  ipad_2x: 'resources/ipad_2x.icon.png',
  ipad_pro: 'resources/ipad_pro.icon.png',

  // iOS special-purpose icons
  ios_spotlight: 'resources/ios_spotlight.icon.png',
  ios_spotlight_2x: 'resources/ios_spotlight_2x.icon.png',
  ios_spotlight_3x: 'resources/ios_spotlight_3x.icon.png',

  ios_settings: 'resources/ios_settings.icon.png',
  ios_settings_2x: 'resources/ios_settings_2x.icon.png',
  ios_settings_3x: 'resources/ios_settings_3x.icon.png',

  ios_notification: 'resources/ios_notification.icon.png',
  ios_notification_2x: 'resources/ios_notification_2x.icon.png',
  ios_notification_3x: 'resources/ios_notification_3x.icon.png',

  // Android icons
  android_mdpi: 'resources/android_mdpi.icon.png',
  android_hdpi: 'resources/android_hdpi.icon.png',
  android_xhdpi: 'resources/android_xhdpi.icon.png',
  android_xxhdpi: 'resources/android_xxhdpi.icon.png',
  android_xxxhdpi: 'resources/android_xxxhdpi.icon.png',
});

// Splash screens: modern Cordova uses a universal asset on each platform.
// Use App.launchScreens per Meteor 2.6+ (storyboard on iOS, Android 12+ splash API)
App.launchScreens({
  // iOS universal storyboard image (@2x)
  ios_universal: 'resources/Default@2x~universal~anyany.png',
  // Android universal splash image
  android_universal: 'resources/android_universal.splash.png',
});

// Optional: keep brand background while splash shows
App.setPreference('SplashScreenBackgroundColor', '#27AAE1');
App.setPreference('AndroidWindowSplashScreenBackground', '#27AAE1');
App.setPreference('AutoHideSplashScreen', true);
App.setPreference('FadeSplashScreen', true);

App.addResourceFile('public/android/dev/google-services.json', 'app/google-services.json', 'android');
App.addResourceFile('public/ios/dev/GoogleService-Info.plist', 'GoogleService-Info.plist', 'ios');
