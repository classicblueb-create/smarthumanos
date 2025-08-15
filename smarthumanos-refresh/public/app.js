// SmartHumanOS – refreshed UI, Email/Google auth, role bootstrap, HR approvals
let currentProfile = null;
let unsubAttendance = null, unsubLeaves = null, unsubEmployees = null;

document.addEventListener('DOMContentLoaded', () => {
  bindAuthUI();
  updateCurrentTime(); setInterval(updateCurrentTime, 1000);
  Auth.onAuthStateChanged(async (user)=>{
    if (!user){
      showLogin(true);
    } else {
      const profRef = DB.collection('userProfiles').doc(user.uid);
      const snap = await profRef.get();
      currentProfile = snap.exists ? snap.data() : null;
      if (!currentProfile || !currentProfile.role){
        document.getElementById('role-bootstrap').classList.remove('hidden');
        document.getElementById('main-app').classList.add('hidden');
        document.getElementById('login-page').classList.remove('hidden');
      } else {
        enterApp();
      }
    }
  });
});

function bindAuthUI(){
  const emailEl = document.getElementById('email');
  const passEl = document.getElementById('password');
  document.getElementById('signin-email').addEventListener('click', async ()=>{
    await Auth.signInWithEmailAndPassword(emailEl.value, passEl.value);
  });
  document.getElementById('signup-email').addEventListener('click', async ()=>{
    await Auth.createUserWithEmailAndPassword(emailEl.value, passEl.value);
  });
  document.getElementById('signin-google').addEventListener('click', async ()=>{
    const provider = new firebase.auth.GoogleAuthProvider();
    await Auth.signInWithPopup(provider);
  });
  document.getElementById('choose-hr').addEventListener('click', ()=>chooseRole('hr'));
  document.getElementById('choose-employee').addEventListener('click', ()=>chooseRole('employee'));
  document.getElementById('logoutBtn').addEventListener('click', async ()=>{
    if (unsubAttendance) unsubAttendance(); if (unsubLeaves) unsubLeaves(); if (unsubEmployees) unsubEmployees();
    await Auth.signOut();
  });

  const openBtn = document.getElementById('leave-form-open');
  const cancelBtn = document.getElementById('leave-form-cancel');
  if (openBtn) openBtn.addEventListener('click', ()=>toggleEl('leave-form', true));
  if (cancelBtn) cancelBtn.addEventListener('click', ()=>toggleEl('leave-form', false));
  const leaveForm = document.getElementById('leave-request-form');
  if (leaveForm) leaveForm.addEventListener('submit', submitLeaveRequest);

  const addOpen = document.getElementById('add-employee-open');
  const addCancel = document.getElementById('add-employee-cancel');
  if (addOpen) addOpen.addEventListener('click', ()=>toggleEl('add-employee-form', true));
  if (addCancel) addCancel.addEventListener('click', ()=>toggleEl('add-employee-form', false));
  const empForm = document.getElementById('new-employee-form');
  if (empForm) empForm.addEventListener('submit', submitNewEmployee);
}

async function chooseRole(role){
  const user = Auth.currentUser;
  const payload = {
    uid: user.uid,
    email: user.email || null,
    displayName: user.displayName || '',
    role,
    position: role==='hr' ? 'HR Admin' : 'พนักงาน',
    name: user.displayName || (user.email ? user.email.split('@')[0] : 'ผู้ใช้')
  };
  await DB.collection('userProfiles').doc(user.uid).set(payload,{merge:true});
  currentProfile = payload;
  enterApp();
}

function showLogin(show){
  document.getElementById('login-page').classList[show?'remove':'add']('hidden');
  document.getElementById('main-app').classList[show?'add':'remove']('hidden');
}

function enterApp(){
  showLogin(false);
  const isHR = currentProfile.role === 'hr';
  toggleEl('hr-profile-menu', isHR);
  toggleEl('hr-org-menu', isHR);
  toggleEl('hr-permission-menu', isHR);
  setText('user-role', isHR ? 'ผู้ดูแลระบบ HR' : 'พนักงาน');
  setText('user-name', currentProfile.name || currentProfile.email || '—');
  setText('user-position', currentProfile.position || (isHR?'HR Admin':'Employee'));

  listenAttendance();
  listenLeaves();
  if (isHR) listenEmployees();

  showPage('dashboard');
  initCharts([]);
}

