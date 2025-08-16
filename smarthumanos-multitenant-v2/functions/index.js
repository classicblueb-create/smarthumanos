
const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();

exports.createOrJoinTenant = functions
  //.region('asia-southeast1')
  .https.onCall(async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError('unauthenticated', 'Login required');
    }
    const uid = context.auth.uid;
    const inputName = (data.companyName || '').trim();
    if (!inputName) {
      throw new functions.https.HttpsError('invalid-argument', 'companyName is required');
    }

    const nameLower = inputName
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^\p{Letter}\p{Number}]+/gu, ' ')
      .trim();
    const slug = nameLower.replace(/\s+/g, '');

    const nameRef = db.collection('tenantNames').doc(slug);
    const tenantRef = db.collection('tenants').doc(slug);
    const profileRef = tenantRef.collection('profiles').doc(uid);

    let roleAssigned = 'employee';
    await db.runTransaction(async (tx) => {
      const nameDoc = await tx.get(nameRef);
      if (!nameDoc.exists) {
        roleAssigned = 'owner';
        tx.set(nameRef, {
          name: inputName,
          tenantId: slug,
          nameLower,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          createdBy: uid,
        });
        tx.set(tenantRef, {
          name: inputName,
          slug,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          createdBy: uid,
        });
        tx.set(profileRef, {
          uid,
          tenantId: slug,
          role: roleAssigned,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } else {
        const prof = await tx.get(profileRef);
        if (!prof.exists) {
          tx.set(profileRef, {
            uid,
            tenantId: slug,
            role: roleAssigned,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        } else {
          roleAssigned = prof.data().role || roleAssigned;
        }
      }
    });

    // Attach custom claims so Storage/other services can enforce tenant
    try {
      await admin.auth().setCustomUserClaims(uid, {
        tenantId: slug,
        role: roleAssigned,
      });
    } catch (e) {
      console.error('setCustomUserClaims failed', e);
      // Not fatal for Firestore; client will retry token refresh anyway
    }

    return { tenantId: slug, displayName: inputName, role: roleAssigned };
  });
