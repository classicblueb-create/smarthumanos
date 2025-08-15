# SmartHumanOS (Refreshed) + Firebase
- ดีไซน์ทันสมัยขึ้น (glass + soft shadow + dark mode) แต่คงโครง UI/IDs เดิม
- Auth: Email/Password + Google
- เลือกบทบาทครั้งแรก (HR/พนักงาน) → `userProfiles`
- HR มีปุ่มอนุมัติ/ปฏิเสธคำขอลา
- Firestore/Storage Security Rules แบบ role-based

## เริ่มต้น
1) Firebase Console → เปิด Authentication: Email/Password + Google, และ Firestore
2) วาง config ใน `public/firebase.js`
3) Deploy:
```bash
npm i -g firebase-tools
firebase login
firebase init hosting   # เลือก public = public
firebase deploy
```
