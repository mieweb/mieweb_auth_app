App.info({
  id: 'com.mieweb.mieauth', 
  name: 'MIEAuth',         
  description: 'A Meteor app with Cordova integration', 
  author: 'Anshul Abrol',         
  email: 'abrol.anshul10@gmail.com', 
  website: 'https://example.com', 
  version: '0.0.2',           
});

// App.setPreference('GradlePluginGoogleServicesEnabled', true);
// App.appendToConfig(`
// <platform name="android">
//   <resource-file src="google-services.json" target="app/google-services.json" />
//   <config-file target="app/build.gradle" parent="/*">
//     <dependency>
//       classpath 'com.google.gms:google-services:4.4.2'
//     </dependency>
//   </config-file>
//   <config-file target="app/build.gradle" parent="android" mode="merge">
//     <apply plugin="com.google.gms.google-services" />
//   </config-file>
// </platform> mieweb_push_auth/.meteor/local/cordova-build/platforms/android/app/google-services.json
// `);

// App.appendToConfig(`
//   <platform name="android">
//     <resource-file src="/Users/anshul/Masters/Internship/POC/Meteor_Mobile/mieweb_push_auth/google-services.json" target="app/google-services.json" />
//   </platform>
// `);

App.configurePlugin('cordova-plugin-device', {
  version: '2.0.5',
});
