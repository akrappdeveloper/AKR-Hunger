importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// Initialize the Firebase app in the service worker by passing in
// your app's Firebase config object.
// https://firebase.google.com/docs/web/setup#config
firebase.initializeApp({
    apiKey: "AIzaSyA80bVFfc12kGsMuzs5ZUk2kysH9FNjU_M",
    authDomain: "akr-ride.firebaseapp.com",
    databaseURL: "https://akr-ride-default-rtdb.firebaseio.com",
    projectId: "akr-ride",
    storageBucket: "akr-ride.firebasestorage.app",
    messagingSenderId: "185378046345",
    appId: "1:185378046345:web:2e023473c0c75ef2f96158",
    measurementId: "G-GMG1RM8F9Q"
});

// Retrieve an instance of Firebase Messaging so that it can handle background
// messages.
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    console.log(
        '[firebase-messaging-sw.js] Received background message ',
        payload
    );
    // Customize notification here
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: '/icon.png'
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});
