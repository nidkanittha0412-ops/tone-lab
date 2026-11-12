// TONE LAB v9.4 — student number + optional nickname; teacher read-only dashboard.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js';
import { getAuth, signInAnonymously, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js';
import { getFirestore, collection, addDoc, getDocs, onSnapshot, query, where, serverTimestamp } from 'https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js';
const config={apiKey:'AIzaSyA63rr7AZoGVK-XP2FYlnDbS1FBEAnfQZw',authDomain:'tone-lab-af8af.firebaseapp.com',projectId:'tone-lab-af8af',storageBucket:'tone-lab-af8af.firebasestorage.app',messagingSenderId:'834044935775',appId:'1:834044935775:web:bc8bda7b4462b9bf2c65ea'};
const TEACHER_UID='o0u942U8fROkxaLFfkef4RlHI9D3';
const app=initializeApp(config),auth=getAuth(app),db=getFirestore(app),$=id=>document.getElementById(id);
let student=null,teacher=false,unsub=null,unsubWords=null,allRows=[],wordRows=[];
const status=msg=>{$('cloudStatus').textContent=msg};
const validPin=v=>/^\d{6}$/.test(v);
const validNumber=v=>/^(?:[1-9]|[1-4]\d|50)$/.test(v);
const cleanNumber=v=>String(v||'').trim().replace(/^0+(?=\d)/,'');
const cleanNickname=v=>String(v||'').trim().replace(/\s+/g,' ').slice(0,20);
const fmtTime=t=>t?.toDate?.()?.toLocaleString('th-TH')||'กำลังบันทึก';
function updateUI(){ $('cloudLeave').style.display=student?'':'none';$('cloudDash').style.display=teacher?'':'none';$('cloudTeacher').style.display=teacher?'none':'';$('cloudJoin').disabled=!!student||teacher;$('cloudPin').disabled=!!student||teacher;$('cloudCode').disabled=!!student||teacher;$('cloudNickname').disabled=!!student||teacher;$('cloudRoomType').disabled=!!student||teacher; }
async function join(){
 const pin=$('cloudPin').value.trim(),code=cleanNumber($('cloudCode').value),nickname=cleanNickname($('cloudNickname').value),roomType=$('cloudRoomType').value;
 if(!validPin(pin)||!validNumber(code)){status('กรอกรหัสห้อง 6 หลัก และเลขที่นักเรียน 1–50');return}
 try{status('กำลังเชื่อมต่อ...');if(!auth.currentUser||!auth.currentUser.isAnonymous){if(auth.currentUser)await signOut(auth);await signInAnonymously(auth)}
 teacher=false;student={pin,code,nickname,roomType};sessionStorage.setItem('toneStudent',JSON.stringify(student));updateUI();status('เข้าห้องแล้ว: '+pin+' • เลขที่ '+code+(nickname?' ('+nickname+')':'')+(roomType==='home'?' | ห้องฝึกที่บ้าน: กดบันทึกคำได้':' | ห้องประเมินผล'));if(roomType==='home')loadWords();}
 catch(e){status('เข้าห้องไม่สำเร็จ: '+e.message)}
}
async function leave(){if(unsubWords)unsubWords();student=null;sessionStorage.removeItem('toneStudent');if(auth.currentUser?.isAnonymous)await signOut(auth);updateUI();status('ออกจากห้องแล้ว • โหมดฝึกอิสระ')}
async function teacherLogin(){try{status('กำลังเข้าสู่ระบบครู...');if(auth.currentUser?.isAnonymous)await signOut(auth);const result=await signInWithPopup(auth,new GoogleAuthProvider());if(result.user.uid!==TEACHER_UID){teacher=false;updateUI();status('บัญชีนี้ไม่ได้รับสิทธิ์ครู');await signOut(auth);return}teacher=true;student=null;sessionStorage.removeItem('toneStudent');updateUI();status('เข้าสู่ระบบครูสำเร็จ');$('cloudDashboard').hidden=false}catch(e){status('เข้าสู่ระบบครูไม่สำเร็จ: '+e.message)}}
async function send(type,score,details){if(!student||student.roomType==='home')return;const u=auth.currentUser;if(!u?.isAnonymous){status('ไม่ได้ส่งคะแนน: กรุณาเข้าห้องเรียนใหม่');return}
 const payload={pin:student.pin,studentCode:student.code,nickname:student.nickname,kind:type,score,details,uid:u.uid,createdAt:serverTimestamp()};
 try{await addDoc(collection(db,'attempts'),payload);status('✅ บันทึกออนไลน์สำเร็จ • เลขที่ '+student.code+' • '+type+' '+score+(type==='mission'?'/1':'/10'))}
 catch(e){status('⚠️ ส่งคะแนนไม่สำเร็จ ('+e.code+') • แจ้งครูและอย่าเพิ่งปิดหน้านี้')}
}
let savingWord=false;
const normalizedWord=w=>String(w||'').normalize('NFC').trim();
async function saveWord(word){
 if(!student||student.roomType!=='home'){status('บันทึกคำบนคลาวด์: กรุณาเข้าห้องฝึกที่บ้านก่อน');return}
 if(!auth.currentUser?.isAnonymous){status('กรุณาเข้าห้องฝึกที่บ้านใหม่');return}
 const clean=normalizedWord(word);
 if(!clean){status('กรุณาประกอบคำก่อนบันทึก');return}
 if(savingWord)return;
 savingWord=true;
 try{
  const q=query(collection(db,'savedWords'),where('pin','==',student.pin),where('studentCode','==',student.code));
  const existing=await getDocs(q);
  if(existing.docs.some(d=>normalizedWord(d.data().word)===clean)){
   status('📖 คำ “'+clean+'” มีอยู่ในสมุดแล้ว ไม่บันทึกซ้ำ');return;
  }
  await addDoc(collection(db,'savedWords'),{pin:student.pin,studentCode:student.code,nickname:student.nickname,word:clean,uid:auth.currentUser.uid,createdAt:serverTimestamp()});
  status('💾 บันทึกคำ “'+clean+'” เรียบร้อยแล้ว');
 }catch(e){status('บันทึกคำไม่สำเร็จ: '+e.message)}
 finally{savingWord=false}
}
async function loadWords(){if(!student||student.roomType!=='home')return;try{const q=query(collection(db,'savedWords'),where('pin','==',student.pin),where('studentCode','==',student.code));if(unsubWords)unsubWords();unsubWords=onSnapshot(q,snap=>{const seen=new Set();const words=snap.docs.map(d=>d.data()).sort((a,b)=>(a.createdAt?.seconds||0)-(b.createdAt?.seconds||0)).filter(r=>{const w=normalizedWord(r.word);if(!w||seen.has(w))return false;seen.add(w);return true});window.dispatchEvent(new CustomEvent('toneWordsLoaded',{detail:words}));},e=>status('โหลดสมุดบันทึกไม่สำเร็จ: '+e.message))}catch(e){status('โหลดสมุดบันทึกไม่สำเร็จ: '+e.message)}}
window.ToneCloud={submitQuiz:(type,score,details)=>send(type,score,details),submitMission:(n,word,score,target)=>send('mission',score,[{mission:n,word,target,correct:score===1}]),saveWord,loadWords};
function showRows(rows){
 allRows=rows;
 const groups=new Map();
 for(const r of rows){
  const key=r.studentCode+'|'+r.kind;
  if(!groups.has(key))groups.set(key,[]);
  groups.get(key).push(r);
 }
 const list=[...groups.values()].map(a=>{
  a.sort((x,y)=>(x.createdAt?.seconds||0)-(y.createdAt?.seconds||0));
  const kind=a[0].kind, last=a.at(-1);
  if(kind==='mission'){
   // Each mission is counted once. Keep the earliest recorded first-check score.
   const unique=new Map();
   for(const r of a){
    const n=Number(r.details?.[0]?.mission);
    if(Number.isInteger(n)&&n>=1&&n<=10&&!unique.has(n))unique.set(n,r);
   }
   const done=unique.size;
   const earned=[...unique.values()].reduce((total,r)=>total+(r.score===1?1:0),0);
   return {code:a[0].studentCode,nickname:last.nickname||'',kind,
    count:done+'/10 ภารกิจ',earned:earned,maximum:done+' (จาก 10)',time:fmtTime(last.createdAt)};
  }
  // For pre/post, display the most recent submission and its score out of 10.
  return {code:a[0].studentCode,nickname:last.nickname||'',kind,
   count:a.length+' ครั้ง',earned:last.score,maximum:10,time:fmtTime(last.createdAt)};
 }).sort((a,b)=>Number(a.code)-Number(b.code)||a.kind.localeCompare(b.kind));
 const summary=$('dashSummary');summary.replaceChildren();
 for(const [label,n] of [['นักเรียนที่มีผลส่ง',new Set(rows.map(r=>r.studentCode)).size],['รายการที่ส่งทั้งหมด',rows.length],['ผลก่อนเรียน',rows.filter(r=>r.kind==='pre').length],['ผลหลังเรียน',rows.filter(r=>r.kind==='post').length]]){
  const div=document.createElement('div');div.className='statbox';const strong=document.createElement('strong');strong.textContent=n;div.append(strong,document.createTextNode(label));summary.append(div);
 }
 const body=$('dashRows');body.replaceChildren();
 for(const r of list){const tr=document.createElement('tr');for(const val of [r.code,r.nickname,r.kind,r.count,r.earned,r.maximum,r.time]){const td=document.createElement('td');td.textContent=val;tr.append(td)}body.append(tr)}
 if(!list.length)body.innerHTML='<tr><td colspan="7">ยังไม่มีผลคะแนนของห้องนี้</td></tr>';
}
function loadDashboard(){if(!teacher){status('กรุณาเข้าสู่ระบบครูก่อน');return}const pin=$('dashPin').value.trim();if(!validPin(pin)){status('กรุณากรอกรหัสห้อง 6 หลัก');return}if(unsub)unsub();if(unsubWords)unsubWords();allRows=[];status('กำลังโหลดคะแนนห้อง '+pin);unsub=onSnapshot(query(collection(db,'attempts'),where('pin','==',pin)),snap=>{showRows(snap.docs.map(d=>d.data()));status('📊 Dashboard อัปเดตแล้ว • ห้อง '+pin)},e=>status('อ่านคะแนนไม่สำเร็จ: '+e.message));unsubWords=onSnapshot(query(collection(db,'savedWords'),where('pin','==',pin)),snap=>{wordRows=snap.docs.map(d=>d.data());const byStudent=new Map();for(const r of wordRows){const k=r.studentCode;if(!byStudent.has(k))byStudent.set(k,new Set());const w=normalizedWord(r.word);if(w)byStudent.get(k).add(w)}const host=$('dashWordRows');host.replaceChildren();let uniqueTotal=0;for(const [code,wordSet] of [...byStudent].sort((a,b)=>Number(a[0])-Number(b[0]))){const words=[...wordSet];uniqueTotal+=words.length;const p=document.createElement('p');p.textContent='เลขที่ '+code+' ('+words.length+' คำไม่ซ้ำ): '+words.join(', ');host.append(p)}$('dashWordSummary').textContent='นักเรียนที่บันทึกคำ '+byStudent.size+' คน • คำศัพท์ไม่ซ้ำทั้งหมด '+uniqueTotal+' คำ';},e=>status('อ่านคำศัพท์ไม่สำเร็จ: '+e.message))}
function exportCsv(){if(!teacher)return;const header=['รหัสห้อง','เลขที่','ชื่อเล่น','กิจกรรม','คะแนน','เวลาส่ง'];const lines=[header,...allRows.map(r=>[r.pin,r.studentCode,r.nickname||'',r.kind,r.score,fmtTime(r.createdAt)])].map(a=>a.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(','));const blob=new Blob(['\uFEFF'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='tone-lab-scores-'+($('dashPin').value||'class')+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
$('cloudJoin').onclick=join;$('cloudLeave').onclick=leave;$('cloudTeacher').onclick=teacherLogin;$('cloudDash').onclick=()=>{$('cloudDashboard').hidden=!$('cloudDashboard').hidden};$('dashLoad').onclick=loadDashboard;$('dashCsv').onclick=exportCsv;$('dashLogout').onclick=async()=>{if(unsub)unsub();if(unsubWords)unsubWords();await signOut(auth);teacher=false;student=null;updateUI();$('cloudDashboard').hidden=true;status('ออกจากบัญชีครูแล้ว')};
onAuthStateChanged(auth,u=>{if(!u){teacher=false;student=null;updateUI();return}if(!u.isAnonymous){teacher=u.uid===TEACHER_UID;student=null;updateUI();if(!teacher)status('บัญชี Google นี้ไม่มีสิทธิ์ครู');return}teacher=false;try{const old=JSON.parse(sessionStorage.getItem('toneStudent')||'null');if(old&&validPin(old.pin)&&validNumber(old.code)){student=old;updateUI();status('กลับเข้าห้อง '+old.pin+' • เลขที่ '+old.code);if(old.roomType==='home')loadWords()}}catch{}});