// Helpers
function toggleEl(id, show){ const el=document.getElementById(id); if (!el) return; el.classList[show?'remove':'add']('hidden'); }
function showPage(pageId){
  document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
  document.getElementById(pageId+'-page').classList.remove('hidden');
  document.querySelectorAll('.sidebar-link').forEach(a=>a.classList.remove('active'));
  const activeLink = document.querySelector(`.sidebar-link[onclick="showPage('${pageId}')"]`);
  if (activeLink) activeLink.classList.add('active');
}
function updateCurrentTime(){
  const now = new Date();
  const dateOptions = { year:'numeric', month:'long', day:'numeric' };
  const timeOptions = { hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false };
  const d=document.getElementById('current-date'); const t=document.getElementById('current-time');
  if (d) d.textContent = now.toLocaleDateString('th-TH', dateOptions);
  if (t) t.textContent = now.toLocaleTimeString('th-TH', timeOptions);
}
function showNotification(message){
  const n = document.createElement('div');
  n.className='fixed bottom-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 transition-opacity duration-300';
  n.textContent=message; document.body.appendChild(n);
  setTimeout(()=>{ n.style.opacity='0'; setTimeout(()=>document.body.removeChild(n),300); }, 2500);
}
function setText(id, v){ const el=document.getElementById(id); if (el) el.textContent = (v ?? '-'); }
function formatDateTH(iso){ if (!iso) return '-'; const d=new Date(iso); if (isNaN(d)) return iso; return d.toLocaleDateString('th-TH'); }
function badgeClass(st){ if (st==='work') return 'bg-green-100 text-green-800'; if (st==='personal') return 'bg-blue-100 text-blue-800'; if (st==='sick') return 'bg-red-100 text-red-800'; return 'bg-gray-100 text-gray-800'; }
function statusTH(st){ return ({work:'ทำงาน', personal:'ลากิจ', sick:'ลาป่วย', absent:'ขาดงาน', pending:'รออนุมัติ', approved:'อนุมัติแล้ว', rejected:'ปฏิเสธ'})[st] || st; }
function statusBadgeClass(st){ if (st==='approved') return 'bg-green-100 text-green-800'; if (st==='pending') return 'bg-yellow-100 text-yellow-800'; if (st==='rejected') return 'bg-red-100 text-red-800'; return 'bg-gray-100 text-gray-800'; }

// Attendance
function attendanceDocId(dateStr){ return `${Auth.currentUser.uid}_${dateStr}`; }
function todayStr(){ const d=new Date(); return d.toISOString().slice(0,10); }
document.addEventListener('click', (e)=>{
  if (e.target && e.target.id==='checkin-btn') checkIn();
  if (e.target && e.target.id==='checkout-btn') checkOut();
});
async function checkIn(){
  const uid = Auth.currentUser.uid;
  const time = new Date().toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit',hour12:false});
  const docId = attendanceDocId(todayStr());
  await DB.collection('attendance').doc(docId).set({
    uid, date: todayStr(), checkin: time, checkout: null, status:'work',
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  }, {merge:true});
  setText('checkin-time', time);
  const outBtn=document.getElementById('checkout-btn'); if (outBtn) outBtn.disabled=false;
  const inBtn=document.getElementById('checkin-btn'); if (inBtn) inBtn.disabled=true;
  showNotification('เช็คอินสำเร็จ เวลา '+time);
}
async function checkOut(){
  const time = new Date().toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit',hour12:false});
  const docId = attendanceDocId(todayStr());
  await DB.collection('attendance').doc(docId).set({ checkout: time }, {merge:true});
  setText('checkout-time', time);
  const outBtn=document.getElementById('checkout-btn'); if (outBtn) outBtn.disabled=true;
  showNotification('เช็คเอาท์สำเร็จ เวลา '+time);
}
function listenAttendance(){
  const uid = Auth.currentUser.uid;
  if (unsubAttendance) unsubAttendance();
  unsubAttendance = DB.collection('attendance').where('uid','==',uid).orderBy('date','desc').limit(30).onSnapshot(snap=>{
    const tbody = document.getElementById('attendance-history');
    if (!tbody) return;
    tbody.innerHTML='';
    let work=0,personal=0,sick=0,absent=0;
    const rows=[];
    snap.forEach(doc=>{
      const d=doc.data(); rows.push(d);
      if (d.status==='work') work++; else if (d.status==='personal') personal++; else if (d.status==='sick') sick++; else if (d.status==='absent') absent++;
      const tr=document.createElement('tr');
      tr.innerHTML=`
        <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">${formatDateTH(d.date)}</td>
        <td class="px-4 py-3 whitespace-nowrap text-center text-sm text-gray-900 dark:text-gray-100">${d.checkin||'-'}</td>
        <td class="px-4 py-3 whitespace-nowrap text-center text-sm text-gray-900 dark:text-gray-100">${d.checkout||'-'}</td>
        <td class="px-4 py-3 whitespace-nowrap text-center"><span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${badgeClass(d.status)}">${statusTH(d.status)}</span></td>`;
      tbody.appendChild(tr);
    });
    setText('work-days', work); setText('personal-leave', personal); setText('sick-leave', sick); setText('absent-days', absent);
    initCharts(rows); renderCalendar(rows);
  });
}

