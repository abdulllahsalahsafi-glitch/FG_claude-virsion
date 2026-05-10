// ╔══════════════════════════════════════════════════════════════╗
// ║   FIFA GROUP — V3 VISUAL UPGRADE                             ║
// ║   الاستخدام: أضف <style>{v3OverrideCss}</style>             ║
// ║   بعد آخر سطر <style> في return() الخاص بـ App             ║
// ╚══════════════════════════════════════════════════════════════╝

export const v3OverrideCss = `

@import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap');

/* ══════════════════════════════════════
   1. CSS VARIABLES — اللون الأخضر بدل السيان
══════════════════════════════════════ */
:root {
  --cyan:       #00E676;
  --blue:       #00B85C;
  --violet:     #A855F7;
  --gold:       #FFD700;
  --gold-dim:   rgba(255,215,0,0.10);
  --gold-bor:   rgba(255,215,0,0.25);
  --g-dim:      rgba(0,230,118,0.10);
  --g-bor:      rgba(0,230,118,0.25);
  --red-v3:     #FF4757;
}

/* ══════════════════════════════════════
   2. FONT — تاجوال بدل Tahoma
══════════════════════════════════════ */
html, body, #root, .app,
button, input, select, textarea,
.moneyTransferModal, .playerOfferModal,
.notificationsModal, .sideDrawer,
.infoModal, .mainNav, .navBtn {
  font-family: 'Tajawal', Tahoma, Arial, sans-serif !important;
}

/* ══════════════════════════════════════
   3. BACKGROUND — خطوط الملعب
══════════════════════════════════════ */
.app::before {
  background:
    radial-gradient(ellipse 340px 180px at 50% -2%,  rgba(0,230,118,0.08)  0%, transparent 60%),
    radial-gradient(ellipse 260px 260px at 8%  6%,   rgba(0,230,118,0.10)  0%, transparent 55%),
    radial-gradient(ellipse 220px 220px at 94% 10%,  rgba(168,85,247,0.08) 0%, transparent 55%),
    linear-gradient(rgba(0,230,118,0.022) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0,230,118,0.022) 1px, transparent 1px),
    linear-gradient(135deg, #020617 0%, #070f1e 48%, #030712 100%) !important;
  background-size:
    100% 100%, 100% 100%, 100% 100%,
    44px 44px, 44px 44px,
    100% 100% !important;
}

/* منتصف الملعب */
.app::after {
  content: '' !important;
  position: fixed !important;
  top: 38% !important;
  left: 50% !important;
  transform: translate(-50%, -50%) !important;
  width: 240px !important;
  height: 240px !important;
  border-radius: 50% !important;
  border: 1px solid rgba(0,230,118,0.04) !important;
  pointer-events: none !important;
  z-index: 0 !important;
}

/* ══════════════════════════════════════
   4. BACKGROUND ORBS
══════════════════════════════════════ */
.bgOrbOne {
  background: rgba(0,230,118,0.12) !important;
  width: 300px !important;
  height: 300px !important;
  top: 60px !important;
  left: 30px !important;
  filter: blur(15px) !important;
}
.bgOrbTwo {
  background: rgba(168,85,247,0.09) !important;
  width: 280px !important;
  height: 280px !important;
  top: 55px !important;
  right: 20px !important;
  filter: blur(15px) !important;
}

/* ══════════════════════════════════════
   5. BOTTOM NAV — الشريط السفلي
══════════════════════════════════════ */
.mainNav,
.mainNav.glassSoft {
  background:  rgba(4,5,14,0.97) !important;
  border:      1px solid rgba(0,230,118,0.10) !important;
  box-shadow:
    0 -1px 0 rgba(0,230,118,0.08),
    0 24px 60px rgba(0,0,0,0.55),
    inset 0 1px 0 rgba(255,255,255,0.06) !important;
  backdrop-filter: blur(32px) saturate(180%) !important;
  -webkit-backdrop-filter: blur(32px) saturate(180%) !important;
}

/* الخط الأخضر المتدرج فوق الناف */
.mainNav::before,
.mainNav.glassSoft::before {
  content: '' !important;
  display: block !important;
  position: absolute !important;
  top: 0 !important;
  left: 0 !important;
  right: 0 !important;
  height: 1px !important;
  background: linear-gradient(
    90deg,
    transparent 0%,
    var(--cyan) 30%,
    #00D4FF 50%,
    var(--cyan) 70%,
    transparent 100%
  ) !important;
  opacity: 0.38 !important;
  border-radius: inherit !important;
}

.navBtn {
  font-family: 'Tajawal', sans-serif !important;
  font-weight: 800 !important;
  border-radius: 16px !important;
  transition: all 0.2s ease !important;
}

.navBtn.active {
  background: linear-gradient(
    135deg,
    rgba(0,230,118,0.14),
    rgba(0,184,92,0.08)
  ) !important;
  border: 1px solid rgba(0,230,118,0.28) !important;
  color: #00E676 !important;
  box-shadow: 0 0 14px rgba(0,230,118,0.10) !important;
}

.navBtn .navIcon { transition: transform 0.2s !important; }
.navBtn.active .navIcon { transform: scale(1.16) !important; }

.navBtn .navLabel {
  font-size: 9.5px !important;
  font-weight: 800 !important;
  font-family: 'Tajawal', sans-serif !important;
}
.navBtn.active .navLabel { color: #00E676 !important; }

/* ══════════════════════════════════════
   6. GLASS EFFECTS
══════════════════════════════════════ */
.glass {
  background:
    linear-gradient(135deg, rgba(255,255,255,0.07), rgba(255,255,255,0.025)) !important;
  border: 1px solid rgba(255,255,255,0.11) !important;
  backdrop-filter: blur(28px) saturate(160%) !important;
  -webkit-backdrop-filter: blur(28px) saturate(160%) !important;
  box-shadow:
    0 22px 60px rgba(0,0,0,0.44),
    inset 0 1px 0 rgba(255,255,255,0.13) !important;
}

.glassSoft {
  background:
    linear-gradient(135deg, rgba(255,255,255,0.045), rgba(255,255,255,0.018)) !important;
  border: 1px solid rgba(255,255,255,0.08) !important;
  backdrop-filter: blur(22px) saturate(150%) !important;
  -webkit-backdrop-filter: blur(22px) saturate(150%) !important;
  box-shadow:
    0 15px 42px rgba(0,0,0,0.34),
    inset 0 1px 0 rgba(255,255,255,0.09) !important;
}

/* ══════════════════════════════════════
   7. MAIN HERO (Header)
══════════════════════════════════════ */
.mainHero:not(.hasCoverImage) {
  background:
    linear-gradient(145deg, rgba(4,8,20,0.88), rgba(8,18,36,0.72)) !important;
  border: 1px solid rgba(0,230,118,0.14) !important;
  backdrop-filter: blur(18px) !important;
}

.heroKicker { color: var(--cyan) !important; font-weight: 900 !important; }
.heroKicker span {
  background: var(--cyan) !important;
  box-shadow: 0 0 20px var(--cyan) !important;
}

.mainHero h1 {
  background: linear-gradient(135deg, #fff 40%, var(--cyan));
  -webkit-background-clip: text !important;
  -webkit-text-fill-color: transparent !important;
  background-clip: text !important;
}

/* ══════════════════════════════════════
   8. MEMBER CARDS — كروت الأعضاء
══════════════════════════════════════ */
.seasonMembersGrid,
.listGrid { gap: 11px !important; }

.seasonMemberCard {
  height: 90px !important;
  border-radius: 22px !important;
  border: 1px solid rgba(255,255,255,0.07) !important;
  background:
    linear-gradient(
      135deg,
      rgba(255,255,255,0.04),
      rgba(255,255,255,0.015)
    ) !important;
  backdrop-filter: blur(12px) !important;
  -webkit-backdrop-filter: blur(12px) !important;
  box-shadow:
    0 4px 24px rgba(0,0,0,0.22),
    inset 0 1px 0 rgba(255,255,255,0.08) !important;
  transition: transform 0.18s ease, border-color 0.2s !important;
}

.seasonMemberCard:active { transform: scale(0.97) !important; }

/* الأول - ذهبي */
.seasonMembersGrid > :first-child .seasonMemberCard,
.listGrid > :first-child .seasonMemberCard {
  border-color: rgba(255,215,0,0.30) !important;
  background:
    linear-gradient(135deg, rgba(255,215,0,0.06), rgba(255,255,255,0.02)) !important;
  box-shadow:
    0 4px 24px rgba(255,215,0,0.10),
    inset 0 1px 0 rgba(255,215,0,0.12) !important;
}

/* الثاني - فضي */
.seasonMembersGrid > :nth-child(2) .seasonMemberCard,
.listGrid > :nth-child(2) .seasonMemberCard {
  border-color: rgba(192,192,192,0.20) !important;
}

/* الثالث - برونزي */
.seasonMembersGrid > :nth-child(3) .seasonMemberCard,
.listGrid > :nth-child(3) .seasonMemberCard {
  border-color: rgba(205,127,50,0.20) !important;
}

.seasonMemberRank {
  background: rgba(0,230,118,0.08) !important;
  border: 1px solid rgba(0,230,118,0.18) !important;
  color: var(--cyan) !important;
  font-weight: 900 !important;
}

.seasonMemberCard em {
  background: linear-gradient(135deg, var(--cyan), var(--blue)) !important;
  color: #020617 !important;
  font-weight: 900 !important;
  box-shadow: 0 4px 16px rgba(0,230,118,0.30) !important;
}

/* ══════════════════════════════════════
   9. PROFILE CARD — بطاقة العضو
══════════════════════════════════════ */
.profileCard {
  background:
    linear-gradient(145deg, rgba(4,8,20,0.80), rgba(8,18,36,0.60)) !important;
  border: 1px solid rgba(0,230,118,0.14) !important;
  backdrop-filter: blur(18px) !important;
  -webkit-backdrop-filter: blur(18px) !important;
  box-shadow:
    0 8px 36px rgba(0,0,0,0.30),
    inset 0 1px 0 rgba(255,255,255,0.09) !important;
}

.chips span {
  background: rgba(0,230,118,0.07) !important;
  border: 1px solid rgba(0,230,118,0.14) !important;
  color: #d1fae5 !important;
}

/* ══════════════════════════════════════
   10. STAT CARDS
══════════════════════════════════════ */
.statCard {
  background: rgba(255,255,255,0.032) !important;
  border: 1px solid rgba(255,255,255,0.07) !important;
  backdrop-filter: blur(10px) !important;
  -webkit-backdrop-filter: blur(10px) !important;
  transition: transform 0.18s, border-color 0.2s !important;
}
.statCard:hover, .statCard:active { transform: scale(0.97) !important; }
.statCard.clickable:hover { border-color: rgba(0,230,118,0.22) !important; }
.statCard b { color: #ecfeff !important; }
.statCard small { font-weight: 800 !important; }

/* ══════════════════════════════════════
   11. TABS
══════════════════════════════════════ */
.tabBtn {
  font-family: 'Tajawal', sans-serif !important;
  font-weight: 800 !important;
  height: 38px !important;
  border-radius: 20px !important;
  background: rgba(255,255,255,0.05) !important;
  border: 1px solid rgba(255,255,255,0.09) !important;
  transition: all 0.18s !important;
}

.tabBtn.active {
  background: linear-gradient(
    135deg,
    rgba(0,230,118,0.14),
    rgba(0,184,92,0.08)
  ) !important;
  border-color: rgba(0,230,118,0.32) !important;
  color: var(--cyan) !important;
}

/* ══════════════════════════════════════
   12. PLAYER CARDS
══════════════════════════════════════ */
.playerCard {
  background: rgba(2,6,23,0.44) !important;
  border: 1px solid rgba(255,255,255,0.07) !important;
  backdrop-filter: blur(10px) !important;
  transition: transform 0.18s, border-color 0.2s !important;
}
.playerCard:hover { border-color: rgba(0,230,118,0.18) !important; }

.playerMeta span {
  background: rgba(0,230,118,0.07) !important;
  border-color: rgba(0,230,118,0.16) !important;
  color: #86efac !important;
}

/* التقييم — ذهبي بدل السيان */
.playerRating {
  background: linear-gradient(135deg, #FFD700, #E6A800) !important;
  color: #020617 !important;
  font-weight: 900 !important;
  box-shadow: 0 4px 14px rgba(255,215,0,0.32) !important;
}

/* ══════════════════════════════════════
   13. SECTION BOX
══════════════════════════════════════ */
.sectionBox {
  background: rgba(255,255,255,0.022) !important;
  border: 1px solid rgba(255,255,255,0.055) !important;
  backdrop-filter: blur(8px) !important;
}

.sectionHead h3 {
  background: linear-gradient(135deg, #fff 50%, var(--cyan));
  -webkit-background-clip: text !important;
  -webkit-text-fill-color: transparent !important;
  background-clip: text !important;
}

/* ══════════════════════════════════════
   14. FINANCE CARDS
══════════════════════════════════════ */
.financeCard {
  background: rgba(2,6,23,0.42) !important;
  border: 1px solid rgba(255,255,255,0.07) !important;
  backdrop-filter: blur(10px) !important;
  border-right: 3px solid rgba(255,255,255,0.08) !important;
  transition: transform 0.18s !important;
}
.financeCard.income {
  border-color: rgba(0,230,118,0.30) !important;
  border-right-color: var(--cyan) !important;
  background: rgba(0,230,118,0.04) !important;
}
.financeCard.expense {
  border-color: rgba(255,71,87,0.28) !important;
  border-right-color: #FF4757 !important;
  background: rgba(255,71,87,0.04) !important;
}

/* ══════════════════════════════════════
   15. TRANSFER CARDS
══════════════════════════════════════ */
.transferCard {
  background: rgba(2,6,23,0.42) !important;
  border: 1px solid rgba(255,255,255,0.07) !important;
  backdrop-filter: blur(10px) !important;
  transition: transform 0.18s, border-color 0.2s !important;
}
.transferCard:hover { border-color: rgba(0,230,118,0.18) !important; }

.transferRating {
  background: linear-gradient(135deg, #FFD700, #E6A800) !important;
  color: #020617 !important;
  font-weight: 900 !important;
  box-shadow: 0 4px 12px rgba(255,215,0,0.28) !important;
}

/* ══════════════════════════════════════
   16. RANKING CARDS
══════════════════════════════════════ */
.rankingCard {
  background: rgba(2,6,23,0.42) !important;
  border: 1px solid rgba(255,255,255,0.07) !important;
  backdrop-filter: blur(10px) !important;
  border-radius: 22px !important;
  transition: transform 0.18s !important;
}
.rankingCard.first {
  border-color: rgba(0,230,118,0.40) !important;
  background:
    linear-gradient(135deg, rgba(0,230,118,0.09), rgba(2,6,23,0.42)) !important;
  box-shadow: 0 0 22px rgba(0,230,118,0.09) !important;
}

/* ══════════════════════════════════════
   17. CHAMPION & FINAL ROW
══════════════════════════════════════ */
.championRow {
  background: rgba(2,6,23,0.42) !important;
  border-color: rgba(255,255,255,0.07) !important;
  backdrop-filter: blur(10px) !important;
}

.finalRow {
  background: rgba(2,6,23,0.42) !important;
  border-color: rgba(255,255,255,0.07) !important;
  backdrop-filter: blur(10px) !important;
}
.finalRow.win  { border-color: rgba(0,230,118,0.35)  !important; }
.finalRow.loss { border-color: rgba(255,71,87,0.32)   !important; }
.finalRow em   { color: var(--cyan) !important; }

/* ══════════════════════════════════════
   18. ARCHIVE SEASON CARDS
══════════════════════════════════════ */
.archiveSeasonCard {
  border: 1px solid rgba(255,255,255,0.07) !important;
  backdrop-filter: blur(10px) !important;
  transition: border-color 0.2s !important;
}
.archiveSeasonCard:hover { border-color: rgba(0,230,118,0.22) !important; }

.archiveSeasonCard em {
  background: linear-gradient(135deg, var(--cyan), var(--blue)) !important;
  box-shadow: 0 4px 14px rgba(0,230,118,0.28) !important;
}

/* ══════════════════════════════════════
   19. TROPHY CARDS
══════════════════════════════════════ */
.trophyCard {
  background: rgba(2,6,23,0.38) !important;
  border-color: rgba(255,255,255,0.07) !important;
  backdrop-filter: blur(8px) !important;
  transition: transform 0.18s !important;
}
.trophyCard.won {
  background:
    linear-gradient(180deg, rgba(0,230,118,0.10), rgba(255,255,255,0.03)) !important;
  border-color: rgba(0,230,118,0.38) !important;
}
.trophyCard b { color: var(--cyan) !important; }

/* ══════════════════════════════════════
   20. STATS TABLE
══════════════════════════════════════ */
.statsTableHead {
  background: rgba(0,230,118,0.06) !important;
  border: 1px solid rgba(0,230,118,0.12) !important;
}
.statsTableRow {
  background: rgba(2,6,23,0.38) !important;
  border-color: rgba(255,255,255,0.06) !important;
  backdrop-filter: blur(6px) !important;
}
.statsTableRow i {
  background: linear-gradient(90deg, var(--cyan), #00D4FF) !important;
}

/* ══════════════════════════════════════
   21. LINK TILES
══════════════════════════════════════ */
.linkTile {
  background: rgba(2,6,23,0.38) !important;
  border-color: rgba(255,255,255,0.07) !important;
  backdrop-filter: blur(8px) !important;
  transition: border-color 0.2s, transform 0.18s !important;
}
.linkTile:hover {
  border-color: rgba(0,230,118,0.22) !important;
  transform: scale(0.97) !important;
}

/* ══════════════════════════════════════
   22. NOTIFICATION ITEMS
══════════════════════════════════════ */
.notificationItem {
  background: rgba(2,6,23,0.44) !important;
  border-color: rgba(0,230,118,0.13) !important;
  backdrop-filter: blur(8px) !important;
  border-radius: 18px !important;
}
.notificationItem.read { opacity: 0.62 !important; }

/* ══════════════════════════════════════
   23. SEASON TROPHY CHIPS
══════════════════════════════════════ */
.seasonTrophyChips button {
  border-color: rgba(0,230,118,0.14) !important;
  background: rgba(0,230,118,0.05) !important;
  transition: all 0.18s !important;
}
.seasonTrophyChips button:hover {
  border-color: rgba(0,230,118,0.28) !important;
  background: rgba(0,230,118,0.10) !important;
}
.seasonTrophyChips span { color: var(--cyan) !important; }

/* ══════════════════════════════════════
   24. INPUTS & SEARCH
══════════════════════════════════════ */
.sectionHead input {
  font-family: 'Tajawal', sans-serif !important;
  background: rgba(2,6,23,0.60) !important;
  border-color: rgba(0,230,118,0.12) !important;
  transition: border-color 0.2s, box-shadow 0.2s !important;
}
.sectionHead input:focus {
  border-color: rgba(0,230,118,0.38) !important;
  box-shadow: 0 0 0 3px rgba(0,230,118,0.07) !important;
  outline: none !important;
}

.moneyField input, .moneyField select,
.offerField input, .offerField select,
.offerField textarea {
  font-family: 'Tajawal', sans-serif !important;
  background: rgba(2,6,23,0.65) !important;
  border-color: rgba(0,230,118,0.12) !important;
}

/* ══════════════════════════════════════
   25. BACK BUTTON
══════════════════════════════════════ */
.backToMembersBtn {
  border-color: rgba(0,230,118,0.18) !important;
  background: rgba(0,230,118,0.05) !important;
  color: var(--cyan) !important;
  font-family: 'Tajawal', sans-serif !important;
  font-weight: 800 !important;
  transition: all 0.18s !important;
}
.backToMembersBtn:hover {
  background: rgba(0,230,118,0.10) !important;
  border-color: rgba(0,230,118,0.30) !important;
}

/* ══════════════════════════════════════
   26. MEMBER ACTION PANEL
══════════════════════════════════════ */
.memberActionPanel {
  border: 1px solid rgba(0,230,118,0.12) !important;
  background: rgba(2,6,23,0.42) !important;
  backdrop-filter: blur(10px) !important;
}
.memberActionPanel button {
  font-family: 'Tajawal', sans-serif !important;
  font-weight: 800 !important;
  box-shadow: 0 8px 20px rgba(0,230,118,0.20) !important;
}

/* ══════════════════════════════════════
   27. SIDE DRAWER
══════════════════════════════════════ */
.sideDrawer > button {
  font-family: 'Tajawal', sans-serif !important;
  font-weight: 800 !important;
  border-color: rgba(0,230,118,0.12) !important;
  background: rgba(0,230,118,0.04) !important;
  transition: all 0.18s !important;
}
.sideDrawer > button:hover {
  border-color: rgba(0,230,118,0.24) !important;
  background: rgba(0,230,118,0.08) !important;
}

/* ══════════════════════════════════════
   28. PAGE HEAD
══════════════════════════════════════ */
.pageHead h2 {
  background: linear-gradient(135deg, #fff 40%, var(--cyan));
  -webkit-background-clip: text !important;
  -webkit-text-fill-color: transparent !important;
  background-clip: text !important;
  font-family: 'Tajawal', sans-serif !important;
}

/* ══════════════════════════════════════
   29. OFFER MODAL STYLES
══════════════════════════════════════ */
.offerSegmented button.active {
  background: linear-gradient(135deg, var(--cyan), var(--blue)) !important;
}
.offerOwnPlayer.active {
  border-color: rgba(0,230,118,0.50) !important;
  background: rgba(0,230,118,0.12) !important;
}
.offerSubmitBtn, .moneySubmitBtn {
  font-family: 'Tajawal', sans-serif !important;
  font-weight: 900 !important;
}

/* ══════════════════════════════════════
   30. COMPETITION MATCH CARDS
══════════════════════════════════════ */
.compactResultMatch {
  background: rgba(2,6,23,0.42) !important;
  border-color: rgba(0,230,118,0.15) !important;
  backdrop-filter: blur(8px) !important;
}
.compactResultMatch.completed {
  background: rgba(0,230,118,0.06) !important;
  border-color: rgba(0,230,118,0.28) !important;
}

/* ══════════════════════════════════════
   31. LEAGUE TABLE
══════════════════════════════════════ */
.leagueTableHead {
  background: rgba(0,230,118,0.07) !important;
  border: 1px solid rgba(0,230,118,0.14) !important;
}
.leagueTableRow {
  background: rgba(2,6,23,0.38) !important;
  border-color: rgba(255,255,255,0.07) !important;
  backdrop-filter: blur(6px) !important;
}

/* ══════════════════════════════════════
   32. QUALIFIER BRACKET ROUNDS
══════════════════════════════════════ */
.qualifierBracketRound {
  background: rgba(255,255,255,0.032) !important;
  border-color: rgba(0,230,118,0.12) !important;
  backdrop-filter: blur(8px) !important;
}
.qualifierBracketRound h4 { color: var(--cyan) !important; }

/* ══════════════════════════════════════
   33. WORLD CUP GROUP CARDS
══════════════════════════════════════ */
.worldCupGroupCard {
  background: rgba(2,6,23,0.50) !important;
  border-color: rgba(0,230,118,0.14) !important;
  backdrop-filter: blur(10px) !important;
}
.worldCupGroupCard h4 { color: var(--cyan) !important; }

/* ══════════════════════════════════════
   34. CUPS — Champion box
══════════════════════════════════════ */
.cupChampionBox {
  background:
    linear-gradient(135deg, rgba(255,215,0,0.12), rgba(0,230,118,0.06)) !important;
  border-color: rgba(255,215,0,0.32) !important;
}
.cupChampionBox span { color: #fde68a !important; }

/* ══════════════════════════════════════
   35. LOANED PLAYER ROW
══════════════════════════════════════ */
.loanedPlayerRow {
  background: rgba(2,6,23,0.38) !important;
  border-color: rgba(255,255,255,0.08) !important;
  backdrop-filter: blur(6px) !important;
}
.loanedPlayerRow span {
  background: rgba(0,230,118,0.08) !important;
  border-color: rgba(0,230,118,0.18) !important;
  color: #86efac !important;
}

/* ══════════════════════════════════════
   36. EMPTY & PUSH NOTIFY
══════════════════════════════════════ */
.empty {
  background: rgba(2,6,23,0.38) !important;
  border: 1px solid rgba(255,255,255,0.06) !important;
  backdrop-filter: blur(6px) !important;
}

.pushNotifyBox {
  background: rgba(2,6,23,0.38) !important;
  border-color: rgba(255,255,255,0.08) !important;
}
.pushNotifyBox.active {
  border-color: rgba(0,230,118,0.28) !important;
  background: rgba(0,230,118,0.07) !important;
}

/* ══════════════════════════════════════
   37. SCROLLBAR
══════════════════════════════════════ */
::-webkit-scrollbar { width: 3px !important; height: 3px !important; }
::-webkit-scrollbar-thumb {
  background: rgba(0,230,118,0.22) !important;
  border-radius: 3px !important;
}
::-webkit-scrollbar-track { background: transparent !important; }

/* ══════════════════════════════════════
   38. GENERAL PAGE ANIMATIONS
══════════════════════════════════════ */
.widePage,
.membersHome,
.memberProfilePage {
  animation: v3pageIn 0.28s ease both;
}

@keyframes v3pageIn {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* ══════════════════════════════════════
   39. SEASON TILE
══════════════════════════════════════ */
.seasonTile {
  background: rgba(2,6,23,0.38) !important;
  border-color: rgba(255,255,255,0.07) !important;
  backdrop-filter: blur(8px) !important;
  transition: transform 0.18s, border-color 0.2s !important;
}
.seasonTile:hover {
  background:
    linear-gradient(180deg, rgba(0,230,118,0.10), rgba(255,255,255,0.03)) !important;
  border-color: rgba(0,230,118,0.38) !important;
  transform: scale(0.97) !important;
}

/* ══════════════════════════════════════
   40. INFO MODAL
══════════════════════════════════════ */
.infoModal {
  font-family: 'Tajawal', sans-serif !important;
}
.infoRows div {
  background: rgba(255,255,255,0.045) !important;
  border: 1px solid rgba(255,255,255,0.07) !important;
  border-radius: 14px !important;
}

`;
