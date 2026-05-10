import { useState, useEffect, useMemo } from "react";
import { auth, db } from "./firebase";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { collection, onSnapshot, doc, getDoc } from "firebase/firestore";

// ╔══════════════════════════════════════════════════════════════╗
// ║   FIFA GROUP V4 — FIXED DATA LAYER                          ║
// ║   يستخدم نفس منطق القراءة تماماً من التطبيق الأصلي         ║
// ╚══════════════════════════════════════════════════════════════╝

const URLS = {
  members:     "https://docs.google.com/spreadsheets/d/e/2PACX-1vSDrHv3359NOsLcR5FqhRLs4MyYBxWzKI1iVZNVKT1_8vIPMOyqqzJF5qSah5cmYIuj182gYQAVwccm/pub?gid=0&single=true&output=csv",
  players:     "https://docs.google.com/spreadsheets/d/e/2PACX-1vSDrHv3359NOsLcR5FqhRLs4MyYBxWzKI1iVZNVKT1_8vIPMOyqqzJF5qSah5cmYIuj182gYQAVwccm/pub?gid=1768795422&single=true&output=csv",
  trophies:    "https://docs.google.com/spreadsheets/d/e/2PACX-1vSDrHv3359NOsLcR5FqhRLs4MyYBxWzKI1iVZNVKT1_8vIPMOyqqzJF5qSah5cmYIuj182gYQAVwccm/pub?gid=694104264&single=true&output=csv",
  leagues:     "https://docs.google.com/spreadsheets/d/e/2PACX-1vSDrHv3359NOsLcR5FqhRLs4MyYBxWzKI1iVZNVKT1_8vIPMOyqqzJF5qSah5cmYIuj182gYQAVwccm/pub?gid=1337187883&single=true&output=csv",
  tournaments: "https://docs.google.com/spreadsheets/d/e/2PACX-1vSDrHv3359NOsLcR5FqhRLs4MyYBxWzKI1iVZNVKT1_8vIPMOyqqzJF5qSah5cmYIuj182gYQAVwccm/pub?gid=1271747498&single=true&output=csv",
  seasons:     "https://docs.google.com/spreadsheets/d/e/2PACX-1vSDrHv3359NOsLcR5FqhRLs4MyYBxWzKI1iVZNVKT1_8vIPMOyqqzJF5qSah5cmYIuj182gYQAVwccm/pub?gid=1861704915&single=true&output=csv",
  finance:     "https://docs.google.com/spreadsheets/d/e/2PACX-1vSDrHv3359NOsLcR5FqhRLs4MyYBxWzKI1iVZNVKT1_8vIPMOyqqzJF5qSah5cmYIuj182gYQAVwccm/pub?gid=1521741565&single=true&output=csv",
  transfers:   "https://docs.google.com/spreadsheets/d/e/2PACX-1vSDrHv3359NOsLcR5FqhRLs4MyYBxWzKI1iVZNVKT1_8vIPMOyqqzJF5qSah5cmYIuj182gYQAVwccm/pub?gid=157620707&single=true&output=csv",
};

// ══════════════════════════════════════════════════════════════
// DATA HELPERS — نفس المنطق من التطبيق الأصلي بالضبط
// ══════════════════════════════════════════════════════════════

// ① normalizeKey: يحذف الفراغات ويحول لـ lowercase — هذا هو السبب الرئيسي
function normalizeKey(value) {
  return String(value || "").replace(/\ufeff/g, "").trim().replaceAll(" ", "").toLowerCase();
}
function cleanId(value) { return String(value || "").trim(); }
function clean(value)   { return String(value || "").trim().toLowerCase(); }
function same(a, b)     { return cleanId(a) === cleanId(b); }
function toN(value)     { const n = Number(String(value || "0").replace(/[^0-9.-]/g, "")); return Number.isFinite(n) ? n : 0; }
function hasRecord(row) { return cleanId(row.id) || cleanId(row.trophyid) || cleanId(row.edition); }
function dateVal(d)     { const t = new Date(d || 0).getTime(); return Number.isFinite(t) ? t : 0; }
function fmt(n)         { return new Intl.NumberFormat("ar-SA").format(Math.round(n || 0)); }
function ini(name)      { return String(name || "").replace(/أبو\s+/,"").charAt(0) || "؟"; }
function avatarUrl(seed){ return "https://api.dicebear.com/8.x/initials/svg?seed=" + encodeURIComponent(seed || "user"); }
function normalizeImgUrl(url) {
  const s = String(url || "").trim();
  if (!s) return "";
  const dm = s.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if (dm?.[1]) return `https://drive.google.com/thumbnail?id=${dm[1]}&sz=w400`;
  return s;
}

// ② CSV parser — يستخدم normalizeKey على الـ headers
function parseCSV(text) {
  const t = String(text || "").replace(/^\ufeff/, "").trim();
  if (!t) return [];
  const rows = []; let row = [], cell = "", quoted = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i], nx = t[i+1];
    if (c==='"' && quoted && nx==='"') { cell+='"'; i++; }
    else if (c==='"') { quoted=!quoted; }
    else if (c===',' && !quoted) { row.push(cell); cell=""; }
    else if ((c==='\n'||c==='\r') && !quoted) {
      if (c==='\r'&&nx==='\n') i++;
      row.push(cell); rows.push(row); row=[]; cell="";
    } else cell+=c;
  }
  row.push(cell); rows.push(row);
  const nonEmpty = rows.filter(r=>r.some(c=>String(c||"").trim()));
  if (!nonEmpty.length) return [];
  // ← KEY: normalizeKey strips spaces, lowercases all headers
  const headers = nonEmpty[0].map(normalizeKey);
  return nonEmpty.slice(1).map(vals => {
    const obj = {};
    headers.forEach((h,i) => { obj[h] = String(vals[i]||"").trim(); });
    return obj;
  });
}

async function fetchCSV(url) {
  try {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) return [];
    return parseCSV(await r.text());
  } catch { return []; }
}

// ③ Member normalization — same as original
function isFifaSystemMember(m) { return same(m?.id,"FIFA") || clean(m?.name)==="fifa"; }
function isActiveSeasonMember(m) {
  if (!m || !cleanId(m.id) || isFifaSystemMember(m)) return false;
  const status = clean(m.status ?? m.memberstatus ?? m.active ?? m.isactive ?? "");
  return ["active","true","yes","1","نشط","فعال"].includes(status);
}
function getActiveMembers(members) {
  const active = members.filter(isActiveSeasonMember);
  return active.length ? active : members.filter(m => cleanId(m.id) && !isFifaSystemMember(m));
}

// ④ Tournament normalization — uses winnerid (NOT champion)
function buildTrophyMap(rows) {
  const map = {};
  rows.forEach(row => {
    const id = cleanId(row.trophyid || row.id || row.trophy);
    if (!id) return;
    map[id] = {
      id, name: row.name || row.trophyname || row.title || id,
      image: normalizeImgUrl(row.image || row.logo || row.icon || row.trophyimage),
      points: toN(row.points || row.point || row.score),
      order:  toN(row.order  || row.sort  || row.rank),
    };
  });
  return map;
}

function normalizeTournament(row, source, trophyMap) {
  const trophyId = cleanId(row.trophyid || row.trophy || (source==="league"?"league":""));
  const info = trophyMap[trophyId] || {};
  return {
    ...row,
    id:        row.id || `${trophyId}_${String(row.edition||"").padStart(3,"0")}`,
    source, trophyId,
    name:      info.name || row.trophyname || (trophyId==="league"?"الدوري":trophyId) || "",
    image:     info.image || row.image || "",
    points:    info.points || toN(row.points),
    order:     info.order  || 999,
    edition:   row.edition || row.version || "",
    // ← KEY: winnerid is the correct column name
    winnerId:  cleanId(row.winnerid || row.memberid || row.winner),
    winnerName:row.winnername || row.membername || "",
    date:      row.date || row.tournamentdate || "",
    seasonId:  cleanId(row.seasonid || row.season),
    system:    row.system || "",
    finalResult: row.finalresult || row.final || "",
    notes:     row.notes || row.note || "",
  };
}

// ⑤ Finance helpers — same complex logic as original
function getFinanceMemberId(row) {
  return cleanId(row?.memberid||row?.memberId||row?.member||row?.member_id||row?.membercode||row?.["رقمالعضو"]||row?.["العضو"]||"");
}
function getFinanceFromId(row) {
  return cleanId(row?.frommemberid||row?.fromMemberId||row?.from_member_id||row?.fromid||row?.["من"]||row?.["منالعضو"]||"");
}
function getFinanceToId(row) {
  return cleanId(row?.tomemberid||row?.toMemberId||row?.to_member_id||row?.toid||row?.["إلى"]||row?.["الى"]||row?.["إلىالعضو"]||"");
}
function isFinanceTransfer(row) {
  const explicit = clean(row?.direction||row?.dir||row?.kind||"");
  return explicit==="transfer"||explicit==="تحويل"||(!!getFinanceFromId(row)&&!!getFinanceToId(row));
}
function getFinanceDirection(row, memberId) {
  const t = clean(row?.type||row?.operation||row?.direction||row?.["النوع"]||"");
  if (t==="income"||t==="إيراد"||t==="دخل"||t==="مكافأة"||t==="reward") return "income";
  if (t==="expense"||t==="مصروف"||t==="خصم"||t==="غرامة"||t==="penalty") return "expense";
  return "income";
}
function getFinanceAmount(row, memberId) {
  const raw = row?.amount??row?.value??row?.total??row?.price??row?.cost??row?.fee??row?.["المبلغ"]??row?.["القيمة"]??"";
  const abs = Math.abs(toN(String(raw).replace(/[()]/g,"")));
  if (isFinanceTransfer(row)) {
    if (memberId&&same(getFinanceFromId(row),memberId)) return -abs;
    if (memberId&&same(getFinanceToId(row),memberId))   return  abs;
    return 0;
  }
  const dir = getFinanceDirection(row, memberId);
  return dir==="expense" ? -abs : abs;
}
function getMemberFinanceRows(rows, memberId) {
  const id = cleanId(memberId);
  if (!id) return [];
  return (rows||[]).filter(item => {
    if (isFinanceTransfer(item)) return same(getFinanceFromId(item),id)||same(getFinanceToId(item),id);
    return same(getFinanceMemberId(item),id);
  }).sort((a,b)=>dateVal(b.date||b.createdat)-dateVal(a.date||a.createdat));
}
function computeBalance(rows, fallback, memberId) {
  if (!rows?.length) return toN(fallback);
  return rows.reduce((sum,r)=>sum+getFinanceAmount(r,memberId),0);
}

// ⑥ Player stable ID — same as original
function getPlayerStableId(player) {
  return cleanId(player?.playerid||player?.playerId||player?.id||player?.name);
}

// ⑦ Transfer periods — same as original
function getTransferPeriods(rows) {
  const names = [];
  rows.forEach(row => {
    const name = row.period || row["الفترة"] || "الفترة الأولى";
    if (name && !names.includes(name)) names.push(name);
  });
  return names.map(name => ({
    id: clean(name), name,
    rows: rows.filter(r=>clean(r.period||r["الفترة"]||"الفترة الأولى")===clean(name)),
  }));
}

// ⑧ Season archive
function buildArchiveSeasons(seasons, allTourns) {
  const fallback = [...new Set(allTourns.map(t=>t.seasonId).filter(Boolean))].map(id=>({seasonid:id,seasonname:id}));
  const list = seasons.length ? seasons : fallback;
  return list.map(season => {
    const seasonId = cleanId(season.seasonid||season.id);
    const rows = allTourns.filter(t=>same(t.seasonId,seasonId));
    return {
      seasonId,
      seasonName: season.seasonname||season.name||seasonId,
      startDate:  season.startdate||season.start||"",
      endDate:    season.enddate||season.end||"",
      count:      toN(season.count)||rows.length,
      rows,
    };
  }).filter(s=>s.seasonId).sort((a,b)=>a.seasonId.localeCompare(b.seasonId));
}