// Leaves
async function submitLeaveRequest(e){
  e.preventDefault();
  const uid=Auth.currentUser.uid;
  const type = document.getElementById('leave-type').value;
  const days = Number(document.getElementById('leave-days').value);
  const start = document.getElementById('leave-start').value;
  const end = document.getElementById('leave-end').value || start;
  const reason = document.getElementById('leave-reason').value.trim();
  await DB.collection('leaves').add({ uid, type, start, end, days, reason, status:'pending', createdAt: firebase.firestore.FieldValue.serverTimestamp() });
  toggleEl('leave-form', false); showNotification('ส่งคำขอลาสำเร็จ กรุณารอการอนุมัติ');
}
function listenLeaves(){
  const isHR = currentProfile.role==='hr';
  if (unsubLeaves) unsubLeaves();
  let ref = DB.collection('leaves').orderBy('createdAt','desc').limit(50);
  if (!isHR) ref = ref.where('uid','==',Auth.currentUser.uid);
  unsubLeaves = ref.onSnapshot(async snap=>{
    const tbody=document.getElementById('leaves-table'); if (!tbody) return;
    tbody.innerHTML='';
    let counters={personal:0,sick:0,vacation:0};
    for (const doc of snap.docs){
      const d=doc.data();
      if (d.uid===Auth.currentUser.uid) counters[d.type]=(counters[d.type]||0)+(d.days||0);
      let ownerName = d.uid;
      try { const ps = await DB.collection('userProfiles').doc(d.uid).get(); if (ps.exists) ownerName = ps.data().name || ps.data().email || ownerName; } catch {}
      const tr=document.createElement('tr');
      tr.innerHTML=`
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">${ownerName}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">${leaveTypeTH(d.type)}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">${formatDateTH(d.start)}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">${formatDateTH(d.end)}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">${d.days||1}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">${d.reason||'-'}</td>
        <td class="px-6 py-4 whitespace-nowrap"><span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusBadgeClass(d.status)}">${statusTH(d.status)}</span></td>
        <td class="px-6 py-4 whitespace-nowrap text-center text-sm" id="act_${doc.id}"></td>`;
      tbody.appendChild(tr);
      if (isHR && d.status==='pending'){
        const td = document.getElementById(`act_${doc.id}`);
        td.innerHTML = `
          <button class="px-2 py-1 bg-green-600 text-white rounded mr-2" data-act="approve" data-id="${doc.id}"><i class="fas fa-check mr-1"></i> อนุมัติ</button>
          <button class="px-2 py-1 bg-red-600 text-white rounded" data-act="reject" data-id="${doc.id}"><i class="fas fa-times mr-1"></i> ปฏิเสธ</button>`;
      }
    }
    renderLeaveCounters(counters);
    if (isHR){
      tbody.querySelectorAll('button[data-act]').forEach(btn=>{
        btn.addEventListener('click', async ()=>{
          const id = btn.getAttribute('data-id');
          const act = btn.getAttribute('data-act');
          await DB.collection('leaves').doc(id).update({ status: act==='approve' ? 'approved' : 'rejected' });
        });
      });
    }
  });
}
function renderLeaveCounters(c){
  const el=document.getElementById('leave-counters'); if (!el) return;
  el.innerHTML = counterCards([
    {color:'#3b82f6', title:'วันลาคงเหลือ', big: String(20 - ((c.vacation||0)+(c.personal||0))), note:'จากทั้งหมด 20 วัน'},
    {color:'#10b981', title:'ลากิจคงเหลือ', big: String(10 - (c.personal||0)), note:'จากทั้งหมด 10 วัน'},
    {color:'#ef4444', title:'ลาป่วยคงเหลือ', big: String(10 - (c.sick||0)), note:'จากทั้งหมด 10 วัน'},
  ]);
}
function counterCards(arr){
  return arr.map(a=>`<div class="glass card rounded-xl p-4"><div class="flex items-center"><div class="h-12 w-12 rounded-full" style="background-color:rgba(0,0,0,0.05);display:flex;align-items:center;justify-content:center;margin-right:1rem;"><i class="fas fa-calendar-check" style="color:${a.color}"></i></div><div><p class="text-sm text-gray-500">${a.title}</p><p class="text-2xl font-bold text-gray-800 dark:text-gray-100">${a.big}</p><p class="text-xs text-gray-500">${a.note}</p></div></div></div>`).join('');
}
function leaveTypeTH(t){ return ({personal:'ลากิจ', sick:'ลาป่วย', vacation:'ลาพักร้อน'})[t] || t; }

