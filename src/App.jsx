import { useState, useEffect, useMemo, useRef, useCallback } from "react";

// ╔══════════════════════════════════════════════════════════════╗
// ║   FIFA GROUP V4 — ULTIMATE REAL DATA EDITION 🎮             ║
// ╚══════════════════════════════════════════════════════════════╝

// ── GOOGLE SHEETS URLS (بياناتك الحقيقية) ────────────────────
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

// ── MEMBER COLORS ─────────────────────────────────────────────
const MC = [
  { from:"#00E676",to:"#00B84C",sh:"rgba(0,230,118,0.5)",  text:"#00E676" },
  { from:"#00D4FF",to:"#0088CC",sh:"rgba(0,212,255,0.5)",  text:"#00D4FF" },
  { from:"#FF6B35",to:"#E63900",sh:"rgba(255,107,53,0.5)", text:"#FF6B35" },
  { from:"#A855F7",to:"#7C3AED",sh:"rgba(168,85,247,0.5)", text:"#A855F7" },
  { from:"#FFD700",to:"#E6A800",sh:"rgba(255,215,0,0.5)",  text:"#FFD700" },
  { from:"#FF4757",to:"#C0392B",sh:"rgba(255,71,87,0.5)",  text:"#FF4757" },
  { from:"#4FC3F7",to:"#0288D1",sh:"rgba(79,195,247,0.5)", text:"#4FC3F7" },
  { from:"#F472B6",to:"#BE185D",sh:"rgba(244,114,182,0.5)",text:"#F472B6" },
];

const memberColor = (idx) => MC[((idx ?? 0) % MC.length + MC.length) % MC.length];

// ── SEASONS DEFINITION ────────────────────────────────────────
const SEASONS_STATIC = [
  { id:"S1", label:"الموسم الأول",   years:"2017 – 2020", count:153, color:"#00D4FF" },
  { id:"S2", label:"الموسم الثاني",  years:"2020 – 2021", count:206, color:"#A855F7" },
  { id:"S3", label:"الموسم الثالث",  years:"2021 – 2023", count:203, color:"#FF6B35" },
  { id:"S4", label:"الموسم الرابع",  years:"2023",        count:22,  color:"#FFD700" },
  { id:"S5", label:"الموسم الخامس",  years:"2024",        count:6,   color:"#F472B6" },
  { id:"S6", label:"الموسم السادس",  years:"2025 – الآن", count:"?", color:"#00E676", active:true },
];

// ── TICKER ITEMS ──────────────────────────────────────────────
const TICKER = [
  "⚽ FIFA GROUP — السجل الرسمي والموثّق لكل ما يحدث في الجروب",
  "🏆 تاريخ يمتد من 2017 إلى اليوم — أكثر من 590 بطولة",
  "🔄 سوق الانتقالات، العقود، المالية — كل شيء هنا",
  "👥 بيانات حية مباشرة من Google Sheets",
  "⭐ الموسم السادس جارٍ الآن — تابع الترتيب والنتائج",
];

// ── CSV PARSER ────────────────────────────────────────────────
function parseCSV(text) {
  if (!text?.trim()) return [];
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.replace(/^"|"$/g,"").trim().toLowerCase());
  return lines.slice(1).map(line => {
    const vals = [];
    let cur = "", inQ = false;
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; continue; }
      if (ch === ',' && !inQ) { vals.push(cur.trim()); cur = ""; continue; }
      cur += ch;
    }
    vals.push(cur.trim());
    const obj = {};
    headers.forEach((h,i) => { obj[h] = vals[i] ?? ""; });
    return obj;
  }).filter(r => Object.values(r).some(v => v));
}

async function fetchCSV(url) {
  try {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) return [];
    return parseCSV(await r.text());
  } catch { return []; }
}

// ── HELPERS ───────────────────────────────────────────────────
const get = (row, ...keys) => { for (const k of keys) { const v = row?.[k] ?? row?.[k.toLowerCase()] ?? ""; if (v) return v; } return ""; };
const toN  = v => parseFloat(String(v).replace(/[^\d.-]/g,"")) || 0;
const fmt  = n => new Intl.NumberFormat("ar-SA").format(Math.round(n));
const same = (a,b) => String(a||"").trim().toLowerCase() === String(b||"").trim().toLowerCase();
const initials = name => String(name||"").replace(/أبو\s+/,"").charAt(0) || "؟";

function normMember(row, idx) {
  const id    = get(row,"id","memberid","member_id");
  const name  = get(row,"name","membername","member_name","اسم","الاسم");
  const avatar= get(row,"avatar","image","img","صورة","photo");
  const team  = get(row,"team","teamname","الفريق","نادي");
  const nat   = get(row,"national","nationality","منتخب","المنتخب");
  const bal   = toN(get(row,"balance","رصيد","الرصيد","bal"));
  const trph  = toN(get(row,"trophies","بطولات","ألقاب","count","total"));
  const status= get(row,"status","حالة") || "active";
  const rating= toN(get(row,"rating","تقييم")) || 80 + Math.floor(idx*2);
  return { id, name, avatar, team, nat, bal, trph, status, rating, _idx:idx, _raw:row };
}

function normPlayer(row) {
  const id     = get(row,"id","playerid","player_id");
  const name   = get(row,"name","playername","اسم","الاسم");
  const image  = get(row,"image","avatar","img","photo","صورة");
  const pos    = get(row,"position","pos","مركز","المركز");
  const rating = toN(get(row,"rating","تقييم","ovr")) || 75;
  const team   = get(row,"team","club","نادي");
  const nat    = get(row,"national","nationality","جنسية");
  const membId = get(row,"memberid","member_id","membid","عضو");
  const ctype  = get(row,"contracttype","contract","عقد");
  return { id, name, image, pos, rating, team, nat, membId, ctype, _raw:row };
}

function normTournament(row) {
  const name    = get(row,"name","tournament","بطولة","اسم","اسم البطولة");
  const champ   = get(row,"champion","winner","بطل","الفائز","البطل");
  const champId = get(row,"championid","winnerid","معرف البطل","champion_id");
  const date    = get(row,"date","تاريخ","التاريخ");
  const season  = get(row,"season","seasonid","موسم","الموسم");
  const type    = get(row,"type","نوع","النوع") || "tournament";
  return { name, champ, champId, date, season, type, _raw:row };
}

function normFinance(row) {
  const membId = get(row,"memberid","member_id","عضو","العضو");
  const amt    = toN(get(row,"amount","مبلغ","المبلغ"));
  const type   = get(row,"type","نوع","النوع") || "income";
  const desc   = get(row,"description","note","تفاصيل","ملاحظة","وصف");
  const date   = get(row,"date","تاريخ","التاريخ");
  return { membId, amt, type, desc, date, _raw:row };
}

function normTransfer(row) {
  const player = get(row,"player","playername","اللاعب","لاعب","name");
  const from   = get(row,"from","frommember","من","من عضو");
  const to     = get(row,"to","tomember","إلى","الى","إلى عضو");
  const amt    = toN(get(row,"amount","مبلغ"));
  const date   = get(row,"date","تاريخ");
  const type   = get(row,"type","نوع") || "شراء";
  const period = get(row,"period","فترة");
  return { player, from, to, amt, date, type, period, _raw:row };
}

// ── ACHIEVEMENTS ──────────────────────────────────────────────
const ACHIEVEMENTS = {
  crown:  { icon:"👑", name:"الأكثر ألقاباً",    color:"#FFD700" },
  fire:   { icon:"🔥", name:"أطول سلسلة",          color:"#FF6B35" },
  rich:   { icon:"💰", name:"الأغنى",              color:"#00E676" },
  legend: { icon:"⭐", name:"أسطورة الجروب",       color:"#A855F7" },
  shield: { icon:"🛡️", name:"الأقل خسارة",        color:"#00D4FF" },
  market: { icon:"🏪", name:"ملك السوق",           color:"#FF9F43" },
};

function memberAchievements(m, allM) {
  const achs = [];
  const maxTrph = Math.max(...allM.map(x=>x.trph));
  const maxBal  = Math.max(...allM.map(x=>x.bal));
  if (m.trph === maxTrph && m.trph > 0) achs.push("crown");
  if (m.bal  === maxBal  && m.bal  > 0) achs.push("rich");
  if (m._idx === 0) achs.push("legend");
  return achs;
}

// ── CSS ───────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&family=Orbitron:wght@700;900&display=swap');

