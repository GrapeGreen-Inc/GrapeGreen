importScripts("https://www.gstatic.com/firebasejs/13.2.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/13.2.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyAqy6NWFJ1KD9Cfv_WyqbMJJWCqlC5P7Es",
  authDomain: "app-iguess-39f2f.firebaseapp.com",
  databaseURL: "https://app-iguess-39f2f-default-rtdb.firebaseio.com",
  projectId: "app-iguess-39f2f",
  storageBucket: "app-iguess-39f2f.firebasestorage.app",
  messagingSenderId: "1056619953768",
  appId: "1:1056619953768:web:6ac154660c07c48a5005dd",
  measurementId: "G-J4736J0D8J"
});

const messaging = firebase.messaging();

// Displays push notifications when the user does not have GrapeGreen open
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || "GrapeGreen";
  const options = {
    body: payload.notification?.body || "",
    icon: "https://grapegreen-inc.github.io/GrapeGreen/dashboard/site/assets/images/logo.png"
  };
  self.registration.showNotification(title, options);
});