// ══════════════════════════════════════════════════════════════
// MEMBER COLORS
// ══════════════════════════════════════════════════════════════
const MC = [
  {from:"#00E676",to:"#00B84C",sh:"rgba(0,230,118,0.5)"},
  {from:"#00D4FF",to:"#0088CC",sh:"rgba(0,212,255,0.5)"},
  {from:"#FF6B35",to:"#E63900",sh:"rgba(255,107,53,0.5)"},
  {from:"#A855F7",to:"#7C3AED",sh:"rgba(168,85,247,0.5)"},
  {from:"#FFD700",to:"#E6A800",sh:"rgba(255,215,0,0.5)"},
  {from:"#FF4757",to:"#C0392B",sh:"rgba(255,71,87,0.5)"},
  {from:"#4FC3F7",to:"#0288D1",sh:"rgba(79,195,247,0.5)"},
  {from:"#F472B6",to:"#BE185D",sh:"rgba(244,114,182,0.5)"},
];
const mColor = idx => MC[((idx??0)%MC.length+MC.length)%MC.length];

const SEASONS_DEF = [
  {id:"S1",label:"الموسم الأول",  years:"2017–2020",count:153,color:"#00D4FF"},
  {id:"S2",label:"الموسم الثاني", years:"2020–2021",count:206,color:"#A855F7"},
  {id:"S3",label:"الموسم الثالث", years:"2021–2023",count:203,color:"#FF6B35"},
  {id:"S4",label:"الموسم الرابع", years:"2023",     count:22, color:"#FFD700"},
  {id:"S5",label:"الموسم الخامس", years:"2024",     count:6,  color:"#F472B6"},
  {id:"S6",label:"الموسم السادس", years:"2025–الآن",count:"?",color:"#00E676",active:true},
];

const TICKER = [
  "⚽ FIFA GROUP — المنصة الرسمية",
  "🏆 سجل من 2017 إلى اليوم — أكثر من 590 بطولة",
  "🔄 بيانات حية من Firebase و Google Sheets",
  "⭐ الموسم السادس جارٍ الآن",
];

// ══════════════════════════════════════════════════════════════
// DATA HOOK — تحميل كل البيانات
// ══════════════════════════════════════════════════════════════
function useSheetData() {
  const [sheets, setSheets] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const [mR,pR,tR,lR,toR,sR,fR,trR] = await Promise.all([
          fetchCSV(URLS.members),
          fetchCSV(URLS.players),
          fetchCSV(URLS.trophies),
          fetchCSV(URLS.leagues),
          fetchCSV(URLS.tournaments),
          fetchCSV(URLS.seasons),
          fetchCSV(URLS.finance),
          fetchCSV(URLS.transfers),
        ]);

        // Build trophy map first
        const trophyMap = buildTrophyMap(tR);

        // Normalize tournaments using CORRECT winnerid column
        const leagues = lR.filter(hasRecord).map(r=>normalizeTournament(r,"league",trophyMap));
        const tourns  = toR.filter(hasRecord).map(r=>normalizeTournament(r,"tournament",trophyMap));
        const allTourns = [...leagues,...tourns].sort((a,b)=>dateVal(a.date)-dateVal(b.date));

        // Count trophies per member from tourneys
        const trophyCount = {};
        allTourns.forEach(t => {
          const wId = t.winnerId;
          if (wId) trophyCount[wId] = (trophyCount[wId]||0)+1;
        });

        // Members — getActiveMembers filters by status field
        const allMembers = mR.map(r=>({
          ...r,
          // normalizeKey already handled in parseCSV, so r.id, r.name, r.avatar etc are correct
          _trophies: trophyCount[cleanId(r.id)] || toN(r.trophies||r.totaltrphies||r.totaltrophies||0),
          _balance:  toN(r.balance||r.bal||0),
        }));

        // Filter active only (status = active/نشط etc.)
        const activeMembers = getActiveMembers(allMembers);

        // Sort by trophies
        activeMembers.sort((a,b)=>(b._trophies||0)-(a._trophies||0));
        activeMembers.forEach((m,i)=>m._idx=i);

        // Seasons
        const archiveSeasons = buildArchiveSeasons(sR, allTourns);

        // Transfer periods
        const transferPeriods = getTransferPeriods(trR);

        if (alive) setSheets({
          members: activeMembers,
          allMembers,
          players: pR,
          allTourns,
          trophyMap,
          finance: fR,
          transfers: trR,
          transferPeriods,
          archiveSeasons,
          seasons: sR,
        });
      } catch(e) {
        console.error("Sheet load error:", e);
        if(alive) setSheets({members:[],allMembers:[],players:[],allTourns:[],trophyMap:{},finance:[],transfers:[],transferPeriods:[],archiveSeasons:[],seasons:[]});
      } finally { if(alive) setLoading(false); }
    }
    load();
    return ()=>{alive=false;};
  },[]);

  return {sheets, loading};
}

function useFirebaseListener(col, authUser, norm) {
  const [rows,setRows] = useState([]);
  useEffect(()=>{
    if (!authUser){setRows([]);return;}
    const unsub = onSnapshot(
      collection(db,col),
      snap=>setRows(snap.docs.map(d=>norm({id:d.id,...d.data()}))),
      err=>{console.error(col,err);setRows([]);}
    );
    return unsub;
  },[authUser,col]);
  return rows;
}

// Firebase normalizers
const normFbTransfer = d => ({
  id:d.id, membId:cleanId(d.toMemberId||""), fromMembId:cleanId(d.fromMemberId||""),
  fromName:d.fromMemberName||"FIFA", toName:d.toMemberName||"",
  amt:toN(d.amount||0), type:d.typeLabel||d.type||"تحويل",
  desc:d.note||d.typeLabel||"عملية مالية",
  date:d.date||(d.createdAt?.toDate?.()?.toISOString?.()?.slice(0,10))||"", _raw:d,
});
const normFbOffer = d => ({
  id:d.id, fromMembId:cleanId(d.fromMemberId||""), toMembId:cleanId(d.toMemberId||""),
  fromName:d.fromMemberName||"", toName:d.toMemberName||"",
  playerName:d.targetPlayerName||"", playerImage:d.targetPlayerImage||"",
  playerRating:d.targetPlayerRating||"", playerPos:d.targetPlayerPosition||"",
  amt:toN(d.amount||0), type:d.type||"buy",
  status:clean(d.status||"pending"),
  date:d.dateKey||(d.createdAt?.toDate?.()?.toISOString?.()?.slice(0,10))||"", _raw:d,
});
const normFbNotif = d => ({
  id:d.id, title:d.title||"إشعار", body:d.body||"",
  type:d.type||"", status:clean(d.status||"unread"),
  toMembId:cleanId(d.toMemberId||""), audience:d.audience||"all",
  date:d.createdAt?.toDate?.()?.toISOString?.()?.slice(0,10)||"", _raw:d,
});
const normFbComp = d => ({
  id:d.id, name:d.name||"بطولة", type:d.type||"league",
  typeLabel:d.typeLabel||"", status:d.status||"active",
  champion:d.championMemberName||"", season:d.seasonId||"S6",
  date:d.date||"", _raw:d,
});

// ══════════════════════════════════════════════════════════════
// CSS
// ══════════════════════════════════════════════════════════════
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&family=Orbitron:wght@700;900&display=swap');
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
:root{
  --g:#00E676;--g2:#00B84C;--gdim:rgba(0,230,118,0.10);--gbor:rgba(0,230,118,0.25);
  --gold:#FFD700;--goldim:rgba(255,215,0,0.10);--goldbor:rgba(255,215,0,0.25);
  --blue:#00D4FF;--red:#FF4757;--purple:#A855F7;--orange:#FF6B35;
  --glass:rgba(255,255,255,0.032);--gbdr:rgba(255,255,255,0.07);
  --text:#EDF0FF;--sub:#6270A0;--sub2:#9BA0C0;--bg:#02030A;
  --nav:68px;--r:20px;
}
html,body{height:100%;background:var(--bg);font-family:'Tajawal',sans-serif;direction:rtl;color:var(--text);overflow-x:hidden;}
::-webkit-scrollbar{width:2px;height:2px;}::-webkit-scrollbar-thumb{background:rgba(0,230,118,0.2);border-radius:2px;}

.shell{max-width:430px;margin:0 auto;min-height:100dvh;display:flex;flex-direction:column;background:var(--bg);overflow:hidden;position:relative;}
.pitch-bg{position:fixed;inset:0;pointer-events:none;z-index:0;
  background-image:radial-gradient(ellipse 300px 150px at 50% -2%,rgba(0,230,118,0.08),transparent 65%),
    radial-gradient(circle at 8% 6%,rgba(0,230,118,0.09),transparent 50%),
    radial-gradient(circle at 94% 10%,rgba(168,85,247,0.07),transparent 50%),
    linear-gradient(rgba(0,230,118,0.02) 1px,transparent 1px),
    linear-gradient(90deg,rgba(0,230,118,0.02) 1px,transparent 1px);
  background-size:100% 100%,100% 100%,100% 100%,44px 44px,44px 44px;}

