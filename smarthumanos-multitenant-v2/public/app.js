
let TENANT_ID = null;

window.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('gotoSignup').onclick = ()=> location.href = '/signup.html';
  document.getElementById('signout').onclick = ()=> Auth.signOut();

  // Try session → domain mapping → claims
  TENANT_ID = sessionStorage.getItem('TENANT_ID') || await window.resolveTenant();

  Auth.onAuthStateChanged(async (user) => {
    document.getElementById('signout').style.display = user ? 'inline-block' : 'none';
    document.getElementById('who').textContent = user ? `ผู้ใช้: ${user.email}` : '';
    if (!user) {
      document.getElementById('attn').textContent = '(ล็อกอินก่อน)';
      return;
    }

    // pull claims to ensure storage.rules can evaluate
    const claims = await window.getClaims();
    if (!TENANT_ID) TENANT_ID = claims.tenantId || null;
    document.getElementById('ten').textContent = TENANT_ID ? `TENANT: ${TENANT_ID}` : 'TENANT: (ยังไม่ตั้งค่า)';

    if (!TENANT_ID) {
      document.getElementById('attn').textContent = 'ยังไม่พบ tenant (สมัครผ่าน /signup.html หรือผูกโดเมนไว้ใน tenantDomains)';
      return;
    }

    DB.collection(`tenants/${TENANT_ID}/attendance`).limit(5).onSnapshot(snap => {
      const rows = snap.docs.map(d=> ({ id: d.id, ...d.data() }));
      document.getElementById('attn').textContent = JSON.stringify(rows, null, 2);
    }, (err)=>{
      document.getElementById('attn').textContent = 'Error: ' + err.message;
    });
  });
});
