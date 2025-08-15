// ใส่ Firebase config ของโปรเจกต์คุณ
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  appId: "YOUR_APP_ID"
};
firebase.initializeApp(firebaseConfig);
window.Auth = firebase.auth();
window.DB = firebase.firestore();
