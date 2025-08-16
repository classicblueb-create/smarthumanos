
// public/firebase.js
// TODO: replace with your Firebase project config
const firebaseConfig = {
  apiKey: "AIzaSyCc4rqBCTU_4AcJofC_fm8ImJ9V4Icjtk8",
  authDomain: "smart-human-os.firebaseapp.com",
  projectId: "smart-human-os",
  storageBucket: "smart-human-os.firebasestorage.app",
  messagingSenderId: "625376349877",
  appId: "1:625376349877:web:7e9955ab059cf0259438fc",
  measurementId: "G-4PSTG2LT2Z"
};
firebase.initializeApp(firebaseConfig);

window.Auth = firebase.auth();
window.DB = firebase.firestore();

window.resolveTenant = async function() {
  const host = window.location.hostname.toLowerCase();
  const lookup = (host === 'localhost' || host.endsWith('.web.app')) ? 'dev.local' : host;
  const snap = await DB.collection('tenantDomains').doc(lookup).get();
  if (!snap.exists) {
    console.warn('Domain not mapped to tenant. Falling back to session-based TENANT_ID.');
    return null;
  }
  return snap.data().tenantId;
};

// Helper to read claims
window.getClaims = async function() {
  const user = firebase.auth().currentUser;
  if (!user) return null;
  const token = await user.getIdTokenResult(true);
  return token.claims || {};
};
