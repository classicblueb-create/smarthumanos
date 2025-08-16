// public/app.js
const db   = firebase.firestore();
const auth = firebase.auth();

const el = {
  who:        document.getElementById('who'),
  ten:        document.getElementById('ten'),
  attn:       document.getElementById('attn'),
  gotoSignup: document.getElementById('gotoSignup'),
  signout:    document.getElementById('signout'),
};

el.gotoSignup.addEventListener('click', () => {
  // ไปหน้าสมัครใช้งาน (มีอยู่แล้วในโปรเจกต์คุณ)
  location.href = '/signup.html';
});

el.signout.addEventListener('click', async () => {
  await auth.signOut();
});

// -------------------------
// หา tenantId ตาม hostname
// -------------------------
async function resolveTenantId() {
  const host = location.hostname; // เช่น smart-human-os.web.app หรือ localhost
  // พยายามหา doc ตาม hostname ก่อน
  const direct = await db.collection('tenantDomains').doc(host).get();
  if (direct.exists) return direct.data().tenantId;

  // fallback → dev.local (ที่คุณสร้างไว้แล้ว)
  const fallback = await db.collection('tenantDomains').doc('dev.local').get();
  if (fallback.exists) return fallback.data().tenantId;

  throw new Error('ไม่พบ mapping tenantDomains สำหรับโดเมนนี้');
}

// -------------------------
// โหลดข้อมูลตัวอย่าง Attendance
// โครงสร้างตัวอย่าง: tenants/{tenantId}/attendance/{uid}/logs/{doc}
// -------------------------
async function loadAttendance(tenantId, user) {
  el.attn.textContent = '(กำลังโหลด...)';
  try {
    // ตัวอย่าง: ดึง 10 รายการล่าสุดจาก subcollection logs
    const ref = db.collection('tenants')
                  .doc(tenantId)
                  .collection('attendance')
                  .doc(user.uid)
                  .collection('logs')
                  .orderBy('ts', 'desc')
                  .limit(10);
    const snap = await ref.get();

    if (snap.empty) {
      el.attn.textContent = 'ยังไม่มีข้อมูล (ลองบันทึกจากฟีเจอร์เช็คอินในแอปภายหลัง)';
      return;
    }

    const rows = [];
    snap.forEach(d => {
      const v = d.data();
      const ts = v.ts?.toDate ? v.ts.toDate().toLocaleString() : (v.ts || '');
      rows.push(`${ts}  •  ${v.type || 'unknown'}  ${v.note ? '— ' + v.note : ''}`);
    });
    el.attn.textContent = rows.join('\n');
  } catch (e) {
    el.attn.textContent = 'โหลดข้อมูลไม่สำเร็จ: ' + e.message;
  }
}

// -------------------------
// เริ่มทำงาน
// -------------------------
(async () => {
  try {
    const tenantId = await resolveTenantId();
    el.ten.textContent = `tenantId: ${tenantId}`;

    auth.onAuthStateChanged(async (user) => {
      if (user) {
        el.who.textContent = `เข้าสู่ระบบ: ${user.email || user.uid}`;
        el.signout.style.display = '';
        await loadAttendance(tenantId, user);
      } else {
        el.who.textContent = 'ยังไม่เข้าสู่ระบบ';
        el.signout.style.display = 'none';
        el.attn.textContent = '(ล็อกอินก่อน)';
      }
    });
  } catch (e) {
    el.ten.textContent = 'กำหนด tenant ไม่สำเร็จ: ' + e.message;
  }
})();