*,*::before,*::after{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
:root{
  --g:#00E676;--g2:#00B84C;--gdim:rgba(0,230,118,0.1);--gbor:rgba(0,230,118,0.25);
  --gold:#FFD700;--goldim:rgba(255,215,0,0.10);--goldbor:rgba(255,215,0,0.25);
  --blue:#00D4FF;--red:#FF4757;--purple:#A855F7;--orange:#FF6B35;
  --glass:rgba(255,255,255,0.032);--gbdr:rgba(255,255,255,0.07);--gbdr2:rgba(255,255,255,0.12);
  --text:#EDF0FF;--sub:#6270A0;--sub2:#9BA0C0;--bg:#02030A;
  --nav:68px;--r:20px;
}
html,body{height:100%;background:var(--bg);font-family:'Tajawal',sans-serif;direction:rtl;color:var(--text);overflow-x:hidden;}
::-webkit-scrollbar{width:2px;height:2px;}::-webkit-scrollbar-thumb{background:rgba(0,230,118,0.2);border-radius:2px;}

/* ── SHELL ── */
.shell{max-width:430px;margin:0 auto;min-height:100dvh;display:flex;flex-direction:column;position:relative;background:var(--bg);overflow:hidden;}
.pitch-bg{position:fixed;inset:0;pointer-events:none;z-index:0;
  background-image:
    radial-gradient(ellipse 320px 160px at 50% -2%, rgba(0,230,118,0.08) 0%,transparent 65%),
    radial-gradient(circle at 8% 6%, rgba(0,230,118,0.09) 0%,transparent 50%),
    radial-gradient(circle at 94% 10%, rgba(168,85,247,0.07) 0%,transparent 50%),
    linear-gradient(rgba(0,230,118,0.02) 1px,transparent 1px),
    linear-gradient(90deg,rgba(0,230,118,0.02) 1px,transparent 1px);
  background-size:100% 100%,100% 100%,100% 100%,44px 44px,44px 44px;
}
.pitch-ring{position:fixed;top:36%;left:50%;transform:translate(-50%,-50%);width:210px;height:210px;border-radius:50%;border:1px solid rgba(0,230,118,0.04);pointer-events:none;z-index:0;}
.pitch-ring::after{content:'';position:absolute;inset:50px;border-radius:50%;border:1px solid rgba(0,230,118,0.04);}

/* ── SPLASH ── */
.splash{position:fixed;inset:0;z-index:9999;background:#02030A;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:24px;animation:splashOut .5s ease 2.4s both;}
@keyframes splashOut{to{opacity:0;pointer-events:none;visibility:hidden;}}
.splash-logo{width:80px;height:80px;border-radius:22px;background:linear-gradient(135deg,var(--g),var(--blue));display:flex;align-items:center;justify-content:center;font-size:40px;box-shadow:0 0 60px rgba(0,230,118,0.4),0 0 120px rgba(0,212,255,0.15);animation:logoIn .6s ease .2s both;}
@keyframes logoIn{from{opacity:0;transform:scale(.6) rotate(-10deg);}to{opacity:1;transform:scale(1) rotate(0);}}
.splash-title{font-size:28px;font-weight:900;font-family:'Orbitron',sans-serif;background:linear-gradient(90deg,#fff,var(--g));-webkit-background-clip:text;-webkit-text-fill-color:transparent;animation:fadeUp .5s ease .7s both;}
.splash-sub{font-size:12px;color:var(--sub2);font-weight:700;letter-spacing:2px;animation:fadeUp .5s ease .9s both;}
.splash-bar{width:180px;height:3px;background:rgba(255,255,255,0.06);border-radius:2px;overflow:hidden;animation:fadeUp .5s ease 1.1s both;}
.splash-fill{height:100%;border-radius:2px;background:linear-gradient(90deg,var(--g),var(--blue));animation:fillBar 1.8s ease 1.2s both;}
@keyframes fillBar{from{width:0%;}to{width:100%;}}
@keyframes fadeUp{from{opacity:0;transform:translateY(12px);}to{opacity:1;transform:translateY(0);}}

/* ── TICKER ── */
.ticker{height:28px;background:linear-gradient(90deg,rgba(0,230,118,0.10),rgba(0,212,255,0.07),rgba(0,230,118,0.10));border-bottom:1px solid rgba(0,230,118,0.18);overflow:hidden;display:flex;align-items:center;position:relative;z-index:91;}
.ticker::before,.ticker::after{content:'';position:absolute;top:0;bottom:0;width:36px;z-index:1;}
.ticker::before{right:0;background:linear-gradient(to right,transparent,#05060F);}
.ticker::after{left:0;background:linear-gradient(to left,transparent,#05060F);}
.tick-track{display:flex;white-space:nowrap;animation:tickMove 30s linear infinite;}
@keyframes tickMove{from{transform:translateX(0);}to{transform:translateX(-50%);}}
.tick-item{font-size:11px;font-weight:700;color:var(--sub2);padding:0 28px;flex-shrink:0;}
.tick-sep{color:rgba(0,230,118,0.4);}

/* ── TOPBAR ── */
.topbar{position:sticky;top:0;z-index:90;display:flex;align-items:center;justify-content:space-between;padding:11px 15px 9px;background:rgba(2,3,10,0.94);backdrop-filter:blur(30px);border-bottom:1px solid var(--gbdr);position:relative;z-index:100;}
.topbar::after{content:'';position:absolute;bottom:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,var(--g),var(--blue),var(--g),transparent);opacity:.35;}
.brand{display:flex;align-items:center;gap:9px;}
.brand-ico{width:34px;height:34px;border-radius:10px;background:linear-gradient(135deg,var(--g),var(--blue));display:flex;align-items:center;justify-content:center;font-size:17px;box-shadow:0 0 16px rgba(0,230,118,0.38);}
.brand-txt h1{font-size:13px;font-weight:900;font-family:'Orbitron',sans-serif;background:linear-gradient(90deg,#fff 20%,var(--g));-webkit-background-clip:text;-webkit-text-fill-color:transparent;}
.brand-txt p{font-size:9px;font-weight:700;color:var(--g);letter-spacing:2px;}
.season-chip{display:flex;align-items:center;gap:5px;background:var(--gdim);border:1px solid var(--gbor);border-radius:20px;padding:4px 11px;font-size:11px;font-weight:700;color:var(--g);}
.ldot{width:6px;height:6px;border-radius:50%;background:var(--g);animation:pulse 1.4s infinite;}
@keyframes pulse{0%,100%{opacity:1;box-shadow:0 0 0 0 var(--gdim);}50%{opacity:.4;box-shadow:0 0 0 5px transparent;}}

/* ── BOTTOM NAV ── */
.bnav{position:sticky;bottom:0;width:100%;height:var(--nav);background:rgba(4,5,14,0.97);backdrop-filter:blur(30px);border-top:1px solid var(--gbdr);display:flex;align-items:flex-end;justify-content:space-around;padding:0 2px 9px;z-index:200;position:relative;}
.bnav::before{content:'';position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,var(--g),var(--blue),var(--g),transparent);opacity:.3;}
.nb{display:flex;flex-direction:column;align-items:center;gap:3px;padding:6px 9px 4px;border-radius:13px;cursor:pointer;transition:all .2s;min-width:44px;border:none;background:transparent;font-family:'Tajawal',sans-serif;}
.nb.on{background:linear-gradient(135deg,rgba(0,230,118,0.1),rgba(0,212,255,0.06));}
.nb.on::before{content:'';position:absolute;inset:0;border-radius:13px;border:1px solid rgba(0,230,118,0.22);}
.nb .ni{font-size:20px;transition:transform .2s;}.nb.on .ni{transform:scale(1.15);}
.nb .nl{font-size:9px;font-weight:700;color:var(--sub);transition:color .2s;font-family:'Tajawal',sans-serif;}.nb.on .nl{color:var(--g);}
.nbdot{position:absolute;top:4px;right:4px;width:7px;height:7px;border-radius:50%;background:var(--red);border:1.5px solid var(--bg);}

/* ── PAGE ── */
.page{flex:1;padding:13px 12px 14px;overflow-y:auto;animation:pgIn .28s ease both;position:relative;z-index:1;}
@keyframes pgIn{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}

/* ── SHARED ── */
.lbl{font-size:10px;font-weight:800;color:var(--sub);letter-spacing:2px;text-transform:uppercase;margin:18px 0 10px;display:flex;align-items:center;gap:8px;}
.lbl::after{content:'';flex:1;height:1px;background:linear-gradient(to left,transparent,var(--gbdr));}
.lbl:first-child{margin-top:4px;}
.gcard{background:var(--glass);border:1px solid var(--gbdr);border-radius:var(--r);padding:14px;backdrop-filter:blur(8px);}
.tag{display:inline-flex;align-items:center;gap:3px;border-radius:20px;padding:3px 10px;font-size:10px;font-weight:800;}
.tg{background:var(--gdim);color:var(--g);border:1px solid var(--gbor);}
.ty{background:var(--goldim);color:var(--gold);border:1px solid var(--goldbor);}
.tb{background:rgba(0,212,255,.1);color:var(--blue);border:1px solid rgba(0,212,255,.25);}
.tz{background:rgba(98,112,160,.1);color:var(--sub2);border:1px solid var(--gbdr);}
.pills{display:flex;gap:7px;overflow-x:auto;margin-bottom:13px;scrollbar-width:none;}.pills::-webkit-scrollbar{display:none;}
.pill{flex-shrink:0;padding:6px 14px;border-radius:20px;font-size:12px;font-weight:700;cursor:pointer;border:1px solid var(--gbdr);background:var(--glass);color:var(--sub);transition:all .18s;font-family:'Tajawal',sans-serif;}
.pill.on{background:var(--gdim);border-color:var(--gbor);color:var(--g);}
.backbtn{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--sub2);cursor:pointer;padding:5px 0;margin-bottom:6px;width:fit-content;background:none;border:none;font-family:'Tajawal',sans-serif;transition:color .2s;}
.backbtn:hover{color:var(--text);}
@keyframes cardIn{from{opacity:0;transform:translateY(12px) scale(.97);}to{opacity:1;transform:translateY(0) scale(1);}}
.ca{animation:cardIn .3s ease both;}
.ca:nth-child(2){animation-delay:.06s;}.ca:nth-child(3){animation-delay:.12s;}.ca:nth-child(4){animation-delay:.18s;}.ca:nth-child(5){animation-delay:.24s;}.ca:nth-child(6){animation-delay:.30s;}
@keyframes float{0%,100%{transform:translateY(0);}50%{transform:translateY(-5px);}}
.float{animation:float 2.8s ease-in-out infinite;}

/* ── LOADING ── */
.loader{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:80px 20px;gap:14px;color:var(--sub);font-size:14px;font-weight:700;}
.spin{width:36px;height:36px;border:3px solid rgba(255,255,255,0.08);border-top-color:var(--g);border-radius:50%;animation:spinAnim .75s linear infinite;}
@keyframes spinAnim{to{transform:rotate(360deg);}}

/* ── HOME ── */
.hero{border-radius:24px;padding:20px 16px 16px;position:relative;overflow:hidden;margin-bottom:13px;background:linear-gradient(145deg,#040C1C,#081830 45%,#050D1E);border:1px solid rgba(0,230,118,0.20);}
.hero::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse at 82% 12%,rgba(0,230,118,0.12),transparent 48%),radial-gradient(ellipse at 15% 80%,rgba(0,212,255,0.07),transparent 48%);pointer-events:none;}
.hero-scan{position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,var(--g),transparent);animation:scanLine 3s ease-in-out infinite;opacity:.6;}
@keyframes scanLine{0%,100%{top:0;opacity:0;}50%{top:100%;opacity:.8;}}
.hero-badge{display:inline-flex;align-items:center;gap:6px;background:rgba(255,215,0,0.10);border:1px solid rgba(255,215,0,0.22);border-radius:20px;padding:4px 12px;font-size:10px;font-weight:800;color:var(--gold);margin-bottom:10px;}
.hero-name{font-size:26px;font-weight:900;line-height:1.05;margin-bottom:2px;background:linear-gradient(135deg,#fff 40%,var(--g));-webkit-background-clip:text;-webkit-text-fill-color:transparent;}
.hero-club{font-size:12px;color:var(--sub2);margin-bottom:14px;}
.hero-grid{display:grid;grid-template-columns:repeat(4,1fr);border-radius:14px;overflow:hidden;border:1px solid rgba(255,255,255,0.05);}
.hst{padding:10px 6px;text-align:center;border-left:1px solid rgba(255,255,255,0.05);background:rgba(0,0,0,0.2);}
.hst:last-child{border-left:none;}
.hst .v{font-size:18px;font-weight:900;color:var(--g);}
.hst .l{font-size:9px;color:var(--sub);font-weight:700;margin-top:2px;}
.hero-trophy-bg{position:absolute;left:12px;top:50%;transform:translateY(-50%);font-size:90px;opacity:.055;line-height:1;pointer-events:none;filter:grayscale(1);}

.qsgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin-bottom:13px;}
.qsc{background:var(--glass);border:1px solid var(--gbdr);border-radius:17px;padding:12px 8px;text-align:center;position:relative;overflow:hidden;}
.qsc::after{content:'';position:absolute;bottom:0;left:0;right:0;height:2px;}
.qsc.qg::after{background:linear-gradient(90deg,var(--g),var(--blue));}
.qsc.qb::after{background:linear-gradient(90deg,var(--blue),var(--purple));}
.qsc.qy::after{background:linear-gradient(90deg,var(--gold),var(--orange));}
.qsc .qi{font-size:20px;margin-bottom:5px;}.qsc .qv{font-size:19px;font-weight:900;}.qsc .ql{font-size:9.5px;color:var(--sub);font-weight:600;margin-top:2px;}

/* Form guide table */
.fgt{width:100%;border-collapse:collapse;}
.fgt td,.fgt th{padding:8px 4px;text-align:center;border-bottom:1px solid rgba(255,255,255,0.03);}
.fgt th{font-size:9px;font-weight:700;color:var(--sub);letter-spacing:1px;}
.fgt td:first-child{text-align:right;padding-right:8px;}
.fgt tr:last-child td{border-bottom:none;}
.fdots{display:flex;gap:3px;align-items:center;}
.fdot{width:16px;height:16px;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:900;}
.fdot-W{background:rgba(0,230,118,0.2);color:var(--g);border:1px solid var(--gbor);}
.fdot-D{background:rgba(0,212,255,0.15);color:var(--blue);border:1px solid rgba(0,212,255,.25);}
.fdot-L{background:rgba(255,71,87,0.15);color:var(--red);border:1px solid rgba(255,71,87,.25);}

/* Activity */
.aitem{display:flex;align-items:center;gap:11px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.03);}
.aitem:last-child{border-bottom:none;}
.adot{width:8px;height:8px;border-radius:50%;flex-shrink:0;}
.abody{flex:1;font-size:12.5px;line-height:1.45;}
.abody b{color:var(--g);}
.atime{font-size:10px;color:var(--sub);flex-shrink:0;}

/* Season timeline */
.timeline{display:flex;gap:0;overflow-x:auto;padding-bottom:4px;scrollbar-width:none;position:relative;margin-bottom:4px;}
.timeline::-webkit-scrollbar{display:none;}
.timeline::before{content:'';position:absolute;top:24px;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,rgba(0,230,118,0.25),transparent);}
.tl-item{flex-shrink:0;display:flex;flex-direction:column;align-items:center;gap:6px;padding:0 14px;cursor:pointer;position:relative;}
.tl-dot{width:14px;height:14px;border-radius:50%;border:2px solid;transition:all .2s;z-index:1;}
.tl-item.active .tl-dot{width:18px;height:18px;box-shadow:0 0 14px currentColor;}
.tl-label{font-size:9px;font-weight:800;color:var(--sub);white-space:nowrap;letter-spacing:.5px;}
.tl-item.active .tl-label{color:var(--text);}
.tl-count{font-size:11px;font-weight:900;}

/* Season detail card */
.season-detail{border-radius:18px;padding:14px;margin-top:12px;position:relative;overflow:hidden;border:1px solid;}
.season-detail::before{content:'';position:absolute;inset:0;background:linear-gradient(135deg,rgba(255,255,255,0.04),transparent);pointer-events:none;}
.sd-label{font-size:10px;font-weight:800;letter-spacing:1.5px;margin-bottom:6px;opacity:.7;}
.sd-name{font-size:20px;font-weight:900;margin-bottom:2px;}
.sd-years{font-size:12px;color:var(--sub2);margin-bottom:12px;}
.sd-count{font-size:28px;font-weight:900;}
.sd-count-label{font-size:11px;color:var(--sub2);}

/* ── MEMBER CARDS ── */
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
.mav{width:50px;height:50px;border-radius:15px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:900;color:#fff;position:relative;overflow:hidden;background-size:cover;background-position:center;}
.mav::after{content:'';position:absolute;inset:-1px;border-radius:16px;background:inherit;z-index:-1;filter:blur(6px);opacity:.45;}
.mi{flex:1;min-width:0;}.mname{font-size:14px;font-weight:800;}.mclub{font-size:11px;color:var(--sub2);margin-top:2px;}
.mright{display:flex;flex-direction:column;align-items:flex-end;gap:3px;}
.mbal{font-size:13px;font-weight:900;color:var(--g);}.mtrph{font-size:11px;color:var(--gold);}
.mrtg{position:absolute;top:9px;left:11px;background:rgba(255,215,0,.12);border:1px solid rgba(255,215,0,.25);border-radius:6px;padding:2px 6px;font-size:11px;font-weight:900;color:var(--gold);}
.mbal-badge{display:inline-flex;align-items:center;gap:3px;font-size:11px;font-weight:700;padding:2px 8px;border-radius:10px;border:1px solid;}

/* ── MEMBER DETAIL ── */
.dh{border-radius:24px;padding:20px 14px 16px;display:flex;flex-direction:column;align-items:center;position:relative;overflow:hidden;margin-bottom:13px;}
.dh::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse at 50% -5%,rgba(0,230,118,0.10),transparent 55%);pointer-events:none;}
.dav{width:76px;height:76px;border-radius:22px;display:flex;align-items:center;justify-content:center;font-size:32px;font-weight:900;color:#fff;margin-bottom:10px;position:relative;overflow:hidden;background-size:cover;background-position:center;}
.dav::before{content:'';position:absolute;inset:-3px;border-radius:25px;background:inherit;z-index:-1;filter:blur(14px);opacity:.55;}
.dname{font-size:22px;font-weight:900;margin-bottom:1px;}
.dclub{font-size:12px;color:var(--sub2);margin-bottom:14px;}
.dsgrid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;width:100%;}
.dstat{background:rgba(0,0,0,.22);border-radius:13px;padding:9px 6px;text-align:center;border:1px solid rgba(255,255,255,.05);}
.dstat .dv{font-size:17px;font-weight:900;}.dstat .dl{font-size:9px;color:var(--sub2);font-weight:600;margin-top:1px;}
.ach-row{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px;justify-content:center;}
.ach-badge{display:inline-flex;align-items:center;gap:4px;border-radius:20px;padding:3px 9px;font-size:10px;font-weight:800;border:1px solid;}
.prow{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,.04);}
.prow:last-child{border-bottom:none;}
.pav{width:38px;height:38px;border-radius:11px;flex-shrink:0;object-fit:cover;background:rgba(255,255,255,.05);}
.pav-fallback{width:38px;height:38px;border-radius:11px;flex-shrink:0;background:var(--gdim);border:1px solid var(--gbor);display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:900;color:var(--g);}
.pinfo{flex:1;min-width:0;}.pname{font-size:13px;font-weight:700;}.pnat{font-size:10px;color:var(--sub);}
.prtg{background:rgba(255,215,0,.1);border:1px solid rgba(255,215,0,.22);border-radius:7px;padding:2px 8px;font-size:12px;font-weight:900;color:var(--gold);}
.pcontract{font-size:10px;color:var(--sub2);margin-top:2px;}

/* ── FUT CARDS ── */
.card3d{perspective:700px;width:148px;height:220px;cursor:pointer;flex-shrink:0;}
.card-inner{position:relative;width:100%;height:100%;transition:transform .65s cubic-bezier(.4,0,.2,1);transform-style:preserve-3d;}
.card3d.flipped .card-inner{transform:rotateY(180deg);}
.card-face{position:absolute;inset:0;backface-visibility:hidden;border-radius:13px;overflow:hidden;}
.card-back-face{transform:rotateY(180deg);}
.tier-special{background:linear-gradient(145deg,#1A0A2E 0%,#3D1A5A 25%,#8A2BE2 50%,#3D1A5A 75%,#1A0A2E 100%);}
.tier-gold{background:linear-gradient(145deg,#3D2800 0%,#7A5400 20%,#C89000 40%,#F0C040 50%,#C89000 60%,#7A5400 80%,#3D2800 100%);}
.tier-silver{background:linear-gradient(145deg,#1C1C2C 0%,#424258 20%,#828298 40%,#C0C0D0 50%,#828298 60%,#424258 80%,#1C1C2C 100%);}
.tier-bronze{background:linear-gradient(145deg,#2A0E00 0%,#5A2800 20%,#984400 40%,#C86400 50%,#984400 60%,#5A2800 80%,#2A0E00 100%);}
.card-shine{position:absolute;inset:0;background:linear-gradient(115deg,transparent 20%,rgba(255,255,255,0.18) 50%,transparent 80%);animation:cshine 2.5s ease-in-out infinite;}
@keyframes cshine{0%,100%{transform:translateX(-100%) skewX(-15deg);}50%{transform:translateX(180%) skewX(-15deg);}}
.card-texture{position:absolute;inset:0;background-image:repeating-linear-gradient(60deg,rgba(255,255,255,0.015) 0px,rgba(255,255,255,0.015) 1px,transparent 1px,transparent 5px);}
.card-top{display:flex;justify-content:space-between;align-items:flex-start;padding:9px 9px 0;}
.card-ovr{font-size:24px;font-weight:900;color:#fff;text-shadow:0 2px 8px rgba(0,0,0,0.8);line-height:1;}
.card-pos{font-size:11px;font-weight:900;color:rgba(255,255,255,0.8);margin-top:2px;}
.card-nat{font-size:18px;}
.card-av-wrap{display:flex;align-items:center;justify-content:center;height:78px;margin:3px 0;position:relative;}
.card-av{width:68px;height:68px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:30px;font-weight:900;color:#fff;border:2px solid rgba(255,255,255,0.3);background:rgba(0,0,0,0.3);overflow:hidden;object-fit:cover;}
.card-name-sec{padding:0 8px 3px;}
.card-pname{font-size:12px;font-weight:900;color:#fff;text-align:center;text-transform:uppercase;letter-spacing:.8px;text-shadow:0 1px 6px rgba(0,0,0,0.8);}
.card-club{font-size:9px;color:rgba(255,255,255,0.65);text-align:center;margin-top:1px;}
.card-div{height:1px;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.2),transparent);margin:4px 8px;}
.card-stats{display:grid;grid-template-columns:1fr 1fr;gap:1px;padding:0 8px 8px;}
.cs{display:flex;align-items:center;gap:3px;padding:2px 0;}
.cs-val{font-size:12px;font-weight:900;color:#fff;min-width:20px;text-shadow:0 1px 4px rgba(0,0,0,0.7);}
.cs-lbl{font-size:8px;font-weight:700;color:rgba(255,255,255,0.65);letter-spacing:.4px;}
.card-back-content{padding:11px 10px;height:100%;display:flex;flex-direction:column;background:linear-gradient(145deg,#05080F,#08122A);border:1px solid rgba(0,230,118,0.18);}
.cb-title{font-size:11px;font-weight:800;color:var(--g);text-align:center;margin-bottom:9px;letter-spacing:1px;}
.cb-stat{display:flex;align-items:center;gap:6px;margin-bottom:6px;}
.cb-lbl{font-size:10px;color:var(--sub2);font-weight:700;width:36px;text-align:right;}
.cb-bar{flex:1;height:5px;background:var(--glass);border-radius:3px;overflow:hidden;}
.cb-fill{height:100%;border-radius:3px;}
.cb-val{font-size:11px;font-weight:900;color:var(--text);min-width:22px;text-align:left;}
.cards-grid{display:flex;flex-wrap:wrap;gap:14px;justify-content:center;padding:4px;}
.card-hint{font-size:11px;color:var(--sub2);font-weight:700;text-align:center;margin-bottom:14px;padding:8px 0;}
.card-lvl{margin-top:6px;text-align:center;font-size:9px;color:var(--sub);}
.card-xp{height:3px;width:80px;background:var(--glass);border-radius:2px;overflow:hidden;margin:3px auto 0;}
.card-xp-fill{height:100%;background:linear-gradient(90deg,var(--g),var(--blue));border-radius:2px;}

/* ── TOURNAMENT CARDS ── */
.tcard{background:var(--glass);border:1px solid var(--gbdr);border-radius:var(--r);padding:15px;margin-bottom:10px;position:relative;overflow:hidden;backdrop-filter:blur(8px);}
.tcard::before{content:'';position:absolute;inset:0;background:linear-gradient(135deg,rgba(255,255,255,0.02),transparent);pointer-events:none;}
.tacbar{position:absolute;top:0;right:0;width:80px;height:3px;border-radius:0 var(--r) 0 0;}
.tname{font-size:16px;font-weight:900;margin-bottom:2px;margin-top:8px;}
.tedit{font-size:11px;color:var(--sub2);margin-bottom:10px;}
.tchamp{display:flex;align-items:center;gap:10px;border-radius:12px;padding:9px 11px;background:rgba(255,215,0,0.07);border:1px solid rgba(255,215,0,0.18);}
.tcl{font-size:10px;color:var(--sub);font-weight:600;}.tcn{font-size:14px;font-weight:900;color:var(--gold);}
.tprize{margin-right:auto;font-size:14px;font-weight:900;color:var(--g);}
.tteams{position:absolute;top:12px;left:12px;font-size:9px;color:var(--sub);font-weight:700;}
.no-data{text-align:center;padding:40px 20px;color:var(--sub);font-size:13px;}
.no-data .ni{font-size:36px;margin-bottom:10px;}

/* ── TRANSFER CARDS ── */
.trcard{display:flex;align-items:center;gap:11px;padding:12px 13px;background:var(--glass);border:1px solid var(--gbdr);border-radius:var(--r);margin-bottom:8px;backdrop-filter:blur(8px);position:relative;overflow:hidden;}
.trcard::before{content:'';position:absolute;inset:0;background:linear-gradient(135deg,rgba(255,255,255,0.02),transparent);pointer-events:none;}
.trico{width:44px;height:44px;border-radius:13px;background:linear-gradient(135deg,#0D1A35,#071020);border:1px solid rgba(255,255,255,0.07);display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;}
.trinfo{flex:1;min-width:0;}.trplayer{font-size:14px;font-weight:900;margin-bottom:3px;}
.trroute{display:flex;align-items:center;gap:5px;font-size:11px;color:var(--sub2);}
.trarr{color:var(--g);font-weight:900;}.trdate{font-size:10px;color:var(--sub);margin-top:3px;}
.trright{display:flex;flex-direction:column;align-items:flex-end;gap:4px;}
.tramt{font-size:15px;font-weight:900;color:var(--g);}.tramt.free{font-size:12px;color:var(--sub2);font-weight:600;}
.pbar{margin-top:5px;height:3px;border-radius:2px;background:var(--glass);overflow:hidden;}
.pbar-fill{height:100%;border-radius:2px;background:linear-gradient(90deg,var(--g),var(--blue));}
.msum{background:linear-gradient(135deg,rgba(0,230,118,0.05),rgba(0,212,255,0.04));border:1px solid var(--gbdr);border-radius:20px;padding:12px 14px;display:flex;gap:0;margin-bottom:13px;}
.msum-item{flex:1;text-align:center;border-left:1px solid rgba(255,255,255,0.04);}
.msum-item:last-child{border-left:none;}
.msum-v{font-size:17px;font-weight:900;margin-bottom:2px;}.msum-l{font-size:9px;color:var(--sub);font-weight:700;}

/* ── FINANCE ── */
.fsum3{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:13px;}
.fsb{border-radius:16px;padding:12px 8px;text-align:center;position:relative;overflow:hidden;}
.fsb::before{content:'';position:absolute;inset:0;background:linear-gradient(135deg,rgba(255,255,255,0.04),transparent);pointer-events:none;}
.fsb.fi{background:rgba(0,230,118,.07);border:1px solid rgba(0,230,118,.18);}
.fsb.fo{background:rgba(255,71,87,.07);border:1px solid rgba(255,71,87,.18);}
.fsb.fn{background:rgba(0,212,255,.07);border:1px solid rgba(0,212,255,.18);}
.fsb .fv{font-size:16px;font-weight:900;margin-bottom:3px;}
.fsb.fi .fv{color:var(--g);}.fsb.fo .fv{color:var(--red);}.fsb.fn .fv{color:var(--blue);}
.fsb .fl{font-size:9px;color:var(--sub);font-weight:700;}
.fitem{display:flex;align-items:center;gap:11px;padding:11px 12px;background:var(--glass);border:1px solid var(--gbdr);border-radius:15px;margin-bottom:7px;position:relative;overflow:hidden;}
.fitem::after{content:'';position:absolute;right:0;top:0;bottom:0;width:3px;border-radius:0 15px 15px 0;}
.fitem.fi::after{background:linear-gradient(to bottom,var(--g),var(--g2));}
.fitem.fo::after{background:linear-gradient(to bottom,var(--red),#AA2233);}
.fitem.fx::after{background:linear-gradient(to bottom,var(--blue),#0088AA);}
.fico{width:38px;height:38px;border-radius:11px;display:flex;align-items:center;justify-content:center;font-size:17px;flex-shrink:0;}
.fico.fi{background:rgba(0,230,118,.1);}.fico.fo{background:rgba(255,71,87,.1);}.fico.fx{background:rgba(0,212,255,.1);}
.fmeta{flex:1;min-width:0;}.fmem{font-size:12px;font-weight:800;}.fdesc{font-size:10.5px;color:var(--sub2);margin-top:1px;}.fdate{font-size:9.5px;color:var(--sub);margin-top:1px;}
.famt{font-size:16px;font-weight:900;}.famt.pos{color:var(--g);}.famt.neg{color:var(--red);}
.wbr{display:flex;align-items:center;gap:9px;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.03);}
.wbr:last-child{border-bottom:none;}
.wbn{font-size:12px;font-weight:800;width:64px;flex-shrink:0;}
.wbt{flex:1;height:5px;background:var(--glass);border-radius:3px;overflow:hidden;}
.wbf{height:100%;border-radius:3px;}
.wba{font-size:11px;font-weight:900;color:var(--g);width:46px;text-align:left;flex-shrink:0;}

/* ── RANKINGS ── */
.podium{display:flex;align-items:flex-end;justify-content:center;gap:8px;margin-bottom:18px;padding:0 4px;}
.pod-item{flex:1;display:flex;flex-direction:column;align-items:center;gap:5px;}
.pod-name{font-size:11px;font-weight:800;color:var(--text);text-align:center;}
.pod-pts{font-size:10px;font-weight:900;color:var(--sub2);}
.pod-base{width:100%;display:flex;align-items:center;justify-content:center;font-size:20px;border-radius:10px 10px 0 0;border:1px solid;border-bottom:none;}
.pod-1{height:72px;background:rgba(255,215,0,.1);border-color:rgba(255,215,0,.25);}
.pod-2{height:54px;background:rgba(192,192,192,.08);border-color:rgba(192,192,192,.2);}
.pod-3{height:42px;background:rgba(205,127,50,.08);border-color:rgba(205,127,50,.18);}
.rkhd{display:grid;grid-template-columns:34px 1fr 48px 42px 64px;gap:4px;padding:5px 11px;font-size:9px;font-weight:800;color:var(--sub);letter-spacing:.5px;text-transform:uppercase;text-align:center;}
.rkhd>:nth-child(2){text-align:right;}
.rkrow{display:grid;grid-template-columns:34px 1fr 48px 42px 64px;gap:4px;align-items:center;padding:10px 11px;background:var(--glass);border:1px solid var(--gbdr);border-radius:14px;margin-bottom:6px;text-align:center;backdrop-filter:blur(8px);position:relative;overflow:hidden;transition:transform .18s;cursor:pointer;}
.rkrow:active{transform:scale(.98);}
.rkrow::before{content:'';position:absolute;inset:0;background:linear-gradient(135deg,rgba(255,255,255,0.02),transparent);pointer-events:none;}
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

/* ── H2H ── */
.h2h-btn{margin-top:12px;width:100%;height:44px;border-radius:14px;border:1px solid var(--gbor);background:var(--gdim);color:var(--g);font-family:'Tajawal',sans-serif;font-weight:800;font-size:14px;cursor:pointer;transition:all .2s;}
.h2h-btn:hover{background:rgba(0,230,118,0.18);}
.h2h-overlay{position:fixed;inset:0;z-index:500;background:rgba(0,0,0,0.72);display:flex;align-items:flex-end;padding:16px;animation:ovIn .25s ease;}
@keyframes ovIn{from{opacity:0;}to{opacity:1;}}
.h2h-card{width:100%;background:linear-gradient(145deg,#06091A,#0A0F28);border:1px solid rgba(0,230,118,0.2);border-radius:24px 24px 20px 20px;padding:18px;animation:slideUp .3s ease;}
@keyframes slideUp{from{transform:translateY(40px);opacity:0;}to{transform:translateY(0);opacity:1;}}
.h2h-title{font-size:14px;font-weight:800;color:var(--sub2);text-align:center;letter-spacing:1px;margin-bottom:14px;}
.h2h-grid{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:10px;margin-bottom:14px;}
.h2h-side{display:flex;flex-direction:column;align-items:center;gap:6px;}
.h2h-name{font-size:13px;font-weight:800;text-align:center;}
.h2h-vs{font-size:22px;font-weight:900;color:var(--sub);text-align:center;}
.h2h-stat{display:grid;grid-template-columns:1fr 60px 1fr;gap:6px;align-items:center;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.04);}
.h2h-stat:last-child{border-bottom:none;}
.h2h-val{font-size:15px;font-weight:900;}.h2h-val.left{text-align:left;}.h2h-val.right{text-align:right;}
.h2h-label{font-size:10px;color:var(--sub);font-weight:700;text-align:center;}
.h2h-close{margin-top:12px;width:100%;height:40px;border-radius:12px;border:1px solid var(--gbdr);background:var(--glass);color:var(--sub2);font-family:'Tajawal',sans-serif;font-weight:700;font-size:13px;cursor:pointer;}
.h2h-select{display:flex;gap:8px;margin-bottom:12px;overflow-x:auto;scrollbar-width:none;}
.h2h-select::-webkit-scrollbar{display:none;}
.h2h-chip{flex-shrink:0;padding:6px 12px;border-radius:20px;border:1px solid var(--gbdr);background:var(--glass);color:var(--sub);font-family:'Tajawal',sans-serif;font-weight:700;font-size:11px;cursor:pointer;transition:all .18s;}
.h2h-chip.on{background:var(--gdim);border-color:var(--gbor);color:var(--g);}
`;

// ── CSV DATA HOOK ─────────────────────────────────────────────
function useAppData() {
  const [data,  setData]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const [mRaw, pRaw, tRaw, lRaw, toRaw, fRaw, trRaw] = await Promise.all([
          fetchCSV(URLS.members),
          fetchCSV(URLS.players),
          fetchCSV(URLS.trophies),
          fetchCSV(URLS.leagues),
          fetchCSV(URLS.tournaments),
          fetchCSV(URLS.finance),
          fetchCSV(URLS.transfers),
        ]);

        const members   = mRaw.map((r,i) => normMember(r,i)).filter(m => m.name);
        const players   = pRaw.map(normPlayer).filter(p => p.name);
        const leagues   = lRaw.map(normTournament).filter(t => t.name);
        const tourns    = toRaw.map(normTournament).filter(t => t.name);
        const allTourns = [...leagues, ...tourns];
        const finance   = fRaw.map(normFinance).filter(f => f.membId);
        const transfers = trRaw.map(normTransfer).filter(t => t.player);

        // Compute trophy count per member from tournaments
        const trophyCount = {};
        allTourns.forEach(t => {
          const wId = t.champId || t.champ;
          if (!wId) return;
          // Try to match by id or name
          const m = members.find(m => same(m.id, wId) || same(m.name, wId));
          if (m) trophyCount[m.id] = (trophyCount[m.id] || 0) + 1;
          else if (wId) trophyCount[wId] = (trophyCount[wId] || 0) + 1;
        });
        members.forEach(m => {
          if (!m.trph) m.trph = trophyCount[m.id] || 0;
        });

        // Sort members by trophy count desc
        members.sort((a,b) => b.trph - a.trph);
        members.forEach((m,i) => m._idx = i);

        if (alive) setData({ members, players, allTourns, finance, transfers });
      } catch(e) {
        if (alive) setData({ members:[], players:[], allTourns:[], finance:[], transfers:[] });
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => { alive = false; };
  }, []);

  return { data, loading };
}

// ── COMPONENTS ────────────────────────────────────────────────
const MemberAv = ({ m, size=50, radius=15 }) => {
  const c = memberColor(m._idx);
  if (m.avatar) {
    return (
      <div className="mav" style={{
        width:size,height:size,borderRadius:radius,
        backgroundImage:`url(${m.avatar})`,
        boxShadow:`0 4px 16px ${c.sh}`,
        border:`2px solid ${c.from}40`,
      }}/>
    );
  }
  return (
    <div className="mav" style={{
      width:size,height:size,borderRadius:radius,
      background:`linear-gradient(135deg,${c.from},${c.to})`,
      boxShadow:`0 4px 16px ${c.sh}`,fontSize:size*0.38,
    }}>{initials(m.name)}</div>
  );
};

const Ticker = () => {
  const items = [...TICKER,...TICKER];
  return (
    <div className="ticker">
      <div className="tick-track">
        {items.map((t,i) => (
          <span key={i} className="tick-item">{t} <span className="tick-sep"> ◆ </span></span>
        ))}
      </div>
    </div>
  );
};

const SplashScreen = ({ done }) => (
  <div className="splash" style={{ pointerEvents: done ? "none" : "all" }}>
    <div className="splash-logo">⚽</div>
    <div className="splash-title">FIFA GROUP</div>
    <div className="splash-sub">SEASON 6 · 2025</div>
    <div className="splash-bar"><div className="splash-fill"/></div>
  </div>
);

const StatBarColor = v =>
  v >= 88 ? "linear-gradient(90deg,#00E676,#00FF8A)"
  : v >= 78 ? "linear-gradient(90deg,#FFD700,#FFE55C)"
  : v >= 68 ? "linear-gradient(90deg,#FF6B35,#FF9F43)"
  : "linear-gradient(90deg,#FF4757,#FF6B6B)";

const FUTCard = ({ m }) => {
  const [flipped, setFlipped] = useState(false);
  const c   = memberColor(m._idx);
  const rtg = Math.min(99, Math.max(60, m.rating || 80));
  const tier = rtg >= 92 ? "tier-special" : rtg >= 84 ? "tier-gold" : rtg >= 76 ? "tier-silver" : "tier-bronze";
  const stats = [
    ["PAC", Math.min(99,Math.round(rtg*0.94+Math.random()*4))],
    ["SHO", Math.min(99,Math.round(rtg*0.92+Math.random()*6))],
    ["PAS", Math.min(99,Math.round(rtg*0.88+Math.random()*5))],
    ["DRI", Math.min(99,Math.round(rtg*0.95+Math.random()*4))],
    ["DEF", Math.min(99,Math.round(rtg*0.55+Math.random()*8))],
    ["PHY", Math.min(99,Math.round(rtg*0.80+Math.random()*6))],
  ];

  return (
    <div className={`card3d${flipped?" flipped":""}`} onClick={() => setFlipped(f=>!f)}>
      <div className="card-inner">
        {/* FRONT */}
        <div className={`card-face ${tier}`}>
          <div className="card-shine"/><div className="card-texture"/>
          <div className="card-top">
            <div>
              <div className="card-ovr">{rtg}</div>
              <div className="card-pos">{m.nat||"GRP"}</div>
            </div>
            <div className="card-nat">⚽</div>
          </div>
          <div className="card-av-wrap">
            {m.avatar
              ? <img className="card-av" src={m.avatar} alt="" style={{width:68,height:68,borderRadius:"50%",objectFit:"cover",border:"2px solid rgba(255,255,255,0.3)"}}/>
              : <div className="card-av" style={{background:`linear-gradient(135deg,${c.from},${c.to})`,fontSize:28,fontWeight:900}}>{initials(m.name)}</div>
            }
          </div>
          <div className="card-name-sec">
            <div className="card-pname">{m.name.replace("أبو ","")}</div>
            <div className="card-club">{m.team||"FIFA GROUP"}</div>
          </div>
          <div className="card-div"/>
          <div className="card-stats">
            {stats.slice(0,3).map(([l,v]) => <div key={l} className="cs"><div className="cs-val">{v}</div><div className="cs-lbl">{l}</div></div>)}
            {stats.slice(3,6).map(([l,v]) => <div key={l} className="cs"><div className="cs-val">{v}</div><div className="cs-lbl">{l}</div></div>)}
          </div>
        </div>
        {/* BACK */}
        <div className="card-face card-back-face">
          <div className="card-back-content">
            <div className="cb-title">📊 الإحصاءات</div>
            {stats.map(([l,v]) => (
              <div key={l} className="cb-stat">
                <div className="cb-lbl">{l}</div>
                <div className="cb-bar"><div className="cb-fill" style={{width:`${v}%`,background:StatBarColor(v)}}/></div>
                <div className="cb-val">{v}</div>
              </div>
            ))}
            <div style={{marginTop:"auto",textAlign:"center",fontSize:10,color:"var(--sub)",paddingTop:8}}>
              🏆 {m.trph} ألقاب
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── H2H COMPARISON ────────────────────────────────────────────
const H2H = ({ members, allTourns, onClose }) => {
  const [sel, setSel] = useState([]);

  const m1 = sel[0] ? members.find(m=>m.id===sel[0]) : null;
  const m2 = sel[1] ? members.find(m=>m.id===sel[1]) : null;

  const stats1 = m1 ? {
    trph: m1.trph,
    bal: m1.bal,
    rtg: m1.rating,
  } : null;
  const stats2 = m2 ? {
    trph: m2.trph,
    bal: m2.bal,
    rtg: m2.rating,
  } : null;

  const toggleMember = id => {
    if (sel.includes(id)) setSel(sel.filter(x=>x!==id));
    else if (sel.length < 2) setSel([...sel, id]);
    else setSel([sel[1], id]);
  };

  const c1 = m1 ? memberColor(m1._idx) : null;
  const c2 = m2 ? memberColor(m2._idx) : null;

  const statRows = [
    { l:"🏆 الألقاب",   v1: stats1?.trph, v2: stats2?.trph },
    { l:"💰 الرصيد",    v1: stats1?.bal,  v2: stats2?.bal, fmt: true },
    { l:"⭐ التقييم",   v1: stats1?.rtg,  v2: stats2?.rtg },
  ];

  return (
    <div className="h2h-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="h2h-card">
        <div className="h2h-title">⚔️ المقارنة المباشرة</div>

        <div className="h2h-select">
          {members.map(m => (
            <button key={m.id} className={`h2h-chip${sel.includes(m.id)?" on":""}`} onClick={()=>toggleMember(m.id)}>
              {m.name}
            </button>
          ))}
        </div>

        {m1 && m2 ? (
          <>
            <div className="h2h-grid">
              <div className="h2h-side">
                <MemberAv m={m1} size={52} radius={16}/>
                <div className="h2h-name" style={{color:c1.text}}>{m1.name}</div>
              </div>
              <div className="h2h-vs">VS</div>
              <div className="h2h-side">
                <MemberAv m={m2} size={52} radius={16}/>
                <div className="h2h-name" style={{color:c2.text}}>{m2.name}</div>
              </div>
            </div>
            {statRows.map(s => {
              const v1 = s.v1 || 0, v2 = s.v2 || 0;
              const w1 = v1 > v2, w2 = v2 > v1;
              return (
                <div key={s.l} className="h2h-stat">
                  <div className="h2h-val left" style={{color: w1?c1.text:"var(--sub2)",fontWeight:w1?900:700}}>
                    {s.fmt ? fmt(v1) : v1}
                  </div>
                  <div className="h2h-label">{s.l}</div>
                  <div className="h2h-val right" style={{color: w2?c2.text:"var(--sub2)",fontWeight:w2?900:700}}>
                    {s.fmt ? fmt(v2) : v2}
                  </div>
                </div>
              );
            })}
          </>
        ) : (
          <div style={{textAlign:"center",padding:"20px 0",color:"var(--sub)",fontSize:13,fontWeight:700}}>
            اختر عضوين للمقارنة
          </div>
        )}

        <button className="h2h-close" onClick={onClose}>إغلاق</button>
      </div>
    </div>
  );
};

// ── PAGES ─────────────────────────────────────────────────────

function HomePage({ data }) {
  const { members, allTourns, finance, transfers } = data;
  const [activeSeason, setActiveSeason] = useState("S6");
  const champ = members[0];

  const champion = useMemo(() => {
    if (!champ) return null;
    return champ;
  }, [champ]);

  const seasonTourns = useMemo(() =>
    allTourns.filter(t => {
      const s = t.season || "";
      if (activeSeason === "S1") return s.includes("1") || s.includes("2017") || s.includes("2018") || s.includes("2019") || s.includes("2020");
      if (activeSeason === "S2") return s.includes("2") || s.includes("2020") || s.includes("2021");
      if (activeSeason === "S3") return s.includes("3") || s.includes("2021") || s.includes("2022");
      if (activeSeason === "S4") return s.includes("4") || s.includes("2023");
      if (activeSeason === "S5") return s.includes("5") || s.includes("2024");
      if (activeSeason === "S6") return s.includes("6") || s.includes("2025") || !s;
      return true;
    }),
    [allTourns, activeSeason]
  );

  const activeSeasonDef = SEASONS_STATIC.find(s=>s.id===activeSeason) || SEASONS_STATIC[5];

  const latestTransfers = transfers.slice(-5).reverse();

  return (
    <div className="page">
      {/* Hero */}
      {champion && (
        <div className="hero ca">
          <div className="hero-scan"/>
          <div className="hero-trophy-bg">🏆</div>
          <div className="hero-badge">👑 الأكثر ألقاباً</div>
          <div className="hero-name">{champion.name}</div>
          <div className="hero-club">{champion.nat||""} {champion.team||"FIFA GROUP"}</div>
          <div className="hero-grid">
            {[
              {v:champion.trph,  l:"🏆 ألقاب"},
              {v:champion.rating||"—",l:"⭐ تقييم"},
              {v:fmt(champion.bal)||"—",l:"💰 رصيد"},
              {v:allTourns.length,l:"📋 بطولة"},
            ].map((s,i) => (
              <div key={i} className="hst">
                <div className="v">{s.v}</div>
                <div className="l">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick stats */}
      <div className="qsgrid">
        <div className="qsc qg ca"><div className="qi">👥</div><div className="qv" style={{color:"var(--g)"}}>{members.length}</div><div className="ql">أعضاء</div></div>
        <div className="qsc qb ca"><div className="qi">🏆</div><div className="qv" style={{color:"var(--blue)"}}>{allTourns.length}</div><div className="ql">بطولة</div></div>
        <div className="qsc qy ca"><div className="qi">🔄</div><div className="qv" style={{color:"var(--gold)"}}>{transfers.length}</div><div className="ql">انتقال</div></div>
      </div>

      {/* Season Timeline */}
      <div className="lbl">🕐 المواسم</div>
      <div className="timeline">
        {SEASONS_STATIC.map(s => {
          const col = s.color;
          const isAct = s.id === activeSeason;
          return (
            <div key={s.id} className={`tl-item${isAct?" active":""}`} onClick={() => setActiveSeason(s.id)}>
              <div className="tl-dot" style={{background:isAct?col:"transparent",borderColor:col,color:col,boxShadow:isAct?`0 0 10px ${col}`:undefined}}/>
              <div className="tl-label" style={{color:isAct?col:undefined}}>{s.id}</div>
              <div className="tl-count" style={{color:col}}>{typeof s.count==="number"?s.count:"?"}</div>
            </div>
          );
        })}
      </div>

      {/* Season detail */}
      {activeSeasonDef && (
        <div className="season-detail ca" style={{borderColor:`${activeSeasonDef.color}30`,background:`${activeSeasonDef.color}08`}}>
          <div className="sd-label" style={{color:activeSeasonDef.color}}>{activeSeasonDef.label}</div>
          <div className="sd-name">{activeSeasonDef.years}</div>
          <div style={{display:"flex",alignItems:"baseline",gap:8}}>
            <div className="sd-count" style={{color:activeSeasonDef.color}}>
              {activeSeason==="S6" ? allTourns.filter(t=>!t.season||t.season.includes("6")||t.season.includes("2025")).length || seasonTourns.length : activeSeasonDef.count}
            </div>
            <div className="sd-count-label">بطولة مسجلة</div>
          </div>
        </div>
      )}

      {/* Latest transfers */}
      {latestTransfers.length > 0 && <>
        <div className="lbl">🔄 آخر الانتقالات</div>
        <div className="gcard ca">
          {latestTransfers.map((t,i) => (
            <div key={i} className="aitem">
              <div className="adot" style={{background:t.amt>0?"var(--g)":"var(--sub)",boxShadow:`0 0 6px ${t.amt>0?"var(--g)":"transparent"}`}}/>
              <div className="abody">
                <b>{t.player}</b> {t.from?`من ${t.from}`:""} {t.to?`→ ${t.to}`:""}
              </div>
              <div style={{fontSize:12,fontWeight:900,color:"var(--g)",flexShrink:0}}>
                {t.amt>0?`${fmt(t.amt)} 💰`:"مجاني"}
              </div>
            </div>
          ))}
        </div>
      </>}
    </div>
  );
}

function CardsPage({ data }) {
  const { members } = data;
  return (
    <div className="page">
      <div className="card-hint">اضغط على أي بطاقة لرؤية الإحصاءات التفصيلية</div>
      <div className="cards-grid">
        {members.map((m,i) => (
          <div key={m.id||i} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8}}>
            <FUTCard m={m}/>
            <div className="card-lvl">المستوى {30 + (m._idx*4||0)}</div>
            <div className="card-xp"><div className="card-xp-fill" style={{width:`${50+m._idx*8}%`}}/></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MembersPage({ data }) {
  const { members, players, allTourns, finance } = data;
  const [sel, setSel] = useState(null);

  if (sel) {
    const m = sel;
    const c = memberColor(m._idx);
    const mPlayers = players.filter(p => same(p.membId, m.id) || same(p.membId, m.name));
    const mFinance = finance.filter(f => same(f.membId, m.id) || same(f.membId, m.name));
    const mTourns  = allTourns.filter(t =>
      same(t.champId, m.id) || same(t.champ, m.name) || same(t.champId, m.name)
    );
    const achs = memberAchievements(m, members);

    return (
      <div className="page">
        <button className="backbtn" onClick={()=>setSel(null)}>← رجوع</button>

        {/* Detail Hero */}
        <div className="dh ca" style={{background:`linear-gradient(145deg,#05090F,${c.from}15 50%,#04070E)`,border:`1px solid ${c.from}25`}}>
          {m.avatar
            ? <div className="dav" style={{backgroundImage:`url(${m.avatar})`,boxShadow:`0 0 40px ${c.sh}`,border:`3px solid ${c.from}40`}}/>
            : <div className="dav" style={{background:`linear-gradient(135deg,${c.from},${c.to})`,boxShadow:`0 0 40px ${c.sh}`}}>
                {initials(m.name)}
              </div>
          }
          <div className="dname">{m.name}</div>
          <div className="dclub">{m.nat||""} {m.team||"FIFA GROUP"}</div>
          <div className="dsgrid">
            {[
              {v:m.trph,  l:"🏆 ألقاب",  col:"var(--gold)"},
              {v:m.rating||"—",l:"⭐ تقييم", col:"var(--blue)"},
              {v:fmt(m.bal)||"—",l:"💰 رصيد",col:"var(--g)"},
              {v:mPlayers.length, l:"👟 لاعبين",col:"var(--purple)"},
            ].map((s,i)=>(
              <div key={i} className="dstat">
                <div className="dv" style={{color:s.col}}>{s.v}</div>
                <div className="dl">{s.l}</div>
              </div>
            ))}
          </div>
          {achs.length > 0 && (
            <div className="ach-row">
              {achs.map(a => {
                const ac = ACHIEVEMENTS[a];
                return (
                  <div key={a} className="ach-badge" style={{background:`${ac.color}15`,borderColor:`${ac.color}30`,color:ac.color}}>
                    {ac.icon} {ac.name}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Players */}
        {mPlayers.length > 0 && <>
          <div className="lbl">👟 القائمة ({mPlayers.length} لاعب)</div>
          <div className="gcard">
            {mPlayers.slice(0,15).map((p,i) => (
              <div key={i} className="prow">
                {p.image
                  ? <img className="pav" src={p.image} alt="" onError={e=>e.target.style.display="none"}/>
                  : <div className="pav-fallback">{p.pos||"—"}</div>
                }
                <div className="pinfo">
                  <div className="pname">{p.name}</div>
                  <div className="pnat">{p.nat||""} {p.team||""}</div>
                  {p.ctype && <div className="pcontract">{p.ctype}</div>}
                </div>
                <div className="prtg">{p.rating||"—"}</div>
              </div>
            ))}
          </div>
        </>}

        {/* Trophies */}
        {mTourns.length > 0 && <>
          <div className="lbl">🏆 الألقاب ({mTourns.length})</div>
          <div className="gcard">
            {mTourns.slice(0,10).map((t,i)=>(
              <div key={i} className="aitem">
                <div className="adot" style={{background:"var(--gold)",boxShadow:"0 0 6px var(--gold)"}}/>
                <div className="abody">{t.name}</div>
                <div style={{fontSize:10,color:"var(--sub)",flexShrink:0}}>{t.date||t.season}</div>
              </div>
            ))}
          </div>
        </>}

        {/* Finance */}
        {mFinance.length > 0 && <>
          <div className="lbl">💸 السجل المالي</div>
          <div className="gcard">
            {mFinance.slice(0,8).map((f,i)=>(
              <div key={i} className="aitem">
                <div className="adot" style={{background:f.amt>0?"var(--g)":"var(--red)",boxShadow:`0 0 6px ${f.amt>0?"var(--g)":"var(--red)"}`}}/>
                <div className="abody">{f.desc||f.type}</div>
                <div style={{fontSize:13,fontWeight:900,color:f.amt>0?"var(--g)":"var(--red)",flexShrink:0}}>
                  {f.amt>0?"+":""}{fmt(f.amt)}
                </div>
              </div>
            ))}
          </div>
        </>}
      </div>
    );
  }

  return (
    <div className="page">
      <div className="lbl">👥 الأعضاء ({members.length})</div>
      {members.map((m,i) => {
        const c = memberColor(m._idx);
        const cls = `mcard ca${i===0?" g1":i===1?" g2":i===2?" g3":""}`;
        const rcls = `mrk ${i===0?"r1":i===1?"r2":i===2?"r3":"rn"}`;
        return (
          <div key={m.id||i} className={cls} onClick={()=>setSel(m)}>
            <div className={rcls}>{i===0?"🥇":i===1?"🥈":i===2?"🥉":i+1}</div>
            <MemberAv m={m} size={50} radius={15}/>
            <div className="mi">
              <div className="mname">{m.name}</div>
              <div className="mclub">{m.nat||""} {m.team||"FIFA GROUP"}</div>
            </div>
            <div className="mright">
              <div className="mbal">{fmt(m.bal)||"—"} 💰</div>
              <div className="mtrph">🏆 {m.trph}</div>
            </div>
            <div className="mrtg">{m.rating||"—"}</div>
          </div>
        );
      })}
    </div>
  );
}

function TournamentsPage({ data }) {
  const { allTourns, members } = data;
  const [f, setF] = useState("all");
  const [q, setQ] = useState("");

  const filt = useMemo(() => {
    let list = allTourns;
    if (f==="league") list = list.filter(t=>t.type==="league");
    else if (f==="cup") list = list.filter(t=>t.type!=="league");
    if (q) list = list.filter(t => t.name.includes(q) || t.champ.includes(q));
    return list.slice().reverse().slice(0, 60);
  }, [allTourns, f, q]);

  const maxAmt = Math.max(1,...allTourns.map(t=>toN(t._raw?.prize||t._raw?.amount||0)));

  // Champion stats
  const champStats = useMemo(() => {
    const map = {};
    allTourns.forEach(t => {
      const k = t.champ || "—";
      if (!k||k==="—") return;
      map[k] = (map[k]||0)+1;
    });
    return Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,5);
  },[allTourns]);

  return (
    <div className="page">
      {/* Filter pills */}
      <div className="pills">
        {[{k:"all",l:"الكل"},{k:"league",l:"⚡ دوري"},{k:"cup",l:"🏆 كأس"}].map(p=>(
          <button key={p.k} className={`pill${f===p.k?" on":""}`} onClick={()=>setF(p.k)}>{p.l}</button>
        ))}
      </div>

      {/* Top champions */}
      {champStats.length > 0 && <>
        <div className="lbl">🏆 أكثر الأبطال</div>
        <div className="gcard ca" style={{marginBottom:14}}>
          {champStats.map(([name,count],i) => {
            const m = members.find(m=>same(m.name,name)||same(m.id,name));
            const c = m ? memberColor(m._idx) : memberColor(i);
            return (
              <div key={name} className="aitem">
                <div className="adot" style={{background:c.from,boxShadow:`0 0 6px ${c.from}`}}/>
                <div className="abody" style={{fontWeight:800}}>{name}</div>
                <div style={{fontSize:14,fontWeight:900,color:c.from}}>🏆 {count}</div>
              </div>
            );
          })}
        </div>
      </>}

      <div className="lbl">📋 السجل ({filt.length} من {allTourns.length})</div>

      {filt.length === 0
        ? <div className="no-data"><div className="ni">🏟️</div>لا توجد بطولات</div>
        : filt.map((t,i) => {
          const m = members.find(mm=>same(mm.name,t.champ)||same(mm.id,t.champId));
          const c = m ? memberColor(m._idx) : {from:"var(--gold)",to:"#E6A800"};
          return (
            <div key={i} className="tcard ca">
              <div className="tacbar" style={{background:`linear-gradient(90deg,${c.from},${c.to})`}}/>
              <div><span className={`tag ${t.type==="league"?"tg":"ty"}`}>{t.type==="league"?"⚡ دوري":"🏆 كأس"}</span></div>
              <div className="tname">{t.name}</div>
              <div className="tedit">{t.season} · {t.date}</div>
              <div className="tchamp">
                <div style={{fontSize:24}} className="float">🏆</div>
                <div>
                  <div className="tcl">البطل</div>
                  <div className="tcn">🥇 {t.champ||"—"}</div>
                </div>
              </div>
            </div>
          );
        })
      }
    </div>
  );
}

function MarketPage({ data }) {
  const { transfers, members } = data;
  const [f, setF] = useState("all");

  const filt = useMemo(() => {
    if (f==="buy")  return transfers.filter(t=>t.type!=="مجاني"&&t.amt>0);
    if (f==="free") return transfers.filter(t=>t.type==="مجاني"||t.amt===0);
    return transfers;
  }, [transfers, f]);

  const maxAmt = Math.max(1,...transfers.map(t=>t.amt));
  const totalVol = transfers.filter(t=>t.amt>0).reduce((a,b)=>a+b.amt,0);

  return (
    <div className="page">
      {/* Market summary */}
      <div className="msum ca">
        {[
          {v:fmt(totalVol),  l:"💰 حجم السوق",    col:"var(--g)"},
          {v:transfers.filter(t=>t.amt>0).length, l:"🔄 صفقات مدفوعة",col:"var(--blue)"},
          {v:fmt(Math.max(0,...transfers.map(t=>t.amt))),l:"🏅 أغلى صفقة",col:"var(--gold)"},
        ].map((s,i)=>(
          <div key={i} className="msum-item">
            <div className="msum-v" style={{color:s.col}}>{s.v}</div>
            <div className="msum-l">{s.l}</div>
          </div>
        ))}
      </div>

      <div className="pills">
        {[{k:"all",l:"الكل"},{k:"buy",l:"💰 شراء"},{k:"free",l:"🆓 مجاني"}].map(p=>(
          <button key={p.k} className={`pill${f===p.k?" on":""}`} onClick={()=>setF(p.k)}>{p.l}</button>
        ))}
      </div>

      <div className="lbl">🔄 الانتقالات ({filt.length})</div>

      {filt.length===0
        ? <div className="no-data"><div className="ni">🔄</div>لا توجد انتقالات</div>
        : filt.slice().reverse().slice(0,40).map((t,i) => (
          <div key={i} className="trcard ca">
            <div className="trico">⚽</div>
            <div className="trinfo">
              <div className="trplayer">{t.player}</div>
              <div className="trroute">
                <span style={{color:"var(--sub2)"}}>{t.from||"السوق الحر"}</span>
                <span className="trarr">→</span>
                <span>{t.to||"—"}</span>
              </div>
              <div className="trdate">📅 {t.date} {t.period?`· ${t.period}`:""}</div>
              {t.amt>0&&<div className="pbar"><div className="pbar-fill" style={{width:`${(t.amt/maxAmt)*100}%`}}/></div>}
            </div>
            <div className="trright">
              {t.amt>0?<div className="tramt">{fmt(t.amt)} 💰</div>:<div className="tramt free">مجاني 🆓</div>}
              <span className={`tag ${t.type==="مجاني"||t.amt===0?"tz":t.type==="مبادلة"?"tb":"tg"}`}>{t.type||"شراء"}</span>
            </div>
          </div>
        ))
      }
    </div>
  );
}

function FinancePage({ data }) {
  const { members, finance } = data;
  const tin  = finance.filter(f=>f.amt>0).reduce((a,b)=>a+b.amt,0);
  const tout = finance.filter(f=>f.amt<0).reduce((a,b)=>a+b.amt,0);
  const net  = tin+tout;
  const maxBal = Math.max(1,...members.map(m=>m.bal));

  const imap = {income:"fi",expense:"fo",transfer:"fx"};
  const emap = {income:"💵",expense:"💸",transfer:"🔄"};

  return (
    <div className="page">
      <div className="fsum3">
        <div className="fsb fi ca"><div className="fv">+{fmt(tin)}</div><div className="fl">إجمالي الدخل</div></div>
        <div className="fsb fo ca"><div className="fv">{fmt(tout)}</div><div className="fl">المصروف</div></div>
        <div className="fsb fn ca"><div className="fv" style={{color:net>=0?"var(--g)":"var(--red)"}}>{net>=0?"+":""}{fmt(net)}</div><div className="fl">الصافي</div></div>
      </div>

      <div className="lbl">💰 ثروة الأعضاء</div>
      <div className="gcard ca">
        {members.filter(m=>m.bal>0).map((m,i) => {
          const c = memberColor(m._idx);
          return (
            <div key={m.id||i} className="wbr">
              <div className="wbn" style={{color:c.from,fontSize:12,fontWeight:800}}>{m.name}</div>
              <div className="wbt"><div className="wbf" style={{width:`${(m.bal/maxBal)*100}%`,background:`linear-gradient(90deg,${c.from},${c.to})`,boxShadow:`0 0 8px ${c.sh}`}}/></div>
              <div className="wba">{fmt(m.bal)}</div>
            </div>
          );
        })}
        {members.filter(m=>m.bal>0).length===0 && (
          <div style={{color:"var(--sub)",fontSize:13,textAlign:"center",padding:"16px 0"}}>لا توجد بيانات رصيد</div>
        )}
      </div>

      <div className="lbl">📋 العمليات ({finance.length})</div>
      {finance.length===0
        ? <div className="no-data"><div className="ni">💸</div>لا توجد عمليات</div>
        : finance.slice().reverse().slice(0,30).map((f,i)=>{
          const type = f.amt>=0?"income":"expense";
          const cls = imap[type]||"fx";
          return (
            <div key={i} className={`fitem ${cls} ca`}>
              <div className={`fico ${cls}`}>{emap[type]}</div>
              <div className="fmeta">
                <div className="fmem">{f.membId}</div>
                <div className="fdesc">{f.desc||f.type}</div>
                <div className="fdate">📅 {f.date}</div>
              </div>
              <div className={`famt ${f.amt>=0?"pos":"neg"}`}>
                {f.amt>=0?"+":""}{fmt(f.amt)}
              </div>
            </div>
          );
        })
      }
    </div>
  );
}

function RankingsPage({ data }) {
  const { members, allTourns } = data;
  const [h2hOpen, setH2hOpen] = useState(false);
  const sorted = [...members].sort((a,b)=>b.trph-a.trph);
  const maxTrph = sorted[0]?.trph || 1;

  return (
    <div className="page">
      {/* Podium */}
      {sorted.length >= 3 && (
        <div className="podium ca">
          {[sorted[1],sorted[0],sorted[2]].map((m,i)=>{
            const c = memberColor(m._idx);
            const heights=["54px","72px","42px"];
            const medals=["🥈","🥇","🥉"];
            const pClasses=["pod-2","pod-1","pod-3"];
            return(
              <div key={m.id||i} className="pod-item">
                {i===1&&<div style={{fontSize:22,textAlign:"center"}} className="float">👑</div>}
                <MemberAv m={m} size={i===1?56:46} radius={i===1?17:14}/>
                <div className="pod-name" style={{fontSize:i===1?13:11,color:i===1?c.text:undefined}}>{m.name}</div>
                <div className="pod-pts" style={{color:i===1?"var(--g)":undefined}}>{m.trph} 🏆</div>
                <div className={`pod-base ${pClasses[i]}`} style={{height:heights[i]}}>
                  <span style={{fontSize:i===1?26:18}}>{medals[i]}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="lbl">📊 الترتيب الكامل</div>
      <div className="rkhd"><span>#</span><span style={{textAlign:"right"}}>العضو</span><span>ألقاب</span><span>تقييم</span><span>رصيد</span></div>

      {sorted.map((m,i)=>{
        const c = memberColor(m._idx);
        return(
          <div key={m.id||i} className={`rkrow ca ${i===0?"t1":i===1?"t2":i===2?"t3":""}`}>
            <div className="rknum">{i===0?"🥇":i===1?"🥈":i===2?"🥉":i+1}</div>
            <div className="rknw">
              <div className="rkn">
                <div style={{width:20,height:20,borderRadius:6,background:`linear-gradient(135deg,${c.from},${c.to})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:900,color:"#fff",flexShrink:0}}>
                  {initials(m.name)}
                </div>
                {m.name}
              </div>
              <div className="rkcl">{m.team||""}</div>
              <div className="ptsbar"><div className="ptsfill" style={{width:`${(m.trph/maxTrph)*100}%`,background:`linear-gradient(90deg,${c.from},${c.to})`}}/></div>
            </div>
            <div className="rktrph">🏆 {m.trph}</div>
            <div className="rkrtg" style={{color:c.from}}>{m.rating||"—"}</div>
            <div className="rkbal" style={{fontSize:11,color:"var(--sub2)"}}>{fmt(m.bal)||"—"}</div>
          </div>
        );
      })}

      {/* H2H Button */}
      <button className="h2h-btn" onClick={()=>setH2hOpen(true)}>
        ⚔️ المقارنة المباشرة بين عضوين
      </button>

      {/* Legend */}
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

      {h2hOpen && <H2H members={members} allTourns={allTourns} onClose={()=>setH2hOpen(false)}/>}
    </div>
  );
}

// ── APP SHELL ─────────────────────────────────────────────────
const TABS = [
  {id:"home",      icon:"🏠",label:"الرئيسية"},
  {id:"cards",     icon:"🃏",label:"البطاقات",badge:true},
  {id:"members",   icon:"👥",label:"الأعضاء"},
  {id:"tourns",    icon:"🏆",label:"البطولات"},
  {id:"market",    icon:"🔄",label:"السوق"},
  {id:"finance",   icon:"💰",label:"المالية"},
  {id:"rankings",  icon:"📊",label:"التصنيف"},
];

const HDRS = {
  home:    {t:"فيفا جروب",  s:"FIFA GROUP V4"},
  cards:   {t:"البطاقات",   s:"FUT CARDS"},
  members: {t:"الأعضاء",    s:"MEMBERS"},
  tourns:  {t:"البطولات",   s:"TOURNAMENT ARCHIVE"},
  market:  {t:"سوق الانتقالات",s:"TRANSFER MARKET"},
  finance: {t:"المالية",    s:"FINANCIAL RECORDS"},
  rankings:{t:"التصنيف",    s:"SEASON RANKINGS"},
};

export default function App() {
  const [tab, setTab]       = useState("home");
  const [splash, setSplash] = useState(true);
  const { data, loading }   = useAppData();

  useEffect(() => {
    const t = setTimeout(() => setSplash(false), 2600);
    return () => clearTimeout(t);
  }, []);

  const h = HDRS[tab];

  const render = () => {
    if (!data) return <div className="loader"><div className="spin"/><span>جاري تحميل البيانات...</span></div>;
    switch(tab) {
      case "home":     return <HomePage data={data}/>;
      case "cards":    return <CardsPage data={data}/>;
      case "members":  return <MembersPage data={data}/>;
      case "tourns":   return <TournamentsPage data={data}/>;
      case "market":   return <MarketPage data={data}/>;
      case "finance":  return <FinancePage data={data}/>;
      case "rankings": return <RankingsPage data={data}/>;
      default:         return <HomePage data={data}/>;
    }
  };

  return (
    <>
      <style>{CSS}</style>
      {splash && <SplashScreen done={!splash}/>}
      <div className="shell">
        <div className="pitch-bg"/>
        <div className="pitch-ring"/>
        <Ticker/>
        <div className="topbar">
          <div className="brand">
            <div className="brand-ico">⚽</div>
            <div className="brand-txt"><h1>{h.t}</h1><p>{h.s}</p></div>
          </div>
          <div className="season-chip">
            <span className="ldot"/>
            {loading ? "جاري التحميل..." : `${data?.members?.length||0} أعضاء`}
          </div>
        </div>
        {loading
          ? <div className="loader"><div className="spin"/><span>جاري جلب البيانات الحقيقية...</span></div>
          : render()
        }
        <nav className="bnav">
          {TABS.map(t=>(
            <button key={t.id} className={`nb${tab===t.id?" on":""}`} onClick={()=>setTab(t.id)} style={{position:"relative"}}>
              <span className="ni">{t.icon}</span>
              <span className="nl">{t.label}</span>
              {t.badge&&tab!=="cards"&&<span className="nbdot"/>}
            </button>
          ))}
        </nav>
      </div>
    </>
  );
}