// Employees (HR)
async function submitNewEmployee(e){
  e.preventDefault();
  if (currentProfile.role!=='hr'){ return showNotification('เฉพาะ HR เท่านั้น'); }
  const payload = {
    code: val('emp-code'), firstname: val('emp-firstname'), lastname: val('emp-lastname'),
    email: val('emp-email'), phone: val('emp-phone'), start: val('emp-start'),
    dept: val('emp-dept'), title: val('emp-title'),
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  await DB.collection('employees').add(payload);
  toggleEl('add-employee-form', false);
  showNotification('เพิ่มพนักงานใหม่สำเร็จ');
}
function listenEmployees(){
  if (unsubEmployees) unsubEmployees();
  unsubEmployees = DB.collection('employees').orderBy('createdAt','desc').onSnapshot(snap=>{
    const tbody = document.getElementById('employees-table'); if (!tbody) return;
    tbody.innerHTML='';
    snap.forEach(doc=>{
      const d=doc.data();
      const initial = (d.firstname||'')[0] || 'พ';
      const tr=document.createElement('tr');
      tr.innerHTML = `
        <td class="px-6 py-4 whitespace-nowrap"><div class="flex items-center"><div class="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center mr-3"><span class="text-blue-600 font-medium">${initial}</span></div><div><div class="text-sm font-medium text-gray-900 dark:text-gray-100">${d.firstname||''} ${d.lastname||''}</div><div class="text-xs text-gray-500">รหัส: ${d.code||'-'}</div></div></div></td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">${d.title||'-'}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">${d.dept||'-'}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">${formatDateTH(d.start)||'-'}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">${d.email||'-'}</td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">${d.phone||'-'}</td>
        <td class="px-6 py-4 whitespace-nowrap text-center text-sm"><button class="text-red-600 hover:text-red-800" data-del="${doc.id}"><i class="fas fa-trash-alt"></i></button></td>`;
      tbody.appendChild(tr);
    });
    tbody.querySelectorAll('button[data-del]').forEach(btn=>{
      btn.addEventListener('click', async ()=>{ await DB.collection('employees').doc(btn.getAttribute('data-del')).delete(); });
    });
    renderEmployeeSummary(snap.docs.map(x=>x.data()));
  });
}
function renderEmployeeSummary(rows){
  const tbody = document.getElementById('employee-summary-table'); if (!tbody) return;
  tbody.innerHTML='';
  rows.forEach(r=>{
    const initial = (r.firstname||'')[0] || 'พ';
    const tr=document.createElement('tr');
    tr.innerHTML = `
      <td class="px-6 py-4 whitespace-nowrap"><div class="flex items-center"><div class="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center mr-3"><span class="text-blue-600 font-medium">${initial}</span></div><div><div class="text-sm font-medium text-gray-900 dark:text-gray-100">${r.firstname||''} ${r.lastname||''}</div><div class="text-xs text-gray-500">${r.dept||''}</div></div></div></td>
      <td class="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900 dark:text-gray-100">-</td>
      <td class="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900 dark:text-gray-100">-</td>
      <td class="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900 dark:text-gray-100">-</td>
      <td class="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900 dark:text-gray-100">-</td>`;
    tbody.appendChild(tr);
  });
}

// Charts & Calendar
function initCharts(attRows){
  const labels = (attRows||[]).slice().reverse().map(r=>formatDateTH(r.date));
  const checkins = (attRows||[]).slice().reverse().map(r=> r.checkin ? parseFloat(r.checkin.split(':')[0]) : null);
  const checkouts = (attRows||[]).slice().reverse().map(r=> r.checkout ? parseFloat(r.checkout.split(':')[0]) : null);
  const c1 = document.getElementById('attendance-chart').getContext('2d');
  if (window.__attChart) window.__attChart.destroy();
  window.__attChart = new Chart(c1, { type:'line', data:{ labels, datasets:[
    {label:'เวลาเข้างาน', data:checkins, borderColor:'#3b82f6', backgroundColor:'rgba(59,130,246,0.1)', tension:0.4, fill:false},
    {label:'เวลาออกงาน', data:checkouts, borderColor:'#ef4444', backgroundColor:'rgba(239,68,68,0.1)', tension:0.4, fill:false},
  ]}, options:{ responsive:true, maintainAspectRatio:false, scales:{ y:{ min:8, max:18, ticks:{ callback:v=>v+':00' } } } } });

  const c2 = document.getElementById('status-chart').getContext('2d');
  if (window.__statusChart) window.__statusChart.destroy();
  const counts = {work:0, personal:0, sick:0, absent:0};
  (attRows||[]).forEach(r=> counts[r.status]=(counts[r.status]||0)+1 );
  window.__statusChart = new Chart(c2, { type:'doughnut', data:{ labels:['ทำงาน','ลากิจ','ลาป่วย','ขาดงาน'], datasets:[{ data:[counts.work, counts.personal, counts.sick, counts.absent], backgroundColor:['#3b82f6','#10b981','#f59e0b','#ef4444'], borderWidth:1 }]}, options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:'bottom' } } } });
}
function renderCalendar(attRows){
  const container = document.getElementById('work-calendar'); if (!container) return;
  container.innerHTML='';
  const headers=['อา','จ','อ','พ','พฤ','ศ','ส']; headers.forEach(h=>{ const d=document.createElement('div'); d.className='text-center text-sm font-medium text-gray-500 p-2'; d.textContent=h; container.appendChild(d); });
  for (let i=1;i<=28;i++){
    const cell=document.createElement('div'); cell.className='text-center p-2 rounded-lg bg-gray-100 dark:bg-gray-800';
    const st=(attRows||[]).find(r => parseInt((r.date||'').split('-')[2]||'0',10)===i)?.status || null;
    cell.innerHTML = `<div class="text-sm font-medium">${i}</div><div class="text-xs ${st?'text-blue-600':''}">${st?statusTH(st):' '}</div>`;
    if (st==='work') cell.className='text-center p-2 rounded-lg bg-blue-100';
    if (st==='personal') cell.className='text-center p-2 rounded-lg bg-green-100';
    if (st==='sick') cell.className='text-center p-2 rounded-lg bg-red-100';
    container.appendChild(cell);
  }
}

function val(id){ const el=document.getElementById(id); return el?el.value:''; }