/* SPLASH */
.splash{position:fixed;inset:0;z-index:9999;background:#02030A;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;transition:opacity .5s ease;}
.splash.hide{opacity:0;pointer-events:none;}
.splash-logo{width:76px;height:76px;border-radius:22px;background:linear-gradient(135deg,var(--g),var(--blue));display:flex;align-items:center;justify-content:center;font-size:38px;box-shadow:0 0 60px rgba(0,230,118,0.4);animation:logoIn .6s ease .1s both;}
@keyframes logoIn{from{opacity:0;transform:scale(.5);}to{opacity:1;transform:scale(1);}}
.splash-title{font-size:26px;font-weight:900;font-family:'Orbitron',sans-serif;background:linear-gradient(90deg,#fff,var(--g));-webkit-background-clip:text;-webkit-text-fill-color:transparent;animation:fadeUp .5s ease .6s both;}
.splash-sub{font-size:11px;color:var(--sub2);font-weight:700;letter-spacing:2px;animation:fadeUp .5s ease .8s both;}
.splash-bar{width:160px;height:3px;background:rgba(255,255,255,0.06);border-radius:2px;overflow:hidden;animation:fadeUp .5s ease 1s both;}
.splash-fill{height:100%;background:linear-gradient(90deg,var(--g),var(--blue));animation:fillBar 1.8s ease 1.1s both;}
@keyframes fillBar{from{width:0;}to{width:100%;}}
@keyframes fadeUp{from{opacity:0;transform:translateY(10px);}to{opacity:1;transform:translateY(0);}}

/* LOGIN */
.login-wrap{min-height:100dvh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;position:relative;z-index:1;}
.login-card{width:100%;max-width:380px;background:linear-gradient(145deg,rgba(4,8,20,0.94),rgba(8,18,36,0.82));border:1px solid rgba(0,230,118,0.18);border-radius:28px;padding:28px 22px;}
.login-logo{width:60px;height:60px;border-radius:18px;background:linear-gradient(135deg,var(--g),var(--blue));display:flex;align-items:center;justify-content:center;font-size:30px;margin:0 auto 16px;box-shadow:0 0 40px rgba(0,230,118,0.35);}
.login-title{font-size:22px;font-weight:900;text-align:center;margin-bottom:4px;font-family:'Orbitron',sans-serif;background:linear-gradient(90deg,#fff,var(--g));-webkit-background-clip:text;-webkit-text-fill-color:transparent;}
.login-sub{font-size:11px;color:var(--sub2);text-align:center;font-weight:700;letter-spacing:1px;margin-bottom:22px;}
.login-field{margin-bottom:12px;}
.login-field label{display:block;font-size:12px;font-weight:700;color:var(--sub2);margin-bottom:6px;}
.login-field input{width:100%;height:48px;border-radius:16px;border:1px solid rgba(0,230,118,0.15);background:rgba(2,6,23,0.70);color:var(--text);padding:0 14px;font-size:14px;font-family:'Tajawal',sans-serif;outline:none;transition:border-color .2s;}
.login-field input:focus{border-color:rgba(0,230,118,0.40);}
.login-btn{width:100%;height:50px;border:none;border-radius:16px;background:linear-gradient(135deg,var(--g),var(--g2));color:#020617;font-weight:900;font-size:16px;font-family:'Tajawal',sans-serif;cursor:pointer;margin-top:6px;box-shadow:0 8px 24px rgba(0,230,118,0.30);}
.login-btn:disabled{opacity:.55;}
.login-err{background:rgba(255,71,87,0.10);border:1px solid rgba(255,71,87,0.25);border-radius:12px;padding:10px 14px;font-size:13px;color:var(--red);font-weight:700;text-align:center;margin-top:10px;}

/* TICKER */
.ticker{height:28px;background:linear-gradient(90deg,rgba(0,230,118,0.10),rgba(0,212,255,0.07),rgba(0,230,118,0.10));border-bottom:1px solid rgba(0,230,118,0.18);overflow:hidden;display:flex;align-items:center;position:relative;z-index:91;flex-shrink:0;}
.ticker::before,.ticker::after{content:'';position:absolute;top:0;bottom:0;width:30px;z-index:1;}
.ticker::before{right:0;background:linear-gradient(to right,transparent,#05060F);}
.ticker::after{left:0;background:linear-gradient(to left,transparent,#05060F);}
.tick-track{display:flex;white-space:nowrap;animation:tickMove 28s linear infinite;}
@keyframes tickMove{from{transform:translateX(0);}to{transform:translateX(-50%);}}
.tick-item{font-size:11px;font-weight:700;color:var(--sub2);padding:0 24px;flex-shrink:0;}

/* TOPBAR */
.topbar{position:sticky;top:0;z-index:90;display:flex;align-items:center;justify-content:space-between;padding:11px 14px 9px;background:rgba(2,3,10,0.94);backdrop-filter:blur(30px);border-bottom:1px solid var(--gbdr);flex-shrink:0;}
.topbar::after{content:'';position:absolute;bottom:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,var(--g),var(--blue),var(--g),transparent);opacity:.35;}
.brand{display:flex;align-items:center;gap:9px;}
.brand-ico{width:34px;height:34px;border-radius:10px;background:linear-gradient(135deg,var(--g),var(--blue));display:flex;align-items:center;justify-content:center;font-size:17px;box-shadow:0 0 16px rgba(0,230,118,0.35);}
.brand-txt h1{font-size:13px;font-weight:900;font-family:'Orbitron',sans-serif;background:linear-gradient(90deg,#fff 20%,var(--g));-webkit-background-clip:text;-webkit-text-fill-color:transparent;}
.brand-txt p{font-size:9px;font-weight:700;color:var(--g);letter-spacing:2px;}
.top-actions{display:flex;align-items:center;gap:8px;}
.notif-btn{width:34px;height:34px;border-radius:50%;border:1px solid var(--gbdr);background:var(--glass);display:flex;align-items:center;justify-content:center;font-size:16px;cursor:pointer;position:relative;color:var(--text);}
.notif-dot{position:absolute;top:-2px;left:-2px;width:10px;height:10px;border-radius:50%;background:var(--red);border:2px solid var(--bg);animation:pulse 1.4s infinite;}
@keyframes pulse{0%,100%{opacity:1;}50%{opacity:.4;}}
.season-chip{display:flex;align-items:center;gap:5px;background:var(--gdim);border:1px solid var(--gbor);border-radius:20px;padding:4px 11px;font-size:11px;font-weight:700;color:var(--g);}
.ldot{width:6px;height:6px;border-radius:50%;background:var(--g);animation:pulse 1.4s infinite;}
.logout-btn{width:30px;height:30px;border-radius:50%;border:1px solid rgba(255,71,87,0.25);background:rgba(255,71,87,0.08);color:var(--red);font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;}

/* NAV */
.bnav{position:sticky;bottom:0;width:100%;height:var(--nav);background:rgba(4,5,14,0.97);backdrop-filter:blur(30px);border-top:1px solid var(--gbdr);display:flex;align-items:flex-end;justify-content:space-around;padding:0 2px 9px;z-index:200;flex-shrink:0;position:relative;}
.bnav::before{content:'';position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,var(--g),var(--blue),var(--g),transparent);opacity:.3;}
.nb{display:flex;flex-direction:column;align-items:center;gap:3px;padding:6px 8px 4px;border-radius:13px;cursor:pointer;transition:all .2s;min-width:42px;border:none;background:transparent;font-family:'Tajawal',sans-serif;position:relative;}
.nb.on{background:linear-gradient(135deg,rgba(0,230,118,0.10),rgba(0,212,255,0.06));}
.nb.on::before{content:'';position:absolute;inset:0;border-radius:13px;border:1px solid rgba(0,230,118,0.22);}
.nb .ni{font-size:19px;transition:transform .2s;}.nb.on .ni{transform:scale(1.15);}
.nb .nl{font-size:9px;font-weight:700;color:var(--sub);font-family:'Tajawal',sans-serif;}.nb.on .nl{color:var(--g);}
.nbdot{position:absolute;top:4px;right:3px;width:7px;height:7px;border-radius:50%;background:var(--red);border:1.5px solid var(--bg);}

/* PAGE */
.page{flex:1;padding:13px 12px 14px;overflow-y:auto;animation:pgIn .28s ease both;position:relative;z-index:1;}
@keyframes pgIn{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}

/* SHARED */
.lbl{font-size:10px;font-weight:800;color:var(--sub);letter-spacing:2px;text-transform:uppercase;margin:18px 0 10px;display:flex;align-items:center;gap:8px;}
.lbl::after{content:'';flex:1;height:1px;background:linear-gradient(to left,transparent,var(--gbdr));}
.lbl:first-child{margin-top:4px;}
.gcard{background:var(--glass);border:1px solid var(--gbdr);border-radius:var(--r);padding:14px;backdrop-filter:blur(8px);}
.tag{display:inline-flex;align-items:center;border-radius:20px;padding:3px 10px;font-size:10px;font-weight:800;}
.tg{background:var(--gdim);color:var(--g);border:1px solid var(--gbor);}
.ty{background:var(--goldim);color:var(--gold);border:1px solid var(--goldbor);}
.tb{background:rgba(0,212,255,.1);color:var(--blue);border:1px solid rgba(0,212,255,.25);}
.tz{background:rgba(98,112,160,.1);color:var(--sub2);border:1px solid var(--gbdr);}
.tr{background:rgba(255,71,87,.1);color:var(--red);border:1px solid rgba(255,71,87,.25);}
.pills{display:flex;gap:7px;overflow-x:auto;margin-bottom:13px;scrollbar-width:none;}.pills::-webkit-scrollbar{display:none;}
.pill{flex-shrink:0;padding:6px 14px;border-radius:20px;font-size:12px;font-weight:700;cursor:pointer;border:1px solid var(--gbdr);background:var(--glass);color:var(--sub);transition:all .18s;font-family:'Tajawal',sans-serif;}
.pill.on{background:var(--gdim);border-color:var(--gbor);color:var(--g);}
.backbtn{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--sub2);cursor:pointer;padding:5px 0;margin-bottom:8px;background:none;border:none;font-family:'Tajawal',sans-serif;}
.aitem{display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid rgba(255,255,255,0.03);}
.aitem:last-child{border-bottom:none;}
.adot{width:8px;height:8px;border-radius:50%;flex-shrink:0;}
.abody{flex:1;font-size:12.5px;line-height:1.45;}.abody b{color:var(--g);}
.atime{font-size:10px;color:var(--sub);flex-shrink:0;}
.loader{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:80px 20px;gap:14px;color:var(--sub);font-size:14px;font-weight:700;}
.spin{width:36px;height:36px;border:3px solid rgba(255,255,255,0.08);border-top-color:var(--g);border-radius:50%;animation:spinA .75s linear infinite;}
@keyframes spinA{to{transform:rotate(360deg);}}
.empty-state{text-align:center;padding:40px 20px;color:var(--sub);font-size:13px;font-weight:700;}
@keyframes cardIn{from{opacity:0;transform:translateY(12px) scale(.97);}to{opacity:1;transform:translateY(0) scale(1);}}
.ca{animation:cardIn .3s ease both;}
.ca:nth-child(2){animation-delay:.05s;}.ca:nth-child(3){animation-delay:.10s;}.ca:nth-child(4){animation-delay:.15s;}.ca:nth-child(5){animation-delay:.20s;}.ca:nth-child(6){animation-delay:.25s;}
@keyframes float{0%,100%{transform:translateY(0);}50%{transform:translateY(-5px);}}
.float{animation:float 2.8s ease-in-out infinite;}

/* HOME */
.hero{border-radius:24px;padding:20px 16px 16px;position:relative;overflow:hidden;margin-bottom:13px;background:linear-gradient(145deg,#040C1C,#081830 45%,#050D1E);border:1px solid rgba(0,230,118,0.20);}
.hero::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse at 82% 12%,rgba(0,230,118,0.12),transparent 48%),radial-gradient(ellipse at 15% 80%,rgba(0,212,255,0.07),transparent 48%);pointer-events:none;}
.hero-scan{position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,var(--g),transparent);animation:scanL 3s ease-in-out infinite;opacity:.6;}
@keyframes scanL{0%,100%{top:0;opacity:0;}50%{top:100%;opacity:.8;}}
.hero-badge{display:inline-flex;align-items:center;gap:6px;background:rgba(255,215,0,0.10);border:1px solid rgba(255,215,0,0.22);border-radius:20px;padding:4px 12px;font-size:10px;font-weight:800;color:var(--gold);margin-bottom:10px;}
.hero-name{font-size:26px;font-weight:900;line-height:1.05;margin-bottom:2px;background:linear-gradient(135deg,#fff 40%,var(--g));-webkit-background-clip:text;-webkit-text-fill-color:transparent;}
.hero-club{font-size:12px;color:var(--sub2);margin-bottom:14px;}
.hero-grid{display:grid;grid-template-columns:repeat(4,1fr);border-radius:14px;overflow:hidden;border:1px solid rgba(255,255,255,0.05);}
.hst{padding:10px 6px;text-align:center;border-left:1px solid rgba(255,255,255,0.05);background:rgba(0,0,0,0.2);}.hst:last-child{border-left:none;}
.hst .v{font-size:17px;font-weight:900;color:var(--g);}.hst .l{font-size:9px;color:var(--sub);font-weight:700;margin-top:2px;}
.qsgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin-bottom:13px;}
.qsc{background:var(--glass);border:1px solid var(--gbdr);border-radius:17px;padding:12px 8px;text-align:center;position:relative;overflow:hidden;}
.qsc::after{content:'';position:absolute;bottom:0;left:0;right:0;height:2px;}
.qsc.qg::after{background:linear-gradient(90deg,var(--g),var(--blue));}.qsc.qb::after{background:linear-gradient(90deg,var(--blue),var(--purple));}.qsc.qy::after{background:linear-gradient(90deg,var(--gold),var(--orange));}
.qsc .qi{font-size:20px;margin-bottom:5px;}.qsc .qv{font-size:19px;font-weight:900;}.qsc .ql{font-size:9.5px;color:var(--sub);font-weight:600;margin-top:2px;}

/* SEASON TIMELINE */
.timeline{display:flex;overflow-x:auto;padding-bottom:4px;scrollbar-width:none;position:relative;margin-bottom:4px;}
.timeline::-webkit-scrollbar{display:none;}
.timeline::before{content:'';position:absolute;top:21px;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,rgba(0,230,118,0.2),transparent);}
.tl-item{flex-shrink:0;display:flex;flex-direction:column;align-items:center;gap:5px;padding:0 12px;cursor:pointer;}
.tl-dot{width:13px;height:13px;border-radius:50%;border:2px solid;transition:all .2s;z-index:1;}
.tl-item.act .tl-dot{width:17px;height:17px;box-shadow:0 0 12px currentColor;}
.tl-label{font-size:9px;font-weight:800;color:var(--sub);white-space:nowrap;}
.tl-item.act .tl-label{color:var(--text);}
.tl-count{font-size:11px;font-weight:900;}
.season-box{border-radius:18px;padding:13px;margin-top:12px;position:relative;overflow:hidden;border:1px solid;}
.season-box::before{content:'';position:absolute;inset:0;background:linear-gradient(135deg,rgba(255,255,255,0.04),transparent);pointer-events:none;}

/* MEMBER CARDS */
.mcard{display:flex;align-items:center;gap:12px;padding:12px 13px;border-radius:var(--r);margin-bottom:9px;cursor:pointer;position:relative;overflow:hidden;border:1px solid var(--gbdr);background:var(--glass);backdrop-filter:blur(10px);transition:transform .18s;}
.mcard:active{transform:scale(.98);}
.mcard::before{content:'';position:absolute;inset:0;background:linear-gradient(135deg,rgba(255,255,255,0.025),transparent);pointer-events:none;}
.mcard.g1{border-color:rgba(255,215,0,.28);background:rgba(255,215,0,.04);}
.mcard.g2{border-color:rgba(192,192,192,.18);}
.mcard.g3{border-color:rgba(205,127,50,.18);}
.mrk{width:28px;height:28px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:900;flex-shrink:0;}
.r1{background:linear-gradient(135deg,#FFD700,#E6A800);color:#000;box-shadow:0 2px 10px rgba(255,215,0,.4);}
.r2{background:linear-gradient(135deg,#D8D8D8,#A0A0A0);color:#000;}
.r3{background:linear-gradient(135deg,#CD7F32,#9A5A1A);color:#fff;}
.rn{background:var(--glass);border:1px solid var(--gbdr);color:var(--sub);}
.mav-wrap{width:50px;height:50px;border-radius:15px;flex-shrink:0;overflow:hidden;position:relative;}
.mav-img{width:100%;height:100%;object-fit:cover;}
.mav-ini{width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:900;color:#fff;}
.mi{flex:1;min-width:0;}.mname{font-size:14px;font-weight:800;}.mclub{font-size:11px;color:var(--sub2);margin-top:2px;}
.mright{display:flex;flex-direction:column;align-items:flex-end;gap:3px;}
.mbal{font-size:13px;font-weight:900;color:var(--g);}.mtrph{font-size:11px;color:var(--gold);}
.mrtg{position:absolute;top:9px;left:11px;background:rgba(255,215,0,.12);border:1px solid rgba(255,215,0,.25);border-radius:6px;padding:2px 6px;font-size:11px;font-weight:900;color:var(--gold);}

/* MEMBER DETAIL */
.dh{border-radius:24px;padding:20px 14px 16px;display:flex;flex-direction:column;align-items:center;position:relative;overflow:hidden;margin-bottom:13px;}
.dh::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse at 50% -5%,rgba(0,230,118,0.10),transparent 55%);pointer-events:none;}
.dav-wrap{width:76px;height:76px;border-radius:22px;margin-bottom:10px;overflow:hidden;position:relative;}
.dav-img{width:100%;height:100%;object-fit:cover;}
.dav-ini{width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:32px;font-weight:900;color:#fff;}
.dname{font-size:22px;font-weight:900;margin-bottom:2px;}.dclub{font-size:12px;color:var(--sub2);margin-bottom:14px;}
.dsgrid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;width:100%;}
.dstat{background:rgba(0,0,0,.22);border-radius:13px;padding:9px 6px;text-align:center;border:1px solid rgba(255,255,255,.05);}
.dstat .dv{font-size:17px;font-weight:900;}.dstat .dl{font-size:9px;color:var(--sub2);font-weight:600;margin-top:1px;}
.prow{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,.04);}
.prow:last-child{border-bottom:none;}
.pav{width:38px;height:38px;border-radius:11px;flex-shrink:0;object-fit:cover;background:rgba(255,255,255,.05);}
.pav-fb{width:38px;height:38px;border-radius:11px;flex-shrink:0;background:var(--gdim);border:1px solid var(--gbor);display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:900;color:var(--g);}
.pinfo{flex:1;min-width:0;}.pname{font-size:13px;font-weight:700;}.pnat{font-size:10px;color:var(--sub);}
.prtg{background:rgba(255,215,0,.1);border:1px solid rgba(255,215,0,.22);border-radius:7px;padding:2px 8px;font-size:12px;font-weight:900;color:var(--gold);}

/* TOURNAMENT CARDS */
.tcard{background:var(--glass);border:1px solid var(--gbdr);border-radius:var(--r);padding:14px;margin-bottom:10px;position:relative;overflow:hidden;backdrop-filter:blur(8px);}
.tcard::before{content:'';position:absolute;inset:0;background:linear-gradient(135deg,rgba(255,255,255,.02),transparent);pointer-events:none;}
.tacbar{position:absolute;top:0;right:0;width:80px;height:3px;}
.tname{font-size:15px;font-weight:900;margin-bottom:2px;margin-top:7px;}.tedit{font-size:11px;color:var(--sub2);margin-bottom:10px;}
.tchamp{display:flex;align-items:center;gap:10px;border-radius:12px;padding:9px 11px;background:rgba(255,215,0,0.07);border:1px solid rgba(255,215,0,0.18);}
.tcl{font-size:10px;color:var(--sub);font-weight:600;}.tcn{font-size:14px;font-weight:900;color:var(--gold);}

/* ARCHIVE SEASON */
.archive-season{background:var(--glass);border:1px solid var(--gbdr);border-radius:var(--r);padding:14px;margin-bottom:10px;backdrop-filter:blur(8px);}
.archive-season-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;cursor:pointer;}
.archive-season-name{font-size:16px;font-weight:900;}
.archive-season-count{font-size:13px;font-weight:900;color:var(--g);}
.archive-tourn-list{display:grid;gap:6px;}
.archive-tourn-row{display:flex;align-items:center;gap:10px;padding:8px 10px;background:rgba(0,0,0,.2);border-radius:12px;border:1px solid rgba(255,255,255,.05);}
.archive-tourn-name{flex:1;font-size:12px;font-weight:700;}
.archive-tourn-winner{font-size:12px;font-weight:800;color:var(--gold);}
.archive-tourn-date{font-size:10px;color:var(--sub);white-space:nowrap;}

/* TRANSFERS/OFFERS */
.offer-card{background:var(--glass);border:1px solid var(--gbdr);border-radius:var(--r);padding:13px;margin-bottom:9px;backdrop-filter:blur(8px);position:relative;overflow:hidden;}
.offer-card::after{content:'';position:absolute;right:0;top:0;bottom:0;width:3px;}
.offer-card.pending::after{background:var(--gold);}
.offer-card.completed::after,.offer-card.approvedpendingwindow::after{background:var(--g);}
.offer-card.rejected::after,.offer-card.cancelledbybuy::after{background:var(--red);}
.offer-player{font-size:14px;font-weight:900;margin-bottom:4px;}
.offer-route{display:flex;align-items:center;gap:5px;font-size:11px;color:var(--sub2);}
.offer-arr{color:var(--g);font-weight:900;}
.trcard{display:flex;align-items:center;gap:11px;padding:12px 13px;background:var(--glass);border:1px solid var(--gbdr);border-radius:var(--r);margin-bottom:8px;backdrop-filter:blur(8px);}
.trico{width:42px;height:42px;border-radius:13px;background:linear-gradient(135deg,#0D1A35,#071020);border:1px solid rgba(255,255,255,.07);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;}
.trinfo{flex:1;min-width:0;}.trplayer{font-size:14px;font-weight:900;margin-bottom:3px;}
.trroute{display:flex;align-items:center;gap:5px;font-size:11px;color:var(--sub2);}.trarr{color:var(--g);font-weight:900;}
.trdate{font-size:10px;color:var(--sub);margin-top:3px;}
.trright{display:flex;flex-direction:column;align-items:flex-end;gap:4px;}
.tramt{font-size:15px;font-weight:900;color:var(--g);}.tramt.free{font-size:12px;color:var(--sub2);font-weight:600;}

/* FINANCE */
.fsum3{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:13px;}
.fsb{border-radius:16px;padding:12px 8px;text-align:center;position:relative;overflow:hidden;}
.fsb::before{content:'';position:absolute;inset:0;background:linear-gradient(135deg,rgba(255,255,255,.04),transparent);pointer-events:none;}
.fsb.fi{background:rgba(0,230,118,.07);border:1px solid rgba(0,230,118,.18);}
.fsb.fo{background:rgba(255,71,87,.07);border:1px solid rgba(255,71,87,.18);}
.fsb.fn{background:rgba(0,212,255,.07);border:1px solid rgba(0,212,255,.18);}
.fsb .fv{font-size:16px;font-weight:900;margin-bottom:3px;}
.fsb.fi .fv{color:var(--g);}.fsb.fo .fv{color:var(--red);}.fsb.fn .fv{color:var(--blue);}
.fsb .fl{font-size:9px;color:var(--sub);font-weight:700;}
.fitem{display:flex;align-items:center;gap:10px;padding:11px 12px;background:var(--glass);border:1px solid var(--gbdr);border-radius:15px;margin-bottom:7px;position:relative;overflow:hidden;}
.fitem::after{content:'';position:absolute;right:0;top:0;bottom:0;width:3px;border-radius:0 15px 15px 0;}
.fitem.fi::after{background:linear-gradient(to bottom,var(--g),var(--g2));}
.fitem.fo::after{background:linear-gradient(to bottom,var(--red),#AA2233);}
.fitem.fx::after{background:linear-gradient(to bottom,var(--blue),#0088AA);}
.fico{width:38px;height:38px;border-radius:11px;display:flex;align-items:center;justify-content:center;font-size:17px;flex-shrink:0;}
.fico.fi{background:rgba(0,230,118,.1);}.fico.fo{background:rgba(255,71,87,.1);}.fico.fx{background:rgba(0,212,255,.1);}
.fmeta{flex:1;min-width:0;}.fmem{font-size:12px;font-weight:800;}.fdesc{font-size:10px;color:var(--sub2);margin-top:1px;}.fdate{font-size:9.5px;color:var(--sub);margin-top:1px;}
.famt{font-size:15px;font-weight:900;}.famt.pos{color:var(--g);}.famt.neg{color:var(--red);}
.wbr{display:flex;align-items:center;gap:9px;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.03);}.wbr:last-child{border-bottom:none;}
.wbn{font-size:12px;font-weight:800;width:64px;flex-shrink:0;}
.wbt{flex:1;height:5px;background:var(--glass);border-radius:3px;overflow:hidden;}
.wbf{height:100%;border-radius:3px;}
.wba{font-size:11px;font-weight:900;width:48px;text-align:left;flex-shrink:0;}

/* RANKINGS */
.podium{display:flex;align-items:flex-end;justify-content:center;gap:8px;margin-bottom:18px;}
.pod-item{flex:1;display:flex;flex-direction:column;align-items:center;gap:5px;}
.pod-name{font-size:11px;font-weight:800;text-align:center;}
.pod-pts{font-size:10px;font-weight:900;color:var(--sub2);}
.pod-base{width:100%;display:flex;align-items:center;justify-content:center;font-size:20px;border-radius:10px 10px 0 0;border:1px solid;border-bottom:none;}
.pod-1{height:72px;background:rgba(255,215,0,.1);border-color:rgba(255,215,0,.25);}
.pod-2{height:54px;background:rgba(192,192,192,.08);border-color:rgba(192,192,192,.2);}
.pod-3{height:42px;background:rgba(205,127,50,.08);border-color:rgba(205,127,50,.18);}
.rkhd{display:grid;grid-template-columns:34px 1fr 48px 42px 64px;gap:4px;padding:5px 11px;font-size:9px;font-weight:800;color:var(--sub);letter-spacing:.5px;text-align:center;}
.rkhd>:nth-child(2){text-align:right;}
.rkrow{display:grid;grid-template-columns:34px 1fr 48px 42px 64px;gap:4px;align-items:center;padding:10px 11px;background:var(--glass);border:1px solid var(--gbdr);border-radius:14px;margin-bottom:6px;text-align:center;backdrop-filter:blur(8px);position:relative;overflow:hidden;transition:transform .18s;}
.rkrow:active{transform:scale(.98);}
.rkrow.t1{border-color:rgba(255,215,0,.28);background:rgba(255,215,0,.04);}
.rkrow.t1::after,.rkrow.t2::after,.rkrow.t3::after{content:'';position:absolute;right:0;top:0;bottom:0;width:3px;border-radius:0 14px 14px 0;}
.rkrow.t1::after{background:linear-gradient(to bottom,#FFD700,#E6A800);}
.rkrow.t2::after{background:linear-gradient(to bottom,#C8C8C8,#888);}
.rkrow.t3::after{background:linear-gradient(to bottom,#CD7F32,#9A5A1A);}
.rknum{font-size:13px;font-weight:900;color:var(--sub);}.t1 .rknum{color:var(--gold);}
.rknw{text-align:right;}.rkn{font-size:13px;font-weight:800;display:flex;align-items:center;gap:5px;}.rkcl{font-size:9.5px;color:var(--sub2);}
.rktrph{color:var(--gold);font-weight:800;font-size:12px;}.rkrtg{font-weight:900;color:var(--g);font-size:12px;}.rkbal{font-size:11px;font-weight:700;}
.ptsbar{width:100%;height:3px;background:var(--glass);border-radius:2px;overflow:hidden;margin-top:2px;}
.ptsfill{height:100%;border-radius:2px;}
.h2h-btn{margin-top:12px;width:100%;height:44px;border-radius:14px;border:1px solid var(--gbor);background:var(--gdim);color:var(--g);font-family:'Tajawal',sans-serif;font-weight:800;font-size:14px;cursor:pointer;}
.h2h-overlay{position:fixed;inset:0;z-index:600;background:rgba(0,0,0,.72);display:flex;align-items:flex-end;padding:16px;}
.h2h-card{width:100%;background:linear-gradient(145deg,#06091A,#0A0F28);border:1px solid rgba(0,230,118,.2);border-radius:24px 24px 20px 20px;padding:18px;animation:pgIn .3s ease;}
.h2h-title{font-size:13px;font-weight:800;color:var(--sub2);text-align:center;letter-spacing:1px;margin-bottom:14px;}
.h2h-sel{display:flex;gap:7px;overflow-x:auto;margin-bottom:12px;scrollbar-width:none;}.h2h-sel::-webkit-scrollbar{display:none;}
.h2h-chip{flex-shrink:0;padding:5px 12px;border-radius:20px;border:1px solid var(--gbdr);background:var(--glass);color:var(--sub);font-family:'Tajawal',sans-serif;font-weight:700;font-size:11px;cursor:pointer;transition:all .18s;}
.h2h-chip.on{background:var(--gdim);border-color:var(--gbor);color:var(--g);}
.h2h-grid{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:8px;margin-bottom:12px;}
.h2h-side{display:flex;flex-direction:column;align-items:center;gap:5px;}
.h2h-name{font-size:12px;font-weight:800;text-align:center;}
.h2h-vs{font-size:22px;font-weight:900;color:var(--sub);text-align:center;}
.h2h-stat{display:grid;grid-template-columns:1fr 70px 1fr;gap:4px;align-items:center;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.04);}
.h2h-stat:last-child{border-bottom:none;}
.h2h-val{font-size:15px;font-weight:900;}.h2h-val.l{text-align:left;}.h2h-val.r{text-align:right;}
.h2h-lbl{font-size:10px;color:var(--sub);font-weight:700;text-align:center;}
.h2h-close{margin-top:12px;width:100%;height:40px;border-radius:12px;border:1px solid var(--gbdr);background:var(--glass);color:var(--sub2);font-family:'Tajawal',sans-serif;font-weight:700;font-size:13px;cursor:pointer;}

/* NOTIF PANEL */
.notif-overlay{position:fixed;inset:0;z-index:800;background:rgba(0,0,0,.7);display:flex;align-items:flex-end;padding:16px;}
.notif-panel{width:100%;max-height:70dvh;overflow-y:auto;background:linear-gradient(145deg,#06091A,#0A0F28);border:1px solid rgba(0,230,118,0.18);border-radius:24px 24px 20px 20px;padding:18px;animation:pgIn .3s ease;}
.notif-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;}
.notif-head h3{font-size:17px;font-weight:900;}
.notif-close{width:32px;height:32px;border-radius:50%;border:1px solid var(--gbdr);background:var(--glass);color:var(--sub2);font-size:18px;cursor:pointer;}
.notif-item{background:var(--glass);border:1px solid rgba(0,230,118,.12);border-radius:14px;padding:11px;margin-bottom:8px;}
.notif-item.read{opacity:.6;}
.notif-item b,.notif-item p,.notif-item small{display:block;margin:0;}
.notif-item p{font-size:12px;color:var(--sub2);line-height:1.4;margin-top:4px;}
.notif-item small{font-size:10px;color:var(--sub);margin-top:5px;}
`;

// ══════════════════════════════════════════════════════════════
// MINI COMPONENTS
// ══════════════════════════════════════════════════════════════
const MemberAvatar = ({ m, size=50, radius=15 }) => {
  const c = mColor(m._idx||0);
  const imgUrl = normalizeImgUrl(m.avatar||m.image||m.photo||"");
  const fallbackUrl = avatarUrl(m.name||m.id);
  return (
    <div style={{width:size,height:size,borderRadius:radius,flexShrink:0,overflow:"hidden",
      boxShadow:`0 4px 16px ${c.sh}`,border:`2px solid ${c.from}40`,position:"relative"}}>
      {imgUrl
        ? <img src={imgUrl} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}
            onError={e=>{e.target.onerror=null;e.target.src=fallbackUrl;}}/>
        : <div style={{width:"100%",height:"100%",background:`linear-gradient(135deg,${c.from},${c.to})`,
            display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*.4,fontWeight:900,color:"#fff"}}>
            {ini(m.name)}
          </div>
      }
    </div>
  );
};

const MiniAvatar = ({ m, size=22 }) => {
  const c = mColor(m._idx||0);
  return (
    <div style={{width:size,height:size,borderRadius:size*0.3,flexShrink:0,overflow:"hidden",
      background:`linear-gradient(135deg,${c.from},${c.to})`,display:"flex",alignItems:"center",
      justifyContent:"center",fontSize:size*.42,fontWeight:900,color:"#fff"}}>
      {ini(m.name)}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════
// LOGIN
// ══════════════════════════════════════════════════════════════
function LoginPage() {
  const [email,setEmail]=useState("");
  const [pass,setPass]=useState("");
  const [busy,setBusy]=useState(false);
  const [err,setErr]=useState("");
  async function handleLogin(e){
    e.preventDefault();
    if(!email||!pass){setErr("أدخل البريد وكلمة المرور");return;}
    setBusy(true);setErr("");
    try{await signInWithEmailAndPassword(auth,email.trim(),pass);}
    catch(e){
      const msgs={"auth/invalid-credential":"البريد أو كلمة المرور غير صحيحة","auth/user-not-found":"الحساب غير موجود","auth/wrong-password":"كلمة المرور غير صحيحة","auth/too-many-requests":"محاولات كثيرة، انتظر","auth/network-request-failed":"تحقق من الإنترنت"};
      setErr(msgs[e.code]||"حدث خطأ، حاول مجدداً");
    }finally{setBusy(false);}
  }
  return(
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-logo">⚽</div>
        <div className="login-title">FIFA GROUP</div>
        <div className="login-sub">الموسم السادس · 2025</div>
        <form onSubmit={handleLogin}>
          <div className="login-field"><label>البريد الإلكتروني</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="example@email.com" autoComplete="email"/></div>
          <div className="login-field"><label>كلمة المرور</label><input type="password" value={pass} onChange={e=>setPass(e.target.value)} placeholder="••••••••" autoComplete="current-password"/></div>
          <button className="login-btn" type="submit" disabled={busy}>{busy?"جاري الدخول...":"دخول ⚡"}</button>
        </form>
        {err&&<div className="login-err">⚠️ {err}</div>}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// H2H
// ══════════════════════════════════════════════════════════════
function H2H({members,onClose}){
  const [sel,setSel]=useState([]);
  const m1=sel[0]?members.find(m=>m.id===sel[0]):null;
  const m2=sel[1]?members.find(m=>m.id===sel[1]):null;
  const c1=m1?mColor(m1._idx||0):null;
  const c2=m2?mColor(m2._idx||0):null;
  const toggle=id=>sel.includes(id)?setSel(sel.filter(x=>x!==id)):sel.length<2?setSel([...sel,id]):setSel([sel[1],id]);
  const rows=[
    {l:"🏆 الألقاب",v1:m1?._trophies||0,v2:m2?._trophies||0},
    {l:"💰 الرصيد",v1:m1?._balance||0,v2:m2?._balance||0,fmt:true},
  ];
  return(
    <div className="h2h-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="h2h-card">
        <div className="h2h-title">⚔️ المقارنة المباشرة</div>
        <div className="h2h-sel">
          {members.map(m=><button key={m.id} className={`h2h-chip${sel.includes(m.id)?" on":""}`} onClick={()=>toggle(m.id)}>{m.name}</button>)}
        </div>
        {m1&&m2?(
          <>
            <div className="h2h-grid">
              <div className="h2h-side"><MemberAvatar m={m1} size={50} radius={15}/><div className="h2h-name" style={{color:c1.from}}>{m1.name}</div></div>
              <div className="h2h-vs">VS</div>
              <div className="h2h-side"><MemberAvatar m={m2} size={50} radius={15}/><div className="h2h-name" style={{color:c2.from}}>{m2.name}</div></div>
            </div>
            {rows.map(r=>{const w1=r.v1>r.v2,w2=r.v2>r.v1;return(
              <div key={r.l} className="h2h-stat">
                <div className="h2h-val l" style={{color:w1?c1.from:"var(--sub2)",fontWeight:w1?900:700}}>{r.fmt?fmt(r.v1):r.v1}</div>
                <div className="h2h-lbl">{r.l}</div>
                <div className="h2h-val r" style={{color:w2?c2.from:"var(--sub2)",fontWeight:w2?900:700}}>{r.fmt?fmt(r.v2):r.v2}</div>
              </div>
            );})}
          </>
        ):<div style={{textAlign:"center",padding:"18px 0",color:"var(--sub)",fontSize:13,fontWeight:700}}>اختر عضوين للمقارنة</div>}
        <button className="h2h-close" onClick={onClose}>إغلاق</button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// NOTIFICATIONS PANEL
// ══════════════════════════════════════════════════════════════
function NotifPanel({notifs,currentMembId,onClose}){
  const mine=notifs.filter(n=>n.audience==="all"||same(n.toMembId,currentMembId)).slice(0,20);
  return(
    <div className="notif-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="notif-panel">
        <div className="notif-head"><h3>🔔 الإشعارات ({mine.length})</h3><button className="notif-close" onClick={onClose}>✕</button></div>
        {mine.length===0?<div className="empty-state">📭 لا توجد إشعارات</div>:mine.map((n,i)=>(
          <div key={i} className={`notif-item${n.status==="read"?" read":""}`}>
            <b>{n.title}</b>
            {n.body&&<p>{n.body}</p>}
            {n.date&&<small>📅 {n.date}</small>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// PAGES
// ══════════════════════════════════════════════════════════════

// ── HOME ──────────────────────────────────────────────────────
function HomePage({sheets,fbTransfers,fbComps}){
  const {members,allTourns,transfers}=sheets;
  const [activeSeason,setActiveSeason]=useState("S6");
  const champ=members[0];
  const seasonDef=SEASONS_DEF.find(s=>s.id===activeSeason)||SEASONS_DEF[5];
  const activeComps=fbComps.filter(c=>c.status==="active");

  return(
    <div className="page">
      {champ&&(
        <div className="hero ca">
          <div className="hero-scan"/>
          <div style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",fontSize:90,opacity:.055,lineHeight:1,pointerEvents:"none",filter:"grayscale(1)"}}>🏆</div>
          <div className="hero-badge">👑 الأكثر ألقاباً</div>
          <div className="hero-name">{champ.name}</div>
          <div className="hero-club">{champ.nationalteam||champ.national||""} {champ.team||"FIFA GROUP"}</div>
          <div className="hero-grid">
            {[{v:champ._trophies||0,l:"🏆 ألقاب"},{v:champ.rating||"—",l:"⭐ تقييم"},{v:fmt(champ._balance||0)||"—",l:"💰 رصيد"},{v:allTourns.length,l:"📋 بطولة"}].map((s,i)=>(
              <div key={i} className="hst"><div className="v">{s.v}</div><div className="l">{s.l}</div></div>
            ))}
          </div>
        </div>
      )}

      <div className="qsgrid">
        <div className="qsc qg ca"><div className="qi">👥</div><div className="qv" style={{color:"var(--g)"}}>{members.length}</div><div className="ql">أعضاء نشطين</div></div>
        <div className="qsc qb ca"><div className="qi">🏆</div><div className="qv" style={{color:"var(--blue)"}}>{allTourns.length}</div><div className="ql">بطولة</div></div>
        <div className="qsc qy ca"><div className="qi">🔄</div><div className="qv" style={{color:"var(--gold)"}}>{transfers.length}</div><div className="ql">انتقال</div></div>
      </div>

      {activeComps.length>0&&<>
        <div className="lbl">🔴 بطولات نشطة الآن</div>
        {activeComps.slice(0,3).map((c,i)=>(
          <div key={i} className="tcard ca">
            <div className="tacbar" style={{background:"linear-gradient(90deg,var(--g),var(--blue))"}}/>
            <div style={{marginBottom:4}}><span className="tag tg">نشطة 🔴</span></div>
            <div className="tname">{c.name}</div>
            <div className="tedit">{c.typeLabel||c.type} · {c.season}</div>
            {c.champion&&<div className="tchamp"><div style={{fontSize:22}} className="float">🏆</div><div><div className="tcl">البطل</div><div className="tcn">🥇 {c.champion}</div></div></div>}
          </div>
        ))}
      </>}

      <div className="lbl">🕐 المواسم التاريخية</div>
      <div className="timeline">
        {SEASONS_DEF.map(s=>{
          const act=s.id===activeSeason;
          const cnt=s.id==="S6"?allTourns.filter(t=>same(t.seasonId,"S6")).length||s.count:s.count;
          return(
            <div key={s.id} className={`tl-item${act?" act":""}`} onClick={()=>setActiveSeason(s.id)}>
              <div className="tl-dot" style={{background:act?s.color:"transparent",borderColor:s.color,boxShadow:act?`0 0 10px ${s.color}`:undefined}}/>
              <div className="tl-label" style={{color:act?s.color:undefined}}>{s.id}</div>
              <div className="tl-count" style={{color:s.color}}>{cnt}</div>
            </div>
          );
        })}
      </div>
      {seasonDef&&(
        <div className="season-box ca" style={{borderColor:`${seasonDef.color}30`,background:`${seasonDef.color}08`}}>
          <div style={{fontSize:10,fontWeight:800,color:seasonDef.color,letterSpacing:1.5,marginBottom:6}}>{seasonDef.label}</div>
          <div style={{fontSize:19,fontWeight:900,marginBottom:2}}>{seasonDef.years}</div>
          <div style={{display:"flex",alignItems:"baseline",gap:8}}>
            <div style={{fontSize:28,fontWeight:900,color:seasonDef.color}}>{seasonDef.id==="S6"?allTourns.filter(t=>same(t.seasonId,"S6")).length||"?":seasonDef.count}</div>
            <div style={{fontSize:11,color:"var(--sub2)"}}>بطولة مسجلة</div>
          </div>
        </div>
      )}

      {fbTransfers.length>0&&<>
        <div className="lbl">📡 آخر التحويلات المالية</div>
        <div className="gcard ca">
          {fbTransfers.slice(0,5).map((t,i)=>(
            <div key={i} className="aitem">
              <div className="adot" style={{background:t.amt>0?"var(--g)":"var(--blue)"}}/>
              <div className="abody"><b>{t.type}</b> — {t.fromName}→{t.toName}</div>
              <div style={{fontSize:12,fontWeight:900,color:"var(--g)",flexShrink:0}}>{t.amt>0?`+${fmt(t.amt)}`:"—"}</div>
            </div>
          ))}
        </div>
      </>}
    </div>
  );
}

// ── MEMBERS ───────────────────────────────────────────────────
function MembersPage({sheets,fbOffers,currentMembId}){
  const {members,players,allTourns,finance}=sheets;
  const [sel,setSel]=useState(null);

  if(sel){
    const m=sel;
    const c=mColor(m._idx||0);
    // Filter players by this member's id
    const mPlayers=players.filter(p=>same(cleanId(p.memberid||p.memberId||p.member_id||""),cleanId(m.id)));
    const mTourns=allTourns.filter(t=>same(t.winnerId,m.id)||(t.winnerName&&same(t.winnerName,m.name)));
    const mFinance=getMemberFinanceRows(finance,m.id);
    const myOffers=fbOffers.filter(o=>same(o.fromMembId,m.id)||same(o.toMembId,m.id));
    const mBalance=computeBalance(mFinance,m._balance||m.balance||0,m.id);
    const imgUrl=normalizeImgUrl(m.avatar||m.image||m.photo||"");

    return(
      <div className="page">
        <button className="backbtn" onClick={()=>setSel(null)}>← رجوع للأعضاء</button>
        <div className="dh ca" style={{background:`linear-gradient(145deg,#05090F,${c.from}14 50%,#04070E)`,border:`1px solid ${c.from}25`}}>
          <div className="dav-wrap" style={{boxShadow:`0 0 40px ${c.sh}`,border:`3px solid ${c.from}40`}}>
            {imgUrl
              ? <img className="dav-img" src={imgUrl} alt="" onError={e=>{e.target.onerror=null;e.target.src=avatarUrl(m.name);}}/>
              : <div className="dav-ini" style={{background:`linear-gradient(135deg,${c.from},${c.to})`}}>{ini(m.name)}</div>
            }
          </div>
          <div className="dname">{m.name}</div>
          <div className="dclub">{m.nationalteam||m.national||""} {m.team||""}</div>
          <div className="dsgrid">
            {[
              {v:m._trophies||0,         l:"🏆 ألقاب",  col:"var(--gold)"},
              {v:m.rating||"—",           l:"⭐ تقييم",  col:"var(--blue)"},
              {v:fmt(mBalance)||"0",       l:"💰 رصيد",   col:"var(--g)"},
              {v:mPlayers.length,          l:"👟 لاعبين", col:"var(--purple)"},
            ].map((s,i)=>(
              <div key={i} className="dstat"><div className="dv" style={{color:s.col}}>{s.v}</div><div className="dl">{s.l}</div></div>
            ))}
          </div>
        </div>

        {/* Players */}
        {mPlayers.length>0&&<>
          <div className="lbl">👟 قائمة اللاعبين ({mPlayers.length})</div>
          <div className="gcard">
            {mPlayers.sort((a,b)=>toN(b.rating)-toN(a.rating)).slice(0,20).map((p,i)=>{
              const imgP=normalizeImgUrl(p.image||p.avatar||p.photo||"");
              return(
                <div key={i} className="prow">
                  {imgP
                    ? <img className="pav" src={imgP} alt="" onError={e=>{e.target.style.display="none";}}/>
                    : <div className="pav-fb">{p.position||p.pos||"—"}</div>
                  }
                  <div className="pinfo">
                    <div className="pname">{p.name}</div>
                    <div className="pnat">{p.national||p.nationality||""} {p.team||p.club||""}</div>
                    {(p.contracttype||p.contract)&&<div style={{fontSize:9.5,color:"var(--sub)",marginTop:2}}>{p.contracttype||p.contract}</div>}
                  </div>
                  <div className="prtg">{p.rating||"—"}</div>
                </div>
              );
            })}
          </div>
        </>}

        {/* Firebase Offers */}
        {myOffers.length>0&&<>
          <div className="lbl">🔄 عروض الانتقال ({myOffers.length})</div>
          {myOffers.slice(0,8).map((o,i)=>{
            const statusLabel={pending:"⏳ معلق",completed:"✅ مكتمل",rejected:"❌ مرفوض",approvedpendingwindow:"⏸ بانتظار السوق",cancelledbybuy:"🚫 ملغى",cancelledbybuyer:"🚫 ملغى"};
            const statusColor={pending:"var(--gold)",completed:"var(--g)",rejected:"var(--red)",approvedpendingwindow:"var(--blue)"};
            return(
              <div key={i} className={`offer-card ${o.status}`}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  {o.playerImage&&<img src={o.playerImage} alt="" style={{width:40,height:40,borderRadius:11,objectFit:"cover",background:"rgba(255,255,255,.05)"}}/>}
                  <div style={{flex:1}}>
                    <div className="offer-player">{o.playerName||"لاعب"}</div>
                    <div className="offer-route">
                      <span>{o.fromName}</span><span className="offer-arr">→</span><span>{o.toName}</span>
                    </div>
                    {o.date&&<div style={{fontSize:10,color:"var(--sub)",marginTop:3}}>📅 {o.date}</div>}
                  </div>
                  <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}>
                    <span style={{fontSize:10,fontWeight:800,color:statusColor[o.status]||"var(--sub2)"}}>{statusLabel[o.status]||o.status}</span>
                    {o.amt>0&&<div style={{fontSize:13,fontWeight:900,color:"var(--g)"}}>{fmt(o.amt)} 💰</div>}
                  </div>
                </div>
              </div>
            );
          })}
        </>}

        {/* Trophies */}
        {mTourns.length>0&&<>
          <div className="lbl">🏆 الألقاب ({mTourns.length})</div>
          <div className="gcard">
            {mTourns.slice(0,12).map((t,i)=>(
              <div key={i} className="aitem">
                <div className="adot" style={{background:"var(--gold)",boxShadow:"0 0 6px var(--gold)"}}/>
                <div className="abody">{t.name||t.trophyId}</div>
                <div style={{fontSize:10,color:"var(--sub)",flexShrink:0}}>{t.date||t.seasonId}</div>
              </div>
            ))}
          </div>
        </>}

        {/* Finance */}
        {mFinance.length>0&&<>
          <div className="lbl">💸 السجل المالي ({mFinance.length})</div>
          <div className="gcard">
            {mFinance.slice(0,10).map((f,i)=>{
              const amt=getFinanceAmount(f,m.id);
              const desc=f.description||f.note||f.type||f.notes||"حركة مالية";
              return(
                <div key={i} className="aitem">
                  <div className="adot" style={{background:amt>=0?"var(--g)":"var(--red)"}}/>
                  <div className="abody">{desc}</div>
                  <div style={{fontSize:13,fontWeight:900,color:amt>=0?"var(--g)":"var(--red)",flexShrink:0}}>{amt>=0?"+":""}{fmt(Math.abs(amt))}</div>
                </div>
              );
            })}
          </div>
        </>}
      </div>
    );
  }

  return(
    <div className="page">
      <div className="lbl">👥 الأعضاء النشطون ({members.length})</div>
      {members.map((m,i)=>{
        const c=mColor(m._idx||0);
        const cls=`mcard ca${i===0?" g1":i===1?" g2":i===2?" g3":""}`;
        const rcls=`mrk ${i===0?"r1":i===1?"r2":i===2?"r3":"rn"}`;
        const pendingOffers=fbOffers.filter(o=>(same(o.fromMembId,m.id)||same(o.toMembId,m.id))&&o.status==="pending").length;
        return(
          <div key={m.id||i} className={cls} onClick={()=>setSel(m)}>
            <div className={rcls}>{i===0?"🥇":i===1?"🥈":i===2?"🥉":i+1}</div>
            <MemberAvatar m={m} size={50} radius={15}/>
            <div className="mi">
              <div className="mname">{m.name}</div>
              <div className="mclub">{m.nationalteam||m.national||""} {m.team||""}</div>
              {pendingOffers>0&&<div style={{fontSize:10,color:"var(--gold)",fontWeight:700,marginTop:3}}>⏳ {pendingOffers} عرض معلق</div>}
            </div>
            <div className="mright">
              <div className="mbal">{fmt(m._balance||m.balance||0)||"0"} 💰</div>
              <div className="mtrph">🏆 {m._trophies||0}</div>
            </div>
            <div className="mrtg">{m.rating||"—"}</div>
          </div>
        );
      })}
    </div>
  );
}

// ── TOURNAMENTS (السجل العام) ──────────────────────────────────
function TournamentsPage({sheets,fbComps}){
  const {members,allTourns,archiveSeasons}=sheets;
  const [f,setF]=useState("archive");
  const [expanded,setExpanded]=useState({});

  // Champion stats from all tournaments
  const champStats=useMemo(()=>{
    const map={};
    allTourns.forEach(t=>{
      const wId=t.winnerId;
      if(!wId||same(wId,"FIFA")) return;
      const m=members.find(mm=>same(mm.id,wId));
      const name=m?.name||t.winnerName||wId;
      map[name]=(map[name]||0)+1;
    });
    return Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,6);
  },[allTourns,members]);

  const activeComps=fbComps.filter(c=>c.status==="active");
  const completedComps=fbComps.filter(c=>c.status==="completed");

  return(
    <div className="page">
      <div className="pills">
        {[{k:"archive",l:"📚 الأرشيف"},{k:"active",l:"🔴 نشطة"},{k:"completed",l:"✅ منتهية"},{k:"stats",l:"📊 إحصاء"}].map(p=>(
          <button key={p.k} className={`pill${f===p.k?" on":""}`} onClick={()=>setF(p.k)}>{p.l}</button>
        ))}
      </div>

      {/* ARCHIVE — السجل العام للبطولات */}
      {f==="archive"&&<>
        <div className="lbl">📚 السجل العام للبطولات — {allTourns.length} بطولة</div>
        {archiveSeasons.length===0
          ? <div className="empty-state">📭 لا توجد بيانات في الأرشيف</div>
          : archiveSeasons.map((s,si)=>(
            <div key={si} className="archive-season ca">
              <div className="archive-season-head" onClick={()=>setExpanded(e=>({...e,[s.seasonId]:!e[s.seasonId]}))}>
                <div>
                  <div className="archive-season-name">{s.seasonName}</div>
                  {s.startDate&&<div style={{fontSize:10,color:"var(--sub)",marginTop:2}}>{s.startDate}{s.endDate?` — ${s.endDate}`:""}</div>}
                </div>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <div className="archive-season-count">🏆 {s.count}</div>
                  <div style={{color:"var(--sub)",fontSize:14}}>{expanded[s.seasonId]?"▲":"▼"}</div>
                </div>
              </div>
              {expanded[s.seasonId]&&(
                <div className="archive-tourn-list">
                  {s.rows.slice(0,50).map((t,ti)=>{
                    const m=members.find(mm=>same(mm.id,t.winnerId));
                    const c=m?mColor(m._idx||0):{from:"var(--gold)"};
                    return(
                      <div key={ti} className="archive-tourn-row">
                        <div className="archive-tourn-name">{t.name||t.trophyId}</div>
                        {t.winnerId&&<div className="archive-tourn-winner" style={{color:c.from}}>🥇 {m?.name||t.winnerName||t.winnerId}</div>}
                        <div className="archive-tourn-date">{t.date}</div>
                      </div>
                    );
                  })}
                  {s.rows.length>50&&<div style={{textAlign:"center",fontSize:11,color:"var(--sub)",padding:"8px 0"}}>+{s.rows.length-50} بطولة أخرى</div>}
                </div>
              )}
            </div>
          ))
        }
      </>}

      {/* ACTIVE COMPETITIONS from Firebase */}
      {f==="active"&&<>
        <div className="lbl">🔴 البطولات النشطة ({activeComps.length})</div>
        {activeComps.length===0?<div className="empty-state">📭 لا توجد بطولات نشطة</div>:activeComps.map((c,i)=>(
          <div key={i} className="tcard ca">
            <div className="tacbar" style={{background:"linear-gradient(90deg,var(--g),var(--blue))"}}/>
            <div style={{marginBottom:4}}><span className="tag tg">نشطة</span></div>
            <div className="tname">{c.name}</div>
            <div className="tedit">{c.typeLabel||c.type} · {c.season}</div>
          </div>
        ))}
      </>}

      {/* COMPLETED from Firebase */}
      {f==="completed"&&<>
        <div className="lbl">✅ البطولات المنتهية ({completedComps.length})</div>
        {completedComps.length===0?<div className="empty-state">📭 لا توجد بطولات منتهية</div>:completedComps.map((c,i)=>{
          const m=members.find(mm=>same(mm.name,c.champion)||same(mm.id,c.champion));
          const col=m?mColor(m._idx||0):{from:"var(--gold)"};
          return(
            <div key={i} className="tcard ca">
              <div className="tacbar" style={{background:`linear-gradient(90deg,${col.from},${col.to})`}}/>
              <span className="tag ty">منتهية</span>
              <div className="tname">{c.name}</div>
              <div className="tedit">{c.typeLabel||c.type} · {c.season} {c.date?`· ${c.date}`:""}</div>
              {c.champion&&<div className="tchamp"><div style={{fontSize:22}} className="float">🏆</div><div><div className="tcl">البطل</div><div className="tcn">🥇 {c.champion}</div></div></div>}
            </div>
          );
        })}
      </>}

      {/* STATS */}
      {f==="stats"&&<>
        <div className="lbl">📊 أكثر الأعضاء ألقاباً</div>
        <div className="gcard ca">
          {champStats.length===0?<div style={{color:"var(--sub)",fontSize:13,textAlign:"center",padding:"16px 0"}}>لا توجد بيانات</div>:champStats.map(([name,count],i)=>{
            const m=members.find(mm=>same(mm.name,name)||same(mm.id,name));
            const c=m?mColor(m._idx||0):mColor(i);
            return(
              <div key={name} className="aitem">
                <div style={{width:8,height:8,borderRadius:"50%",background:c.from,flexShrink:0,boxShadow:`0 0 8px ${c.from}`}}/>
                <div style={{flex:1,fontSize:13,fontWeight:800}}>{name}</div>
                <div style={{fontSize:15,fontWeight:900,color:c.from}}>🏆 {count}</div>
              </div>
            );
          })}
        </div>
        <div style={{margin:"12px 0 0",textAlign:"center",fontSize:11,color:"var(--sub)"}}>إجمالي البطولات المسجلة: {allTourns.length}</div>
      </>}
    </div>
  );
}

// ── MARKET ────────────────────────────────────────────────────
function MarketPage({sheets,fbOffers}){
  const {transfers,transferPeriods}=sheets;
  const [f,setF]=useState("offers");
  const [period,setPeriod]=useState(transferPeriods[0]?.id||"");
  const curPeriod=transferPeriods.find(p=>p.id===period)||transferPeriods[0];
  const maxAmt=Math.max(1,...(curPeriod?.rows||transfers).map(t=>toN(t.amount||t.amt||0)));
  const pendingOffers=fbOffers.filter(o=>o.status==="pending");
  const activeOffers=fbOffers.filter(o=>["pending","approvedpendingwindow"].includes(o.status));

  return(
    <div className="page">
      {/* Market summary */}
      <div style={{display:"flex",gap:0,background:"linear-gradient(135deg,rgba(0,230,118,.05),rgba(0,212,255,.04))",border:"1px solid var(--gbdr)",borderRadius:20,padding:"12px 14px",marginBottom:13}}>
        {[
          {v:fbOffers.filter(o=>o.status==="completed").length,l:"✅ مكتملة",col:"var(--g)"},
          {v:pendingOffers.length,l:"⏳ معلقة",col:"var(--gold)"},
          {v:transferPeriods.length,l:"📅 فترات",col:"var(--blue)"},
        ].map((s,i)=>(
          <div key={i} style={{flex:1,textAlign:"center",borderLeft:i>0?"1px solid rgba(255,255,255,.04)":undefined}}>
            <div style={{fontSize:17,fontWeight:900,color:s.col,marginBottom:2}}>{s.v}</div>
            <div style={{fontSize:9,color:"var(--sub)",fontWeight:700}}>{s.l}</div>
          </div>
        ))}
      </div>

      <div className="pills">
        {[{k:"offers",l:"🔄 العروض"},{k:"sheets",l:"📋 سجل الانتقالات"}].map(p=>(
          <button key={p.k} className={`pill${f===p.k?" on":""}`} onClick={()=>setF(p.k)}>{p.l}</button>
        ))}
      </div>

      {f==="offers"&&<>
        <div className="lbl">🔄 عروض الانتقالات ({fbOffers.length})</div>
        {fbOffers.length===0?<div className="empty-state">📭 لا توجد عروض</div>:fbOffers.slice().sort((a,b)=>(b.status==="pending"?1:0)-(a.status==="pending"?1:0)).slice(0,30).map((o,i)=>{
          const statusColor={pending:"var(--gold)",completed:"var(--g)",rejected:"var(--red)",approvedpendingwindow:"var(--blue)"};
          const statusLabel={pending:"⏳ معلق",completed:"✅ مكتمل",rejected:"❌ مرفوض",approvedpendingwindow:"⏸ بانتظار السوق",cancelledbybuyer:"🚫 ملغى"};
          return(
            <div key={i} className={`offer-card ${o.status} ca`}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div className="trico">⚽</div>
                <div style={{flex:1}}>
                  <div className="offer-player">{o.playerName||"لاعب"}</div>
                  <div className="offer-route"><span>{o.fromName}</span><span className="offer-arr">→</span><span>{o.toName}</span></div>
                  {o.date&&<div style={{fontSize:10,color:"var(--sub)",marginTop:3}}>📅 {o.date}</div>}
                </div>
                <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}>
                  <span style={{fontSize:10,fontWeight:800,color:statusColor[o.status]||"var(--sub2)"}}>{statusLabel[o.status]||o.status}</span>
                  {o.amt>0&&<div style={{fontSize:13,fontWeight:900,color:"var(--g)"}}>{fmt(o.amt)} 💰</div>}
                  <span className="tag" style={{fontSize:9}}>{o.type==="loan"?"إعارة":"شراء"}</span>
                </div>
              </div>
            </div>
          );
        })}
      </>}

      {f==="sheets"&&<>
        {/* Period filter */}
        {transferPeriods.length>1&&(
          <div className="pills">
            {transferPeriods.map(p=><button key={p.id} className={`pill${period===p.id?" on":""}`} onClick={()=>setPeriod(p.id)}>{p.name}</button>)}
          </div>
        )}
        <div className="lbl">📋 {curPeriod?.name||"الانتقالات"} ({curPeriod?.rows?.length||transfers.length})</div>
        {(curPeriod?.rows||transfers).length===0?<div className="empty-state">📭 لا توجد انتقالات</div>:(curPeriod?.rows||transfers).slice().reverse().slice(0,40).map((t,i)=>{
          const player=t.player||t.playername||t.name||"لاعب";
          const from=t.from||t.frommember||t.frommembername||"السوق الحر";
          const to=t.to||t.tomember||t.tomembername||"—";
          const amt=toN(t.amount||t.amt||0);
          return(
            <div key={i} className="trcard ca">
              <div className="trico">⚽</div>
              <div className="trinfo">
                <div className="trplayer">{player}</div>
                <div className="trroute"><span style={{color:"var(--sub2)"}}>{from}</span><span className="trarr">→</span><span>{to}</span></div>
                {(t.date||t.tournamentdate)&&<div className="trdate">📅 {t.date||t.tournamentdate}</div>}
                {amt>0&&<div style={{marginTop:4,height:3,borderRadius:2,background:"var(--glass)",overflow:"hidden",width:"70%"}}>
                  <div style={{height:"100%",borderRadius:2,width:`${(amt/maxAmt)*100}%`,background:"linear-gradient(90deg,var(--g),var(--blue))"}}/>
                </div>}
              </div>
              <div className="trright">
                {amt>0?<div className="tramt">{fmt(amt)} 💰</div>:<div className="tramt free">مجاني</div>}
                {(t.type||t.contracttype)&&<span className="tag tz">{t.type||t.contracttype}</span>}
              </div>
            </div>
          );
        })}
      </>}
    </div>
  );
}

// ── FINANCE ────────────────────────────────────────────────────
function FinancePage({sheets,fbTransfers}){
  const {members,finance}=sheets;
  const allFin=useMemo(()=>[...finance,...fbTransfers.map(t=>({...t._raw,_fb:true}))]
    ,[finance,fbTransfers]);
  const tin=allFin.reduce((s,f)=>{ const a=toN(f.amount||f.amt||0); return a>0?s+a:s; },0);
  const tout=allFin.reduce((s,f)=>{ const a=toN(f.amount||f.amt||0); return a<0?s+Math.abs(a):s; },0);
  const net=tin-tout;
  const maxBal=Math.max(1,...members.map(m=>m._balance||toN(m.balance)||0));

  return(
    <div className="page">
      <div className="fsum3">
        <div className="fsb fi ca"><div className="fv">+{fmt(tin)}</div><div className="fl">إجمالي الدخل</div></div>
        <div className="fsb fo ca"><div className="fv">{fmt(tout)}</div><div className="fl">المصروف</div></div>
        <div className="fsb fn ca"><div className="fv" style={{color:net>=0?"var(--g)":"var(--red)"}}>{net>=0?"+":""}{fmt(net)}</div><div className="fl">الصافي</div></div>
      </div>
      <div className="lbl">💰 ثروة الأعضاء</div>
      <div className="gcard ca">
        {members.filter(m=>(m._balance||toN(m.balance)||0)>0).map((m,i)=>{
          const c=mColor(m._idx||0);
          const bal=m._balance||toN(m.balance)||0;
          return(
            <div key={m.id||i} className="wbr">
              <div className="wbn" style={{color:c.from}}>{m.name}</div>
              <div className="wbt"><div className="wbf" style={{width:`${(bal/maxBal)*100}%`,background:`linear-gradient(90deg,${c.from},${c.to})`,boxShadow:`0 0 8px ${c.sh}`}}/></div>
              <div className="wba" style={{color:c.from}}>{fmt(bal)}</div>
            </div>
          );
        })}
        {members.filter(m=>(m._balance||toN(m.balance)||0)>0).length===0&&
          <div style={{color:"var(--sub)",fontSize:13,textAlign:"center",padding:"16px 0"}}>لا توجد بيانات رصيد</div>
        }
      </div>
      <div className="lbl">📋 آخر العمليات ({allFin.length})</div>
      {allFin.length===0?<div className="empty-state">📭 لا توجد عمليات</div>:allFin.slice().reverse().slice(0,30).map((f,i)=>{
        const amt=toN(f.amount||f.amt||0);
        const dir=amt>=0?"fi":"fo";
        const memberId=cleanId(f.memberid||f.memberId||f.tomemberid||f.toMemberId||f.member||"");
        const m=members.find(mm=>same(mm.id,memberId));
        const desc=f.description||f.note||f.typeLabel||f.type||"حركة مالية";
        const date=f.date||f.createdat||"";
        return(
          <div key={i} className={`fitem ${dir} ca`}>
            <div className={`fico ${dir}`}>{amt>=0?"💵":"💸"}</div>
            <div className="fmeta">
              <div className="fmem">{m?.name||memberId||"—"}</div>
              <div className="fdesc">{desc}</div>
              {date&&<div className="fdate">📅 {date}</div>}
            </div>
            <div className={`famt ${amt>=0?"pos":"neg"}`}>{amt>=0?"+":""}{fmt(Math.abs(amt))}</div>
          </div>
        );
      })}
    </div>
  );
}

// ── RANKINGS ──────────────────────────────────────────────────
function RankingsPage({sheets}){
  const {members}=sheets;
  const [h2h,setH2h]=useState(false);
  const sorted=[...members].sort((a,b)=>(b._trophies||0)-(a._trophies||0));
  const maxT=sorted[0]?._trophies||1;

  return(
    <div className="page">
      {sorted.length>=3&&(
        <div className="podium ca">
          {[sorted[1],sorted[0],sorted[2]].map((m,i)=>{
            const c=mColor(m._idx||0);
            const heights=["54px","72px","42px"];
            const medals=["🥈","🥇","🥉"];
            const pC=["pod-2","pod-1","pod-3"];
            return(
              <div key={m.id||i} className="pod-item">
                {i===1&&<div style={{fontSize:22,textAlign:"center"}} className="float">👑</div>}
                <MemberAvatar m={m} size={i===1?56:46} radius={i===1?17:14}/>
                <div className="pod-name" style={{color:i===1?c.from:undefined}}>{m.name}</div>
                <div className="pod-pts" style={{color:i===1?"var(--g)":undefined}}>{m._trophies||0} 🏆</div>
                <div className={`pod-base ${pC[i]}`} style={{height:heights[i]}}><span style={{fontSize:i===1?26:18}}>{medals[i]}</span></div>
              </div>
            );
          })}
        </div>
      )}

      <div className="lbl">📊 الترتيب الكامل</div>
      <div className="rkhd"><span>#</span><span style={{textAlign:"right"}}>العضو</span><span>ألقاب</span><span>تقييم</span><span>رصيد</span></div>
      {sorted.map((m,i)=>{
        const c=mColor(m._idx||0);
        return(
          <div key={m.id||i} className={`rkrow ca ${i===0?"t1":i===1?"t2":i===2?"t3":""}`}>
            <div className="rknum">{i===0?"🥇":i===1?"🥈":i===2?"🥉":i+1}</div>
            <div className="rknw">
              <div className="rkn">
                <MiniAvatar m={m} size={20}/>
                {m.name}
              </div>
              <div className="rkcl">{m.team||""}</div>
              <div className="ptsbar"><div className="ptsfill" style={{width:`${((m._trophies||0)/maxT)*100}%`,background:`linear-gradient(90deg,${c.from},${c.to})`}}/></div>
            </div>
            <div className="rktrph">🏆 {m._trophies||0}</div>
            <div className="rkrtg" style={{color:c.from}}>{m.rating||"—"}</div>
            <div className="rkbal" style={{fontSize:11,color:"var(--sub2)"}}>{fmt(m._balance||toN(m.balance)||0)||"—"}</div>
          </div>
        );
      })}

      <button className="h2h-btn" onClick={()=>setH2h(true)}>⚔️ المقارنة المباشرة بين عضوين</button>

      <div style={{marginTop:14,padding:"12px 13px",background:"var(--glass)",border:"1px solid var(--gbdr)",borderRadius:15}}>
        <div style={{fontSize:10,color:"var(--sub)",fontWeight:800,marginBottom:8,letterSpacing:1}}>الترتيب حسب</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
          {[["🏆 إجمالي الألقاب","الأساس"],["💰 الرصيد","ثانوي"],["⭐ التقييم","إضافي"]].map(([l,v])=>(
            <div key={l} style={{background:"var(--bg)",borderRadius:9,padding:"4px 10px",fontSize:11,display:"flex",gap:5,alignItems:"center",border:"1px solid var(--gbdr)"}}>
              <span>{l}</span><span style={{color:"var(--g)",fontWeight:900}}>{v}</span>
            </div>
          ))}
        </div>
      </div>

      {h2h&&<H2H members={sorted} onClose={()=>setH2h(false)}/>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// APP SHELL
// ══════════════════════════════════════════════════════════════
const TABS=[
  {id:"home",    icon:"🏠",label:"الرئيسية"},
  {id:"members", icon:"👥",label:"الأعضاء"},
  {id:"tourns",  icon:"🏆",label:"البطولات"},
  {id:"market",  icon:"🔄",label:"السوق"},
  {id:"finance", icon:"💰",label:"المالية"},
  {id:"rankings",icon:"📊",label:"التصنيف"},
];
const HDRS={
  home:    {t:"فيفا جروب",        s:"FIFA GROUP V4"},
  members: {t:"الأعضاء",          s:"MEMBERS"},
  tourns:  {t:"السجل العام",       s:"TOURNAMENT ARCHIVE"},
  market:  {t:"سوق الانتقالات",   s:"TRANSFER MARKET"},
  finance: {t:"المالية",           s:"FINANCIAL RECORDS"},
  rankings:{t:"التصنيف",           s:"SEASON RANKINGS"},
};

export default function App(){
  const [tab,setTab]=useState("home");
  const [splash,setSplash]=useState(true);
  const [notifOpen,setNotif]=useState(false);
  const [authUser,setAuthUser]=useState(null);
  const [authProfile,setAuthProfile]=useState(null);
  const [authLoading,setAuthLoading]=useState(true);

  const {sheets,loading}=useSheetData();

  const fbTransfers=useFirebaseListener("moneyTransfers",authUser,normFbTransfer);
  const fbOffers=useFirebaseListener("playerOffers",authUser,normFbOffer);
  const fbNotifs=useFirebaseListener("notifications",authUser,normFbNotif);
  const fbComps=useFirebaseListener("competitions",authUser,normFbComp);

  useEffect(()=>{
    const unsub=onAuthStateChanged(auth,async user=>{
      try{
        if(!user){setAuthUser(null);setAuthProfile(null);return;}
        const snap=await getDoc(doc(db,"users",user.uid));
        setAuthUser(user);
        setAuthProfile(snap.exists()?snap.data():null);
      }catch{setAuthUser(user||null);setAuthProfile(null);}
      finally{setAuthLoading(false);}
    });
    return unsub;
  },[]);

  useEffect(()=>{const t=setTimeout(()=>setSplash(false),2600);return()=>clearTimeout(t);},[]);

  const currentMembId=cleanId(authProfile?.memberId||authProfile?.memberid||"");
  const unread=fbNotifs.filter(n=>(n.audience==="all"||same(n.toMembId,currentMembId))&&n.status!=="read").length;
  const h=HDRS[tab];

  if(authLoading) return(
    <>
      <style>{CSS}</style>
      <div className="shell"><div className="pitch-bg"/><div className="loader"><div className="spin"/><span>جاري التحقق...</span></div></div>
    </>
  );

  if(!authUser) return(
    <>
      <style>{CSS}</style>
      <div className="shell">
        <div className="pitch-bg"/>
        <div className={`splash${!splash?" hide":""}`}>
          <div className="splash-logo">⚽</div>
          <div className="splash-title">FIFA GROUP</div>
          <div className="splash-sub">SEASON 6 · 2025</div>
          <div className="splash-bar"><div className="splash-fill"/></div>
        </div>
        <LoginPage/>
      </div>
    </>
  );

  const renderPage=()=>{
    if(loading||!sheets) return <div className="loader"><div className="spin"/><span>جاري تحميل البيانات...</span></div>;
    switch(tab){
      case "home":     return <HomePage     sheets={sheets} fbTransfers={fbTransfers} fbComps={fbComps}/>;
      case "members":  return <MembersPage  sheets={sheets} fbOffers={fbOffers} currentMembId={currentMembId}/>;
      case "tourns":   return <TournamentsPage sheets={sheets} fbComps={fbComps}/>;
      case "market":   return <MarketPage   sheets={sheets} fbOffers={fbOffers}/>;
      case "finance":  return <FinancePage  sheets={sheets} fbTransfers={fbTransfers}/>;
      case "rankings": return <RankingsPage sheets={sheets}/>;
      default:         return <HomePage     sheets={sheets} fbTransfers={fbTransfers} fbComps={fbComps}/>;
    }
  };

  return(
    <>
      <style>{CSS}</style>
      <div className={`splash${!splash?" hide":""}`}>
        <div className="splash-logo">⚽</div>
        <div className="splash-title">FIFA GROUP</div>
        <div className="splash-sub">SEASON 6 · 2025</div>
        <div className="splash-bar"><div className="splash-fill"/></div>
      </div>
      <div className="shell">
        <div className="pitch-bg"/>
        {/* Ticker */}
        <div className="ticker">
          <div className="tick-track">
            {[...TICKER,...TICKER].map((t,i)=><span key={i} className="tick-item">{t} <span style={{color:"rgba(0,230,118,.4)"}}>◆</span> </span>)}
          </div>
        </div>
        {/* Topbar */}
        <div className="topbar">
          <div className="brand">
            <div className="brand-ico">⚽</div>
            <div className="brand-txt"><h1>{h.t}</h1><p>{h.s}</p></div>
          </div>
          <div className="top-actions">
            <button className="notif-btn" onClick={()=>setNotif(true)}>
              🔔{unread>0&&<span className="notif-dot"/>}
            </button>
            <button className="logout-btn" onClick={()=>signOut(auth)} title="خروج">↩</button>
          </div>
        </div>
        {/* Page */}
        {renderPage()}
        {/* Nav */}
        <nav className="bnav">
          {TABS.map(t=>(
            <button key={t.id} className={`nb${tab===t.id?" on":""}`} onClick={()=>setTab(t.id)} style={{position:"relative"}}>
              <span className="ni">{t.icon}</span>
              <span className="nl">{t.label}</span>
              {t.id==="market"&&fbOffers.filter(o=>o.status==="pending").length>0&&<span className="nbdot"/>}
            </button>
          ))}
        </nav>
        {/* Notifications */}
        {notifOpen&&<NotifPanel notifs={fbNotifs} currentMembId={currentMembId} onClose={()=>setNotif(false)}/>}
      </div>
    </>
  );
}
