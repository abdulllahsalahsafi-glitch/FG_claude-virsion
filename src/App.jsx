import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { auth, db } from "./firebase";
import { enableFifaPushNotifications, syncFifaPushTokenIfAllowed, listenToForegroundPushMessages } from "./pushNotifications";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { addDoc, collection, deleteDoc, doc, getDoc, onSnapshot, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";

const DEFAULT_CONFIG = {
  mainTitle: "FIFA GROUP",
  seasonName: "الموسم السادس",
  seasonTitle: "الموسم السادس 2025",
  membersTitle: "الأعضاء",
  seasonTournamentsTitle: "بطولات الموسم",
  transfersTitle: "انتقالات الموسم",
  rankingTitle: "تصنيف الموسم",
  linksTitle: "روابط هامة",
  playersTitle: "قائمة اللاعبين",
  trophiesTitle: "البطولات",
  financeTitle: "السجل المالي",
  archiveTitle: "السجل العام للبطولات",
  statsTitle: "الإحصائيات العامة",
  transfersSubtitle:
    "تظهر الفترات تلقائيًا من Google Sheets، ويمكنك إضافة فترة جديدة بدون تعديل الكود.",
  rankingSubtitle: "تصنيف الموسم النشط محسوب تلقائيًا من سجل البطولات.",
  linksSubtitle: "روابط النظام والسجلات والصفحات المهمة.",
  searchPlaceholder: "ابحث عن لاعب أو مركز أو عقد...",
  loadingTitle: "",
  loadingSubtitle: "",
  noDataTitle: "حاول مجددًا",
  errorTitle: "حدث خطأ في تحميل البيانات",
  appStatus: "active",
  maintenanceMessage: "التطبيق تحت الصيانة مؤقتًا",
  showFinance: "true",
  showRanking: "true",
  showTransfers: "true",
  showLinks: "true",
  showSeasonTournaments: "true",
  showMemberTrophies: "true",
  showSearch: "true",
  showArchive: "true",
  showStats: "true",
  defaultPage: "members",
  activeSeasonId: "S6",
  primaryColor: "#00e5ff",
  secondaryColor: "#2f8cff",
  accentColor: "#8b5cf6",
  headerImage: "",
  appIcon: "",
  groupLogo: "",
  exportLogo: "",
  announcement: "",
  coverHeight: "118px",
  coverHeightMobile: "50px",
  balanceIcon: "💰",
  totalTrophiesIcon: "🏆",
  navMembersIcon: "👥",
  navSeasonIcon: "🏆",
  navArchiveIcon: "📚",
  navRankingIcon: "📊",
  navMoreIcon: "☰",
  menuStatsIcon: "📈",
  menuTransfersIcon: "🔁",
  menuLinksIcon: "🔗",
  memberTeamIcon: "⚽",
  memberNationalIcon: "🏳️",
  finalsPlayedIcon: "⚔️",
  finalsWonIcon: "🥇",
  finalsLostIcon: "🥈",
  goalsForIcon: "⚽",
  goalsAgainstIcon: "🥅",
  relegationsIcon: "⬇️",
  seasonCountIcon: "🏆",
  seasonPointsIcon: "⭐",
  rankingTitlesIcon: "🏆",
  rankingPointsIcon: "⭐",
  transferAmountIcon: "💰",
  transferTypeIcon: "📌",
  transferDateIcon: "📅",
  transferNoteIcon: "⏱️",
  linkFacebookIcon: "👥",
  linkTournamentsIcon: "🏆",
  linkSeasonIcon: "📘",
  linkDefaultIcon: "📌",
  memberCardTrophyIcon: "🏆",
  archiveTrophyTabIcon: "🏆",
  archiveSeasonTabIcon: "📅",
  archiveMemberTabIcon: "👤",
};

const FALLBACK_PLAYER_IMAGE =
  "https://cdn-icons-png.flaticon.com/512/847/847969.png";

const PUSH_SW_PATH_FOR_FOREGROUND = "/firebase-messaging-sw.js";

const OFFER_FEE = 500000;
const MAX_DAILY_PLAYER_OFFERS = 5;
const PLAYER_OFFER_EXPIRE_DAYS = 3;
const MAX_PRO_PLAYERS = 5;
const MIN_SQUAD_PLAYERS = 17;
const MAX_SQUAD_PLAYERS = 32;
const LOAN_TERMINATION_COMPENSATION = 10000000;
const FREE_AGENT_REPLACEMENT_FEE = 5000000;

const URLS = {
  members:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vSDrHv3359NOsLcR5FqhRLs4MyYBxWzKI1iVZNVKT1_8vIPMOyqqzJF5qSah5cmYIuj182gYQAVwccm/pub?gid=0&single=true&output=csv",
  players:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vSDrHv3359NOsLcR5FqhRLs4MyYBxWzKI1iVZNVKT1_8vIPMOyqqzJF5qSah5cmYIuj182gYQAVwccm/pub?gid=1768795422&single=true&output=csv",
  trophiesLegacy:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vSDrHv3359NOsLcR5FqhRLs4MyYBxWzKI1iVZNVKT1_8vIPMOyqqzJF5qSah5cmYIuj182gYQAVwccm/pub?gid=1777972903&single=true&output=csv",
  trophiesMaster:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vSDrHv3359NOsLcR5FqhRLs4MyYBxWzKI1iVZNVKT1_8vIPMOyqqzJF5qSah5cmYIuj182gYQAVwccm/pub?gid=694104264&single=true&output=csv",
  leagueArchive:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vSDrHv3359NOsLcR5FqhRLs4MyYBxWzKI1iVZNVKT1_8vIPMOyqqzJF5qSah5cmYIuj182gYQAVwccm/pub?gid=1337187883&single=true&output=csv",
  tournamentsArchive:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vSDrHv3359NOsLcR5FqhRLs4MyYBxWzKI1iVZNVKT1_8vIPMOyqqzJF5qSah5cmYIuj182gYQAVwccm/pub?gid=1271747498&single=true&output=csv",
  seasons:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vSDrHv3359NOsLcR5FqhRLs4MyYBxWzKI1iVZNVKT1_8vIPMOyqqzJF5qSah5cmYIuj182gYQAVwccm/pub?gid=1861704915&single=true&output=csv",
  finance:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vSDrHv3359NOsLcR5FqhRLs4MyYBxWzKI1iVZNVKT1_8vIPMOyqqzJF5qSah5cmYIuj182gYQAVwccm/pub?gid=1521741565&single=true&output=csv",
  transfers:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vSDrHv3359NOsLcR5FqhRLs4MyYBxWzKI1iVZNVKT1_8vIPMOyqqzJF5qSah5cmYIuj182gYQAVwccm/pub?gid=157620707&single=true&output=csv",
  importantLinks:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vSDrHv3359NOsLcR5FqhRLs4MyYBxWzKI1iVZNVKT1_8vIPMOyqqzJF5qSah5cmYIuj182gYQAVwccm/pub?gid=1147950511&single=true&output=csv",
  settings:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vSDrHv3359NOsLcR5FqhRLs4MyYBxWzKI1iVZNVKT1_8vIPMOyqqzJF5qSah5cmYIuj182gYQAVwccm/pub?gid=1487747915&single=true&output=csv",
};

export default function App() {
  const [members, setMembers] = useState([]);
  const [players, setPlayers] = useState([]);
  const [trophiesMaster, setTrophiesMaster] = useState([]);
  const [leagueArchive, setLeagueArchive] = useState([]);
  const [tournamentsArchive, setTournamentsArchive] = useState([]);
  const [seasons, setSeasons] = useState([]);
  const [finance, setFinance] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [importantLinks, setImportantLinks] = useState([]);
  const [config, setConfig] = useState(DEFAULT_CONFIG);

  const [page, setPage] = useState(DEFAULT_CONFIG.defaultPage);
  const [selectedId, setSelectedId] = useState("");
  const [memberTab, setMemberTab] = useState("players");
  const [transferPeriod, setTransferPeriod] = useState("");
  const [search, setSearch] = useState("");
  const [detailView, setDetailView] = useState(null);
  const [detailStack, setDetailStack] = useState([]);
  const baseScrollRef = useRef(0);
  const pendingScrollRef = useRef(null);
  const restoringScrollRef = useRef(false);
  const [infoModal, setInfoModal] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [topBarScrolled, setTopBarScrolled] = useState(false);
  const [authUser, setAuthUser] = useState(null);
  const [authProfile, setAuthProfile] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [firebaseMoneyTransfers, setFirebaseMoneyTransfers] = useState([]);
  const [firebasePlayerOffers, setFirebasePlayerOffers] = useState([]);
  const [firebaseNotifications, setFirebaseNotifications] = useState([]);
  const [firebaseTransferWindows, setFirebaseTransferWindows] = useState([]);
  const [firebasePlayerContracts, setFirebasePlayerContracts] = useState([]);
  const [firebaseTransferHistory, setFirebaseTransferHistory] = useState([]);
  const [firebasePlayerReleases, setFirebasePlayerReleases] = useState([]);
  const [firebaseFreeAgentRegistrations, setFirebaseFreeAgentRegistrations] = useState([]);
  const [firebaseFreePlayerStatus, setFirebaseFreePlayerStatus] = useState([]);
  const [firebaseFreeAgentQueue, setFirebaseFreeAgentQueue] = useState([]);
  const [firebaseMemberRestrictions, setFirebaseMemberRestrictions] = useState([]);
  const [firebaseAdminDecisions, setFirebaseAdminDecisions] = useState([]);
  const [firebaseAdminNotes, setFirebaseAdminNotes] = useState([]);
  const [firebasePushTokens, setFirebasePushTokens] = useState([]);
  const [firebaseCompetitions, setFirebaseCompetitions] = useState([]);
  const [focusedCompetitionId, setFocusedCompetitionId] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [pushStatus, setPushStatus] = useState(getInitialPushStatus());
  const [pushBusy, setPushBusy] = useState(false);

  useEffect(() => {
    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport)
      viewport.setAttribute(
        "content",
        "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
      );
    document.title = "FIFA GROUP";
    loadData();
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        if (!user) {
          setAuthUser(null);
          setAuthProfile(null);
          return;
        }

        const profileRef = doc(db, "users", user.uid);
        const profileSnap = await getDoc(profileRef);
        setAuthUser(user);
        setAuthProfile(profileSnap.exists() ? profileSnap.data() : null);
      } catch (err) {
        console.error("Auth profile failed:", err);
        setAuthUser(user || null);
        setAuthProfile(null);
      } finally {
        setAuthLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);


  useEffect(() => {
    if (!authUser) {
      setFirebaseMoneyTransfers([]);
      return undefined;
    }

    const unsubscribe = onSnapshot(
      collection(db, "moneyTransfers"),
      (snapshot) => {
        const rows = snapshot.docs.map((item) => {
          const data = item.data() || {};
          return {
            id: item.id,
            ...data,
            type: data.type || "تحويل مالي",
            direction: "transfer",
            amount: data.amount,
            fromMemberId: data.fromMemberId,
            toMemberId: data.toMemberId,
            date: data.date || formatTransferDate(data.createdAt),
            note: data.note || "تحويل تلقائي من التطبيق",
          };
        });
        setFirebaseMoneyTransfers(rows);
      },
      (err) => {
        console.error("Money transfers listener failed:", err);
        setFirebaseMoneyTransfers([]);
      }
    );

    return () => unsubscribe();
  }, [authUser]);

  useEffect(() => {
    if (!authUser) {
      setFirebasePlayerOffers([]);
      return undefined;
    }

    const unsubscribe = onSnapshot(
      collection(db, "playerOffers"),
      (snapshot) => {
        const rows = snapshot.docs.map((item) => ({
          id: item.id,
          ...(item.data() || {}),
        }));
        setFirebasePlayerOffers(rows);
      },
      (err) => {
        console.error("Player offers listener failed:", err);
        setFirebasePlayerOffers([]);
      }
    );

    return () => unsubscribe();
  }, [authUser]);

  useEffect(() => {
    if (!authUser) {
      setFirebaseNotifications([]);
      return undefined;
    }

    const unsubscribe = onSnapshot(
      collection(db, "notifications"),
      (snapshot) => {
        const rows = snapshot.docs.map((item) => ({
          id: item.id,
          ...(item.data() || {}),
        }));
        setFirebaseNotifications(rows);
      },
      (err) => {
        console.error("Notifications listener failed:", err);
        setFirebaseNotifications([]);
      }
    );

    return () => unsubscribe();
  }, [authUser]);

  useEffect(() => {
    if (!authUser) {
      setFirebaseTransferWindows([]);
      return undefined;
    }

    const unsubscribe = onSnapshot(
      collection(db, "transferWindows"),
      (snapshot) => {
        const rows = snapshot.docs.map((item) => ({
          id: item.id,
          ...(item.data() || {}),
        }));
        setFirebaseTransferWindows(rows);
      },
      (err) => {
        console.error("Transfer windows listener failed:", err);
        setFirebaseTransferWindows([]);
      }
    );

    return () => unsubscribe();
  }, [authUser]);

  useEffect(() => {
    if (!authUser) {
      setFirebasePlayerContracts([]);
      return undefined;
    }

    const unsubscribe = onSnapshot(
      collection(db, "playerContracts"),
      (snapshot) => {
        const rows = snapshot.docs.map((item) => ({
          id: item.id,
          ...(item.data() || {}),
        }));
        setFirebasePlayerContracts(rows);
      },
      (err) => {
        console.error("Player contracts listener failed:", err);
        setFirebasePlayerContracts([]);
      }
    );

    return () => unsubscribe();
  }, [authUser]);

  useEffect(() => {
    if (!authUser) {
      setFirebaseTransferHistory([]);
      return undefined;
    }

    const unsubscribe = onSnapshot(
      collection(db, "transferHistory"),
      (snapshot) => {
        const rows = snapshot.docs.map((item) => ({
          id: item.id,
          ...(item.data() || {}),
        }));
        setFirebaseTransferHistory(rows);
      },
      (err) => {
        console.error("Transfer history listener failed:", err);
        setFirebaseTransferHistory([]);
      }
    );

    return () => unsubscribe();
  }, [authUser]);


  useEffect(() => {
    if (!authUser) {
      setFirebasePlayerReleases([]);
      return undefined;
    }

    const unsubscribe = onSnapshot(
      collection(db, "playerReleases"),
      (snapshot) => {
        const rows = snapshot.docs.map((item) => ({
          id: item.id,
          ...(item.data() || {}),
        }));
        setFirebasePlayerReleases(rows);
      },
      (err) => {
        console.error("Player releases listener failed:", err);
        setFirebasePlayerReleases([]);
      }
    );

    return () => unsubscribe();
  }, [authUser]);

  useEffect(() => {
    if (!authUser) {
      setFirebaseFreeAgentRegistrations([]);
      return undefined;
    }

    const unsubscribe = onSnapshot(
      collection(db, "freeAgentRegistrations"),
      (snapshot) => {
        const rows = snapshot.docs.map((item) => ({
          id: item.id,
          ...(item.data() || {}),
        }));
        setFirebaseFreeAgentRegistrations(rows);
      },
      (err) => {
        console.error("Free agent registrations listener failed:", err);
        setFirebaseFreeAgentRegistrations([]);
      }
    );

    return () => unsubscribe();
  }, [authUser]);

  useEffect(() => {
    if (!authUser) {
      setFirebaseFreePlayerStatus([]);
      return undefined;
    }

    const unsubscribe = onSnapshot(
      collection(db, "freePlayerStatus"),
      (snapshot) => {
        const rows = snapshot.docs.map((item) => ({
          id: item.id,
          ...(item.data() || {}),
        }));
        setFirebaseFreePlayerStatus(rows);
      },
      (err) => {
        console.error("Free player status listener failed:", err);
        setFirebaseFreePlayerStatus([]);
      }
    );

    return () => unsubscribe();
  }, [authUser]);

  useEffect(() => {
    if (!authUser) {
      setFirebaseFreeAgentQueue([]);
      return undefined;
    }

    const unsubscribe = onSnapshot(
      collection(db, "freeAgentQueue"),
      (snapshot) => {
        const rows = snapshot.docs.map((item) => ({
          id: item.id,
          ...(item.data() || {}),
        }));
        setFirebaseFreeAgentQueue(rows);
      },
      (err) => {
        console.error("Free agent queue listener failed:", err);
        setFirebaseFreeAgentQueue([]);
      }
    );

    return () => unsubscribe();
  }, [authUser]);


  useEffect(() => {
    if (!authUser) {
      setFirebaseMemberRestrictions([]);
      return undefined;
    }

    const unsubscribe = onSnapshot(
      collection(db, "memberRestrictions"),
      (snapshot) => {
        const rows = snapshot.docs.map((item) => ({
          id: item.id,
          ...(item.data() || {}),
        }));
        setFirebaseMemberRestrictions(rows);
      },
      (err) => {
        console.error("Member restrictions listener failed:", err);
        setFirebaseMemberRestrictions([]);
      }
    );

    return () => unsubscribe();
  }, [authUser]);


  useEffect(() => {
    if (!authUser) {
      setFirebaseAdminDecisions([]);
      return undefined;
    }

    const unsubscribe = onSnapshot(
      collection(db, "adminDecisions"),
      (snapshot) => {
        const rows = snapshot.docs.map((item) => ({
          id: item.id,
          ...(item.data() || {}),
        }));
        setFirebaseAdminDecisions(rows);
      },
      (err) => {
        console.error("Admin decisions listener failed:", err);
        setFirebaseAdminDecisions([]);
      }
    );

    return () => unsubscribe();
  }, [authUser]);

  useEffect(() => {
    if (!authUser) {
      setFirebaseAdminNotes([]);
      return undefined;
    }

    const unsubscribe = onSnapshot(
      collection(db, "adminNotes"),
      (snapshot) => {
        const rows = snapshot.docs.map((item) => ({
          id: item.id,
          ...(item.data() || {}),
        }));
        setFirebaseAdminNotes(rows);
      },
      (err) => {
        console.error("Admin notes listener failed:", err);
        setFirebaseAdminNotes([]);
      }
    );

    return () => unsubscribe();
  }, [authUser]);

  useEffect(() => {
    if (!authUser || !isFifaAdminProfile(authProfile)) {
      setFirebasePushTokens([]);
      return undefined;
    }

    const unsubscribe = onSnapshot(
      collection(db, "pushTokens"),
      (snapshot) => {
        const rows = snapshot.docs.map((item) => ({
          id: item.id,
          ...(item.data() || {}),
        }));
        setFirebasePushTokens(rows);
      },
      (err) => {
        console.error("Push tokens listener failed:", err);
        setFirebasePushTokens([]);
      }
    );

    return () => unsubscribe();
  }, [authUser, authProfile]);


  useEffect(() => {
    if (!authUser) {
      setFirebaseCompetitions([]);
      return undefined;
    }

    const unsubscribe = onSnapshot(
      collection(db, "competitions"),
      (snapshot) => {
        const rows = snapshot.docs.map((item) => ({
          id: item.id,
          ...(item.data() || {}),
        }));
        setFirebaseCompetitions(rows);
      },
      (err) => {
        console.error("Competitions listener failed:", err);
        setFirebaseCompetitions([]);
      }
    );

    return () => unsubscribe();
  }, [authUser]);

  useEffect(() => {
    if (loading) return;

    const splash = document.getElementById("fifa-splash");
    if (!splash) return;

    const timer = window.setTimeout(() => {
      splash.classList.add("fifa-splash-hide");

      window.setTimeout(() => {
        splash.remove();
      }, 460);
    }, 180);

    return () => window.clearTimeout(timer);
  }, [loading]);

  useEffect(() => {
    if (loading) return undefined;
    const appNode = document.querySelector(".app");
    if (!appNode) return undefined;

    let ticking = false;
    function updateTopBarState() {
      ticking = false;
      setTopBarScrolled(appNode.scrollTop > 12);
    }

    function handleAppScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(updateTopBarState);
    }

    updateTopBarState();
    appNode.addEventListener("scroll", handleAppScroll, { passive: true });

    return () => {
      appNode.removeEventListener("scroll", handleAppScroll);
    };
  }, [loading]);

  useEffect(() => {
    window.history.replaceState({ fifaGroupRoot: true }, "");

    function handleNativeBack() {
      if (infoModal) {
        setInfoModal(null);
        window.history.replaceState({ fifaGroupRoot: true }, "");
        return;
      }

      if (menuOpen) {
        setMenuOpen(false);
        window.history.replaceState({ fifaGroupRoot: true }, "");
        return;
      }

      if (detailView) {
        if (detailStack.length) {
          const previousEntry = detailStack[detailStack.length - 1];
          setDetailStack((stack) => stack.slice(0, -1));
          setDetailView(previousEntry.view);
          restoreScrollPosition(previousEntry.scrollTop);
        } else {
          setDetailView(null);
          restoreScrollPosition(baseScrollRef.current || 0);
        }
        window.history.replaceState({ fifaGroupRoot: true }, "");
        return;
      }

      if (selectedId) {
        setSelectedId("");
        setDetailStack([]);
        setMemberTab("players");
        setSearch("");
        window.history.replaceState({ fifaGroupRoot: true }, "");
        scrollAppToTop("auto");
        return;
      }

      if (page !== "members") {
        setPage("members");
        setSelectedId("");
        setDetailView(null);
        setDetailStack([]);
        setInfoModal(null);
        setMenuOpen(false);
        window.history.replaceState({ fifaGroupRoot: true }, "");
        scrollAppToTop("auto");
        return;
      }

      window.history.pushState({ fifaGroupRoot: true }, "");
    }

    window.addEventListener("popstate", handleNativeBack);
    return () => window.removeEventListener("popstate", handleNativeBack);
  }, [page, selectedId, detailView, detailStack, menuOpen, infoModal]);

  async function loadData() {
    try {
      const [
        membersRows,
        playersRows,
        masterRows,
        leagueRows,
        tournamentRows,
        seasonRows,
        financeRows,
        transferRows,
        linkRows,
        settingsRows,
      ] = await Promise.all([
        loadCSV(URLS.members),
        loadCSV(URLS.players),
        loadCSV(URLS.trophiesMaster),
        loadCSV(URLS.leagueArchive),
        loadCSV(URLS.tournamentsArchive),
        loadCSV(URLS.seasons),
        loadCSV(URLS.finance),
        loadCSV(URLS.transfers),
        loadCSV(URLS.importantLinks),
        loadOptionalCSV(URLS.settings),
      ]);

      const nextConfig = buildConfig(settingsRows);
      const periods = getTransferPeriods(transferRows);
      setMembers(membersRows);
      setPlayers(playersRows);
      setTrophiesMaster(masterRows);
      setLeagueArchive(leagueRows);
      setTournamentsArchive(tournamentRows);
      setSeasons(seasonRows);
      setFinance(financeRows);
      setTransfers(transferRows);
      setImportantLinks(linkRows);
      setConfig(nextConfig);
      setPage(nextConfig.defaultPage || "members");
      setTransferPeriod(periods[0]?.id || "");
    } catch (err) {
      console.error(err);
      setError(DEFAULT_CONFIG.errorTitle);
    } finally {
      setLoading(false);
    }
  }

  const trophyMap = useMemo(
    () => buildTrophyMap(trophiesMaster),
    [trophiesMaster]
  );

  const allTournaments = useMemo(() => {
    const league = leagueArchive
      .filter(hasRecord)
      .map((row) => normalizeTournamentRow(row, "league", trophyMap));
    const other = tournamentsArchive
      .filter(hasRecord)
      .map((row) => normalizeTournamentRow(row, "tournament", trophyMap));
    return [...league, ...other].sort(sortByDateAsc);
  }, [leagueArchive, tournamentsArchive, trophyMap]);

  const activeSeasonId = getActiveSeasonId(seasons, config);
  const activeSeason = findSeason(seasons, activeSeasonId);
  const activeSeasonRows = useMemo(
    () =>
      allTournaments
        .filter((item) => same(item.seasonId, activeSeasonId))
        .sort(sortByDateAsc),
    [allTournaments, activeSeasonId]
  );
  const activeMembers = useMemo(() => getActiveMembers(members), [members]);
  const finalStatsByMember = useMemo(
    () => computeMemberStats(members, allTournaments),
    [members, allTournaments]
  );

  function totalForMember(memberId) {
    return allTournaments.filter((item) => same(item.winnerId, memberId))
      .length;
  }

  const rankedMembers = useMemo(() => {
    return activeMembers
      .slice()
      .sort((a, b) => totalForMember(b.id) - totalForMember(a.id));
  }, [activeMembers, allTournaments]);

  const currentMemberId = cleanId(authProfile?.memberId || authProfile?.memberid || "");
  const currentMember = members.find((member) => same(member.id, currentMemberId));
  const isFifaAdmin = isFifaAdminProfile(authProfile);
  const activeCurrentMemberRestrictions = useMemo(
    () => getActiveMemberRestrictions(firebaseMemberRestrictions, currentMemberId),
    [firebaseMemberRestrictions, currentMemberId]
  );
  const combinedFinance = useMemo(
    () => [...finance, ...firebaseMoneyTransfers],
    [finance, firebaseMoneyTransfers]
  );
  const currentMemberFinance = useMemo(
    () => getMemberFinanceRows(combinedFinance, currentMemberId),
    [combinedFinance, currentMemberId]
  );
  const currentMemberBalance = useMemo(
    () => computeMemberBalance(currentMemberFinance, currentMember?.balance, currentMemberId),
    [currentMemberFinance, currentMember?.balance, currentMemberId]
  );
  const activeCurrentMemberOffers = useMemo(
    () =>
      firebasePlayerOffers.filter((offer) => {
        if (!same(offer.fromMemberId, currentMemberId)) return false;
        return isFinanciallyReservedPlayerOffer(offer);
      }),
    [firebasePlayerOffers, currentMemberId]
  );
  const activeCurrentMemberFreeAgentQueue = useMemo(
    () =>
      firebaseFreeAgentQueue.filter((item) =>
        same(item.memberId, currentMemberId) &&
        ["pending_window", "processing"].includes(clean(item.status || "pending_window"))
      ),
    [firebaseFreeAgentQueue, currentMemberId]
  );
  const reservedOfferAmount = useMemo(
    () => activeCurrentMemberOffers.reduce((sum, offer) => sum + Math.max(0, toNumber(offer.amount)), 0),
    [activeCurrentMemberOffers]
  );
  const reservedFreeAgentAmount = useMemo(
    () => activeCurrentMemberFreeAgentQueue.reduce((sum, item) => sum + Math.max(0, toNumber(item.cost || item.feeAmount)), 0),
    [activeCurrentMemberFreeAgentQueue]
  );
  const currentMemberAvailableBalance = Math.max(0, currentMemberBalance - reservedOfferAmount - reservedFreeAgentAmount);
  const transferMarketOpen = isTransferMarketOpen(firebaseTransferWindows);
  const activePlayerContracts = useMemo(
    () => firebasePlayerContracts.filter((contract) => clean(contract.status || "active") === "active"),
    [firebasePlayerContracts]
  );
  const currentMemberPlayers = useMemo(
    () => getVisiblePlayersForMember(currentMemberId).sort((a, b) => toNumber(b.rating) - toNumber(a.rating)),
    [players, currentMemberId, activePlayerContracts]
  );
  const currentMemberNotifications = useMemo(
    () => firebaseNotifications
      .filter((item) => isNotificationVisibleToMember(item, currentMemberId))
      .sort((a, b) => notificationTimeValue(b.createdAt || b.date) - notificationTimeValue(a.createdAt || a.date)),
    [firebaseNotifications, currentMemberId]
  );
  const topBarNotifications = useMemo(
    () => currentMemberNotifications.slice(0, 10),
    [currentMemberNotifications]
  );
  const unreadNotificationsCount = currentMemberNotifications.filter((item) => clean(item.status || "unread") !== "read").length;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search || "");
    const targetPage = cleanId(params.get("fgPage") || params.get("page"));
    const competitionId = cleanId(params.get("fgCompetitionId") || params.get("competitionId"));
    const memberIdParam = cleanId(params.get("fgMemberId") || params.get("memberId"));
    if (competitionId) {
      setFocusedCompetitionId(competitionId);
      setPage("season");
    } else if (targetPage === "finance" && memberIdParam) {
      setSelectedId(memberIdParam);
      setMemberTab("finance");
      setPage("members");
    } else if (targetPage === "notifications") {
      setNotificationsOpen(true);
    }
    if (targetPage || competitionId || memberIdParam) {
      const cleanUrl = window.location.origin + window.location.pathname;
      window.history.replaceState({ fifaGroupRoot: true }, "", cleanUrl);
    }
  }, []);

  useEffect(() => {
    if (!authUser || pushStatus?.state !== "enabled") return undefined;
    if (typeof window === "undefined") return undefined;

    const unsubscribe = listenToForegroundPushMessages(async (payload) => {
      try {
        if (!("Notification" in window) || window.Notification.permission !== "granted") return;
        if (!("serviceWorker" in navigator)) return;

        const title =
          payload?.notification?.title ||
          payload?.data?.title ||
          "FIFA GROUP";
        const body =
          payload?.notification?.body ||
          payload?.data?.body ||
          "لديك إشعار جديد من FIFA GROUP.";
        const icon =
          payload?.notification?.icon ||
          payload?.data?.icon ||
          "/icon-192.png";
        const tag =
          payload?.data?.notificationId ||
          payload?.data?.id ||
          payload?.data?.relatedOfferId ||
          `fifa-group-${Date.now()}`;

        const registration =
          (await navigator.serviceWorker.getRegistration(PUSH_SW_PATH_FOR_FOREGROUND)) ||
          (await navigator.serviceWorker.ready);

        await registration.showNotification(title, {
          body,
          icon,
          badge: "/icon-192.png",
          tag,
          renotify: true,
          dir: "rtl",
          data: {
            url: window.location.origin,
            ...(payload?.data || {}),
          },
        });
      } catch (err) {
        console.error("Foreground push notification failed:", err);
      }
    });

    return unsubscribe;
  }, [authUser, pushStatus?.state]);

  async function handleEnablePushNotifications() {
    if (!authUser || !currentMemberId) {
      setPushStatus({
        state: "error",
        message: "اربط الحساب بعضو قبل تفعيل إشعارات الجوال.",
      });
      return;
    }

    setPushBusy(true);
    setPushStatus((current) => ({
      ...(current || getInitialPushStatus()),
      message: "جاري طلب إذن إشعارات الجوال...",
    }));

    try {
      const result = await enableFifaPushNotifications({
        authUser,
        memberId: currentMemberId,
        memberName: currentMember?.name || authProfile?.memberName || "",
        username: authProfile?.username || "",
      });
      setPushStatus(result);
    } catch (err) {
      console.error("Enable push notifications failed:", err);
      setPushStatus({
        state: "error",
        message: err?.message || "تعذر تفعيل إشعارات الجوال حاليًا.",
      });
    } finally {
      setPushBusy(false);
    }
  }


  async function handleDisablePushNotifications() {
    const token = cleanId(pushStatus?.token || "");
    if (!token) {
      setPushStatus({
        state: "error",
        message: "لا يوجد رمز إشعارات محفوظ لهذا الجهاز. يمكنك إيقاف الإشعارات من إعدادات الجهاز.",
      });
      return;
    }

    setPushBusy(true);
    try {
      await setDoc(
        doc(db, "pushTokens", pushTokenDocId(token)),
        {
          token,
          active: false,
          disabledAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          disabledByMemberId: currentMemberId || "",
          disabledByUid: authUser?.uid || "",
        },
        { merge: true }
      );
      setPushStatus({
        state: "ready",
        message: "تم إيقاف إشعارات الجوال لهذا الجهاز. يمكنك إعادة تفعيلها لاحقًا.",
      });
    } catch (err) {
      console.error("Disable push notifications failed:", err);
      setPushStatus({
        state: "error",
        message: err?.message || "تعذر إيقاف إشعارات هذا الجهاز حاليًا.",
        token,
      });
    } finally {
      setPushBusy(false);
    }
  }

  async function recordFifaAdminDecision(payload = {}) {
    if (!isFifaAdmin) throw new Error("هذه الصلاحية مخصصة لحساب FIFA فقط.");
    return addDoc(collection(db, "adminDecisions"), {
      status: payload.status || "active",
      source: payload.source || "fifa_admin_panel",
      createdBy: authUser?.uid || "",
      createdByMemberId: currentMemberId || "FIFA",
      createdByName: authProfile?.memberName || authProfile?.username || "FIFA",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      clickUrl: payload.clickUrl || "/",
      ...payload,
    });
  }

  async function createAdminNotificationDoc(payload = {}) {
    return addDoc(collection(db, "notifications"), {
      status: "unread",
      fromMemberId: "FIFA",
      fromMemberName: "FIFA",
      source: payload.source || "fifa_admin_panel",
      createdBy: authUser?.uid || "",
      createdByMemberId: currentMemberId || "FIFA",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      ...payload,
    });
  }

  async function createFifaAdminDecisionLog(payload = {}) {
    if (!isFifaAdmin) throw new Error("هذه الصلاحية مخصصة لحساب FIFA فقط.");
    const type = clean(payload.type || payload.actionType || "admin_decision") || "admin_decision";
    const title = payload.title || adminDecisionTypeLabel(type);
    return addDoc(collection(db, "adminDecisions"), {
      type,
      title,
      status: payload.status || "completed",
      reason: String(payload.reason || payload.note || "").trim(),
      amount: Math.max(0, toNumber(payload.amount || 0)),
      fromMemberId: cleanId(payload.fromMemberId || ""),
      fromMemberName: payload.fromMemberName || "",
      toMemberId: cleanId(payload.toMemberId || ""),
      toMemberName: payload.toMemberName || "",
      memberId: cleanId(payload.memberId || payload.toMemberId || payload.fromMemberId || ""),
      memberName: payload.memberName || payload.toMemberName || payload.fromMemberName || "",
      beneficiaryMemberId: cleanId(payload.beneficiaryMemberId || ""),
      beneficiaryMemberName: payload.beneficiaryMemberName || "",
      relatedMoneyTransferId: payload.relatedMoneyTransferId || "",
      relatedCorrectionTransferId: payload.relatedCorrectionTransferId || "",
      relatedRestrictionId: payload.relatedRestrictionId || "",
      relatedNotificationId: payload.relatedNotificationId || "",
      originalAmount: payload.originalAmount || null,
      correctedAmount: payload.correctedAmount || null,
      source: "fifa_admin_panel",
      createdBy: authUser?.uid || "",
      createdByMemberId: currentMemberId || "FIFA",
      createdByName: authProfile?.memberName || authProfile?.username || "FIFA",
      date: new Date().toISOString().slice(0, 10),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  async function createFifaAdminNotification(payload = {}) {
    if (!isFifaAdmin) throw new Error("هذه الصلاحية مخصصة لحساب FIFA فقط.");
    const mode = payload.targetMode === "member" ? "member" : "all";
    const targetMemberId = cleanId(payload.targetMemberId || "");
    const type = clean(payload.type || "system_news") || "system_news";
    const title = String(payload.title || "").trim();
    const body = String(payload.body || "").trim();
    if (!title) throw new Error("اكتب عنوان الإشعار.");
    if (!body) throw new Error("اكتب نص الإشعار.");
    if (mode === "member" && !targetMemberId) throw new Error("اختر العضو المستلم.");
    const targetMember = mode === "member" ? members.find((member) => same(member.id, targetMemberId)) : null;
    const notificationRef = await createAdminNotificationDoc({
      type,
      title,
      body,
      audience: mode === "all" ? "all" : "member",
      toMemberId: mode === "member" ? targetMemberId : "",
      toMemberName: targetMember?.name || "",
      source: "fifa_admin_panel",
      createdByName: authProfile?.memberName || authProfile?.username || "FIFA",
    });
    await recordFifaAdminDecision({
      type: "admin_notification",
      typeLabel: "إشعار إداري",
      targetMode: mode,
      targetMemberId: mode === "member" ? targetMemberId : "",
      targetMemberName: targetMember?.name || "",
      title,
      body,
      relatedNotificationId: notificationRef.id,
      reversible: false,
      source: "fifa_admin_notifications",
    });
  }

  async function createFifaAdminReward(payload = {}) {
    if (!isFifaAdmin) throw new Error("هذه الصلاحية مخصصة لحساب FIFA فقط.");
    const toMemberId = cleanId(payload.toMemberId || "");
    const amount = parseFinanceAmount(payload.amount);
    const rewardType = clean(payload.rewardType || "admin_reward") || "admin_reward";
    const note = String(payload.note || "").trim();
    if (!toMemberId) throw new Error("اختر العضو المستفيد.");
    if (same(toMemberId, "FIFA")) throw new Error("لا يمكن صرف مكافأة لحساب FIFA.");
    if (!amount || amount <= 0) throw new Error("أدخل مبلغًا صحيحًا أكبر من صفر.");
    const receiver = members.find((member) => same(member.id, toMemberId));
    if (!receiver) throw new Error("العضو المستفيد غير موجود.");
    const typeLabel = adminRewardTypeLabel(rewardType);
    const transferDate = new Date().toISOString().slice(0, 10);
    const transferRef = await addDoc(collection(db, "moneyTransfers"), {
      fromMemberId: "FIFA",
      fromMemberName: "FIFA",
      toMemberId,
      toMemberName: receiver.name || "",
      amount,
      type: rewardType,
      typeLabel,
      direction: "admin_reward",
      status: "approved",
      approvedBy: "FIFA",
      createdBy: authUser?.uid || "",
      username: authProfile?.username || "fifa",
      note: note || typeLabel,
      date: transferDate,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    const notificationRef = await createAdminNotificationDoc({
      type: rewardType,
      title: typeLabel,
      body: "تمت إضافة " + formatMoney(amount) + " إلى حسابك من FIFA" + (note ? " - " + note : "."),
      audience: "member",
      toMemberId,
      toMemberName: receiver.name || "",
      relatedMoneyTransferId: transferRef.id,
      amount,
      source: "fifa_admin_panel",
    });
    await recordFifaAdminDecision({
      type: rewardType,
      typeLabel,
      status: "active",
      fromMemberId: "FIFA",
      fromMemberName: "FIFA",
      toMemberId,
      toMemberName: receiver.name || "",
      amount,
      note: note || typeLabel,
      relatedMoneyTransferId: transferRef.id,
      relatedNotificationId: notificationRef.id,
      reversible: true,
      correctionMode: "money_transfer",
      source: "fifa_admin_finance",
    });
  }


  async function createFifaAdminDiscipline(payload = {}) {
    if (!isFifaAdmin) throw new Error("هذه الصلاحية مخصصة لحساب FIFA فقط.");
    const actionType = clean(payload.actionType || "financial_penalty");
    const memberId = cleanId(payload.memberId || "");
    const beneficiaryMemberId = cleanId(payload.beneficiaryMemberId || "");
    const amount = parseFinanceAmount(payload.amount);
    const reason = String(payload.reason || "").trim();
    const startDate = String(payload.startDate || new Date().toISOString().slice(0, 10)).slice(0, 10);
    const endDate = String(payload.endDate || "").slice(0, 10);
    const member = members.find((item) => same(item.id, memberId));
    if (!memberId || !member) throw new Error("اختر العضو صاحب العقوبة.");
    if (same(memberId, "FIFA")) throw new Error("لا يمكن تطبيق عقوبة على حساب FIFA.");
    if (!reason) throw new Error("اكتب سبب القرار الإداري.");

    if (["financial_penalty", "financial_deduction"].includes(actionType)) {
      if (!amount || amount <= 0) throw new Error("أدخل مبلغ الخصم أو الغرامة.");
      const typeLabel = actionType === "financial_deduction" ? "خصم إداري" : "غرامة مالية";
      const transferRef = await addDoc(collection(db, "moneyTransfers"), {
        fromMemberId: memberId,
        fromMemberName: member.name || "",
        toMemberId: "FIFA",
        toMemberName: "FIFA",
        amount,
        type: actionType === "financial_deduction" ? "admin_deduction" : "admin_penalty",
        typeLabel,
        direction: "admin_penalty",
        status: "approved",
        approvedBy: "FIFA",
        createdBy: authUser?.uid || "",
        username: authProfile?.username || "fifa",
        note: reason,
        date: new Date().toISOString().slice(0, 10),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await addDoc(collection(db, "notifications"), {
        type: actionType === "financial_deduction" ? "admin_deduction" : "admin_penalty",
        title: typeLabel,
        body: "تم تطبيق " + typeLabel + " بقيمة " + formatMoney(amount) + " بسبب: " + reason,
        status: "unread",
        audience: "member",
        toMemberId: memberId,
        toMemberName: member.name || "",
        fromMemberId: "FIFA",
        fromMemberName: "FIFA",
        relatedMoneyTransferId: transferRef.id,
        amount,
        source: "fifa_admin_penalties",
        createdBy: authUser?.uid || "",
        createdByMemberId: currentMemberId || "FIFA",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await recordFifaAdminDecision({
        type: actionType === "financial_deduction" ? "admin_deduction" : "admin_penalty",
        typeLabel,
        status: "active",
        fromMemberId: memberId,
        fromMemberName: member.name || "",
        toMemberId: "FIFA",
        toMemberName: "FIFA",
        amount,
        note: reason,
        reason,
        category: clean(payload.category || "financial_violation") || "financial_violation",
        relatedMoneyTransferId: transferRef.id,
        reversible: true,
        correctionMode: "money_transfer",
        source: "fifa_admin_penalties",
      });
      return;
    }

    if (actionType === "member_compensation") {
      if (!beneficiaryMemberId) throw new Error("اختر العضو المستفيد من التعويض.");
      if (same(memberId, beneficiaryMemberId)) throw new Error("لا يمكن أن يكون المتضرر والمستفيد نفس العضو.");
      if (!amount || amount <= 0) throw new Error("أدخل مبلغ التعويض.");
      const beneficiary = members.find((item) => same(item.id, beneficiaryMemberId));
      if (!beneficiary) throw new Error("العضو المستفيد غير موجود.");
      const transferRef = await addDoc(collection(db, "moneyTransfers"), {
        fromMemberId: memberId,
        fromMemberName: member.name || "",
        toMemberId: beneficiaryMemberId,
        toMemberName: beneficiary.name || "",
        amount,
        type: "admin_member_compensation",
        typeLabel: "تعويض مالي لعضو",
        direction: "admin_compensation_transfer",
        status: "approved",
        approvedBy: "FIFA",
        createdBy: authUser?.uid || "",
        username: authProfile?.username || "fifa",
        note: reason,
        date: new Date().toISOString().slice(0, 10),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await addDoc(collection(db, "notifications"), {
        type: "admin_compensation_out",
        title: "تعويض مالي صادر",
        body: "تم خصم " + formatMoney(amount) + " من رصيدك كتعويض إداري بسبب: " + reason,
        status: "unread",
        audience: "member",
        toMemberId: memberId,
        toMemberName: member.name || "",
        fromMemberId: "FIFA",
        fromMemberName: "FIFA",
        relatedMoneyTransferId: transferRef.id,
        amount,
        source: "fifa_admin_penalties",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await addDoc(collection(db, "notifications"), {
        type: "admin_compensation_in",
        title: "تعويض مالي وارد",
        body: "تمت إضافة تعويض مالي إلى حسابك بقيمة " + formatMoney(amount) + " بسبب: " + reason,
        status: "unread",
        audience: "member",
        toMemberId: beneficiaryMemberId,
        toMemberName: beneficiary.name || "",
        fromMemberId: "FIFA",
        fromMemberName: "FIFA",
        relatedMoneyTransferId: transferRef.id,
        amount,
        source: "fifa_admin_penalties",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await recordFifaAdminDecision({
        type: "admin_member_compensation",
        typeLabel: "تعويض مالي بين عضوين",
        status: "active",
        fromMemberId: memberId,
        fromMemberName: member.name || "",
        toMemberId: beneficiaryMemberId,
        toMemberName: beneficiary.name || "",
        amount,
        note: reason,
        reason,
        category: clean(payload.category || "financial_compensation") || "financial_compensation",
        relatedMoneyTransferId: transferRef.id,
        reversible: true,
        correctionMode: "money_transfer",
        source: "fifa_admin_penalties",
      });
      return;
    }

    if (actionType === "transfer_restriction") {
      if (!endDate) throw new Error("حدد تاريخ نهاية الإيقاف.");
      const restrictionPayload = buildAdminTransferRestrictionPayload(payload);
      const restrictionRef = await addDoc(collection(db, "memberRestrictions"), {
        memberId,
        memberName: member.name || "",
        type: "transfer_restriction",
        status: "active",
        reason,
        startDate,
        endDate,
        ...restrictionPayload,
        createdBy: authUser?.uid || "",
        createdByMemberId: currentMemberId || "FIFA",
        createdByName: authProfile?.memberName || authProfile?.username || "FIFA",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await addDoc(collection(db, "notifications"), {
        type: "transfer_restriction",
        title: "قرار إيقاف من نظام الانتقالات",
        body: formatRestrictionNotificationBody({ reason, startDate, endDate, restriction: restrictionPayload }),
        status: "unread",
        audience: "member",
        toMemberId: memberId,
        toMemberName: member.name || "",
        fromMemberId: "FIFA",
        fromMemberName: "FIFA",
        relatedRestrictionId: restrictionRef.id,
        source: "fifa_admin_penalties",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await recordFifaAdminDecision({
        type: "transfer_restriction",
        typeLabel: "إيقاف من نظام الانتقالات",
        status: "active",
        memberId,
        memberName: member.name || "",
        targetMemberId: memberId,
        targetMemberName: member.name || "",
        reason,
        category: clean(payload.category || "transfer_violation") || "transfer_violation",
        startDate,
        endDate,
        ...restrictionPayload,
        relatedRestrictionId: restrictionRef.id,
        reversible: true,
        correctionMode: "restriction",
        source: "fifa_admin_penalties",
      });
      return;
    }

    if (actionType === "lift_transfer_restriction") {
      const activeRows = getActiveMemberRestrictions(firebaseMemberRestrictions, memberId);
      if (!activeRows.length) throw new Error("لا يوجد إيقاف انتقالات نشط على هذا العضو.");
      await Promise.allSettled(activeRows.map((row) => updateDoc(doc(db, "memberRestrictions", row.id), {
        status: "lifted",
        liftedAt: serverTimestamp(),
        liftedBy: authUser?.uid || "",
        liftedByMemberId: currentMemberId || "FIFA",
        liftReason: reason,
        updatedAt: serverTimestamp(),
      })));
      await addDoc(collection(db, "notifications"), {
        type: "transfer_restriction_lifted",
        title: "تم رفع إيقاف الانتقالات",
        body: "تم رفع إيقافك من نظام الانتقالات" + (reason ? " - " + reason : "."),
        status: "unread",
        audience: "member",
        toMemberId: memberId,
        toMemberName: member.name || "",
        fromMemberId: "FIFA",
        fromMemberName: "FIFA",
        source: "fifa_admin_penalties",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await recordFifaAdminDecision({
        type: "transfer_restriction_lifted",
        typeLabel: "رفع إيقاف انتقالات",
        status: "completed",
        memberId,
        memberName: member.name || "",
        targetMemberId: memberId,
        targetMemberName: member.name || "",
        reason,
        relatedRestrictionIds: activeRows.map((row) => row.id),
        reversible: false,
        source: "fifa_admin_penalties",
      });
      return;
    }

    throw new Error("نوع القرار غير معروف.");
  }

  async function createFifaAdminMoneyCorrection(payload = {}) {
    if (!isFifaAdmin) throw new Error("هذه الصلاحية مخصصة لحساب FIFA فقط.");
    const transferId = cleanId(payload.transferId || "");
    const mode = clean(payload.mode || "full_reverse") === "amount_correction" ? "amount_correction" : "full_reverse";
    const reason = String(payload.reason || "").trim();
    if (!transferId) throw new Error("اختر العملية المالية المراد تصحيحها.");
    if (!reason) throw new Error("اكتب سبب التصحيح أو التراجع.");

    const original = firebaseMoneyTransfers.find((item) => same(item.id, transferId));
    if (!original) throw new Error("العملية المالية غير موجودة أو ليست من Firebase.");
    if (clean(original.adminCorrectionStatus || original.reversalStatus || "") === "reversed") {
      throw new Error("تم عكس هذه العملية سابقًا.");
    }

    const originalAmount = Math.max(0, toNumber(original.amount));
    if (!originalAmount) throw new Error("لا يمكن تصحيح عملية بدون مبلغ صالح.");

    const fromId = cleanId(original.fromMemberId || "");
    const toId = cleanId(original.toMemberId || "");
    const fromName = original.fromMemberName || getMemberName(members, fromId) || fromId || "-";
    const toName = original.toMemberName || getMemberName(members, toId) || toId || "-";
    if (!fromId || !toId) throw new Error("العملية الأصلية لا تحتوي أطرافًا واضحة.");

    let correctionAmount = originalAmount;
    let reverseFromId = toId;
    let reverseFromName = toName;
    let reverseToId = fromId;
    let reverseToName = fromName;
    let correctionTitle = "عكس عملية مالية";
    let correctionType = "admin_money_reversal";
    let correctAmount = null;

    if (mode === "amount_correction") {
      correctAmount = parseFinanceAmount(payload.correctAmount);
      if (correctAmount < 0) throw new Error("أدخل المبلغ الصحيح.");
      const diff = originalAmount - correctAmount;
      if (!diff) throw new Error("المبلغ الصحيح يساوي المبلغ الأصلي، لا يوجد فرق للتصحيح.");
      correctionAmount = Math.abs(diff);
      correctionTitle = "تصحيح مبلغ عملية مالية";
      correctionType = "admin_money_amount_correction";
      if (diff < 0) {
        reverseFromId = fromId;
        reverseFromName = fromName;
        reverseToId = toId;
        reverseToName = toName;
      }
    }

    const correctionRef = await addDoc(collection(db, "moneyTransfers"), {
      fromMemberId: reverseFromId,
      fromMemberName: reverseFromName,
      toMemberId: reverseToId,
      toMemberName: reverseToName,
      amount: correctionAmount,
      type: correctionType,
      typeLabel: correctionTitle,
      direction: "admin_money_correction",
      status: "approved",
      approvedBy: "FIFA",
      relatedOriginalMoneyTransferId: transferId,
      originalAmount,
      correctAmount: mode === "amount_correction" ? correctAmount : 0,
      correctionMode: mode,
      createdBy: authUser?.uid || "",
      username: authProfile?.username || "fifa",
      note: reason,
      date: new Date().toISOString().slice(0, 10),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await updateDoc(doc(db, "moneyTransfers", transferId), {
      adminCorrectionStatus: mode === "full_reverse" ? "reversed" : "corrected",
      adminCorrectedAt: serverTimestamp(),
      adminCorrectedBy: authUser?.uid || "",
      adminCorrectionReason: reason,
      adminCorrectionTransferId: correctionRef.id,
      adminCorrectAmount: mode === "amount_correction" ? correctAmount : 0,
      updatedAt: serverTimestamp(),
    });

    const relatedDecision = firebaseAdminDecisions.find((item) => same(item.relatedMoneyTransferId, transferId));
    if (relatedDecision?.id) {
      await updateDoc(doc(db, "adminDecisions", relatedDecision.id), {
        status: mode === "full_reverse" ? "reversed" : "corrected",
        reversedAt: mode === "full_reverse" ? serverTimestamp() : null,
        correctedAt: mode === "amount_correction" ? serverTimestamp() : null,
        correctionReason: reason,
        correctionTransferId: correctionRef.id,
        updatedAt: serverTimestamp(),
      });
    }

    const body = mode === "full_reverse"
      ? "تم عكس عملية مالية بقيمة " + formatMoney(correctionAmount) + " بقرار FIFA. السبب: " + reason
      : "تم تصحيح عملية مالية. الفرق المصحح: " + formatMoney(correctionAmount) + ". السبب: " + reason;

    const notifyTargets = [
      { id: reverseFromId, name: reverseFromName, title: correctionTitle + " - صادر" },
      { id: reverseToId, name: reverseToName, title: correctionTitle + " - وارد" },
    ].filter((item) => item.id && !same(item.id, "FIFA"));

    await Promise.allSettled(notifyTargets.map((target) => createAdminNotificationDoc({
      type: correctionType,
      title: target.title,
      body,
      audience: "member",
      toMemberId: target.id,
      toMemberName: target.name,
      relatedMoneyTransferId: correctionRef.id,
      amount: correctionAmount,
      source: "fifa_admin_corrections",
    })));

    await recordFifaAdminDecision({
      type: correctionType,
      typeLabel: correctionTitle,
      status: "completed",
      fromMemberId: reverseFromId,
      fromMemberName: reverseFromName,
      toMemberId: reverseToId,
      toMemberName: reverseToName,
      amount: correctionAmount,
      originalAmount,
      correctAmount: mode === "amount_correction" ? correctAmount : 0,
      reason,
      relatedMoneyTransferId: correctionRef.id,
      relatedOriginalMoneyTransferId: transferId,
      source: "fifa_admin_corrections",
      reversible: false,
    });
  }

  async function cancelFifaAdminRestriction(payload = {}) {
    if (!isFifaAdmin) throw new Error("هذه الصلاحية مخصصة لحساب FIFA فقط.");
    const restrictionId = cleanId(payload.restrictionId || "");
    const reason = String(payload.reason || "").trim();
    if (!restrictionId) throw new Error("اختر إيقاف الانتقالات المراد رفعه أو إلغاؤه.");
    if (!reason) throw new Error("اكتب سبب رفع أو إلغاء الإيقاف.");
    const restriction = firebaseMemberRestrictions.find((item) => same(item.id, restrictionId));
    if (!restriction) throw new Error("قرار الإيقاف غير موجود.");
    const memberId = cleanId(restriction.memberId || "");
    const memberName = restriction.memberName || getMemberName(members, memberId) || "";
    await updateDoc(doc(db, "memberRestrictions", restrictionId), {
      status: "cancelled",
      cancelledAt: serverTimestamp(),
      cancelledBy: authUser?.uid || "",
      cancelledByMemberId: currentMemberId || "FIFA",
      cancelReason: reason,
      updatedAt: serverTimestamp(),
    });
    const relatedDecision = firebaseAdminDecisions.find((item) => same(item.relatedRestrictionId, restrictionId));
    if (relatedDecision?.id) {
      await updateDoc(doc(db, "adminDecisions", relatedDecision.id), {
        status: "cancelled",
        cancelledAt: serverTimestamp(),
        cancelReason: reason,
        updatedAt: serverTimestamp(),
      });
    }
    await createAdminNotificationDoc({
      type: "transfer_restriction_cancelled",
      title: "تم إلغاء إيقاف الانتقالات",
      body: "تم إلغاء إيقافك من نظام الانتقالات بقرار FIFA. السبب: " + reason,
      audience: "member",
      toMemberId: memberId,
      toMemberName: memberName,
      relatedRestrictionId: restrictionId,
      source: "fifa_admin_corrections",
    });
    await recordFifaAdminDecision({
      type: "transfer_restriction_cancelled",
      typeLabel: "إلغاء إيقاف انتقالات",
      status: "completed",
      memberId,
      memberName,
      targetMemberId: memberId,
      targetMemberName: memberName,
      relatedRestrictionId: restrictionId,
      reason,
      source: "fifa_admin_corrections",
      reversible: false,
    });
  }

  async function createFifaAdminNote(payload = {}) {
    if (!isFifaAdmin) throw new Error("هذه الصلاحية مخصصة لحساب FIFA فقط.");
    const memberId = cleanId(payload.memberId || "");
    const note = String(payload.note || "").trim();
    const category = clean(payload.category || "general_note") || "general_note";
    if (!memberId) throw new Error("اختر العضو.");
    if (!note) throw new Error("اكتب الملاحظة الإدارية.");
    const member = members.find((item) => same(item.id, memberId));
    if (!member || same(memberId, "FIFA")) throw new Error("اختر عضوًا صحيحًا.");
    const noteRef = await addDoc(collection(db, "adminNotes"), {
      memberId,
      memberName: member.name || "",
      category,
      note,
      status: "active",
      private: true,
      createdBy: authUser?.uid || "",
      createdByMemberId: currentMemberId || "FIFA",
      createdByName: authProfile?.memberName || authProfile?.username || "FIFA",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await recordFifaAdminDecision({
      type: "admin_note",
      typeLabel: "ملاحظة إدارية",
      status: "completed",
      memberId,
      memberName: member.name || "",
      category,
      note,
      relatedAdminNoteId: noteRef.id,
      source: "fifa_admin_notes",
      reversible: false,
    });
  }

  async function sendRosterUpdateNotification({ toMemberId, fromMemberId = "system", playerId = "", title = "تحديث على قائمة فريقك", body = "", targetStatus = "roster_updated", relatedOfferId = "", relatedQueueId = "" } = {}) {
    const targetMemberId = cleanId(toMemberId);
    if (!targetMemberId || !body) return;
    await addDoc(collection(db, "notifications"), {
      type: "roster_update",
      status: "unread",
      toMemberId: targetMemberId,
      fromMemberId: cleanId(fromMemberId) || "system",
      relatedOfferId: relatedOfferId || "",
      relatedQueueId: relatedQueueId || "",
      targetPlayerId: playerId || "",
      targetMemberId,
      targetStatus,
      navigationDisabled: true,
      title,
      body,
      createdAt: serverTimestamp(),
    });
  }

  async function processPendingPlayerOfferOnMarketOpen(existing, windowInfo = {}) {
    if (!existing?.id) return { ok: false, reason: "missing_offer" };
    if (clean(existing.status || "") !== "approvedpendingwindow") return { ok: false, reason: "not_pending_window" };
    if (existing.marketExecutionCompletedAt || existing.completedAt) return { ok: false, reason: "already_completed" };

    const offerId = existing.id;
    const buyerId = cleanId(existing.fromMemberId);
    const sellerId = cleanId(existing.toMemberId);
    const numericAmount = Math.max(0, toNumber(existing.amount));
    const contractType = clean(existing.type) === "loan" ? "loan" : "buy";
    const targetPlayerId = cleanId(existing.targetPlayerId || existing.playerId);
    const targetPlayerRow = players.find((player) => same(getPlayerStableId(player), targetPlayerId));
    if (!buyerId || !sellerId || !targetPlayerId) return { ok: false, reason: "missing_data" };

    const previousActiveContract = getActivePlayerContract(targetPlayerId);
    const previousActiveContractType = clean(previousActiveContract?.contractType || "");
    if (previousActiveContractType === "released") {
      await updateDoc(doc(db, "playerOffers", offerId), {
        status: "executionFailed",
        pendingExecutionStatus: "failed",
        pendingExecutionFailureReason: "اللاعب خارج اللعبة.",
        updatedAt: serverTimestamp(),
      });
      return { ok: false, reason: "released_target" };
    }

    const baseOwnerId = cleanId(
      previousActiveContract?.baseOwnerMemberId ||
        previousActiveContract?.baseOwnerId ||
        previousActiveContract?.originalBaseOwnerMemberId ||
        previousActiveContract?.originalOwnerMemberId ||
        targetPlayerRow?.memberid ||
        sellerId
    );
    const baseOwner = members.find((member) => same(member.id, baseOwnerId));
    const baseOwnerName = previousActiveContract?.baseOwnerMemberName || previousActiveContract?.originalBaseOwnerMemberName || baseOwner?.name || previousActiveContract?.originalOwnerMemberName || existing.toMemberName || "";
    const sourceOwnerId = cleanId(previousActiveContract?.currentMemberId || sellerId);
    const sourceOwnerName = previousActiveContract?.currentMemberName || existing.toMemberName || getMemberName(members, sellerId) || "";
    const loanRealOwnerId = previousActiveContractType === "loan"
      ? cleanId(previousActiveContract?.originalOwnerMemberId || previousActiveContract?.ownerMemberId || baseOwnerId || sellerId)
      : sourceOwnerId;
    const loanRealOwnerName = previousActiveContractType === "loan"
      ? (previousActiveContract?.originalOwnerMemberName || previousActiveContract?.ownerMemberName || baseOwnerName || sourceOwnerName)
      : sourceOwnerName;
    if (sourceOwnerId && !same(sourceOwnerId, sellerId)) {
      await updateDoc(doc(db, "playerOffers", offerId), {
        status: "executionFailed",
        pendingExecutionStatus: "failed",
        pendingExecutionFailureReason: "ملكية اللاعب تغيرت قبل فتح السوق.",
        updatedAt: serverTimestamp(),
      });
      return { ok: false, reason: "ownership_changed" };
    }

    const offeredPlayersRaw = Array.isArray(existing.offeredPlayers) ? existing.offeredPlayers : [];
    const buyerVisiblePlayers = getVisiblePlayersForMember(buyerId);
    const buyerVisibleMap = new Map(buyerVisiblePlayers.map((player) => [cleanId(getPlayerStableId(player)), player]));
    const offeredPlayerIds = new Set();
    const offeredPlayers = [];

    for (const item of offeredPlayersRaw) {
      const playerId = cleanId(item.playerId || item.playerid || item.id);
      if (!playerId || same(playerId, targetPlayerId) || offeredPlayerIds.has(playerId)) {
        await updateDoc(doc(db, "playerOffers", offerId), {
          status: "executionFailed",
          pendingExecutionStatus: "failed",
          pendingExecutionFailureReason: "بيانات أحد لاعبي التبادل غير صحيحة.",
          updatedAt: serverTimestamp(),
        });
        return { ok: false, reason: "bad_exchange_player" };
      }
      offeredPlayerIds.add(playerId);
      const row = buyerVisibleMap.get(playerId) || players.find((player) => same(getPlayerStableId(player), playerId));
      if (!row || !buyerVisibleMap.has(playerId)) {
        await updateDoc(doc(db, "playerOffers", offerId), {
          status: "executionFailed",
          pendingExecutionStatus: "failed",
          pendingExecutionFailureReason: "أحد لاعبي التبادل لم يعد في قائمة مقدم العرض عند فتح السوق.",
          updatedAt: serverTimestamp(),
        });
        return { ok: false, reason: "exchange_player_unavailable" };
      }
      const activeContract = getActivePlayerContract(playerId);
      const activeType = clean(activeContract?.contractType || "");
      if (activeType === "released" || activeType === "loan" || (activeContract && !same(activeContract.currentMemberId, buyerId))) {
        await updateDoc(doc(db, "playerOffers", offerId), {
          status: "executionFailed",
          pendingExecutionStatus: "failed",
          pendingExecutionFailureReason: "تعذر تنفيذ أحد لاعبي التبادل بسبب تغير حالته.",
          updatedAt: serverTimestamp(),
        });
        return { ok: false, reason: "exchange_contract_changed" };
      }
      const exchangeContractType = normalizeExchangeContractType(item.exchangeContractType || item.swapContractType || item.contractMode);
      const exchangeLoanDurationMonths = exchangeContractType === "loan" ? normalizeExchangeLoanDuration(item.exchangeLoanDurationMonths || item.loanDurationMonths) : null;
      offeredPlayers.push({
        ...item,
        row,
        activeContract,
        playerId,
        exchangeContractType,
        exchangeLoanDurationMonths,
        exchangeTypeLabel: exchangeContractType === "loan" ? "إعارة" : "بيع كامل",
        playerName: item.playerName || row.name || "",
        playerImage: item.playerImage || item.image || row.image || "",
        playerPosition: item.playerPosition || item.position || row.position || "",
        playerRating: item.playerRating || item.rating || row.rating || "",
      });
    }

    const nowDate = new Date();
    const todayDateKey = nowDate.toISOString().slice(0, 10);
    const loanMonths = contractType === "loan" ? toNumber(existing.loanDurationMonths) : null;
    const loanEndDate = loanMonths
      ? new Date(nowDate.getFullYear(), nowDate.getMonth() + loanMonths, nowDate.getDate()).toISOString().slice(0, 10)
      : null;

    const targetFreeOrigin = isFreeOriginContract(previousActiveContract);
    const targetFreeSlotOwnerId = getFreeAgentSlotOwnerIdFromContract(previousActiveContract, targetFreeOrigin ? baseOwnerId || sellerId : "");

    if (previousActiveContract?.id) {
      await updateDoc(doc(db, "playerContracts", previousActiveContract.id), {
        status: "replaced",
        replacedByOfferId: offerId,
        replacedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    if (targetFreeOrigin && targetFreeSlotOwnerId && same(targetFreeSlotOwnerId, sellerId) && !same(targetFreeSlotOwnerId, buyerId)) {
      await setDoc(doc(db, "freePlayerStatus", sellerId), {
        memberId: toNumber(sellerId),
        hasUsedFreeSlot: true,
        currentFreePlayerId: "",
        currentFreePlayerName: "",
        lostFreePlayerId: targetPlayerId,
        lostFreePlayerName: existing.targetPlayerName || targetPlayerRow?.name || "",
        lostFreePlayerAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
    }

    await addDoc(collection(db, "playerContracts"), {
      status: "active",
      playerId: targetPlayerId,
      playerName: existing.targetPlayerName || targetPlayerRow?.name || "",
      playerImage: existing.targetPlayerImage || targetPlayerRow?.image || "",
      playerPosition: existing.targetPlayerPosition || targetPlayerRow?.position || "",
      playerRating: existing.targetPlayerRating || targetPlayerRow?.rating || "",
      ownerMemberId: contractType === "loan" ? loanRealOwnerId : buyerId,
      ownerMemberName: contractType === "loan" ? loanRealOwnerName : (existing.fromMemberName || getMemberName(members, buyerId)),
      originalOwnerMemberId: contractType === "loan" ? loanRealOwnerId : baseOwnerId,
      originalOwnerMemberName: contractType === "loan" ? loanRealOwnerName : baseOwnerName,
      baseOwnerMemberId: baseOwnerId,
      baseOwnerMemberName: baseOwnerName,
      currentMemberId: buyerId,
      currentMemberName: existing.fromMemberName || getMemberName(members, buyerId),
      previousMemberId: sourceOwnerId,
      previousMemberName: sourceOwnerName,
      contractType: contractType === "loan" ? "loan" : "owned",
      rosterType: getRosterKindCode({ contractType: contractType === "loan" ? "loan" : "owned", originalOwnerMemberId: baseOwnerId, currentMemberId: buyerId, freeAgent: targetFreeOrigin && same(targetFreeSlotOwnerId, buyerId) }),
      isFreeOrigin: targetFreeOrigin,
      freeAgentOrigin: targetFreeOrigin,
      freeAgentSlotOwnerMemberId: targetFreeSlotOwnerId || "",
      sourceOfferId: offerId,
      amount: numericAmount,
      loanAmount: contractType === "loan" ? numericAmount : 0,
      loanDurationMonths: loanMonths,
      loanStartDate: todayDateKey,
      loanEndDate,
      pendingWindow: false,
      marketWasOpenAtApproval: false,
      marketExecutedAtWindowOpen: true,
      marketExecutionWindowId: windowInfo.windowId || "",
      marketExecutionWindowName: windowInfo.windowTitle || "",
      createdBy: authUser?.uid || "system",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    if (targetFreeOrigin && targetFreeSlotOwnerId && same(targetFreeSlotOwnerId, buyerId)) {
      await setDoc(doc(db, "freePlayerStatus", buyerId), {
        memberId: toNumber(buyerId),
        hasUsedFreeSlot: false,
        currentFreePlayerId: targetPlayerId,
        currentFreePlayerName: existing.targetPlayerName || targetPlayerRow?.name || "",
        returnedFreePlayerAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
    }

    const enrichedOfferedPlayers = [];
    for (const item of offeredPlayers) {
      const swapBaseOwnerId = cleanId(item.activeContract?.baseOwnerMemberId || item.activeContract?.baseOwnerId || item.activeContract?.originalBaseOwnerMemberId || item.activeContract?.originalOwnerMemberId || item.row?.memberid || buyerId);
      const swapBaseOwner = members.find((member) => same(member.id, swapBaseOwnerId));
      const swapBaseOwnerName = item.activeContract?.baseOwnerMemberName || item.activeContract?.originalBaseOwnerMemberName || item.activeContract?.originalOwnerMemberName || swapBaseOwner?.name || getMemberName(members, swapBaseOwnerId) || existing.fromMemberName || "";
      const swapSourceOwnerId = cleanId(item.activeContract?.currentMemberId || buyerId);
      const swapSourceOwnerName = item.activeContract?.currentMemberName || existing.fromMemberName || getMemberName(members, buyerId) || "";
      const swapFreeOrigin = isFreeOriginContract(item.activeContract);
      const swapFreeSlotOwnerId = getFreeAgentSlotOwnerIdFromContract(item.activeContract, swapFreeOrigin ? swapBaseOwnerId || buyerId : "");
      const exchangeContractType = normalizeExchangeContractType(item.exchangeContractType);
      const exchangeLoanMonths = exchangeContractType === "loan" ? normalizeExchangeLoanDuration(item.exchangeLoanDurationMonths) : null;
      const exchangeLoanEndDate = exchangeLoanMonths
        ? new Date(nowDate.getFullYear(), nowDate.getMonth() + exchangeLoanMonths, nowDate.getDate()).toISOString().slice(0, 10)
        : null;
      const exchangeOwnerId = exchangeContractType === "loan" ? swapSourceOwnerId : sellerId;
      const exchangeOwnerName = exchangeContractType === "loan" ? swapSourceOwnerName : (existing.toMemberName || getMemberName(members, sellerId));
      const exchangeOriginalOwnerId = exchangeContractType === "loan" ? swapSourceOwnerId : swapBaseOwnerId;
      const exchangeOriginalOwnerName = exchangeContractType === "loan" ? swapSourceOwnerName : swapBaseOwnerName;

      if (item.activeContract?.id) {
        await updateDoc(doc(db, "playerContracts", item.activeContract.id), {
          status: "replaced_exchange",
          replacedByOfferId: offerId,
          replacedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      if (swapFreeOrigin && swapFreeSlotOwnerId && same(swapFreeSlotOwnerId, buyerId) && !same(swapFreeSlotOwnerId, sellerId)) {
        await setDoc(doc(db, "freePlayerStatus", buyerId), {
          memberId: toNumber(buyerId),
          hasUsedFreeSlot: true,
          currentFreePlayerId: "",
          currentFreePlayerName: "",
          lostFreePlayerId: item.playerId,
          lostFreePlayerName: item.playerName || "",
          lostFreePlayerAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }, { merge: true });
      }

      await addDoc(collection(db, "playerContracts"), {
        status: "active",
        contractType: exchangeContractType === "loan" ? "loan" : "owned",
        playerId: item.playerId,
        playerName: item.playerName || "",
        playerImage: item.playerImage || "",
        playerPosition: item.playerPosition || "",
        playerRating: item.playerRating || "",
        ownerMemberId: exchangeOwnerId,
        ownerMemberName: exchangeOwnerName,
        originalOwnerMemberId: exchangeOriginalOwnerId,
        originalOwnerMemberName: exchangeOriginalOwnerName,
        baseOwnerMemberId: swapBaseOwnerId,
        baseOwnerMemberName: swapBaseOwnerName,
        currentMemberId: sellerId,
        currentMemberName: existing.toMemberName || getMemberName(members, sellerId),
        previousMemberId: swapSourceOwnerId,
        previousMemberName: swapSourceOwnerName,
        contractTypeLabel: exchangeContractType === "loan" ? ("تبادل - إعارة " + loanDurationLabel(exchangeLoanMonths)) : "تبادل - بيع كامل",
        rosterType: getRosterKindCode({ contractType: exchangeContractType === "loan" ? "loan" : "owned", originalOwnerMemberId: exchangeOriginalOwnerId, currentMemberId: sellerId, freeAgent: swapFreeOrigin && same(swapFreeSlotOwnerId, sellerId) }),
        isFreeOrigin: swapFreeOrigin,
        freeAgentOrigin: swapFreeOrigin,
        freeAgentSlotOwnerMemberId: swapFreeSlotOwnerId || "",
        sourceOfferId: offerId,
        source: "exchange_player",
        exchangeContractType,
        exchangeLoanDurationMonths: exchangeLoanMonths,
        amount: 0,
        loanAmount: 0,
        loanDurationMonths: exchangeLoanMonths,
        loanStartDate: exchangeContractType === "loan" ? todayDateKey : null,
        loanEndDate: exchangeContractType === "loan" ? exchangeLoanEndDate : null,
        marketWasOpenAtApproval: false,
        marketExecutedAtWindowOpen: true,
        marketExecutionWindowId: windowInfo.windowId || "",
        marketExecutionWindowName: windowInfo.windowTitle || "",
        createdBy: authUser?.uid || "system",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      if (swapFreeOrigin && swapFreeSlotOwnerId && same(swapFreeSlotOwnerId, sellerId)) {
        await setDoc(doc(db, "freePlayerStatus", sellerId), {
          memberId: toNumber(sellerId),
          hasUsedFreeSlot: false,
          currentFreePlayerId: item.playerId,
          currentFreePlayerName: item.playerName || "",
          returnedFreePlayerAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }, { merge: true });
      }

      enrichedOfferedPlayers.push({
        playerId: item.playerId,
        playerName: item.playerName || "",
        playerImage: item.playerImage || "",
        playerPosition: item.playerPosition || "",
        playerRating: item.playerRating || "",
        fromMemberId: buyerId,
        fromMemberName: existing.fromMemberName || getMemberName(members, buyerId),
        toMemberId: sellerId,
        toMemberName: existing.toMemberName || getMemberName(members, sellerId),
        exchangeContractType,
        exchangeLoanDurationMonths: exchangeLoanMonths,
        exchangeTypeLabel: exchangeContractType === "loan" ? "إعارة" : "بيع كامل",
        originalOwnerMemberId: swapBaseOwnerId,
        originalOwnerMemberName: swapBaseOwnerName,
        isFreeOrigin: swapFreeOrigin,
        freeAgentSlotOwnerMemberId: swapFreeSlotOwnerId || "",
      });
    }

    const historyPayload = {
      status: "completed",
      type: contractType === "loan" ? "loan" : "buy",
      typeLabel: contractType === "loan" ? "عقد إعارة" : (enrichedOfferedPlayers.length ? "عقد شراء + تبادل" : "عقد شراء"),
      playerId: targetPlayerId,
      playerName: existing.targetPlayerName || targetPlayerRow?.name || "",
      playerImage: existing.targetPlayerImage || targetPlayerRow?.image || "",
      playerPosition: existing.targetPlayerPosition || targetPlayerRow?.position || "",
      playerRating: existing.targetPlayerRating || targetPlayerRow?.rating || "",
      fromMemberId: sourceOwnerId,
      fromMemberName: sourceOwnerName,
      toMemberId: buyerId,
      toMemberName: existing.fromMemberName || getMemberName(members, buyerId),
      originalOwnerMemberId: contractType === "loan" ? loanRealOwnerId : baseOwnerId,
      originalOwnerMemberName: contractType === "loan" ? loanRealOwnerName : baseOwnerName,
      baseOwnerMemberId: baseOwnerId,
      baseOwnerMemberName: baseOwnerName,
      ownerMemberId: contractType === "loan" ? loanRealOwnerId : buyerId,
      ownerMemberName: contractType === "loan" ? loanRealOwnerName : (existing.fromMemberName || getMemberName(members, buyerId)),
      amount: numericAmount,
      loanDurationMonths: loanMonths,
      loanStartDate: contractType === "loan" ? todayDateKey : null,
      loanEndDate: contractType === "loan" ? loanEndDate : null,
      date: todayDateKey,
      periodId: windowInfo.windowId || getTransferWindowIdForDate(firebaseTransferWindows, todayDateKey),
      periodName: windowInfo.windowTitle || getTransferWindowNameForDate(firebaseTransferWindows, todayDateKey),
      seasonId: activeSeasonId,
      relatedOfferId: offerId,
      marketWasOpenAtApproval: false,
      marketExecutedAtWindowOpen: true,
      completedAt: serverTimestamp(),
      offeredPlayers: enrichedOfferedPlayers,
      exchangePlayerCount: enrichedOfferedPlayers.length,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await addDoc(collection(db, "transferHistory"), historyPayload);

    await updateDoc(doc(db, "playerOffers", offerId), {
      status: "completed",
      completedAt: serverTimestamp(),
      marketExecutionCompletedAt: serverTimestamp(),
      marketExecutionWindowId: windowInfo.windowId || "",
      marketExecutionWindowName: windowInfo.windowTitle || "",
      pendingWindow: false,
      updatedAt: serverTimestamp(),
    });

    const targetPlayerName = existing.targetPlayerName || targetPlayerRow?.name || "";
    const buyerName = existing.fromMemberName || getMemberName(members, buyerId);
    const sellerName = existing.toMemberName || getMemberName(members, sellerId);
    const incomingTargetLabel = contractType === "loan" ? "كمحترف إعارة" : (targetFreeOrigin && targetFreeSlotOwnerId && same(targetFreeSlotOwnerId, buyerId) ? "كلاعب حر" : "كمحترف شراء");
    const outgoingTargetLabel = contractType === "loan" ? ("على سبيل الإعارة " + loanDurationLabel(loanMonths)) : "انتقالًا نهائيًا";

    await Promise.allSettled([
      sendRosterUpdateNotification({
        toMemberId: buyerId,
        fromMemberId: "FIFA",
        playerId: targetPlayerId,
        relatedOfferId: offerId,
        targetStatus: "incoming_player_registered",
        body: "تحديث على قائمة فريقك: تم تسجيل اللاعب " + targetPlayerName + " " + incomingTargetLabel,
      }),
      sendRosterUpdateNotification({
        toMemberId: sellerId,
        fromMemberId: "FIFA",
        playerId: targetPlayerId,
        relatedOfferId: offerId,
        targetStatus: "outgoing_player_transferred",
        body: "تحديث على قائمة فريقك: تم نقل اللاعب " + targetPlayerName + " إلى " + buyerName + " " + outgoingTargetLabel,
      }),
      ...enrichedOfferedPlayers.flatMap((item) => {
        const exchangeLoan = clean(item.exchangeContractType) === "loan";
        const exchangeIncomingLabel = exchangeLoan ? "كمحترف إعارة" : (item.isFreeOrigin && item.freeAgentSlotOwnerMemberId && same(item.freeAgentSlotOwnerMemberId, sellerId) ? "كلاعب حر" : "كمحترف شراء");
        const exchangeOutgoingLabel = exchangeLoan ? ("على سبيل الإعارة " + loanDurationLabel(item.exchangeLoanDurationMonths)) : "انتقالًا نهائيًا";
        return [
          sendRosterUpdateNotification({
            toMemberId: sellerId,
            fromMemberId: "FIFA",
            playerId: item.playerId,
            relatedOfferId: offerId,
            targetStatus: "incoming_exchange_player_registered",
            body: "تحديث على قائمة فريقك: تم تسجيل اللاعب " + (item.playerName || "") + " " + exchangeIncomingLabel,
          }),
          sendRosterUpdateNotification({
            toMemberId: buyerId,
            fromMemberId: "FIFA",
            playerId: item.playerId,
            relatedOfferId: offerId,
            targetStatus: "outgoing_exchange_player_transferred",
            body: "تحديث على قائمة فريقك: تم نقل اللاعب " + (item.playerName || "") + " إلى " + sellerName + " " + exchangeOutgoingLabel,
          }),
        ];
      }),
    ]);

    return { ok: true, offerId, playerId: targetPlayerId };
  }

  async function processPendingMarketActionsOnOpen(windowInfo = {}) {
    const pendingOffers = (firebasePlayerOffers || []).filter((offer) => clean(offer.status || "") === "approvedpendingwindow");
    const pendingFreeAgents = (firebaseFreeAgentQueue || []).filter((item) => clean(item.status || "") === "pending_window");

    const offerResults = [];
    const proCountLedger = new Map();
    const ledgerProCount = (memberId) => {
      const id = cleanId(memberId);
      if (!id) return 0;
      if (!proCountLedger.has(id)) proCountLedger.set(id, countMemberProPlayers(id));
      return proCountLedger.get(id) || 0;
    };
    const applyLedgerDelta = (memberId, delta) => {
      const id = cleanId(memberId);
      if (!id || !delta) return;
      proCountLedger.set(id, Math.max(0, ledgerProCount(id) + delta));
    };

    for (const offer of pendingOffers) {
      try {
        const deltas = getOfferProjectedProDeltas(offer);
        const buyerProjectedProCount = ledgerProCount(deltas.buyerId) + deltas.buyerDelta;
        const sellerProjectedProCount = ledgerProCount(deltas.sellerId) + deltas.sellerDelta;
        if (buyerProjectedProCount > MAX_PRO_PLAYERS || sellerProjectedProCount > MAX_PRO_PLAYERS) {
          const failureReason = buyerProjectedProCount > MAX_PRO_PLAYERS
            ? "تعذر تنفيذ الصفقة عند فتح السوق لأن قائمة المستفيد ستتجاوز حد 5 محترفين."
            : "تعذر تنفيذ الصفقة عند فتح السوق لأن قائمة صاحب لاعب التبادل ستتجاوز حد 5 محترفين.";
          await updateDoc(doc(db, "playerOffers", offer.id), {
            status: "executionFailed",
            pendingExecutionStatus: "failed",
            pendingExecutionFailureReason: failureReason,
            updatedAt: serverTimestamp(),
          });
          offerResults.push({ ok: false, offerId: offer.id, reason: "pro_limit_exceeded" });
          continue;
        }
        const result = await processPendingPlayerOfferOnMarketOpen(offer, windowInfo);
        offerResults.push(result);
        if (result?.ok) {
          applyLedgerDelta(deltas.buyerId, deltas.buyerDelta);
          applyLedgerDelta(deltas.sellerId, deltas.sellerDelta);
        }
      } catch (err) {
        console.error("Pending offer execution failed:", err);
        offerResults.push({ ok: false, offerId: offer.id, reason: err?.message || "unknown_error" });
      }
    }

    const freeAgentResults = [];
    for (const item of pendingFreeAgents) {
      try {
        await executeFreeAgentQueueItem(item, { marketOpenWindowInfo: windowInfo });
        freeAgentResults.push({ ok: true, queueId: item.id });
      } catch (err) {
        console.error("Pending free agent execution failed:", err);
        freeAgentResults.push({ ok: false, queueId: item.id, reason: err?.message || "unknown_error" });
      }
    }

    return {
      offers: offerResults,
      freeAgents: freeAgentResults,
      completedOffers: offerResults.filter((item) => item?.ok).length,
      completedFreeAgents: freeAgentResults.filter((item) => item?.ok).length,
    };
  }

  async function createFifaAdminMarketControl(payload = {}) {
    if (!isFifaAdmin) throw new Error("هذه الصلاحية مخصصة لحساب FIFA فقط.");
    const action = clean(payload.action || "open_window");
    const title = String(payload.title || "").trim() || "فترة انتقالات";
    const startDate = String(payload.startDate || new Date().toISOString().slice(0, 10)).slice(0, 10);
    const endDate = String(payload.endDate || "").slice(0, 10);
    const note = String(payload.note || "").trim();

    if (action === "open_window") {
      if (!endDate) throw new Error("حدد تاريخ نهاية فترة الانتقالات.");
      const windowRef = await addDoc(collection(db, "transferWindows"), {
        name: title,
        title,
        status: "open",
        startDate,
        endDate,
        note,
        source: "fifa_admin_market_control",
        createdBy: authUser?.uid || "",
        createdByMemberId: currentMemberId || "FIFA",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      const notificationRef = await createAdminNotificationDoc({
        type: "transfer_window_open",
        title: "فتح سوق الانتقالات",
        body: note || ("تم فتح " + title + " حتى " + endDate + "."),
        audience: "all",
        relatedTransferWindowId: windowRef.id,
        source: "fifa_admin_market_control",
      });
      const pendingExecutionSummary = await processPendingMarketActionsOnOpen({
        windowId: windowRef.id,
        windowTitle: title,
        startDate,
        endDate,
      });
      await recordFifaAdminDecision({
        type: "transfer_window_open",
        typeLabel: "فتح سوق الانتقالات",
        status: "active",
        title,
        startDate,
        endDate,
        note,
        relatedTransferWindowId: windowRef.id,
        relatedNotificationId: notificationRef.id,
        pendingExecutionSummary,
        source: "fifa_admin_market_control",
        reversible: false,
      });
      return;
    }

    if (action === "close_windows") {
      const openRows = (firebaseTransferWindows || []).filter((item) => clean(item.status || "") === "open");
      await Promise.allSettled(openRows.map((item) => updateDoc(doc(db, "transferWindows", item.id), {
        status: "closed",
        closedAt: serverTimestamp(),
        closedBy: authUser?.uid || "",
        closeReason: note,
        updatedAt: serverTimestamp(),
      })));
      const notificationRef = await createAdminNotificationDoc({
        type: "transfer_window_closed",
        title: "إغلاق سوق الانتقالات",
        body: note || "تم إغلاق سوق الانتقالات بقرار FIFA.",
        audience: "all",
        source: "fifa_admin_market_control",
      });
      await recordFifaAdminDecision({
        type: "transfer_window_closed",
        typeLabel: "إغلاق سوق الانتقالات",
        status: "completed",
        relatedTransferWindowIds: openRows.map((item) => item.id),
        relatedNotificationId: notificationRef.id,
        note,
        source: "fifa_admin_market_control",
        reversible: false,
      });
      return;
    }


    if (action === "update_window") {
      const windowId = cleanId(payload.windowId || "");
      if (!windowId) throw new Error("اختر فترة الانتقالات المراد تعديلها.");
      const existingWindow = (firebaseTransferWindows || []).find((item) => same(item.id, windowId));
      if (!existingWindow) throw new Error("فترة الانتقالات غير موجودة.");
      const nextTitle = String(payload.title || existingWindow.title || existingWindow.name || "فترة انتقالات").trim() || "فترة انتقالات";
      const nextStartDate = String(payload.startDate || existingWindow.startDate || startDate).slice(0, 10);
      const nextEndDate = String(payload.endDate || existingWindow.endDate || "").slice(0, 10);
      if (!nextEndDate) throw new Error("حدد تاريخ نهاية فترة الانتقالات.");
      await updateDoc(doc(db, "transferWindows", windowId), {
        name: nextTitle,
        title: nextTitle,
        startDate: nextStartDate,
        endDate: nextEndDate,
        note: note || existingWindow.note || "",
        updatedAt: serverTimestamp(),
        updatedBy: authUser?.uid || "",
        updatedByMemberId: currentMemberId || "FIFA",
      });
      await recordFifaAdminDecision({
        type: "transfer_window_updated",
        typeLabel: "تعديل فترة انتقالات",
        status: "completed",
        title: nextTitle,
        startDate: nextStartDate,
        endDate: nextEndDate,
        note,
        relatedTransferWindowId: windowId,
        source: "fifa_admin_market_control",
        reversible: false,
      });
      return;
    }

    if (action === "cancel_window") {
      const windowId = cleanId(payload.windowId || "");
      if (!windowId) throw new Error("اختر فترة الانتقالات المراد إلغاؤها.");
      const existingWindow = (firebaseTransferWindows || []).find((item) => same(item.id, windowId));
      if (!existingWindow) throw new Error("فترة الانتقالات غير موجودة.");
      await updateDoc(doc(db, "transferWindows", windowId), {
        status: "cancelled",
        cancelledAt: serverTimestamp(),
        cancelledBy: authUser?.uid || "",
        cancelledByMemberId: currentMemberId || "FIFA",
        cancelReason: note || "إلغاء إداري لفترة الانتقالات",
        updatedAt: serverTimestamp(),
      });
      await recordFifaAdminDecision({
        type: "transfer_window_cancelled",
        typeLabel: "إلغاء فترة انتقالات",
        status: "cancelled",
        title: existingWindow.title || existingWindow.name || "فترة انتقالات",
        startDate: existingWindow.startDate || "",
        endDate: existingWindow.endDate || "",
        note: note || "إلغاء إداري لفترة الانتقالات",
        relatedTransferWindowId: windowId,
        source: "fifa_admin_market_control",
        reversible: false,
      });
      return;
    }

    if (action === "delete_window") {
      const windowId = cleanId(payload.windowId || "");
      if (!windowId) throw new Error("اختر فترة الانتقالات المراد حذفها.");
      const existingWindow = (firebaseTransferWindows || []).find((item) => same(item.id, windowId));
      if (!existingWindow) throw new Error("فترة الانتقالات غير موجودة.");
      await deleteDoc(doc(db, "transferWindows", windowId));
      await recordFifaAdminDecision({
        type: "transfer_window_deleted",
        typeLabel: "حذف فترة انتقالات",
        status: "completed",
        title: existingWindow.title || existingWindow.name || "فترة انتقالات",
        startDate: existingWindow.startDate || "",
        endDate: existingWindow.endDate || "",
        note: note || "حذف إداري من السجلات",
        relatedTransferWindowId: windowId,
        source: "fifa_admin_market_control",
        reversible: false,
      });
      return;
    }

    throw new Error("إجراء سوق الانتقالات غير معروف.");
  }

  function assertTransferAllowed(memberId, action) {
    const restriction = getBlockingTransferRestriction(firebaseMemberRestrictions, memberId, action);
    if (!restriction) return;
    throw new Error(transferRestrictionBlockMessage(restriction, action));
  }


  async function createFifaLeagueCompetition(payload = {}) {
    if (!isFifaAdmin) throw new Error("هذه الصلاحية مخصصة لحساب FIFA فقط.");
    const requestedCompetitionType = competitionTypeKey(payload.competitionType || "league");
    const competitionType = ["league", "league_qualifier", "cup", "super_cup", "world_cup", "champions_league"].includes(requestedCompetitionType) ? requestedCompetitionType : "league";
    const name = String(payload.name || "").trim();
    const seasonId = cleanId(payload.seasonId || activeSeasonId || "S6");
    const participantIds = Array.isArray(payload.participantIds) ? payload.participantIds.map(cleanId).filter(Boolean) : [];
    if (!name) {
      const nameError = competitionType === "league_qualifier" ? "اكتب اسم ملحق الدوري." : competitionType === "cup" ? "اكتب اسم بطولة الكأس." : competitionType === "super_cup" ? "اكتب اسم كأس السوبر." : competitionType === "world_cup" ? "اكتب اسم كأس العالم." : competitionType === "champions_league" ? "اكتب اسم دوري الأبطال." : "اكتب اسم الدوري.";
      throw new Error(nameError);
    }
    if (participantIds.length < 2) throw new Error("اختر عضوين على الأقل لإنشاء البطولة.");
    const worldCupQualifiersEnabled = Boolean(payload.worldCupQualifiersEnabled);
    const championsLeagueQualifiersEnabled = Boolean(payload.championsLeagueQualifiersEnabled);
    const leagueFormat = competitionType === "league" && ["two_groups", "league_two_groups_knockout"].includes(clean(payload.leagueFormat || payload.leagueGroupMode || "")) ? "two_groups" : "single_group";
    const leagueTwoGroupsEnabled = competitionType === "league" && leagueFormat === "two_groups";
    if (competitionType === "super_cup" && participantIds.length !== 2) throw new Error("كأس السوبر مباراة نهائية بين عضوين فقط. اختر عضوين بالضبط.");
    if (competitionType === "world_cup" && participantIds.length < 4) throw new Error("كأس العالم يحتاج 4 مشاركين على الأقل حتى يمكن تكوين المتأهلين الأربعة للأدوار الإقصائية.");
    if (competitionType === "champions_league" && participantIds.length < 4) throw new Error("دوري الأبطال يحتاج 4 مشاركين على الأقل حتى يمكن تكوين مجموعتين ونصف النهائي.");
    if (leagueTwoGroupsEnabled && participantIds.length < 4) throw new Error("الدوري بنظام مجموعتين يحتاج 4 مشاركين على الأقل.");
    if (leagueTwoGroupsEnabled && participantIds.length > 8) throw new Error("الدوري بنظام مجموعتين يدعم حتى 8 مشاركين حاليًا.");
    const leagueQualifierEnabled = competitionType === "league" && !leagueTwoGroupsEnabled && Boolean(payload.leagueQualifierEnabled);
    const leagueQualifierParticipantIds = Array.isArray(payload.leagueQualifierParticipantIds) ? payload.leagueQualifierParticipantIds.map(cleanId).filter(Boolean) : [];
    const leagueQualifierQualifiedCount = Math.max(1, Math.min(toNumber(payload.leagueQualifierQualifiedCount || payload.qualifiersCount || 1), 5));
    if (competitionType === "world_cup" && participantIds.length > 9 && !worldCupQualifiersEnabled) throw new Error("كأس العالم الأساسي حده 9 أعضاء. عند اختيار أكثر من 9 فعّل خيار تصفيات كأس العالم داخل نفس النسخة.");
    if (competitionType === "world_cup" && participantIds.length > 18) throw new Error("تصفيات كأس العالم الحالية تدعم حتى 18 مشاركًا كحد أقصى حتى يتم تأهيل 9 أعضاء لدور المجموعات.");
    if (competitionType === "champions_league" && participantIds.length > 8 && !championsLeagueQualifiersEnabled) throw new Error("دوري الأبطال الأساسي حده 8 أعضاء. عند اختيار أكثر من 8 فعّل ملحق دوري الأبطال داخل نفس النسخة.");
    if (competitionType === "champions_league" && participantIds.length > 16) throw new Error("ملحق دوري الأبطال الحالي يدعم حتى 16 مشاركًا كحد أقصى حتى يتم تأهيل 8 أعضاء لدور المجموعات.");
    if (competitionType === "cup" && participantIds.length > 8) throw new Error("بطولة الكأس تدعم حتى 8 مشاركين، ومع العدد الأقل يتم تطبيق التأهل المباشر / BYE تلقائيًا.");
    if (leagueQualifierEnabled) {
      if (leagueQualifierParticipantIds.length < 2) throw new Error("اختر عضوين على الأقل لملحق الدوري داخل نفس النسخة.");
      if (leagueQualifierParticipantIds.length > 5) throw new Error("ملحق الدوري يدعم من 2 إلى 5 أعضاء كحد أقصى.");
      if (leagueQualifierQualifiedCount >= leagueQualifierParticipantIds.length) throw new Error("عدد المتأهلين من الملحق يجب أن يكون أقل من عدد أعضاء الملحق.");
      const overlap = participantIds.some((id) => leagueQualifierParticipantIds.some((qid) => same(id, qid)));
      if (overlap) throw new Error("لا يمكن أن يكون العضو مشاركًا مباشرًا في الدوري وداخل الملحق في نفس الوقت.");
      if (participantIds.length + leagueQualifierQualifiedCount > 8) throw new Error("عدد المشاركين المباشرين + المتأهلين من الملحق يجب ألا يتجاوز 8 أعضاء في الدوري.");
    }

    const manualSeeds = payload.manualSeeds && typeof payload.manualSeeds === "object" ? payload.manualSeeds : {};
    const participantRows = participantIds
      .map((id) => members.find((member) => same(member.id, id)))
      .filter(Boolean)
      .map((member, index) => ({
        memberId: cleanId(member.id),
        memberName: member.name || cleanId(member.id),
        avatar: member.avatar || avatar(member.name || member.id),
        image: member.avatar || avatar(member.name || member.id),
        order: index + 1,
        seed: ["league", "cup", "world_cup", "champions_league"].includes(competitionType) ? Math.max(1, toNumber(manualSeeds[cleanId(member.id)] || index + 1)) : index + 1,
        status: "active",
      }))
      .sort((a, b) => ["league", "cup", "world_cup", "champions_league"].includes(competitionType) ? (toNumber(a.seed) - toNumber(b.seed) || clean(a.memberName).localeCompare(clean(b.memberName), "ar")) : 0);

    if (["league", "cup", "world_cup", "champions_league"].includes(competitionType)) {
      const seedValues = participantRows.map((item) => toNumber(item.seed)).filter(Boolean);
      const requiresUniqueSeeds = competitionType === "cup" || (competitionType === "league" && !leagueTwoGroupsEnabled);
      if (requiresUniqueSeeds && new Set(seedValues).size !== seedValues.length) throw new Error(competitionType === "league" ? "لا يمكن تكرار نفس تصنيف الدوري في نظام المجموعة الواحدة." : "لا يمكن تكرار نفس التصنيف في بطولة الكأس.");
      if (competitionType === "cup" && seedValues.some((seed) => seed < 1 || seed > 8)) throw new Error("تصنيف الكأس يجب أن يكون من 1 إلى 8.");
      if (competitionType === "league" && seedValues.some((seed) => seed < 1)) throw new Error("تصنيف الدوري يجب أن يبدأ من 1 ولا يمكن أن يكون صفرًا أو أقل.");
      if (competitionType === "world_cup" && seedValues.some((seed) => seed < 1)) throw new Error("تصنيف كأس العالم يجب أن يبدأ من 1 ولا يمكن أن يكون صفرًا أو أقل.");
      if (competitionType === "champions_league" && seedValues.some((seed) => seed < 1)) throw new Error("تصنيف دوري الأبطال يجب أن يبدأ من 1 ولا يمكن أن يكون صفرًا أو أقل.");
    }

    const roundsMode = clean(payload.roundsMode || "single") === "double" ? "double" : "single";
    const rewards = normalizeCompetitionRewards(payload.rewards || {});
    const autoPayRewards = Boolean(payload.autoPayRewards);
    const onlineMemberId = cleanId(payload.onlineMemberId || participantRows.find(isAbdullahLike)?.memberId || "");
    const fifaQuotaPerMember = Math.max(0, toNumber(payload.fifaQuotaPerMember ?? 2));
    const maxFifaPerRound = Math.max(1, toNumber(payload.maxFifaPerRound ?? fifaQuotaPerMember ?? 2));
    const gameDistributionMode = ["auto", "fifa2025_only", "pes2017_only", "mixed_manual"].includes(clean(payload.gameDistributionMode || "auto")) ? clean(payload.gameDistributionMode || "auto") : "auto";
    const fifa2025MatchCount = Math.max(0, toNumber(payload.fifa2025MatchCount ?? payload.fifaTargetCount ?? 0));
    const startDate = String(payload.startDate || new Date().toISOString().slice(0, 10)).slice(0, 10);
    const endDate = String(payload.endDate || "").slice(0, 10);
    const qualifiersCount = Math.max(1, Math.min(toNumber(payload.qualifiersCount || 1), Math.max(1, participantRows.length - 1)));
    let matches = [];
    let standings = [];
    let gameQuota = null;
    let competitionParticipants = participantRows;
    let leagueQualifierObject = null;

    if (competitionType === "league") {
      if (leagueTwoGroupsEnabled) {
        const leagueGroupsPlan = generateLeagueTwoGroupsMatches(participantRows, { onlineMemberId });
        matches = leagueGroupsPlan.matches;
        gameQuota = leagueGroupsPlan.gameQuota;
        competitionParticipants = leagueGroupsPlan.participants || participantRows;
        standings = [];
      } else {
        let leagueParticipantsForSchedule = participantRows;
        if (leagueQualifierEnabled) {
          const qualifierRows = leagueQualifierParticipantIds
            .map((id) => members.find((member) => same(member.id, id)))
            .filter(Boolean)
            .map((member, index) => ({
              memberId: cleanId(member.id),
              memberName: member.name || cleanId(member.id),
              avatar: member.avatar || avatar(member.name || member.id),
              image: member.avatar || avatar(member.name || member.id),
              order: index + 1,
              seed: index + 1,
              status: "qualifier",
            }));
          const qualifierPlan = generateLeagueQualifierMatches(qualifierRows, leagueQualifierQualifiedCount, { onlineMemberId });
          const qualifierSlots = Array.from({ length: leagueQualifierQualifiedCount }, (_, index) => ({
            memberId: `__league_qualifier_winner_${index + 1}`,
            memberName: `المتأهل من ملحق الدوري ${index + 1}`,
            avatar: avatar(`متأهل ${index + 1}`),
            image: avatar(`متأهل ${index + 1}`),
            order: participantRows.length + index + 1,
            seed: participantRows.length + index + 1,
            status: "pending_qualifier",
            isLeagueQualifierWinnerSlot: true,
            qualifierWinnerIndex: index + 1,
          }));
          leagueParticipantsForSchedule = [...participantRows, ...qualifierSlots];
          leagueQualifierObject = {
            enabled: true,
            type: "league",
            name: `ملحق ${name}`,
            linkedCompetitionName: name,
            qualifiedCount: leagueQualifierQualifiedCount,
            participantIds: qualifierRows.map((row) => row.memberId),
            participants: qualifierRows,
            matches: qualifierPlan.matches.map((match) => ({ ...match, scope: "league_qualifier", parentCompetitionType: "league" })),
            qualifiedMemberIds: [],
            status: "active",
            createdAtText: new Date().toISOString(),
          };
        }
        const baseMatches = generateLeagueRoundRobinMatches(leagueParticipantsForSchedule, roundsMode);
        const platformPlan = assignLeagueGamePlatforms(baseMatches, leagueParticipantsForSchedule, { onlineMemberId, maxFifaPerRound });
        matches = platformPlan.matches;
        gameQuota = platformPlan.gameQuota;
        competitionParticipants = leagueParticipantsForSchedule;
        standings = computeLeagueStandings(leagueParticipantsForSchedule, matches);
      }
    } else if (competitionType === "league_qualifier") {
      const qualifierPlan = generateLeagueQualifierMatches(participantRows, qualifiersCount, { onlineMemberId });
      matches = qualifierPlan.matches;
      gameQuota = qualifierPlan.gameQuota;
      standings = [];
    } else if (competitionType === "cup") {
      const cupPlan = generateSeededKnockoutBracketMatches(participantRows, { onlineMemberId, prefix: "CUP", title: "الكأس" });
      matches = cupPlan.matches;
      gameQuota = cupPlan.gameQuota;
      standings = [];
    } else if (competitionType === "super_cup") {
      const superCupPlan = generateSeededKnockoutBracketMatches(participantRows, { onlineMemberId, prefix: "SUPER", title: "كأس السوبر" });
      matches = superCupPlan.matches.map((match) => ({ ...match, label: "نهائي كأس السوبر", phase: "final", round: 1 }));
      gameQuota = { ...(superCupPlan.gameQuota || {}), format: "single_final" };
      standings = [];
    } else if (competitionType === "world_cup") {
      const worldCupPlan = generateWorldCupMatches(participantRows, { onlineMemberId, enableQualifiers: worldCupQualifiersEnabled });
      matches = worldCupPlan.matches;
      gameQuota = worldCupPlan.gameQuota;
      competitionParticipants = worldCupPlan.participants || participantRows;
      standings = [];
    } else if (competitionType === "champions_league") {
      const championsPlan = generateChampionsLeagueMatches(participantRows, { onlineMemberId, enableQualifiers: championsLeagueQualifiersEnabled });
      matches = championsPlan.matches;
      gameQuota = championsPlan.gameQuota;
      competitionParticipants = championsPlan.participants || participantRows;
      standings = [];
    }

    if (leagueQualifierObject?.enabled) {
      const qualifierMatchCount = Array.isArray(leagueQualifierObject.matches) ? leagueQualifierObject.matches.length : 0;
      const combinedGameMatches = applyCompetitionGameMode([...(leagueQualifierObject.matches || []), ...matches], { gameDistributionMode, fifa2025MatchCount });
      leagueQualifierObject = { ...leagueQualifierObject, matches: combinedGameMatches.slice(0, qualifierMatchCount) };
      matches = combinedGameMatches.slice(qualifierMatchCount);
    } else {
      matches = applyCompetitionGameMode(matches, { gameDistributionMode, fifa2025MatchCount });
    }

    const todayDate = new Date().toISOString().slice(0, 10);
    const typeLabel = competitionTypeLabel(competitionType);

    const competitionRef = await addDoc(collection(db, "competitions"), {
      type: competitionType,
      typeLabel,
      name,
      logo: competitionLogoUrl({ type: competitionType }, config, trophyMap),
      seasonId,
      status: "active",
      startDate,
      endDate,
      roundsMode: competitionType === "league" ? (leagueTwoGroupsEnabled ? "groups_knockout" : roundsMode) : competitionType === "super_cup" ? "single_final" : ["world_cup", "champions_league"].includes(competitionType) ? "groups_knockout" : "knockout",
      leagueFormat: competitionType === "league" ? leagueFormat : "",
      bracketMode: competitionType === "super_cup" ? "single_final" : competitionType === "cup" ? "seeded_knockout" : competitionType === "world_cup" ? "world_cup_groups_knockout" : competitionType === "champions_league" ? "champions_league_groups_knockout" : (competitionType === "league_qualifier" ? "qualifier_knockout" : leagueTwoGroupsEnabled ? "league_two_groups_knockout" : "league"),
      qualifiersCount: competitionType === "league_qualifier" ? qualifiersCount : ["world_cup", "champions_league"].includes(competitionType) ? 4 : null,
      rewards,
      autoPayRewards,
      gameRules: {
        mainGames: ["PES 2017", "FIFA 2025"],
        onlineMemberId,
        fifaQuotaPerMember,
        maxFifaPerRound,
        gameDistributionMode,
        fifa2025MatchCount,
        gameQuota,
        rule: gameDistributionMode === "fifa2025_only" ? "اختيار إداري: كل المباريات على FIFA 2025." : gameDistributionMode === "pes2017_only" ? "اختيار إداري: كل المباريات على PES 2017." : gameDistributionMode === "mixed_manual" ? `اختيار إداري: مكس بين اللعبتين، ${fifa2025MatchCount} مباراة على FIFA 2025 والباقي PES 2017.` : "أي مباراة تشمل عضو الأونلاين تكون FIFA 2025، وكل جولة تحاول احتواء مباريات FIFA 2025 والباقي PES 2017 مع توزيع عادل.",
      },
      participants: competitionParticipants,
      matches,
      standings,
      relegatedMemberIds: [],
      absentMemberIds: [],
      qualifiedMemberIds: [],
      leagueQualifier: leagueQualifierObject,
      championMemberId: "",
      championMemberName: "",
      createdBy: authUser?.uid || "",
      createdByMemberId: currentMemberId || "FIFA",
      createdByName: authProfile?.memberName || authProfile?.username || "FIFA",
      date: todayDate,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await addDoc(collection(db, "adminDecisions"), {
      type: competitionType === "league_qualifier" ? "league_qualifier_created" : competitionType === "cup" ? "cup_created" : competitionType === "super_cup" ? "super_cup_created" : competitionType === "world_cup" ? "world_cup_created" : "league_created",
      status: "active",
      title: competitionType === "league_qualifier" ? "إنشاء ملحق دوري" : competitionType === "cup" ? "إنشاء بطولة الكأس" : competitionType === "super_cup" ? "إنشاء كأس السوبر" : competitionType === "world_cup" ? "إنشاء كأس العالم" : competitionType === "champions_league" ? "إنشاء دوري الأبطال" : "إنشاء دوري",
      body: "تم إنشاء " + name + " بعدد " + participantRows.length + " مشاركين.",
      competitionId: competitionRef.id,
      competitionName: name,
      competitionType,
      seasonId,
      createdBy: authUser?.uid || "",
      createdByMemberId: currentMemberId || "FIFA",
      createdByName: authProfile?.memberName || authProfile?.username || "FIFA",
      date: todayDate,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await addDoc(collection(db, "notifications"), {
      type: competitionType === "league_qualifier" ? "league_qualifier_created" : competitionType === "cup" ? "cup_created" : competitionType === "super_cup" ? "super_cup_created" : competitionType === "world_cup" ? "world_cup_created" : "league_created",
      title: competitionType === "league_qualifier" ? "تم إنشاء ملحق دوري" : competitionType === "cup" ? "تم إنشاء بطولة الكأس" : competitionType === "super_cup" ? "تم إنشاء كأس السوبر" : competitionType === "world_cup" ? "تم إنشاء كأس العالم" : competitionType === "champions_league" ? "تم إنشاء دوري الأبطال" : "تم إنشاء دوري جديد",
      body: "تم إنشاء " + name + " في FIFA GROUP. يمكنك متابعة الجدول والنتائج من صفحة " + (config.seasonName || "الموسم") + " داخل التطبيق.",
      status: "unread",
      audience: "all",
      fromMemberId: "FIFA",
      fromMemberName: "FIFA",
      source: "fifa_admin_competitions",
      relatedCompetitionId: competitionRef.id,
      clickUrl: "/?fgPage=season&fgCompetitionId=" + encodeURIComponent(competitionRef.id),
      createdBy: authUser?.uid || "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  function resolveEmbeddedLeagueQualifierLinks(competition = {}, nextQualifier = null, baseMatchesArg = null, baseParticipantsArg = null) {
    const qualifier = nextQualifier || competition.leagueQualifier || {};
    const qCount = Math.max(1, toNumber(qualifier.qualifiedCount || competition.leagueQualifier?.qualifiedCount || 1));
    const qualifiedIds = computeLeagueQualifierQualifiedIds({ matches: qualifier.matches || [], qualifiersCount: qCount });
    const qualifiedRows = qualifiedIds.map((id) => {
      const row = (qualifier.participants || []).find((item) => same(item.memberId || item.id, id)) || (competition.participants || []).find((item) => same(item.memberId || item.id, id)) || members.find((item) => same(item.id, id));
      return { memberId: cleanId(id), memberName: row?.memberName || row?.name || getMemberName(members, id) || id, avatar: row?.avatar || row?.image || avatar(row?.memberName || row?.name || id), image: row?.image || row?.avatar || avatar(row?.memberName || row?.name || id) };
    });
    const slotMap = new Map();
    qualifiedRows.forEach((row, index) => slotMap.set(`__league_qualifier_winner_${index + 1}`, row));
    const replaceSide = (memberId, name) => {
      const safe = String(memberId || "");
      const row = slotMap.get(safe);
      if (!row) return { memberId, name };
      return { memberId: row.memberId, name: row.memberName };
    };
    const baseMatches = Array.isArray(baseMatchesArg) ? baseMatchesArg : (Array.isArray(competition.matches) ? competition.matches : []);
    const baseParticipants = Array.isArray(baseParticipantsArg) ? baseParticipantsArg : (Array.isArray(competition.participants) ? competition.participants : []);
    const resolvedParticipants = baseParticipants.map((participant) => {
      const row = slotMap.get(String(participant.memberId || participant.id || ""));
      return row ? { ...participant, ...row, status: "active", resolvedFromLeagueQualifier: true } : participant;
    });
    const resolvedMatches = baseMatches.map((match) => {
      const home = replaceSide(match.homeMemberId, match.homeName);
      const away = replaceSide(match.awayMemberId, match.awayName);
      return { ...match, homeMemberId: home.memberId, homeName: home.name, awayMemberId: away.memberId, awayName: away.name };
    });
    return { qualifiedIds, resolvedParticipants, resolvedMatches, qualifier: { ...qualifier, qualifiedMemberIds: qualifiedIds, status: qualifiedIds.length >= qCount ? "completed" : (qualifier.status || "active") } };
  }

  async function updateFifaLeagueMatchResult({ competitionId, matchId, homeGoals, awayGoals, homePens, awayPens, gameTitle }) {
    if (!isFifaAdmin) throw new Error("هذه الصلاحية مخصصة لحساب FIFA فقط.");
    const competition = firebaseCompetitions.find((item) => same(item.id, competitionId));
    if (!competition) throw new Error("البطولة غير موجودة.");
    const competitionType = competitionTypeKey(competition.type || "league");
    const leagueGroupsMode = isLeagueGroupsCompetition(competition);
    if (!["league", "league_qualifier", "cup", "super_cup", "world_cup", "champions_league"].includes(competitionType)) throw new Error("هذه العملية مخصصة للبطولات التنافسية المدعومة فقط.");
    if (["completed", "cancelled"].includes(clean(competition.status || "active")) && !["cup", "super_cup", "world_cup", "champions_league"].includes(competitionType) && !leagueGroupsMode) throw new Error("لا يمكن تعديل نتائج بطولة مغلقة أو ملغاة.");
    const h = toNumber(homeGoals);
    const a = toNumber(awayGoals);
    if (h < 0 || a < 0 || String(homeGoals).trim() === "" || String(awayGoals).trim() === "") {
      throw new Error("أدخل نتيجة صحيحة للطرفين.");
    }

    const embeddedLeagueQualifier = competitionType === "league" && competition.leagueQualifier?.enabled ? competition.leagueQualifier : null;
    if (embeddedLeagueQualifier && (embeddedLeagueQualifier.matches || []).some((match) => same(match.id, matchId))) {
      const beforeQualifiedIds = computeLeagueQualifierQualifiedIds({ matches: embeddedLeagueQualifier.matches || [], qualifiersCount: embeddedLeagueQualifier.qualifiedCount || 1 });
      let nextQualifierMatches = (embeddedLeagueQualifier.matches || []).map((match) => {
        if (!same(match.id, matchId)) return match;
        if (String(match.homeMemberId || "").startsWith("__") || String(match.awayMemberId || "").startsWith("__")) throw new Error("هذه المباراة بانتظار تحديد المتأهل من مرحلة سابقة.");
        const hp = String(homePens ?? "").trim() === "" ? null : toNumber(homePens);
        const ap = String(awayPens ?? "").trim() === "" ? null : toNumber(awayPens);
        let winnerMemberId = h > a ? cleanId(match.homeMemberId) : a > h ? cleanId(match.awayMemberId) : "";
        let winnerName = h > a ? match.homeName : a > h ? match.awayName : "";
        if (!winnerMemberId) {
          if (hp === null || ap === null || hp === ap) throw new Error("في مباريات الملحق الإقصائية، أدخل ركلات الترجيح عند التعادل وحدد متأهلًا.");
          winnerMemberId = hp > ap ? cleanId(match.homeMemberId) : cleanId(match.awayMemberId);
          winnerName = hp > ap ? match.homeName : match.awayName;
        }
        return { ...match, homeGoals: h, awayGoals: a, homePens: hp, awayPens: ap, resultStatus: "completed", status: "completed", winnerMemberId, winnerName, gameTitle: String(gameTitle || match.gameTitle || "").trim() || match.gameTitle || "PES 2017", gameCode: clean(gameTitle || match.gameTitle || "").includes("fifa") || String(gameTitle || match.gameTitle || "").includes("2025") ? "fifa25" : match.gameCode || "pes17", updatedAtText: new Date().toISOString() };
      });
      nextQualifierMatches = resolveLeagueQualifierDependencies(nextQualifierMatches);
      const resolved = resolveEmbeddedLeagueQualifierLinks(competition, { ...embeddedLeagueQualifier, matches: nextQualifierMatches }, competition.matches || [], competition.participants || []);
      const standings = computeLeagueStandings(resolved.resolvedParticipants, resolved.resolvedMatches);
      await updateDoc(doc(db, "competitions", competitionId), { matches: resolved.resolvedMatches, participants: resolved.resolvedParticipants, standings, leagueQualifier: resolved.qualifier, updatedAt: serverTimestamp(), lastResultAt: serverTimestamp() });
      const qCount = Math.max(1, toNumber(embeddedLeagueQualifier.qualifiedCount || 1));
      if (beforeQualifiedIds.length < qCount && resolved.qualifiedIds.length >= qCount) {
        const names = resolved.qualifiedIds.map((id) => getMemberName(members, id) || id).join("، ");
        await addDoc(collection(db, "notifications"), { type: "league_qualifier_completed", title: "نتيجة ملحق الدوري", body: `نتيجة ${embeddedLeagueQualifier.name || ("ملحق " + (competition.name || "الدوري"))}: المتأهلون إلى الدوري هم ${names}.`, audience: "all", fromMemberId: "FIFA", fromMemberName: "FIFA", source: "fifa_admin_competitions", relatedCompetitionId: competitionId, clickUrl: "/?fgPage=season&fgCompetitionId=" + encodeURIComponent(competitionId), createdBy: authUser?.uid || "", createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      }
      return;
    }

    const matches = Array.isArray(competition.matches) ? competition.matches : [];
    let nextMatches = matches.map((match) => {
      if (!same(match.id, matchId)) return match;
      if (String(match.homeMemberId || "").startsWith("__") || String(match.awayMemberId || "").startsWith("__")) {
        throw new Error("هذه المباراة بانتظار تحديد المتأهل من مرحلة سابقة.");
      }
      const hp = String(homePens ?? "").trim() === "" ? null : toNumber(homePens);
      const ap = String(awayPens ?? "").trim() === "" ? null : toNumber(awayPens);
      let winnerMemberId = h > a ? cleanId(match.homeMemberId) : a > h ? cleanId(match.awayMemberId) : "";
      let winnerName = h > a ? match.homeName : a > h ? match.awayName : "";
      const matchPhase = clean(match.phase || "");
      const needsPenaltyWinner = !winnerMemberId && (
        competitionType === "league_qualifier" ||
        ((isKnockoutCompetitionType(competitionType) || leagueGroupsMode) && !((["world_cup", "champions_league"].includes(competitionType) || leagueGroupsMode) && matchPhase === "group"))
      );
      if (needsPenaltyWinner) {
        if (hp === null || ap === null || hp === ap) throw new Error("في المباريات الإقصائية، أدخل ركلات الترجيح عند التعادل وحدد فائزًا.");
        winnerMemberId = hp > ap ? cleanId(match.homeMemberId) : cleanId(match.awayMemberId);
        winnerName = hp > ap ? match.homeName : match.awayName;
      }
      return {
        ...match,
        homeGoals: h,
        awayGoals: a,
        homePens: hp,
        awayPens: ap,
        resultStatus: "completed",
        status: "completed",
        winnerMemberId,
        winnerName,
        gameTitle: String(gameTitle || match.gameTitle || "").trim() || match.gameTitle || "PES 2017",
        gameCode: clean(gameTitle || match.gameTitle || "").includes("fifa") || String(gameTitle || match.gameTitle || "").includes("2025") ? "fifa25" : match.gameCode || "pes17",
        updatedAtText: new Date().toISOString(),
      };
    });

    if (competitionType === "league_qualifier") {
      nextMatches = resolveLeagueQualifierDependencies(nextMatches);
    } else if (competitionType === "world_cup") {
      nextMatches = resolveWorldCupDependencies({ ...competition, matches: nextMatches });
    } else if (competitionType === "champions_league" || leagueGroupsMode) {
      nextMatches = resolveChampionsLeagueDependencies({ ...competition, matches: nextMatches });
    } else if (isKnockoutCompetitionType(competitionType)) {
      nextMatches = resolveKnockoutBracketDependencies(nextMatches);
    }

    const participants = Array.isArray(competition.participants) ? competition.participants : [];
    const standings = competitionType === "league" && !leagueGroupsMode ? computeLeagueStandings(participants, nextMatches) : [];
    const qualifiedMemberIds = competitionType === "league_qualifier" ? computeLeagueQualifierQualifiedIds({ ...competition, matches: nextMatches }) : competitionType === "world_cup" ? computeWorldCupQualifiedIds({ ...competition, matches: nextMatches }) : (competitionType === "champions_league" || leagueGroupsMode) ? computeChampionsLeagueQualifiedIds({ ...competition, matches: nextMatches }) : computeKnockoutQualifiedIds({ ...competition, matches: nextMatches });
    const nextChampion = (isKnockoutCompetitionType(competitionType) || leagueGroupsMode) ? getKnockoutChampion({ ...competition, matches: nextMatches }) : null;
    await updateDoc(doc(db, "competitions", competitionId), {
      matches: nextMatches,
      standings,
      qualifiedMemberIds,
      status: (["cup", "super_cup", "world_cup", "champions_league"].includes(competitionType) || leagueGroupsMode) && clean(competition.status || "active") === "completed" ? "completed" : "active",
      championMemberId: nextChampion?.memberId || (competitionType === "league" && !leagueGroupsMode ? "" : competition.championMemberId || ""),
      championMemberName: nextChampion?.memberName || (competitionType === "league" && !leagueGroupsMode ? "" : competition.championMemberName || ""),
      updatedAt: serverTimestamp(),
      lastResultAt: serverTimestamp(),
      rewardsNeedReview: (["cup", "super_cup", "world_cup", "champions_league"].includes(competitionType) || leagueGroupsMode) && clean(competition.status || "active") === "completed" ? true : Boolean(competition.rewardsNeedReview),
    });
  }

  async function clearFifaLeagueMatchResult({ competitionId, matchId }) {
    if (!isFifaAdmin) throw new Error("هذه الصلاحية مخصصة لحساب FIFA فقط.");
    const competition = firebaseCompetitions.find((item) => same(item.id, competitionId));
    if (!competition) throw new Error("البطولة غير موجودة.");
    if (["completed", "cancelled"].includes(clean(competition.status || "active")) && !["cup", "super_cup", "world_cup", "champions_league"].includes(competitionTypeKey(competition.type || "league"))) throw new Error("لا يمكن حذف نتيجة بطولة مغلقة أو ملغاة.");
    const competitionType = competitionTypeKey(competition.type || "league");
    const leagueGroupsMode = isLeagueGroupsCompetition(competition);
    const embeddedLeagueQualifier = competitionType === "league" && !leagueGroupsMode && competition.leagueQualifier?.enabled ? competition.leagueQualifier : null;
    if (embeddedLeagueQualifier && (embeddedLeagueQualifier.matches || []).some((match) => same(match.id, matchId))) {
      let nextQualifierMatches = (embeddedLeagueQualifier.matches || []).map((match) => {
        if (!same(match.id, matchId)) return match;
        return { ...match, homeGoals: "", awayGoals: "", homePens: null, awayPens: null, resultStatus: "pending", status: "scheduled", winnerMemberId: "", winnerName: "", updatedAtText: new Date().toISOString() };
      });
      nextQualifierMatches = resolveLeagueQualifierDependencies(nextQualifierMatches);
      const nextQualifier = { ...embeddedLeagueQualifier, matches: nextQualifierMatches, qualifiedMemberIds: computeLeagueQualifierQualifiedIds({ matches: nextQualifierMatches, qualifiersCount: embeddedLeagueQualifier.qualifiedCount || 1 }), status: "active" };
      await updateDoc(doc(db, "competitions", competitionId), { leagueQualifier: nextQualifier, updatedAt: serverTimestamp(), lastResultClearedAt: serverTimestamp() });
      return;
    }
    const nextMatches = (Array.isArray(competition.matches) ? competition.matches : []).map((match) => {
      if (!same(match.id, matchId)) return match;
      return {
        ...match,
        homeGoals: "",
        awayGoals: "",
        homePens: null,
        awayPens: null,
        resultStatus: "pending",
        status: "scheduled",
        winnerMemberId: "",
        winnerName: "",
        updatedAtText: new Date().toISOString(),
      };
    });
    const resolvedMatches = competitionType === "league_qualifier" ? resolveLeagueQualifierDependencies(nextMatches) : competitionType === "world_cup" ? resolveWorldCupDependencies({ ...competition, matches: nextMatches }) : (competitionType === "champions_league" || leagueGroupsMode) ? resolveChampionsLeagueDependencies({ ...competition, matches: nextMatches }) : isKnockoutCompetitionType(competitionType) ? resolveKnockoutBracketDependencies(nextMatches) : nextMatches;
    const standings = competitionType === "league" && !leagueGroupsMode ? computeLeagueStandings(competition.participants || [], resolvedMatches) : [];
    const qualifiedMemberIds = competitionType === "league_qualifier" ? computeLeagueQualifierQualifiedIds({ ...competition, matches: resolvedMatches }) : competitionType === "world_cup" ? computeWorldCupQualifiedIds({ ...competition, matches: resolvedMatches }) : (competitionType === "champions_league" || leagueGroupsMode) ? computeChampionsLeagueQualifiedIds({ ...competition, matches: resolvedMatches }) : computeKnockoutQualifiedIds({ ...competition, matches: resolvedMatches });
    const nextChampion = (isKnockoutCompetitionType(competitionType) || leagueGroupsMode) ? getKnockoutChampion({ ...competition, matches: resolvedMatches }) : null;
    await updateDoc(doc(db, "competitions", competitionId), {
      matches: resolvedMatches,
      standings,
      qualifiedMemberIds,
      status: (["cup", "super_cup", "world_cup", "champions_league"].includes(competitionType) || leagueGroupsMode) && clean(competition.status || "active") === "completed" ? "completed" : "active",
      championMemberId: nextChampion?.memberId || "",
      championMemberName: nextChampion?.memberName || "",
      updatedAt: serverTimestamp(),
      lastResultClearedAt: serverTimestamp(),
      rewardsNeedReview: (["cup", "super_cup", "world_cup", "champions_league"].includes(competitionType) || leagueGroupsMode) && clean(competition.status || "active") === "completed" ? true : Boolean(competition.rewardsNeedReview),
    });
  }

  async function reverseCompetitionRewardTransfersIfNeeded(competitionId, reason = "تصحيح مكافآت بطولة") {
    const id = cleanId(competitionId);
    if (!id) return [];
    const existingRewards = (firebaseMoneyTransfers || []).filter((item) =>
      same(item.relatedCompetitionId, id) &&
      clean(item.source || "") === "competitionreward" &&
      !["reversed", "cancelled"].includes(clean(item.status || "approved")) &&
      clean(item.adminCorrectionStatus || item.reversalStatus || "") !== "reversed"
    );
    const reversalIds = [];
    for (const item of existingRewards) {
      const amount = Math.max(0, toNumber(item.amount));
      const memberId = cleanId(item.toMemberId || "");
      if (!amount || !memberId || same(memberId, "FIFA")) continue;
      const memberName = item.toMemberName || getMemberName(members, memberId) || "";
      const reversalRef = await addDoc(collection(db, "moneyTransfers"), {
        type: "competition_reward_reversal",
        typeLabel: "تصحيح مكافأة بطولة",
        status: "approved",
        fromMemberId: memberId,
        fromMemberName: memberName,
        toMemberId: "FIFA",
        toMemberName: "FIFA",
        amount,
        note: reason,
        source: "competition_reward_correction",
        relatedCompetitionId: id,
        relatedOriginalMoneyTransferId: item.id,
        approvedBy: authUser?.uid || "",
        createdBy: authUser?.uid || "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      reversalIds.push(reversalRef.id);
      await updateDoc(doc(db, "moneyTransfers", item.id), {
        adminCorrectionStatus: "reversed",
        reversalStatus: "reversed",
        reversedAt: serverTimestamp(),
        reversalTransferId: reversalRef.id,
        correctionReason: reason,
        updatedAt: serverTimestamp(),
      });
      await addDoc(collection(db, "notifications"), {
        type: "competition_reward_correction",
        title: "تصحيح مكافأة بطولة",
        body: "تم تصحيح مكافأة بطولة سابقة بقيمة " + formatMoney(amount) + " بسبب تعديل نتائج البطولة.",
        status: "unread",
        audience: "member",
        toMemberId: memberId,
        toMemberName: memberName,
        fromMemberId: "FIFA",
        fromMemberName: "FIFA",
        source: "competition_reward_correction",
        relatedCompetitionId: id,
        relatedMoneyTransferId: reversalRef.id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    return reversalIds;
  }

  async function finalizeFifaLeagueCompetition({ competitionId, relegatedMemberIds = [], absentMemberIds = [] }) {
    if (!isFifaAdmin) throw new Error("هذه الصلاحية مخصصة لحساب FIFA فقط.");
    const competition = firebaseCompetitions.find((item) => same(item.id, competitionId));
    if (!competition) throw new Error("البطولة غير موجودة.");
    const competitionType = competitionTypeKey(competition.type || "league");
    const leagueGroupsMode = isLeagueGroupsCompetition(competition);
    if (!["league", "league_qualifier", "cup", "super_cup", "world_cup", "champions_league"].includes(competitionType)) throw new Error("هذه العملية مخصصة للبطولات التنافسية المدعومة فقط.");
    if (clean(competition.status || "active") === "cancelled") throw new Error("لا يمكن اعتماد بطولة ملغاة.");
    const participants = Array.isArray(competition.participants) ? competition.participants : [];
    const matches = competitionType === "world_cup" ? resolveWorldCupDependencies(competition) : (competitionType === "champions_league" || leagueGroupsMode) ? resolveChampionsLeagueDependencies(competition) : (Array.isArray(competition.matches) ? competition.matches : []);
    const standings = competitionType === "league" && !leagueGroupsMode ? computeLeagueStandings(participants, matches) : [];
    const champion = competitionType === "league" && !leagueGroupsMode ? standings[0] || null : competitionType === "league_qualifier" ? null : getKnockoutChampion({ ...competition, matches });
    const relegated = (Array.isArray(relegatedMemberIds) ? relegatedMemberIds : []).map(cleanId).filter(Boolean);
    const absent = (Array.isArray(absentMemberIds) ? absentMemberIds : []).map(cleanId).filter(Boolean);
    const qualifiedMemberIds = competitionType === "league_qualifier" ? computeLeagueQualifierQualifiedIds({ ...competition, matches }) : competitionType === "world_cup" ? computeWorldCupQualifiedIds({ ...competition, matches }) : (competitionType === "champions_league" || leagueGroupsMode) ? computeChampionsLeagueQualifiedIds({ ...competition, matches }) : [];
    const todayDate = new Date().toISOString().slice(0, 10);
    const typeLabel = competitionTypeLabel(competitionType);

    await updateDoc(doc(db, "competitions", competitionId), {
      status: "completed",
      standings,
      championMemberId: champion?.memberId || "",
      championMemberName: champion?.memberName || "",
      relegatedMemberIds: competitionType === "league" && !leagueGroupsMode ? relegated : [],
      absentMemberIds: absent,
      qualifiedMemberIds,
      completedAt: serverTimestamp(),
      completedDate: todayDate,
      rewardsNeedReview: false,
      updatedAt: serverTimestamp(),
    });

    const rewards = normalizeCompetitionRewards(competition.rewards || {});
    const rewardRows = competitionType === "league" && !leagueGroupsMode
      ? standings.slice(0, 4).map((row, index) => ({ ...row, rank: index + 1 }))
      : (["cup", "super_cup", "world_cup", "champions_league"].includes(competitionType) || leagueGroupsMode)
        ? getKnockoutRewardRows({ ...competition, matches })
        : [];
    const shouldPayRewards = (competition.autoPayRewards === true || clean(competition.autoPayRewards) === "true") && rewardRows.length > 0;
    const reversedRewardTransferIds = ["cup", "super_cup", "world_cup", "champions_league"].includes(competitionType) && shouldPayRewards
      ? await reverseCompetitionRewardTransfersIfNeeded(competitionId, "تصحيح مكافآت البطولة بعد تعديل النتائج")
      : [];
    const paidRewardTransfers = [];
    if (shouldPayRewards) {
      const rewardLimit = competitionType === "super_cup" ? 2 : 4;
      for (let index = 0; index < Math.min(rewardLimit, rewardRows.length); index += 1) {
        const row = rewardRows[index];
        const rank = row.rank || index + 1;
        const amount = rewards[["first", "second", "third", "fourth"][rank - 1]] || 0;
        if (!amount || !row?.memberId) continue;
        const transferRef = await addDoc(collection(db, "moneyTransfers"), {
          type: "admin_reward",
          typeLabel: "مكافأة " + rewardRankLabel(rank),
          status: "approved",
          fromMemberId: "FIFA",
          fromMemberName: "FIFA",
          toMemberId: row.memberId,
          toMemberName: row.memberName || "",
          amount,
          note: "مكافأة " + rewardRankLabel(rank) + " في " + (competition.name || typeLabel),
          source: "competition_reward",
          relatedCompetitionId: competitionId,
          approvedBy: authUser?.uid || "",
          createdBy: authUser?.uid || "",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        paidRewardTransfers.push(transferRef.id);
        await addDoc(collection(db, "notifications"), {
          type: "competition_reward",
          title: "مكافأة بطولة",
          body: "تمت إضافة " + formatMoney(amount) + " إلى حسابك عن " + rewardRankLabel(rank) + " في " + (competition.name || typeLabel) + ".",
          status: "unread",
          audience: "member",
          toMemberId: row.memberId,
          toMemberName: row.memberName || "",
          fromMemberId: "FIFA",
          fromMemberName: "FIFA",
          source: "competition_reward",
          relatedCompetitionId: competitionId,
          clickUrl: "/?fgPage=season&fgCompetitionId=" + encodeURIComponent(competitionId),
          relatedMoneyTransferId: transferRef.id,
          createdBy: authUser?.uid || "",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    }

    const absentText = absent.length ? " الغائبون: " + absent.map((id) => getMemberName(members, id) || id).join("، ") + "." : "";
    const relegatedText = competitionType === "league" && !leagueGroupsMode && relegated.length ? " الهابطون: " + relegated.map((id) => standings.find((row) => same(row.memberId, id))?.memberName || getMemberName(members, id) || id).join("، ") + "." : "";
    const qualifiedText = competitionType === "league_qualifier" && qualifiedMemberIds.length ? " المتأهلون إلى الدوري: " + qualifiedMemberIds.map((id) => getMemberName(members, id) || id).join("، ") + "." : "";

    await addDoc(collection(db, "adminDecisions"), {
      type: competitionType === "league_qualifier" ? "league_qualifier_completed" : competitionType === "cup" ? "cup_completed" : competitionType === "super_cup" ? "super_cup_completed" : competitionType === "world_cup" ? "world_cup_completed" : competitionType === "champions_league" ? "champions_league_completed" : "league_completed",
      status: "completed",
      title: competitionType === "league_qualifier" ? "اعتماد ملحق دوري" : competitionType === "cup" ? "اعتماد بطولة الكأس" : competitionType === "super_cup" ? "اعتماد كأس السوبر" : competitionType === "world_cup" ? "اعتماد كأس العالم" : competitionType === "champions_league" ? "اعتماد دوري الأبطال" : "إغلاق دوري",
      body: "تم اعتماد " + (competition.name || typeLabel) + (champion?.memberName ? "، والبطل هو " + champion.memberName + "." : ".") + relegatedText + absentText + qualifiedText,
      competitionId,
      competitionName: competition.name || "",
      competitionType,
      championMemberId: champion?.memberId || "",
      championMemberName: champion?.memberName || "",
      relegatedMemberIds: relegated,
      absentMemberIds: absent,
      qualifiedMemberIds,
      rewards,
      autoPaidRewards: shouldPayRewards,
      paidRewardTransferIds: paidRewardTransfers,
      reversedRewardTransferIds,
      rewardsNeedReview: false,
      seasonId: competition.seasonId || activeSeasonId,
      createdBy: authUser?.uid || "",
      createdByMemberId: currentMemberId || "FIFA",
      createdByName: authProfile?.memberName || authProfile?.username || "FIFA",
      date: todayDate,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await addDoc(collection(db, "notifications"), {
      type: competitionType === "league_qualifier" ? "league_qualifier_completed" : competitionType === "cup" ? "cup_completed" : competitionType === "super_cup" ? "super_cup_completed" : competitionType === "world_cup" ? "world_cup_completed" : competitionType === "champions_league" ? "champions_league_completed" : "league_completed",
      title: competitionType === "league_qualifier" ? "تم اعتماد ملحق الدوري" : competitionType === "cup" ? "تم اعتماد بطولة الكأس" : competitionType === "super_cup" ? "تم اعتماد كأس السوبر" : competitionType === "world_cup" ? "تم اعتماد كأس العالم" : competitionType === "champions_league" ? "تم اعتماد دوري الأبطال" : "تم اعتماد نتيجة الدوري",
      body: "تم اعتماد " + (competition.name || typeLabel) + (champion?.memberName ? "، والبطل هو " + champion.memberName + "." : ".") + relegatedText + absentText + qualifiedText,
      status: "unread",
      audience: "all",
      fromMemberId: "FIFA",
      fromMemberName: "FIFA",
      source: "fifa_admin_competitions",
      relatedCompetitionId: competitionId,
      clickUrl: "/?fgPage=season&fgCompetitionId=" + encodeURIComponent(competitionId),
      createdBy: authUser?.uid || "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  async function cancelFifaCompetition({ competitionId, reason = "" }) {
    if (!isFifaAdmin) throw new Error("هذه الصلاحية مخصصة لحساب FIFA فقط.");
    const competition = firebaseCompetitions.find((item) => same(item.id, competitionId));
    if (!competition) throw new Error("البطولة غير موجودة.");
    if (clean(competition.status || "active") === "completed" && !["cup", "super_cup", "world_cup", "champions_league"].includes(competitionTypeKey(competition.type || "league"))) throw new Error("لا يمكن إلغاء بطولة معتمدة. استخدم سجل قرارات FIFA للتصحيح لاحقًا.");
    if (clean(competition.status || "active") === "cancelled") throw new Error("هذه البطولة ملغاة بالفعل.");
    const body = "تم إلغاء " + (competition.name || "البطولة") + (reason ? " - السبب: " + reason : " بقرار FIFA.");
    await deleteDoc(doc(db, "competitions", competitionId));
    await addDoc(collection(db, "adminDecisions"), {
      type: "competition_cancelled",
      status: "cancelled",
      title: "إلغاء بطولة",
      body,
      competitionId,
      competitionName: competition.name || "",
      competitionType: competition.type || "league",
      reason: reason || "إلغاء إداري من FIFA",
      createdBy: authUser?.uid || "",
      createdByMemberId: currentMemberId || "FIFA",
      createdByName: authProfile?.memberName || authProfile?.username || "FIFA",
      date: new Date().toISOString().slice(0, 10),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }


  function getActivePlayerContract(playerId) {
    const id = cleanId(playerId);
    if (!id) return null;
    return activePlayerContracts.find((contract) => same(contract.playerId, id)) || null;
  }

  function getPlayerBaseOwnerId(playerOrId) {
    const playerId = typeof playerOrId === "object" ? getPlayerStableId(playerOrId) : cleanId(playerOrId);
    const playerRow = typeof playerOrId === "object" ? playerOrId : players.find((item) => same(getPlayerStableId(item), playerId));
    const activeContract = getActivePlayerContract(playerId);
    return cleanId(activeContract?.baseOwnerMemberId || activeContract?.baseOwnerId || activeContract?.originalBaseOwnerMemberId || activeContract?.originalOwnerMemberId || playerRow?.memberid || playerRow?.memberId || playerRow?.member_id || "");
  }

  function getRosterPlayerKind(player, memberId) {
    const playerId = getPlayerStableId(player);
    const activeContract = getActivePlayerContract(playerId);
    return getRosterPlayerKindFromContract(player, activeContract, memberId);
  }

  function isProRosterKind(kind) {
    return kind === "pro_owned" || kind === "pro_loan";
  }

  function countMemberProPlayers(memberId) {
    const id = cleanId(memberId);
    if (!id) return 0;
    const uniqueProPlayerIds = new Set();
    getVisiblePlayersForMember(id).forEach((player) => {
      const playerId = cleanId(getPlayerStableId(player));
      if (!playerId || uniqueProPlayerIds.has(playerId)) return;
      const kind = getRosterPlayerKind(player, id);
      if (isProRosterKind(kind)) uniqueProPlayerIds.add(playerId);
    });
    return uniqueProPlayerIds.size;
  }

  function getOfferProjectedProDeltas(offer) {
    const buyerId = cleanId(offer?.fromMemberId);
    const sellerId = cleanId(offer?.toMemberId);
    const targetPlayerId = cleanId(offer?.targetPlayerId || offer?.playerId);
    const contractType = clean(offer?.type) === "loan" ? "loan" : "buy";
    const targetPlayerRow = players.find((player) => same(getPlayerStableId(player), targetPlayerId)) || {};
    const previousActiveContract = getActivePlayerContract(targetPlayerId);
    const baseOwnerId = cleanId(
      previousActiveContract?.baseOwnerMemberId ||
        previousActiveContract?.baseOwnerId ||
        previousActiveContract?.originalBaseOwnerMemberId ||
        previousActiveContract?.originalOwnerMemberId ||
        targetPlayerRow?.memberid ||
        sellerId
    );
    const targetFreeOrigin = isFreeOriginContract(previousActiveContract);
    const targetFreeSlotOwnerId = getFreeAgentSlotOwnerIdFromContract(previousActiveContract, targetFreeOrigin ? baseOwnerId || sellerId : "");

    const targetRosterKindForSeller = getRosterPlayerKindFromContract(targetPlayerRow, previousActiveContract, sellerId);
    const targetProLeavingSeller = isProRosterKind(targetRosterKindForSeller) ? 1 : 0;
    const targetProEnteringBuyer = (() => {
      if (contractType === "loan") return same(baseOwnerId, buyerId) ? 0 : 1;
      if (targetFreeOrigin && targetFreeSlotOwnerId && same(targetFreeSlotOwnerId, buyerId)) return 0;
      return baseOwnerId && !same(baseOwnerId, buyerId) ? 1 : 0;
    })();

    let offeredProLeavingBuyer = 0;
    let offeredProEnteringSeller = 0;
    const seenOfferedIds = new Set();
    (Array.isArray(offer?.offeredPlayers) ? offer.offeredPlayers : []).forEach((item) => {
      const playerId = cleanId(item.playerId || item.playerid || item.id);
      if (!playerId || seenOfferedIds.has(playerId)) return;
      seenOfferedIds.add(playerId);
      const row = players.find((player) => same(getPlayerStableId(player), playerId)) || {};
      const activeContract = getActivePlayerContract(playerId);
      const swapBaseOwnerId = cleanId(activeContract?.baseOwnerMemberId || activeContract?.baseOwnerId || activeContract?.originalBaseOwnerMemberId || activeContract?.originalOwnerMemberId || row?.memberid || buyerId);
      const swapFreeOrigin = isFreeOriginContract(activeContract);
      const swapFreeSlotOwnerId = getFreeAgentSlotOwnerIdFromContract(activeContract, swapFreeOrigin ? swapBaseOwnerId || buyerId : "");
      const currentKindForBuyer = getRosterPlayerKindFromContract(row, activeContract, buyerId);
      if (isProRosterKind(currentKindForBuyer)) offeredProLeavingBuyer += 1;
      if (swapFreeOrigin && swapFreeSlotOwnerId && same(swapFreeSlotOwnerId, sellerId)) return;
      if (swapBaseOwnerId && !same(swapBaseOwnerId, sellerId)) offeredProEnteringSeller += 1;
    });

    return {
      buyerId,
      sellerId,
      buyerDelta: targetProEnteringBuyer - offeredProLeavingBuyer,
      sellerDelta: offeredProEnteringSeller - targetProLeavingSeller,
      buyerEntering: targetProEnteringBuyer,
      sellerEntering: offeredProEnteringSeller,
    };
  }

  function getPendingAcceptedProDeltaForMember(memberId, excludedOfferId = "") {
    const id = cleanId(memberId);
    if (!id) return 0;
    return (firebasePlayerOffers || []).reduce((sum, offer) => {
      if (same(offer.id, excludedOfferId)) return sum;
      if (clean(offer.status || "") !== "approvedpendingwindow") return sum;
      const deltas = getOfferProjectedProDeltas(offer);
      if (same(deltas.buyerId, id)) return sum + deltas.buyerDelta;
      if (same(deltas.sellerId, id)) return sum + deltas.sellerDelta;
      return sum;
    }, 0);
  }

  function wouldOfferCreateProPlayer(targetPlayerId, buyerId) {
    const baseOwnerId = getPlayerBaseOwnerId(targetPlayerId);
    if (!baseOwnerId) return false;
    return !same(baseOwnerId, buyerId);
  }

  function isPlayerLockedByContract(playerId, requestedType = "") {
    const activeContract = getActivePlayerContract(playerId);
    if (!activeContract) return false;
    const contractType = clean(activeContract.contractType || "");
    if (contractType === "released") return true;
    if (contractType === "loan") {
      if (clean(requestedType) === "loan") return false;
      return true;
    }
    return false;
  }

  function isPlayerReleased(playerId) {
    return isPlayerReleasedByContracts(activePlayerContracts, playerId);
  }

  function hasFreeAgentRegistration(playerId, memberId) {
    const id = cleanId(playerId);
    const ownerId = cleanId(memberId);
    if (!id || !ownerId) return false;
    return firebaseFreeAgentRegistrations.some((item) =>
      same(item.playerId, id) &&
      same(item.memberId || item.toMemberId || item.currentMemberId, ownerId) &&
      !["cancelled", "reversed"].includes(clean(item.status || "completed"))
    );
  }

  function getFreePlayerStatusForMember(memberId) {
    const id = cleanId(memberId);
    if (!id) return null;
    return firebaseFreePlayerStatus.find((item) => same(item.memberId || item.id, id)) || null;
  }

  function getActiveFreeAgentContractForMember(memberId) {
    const id = cleanId(memberId);
    if (!id) return null;
    return activePlayerContracts.find((contract) =>
      same(contract.currentMemberId, id) &&
      isFreeOriginContract(contract) &&
      same(getFreeAgentSlotOwnerIdFromContract(contract, contract.originalOwnerMemberId || contract.ownerMemberId || id), id) &&
      clean(contract.contractType || "owned") === "owned"
    ) || null;
  }

  function getPendingFreeAgentQueueForMember(memberId) {
    const id = cleanId(memberId);
    if (!id) return null;
    return firebaseFreeAgentQueue.find((item) =>
      same(item.memberId, id) && ["pending_window", "processing"].includes(clean(item.status || "pending_window"))
    ) || null;
  }

  function isFreeAgentUnavailable(playerId, exceptQueueId = "") {
    const id = cleanId(playerId);
    if (!id) return true;
    const hasContract = activePlayerContracts.some((contract) =>
      same(contract.playerId, id) &&
      clean(contract.status || "active") === "active" &&
      !isFreeAgentPoolContract(contract)
    );
    if (hasContract) return true;
    return firebaseFreeAgentQueue.some((item) =>
      !same(item.id, exceptQueueId) &&
      same(item.newPlayerId, id) && ["pending_window", "processing"].includes(clean(item.status || "pending_window"))
    );
  }

  function getVisiblePlayersForMember(memberId, sourceRows = players) {
    const id = cleanId(memberId);
    if (!id) return [];
    return (sourceRows || []).filter((player) => {
      const playerId = getPlayerStableId(player);
      if (isPlayerReleased(playerId)) return false;
      const activeContract = getActivePlayerContract(playerId);
      const contractType = clean(activeContract?.contractType || "");
      if (activeContract && contractType !== "released") {
        return same(activeContract.currentMemberId, id);
      }
      return same(player.memberid, id);
    });
  }

  async function deactivateOfferNotifications(offerId, reason = "updated") {
    const id = cleanId(offerId);
    if (!id) return;
    const relatedRows = firebaseNotifications.filter((item) =>
      same(item.relatedOfferId, id) && !item.navigationDisabled
    );
    await Promise.allSettled(
      relatedRows.map((item) =>
        updateDoc(doc(db, "notifications", item.id), {
          navigationDisabled: true,
          disabledReason: reason,
          status: "read",
          readAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      )
    );
  }


  const selectedMember = selectedId
    ? members.find((member) => same(member.id, selectedId))
    : null;
  const selectedMemberId = cleanId(selectedMember?.id);

  const memberPlayers = useMemo(() => {
    const q = clean(search);
    return getVisiblePlayersForMember(selectedMemberId)
      .filter((player) => {
        if (!q) return true;
        const kindLabel = getPlayerRosterKindLabel(player, activePlayerContracts, selectedMemberId);
        return clean([
          player.name,
          player.position,
          player.team,
          player.rating,
          kindLabel,
          kindLabel.replace("لاعب ", ""),
        ].join(" ")).includes(q);
      })
      .sort((a, b) => toNumber(b.rating) - toNumber(a.rating));
  }, [players, selectedMemberId, search, activePlayerContracts]);

  const memberFinance = useMemo(
    () => getMemberFinanceRows(combinedFinance, selectedMemberId),
    [combinedFinance, selectedMemberId]
  );
  const selectedMemberBalance = useMemo(
    () => computeMemberBalance(memberFinance, selectedMember?.balance, selectedMemberId),
    [memberFinance, selectedMember?.balance, selectedMemberId]
  );
  const memberTrophyGroups = useMemo(
    () => groupMemberTrophies(allTournaments, selectedMemberId, trophyMap),
    [allTournaments, selectedMemberId, trophyMap]
  );
  const selectedMemberStats =
    finalStatsByMember[cleanId(selectedMemberId)] ||
    emptyMemberStats(selectedMemberId);
  const seasonGroups = useMemo(
    () => groupByTrophy(activeSeasonRows, trophyMap),
    [activeSeasonRows, trophyMap]
  );
  const archiveSeasons = useMemo(
    () => buildArchiveSeasons(seasons, allTournaments, trophyMap),
    [seasons, allTournaments, trophyMap]
  );
  const seasonRanking = useMemo(
    () => computeSeasonRanking(activeMembers, activeSeasonRows, trophyMap),
    [activeMembers, activeSeasonRows, trophyMap]
  );
  const firebaseTransferRows = useMemo(
    () => normalizeFirebaseTransferRows(firebaseTransferHistory),
    [firebaseTransferHistory]
  );
  const transferPeriods = useMemo(
    () => mergeTransferPeriods(getTransferPeriods(transfers), getTransferPeriods(firebaseTransferRows)),
    [transfers, firebaseTransferRows]
  );
  const activeTransferPeriod =
    transferPeriods.find((period) => same(period.id, transferPeriod)) ||
    transferPeriods[0];
  const currentTransfers = activeTransferPeriod?.rows || [];

  useEffect(() => {
    if (!authUser || !transferMarketOpen) return;
    const pendingItems = firebaseFreeAgentQueue.filter((item) =>
      clean(item.status || "pending_window") === "pending_window"
    );
    if (!pendingItems.length) return;
    pendingItems.forEach((item) => {
      executeFreeAgentQueueItem(item).catch((err) => {
        console.error("Free agent queue execution failed:", err);
      });
    });
  }, [authUser, transferMarketOpen, firebaseFreeAgentQueue, activePlayerContracts, players, combinedFinance]);

  const headerCoverImage = normalizeImageUrl(config.headerImage);
  const appIconImage = normalizeImageUrl(config.appIcon);

  useEffect(() => {
    requestAnimationFrame(() => {
      if (pendingScrollRef.current !== null) {
        const nextTop = pendingScrollRef.current;
        pendingScrollRef.current = null;
        scrollAppTo(nextTop, "auto");
        return;
      }
      scrollAppToTop("auto");
    });
  }, [page, selectedMemberId]);

  function getCurrentScrollTop() {
    const appNode = document.querySelector(".app");
    return appNode ? appNode.scrollTop : window.scrollY || 0;
  }

  function restoreScrollPosition(top) {
    const safeTop = Math.max(0, Number(top) || 0);
    pendingScrollRef.current = safeTop;
    restoringScrollRef.current = true;

    function applyRestore() {
      if (pendingScrollRef.current === null) {
        restoringScrollRef.current = false;
        return;
      }

      const nextTop = pendingScrollRef.current;
      const appNode = document.querySelector(".app");

      if (appNode) {
        appNode.style.scrollBehavior = "auto";
        appNode.scrollTop = nextTop;
        requestAnimationFrame(() => {
          appNode.scrollTop = nextTop;
          appNode.style.scrollBehavior = "";
          pendingScrollRef.current = null;
          restoringScrollRef.current = false;
        });
        return;
      }

      window.scrollTo(0, nextTop);
      pendingScrollRef.current = null;
      restoringScrollRef.current = false;
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(applyRestore);
    });
  }

  function openView(view) {
    const currentScrollTop = getCurrentScrollTop();
    try {
      window.history.pushState({ fifaGroupDetail: true }, "");
    } catch {}
    if (detailView) {
      setDetailStack((stack) => [
        ...stack,
        { view: detailView, scrollTop: currentScrollTop },
      ]);
    } else {
      baseScrollRef.current = currentScrollTop;
      setDetailStack([]);
    }
    setDetailView(view);
    setInfoModal(null);
    setMenuOpen(false);
    requestAnimationFrame(() => scrollAppToTop("auto"));
  }

  function closeView() {
    if (detailStack.length) {
      const previousEntry = detailStack[detailStack.length - 1];
      setDetailStack((stack) => stack.slice(0, -1));
      setDetailView(previousEntry.view);
      restoreScrollPosition(previousEntry.scrollTop);
    } else {
      setDetailView(null);
      restoreScrollPosition(baseScrollRef.current || 0);
    }
  }

  useEffect(() => {
    function setStableBounds() {
      const root = document.documentElement;
      const narrow = window.innerWidth <= 380;
      root.style.setProperty("--fg-top-bound", narrow ? "40px" : "44px");
      root.style.setProperty("--fg-bottom-bound", narrow ? "88px" : "92px");
      root.style.setProperty("--fg-nav-bottom", "10px");
      document.documentElement.style.overflow = "hidden";
      document.body.style.overflow = "hidden";
      document.body.style.background = "#020617";
    }

    setStableBounds();
    window.addEventListener("orientationchange", setStableBounds);
    return () =>
      window.removeEventListener("orientationchange", setStableBounds);
  }, []);

  function scrollAppTo(top = 0, behavior = "auto") {
    const safeTop = Math.max(0, Number(top) || 0);
    const appNode = document.querySelector(".app");

    if (appNode) {
      if (behavior === "smooth") {
        appNode.scrollTo({ top: safeTop, behavior });
      } else {
        appNode.style.scrollBehavior = "auto";
        appNode.scrollTop = safeTop;
        requestAnimationFrame(() => {
          appNode.style.scrollBehavior = "";
        });
      }
      return;
    }

    window.scrollTo({ top: safeTop, behavior });
  }

  function scrollAppToTop(behavior = "auto") {
    scrollAppTo(0, behavior);
  }

  function goPage(nextPage) {
    setPage(nextPage);
    setSelectedId("");
    setMemberTab("players");
    setSearch("");
    setMenuOpen(false);
    setDetailView(null);
    setDetailStack([]);
    setInfoModal(null);

    requestAnimationFrame(() => {
      scrollAppToTop("auto");
    });
  }

  async function createMoneyTransfer({ toMemberId, amount, note }) {
    const fromMemberId = cleanId(currentMemberId);
    const receiverId = cleanId(toMemberId);
    const numericAmount = parseFinanceAmount(amount);

    if (!authUser || !fromMemberId) throw new Error("لم يتم ربط الحساب بعضو بعد.");
    if (!receiverId) throw new Error("اختر العضو المستقبل.");
    if (same(fromMemberId, receiverId)) throw new Error("لا يمكن التحويل لنفس العضو.");
    if (!numericAmount || numericAmount <= 0) throw new Error("أدخل مبلغًا صحيحًا أكبر من صفر.");
    if (numericAmount > currentMemberBalance) throw new Error("الرصيد غير كافٍ لإتمام التحويل.");

    const receiver = getActiveMembers(members).find((member) => same(member.id, receiverId));
    if (!receiver) throw new Error("العضو المستقبل غير موجود ضمن أعضاء الموسم الحالي النشط.");

    const transferRef = await addDoc(collection(db, "moneyTransfers"), {
      fromMemberId,
      fromMemberName: currentMember?.name || authProfile?.memberName || "",
      toMemberId: receiverId,
      toMemberName: receiver.name || "",
      amount: numericAmount,
      type: "transfer",
      status: "approved",
      approvedBy: "system",
      createdBy: authUser.uid,
      username: authProfile?.username || "",
      note: String(note || "").trim() || "تحويل تلقائي من التطبيق",
      date: new Date().toISOString().slice(0, 10),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await Promise.allSettled([
      addDoc(collection(db, "notifications"), {
        type: "money_transfer_in",
        status: "unread",
        toMemberId: receiverId,
        fromMemberId,
        relatedMoneyTransferId: transferRef.id,
        financeMemberId: receiverId,
        clickUrl: "/?fgPage=finance&fgMemberId=" + encodeURIComponent(receiverId),
        title: "تحويل مالي وارد",
        body: "وصلك تحويل بقيمة " + formatMoney(numericAmount) + " من " + (currentMember?.name || authProfile?.memberName || "عضو") + ".",
        createdAt: serverTimestamp(),
      }),
      addDoc(collection(db, "notifications"), {
        type: "money_transfer_out",
        status: "unread",
        toMemberId: fromMemberId,
        fromMemberId,
        relatedMoneyTransferId: transferRef.id,
        financeMemberId: fromMemberId,
        clickUrl: "/?fgPage=finance&fgMemberId=" + encodeURIComponent(fromMemberId),
        title: "تحويل مالي صادر",
        body: "تم تحويل " + formatMoney(numericAmount) + " إلى " + (receiver.name || "عضو") + ".",
        createdAt: serverTimestamp(),
      }),
    ]);
  }


  async function createPlayerOffer(payload) {
    const fromMemberId = cleanId(currentMemberId);
    const targetMemberId = cleanId(payload?.targetMemberId);
    const targetPlayerId = cleanId(payload?.targetPlayerId);
    const contractType = clean(payload?.contractType) === "loan" ? "loan" : "buy";
    const numericAmount = Math.max(0, parseFinanceAmount(payload?.amount));
    const offeredPlayers = (Array.isArray(payload?.offeredPlayers) ? payload.offeredPlayers : []).map(normalizeOfferExchangeClauseForSave);
    const todayKey = new Date().toISOString().slice(0, 10);
    const expiresAt = addDays(new Date(), PLAYER_OFFER_EXPIRE_DAYS).toISOString();

    if (!authUser || !fromMemberId) throw new Error("لم يتم ربط الحساب بعضو بعد.");
    if (!targetMemberId || !targetPlayerId) throw new Error("بيانات اللاعب غير مكتملة.");
    assertTransferAllowed(fromMemberId, "send_offer");
    const targetReceiveRestriction = getBlockingTransferRestriction(firebaseMemberRestrictions, targetMemberId, "receive_offer");
    if (targetReceiveRestriction) {
      throw new Error("لا يمكنك إرسال العروض لهذا العضو بسبب إيقاف إداري من نظام الانتقالات حتى " + (targetReceiveRestriction.endDate || "نهاية المدة") + (targetReceiveRestriction.reason ? " - السبب: " + targetReceiveRestriction.reason : "."));
    }
    if (offeredPlayers.length) assertTransferAllowed(fromMemberId, "squad_change");
    if (same(fromMemberId, targetMemberId)) throw new Error("لا يمكنك تقديم عرض على لاعب من قائمتك.");
    if (contractType === "loan" && ![2, 4, 6].includes(toNumber(payload?.loanDurationMonths))) {
      throw new Error("اختر مدة عقد الإعارة.");
    }

    const targetMember = members.find((member) => same(member.id, targetMemberId));
    if (!targetMember) throw new Error("العضو صاحب اللاعب غير موجود.");

    const offeredPlayersCount = offeredPlayers.length;
    const targetMemberPlayerCount = getVisiblePlayersForMember(targetMemberId).length;
    const targetMemberCountAfterOffer = targetMemberPlayerCount - 1 + offeredPlayersCount;
    if (targetMemberCountAfterOffer < MIN_SQUAD_PLAYERS) {
      throw new Error("لا يمكن تقديم عرض يجعل قائمة صاحب اللاعب أقل من 17 لاعبًا بعد احتساب لاعبي التبادل.");
    }
    if (targetMemberCountAfterOffer > MAX_SQUAD_PLAYERS) {
      throw new Error("لا يمكن تقديم عرض يجعل قائمة صاحب اللاعب تتجاوز الحد الأقصى 32 لاعبًا.");
    }

    const fromMemberVisiblePlayers = getVisiblePlayersForMember(fromMemberId);
    const fromMemberPlayerCount = fromMemberVisiblePlayers.length;
    if (offeredPlayersCount > 0 && fromMemberPlayerCount - offeredPlayersCount < MIN_SQUAD_PLAYERS) {
      throw new Error("لا يمكن إدراج لاعبين من قائمتك في الصفقة إذا كان ذلك سيجعل قائمتك أقل من 17 لاعبًا.");
    }
    if (fromMemberPlayerCount - offeredPlayersCount + 1 > MAX_SQUAD_PLAYERS) {
      throw new Error("لا يمكن تقديم العرض لأن قائمتك ستتجاوز الحد الأقصى 32 لاعبًا.");
    }

    const fromMemberVisiblePlayerIds = new Set(fromMemberVisiblePlayers.map((player) => cleanId(getPlayerStableId(player))));
    const invalidOfferedPlayer = offeredPlayers.find((item) => !fromMemberVisiblePlayerIds.has(cleanId(item.playerId)));
    if (invalidOfferedPlayer) {
      throw new Error("لا يمكن إدراج لاعب غير موجود في قائمتك الحالية ضمن الصفقة.");
    }
    const duplicateOfferedPlayers = new Set();
    const duplicatedOfferedPlayer = offeredPlayers.find((item) => {
      const playerId = cleanId(item.playerId);
      if (!playerId) return true;
      if (duplicateOfferedPlayers.has(playerId)) return true;
      duplicateOfferedPlayers.add(playerId);
      return false;
    });
    if (duplicatedOfferedPlayer) {
      throw new Error("لا يمكن تكرار نفس اللاعب في صفقة التبادل.");
    }
    const loanedOfferedPlayer = offeredPlayers.find((item) => clean(getActivePlayerContract(item.playerId)?.contractType || "") === "loan");
    if (loanedOfferedPlayer) {
      throw new Error("لا يمكن إدراج لاعب تستعيره حاليًا ضمن بنود التبادل.");
    }

    const activeTargetContract = getActivePlayerContract(targetPlayerId);
    const activeTargetContractType = clean(activeTargetContract?.contractType || "");
    const playerLockedByAcceptedDeal = firebasePlayerOffers.some((offer) =>
      same(offer.targetPlayerId, targetPlayerId) && isAcceptedOrCompletedPlayerOffer(offer)
    );
    if (playerLockedByAcceptedDeal || isPlayerLockedByContract(targetPlayerId, contractType)) {
      throw new Error("لا يمكن تقديم عرض على هذا اللاعب لأنه مرتبط بصفقة أو عقد نشط.");
    }
    if (activeTargetContractType === "loan") {
      if (contractType !== "loan") throw new Error("اللاعب المعار يستقبل عروض إعارة فقط.");
      const requiredLoanMonths = toNumber(activeTargetContract.loanDurationMonths);
      if (requiredLoanMonths && toNumber(payload?.loanDurationMonths) !== requiredLoanMonths) {
        throw new Error("مدة إعادة الإعارة يجب أن تطابق مدة عقد الإعارة الأصلي.");
      }
    }

    const createsProPlayer = wouldOfferCreateProPlayer(targetPlayerId, fromMemberId);
    const offeredProLeavingCount = offeredPlayers.reduce((sum, item) => {
      const row = fromMemberVisiblePlayers.find((player) => same(getPlayerStableId(player), item.playerId));
      const kind = row ? getRosterPlayerKind(row, fromMemberId) : "base";
      return sum + (kind === "pro_owned" || kind === "pro_loan" ? 1 : 0);
    }, 0);
    const proCount = countMemberProPlayers(fromMemberId);
    // الحد الأقصى للمحترفين يُحسب من القائمة الفعلية الحالية فقط.
    // لا نضيف عروضًا قديمة/معلقة هنا حتى لا يبقى لاعب خرج من القائمة محسوبًا ضمن حد 5 محترفين.
    if (proCount - offeredProLeavingCount + (createsProPlayer ? 1 : 0) > MAX_PRO_PLAYERS) {
      throw new Error("لا يمكنك إتمام الصفقة، ستتجاوز الحد الأقصى للمحترفين (5) حسب قائمتك الحالية.");
    }

    const alreadyBlocking = firebasePlayerOffers.some((offer) =>
      same(offer.fromMemberId, fromMemberId) &&
      same(offer.targetPlayerId, targetPlayerId) &&
      isBlockingOwnPlayerOfferStillValid(offer)
    );
    if (alreadyBlocking) throw new Error("لديك عرض نشط أو مقبول سابق على نفس اللاعب.");

    const todayOffersCount = firebasePlayerOffers.filter((offer) =>
      same(offer.fromMemberId, fromMemberId) && String(offer.dateKey || "") === todayKey
    ).length;
    if (todayOffersCount >= MAX_DAILY_PLAYER_OFFERS) {
      throw new Error("وصلت للحد اليومي للعروض (" + MAX_DAILY_PLAYER_OFFERS + ").");
    }

    const neededNow = numericAmount + OFFER_FEE;
    if (neededNow > currentMemberAvailableBalance) {
      throw new Error("الرصيد المتاح لا يكفي لقيمة العرض مع رسوم التقديم.");
    }

    const offerRef = await addDoc(collection(db, "playerOffers"), {
      type: contractType,
      typeLabel: contractType === "loan" ? "عقد إعارة" : "عقد شراء",
      status: "pending",
      version: 1,
      editCount: 0,
      maxEdits: 1,
      fromMemberId,
      fromMemberName: currentMember?.name || authProfile?.memberName || "",
      toMemberId: targetMemberId,
      toMemberName: targetMember.name || "",
      targetPlayerId,
      targetPlayerName: payload?.targetPlayerName || "",
      targetPlayerImage: payload?.targetPlayerImage || "",
      targetPlayerPosition: payload?.targetPlayerPosition || "",
      targetPlayerRating: payload?.targetPlayerRating || "",
      amount: numericAmount,
      reservedAmount: numericAmount,
      offeredPlayers,
      loanDurationMonths: contractType === "loan" ? toNumber(payload?.loanDurationMonths) : null,
      notes: String(payload?.notes || "").trim(),
      feeAmount: OFFER_FEE,
      expiresAt,
      dateKey: todayKey,
      createdBy: authUser.uid,
      username: authProfile?.username || "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await addOfferFee({
      fromMemberId,
      relatedOfferId: offerRef.id,
      note: "رسوم تقديم عرض على اللاعب " + (payload?.targetPlayerName || ""),
      type: "offer_fee",
      dateKey: todayKey,
    });

    await addDoc(collection(db, "notifications"), {
      type: "player_offer",
      status: "unread",
      toMemberId: targetMemberId,
      fromMemberId,
      relatedOfferId: offerRef.id,
      targetPlayerId,
      targetMemberId,
      offerVersion: 1,
      targetStatus: "pending",
      navigationDisabled: false,
      title: "عرض انتقال جديد",
      body: (currentMember?.name || "عضو") + " قدم عرض " + (contractType === "loan" ? "عقد إعارة" : "عقد شراء") + " للاعب " + (payload?.targetPlayerName || "") + ".",
      createdAt: serverTimestamp(),
    });
  }

  async function updatePlayerOffer(offerId, payload) {
    const fromMemberId = cleanId(currentMemberId);
    const existing = firebasePlayerOffers.find((offer) => same(offer.id, offerId));
    if (!existing) throw new Error("العرض غير موجود.");
    if (!same(existing.fromMemberId, fromMemberId)) throw new Error("لا يمكنك تعديل عرض لا يخصك.");
    if (!isActivePlayerOfferStatus(existing.status) || isOfferExpired(existing)) throw new Error("لا يمكن تعديل هذا العرض.");
    if (toNumber(existing.editCount) >= toNumber(existing.maxEdits || 1)) throw new Error("تم استنفاد تعديل هذا العرض.");
    const playerLockedByOtherAcceptedDeal = firebasePlayerOffers.some((offer) =>
      !same(offer.id, existing.id) && same(offer.targetPlayerId, existing.targetPlayerId) && isAcceptedOrCompletedPlayerOffer(offer)
    );
    if (playerLockedByOtherAcceptedDeal || isPlayerLockedByContract(existing.targetPlayerId, payload?.contractType)) {
      throw new Error("لا يمكن تعديل العرض لأن اللاعب أصبح مرتبطًا بعقد نشط.");
    }

    const contractType = clean(payload?.contractType) === "loan" ? "loan" : "buy";
    assertTransferAllowed(fromMemberId, "send_offer");
    const existingTargetReceiveRestriction = getBlockingTransferRestriction(firebaseMemberRestrictions, existing.toMemberId, "receive_offer");
    if (existingTargetReceiveRestriction) {
      throw new Error("لا يمكنك إرسال العروض لهذا العضو بسبب إيقاف إداري من نظام الانتقالات حتى " + (existingTargetReceiveRestriction.endDate || "نهاية المدة") + (existingTargetReceiveRestriction.reason ? " - السبب: " + existingTargetReceiveRestriction.reason : "."));
    }
    const numericAmount = Math.max(0, parseFinanceAmount(payload?.amount));
    const offeredPlayers = (Array.isArray(payload?.offeredPlayers) ? payload.offeredPlayers : []).map(normalizeOfferExchangeClauseForSave);
    if (offeredPlayers.length) assertTransferAllowed(fromMemberId, "squad_change");
    const previousReserved = Math.max(0, toNumber(existing.reservedAmount ?? existing.amount));
    const availableForEdit = currentMemberAvailableBalance + previousReserved;

    const offeredPlayersCount = offeredPlayers.length;
    const targetMemberPlayerCount = getVisiblePlayersForMember(existing.toMemberId).length;
    const targetMemberCountAfterOffer = targetMemberPlayerCount - 1 + offeredPlayersCount;
    if (targetMemberCountAfterOffer < MIN_SQUAD_PLAYERS) {
      throw new Error("لا يمكن تعديل العرض لأنه سيجعل قائمة صاحب اللاعب أقل من 17 لاعبًا بعد احتساب التبادل.");
    }
    if (targetMemberCountAfterOffer > MAX_SQUAD_PLAYERS) {
      throw new Error("لا يمكن تعديل العرض لأنه سيجعل قائمة صاحب اللاعب تتجاوز الحد الأقصى 32 لاعبًا.");
    }

    const fromMemberVisiblePlayers = getVisiblePlayersForMember(fromMemberId);
    const fromMemberPlayerCount = fromMemberVisiblePlayers.length;
    if (offeredPlayersCount > 0 && fromMemberPlayerCount - offeredPlayersCount < MIN_SQUAD_PLAYERS) {
      throw new Error("لا يمكن إدراج لاعبين من قائمتك في الصفقة إذا كان ذلك سيجعل قائمتك أقل من 17 لاعبًا.");
    }
    if (fromMemberPlayerCount - offeredPlayersCount + 1 > MAX_SQUAD_PLAYERS) {
      throw new Error("لا يمكن تعديل العرض لأن قائمتك ستتجاوز الحد الأقصى 32 لاعبًا.");
    }

    const fromMemberVisiblePlayerIds = new Set(fromMemberVisiblePlayers.map((player) => cleanId(getPlayerStableId(player))));
    const invalidOfferedPlayer = offeredPlayers.find((item) => !fromMemberVisiblePlayerIds.has(cleanId(item.playerId)));
    if (invalidOfferedPlayer) {
      throw new Error("لا يمكن إدراج لاعب غير موجود في قائمتك الحالية ضمن الصفقة.");
    }
    const duplicateOfferedPlayers = new Set();
    const duplicatedOfferedPlayer = offeredPlayers.find((item) => {
      const playerId = cleanId(item.playerId);
      if (!playerId) return true;
      if (duplicateOfferedPlayers.has(playerId)) return true;
      duplicateOfferedPlayers.add(playerId);
      return false;
    });
    if (duplicatedOfferedPlayer) {
      throw new Error("لا يمكن تكرار نفس اللاعب في صفقة التبادل.");
    }
    const loanedOfferedPlayer = offeredPlayers.find((item) => clean(getActivePlayerContract(item.playerId)?.contractType || "") === "loan");
    if (loanedOfferedPlayer) {
      throw new Error("لا يمكن إدراج لاعب تستعيره حاليًا ضمن بنود التبادل.");
    }

    const createsProPlayer = wouldOfferCreateProPlayer(existing.targetPlayerId, fromMemberId);
    const offeredProLeavingCount = offeredPlayers.reduce((sum, item) => {
      const row = fromMemberVisiblePlayers.find((player) => same(getPlayerStableId(player), item.playerId));
      const kind = row ? getRosterPlayerKind(row, fromMemberId) : "base";
      return sum + (kind === "pro_owned" || kind === "pro_loan" ? 1 : 0);
    }, 0);
    if (countMemberProPlayers(fromMemberId) - offeredProLeavingCount + (createsProPlayer ? 1 : 0) > MAX_PRO_PLAYERS) {
      throw new Error("لا يمكن تعديل العرض لأنه سيتجاوز الحد الأقصى للمحترفين (5) حسب قائمتك الحالية.");
    }

    if (contractType === "loan" && ![2, 4, 6].includes(toNumber(payload?.loanDurationMonths))) {
      throw new Error("اختر مدة عقد الإعارة.");
    }
    if (numericAmount + OFFER_FEE > availableForEdit) {
      throw new Error("الرصيد المتاح لا يكفي لتعديل العرض مع رسوم التعديل.");
    }

    const nextVersion = toNumber(existing.version || 1) + 1;
    await deactivateOfferNotifications(offerId, "offer_updated");

    await updateDoc(doc(db, "playerOffers", offerId), {
      type: contractType,
      typeLabel: contractType === "loan" ? "عقد إعارة" : "عقد شراء",
      amount: numericAmount,
      reservedAmount: numericAmount,
      offeredPlayers,
      loanDurationMonths: contractType === "loan" ? toNumber(payload?.loanDurationMonths) : null,
      notes: String(payload?.notes || "").trim(),
      editCount: toNumber(existing.editCount) + 1,
      version: nextVersion,
      updatedAt: serverTimestamp(),
      lastEditedAt: serverTimestamp(),
    });

    await addOfferFee({
      fromMemberId,
      relatedOfferId: offerId,
      note: "رسوم تعديل عرض اللاعب " + (existing.targetPlayerName || ""),
      type: "offer_edit_fee",
      dateKey: new Date().toISOString().slice(0, 10),
    });

    await addDoc(collection(db, "notifications"), {
      type: "player_offer_updated",
      status: "unread",
      toMemberId: existing.toMemberId,
      fromMemberId,
      relatedOfferId: offerId,
      targetPlayerId: existing.targetPlayerId || "",
      targetMemberId: existing.toMemberId || "",
      offerVersion: nextVersion,
      targetStatus: "pending",
      navigationDisabled: false,
      title: "تم تعديل عرض انتقال",
      body: (currentMember?.name || "عضو") + " عدّل عرضه على اللاعب " + (existing.targetPlayerName || "") + ".",
      createdAt: serverTimestamp(),
    });
  }

  async function cancelPlayerOffer(offerId) {
    const fromMemberId = cleanId(currentMemberId);
    const existing = firebasePlayerOffers.find((offer) => same(offer.id, offerId));
    if (!existing) throw new Error("العرض غير موجود.");
    if (!same(existing.fromMemberId, fromMemberId)) throw new Error("لا يمكنك إلغاء عرض لا يخصك.");
    if (!isActivePlayerOfferStatus(existing.status) || isOfferExpired(existing)) throw new Error("لا يمكن إلغاء هذا العرض.");

    await deactivateOfferNotifications(offerId, "offer_cancelled");

    await updateDoc(doc(db, "playerOffers", offerId), {
      status: "cancelledByBuyer",
      cancelledAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await addDoc(collection(db, "notifications"), {
      type: "player_offer_cancelled",
      status: "unread",
      toMemberId: existing.toMemberId,
      fromMemberId,
      relatedOfferId: offerId,
      targetPlayerId: existing.targetPlayerId || "",
      targetMemberId: existing.toMemberId || "",
      offerVersion: toNumber(existing.version || 1),
      targetStatus: "cancelledByBuyer",
      navigationDisabled: true,
      title: "تم إلغاء عرض",
      body: (currentMember?.name || "عضو") + " ألغى عرضه على اللاعب " + (existing.targetPlayerName || "") + ".",
      createdAt: serverTimestamp(),
    });
  }

  async function acceptPlayerOffer(offerId) {
    const ownerId = cleanId(currentMemberId);
    const existing = firebasePlayerOffers.find((offer) => same(offer.id, offerId));
    if (!existing) throw new Error("العرض غير موجود.");
    if (!same(existing.toMemberId, ownerId)) throw new Error("لا يمكنك قبول عرض لا يخص لاعبك.");
    if (!isActivePlayerOfferStatus(existing.status) || isOfferExpired(existing)) throw new Error("لا يمكن قبول هذا العرض.");

    const buyerId = cleanId(existing.fromMemberId);
    const sellerId = cleanId(existing.toMemberId);
    assertTransferAllowed(sellerId, "squad_change");
    assertTransferAllowed(buyerId, "squad_change");
    assertTransferAllowed(sellerId, "receive_offer");
    const numericAmount = Math.max(0, toNumber(existing.amount));
    const contractType = clean(existing.type) === "loan" ? "loan" : "buy";
    const nextStatus = transferMarketOpen ? "completed" : "approvedPendingWindow";
    const targetPlayerId = cleanId(existing.targetPlayerId || existing.playerId);
    const targetPlayerRow = players.find((player) => same(getPlayerStableId(player), targetPlayerId));
    if (!buyerId || !sellerId || !targetPlayerId) throw new Error("بيانات العرض غير مكتملة.");

    const previousActiveContract = getActivePlayerContract(targetPlayerId);
    const previousActiveContractType = clean(previousActiveContract?.contractType || "");
    if (previousActiveContractType === "released") throw new Error("لا يمكن قبول العرض لأن اللاعب خارج اللعبة.");

    const baseOwnerId = cleanId(
      previousActiveContract?.baseOwnerMemberId ||
        previousActiveContract?.baseOwnerId ||
        previousActiveContract?.originalBaseOwnerMemberId ||
        previousActiveContract?.originalOwnerMemberId ||
        targetPlayerRow?.memberid ||
        sellerId
    );
    const baseOwner = members.find((member) => same(member.id, baseOwnerId));
    const baseOwnerName = previousActiveContract?.baseOwnerMemberName || previousActiveContract?.originalBaseOwnerMemberName || baseOwner?.name || previousActiveContract?.originalOwnerMemberName || existing.toMemberName || currentMember?.name || "";
    const sourceOwnerId = cleanId(previousActiveContract?.currentMemberId || sellerId);
    const sourceOwnerName = previousActiveContract?.currentMemberName || existing.toMemberName || currentMember?.name || "";
    const loanRealOwnerId = previousActiveContractType === "loan"
      ? cleanId(previousActiveContract?.originalOwnerMemberId || previousActiveContract?.ownerMemberId || baseOwnerId || sellerId)
      : sourceOwnerId;
    const loanRealOwnerName = previousActiveContractType === "loan"
      ? (previousActiveContract?.originalOwnerMemberName || previousActiveContract?.ownerMemberName || baseOwnerName || sourceOwnerName)
      : sourceOwnerName;
    if (sourceOwnerId && !same(sourceOwnerId, sellerId)) {
      throw new Error("لا يمكن قبول العرض لأن ملكية اللاعب تغيرت بعد تقديم العرض.");
    }

    const offeredPlayersRaw = Array.isArray(existing.offeredPlayers) ? existing.offeredPlayers : [];
    const buyerVisiblePlayers = getVisiblePlayersForMember(buyerId);
    const buyerVisibleMap = new Map(
      buyerVisiblePlayers.map((player) => [cleanId(getPlayerStableId(player)), player])
    );
    const offeredPlayerIds = new Set();
    const offeredPlayers = offeredPlayersRaw.map((item) => {
      const playerId = cleanId(item.playerId || item.playerid || item.id);
      if (!playerId) throw new Error("يوجد لاعب غير مكتمل في صفقة التبادل.");
      if (same(playerId, targetPlayerId)) throw new Error("لا يمكن إدراج نفس اللاعب المستهدف ضمن لاعبي التبادل.");
      if (offeredPlayerIds.has(playerId)) throw new Error("لا يمكن تكرار نفس اللاعب في صفقة التبادل.");
      offeredPlayerIds.add(playerId);
      const row = buyerVisibleMap.get(playerId) || players.find((player) => same(getPlayerStableId(player), playerId));
      if (!row || !buyerVisibleMap.has(playerId)) {
        throw new Error("لا يمكن قبول العرض لأن أحد لاعبي التبادل لم يعد في قائمة مقدم العرض.");
      }
      const activeContract = getActivePlayerContract(playerId);
      const activeType = clean(activeContract?.contractType || "");
      if (activeType === "released") throw new Error("لا يمكن إدراج لاعب تم الاستغناء عنه ضمن التبادل.");
      if (activeType === "loan") throw new Error("لا يمكن قبول العرض لأن أحد لاعبي التبادل معار حاليًا لدى مقدم العرض.");
      if (activeContract && !same(activeContract.currentMemberId, buyerId)) {
        throw new Error("لا يمكن قبول العرض لأن ملكية أحد لاعبي التبادل تغيرت.");
      }
      const exchangeContractType = normalizeExchangeContractType(item.exchangeContractType || item.swapContractType || item.contractMode);
      const exchangeLoanDurationMonths = exchangeContractType === "loan" ? normalizeExchangeLoanDuration(item.exchangeLoanDurationMonths || item.loanDurationMonths) : null;
      return {
        ...item,
        row,
        activeContract,
        playerId,
        exchangeContractType,
        exchangeLoanDurationMonths,
        exchangeTypeLabel: exchangeContractType === "loan" ? "إعارة" : "بيع كامل",
        playerName: item.playerName || row.name || "",
        playerImage: item.playerImage || item.image || row.image || "",
        playerPosition: item.playerPosition || item.position || row.position || "",
        playerRating: item.playerRating || item.rating || row.rating || "",
      };
    });

    const sellerPlayerCount = getVisiblePlayersForMember(sellerId).length;
    const buyerPlayerCount = buyerVisiblePlayers.length;
    const sellerCountAfterDeal = sellerPlayerCount - 1 + offeredPlayers.length;
    const buyerCountAfterDeal = buyerPlayerCount - offeredPlayers.length + 1;
    if (sellerCountAfterDeal < MIN_SQUAD_PLAYERS) {
      throw new Error("لا يمكن قبول العرض لأن قائمة العضو لا يجوز أن تقل عن 17 لاعبًا بعد الصفقة.");
    }
    if (sellerCountAfterDeal > MAX_SQUAD_PLAYERS) {
      throw new Error("لا يمكن قبول العرض لأن قائمة صاحب اللاعب ستتجاوز الحد الأقصى 32 لاعبًا بعد الصفقة.");
    }
    if (buyerCountAfterDeal < MIN_SQUAD_PLAYERS) {
      throw new Error("لا يمكن قبول العرض لأن قائمة مقدم العرض ستصبح أقل من 17 لاعبًا بعد الصفقة.");
    }
    if (buyerCountAfterDeal > MAX_SQUAD_PLAYERS) {
      throw new Error("لا يمكن قبول العرض لأن قائمة مقدم العرض ستتجاوز الحد الأقصى 32 لاعبًا بعد الصفقة.");
    }

    const targetFreeOrigin = isFreeOriginContract(previousActiveContract);
    const targetFreeSlotOwnerId = getFreeAgentSlotOwnerIdFromContract(previousActiveContract, targetFreeOrigin ? baseOwnerId || sellerId : "");
    const targetRosterKindForSeller = getRosterPlayerKindFromContract(targetPlayerRow || {}, previousActiveContract, sellerId);
    const targetProLeavingSeller = isProRosterKind(targetRosterKindForSeller) ? 1 : 0;
    const targetProEnteringBuyer = (() => {
      if (contractType === "loan") return same(baseOwnerId, buyerId) ? 0 : 1;
      if (targetFreeOrigin && targetFreeSlotOwnerId && same(targetFreeSlotOwnerId, buyerId)) return 0;
      return baseOwnerId && !same(baseOwnerId, buyerId) ? 1 : 0;
    })();

    let offeredProLeavingBuyer = 0;
    let offeredProEnteringSeller = 0;
    offeredPlayers.forEach((item) => {
      const swapBaseOwnerId = cleanId(item.activeContract?.baseOwnerMemberId || item.activeContract?.baseOwnerId || item.activeContract?.originalBaseOwnerMemberId || item.activeContract?.originalOwnerMemberId || item.row?.memberid || buyerId);
      const swapFreeOrigin = isFreeOriginContract(item.activeContract);
      const swapFreeSlotOwnerId = getFreeAgentSlotOwnerIdFromContract(item.activeContract, swapFreeOrigin ? swapBaseOwnerId || buyerId : "");
      const currentKindForBuyer = getRosterPlayerKindFromContract(item.row, item.activeContract, buyerId);
      if (isProRosterKind(currentKindForBuyer)) offeredProLeavingBuyer += 1;
      if (swapFreeOrigin && swapFreeSlotOwnerId && same(swapFreeSlotOwnerId, sellerId)) return;
      if (swapBaseOwnerId && !same(swapBaseOwnerId, sellerId)) offeredProEnteringSeller += 1;
    });

    const buyerPendingProDelta = getPendingAcceptedProDeltaForMember(buyerId, offerId);
    const sellerPendingProDelta = getPendingAcceptedProDeltaForMember(sellerId, offerId);
    const buyerProAfterDeal = countMemberProPlayers(buyerId) + buyerPendingProDelta - offeredProLeavingBuyer + targetProEnteringBuyer;
    const sellerProAfterDeal = countMemberProPlayers(sellerId) + sellerPendingProDelta - targetProLeavingSeller + offeredProEnteringSeller;
    if (buyerProAfterDeal > MAX_PRO_PLAYERS) {
      throw new Error("لا يمكن قبول العرض لأن مقدم العرض سيتجاوز الحد الأقصى للمحترفين (5) بعد احتساب الصفقات المعلقة.");
    }
    if (sellerProAfterDeal > MAX_PRO_PLAYERS) {
      throw new Error("لا يمكن قبول العرض لأن صاحب اللاعب سيتجاوز الحد الأقصى للمحترفين (5) بسبب لاعبي التبادل أو الصفقات المعلقة.");
    }

    await deactivateOfferNotifications(offerId, "offer_accepted");

    const acceptanceDate = new Date();
    const acceptanceDateKey = acceptanceDate.toISOString().slice(0, 10);

    await updateDoc(doc(db, "playerOffers", offerId), {
      status: nextStatus,
      approvedAt: serverTimestamp(),
      completedAt: transferMarketOpen ? serverTimestamp() : null,
      approvedByMemberId: ownerId,
      marketWasOpenAtApproval: transferMarketOpen,
      paymentDueAtApproval: numericAmount > 0,
      paymentTransferredAtApproval: numericAmount > 0,
      paymentTransferredAt: numericAmount > 0 ? serverTimestamp() : null,
      paymentTransferDate: numericAmount > 0 ? acceptanceDateKey : null,
      updatedAt: serverTimestamp(),
    });

    const competingOffers = firebasePlayerOffers.filter((offer) =>
      !same(offer.id, offerId) &&
      same(offer.targetPlayerId, existing.targetPlayerId) &&
      clean(offer.status || "pending") === "pending" &&
      !isOfferExpired(offer)
    );

    await Promise.allSettled(
      competingOffers.map(async (offer) => {
        await deactivateOfferNotifications(offer.id, "player_offer_closed");
        await updateDoc(doc(db, "playerOffers", offer.id), {
          status: "cancelledBecausePlayerUnavailable",
          cancelledAt: serverTimestamp(),
          cancelledReason: "تم قبول عرض آخر على نفس اللاعب",
          updatedAt: serverTimestamp(),
        });
        await addDoc(collection(db, "notifications"), {
          type: "player_offer_closed",
          status: "unread",
          toMemberId: offer.fromMemberId,
          fromMemberId: ownerId,
          relatedOfferId: offer.id,
          targetPlayerId: offer.targetPlayerId || "",
          targetMemberId: ownerId,
          offerVersion: toNumber(offer.version || 1),
          targetStatus: "cancelledBecausePlayerUnavailable",
          navigationDisabled: true,
          title: "تم إغلاق عرضك",
          body: "تم قبول عرض آخر على اللاعب " + (offer.targetPlayerName || "") + "، لذلك أُغلق عرضك تلقائيًا.",
          createdAt: serverTimestamp(),
        });
      })
    );

    if (!transferMarketOpen) {
      if (numericAmount > 0) {
        await addDoc(collection(db, "moneyTransfers"), {
          fromMemberId: buyerId,
          fromMemberName: existing.fromMemberName || "",
          toMemberId: sellerId,
          toMemberName: existing.toMemberName || currentMember?.name || "",
          amount: numericAmount,
          type: "player_offer_payment",
          status: "approved",
          approvedBy: ownerId,
          relatedOfferId: offerId,
          note: "قيمة عرض اللاعب " + (existing.targetPlayerName || "") + " - تم تحويلها فور قبول الصفقة بانتظار فتح السوق",
          date: acceptanceDateKey,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      await Promise.allSettled([
        addDoc(collection(db, "notifications"), {
          type: "player_offer_accepted_pending_window",
          status: "unread",
          toMemberId: buyerId,
          fromMemberId: sellerId,
          relatedOfferId: offerId,
          targetPlayerId,
          targetMemberId: sellerId,
          title: "تم قبول عرضك بانتظار السوق",
          body: "تم قبول عرضك للاعب " + (existing.targetPlayerName || "") + "، ولن ينتقل اللاعب أو تتحدث القوائم إلا عند فتح سوق الانتقالات.",
          createdAt: serverTimestamp(),
        }),
        addDoc(collection(db, "notifications"), {
          type: "player_offer_accepted_pending_window",
          status: "unread",
          toMemberId: sellerId,
          fromMemberId: buyerId,
          relatedOfferId: offerId,
          targetPlayerId,
          targetMemberId: sellerId,
          title: "صفقة مقبولة بانتظار السوق",
          body: "تم اعتماد قبول عرض " + (existing.targetPlayerName || "") + "، وستنفذ الصفقة عند فتح سوق الانتقالات فقط.",
          createdAt: serverTimestamp(),
        }),
      ]);
      return;
    }

    const loanMonths = contractType === "loan" ? toNumber(existing.loanDurationMonths) : null;
    const nowDate = new Date();
    const todayDateKey = nowDate.toISOString().slice(0, 10);
    const loanEndDate = loanMonths
      ? new Date(nowDate.getFullYear(), nowDate.getMonth() + loanMonths, nowDate.getDate()).toISOString().slice(0, 10)
      : null;

    if (previousActiveContract?.id) {
      await updateDoc(doc(db, "playerContracts", previousActiveContract.id), {
        status: "replaced",
        replacedByOfferId: offerId,
        replacedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    if (targetFreeOrigin && targetFreeSlotOwnerId && same(targetFreeSlotOwnerId, sellerId) && !same(targetFreeSlotOwnerId, buyerId)) {
      await setDoc(doc(db, "freePlayerStatus", sellerId), {
        memberId: toNumber(sellerId),
        hasUsedFreeSlot: true,
        currentFreePlayerId: "",
        currentFreePlayerName: "",
        lostFreePlayerId: targetPlayerId,
        lostFreePlayerName: existing.targetPlayerName || targetPlayerRow?.name || "",
        lostFreePlayerAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
    }

    const newContractPayload = {
      status: "active",
      playerId: targetPlayerId,
      playerName: existing.targetPlayerName || targetPlayerRow?.name || "",
      playerImage: existing.targetPlayerImage || targetPlayerRow?.image || "",
      playerPosition: existing.targetPlayerPosition || targetPlayerRow?.position || "",
      playerRating: existing.targetPlayerRating || targetPlayerRow?.rating || "",
      ownerMemberId: contractType === "loan" ? loanRealOwnerId : buyerId,
      ownerMemberName: contractType === "loan" ? loanRealOwnerName : (existing.fromMemberName || getMemberName(members, buyerId)),
      originalOwnerMemberId: contractType === "loan" ? loanRealOwnerId : baseOwnerId,
      originalOwnerMemberName: contractType === "loan" ? loanRealOwnerName : baseOwnerName,
      baseOwnerMemberId: baseOwnerId,
      baseOwnerMemberName: baseOwnerName,
      currentMemberId: buyerId,
      currentMemberName: existing.fromMemberName || getMemberName(members, buyerId),
      previousMemberId: sourceOwnerId,
      previousMemberName: sourceOwnerName,
      contractType: contractType === "loan" ? "loan" : "owned",
      rosterType: getRosterKindCode({ contractType: contractType === "loan" ? "loan" : "owned", originalOwnerMemberId: baseOwnerId, currentMemberId: buyerId, freeAgent: targetFreeOrigin && same(targetFreeSlotOwnerId, buyerId) }),
      isFreeOrigin: targetFreeOrigin,
      freeAgentOrigin: targetFreeOrigin,
      freeAgentSlotOwnerMemberId: targetFreeSlotOwnerId || "",
      sourceOfferId: offerId,
      amount: numericAmount,
      loanAmount: contractType === "loan" ? numericAmount : 0,
      loanDurationMonths: loanMonths,
      loanStartDate: transferMarketOpen ? todayDateKey : null,
      loanEndDate: transferMarketOpen ? loanEndDate : null,
      pendingWindow: !transferMarketOpen,
      marketWasOpenAtApproval: transferMarketOpen,
      createdBy: ownerId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await addDoc(collection(db, "playerContracts"), newContractPayload);

    if (targetFreeOrigin && targetFreeSlotOwnerId && same(targetFreeSlotOwnerId, buyerId)) {
      await setDoc(doc(db, "freePlayerStatus", buyerId), {
        memberId: toNumber(buyerId),
        hasUsedFreeSlot: false,
        currentFreePlayerId: targetPlayerId,
        currentFreePlayerName: existing.targetPlayerName || targetPlayerRow?.name || "",
        returnedFreePlayerAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
    }

    const enrichedOfferedPlayers = [];
    for (const item of offeredPlayers) {
      const swapBaseOwnerId = cleanId(item.activeContract?.baseOwnerMemberId || item.activeContract?.baseOwnerId || item.activeContract?.originalBaseOwnerMemberId || item.activeContract?.originalOwnerMemberId || item.row?.memberid || buyerId);
      const swapBaseOwner = members.find((member) => same(member.id, swapBaseOwnerId));
      const swapBaseOwnerName = item.activeContract?.baseOwnerMemberName || item.activeContract?.originalBaseOwnerMemberName || item.activeContract?.originalOwnerMemberName || swapBaseOwner?.name || getMemberName(members, swapBaseOwnerId) || existing.fromMemberName || "";
      const swapSourceOwnerId = cleanId(item.activeContract?.currentMemberId || buyerId);
      const swapSourceOwnerName = item.activeContract?.currentMemberName || existing.fromMemberName || getMemberName(members, buyerId) || "";
      const swapFreeOrigin = isFreeOriginContract(item.activeContract);
      const swapFreeSlotOwnerId = getFreeAgentSlotOwnerIdFromContract(item.activeContract, swapFreeOrigin ? swapBaseOwnerId || buyerId : "");
      const exchangeContractType = normalizeExchangeContractType(item.exchangeContractType);
      const exchangeLoanMonths = exchangeContractType === "loan" ? normalizeExchangeLoanDuration(item.exchangeLoanDurationMonths) : null;
      const exchangeLoanEndDate = exchangeLoanMonths
        ? new Date(nowDate.getFullYear(), nowDate.getMonth() + exchangeLoanMonths, nowDate.getDate()).toISOString().slice(0, 10)
        : null;
      const exchangeOwnerId = exchangeContractType === "loan" ? swapSourceOwnerId : sellerId;
      const exchangeOwnerName = exchangeContractType === "loan" ? swapSourceOwnerName : (existing.toMemberName || getMemberName(members, sellerId));
      const exchangeOriginalOwnerId = exchangeContractType === "loan" ? swapSourceOwnerId : swapBaseOwnerId;
      const exchangeOriginalOwnerName = exchangeContractType === "loan" ? swapSourceOwnerName : swapBaseOwnerName;

      if (item.activeContract?.id) {
        await updateDoc(doc(db, "playerContracts", item.activeContract.id), {
          status: "replaced_exchange",
          replacedByOfferId: offerId,
          replacedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      if (swapFreeOrigin && swapFreeSlotOwnerId && same(swapFreeSlotOwnerId, buyerId) && !same(swapFreeSlotOwnerId, sellerId)) {
        await setDoc(doc(db, "freePlayerStatus", buyerId), {
          memberId: toNumber(buyerId),
          hasUsedFreeSlot: true,
          currentFreePlayerId: "",
          currentFreePlayerName: "",
          lostFreePlayerId: item.playerId,
          lostFreePlayerName: item.playerName || "",
          lostFreePlayerAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }, { merge: true });
      }

      await addDoc(collection(db, "playerContracts"), {
        status: "active",
        contractType: exchangeContractType === "loan" ? "loan" : "owned",
        playerId: item.playerId,
        playerName: item.playerName || "",
        playerImage: item.playerImage || "",
        playerPosition: item.playerPosition || "",
        playerRating: item.playerRating || "",
        ownerMemberId: exchangeOwnerId,
        ownerMemberName: exchangeOwnerName,
        originalOwnerMemberId: exchangeOriginalOwnerId,
        originalOwnerMemberName: exchangeOriginalOwnerName,
        baseOwnerMemberId: swapBaseOwnerId,
        baseOwnerMemberName: swapBaseOwnerName,
        currentMemberId: sellerId,
        currentMemberName: existing.toMemberName || getMemberName(members, sellerId),
        previousMemberId: swapSourceOwnerId,
        previousMemberName: swapSourceOwnerName,
        contractTypeLabel: exchangeContractType === "loan" ? ("تبادل - إعارة " + loanDurationLabel(exchangeLoanMonths)) : "تبادل - بيع كامل",
        rosterType: getRosterKindCode({ contractType: exchangeContractType === "loan" ? "loan" : "owned", originalOwnerMemberId: exchangeOriginalOwnerId, currentMemberId: sellerId, freeAgent: swapFreeOrigin && same(swapFreeSlotOwnerId, sellerId) }),
        isFreeOrigin: swapFreeOrigin,
        freeAgentOrigin: swapFreeOrigin,
        freeAgentSlotOwnerMemberId: swapFreeSlotOwnerId || "",
        sourceOfferId: offerId,
        source: "exchange_player",
        exchangeContractType,
        exchangeLoanDurationMonths: exchangeLoanMonths,
        amount: 0,
        loanAmount: 0,
        loanDurationMonths: exchangeLoanMonths,
        loanStartDate: exchangeContractType === "loan" ? todayDateKey : null,
        loanEndDate: exchangeContractType === "loan" ? exchangeLoanEndDate : null,
        marketWasOpenAtApproval: transferMarketOpen,
        createdBy: ownerId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      if (swapFreeOrigin && swapFreeSlotOwnerId && same(swapFreeSlotOwnerId, sellerId)) {
        await setDoc(doc(db, "freePlayerStatus", sellerId), {
          memberId: toNumber(sellerId),
          hasUsedFreeSlot: false,
          currentFreePlayerId: item.playerId,
          currentFreePlayerName: item.playerName || "",
          returnedFreePlayerAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        }, { merge: true });
      }

      enrichedOfferedPlayers.push({
        playerId: item.playerId,
        playerName: item.playerName || "",
        playerImage: item.playerImage || "",
        playerPosition: item.playerPosition || "",
        playerRating: item.playerRating || "",
        fromMemberId: buyerId,
        fromMemberName: existing.fromMemberName || getMemberName(members, buyerId),
        toMemberId: sellerId,
        toMemberName: existing.toMemberName || getMemberName(members, sellerId),
        exchangeContractType,
        exchangeLoanDurationMonths: exchangeLoanMonths,
        exchangeTypeLabel: exchangeContractType === "loan" ? "إعارة" : "بيع كامل",
        originalOwnerMemberId: swapBaseOwnerId,
        originalOwnerMemberName: swapBaseOwnerName,
        isFreeOrigin: swapFreeOrigin,
        freeAgentSlotOwnerMemberId: swapFreeSlotOwnerId || "",
      });
    }

    const transferHistoryPayload = {
      status: nextStatus,
      type: contractType === "loan" ? "loan" : "buy",
      typeLabel: contractType === "loan" ? "عقد إعارة" : (enrichedOfferedPlayers.length ? "عقد شراء + تبادل" : "عقد شراء"),
      playerId: targetPlayerId,
      playerName: existing.targetPlayerName || targetPlayerRow?.name || "",
      playerImage: existing.targetPlayerImage || targetPlayerRow?.image || "",
      playerPosition: existing.targetPlayerPosition || targetPlayerRow?.position || "",
      playerRating: existing.targetPlayerRating || targetPlayerRow?.rating || "",
      fromMemberId: sourceOwnerId,
      fromMemberName: sourceOwnerName,
      toMemberId: buyerId,
      toMemberName: existing.fromMemberName || getMemberName(members, buyerId),
      originalOwnerMemberId: contractType === "loan" ? loanRealOwnerId : baseOwnerId,
      originalOwnerMemberName: contractType === "loan" ? loanRealOwnerName : baseOwnerName,
      baseOwnerMemberId: baseOwnerId,
      baseOwnerMemberName: baseOwnerName,
      ownerMemberId: contractType === "loan" ? loanRealOwnerId : buyerId,
      ownerMemberName: contractType === "loan" ? loanRealOwnerName : (existing.fromMemberName || getMemberName(members, buyerId)),
      amount: numericAmount,
      loanDurationMonths: loanMonths,
      loanStartDate: transferMarketOpen ? todayDateKey : null,
      loanEndDate: transferMarketOpen ? loanEndDate : null,
      date: todayDateKey,
      periodId: getTransferWindowIdForDate(firebaseTransferWindows, todayDateKey),
      periodName: getTransferWindowNameForDate(firebaseTransferWindows, todayDateKey),
      seasonId: activeSeasonId,
      relatedOfferId: offerId,
      marketWasOpenAtApproval: transferMarketOpen,
      completedAt: transferMarketOpen ? serverTimestamp() : null,
      offeredPlayers: enrichedOfferedPlayers,
      exchangePlayerCount: enrichedOfferedPlayers.length,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await addDoc(collection(db, "transferHistory"), transferHistoryPayload);

    if (transferMarketOpen && numericAmount > 0 && !existing.paymentTransferredAtApproval) {
      await addDoc(collection(db, "moneyTransfers"), {
        fromMemberId: buyerId,
        fromMemberName: existing.fromMemberName || "",
        toMemberId: sellerId,
        toMemberName: existing.toMemberName || currentMember?.name || "",
        amount: numericAmount,
        type: "player_offer_payment",
        status: "approved",
        approvedBy: ownerId,
        relatedOfferId: offerId,
        note: "قيمة عرض اللاعب " + (existing.targetPlayerName || ""),
        date: new Date().toISOString().slice(0, 10),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await updateDoc(doc(db, "playerOffers", offerId), {
        paymentTransferredAtApproval: true,
        paymentTransferredAt: serverTimestamp(),
        paymentTransferDate: todayDateKey,
        updatedAt: serverTimestamp(),
      });
    }

    await addDoc(collection(db, "notifications"), {
      type: "player_offer_accepted",
      status: "unread",
      toMemberId: buyerId,
      fromMemberId: ownerId,
      relatedOfferId: offerId,
      targetPlayerId: existing.targetPlayerId || "",
      targetMemberId: sellerId,
      offerVersion: toNumber(existing.version || 1),
      targetStatus: nextStatus,
      navigationDisabled: true,
      title: "تم قبول عرضك",
      body: (currentMember?.name || "العضو") + " وافق على عرضك للاعب " + (existing.targetPlayerName || "") + (transferMarketOpen ? "." : "، والصفقة بانتظار فتح سوق الانتقالات."),
      createdAt: serverTimestamp(),
    });

    return {
      instantContract: {
        row: transferHistoryPayload,
        player: {
          name: existing.targetPlayerName || targetPlayerRow?.name || "",
          image: existing.targetPlayerImage || targetPlayerRow?.image || FALLBACK_PLAYER_IMAGE,
          rating: existing.targetPlayerRating || targetPlayerRow?.rating || "",
          position: existing.targetPlayerPosition || targetPlayerRow?.position || "",
        },
      },
    };
  }

  async function rejectPlayerOffer(offerId) {
    const ownerId = cleanId(currentMemberId);
    const existing = firebasePlayerOffers.find((offer) => same(offer.id, offerId));
    if (!existing) throw new Error("العرض غير موجود.");
    if (!same(existing.toMemberId, ownerId)) throw new Error("لا يمكنك رفض عرض لا يخص لاعبك.");
    if (!isActivePlayerOfferStatus(existing.status) || isOfferExpired(existing)) throw new Error("لا يمكن رفض هذا العرض.");

    await deactivateOfferNotifications(offerId, "offer_rejected");

    await updateDoc(doc(db, "playerOffers", offerId), {
      status: "rejected",
      rejectedAt: serverTimestamp(),
      rejectedByMemberId: ownerId,
      updatedAt: serverTimestamp(),
    });

    await addDoc(collection(db, "notifications"), {
      type: "player_offer_rejected",
      status: "unread",
      toMemberId: existing.fromMemberId,
      fromMemberId: ownerId,
      relatedOfferId: offerId,
      targetPlayerId: existing.targetPlayerId || "",
      targetMemberId: existing.toMemberId || "",
      offerVersion: toNumber(existing.version || 1),
      targetStatus: "rejected",
      navigationDisabled: true,
      title: "تم رفض عرضك",
      body: (currentMember?.name || "العضو") + " رفض عرضك للاعب " + (existing.targetPlayerName || "") + ".",
      createdAt: serverTimestamp(),
    });
  }

  async function releasePlayerFromSquad(player) {
    const ownerId = cleanId(currentMemberId);
    const playerId = getPlayerStableId(player);
    if (!ownerId || !playerId) throw new Error("بيانات اللاعب غير مكتملة.");
    assertTransferAllowed(ownerId, "squad_change");
    if (!transferMarketOpen) throw new Error("الاستغناء متاح فقط خلال فترة الانتقالات وقيد اللاعبين.");

    const activeContract = getActivePlayerContract(playerId);
    const contractType = clean(activeContract?.contractType || "");
    if (contractType === "released") throw new Error("تم الاستغناء عن هذا اللاعب سابقًا ولا يمكن تنفيذ الإجراء مرة أخرى.");

    const effectiveOwnerId = activeContract && contractType !== "released"
      ? cleanId(activeContract.currentMemberId)
      : cleanId(player.memberid);

    if (!same(effectiveOwnerId, ownerId)) throw new Error("لا يمكنك الاستغناء عن لاعب لا يخص قائمتك.");
    const ownerRosterKind = getRosterPlayerKindFromContract(player, activeContract, ownerId);
    if (ownerRosterKind === "free") {
      throw new Error("لا يمكن الاستغناء عن اللاعب الحر. يمكن تبديله فقط من صفحة اللاعبين الأحرار خلال سوق الانتقالات.");
    }
    if (activeContract && contractType !== "owned") throw new Error("لا يمكن الاستغناء عن لاعب معار أو مرتبط بعقد غير مملوك ملكية كاملة.");

    const activeAcceptedDeal = firebasePlayerOffers.find((offer) =>
      same(offer.targetPlayerId, playerId) && isAcceptedOrCompletedPlayerOffer(offer)
    );
    if (activeAcceptedDeal) throw new Error("لا يمكن الاستغناء عن لاعب عليه صفقة مقبولة أو مكتملة.");

    const ownerPlayersCount = getVisiblePlayersForMember(ownerId).length;
    if (ownerPlayersCount <= MIN_SQUAD_PLAYERS) throw new Error("لا يمكن الاستغناء عندما تكون قائمة العضو 17 لاعبًا حسب نظام الموسم السادس.");

    const releaseDate = new Date().toISOString().slice(0, 10);
    const releaseWindowId = getTransferWindowIdForDate(firebaseTransferWindows, releaseDate);
    const releaseWindowName = getTransferWindowNameForDate(firebaseTransferWindows, releaseDate);

    const activeOffersForPlayer = firebasePlayerOffers.filter((offer) =>
      same(offer.targetPlayerId, playerId) &&
      clean(offer.status || "pending") === "pending" &&
      !isOfferExpired(offer)
    );

    await Promise.allSettled(
      activeOffersForPlayer.map(async (offer) => {
        await deactivateOfferNotifications(offer.id, "player_released");
        await updateDoc(doc(db, "playerOffers", offer.id), {
          status: "cancelledBecausePlayerReleased",
          cancelledAt: serverTimestamp(),
          cancelledReason: "تم الاستغناء عن اللاعب وإنهاء عقده مع الفريق",
          navigationDisabled: true,
          updatedAt: serverTimestamp(),
        });
        if (!same(offer.fromMemberId, ownerId)) {
          await addDoc(collection(db, "notifications"), {
            type: "player_offer_closed",
            status: "unread",
            toMemberId: offer.fromMemberId,
            fromMemberId: ownerId,
            relatedOfferId: offer.id,
            targetPlayerId: playerId,
            targetMemberId: ownerId,
            offerVersion: toNumber(offer.version || 1),
            targetStatus: "cancelledBecausePlayerReleased",
            navigationDisabled: true,
            title: "تم إغلاق عرضك",
            body: "تم الاستغناء عن اللاعب " + (player.name || "") + "، لذلك أُغلق عرضك تلقائيًا.",
            createdAt: serverTimestamp(),
          });
        }
      })
    );

    if (activeContract?.id) {
      await updateDoc(doc(db, "playerContracts", activeContract.id), {
        status: "released_to_free_agent",
        releasedToFreeAgentAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    await addDoc(collection(db, "playerContracts"), {
      status: "active",
      contractType: "free_agent",
      rosterType: "free",
      isFreeOrigin: true,
      freeAgentOrigin: true,
      releasedToFreeAgent: true,
      availableFreeAgent: true,
      playerId,
      playerName: player.name || "",
      playerImage: player.image || "",
      playerPosition: player.position || "",
      playerRating: player.rating || "",
      ownerMemberId: "free_agents",
      ownerMemberName: "اللاعبون الأحرار",
      originalOwnerMemberId: ownerId,
      originalOwnerMemberName: currentMember?.name || authProfile?.memberName || "",
      baseOwnerMemberId: ownerId,
      baseOwnerMemberName: currentMember?.name || authProfile?.memberName || "",
      currentMemberId: "",
      currentMemberName: "لاعب حر متاح",
      previousMemberId: ownerId,
      previousMemberName: currentMember?.name || authProfile?.memberName || "",
      permanentlyRemoved: false,
      releasedAt: serverTimestamp(),
      releasedDate: releaseDate,
      marketWasOpenAtRelease: transferMarketOpen,
      transferWindowId: releaseWindowId,
      transferWindowName: releaseWindowName,
      periodId: releaseWindowId,
      periodName: releaseWindowName,
      createdBy: authUser?.uid || "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const releaseRef = await addDoc(collection(db, "playerReleases"), {
      status: "completed",
      type: "release",
      typeLabel: "إنهاء تعاقد",
      memberId: ownerId,
      memberName: currentMember?.name || authProfile?.memberName || "",
      fromMemberId: ownerId,
      fromMemberName: currentMember?.name || authProfile?.memberName || "",
      toMemberId: "free_agents",
      toMemberName: "اللاعبون الأحرار",
      playerId,
      playerName: player.name || "",
      playerImage: player.image || "",
      playerPosition: player.position || "",
      playerRating: player.rating || "",
      amount: 0,
      permanentlyRemoved: false,
      releasedToFreeAgent: true,
      marketWasOpen: transferMarketOpen,
      transferWindowId: releaseWindowId,
      transferWindowName: releaseWindowName,
      periodId: releaseWindowId,
      periodName: releaseWindowName,
      seasonId: activeSeasonId,
      createdBy: authUser?.uid || "",
      date: releaseDate,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await addDoc(collection(db, "transferHistory"), {
      status: "completed",
      type: "release",
      typeLabel: "إنهاء تعاقد",
      playerId,
      playerName: player.name || "",
      playerImage: player.image || "",
      playerPosition: player.position || "",
      playerRating: player.rating || "",
      fromMemberId: ownerId,
      fromMemberName: currentMember?.name || authProfile?.memberName || "",
      toMemberId: "free_agents",
      toMemberName: "اللاعبون الأحرار",
      amount: 0,
      date: releaseDate,
      periodId: releaseWindowId,
      periodName: releaseWindowName,
      seasonId: activeSeasonId,
      relatedReleaseId: releaseRef.id,
      marketWasOpenAtRelease: transferMarketOpen,
      note: "إنهاء تعاقد ونقل اللاعب إلى قائمة اللاعبين الأحرار",
      completedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await addDoc(collection(db, "notifications"), {
      type: "player_released",
      status: "unread",
      toMemberId: ownerId,
      fromMemberId: ownerId,
      targetPlayerId: playerId,
      targetMemberId: ownerId,
      targetStatus: "released_to_free_agent",
      navigationDisabled: true,
      title: "تم الاستغناء عن لاعب",
      body: "تم إنهاء عقد اللاعب " + (player.name || "") + " ونقله إلى قائمة اللاعبين الأحرار.",
      createdAt: serverTimestamp(),
    });
  }

  async function terminateLoanContract(contract) {
    const actorId = cleanId(currentMemberId);
    if (!actorId) throw new Error("لم يتم ربط الحساب بعضو بعد.");
    assertTransferAllowed(actorId, "squad_change");
    if (!contract?.id) throw new Error("عقد الإعارة غير موجود.");
    if (clean(contract.contractType) !== "loan") throw new Error("هذا اللاعب ليس على عقد إعارة.");
    if (!transferMarketOpen) throw new Error("فسخ الإعارة متاح فقط خلال فترة الانتقالات وقيد اللاعبين.");

    const currentHolderId = cleanId(contract.currentMemberId);
    const originalOwnerId = cleanId(contract.originalOwnerMemberId || contract.ownerMemberId);
    const isCurrentHolder = same(actorId, currentHolderId);
    const isOriginalOwner = same(actorId, originalOwnerId);
    if (!isCurrentHolder && !isOriginalOwner) throw new Error("لا يمكنك فسخ عقد إعارة لا يخصك.");

    const compensation = LOAN_TERMINATION_COMPENSATION;
    const loanAmount = Math.max(0, toNumber(contract.loanAmount || contract.amount || 0));
    const todayDateKey = new Date().toISOString().slice(0, 10);
    const actorName = currentMember?.name || authProfile?.memberName || "";
    const otherMemberId = isCurrentHolder ? originalOwnerId : currentHolderId;

    await updateDoc(doc(db, "playerContracts", contract.id), {
      status: "terminated",
      terminatedAt: serverTimestamp(),
      terminatedByMemberId: actorId,
      terminatedByMemberName: actorName,
      updatedAt: serverTimestamp(),
    });

    const returningFreeOrigin = isFreeOriginContract(contract);
    const returningFreeSlotOwnerId = getFreeAgentSlotOwnerIdFromContract(contract, returningFreeOrigin ? originalOwnerId : "");
    const returningBaseOwnerId = cleanId(
      contract.baseOwnerMemberId ||
        contract.baseOwnerId ||
        contract.originalBaseOwnerMemberId ||
        contract.sourceBaseOwnerMemberId ||
        contract.baseMemberId ||
        originalOwnerId
    );
    const returningBaseOwnerName = contract.baseOwnerMemberName || contract.originalBaseOwnerMemberName || getMemberName(members, returningBaseOwnerId) || contract.originalOwnerMemberName || contract.ownerMemberName || "";
    const returningOwnerName = contract.originalOwnerMemberName || contract.ownerMemberName || getMemberName(members, originalOwnerId) || "";
    const returningRosterType = getRosterKindCode({
      contractType: "owned",
      originalOwnerMemberId: returningBaseOwnerId,
      currentMemberId: originalOwnerId,
      freeAgent: returningFreeOrigin && same(returningFreeSlotOwnerId, originalOwnerId),
    });

    await addDoc(collection(db, "playerContracts"), {
      status: "active",
      contractType: "owned",
      rosterType: returningRosterType,
      playerId: contract.playerId || "",
      playerName: contract.playerName || "",
      playerImage: contract.playerImage || "",
      playerPosition: contract.playerPosition || "",
      playerRating: contract.playerRating || "",
      ownerMemberId: originalOwnerId,
      ownerMemberName: returningOwnerName,
      originalOwnerMemberId: returningBaseOwnerId,
      originalOwnerMemberName: returningBaseOwnerName,
      baseOwnerMemberId: returningBaseOwnerId,
      baseOwnerMemberName: returningBaseOwnerName,
      currentMemberId: originalOwnerId,
      currentMemberName: returningOwnerName,
      previousMemberId: currentHolderId,
      previousMemberName: contract.currentMemberName || "",
      sourceContractId: contract.id,
      source: "loan_terminated",
      isFreeOrigin: returningFreeOrigin,
      freeAgentOrigin: returningFreeOrigin,
      freeAgentSlotOwnerMemberId: returningFreeSlotOwnerId, 
      marketWasOpenAtTermination: transferMarketOpen,
      createdBy: actorId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    if (isOriginalOwner) {
      if (loanAmount > 0) {
        await addDoc(collection(db, "moneyTransfers"), {
          fromMemberId: originalOwnerId,
          fromMemberName: contract.originalOwnerMemberName || contract.ownerMemberName || "",
          toMemberId: currentHolderId,
          toMemberName: contract.currentMemberName || "",
          amount: loanAmount,
          type: "loan_refund_by_owner_termination",
          status: "approved",
          note: "استرجاع مبلغ إعارة اللاعب " + (contract.playerName || ""),
          relatedContractId: contract.id,
          date: todayDateKey,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      await addDoc(collection(db, "moneyTransfers"), {
        fromMemberId: originalOwnerId,
        fromMemberName: contract.originalOwnerMemberName || contract.ownerMemberName || "",
        toMemberId: currentHolderId,
        toMemberName: contract.currentMemberName || "",
        amount: compensation,
        type: "loan_termination_compensation",
        status: "approved",
        note: "تعويض فسخ إعارة اللاعب " + (contract.playerName || ""),
        relatedContractId: contract.id,
        date: todayDateKey,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await addDoc(collection(db, "moneyTransfers"), {
        fromMemberId: currentHolderId,
        fromMemberName: contract.currentMemberName || "",
        toMemberId: originalOwnerId,
        toMemberName: contract.originalOwnerMemberName || contract.ownerMemberName || "",
        amount: compensation,
        type: "loan_termination_compensation",
        status: "approved",
        note: "تعويض فسخ إعارة اللاعب " + (contract.playerName || ""),
        relatedContractId: contract.id,
        date: todayDateKey,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    await addDoc(collection(db, "transferHistory"), {
      status: "completed",
      type: "loan_terminated",
      typeLabel: "فسخ إعارة",
      playerId: contract.playerId || "",
      playerName: contract.playerName || "",
      playerImage: contract.playerImage || "",
      playerPosition: contract.playerPosition || "",
      playerRating: contract.playerRating || "",
      fromMemberId: currentHolderId,
      fromMemberName: contract.currentMemberName || "",
      toMemberId: originalOwnerId,
      toMemberName: contract.originalOwnerMemberName || contract.ownerMemberName || "",
      originalOwnerMemberId: originalOwnerId,
      originalOwnerMemberName: contract.originalOwnerMemberName || contract.ownerMemberName || "",
      baseOwnerMemberId: returningBaseOwnerId,
      baseOwnerMemberName: returningBaseOwnerName,
      ownerMemberId: originalOwnerId,
      ownerMemberName: contract.originalOwnerMemberName || contract.ownerMemberName || "",
      amount: compensation,
      date: todayDateKey,
      periodId: getTransferWindowIdForDate(firebaseTransferWindows, todayDateKey),
      periodName: getTransferWindowNameForDate(firebaseTransferWindows, todayDateKey),
      seasonId: activeSeasonId,
      relatedContractId: contract.id,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    if (returningFreeOrigin && returningFreeSlotOwnerId && same(returningFreeSlotOwnerId, originalOwnerId)) {
      await setDoc(doc(db, "freePlayerStatus", originalOwnerId), {
        memberId: toNumber(originalOwnerId),
        hasUsedFreeSlot: false,
        currentFreePlayerId: contract.playerId || "",
        currentFreePlayerName: contract.playerName || "",
        updatedAt: serverTimestamp(),
      }, { merge: true });
    }

    await addDoc(collection(db, "notifications"), {
      type: "loan_terminated",
      status: "unread",
      toMemberId: otherMemberId,
      fromMemberId: actorId,
      targetPlayerId: contract.playerId || "",
      targetStatus: "loan_terminated",
      navigationDisabled: true,
      title: "تم فسخ إعارة",
      body: (actorName || "عضو") + " قام بفسخ إعارة اللاعب " + (contract.playerName || "") + ".",
      createdAt: serverTimestamp(),
    });
  }

  async function registerFreeAgentFee(player) {
    const ownerId = cleanId(currentMemberId);
    const playerId = getPlayerStableId(player);
    if (!authUser || !ownerId) throw new Error("لم يتم ربط الحساب بعضو بعد.");
    assertTransferAllowed(ownerId, "squad_change");
    if (!playerId) throw new Error("بيانات اللاعب غير مكتملة.");
    const freeAgentPoolContract = getActivePlayerContract(playerId);
    const playerAvailableAsFreeAgent = isFreeAgentPlayer(player) || isFreeAgentPoolContract(freeAgentPoolContract);
    if (!playerAvailableAsFreeAgent) throw new Error("هذا اللاعب غير متاح ضمن قائمة اللاعبين الأحرار.");
    if (isFreeAgentUnavailable(playerId)) throw new Error("هذا اللاعب الحر غير متاح حاليًا لأنه مسجل أو عليه طلب قيد.");

    const memberName = currentMember?.name || authProfile?.memberName || "";
    const currentFreeContract = getActiveFreeAgentContractForMember(ownerId);
    const currentFreePlayerId = cleanId(currentFreeContract?.playerId || "");
    const memberFreeStatus = getFreePlayerStatusForMember(ownerId);
    const slotEverUsed = hasEverUsedFreeAgentSlot(firebaseFreeAgentRegistrations, memberFreeStatus, currentFreeContract, ownerId);
    const pendingQueue = getPendingFreeAgentQueueForMember(ownerId);

    if (pendingQueue) {
      throw new Error("لديك طلب لاعب حر بانتظار التنفيذ عند فتح سوق الانتقالات.");
    }

    if (currentFreePlayerId && same(currentFreePlayerId, playerId)) {
      throw new Error("هذا اللاعب الحر مسجل في قائمتك بالفعل.");
    }

    if (slotEverUsed && !currentFreeContract) {
      throw new Error("لا يمكنك تسجيل لاعب حر جديد بعد بيع أو إعارة لاعبك الحر السابق إلا إذا عاد نفس اللاعب الحر إلى قائمتك.");
    }

    const isReplacement = Boolean(currentFreeContract);
    const feeAmount = isReplacement ? FREE_AGENT_REPLACEMENT_FEE : 0;
    const currentRosterCount = getVisiblePlayersForMember(ownerId).length;
    if (!isReplacement && currentRosterCount + 1 > MAX_SQUAD_PLAYERS) {
      throw new Error("لا يمكن تسجيل لاعب حر لأن قائمتك ستتجاوز الحد الأقصى 32 لاعبًا.");
    }

    if (feeAmount > currentMemberAvailableBalance) {
      throw new Error("الرصيد المتاح لا يكفي لرسوم تبديل اللاعب الحر.");
    }

    const todayDateKey = new Date().toISOString().slice(0, 10);
    const basePayload = {
      memberId: ownerId,
      memberName,
      oldPlayerId: currentFreePlayerId || "",
      oldPlayerName: currentFreeContract?.playerName || "",
      oldPlayerImage: currentFreeContract?.playerImage || "",
      newPlayerId: playerId,
      newPlayerName: player.name || "",
      newPlayerImage: player.image || "",
      newPlayerPosition: player.position || "",
      newPlayerRating: player.rating || "",
      cost: feeAmount,
      feeAmount,
      registrationType: isReplacement ? "replacement" : "initial",
      slotEverUsed,
      status: transferMarketOpen ? "processing" : "pending_window",
      date: todayDateKey,
      marketWasOpenAtRequest: transferMarketOpen,
      createdBy: authUser.uid,
      username: authProfile?.username || "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    if (!transferMarketOpen) {
      await addDoc(collection(db, "freeAgentQueue"), basePayload);
      await addDoc(collection(db, "notifications"), {
        type: isReplacement ? "free_agent_replacement_queued" : "free_agent_registration_queued",
        status: "unread",
        toMemberId: ownerId,
        fromMemberId: ownerId,
        targetPlayerId: playerId,
        targetStatus: "pending_window",
        navigationDisabled: true,
        title: isReplacement ? "طلب تبديل لاعب حر" : "طلب تسجيل لاعب حر",
        body: isReplacement
          ? "تم حفظ طلب تبديل اللاعب الحر إلى " + (player.name || "") + "، وسيتم تنفيذه عند فتح سوق الانتقالات إذا توفر الرصيد."
          : "تم حفظ طلب تسجيل اللاعب الحر " + (player.name || "") + "، وسيتم تنفيذه عند فتح سوق الانتقالات.",
        createdAt: serverTimestamp(),
      });
      return;
    }

    const queueRef = await addDoc(collection(db, "freeAgentQueue"), basePayload);
    await executeFreeAgentQueueItem({ id: queueRef.id, ...basePayload }, { allowProcessingStatus: true });
  }

  async function executeFreeAgentQueueItem(queueItem, options = {}) {
    const status = clean(queueItem?.status || "pending_window");
    if (!queueItem?.id) return;
    if (!["pending_window", "processing"].includes(status)) return;
    if (status === "processing" && !options.allowProcessingStatus) return;

    const ownerId = cleanId(queueItem.memberId);
    const newPlayerId = cleanId(queueItem.newPlayerId);
    const oldPlayerId = cleanId(queueItem.oldPlayerId);
    if (!ownerId || !newPlayerId) return;

    const member = members.find((item) => same(item.id, ownerId));
    const memberName = queueItem.memberName || member?.name || "";
    const memberStatus = firebaseFreePlayerStatus.find((item) => same(item.memberId || item.id, ownerId));
    const currentFreeContract = getActiveFreeAgentContractForMember(ownerId);
    const queuedReplacement = clean(queueItem.registrationType) === "replacement" || Boolean(oldPlayerId);
    const slotEverUsed = hasEverUsedFreeAgentSlot(firebaseFreeAgentRegistrations, memberStatus, currentFreeContract, ownerId);
    const isReplacement = Boolean(queuedReplacement && currentFreeContract);
    const feeAmount = isReplacement ? FREE_AGENT_REPLACEMENT_FEE : 0;
    const newPlayer = players.find((item) => same(getPlayerStableId(item), newPlayerId)) || {};
    const rosterCount = getVisiblePlayersForMember(ownerId).length;
    if (!isReplacement && rosterCount + 1 > MAX_SQUAD_PLAYERS) {
      await updateDoc(doc(db, "freeAgentQueue", queueItem.id), {
        status: "failed",
        failureReason: "قائمة العضو ستتجاوز الحد الأقصى 32 لاعبًا.",
        updatedAt: serverTimestamp(),
      });
      return;
    }

    if (queuedReplacement && (!currentFreeContract || (oldPlayerId && !same(currentFreeContract.playerId, oldPlayerId)))) {
      await updateDoc(doc(db, "freeAgentQueue", queueItem.id), {
        status: "failed",
        failureReason: "تعذر تنفيذ تبديل اللاعب الحر لأن اللاعب الحر القديم لم يعد نشطًا في القائمة.",
        updatedAt: serverTimestamp(),
      });
      return;
    }

    if (!queuedReplacement && currentFreeContract) {
      await updateDoc(doc(db, "freeAgentQueue", queueItem.id), {
        status: "failed",
        failureReason: "لدى العضو لاعب حر نشط بالفعل.",
        updatedAt: serverTimestamp(),
      });
      return;
    }

    if (slotEverUsed && !currentFreeContract && !queuedReplacement) {
      await updateDoc(doc(db, "freeAgentQueue", queueItem.id), {
        status: "failed",
        failureReason: "لا يمكن تسجيل لاعب حر جديد بعد بيع أو إعارة اللاعب الحر السابق إلا إذا عاد نفس اللاعب.",
        updatedAt: serverTimestamp(),
      });
      return;
    }

    if (isFreeAgentUnavailable(newPlayerId, queueItem.id)) {
      await updateDoc(doc(db, "freeAgentQueue", queueItem.id), {
        status: "failed",
        failureReason: "اللاعب الحر لم يعد متاحًا.",
        updatedAt: serverTimestamp(),
      });
      return;
    }

    const memberFinanceRows = getMemberFinanceRows(combinedFinance, ownerId);
    const memberBalance = computeMemberBalance(memberFinanceRows, member?.balance, ownerId);
    if (feeAmount > memberBalance) {
      await updateDoc(doc(db, "freeAgentQueue", queueItem.id), {
        status: "failed",
        failureReason: "الرصيد غير كافٍ عند فتح سوق الانتقالات.",
        updatedAt: serverTimestamp(),
      });
      await addDoc(collection(db, "notifications"), {
        type: "free_agent_queue_failed",
        status: "unread",
        toMemberId: ownerId,
        fromMemberId: "system",
        targetPlayerId: newPlayerId,
        targetStatus: "failed",
        navigationDisabled: true,
        title: "فشل طلب اللاعب الحر",
        body: "تعذر تنفيذ طلب اللاعب الحر " + (queueItem.newPlayerName || newPlayer.name || "") + " لأن الرصيد غير كافٍ.",
        createdAt: serverTimestamp(),
      });
      return;
    }

    await updateDoc(doc(db, "freeAgentQueue", queueItem.id), {
      status: "processing",
      processingAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    if (currentFreeContract?.id) {
      await updateDoc(doc(db, "playerContracts", currentFreeContract.id), {
        status: "replaced_free_agent",
        replacedByPlayerId: newPlayerId,
        replacedByQueueId: queueItem.id,
        replacedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    const todayDateKey = new Date().toISOString().slice(0, 10);

    if (feeAmount > 0) {
      await addDoc(collection(db, "moneyTransfers"), {
        fromMemberId: ownerId,
        fromMemberName: memberName,
        toMemberId: "system",
        toMemberName: "النظام",
        amount: feeAmount,
        type: "free_agent_replacement_fee",
        direction: "expense",
        status: "approved",
        approvedBy: "system",
        playerId: newPlayerId,
        playerName: queueItem.newPlayerName || newPlayer.name || "",
        relatedQueueId: queueItem.id,
        createdBy: queueItem.createdBy || authUser?.uid || "system",
        username: queueItem.username || "",
        note: "رسوم تبديل اللاعب الحر إلى " + (queueItem.newPlayerName || newPlayer.name || ""),
        date: todayDateKey,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    const availableFreeAgentPoolContract = activePlayerContracts.find((contract) =>
      same(contract.playerId, newPlayerId) && isFreeAgentPoolContract(contract)
    );

    if (availableFreeAgentPoolContract?.id) {
      await updateDoc(doc(db, "playerContracts", availableFreeAgentPoolContract.id), {
        status: "registered_from_free_agents",
        registeredByMemberId: ownerId,
        registeredByQueueId: queueItem.id,
        registeredAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    await addDoc(collection(db, "playerContracts"), {
      status: "active",
      contractType: "owned",
      rosterType: "free",
      isFreeOrigin: true,
      freeAgentOrigin: true,
      freeAgentSlotOwnerMemberId: ownerId,
      playerId: newPlayerId,
      playerName: queueItem.newPlayerName || newPlayer.name || "",
      playerImage: queueItem.newPlayerImage || newPlayer.image || "",
      playerPosition: queueItem.newPlayerPosition || newPlayer.position || "",
      playerRating: queueItem.newPlayerRating || newPlayer.rating || "",
      ownerMemberId: ownerId,
      ownerMemberName: memberName,
      originalOwnerMemberId: ownerId,
      originalOwnerMemberName: memberName,
      currentMemberId: ownerId,
      currentMemberName: memberName,
      previousMemberId: oldPlayerId ? ownerId : "free_agents",
      previousMemberName: oldPlayerId ? memberName : "لاعب حر",
      source: "free_agent_queue",
      sourceQueueId: queueItem.id,
      amount: feeAmount,
      createdBy: queueItem.createdBy || authUser?.uid || "system",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await addDoc(collection(db, "freeAgentRegistrations"), {
      status: "completed",
      registrationType: isReplacement ? "replacement" : "initial",
      slotEverUsed,
      playerId: newPlayerId,
      playerName: queueItem.newPlayerName || newPlayer.name || "",
      playerImage: queueItem.newPlayerImage || newPlayer.image || "",
      playerPosition: queueItem.newPlayerPosition || newPlayer.position || "",
      playerRating: queueItem.newPlayerRating || newPlayer.rating || "",
      oldPlayerId: oldPlayerId || currentFreeContract?.playerId || "",
      oldPlayerName: queueItem.oldPlayerName || currentFreeContract?.playerName || "",
      memberId: ownerId,
      memberName,
      amount: feeAmount,
      feeAmount,
      relatedQueueId: queueItem.id,
      date: todayDateKey,
      createdBy: queueItem.createdBy || authUser?.uid || "system",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await addDoc(collection(db, "transferHistory"), {
      status: "completed",
      type: isReplacement ? "free_agent_replacement" : "free_agent",
      typeLabel: isReplacement ? "تبديل لاعب حر" : "تسجيل لاعب حر",
      playerId: newPlayerId,
      playerName: queueItem.newPlayerName || newPlayer.name || "",
      playerImage: queueItem.newPlayerImage || newPlayer.image || "",
      playerPosition: queueItem.newPlayerPosition || newPlayer.position || "",
      playerRating: queueItem.newPlayerRating || newPlayer.rating || "",
      fromMemberId: isReplacement ? ownerId : "free_agents",
      fromMemberName: isReplacement ? (queueItem.oldPlayerName || currentFreeContract?.playerName || "لاعب حر سابق") : "لاعب حر",
      toMemberId: ownerId,
      toMemberName: memberName,
      amount: feeAmount,
      date: todayDateKey,
      periodId: options.marketOpenWindowInfo?.windowId || getTransferWindowIdForDate(firebaseTransferWindows, todayDateKey),
      periodName: options.marketOpenWindowInfo?.windowTitle || getTransferWindowNameForDate(firebaseTransferWindows, todayDateKey),
      seasonId: activeSeasonId,
      relatedQueueId: queueItem.id,
      note: isReplacement
        ? "تبديل لاعب حر برسوم إلزامية 5,000,000"
        : "تسجيل اللاعب الحر الأول بدون رسوم",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await setDoc(doc(db, "freePlayerStatus", ownerId), {
      memberId: toNumber(ownerId),
      hasUsedFreeSlot: false,
      currentFreePlayerId: newPlayerId,
      currentFreePlayerName: queueItem.newPlayerName || newPlayer.name || "",
      updatedAt: serverTimestamp(),
    }, { merge: true });

    await updateDoc(doc(db, "freeAgentQueue", queueItem.id), {
      status: "completed",
      completedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const rosterNotifications = [
      sendRosterUpdateNotification({
        toMemberId: ownerId,
        fromMemberId: "FIFA",
        playerId: newPlayerId,
        relatedQueueId: queueItem.id,
        targetStatus: isReplacement ? "free_agent_replaced" : "free_agent_registered",
        body: "تحديث على قائمة فريقك: تم تسجيل اللاعب " + (queueItem.newPlayerName || newPlayer.name || "") + " كلاعب حر",
      }),
    ];

    if (isReplacement && (queueItem.oldPlayerName || currentFreeContract?.playerName)) {
      rosterNotifications.unshift(sendRosterUpdateNotification({
        toMemberId: ownerId,
        fromMemberId: "FIFA",
        playerId: oldPlayerId || currentFreeContract?.playerId || "",
        relatedQueueId: queueItem.id,
        targetStatus: "free_agent_removed_after_replacement",
        body: "تحديث على قائمة فريقك: تم إزالة اللاعب " + (queueItem.oldPlayerName || currentFreeContract?.playerName || "") + " من القائمة بعد تبديل اللاعب الحر",
      }));
    }

    await Promise.allSettled(rosterNotifications);
  }

  async function markNotificationRead(notificationId) {
    if (!notificationId) return;
    try {
      await updateDoc(doc(db, "notifications", notificationId), {
        status: "read",
        readAt: serverTimestamp(),
      });
    } catch (err) {
      console.error("Mark notification read failed:", err);
    }
  }

  function openNotificationTarget(notification) {
    if (!notification) return;
    markNotificationRead(notification.id);
    setNotificationsOpen(false);

    const competitionId = cleanId(
      notification.relatedCompetitionId ||
        notification.competitionId ||
        notification.targetCompetitionId
    );
    if (competitionId) {
      setFocusedCompetitionId(competitionId);
      setPage("season");
      setSelectedId("");
      setMemberTab("players");
      setDetailView(null);
      setDetailStack([]);
      requestAnimationFrame(() => scrollAppToTop("auto"));
      return;
    }

    const financeMemberId = cleanId(
      notification.relatedMemberId ||
        notification.financeMemberId ||
        notification.receiverMemberId ||
        notification.toMemberId
    );
    const notificationType = clean(notification.type || "");
    if (
      financeMemberId &&
      ["money_transfer_in", "money_transfer_out", "admin_reward", "admin_compensation", "financial_alert", "competition_reward"].includes(notificationType)
    ) {
      setSelectedId(financeMemberId);
      setMemberTab("finance");
      setPage("members");
      setDetailView(null);
      setDetailStack([]);
      requestAnimationFrame(() => scrollAppToTop("auto"));
      return;
    }

    const offer = firebasePlayerOffers.find((item) => same(item.id, notification.relatedOfferId));
    const notificationVersion = toNumber(notification.offerVersion || 0);
    const offerVersion = toNumber(offer?.version || 1);
    const offerStatus = clean(offer?.status || notification.targetStatus || "");
    const staleNotification = Boolean(
      notification.navigationDisabled ||
        !offer ||
        (notificationVersion && notificationVersion !== offerVersion) ||
        isTerminalPlayerOfferStatus(offerStatus) ||
        isOfferExpired(offer)
    );

    if (staleNotification) {
      return;
    }

    const targetPlayerId = cleanId(notification.targetPlayerId || offer?.targetPlayerId);
    const targetMemberId = cleanId(notification.targetMemberId || offer?.toMemberId || notification.toMemberId || currentMemberId);
    const player = players.find((item) => same(getPlayerStableId(item), targetPlayerId));
    const ownerMember = members.find((member) => same(member.id, targetMemberId));
    if (player && ownerMember) {
      setDetailView({ type: "playerDetailOffer", player, ownerMember });
      setDetailStack([]);
      setSelectedId("");
      setMemberTab("players");
      requestAnimationFrame(() => scrollAppToTop("auto"));
      return;
    }

    setPage("members");
    setMemberTab("notifications");
    requestAnimationFrame(() => scrollAppToTop("auto"));
  }

  async function addOfferFee({ fromMemberId, relatedOfferId, note, type, dateKey }) {
    await addDoc(collection(db, "moneyTransfers"), {
      fromMemberId,
      fromMemberName: currentMember?.name || authProfile?.memberName || "",
      toMemberId: "system",
      toMemberName: "النظام",
      amount: OFFER_FEE,
      type,
      direction: "expense",
      status: "approved",
      approvedBy: "system",
      relatedOfferId,
      createdBy: authUser.uid,
      username: authProfile?.username || "",
      note,
      date: dateKey,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  const canShowTopBack = Boolean(
    infoModal || menuOpen || detailView || selectedId || page !== "members"
  );

  const topBarTitle = getTopBarTitle({
    page,
    config,
    selectedMember,
    detailView,
    infoModal,
    menuOpen,
  });

  function handleTopBack() {
    if (infoModal) {
      setInfoModal(null);
      try {
        window.history.replaceState({ fifaGroupRoot: true }, "");
      } catch {}
      return;
    }

    if (menuOpen) {
      setMenuOpen(false);
      try {
        window.history.replaceState({ fifaGroupRoot: true }, "");
      } catch {}
      return;
    }

    if (detailView) {
      closeView();
      try {
        window.history.replaceState({ fifaGroupRoot: true }, "");
      } catch {}
      return;
    }

    if (selectedId) {
      setSelectedId("");
      setMemberTab("players");
      setSearch("");
      try {
        window.history.replaceState({ fifaGroupRoot: true }, "");
      } catch {}
      scrollAppToTop("auto");
      return;
    }

    if (page !== "members") {
      goPage("members");
      try {
        window.history.replaceState({ fifaGroupRoot: true }, "");
      } catch {}
    }
  }

  if (loading) return null;
  if (error || !members.length)
    return (
      <SystemScreen
        title={error || config.noDataTitle}
        subtitle="تأكد من روابط Google Sheets."
      />
    );
  if (clean(config.appStatus) !== "active")
    return (
      <SystemScreen
        title={config.maintenanceMessage}
        subtitle={config.seasonTitle}
      />
    );

  if (authLoading)
    return (
      <SystemScreen
        title="جاري التحقق من الحساب"
        subtitle="يرجى الانتظار..."
        loading
      />
    );

  if (!authUser)
    return (
      <LoginPage
        members={activeMembers}
        appTitle={config.mainTitle}
        seasonTitle={config.seasonTitle}
      />
    );

  return (
    <div className="app iosSafeApp" dir="rtl">
      <style>{css}</style>
      <style>{moneyCss}</style>
      <style>{dealCss}</style>
      <style>{leagueAdminCss}</style>
      <style>{`:root{--cyan:${config.primaryColor};--blue:${config.secondaryColor};--violet:${config.accentColor};--fg-cover-height:${toCssSize(config.coverHeight, "118px")};--fg-cover-height-mobile:${toCssSize(config.coverHeightMobile, "50px")};}`}</style>

      <div className="bgOrb bgOrbOne" />
      <div className="bgOrb bgOrbTwo" />

      <AuthMiniBadge profile={authProfile} onLogout={() => signOut(auth)} />

      {page === "members" && !selectedMember && !detailView ? (
        <header
          className={
            headerCoverImage ? "mainHero hasCoverImage" : "mainHero glass"
          }
        >
          {headerCoverImage ? (
            <img className="coverImage" src={headerCoverImage} alt="" />
          ) : null}
          {!headerCoverImage ? (
            <div className="coverContent">
              <div>
                <div className="heroKicker">
                  {config.mainTitle}
                  <span />
                </div>
                <h1>{config.mainTitle}</h1>
                <p>{config.seasonTitle}</p>
              </div>
              <div className="coverIconBox">
                {appIconImage ? <img src={appIconImage} alt="" /> : <b>FG</b>}
              </div>
            </div>
          ) : null}
        </header>
      ) : null}

      {config.announcement ? (
        <div className="announcement glassSoft">📢 {config.announcement}</div>
      ) : null}

      {detailView ? (
        <DetailPage
          config={config}
          view={detailView}
          members={members}
          players={players}
          finance={combinedFinance}
          trophyMap={trophyMap}
          playerContracts={activePlayerContracts}
          currentMemberId={currentMemberId}
          currentMember={currentMember}
          playerOffers={firebasePlayerOffers}
          freeAgentRegistrations={firebaseFreeAgentRegistrations}
          freePlayerStatus={firebaseFreePlayerStatus}
          freeAgentQueue={firebaseFreeAgentQueue}
          isMarketOpen={transferMarketOpen}
          onBack={closeView}
          onOpenView={openView}
          onInfo={setInfoModal}
          onAcceptOffer={acceptPlayerOffer}
          onRejectOffer={rejectPlayerOffer}
          onReleasePlayer={releasePlayerFromSquad}
          onTerminateLoan={terminateLoanContract}
          onRegisterFreeAgentFee={registerFreeAgentFee}
        />
      ) : (
        <>
          {page === "members" ? (
            <MembersPage
              config={config}
              rankedMembers={rankedMembers}
              members={members}
              selectedMember={selectedMember}
              selectedMemberId={selectedMemberId}
              totalForMember={totalForMember}
              setSelectedId={setSelectedId}
              memberTab={memberTab}
              setMemberTab={setMemberTab}
              players={memberPlayers}
              trophies={memberTrophyGroups}
              finance={memberFinance}
              financeBalance={selectedMemberBalance}
              currentMemberId={currentMemberId}
              isFifaAdmin={isFifaAdmin}
              currentMemberBalance={currentMemberBalance}
              currentMemberAvailableBalance={currentMemberAvailableBalance}
              currentMemberPlayers={currentMemberPlayers}
              playerContracts={activePlayerContracts}
              playerOffers={firebasePlayerOffers}
              freeAgentRegistrations={firebaseFreeAgentRegistrations}
              freePlayerStatus={firebaseFreePlayerStatus}
              freeAgentQueue={firebaseFreeAgentQueue}
              memberRestrictions={firebaseMemberRestrictions}
              currentMemberRestrictions={activeCurrentMemberRestrictions}
              transferHistory={firebaseTransferRows}
              allPlayerOffers={firebasePlayerOffers}
              allPlayers={players}
              notifications={currentMemberNotifications}
              pushStatus={pushStatus}
              pushBusy={pushBusy}
              onEnablePushNotifications={handleEnablePushNotifications}
              onDisablePushNotifications={handleDisablePushNotifications}
              onOpenNotification={openNotificationTarget}
              onCreateMoneyTransfer={createMoneyTransfer}
              onCreatePlayerOffer={createPlayerOffer}
              onUpdatePlayerOffer={updatePlayerOffer}
              onCancelPlayerOffer={cancelPlayerOffer}
              onAcceptOffer={acceptPlayerOffer}
              onRejectOffer={rejectPlayerOffer}
              onReleasePlayer={releasePlayerFromSquad}
              onTerminateLoan={terminateLoanContract}
              onRegisterFreeAgentFee={registerFreeAgentFee}
              isMarketOpen={transferMarketOpen}
              stats={selectedMemberStats}
              search={search}
              setSearch={setSearch}
              onOpenView={openView}
              onInfo={setInfoModal}
            />
          ) : null}

          {page === "season" && isEnabled(config.showSeasonTournaments) ? (
            <SeasonHubPage
              config={config}
              activeSeason={activeSeason}
              groups={seasonGroups}
              total={activeSeasonRows.length}
              members={members}
              competitions={firebaseCompetitions}
              trophyMap={trophyMap}
              currentMemberId={currentMemberId}
              focusedCompetitionId={focusedCompetitionId}
              rankingRows={seasonRanking}
              onOpenView={openView}
            />
          ) : null}


          {page === "league" ? (
            <LeagueViewerPage
              config={config}
              competitions={firebaseCompetitions}
              trophyMap={trophyMap}
              currentMemberId={currentMemberId}
              focusedCompetitionId={focusedCompetitionId}
            />
          ) : null}

          {page === "archive" && isEnabled(config.showArchive) ? (
            <ArchivePage
              config={config}
              seasons={archiveSeasons}
              allTournaments={allTournaments}
              members={members}
              trophyMap={trophyMap}
              onOpenView={openView}
            />
          ) : null}

          {page === "ranking" && isEnabled(config.showRanking) ? (
            <RankingPage
              config={config}
              rows={seasonRanking}
              onOpenView={openView}
            />
          ) : null}

          {page === "stats" && isEnabled(config.showStats) ? (
            <GeneralStatsPage
              config={config}
              statsMap={finalStatsByMember}
              members={members}
              onOpenView={openView}
            />
          ) : null}

          {page === "transfers" && isEnabled(config.showTransfers) ? (
            <TransfersPage
              config={config}
              periods={transferPeriods}
              activePeriodId={activeTransferPeriod?.id || ""}
              setTransferPeriod={setTransferPeriod}
              rows={currentTransfers}
              players={players}
              members={members}
              currentMember={currentMember}
              currentMemberId={currentMemberId}
              playerContracts={activePlayerContracts}
              freeAgentQueue={firebaseFreeAgentQueue}
              onOpenView={openView}
            />
          ) : null}

          {page === "links" && isEnabled(config.showLinks) ? (
            <LinksPage config={config} links={importantLinks} />
          ) : null}

          {page === "fifaAdmin" && isFifaAdmin ? (
            <FifaAdminPage
              members={members}
              notifications={firebaseNotifications}
              moneyTransfers={firebaseMoneyTransfers}
              financeRows={combinedFinance}
              memberRestrictions={firebaseMemberRestrictions}
              adminDecisions={firebaseAdminDecisions}
              adminNotes={firebaseAdminNotes}
              pushTokens={firebasePushTokens}
              transferWindows={firebaseTransferWindows}
              playerOffers={firebasePlayerOffers}
              playerContracts={activePlayerContracts}
              transferHistory={firebaseTransferHistory}
              playerReleases={firebasePlayerReleases}
              isMarketOpen={transferMarketOpen}
              onSendNotification={createFifaAdminNotification}
              onCreateReward={createFifaAdminReward}
              onCreateDiscipline={createFifaAdminDiscipline}
              onCorrectMoneyTransfer={createFifaAdminMoneyCorrection}
              onCancelRestriction={cancelFifaAdminRestriction}
              onCreateAdminNote={createFifaAdminNote}
              onMarketControl={createFifaAdminMarketControl}
            />
          ) : null}

          {page === "leagueAdmin" && isFifaAdmin ? (
            <FifaLeagueAdminPage
              members={activeMembers}
              seasons={seasons}
              activeSeasonId={activeSeasonId}
              competitions={firebaseCompetitions}
              trophyMap={trophyMap}
              config={config}
              onCreateLeague={createFifaLeagueCompetition}
              onUpdateMatchResult={updateFifaLeagueMatchResult}
              onFinalizeLeague={finalizeFifaLeagueCompetition}
              onCancelCompetition={cancelFifaCompetition}
              onClearMatchResult={clearFifaLeagueMatchResult}
            />
          ) : null}
        </>
      )}

      <TopSystemBar title={topBarTitle} scrolled={topBarScrolled} unreadCount={unreadNotificationsCount} onNotificationsClick={() => setNotificationsOpen(true)} />
      <BottomNav
        page={page}
        goPage={goPage}
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
        config={config}
      />
      <SideMenu
        open={menuOpen}
        setOpen={setMenuOpen}
        goPage={goPage}
        config={config}
        isFifaAdmin={isFifaAdmin}
      />
      {infoModal ? (
        <InfoModal data={infoModal} onClose={() => setInfoModal(null)} />
      ) : null}
      {notificationsOpen ? (
        <NotificationsModal
          rows={topBarNotifications}
          members={members}
          currentMemberId={currentMemberId}
          pushStatus={pushStatus}
          pushBusy={pushBusy}
          onEnablePushNotifications={handleEnablePushNotifications}
          onDisablePushNotifications={handleDisablePushNotifications}
          onClose={() => setNotificationsOpen(false)}
          onOpenNotification={openNotificationTarget}
        />
      ) : null}
    </div>
  );
}


function LoginPage({ members = [], appTitle = "FIFA GROUP", seasonTitle = "" }) {
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [memberId, setMemberId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const isRegister = mode === "register";
  const activeMembers = Array.isArray(members) ? members : [];

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");

    const cleanUsername = String(username || "").trim();
    const cleanPassword = String(password || "").trim();

    if (!cleanUsername) {
      setMessage("اكتب اسم المستخدم.");
      return;
    }

    if (cleanPassword.length < 6) {
      setMessage("كلمة المرور يجب أن تكون 6 أحرف على الأقل.");
      return;
    }

    if (isRegister && !memberId) {
      setMessage("اختر العضو المرتبط بهذا الحساب.");
      return;
    }

    setBusy(true);

    try {
      const email = usernameToFirebaseEmail(cleanUsername);

      if (isRegister) {
        const result = await createUserWithEmailAndPassword(
          auth,
          email,
          cleanPassword
        );

        const selectedMember = activeMembers.find((item) =>
          same(item.id, memberId)
        );

        await setDoc(doc(db, "users", result.user.uid), {
          username: cleanUsername,
          usernameKey: usernameKey(cleanUsername),
          memberId: cleanId(memberId),
          memberName: selectedMember?.name || "",
          role: "member",
          status: "active",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        return;
      }

      await signInWithEmailAndPassword(auth, email, cleanPassword);
    } catch (err) {
      console.error(err);
      setMessage(firebaseAuthMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="authShell" dir="rtl">
      <style>{authCss}</style>
      <section className="authCard">
        <div className="authLogo">FG</div>
        <p className="authKicker">{seasonTitle || "FIFA GROUP"}</p>
        <h1>{appTitle || "FIFA GROUP"}</h1>
        <p className="authSub">
          {isRegister
            ? "أنشئ حسابك باسم مستخدم وكلمة مرور، ثم اربطه بعضويتك."
            : "ادخل باسم المستخدم وكلمة المرور الخاصة بك."}
        </p>

        <form onSubmit={handleSubmit} className="authForm">
          <label>
            <span>اسم المستخدم</span>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="مثال: abdullah"
              autoComplete="username"
            />
          </label>

          <label>
            <span>كلمة المرور</span>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              type="password"
              autoComplete={isRegister ? "new-password" : "current-password"}
            />
          </label>

          {isRegister ? (
            <label>
              <span>اختر عضويتك</span>
              <select
                value={memberId}
                onChange={(event) => setMemberId(event.target.value)}
              >
                <option value="">اختر العضو</option>
                {activeMembers.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name || member.id}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {message ? <p className="authMessage">{message}</p> : null}

          <button type="submit" disabled={busy}>
            {busy ? "جاري التنفيذ..." : isRegister ? "إنشاء الحساب" : "دخول"}
          </button>
        </form>

        <button
          type="button"
          className="authSwitch"
          onClick={() => {
            setMode(isRegister ? "login" : "register");
            setMessage("");
          }}
        >
          {isRegister ? "لدي حساب بالفعل" : "إنشاء حساب جديد"}
        </button>
      </section>
    </main>
  );
}

function AuthMiniBadge({ profile, onLogout }) {
  const displayName = profile?.memberName || profile?.username || "عضو";

  return (
    <div className="authMiniBadge glassSoft">
      <span>أهلاً {displayName}</span>
      <button type="button" onClick={onLogout}>
        خروج
      </button>
    </div>
  );
}

function formatTransferDate(value) {
  if (value?.toDate) return value.toDate().toISOString().slice(0, 10);
  if (typeof value === "string") return value.slice(0, 10);
  return new Date().toISOString().slice(0, 10);
}

function usernameKey(value) {
  return String(value || "").trim().toLowerCase();
}

function usernameToFirebaseEmail(value) {
  const encoded = encodeURIComponent(usernameKey(value))
    .replace(/%/g, "p")
    .replace(/[^a-z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return `${encoded || "user"}@fifagroup.local`;
}

function firebaseAuthMessage(error) {
  const code = String(error?.code || "");
  if (code.includes("auth/email-already-in-use"))
    return "اسم المستخدم مستخدم مسبقًا.";
  if (code.includes("auth/invalid-credential"))
    return "اسم المستخدم أو كلمة المرور غير صحيحة.";
  if (code.includes("auth/user-not-found"))
    return "لا يوجد حساب بهذا الاسم.";
  if (code.includes("auth/wrong-password"))
    return "كلمة المرور غير صحيحة.";
  if (code.includes("auth/weak-password"))
    return "كلمة المرور ضعيفة. استخدم 6 أحرف على الأقل.";
  return "حدث خطأ. حاول مرة أخرى.";
}

const moneyCss = `
.memberActionPanel{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:14px 0;padding:14px;border-radius:22px}.memberActionPanel div{min-width:0;text-align:right}.memberActionPanel b{display:block;font-size:16px;color:#ecfeff;margin-bottom:4px}.memberActionPanel small{display:block;color:#a8b3c7;font-weight:800;line-height:1.45}.memberActionPanel button{min-width:132px;height:44px;border:0;border-radius:999px;cursor:pointer;color:#020617;font-weight:1000;background:linear-gradient(135deg,var(--cyan),var(--blue));box-shadow:0 14px 34px rgba(0,229,255,.18)}.memberActionPanel button:disabled{opacity:.45;cursor:not-allowed;filter:grayscale(.4)}.moneyModalBackdrop{position:fixed;inset:0;z-index:2147483640;background:rgba(0,0,0,.58);display:grid;place-items:center;padding:16px}.moneyTransferModal{width:min(430px,100%);border-radius:28px;padding:18px;color:#f8fafc;direction:rtl;font-family:Tahoma,Arial,sans-serif}.moneyTransferModal header{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}.moneyTransferModal header small{display:block;color:var(--cyan);font-weight:1000;margin-bottom:4px}.moneyTransferModal header h3{margin:0;font-size:25px}.moneyTransferModal header button{width:38px;height:38px;border:0;border-radius:999px;color:white;background:rgba(255,255,255,.10);font-size:24px;cursor:pointer}.moneyBalanceBox{border-radius:20px;padding:12px;display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}.moneyBalanceBox span{color:#a8b3c7;font-weight:900}.moneyBalanceBox b{font-size:26px;color:#ecfeff;direction:ltr}.moneyField{display:block;text-align:right;margin-bottom:10px}.moneyField span{display:block;color:#dbeafe;font-size:13px;font-weight:1000;margin-bottom:7px}.moneyField input,.moneyField select{width:100%;height:48px;border-radius:18px;border:1px solid rgba(255,255,255,.14);background:#0b1224;color:white;outline:none;padding:0 12px;font-weight:900}.moneyRecipientPreview{min-height:62px;border-radius:18px;padding:10px;display:flex;align-items:center;gap:10px;margin-bottom:10px}.moneyRecipientPreview img{width:42px;height:42px;border-radius:14px;background:white;object-fit:cover}.moneyRecipientPreview b,.moneyRecipientPreview small{display:block;text-align:right}.moneyRecipientPreview small{color:#a8b3c7;margin-top:3px}.moneyModalMessage{margin:8px 0 10px;padding:10px;border-radius:16px;background:rgba(255,255,255,.08);color:#e0f2fe;font-weight:900;text-align:center}.moneySubmitBtn{width:100%;height:50px;border:0;border-radius:18px;cursor:pointer;color:#020617;font-weight:1000;background:linear-gradient(135deg,var(--cyan),var(--blue))}.moneySubmitBtn:disabled{opacity:.6;cursor:not-allowed}.playerCard.hasOfferAction{position:relative;grid-template-columns:62px 1fr 48px;min-height:96px;overflow:hidden;padding-bottom:10px}.playerCard.hasOfferAction .playerOfferButton{height:28px;border:0;border-radius:999px;color:#020617;font-size:10px;font-weight:1000;cursor:pointer;padding:0 8px;background:linear-gradient(135deg,var(--cyan),var(--blue));box-shadow:0 8px 18px rgba(0,229,255,.12);white-space:nowrap}.playerOfferActions{position:absolute;right:86px;left:66px;bottom:12px;display:flex;align-items:center;gap:6px;min-width:0;overflow:hidden;z-index:2}.playerOfferActions.oneAction{left:66px}.playerOfferActions .playerOfferButton{flex:1 1 0;min-width:0;overflow:hidden;text-overflow:ellipsis}.playerOfferButton.edit{background:linear-gradient(135deg,#facc15,#fb923c)!important}.playerOfferButton.cancel{background:linear-gradient(135deg,#fecaca,#fb7185)!important}.topNotifyBtn{position:absolute;right:12px;top:50%;transform:translateY(-50%);width:38px;height:38px;border:1px solid rgba(255,255,255,.14);border-radius:999px;background:rgba(255,255,255,.08);color:white;display:grid;place-items:center;cursor:pointer}.topNotifyBtn span{position:absolute;top:-4px;left:-4px;min-width:18px;height:18px;padding:0 5px;border-radius:999px;background:#ef4444;color:white;font-size:10px;font-weight:1000;display:grid;place-items:center}.notificationsPanel{margin:14px 0;padding:14px;border-radius:22px}.notificationsHead{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px}.notificationsHead b{font-size:17px;color:#ecfeff}.notificationsHeadActions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end}.notificationsHead small{color:var(--cyan);font-weight:1000}.enableDeviceNotifyBtn{height:30px;border:1px solid rgba(0,229,255,.24);border-radius:999px;background:rgba(0,229,255,.12);color:#cffafe;font-weight:1000;font-size:11px;padding:0 10px;cursor:pointer}.enableDeviceNotifyBtn.active{background:rgba(34,197,94,.16);border-color:rgba(34,197,94,.35);color:#bbf7d0}.enableDeviceNotifyBtn:disabled{opacity:.65;cursor:not-allowed}.pushNotifyBox{margin:0 0 10px;padding:10px 12px;border-radius:18px;background:rgba(2,6,23,.28);border:1px solid rgba(255,255,255,.12)}.pushNotifyBox b,.pushNotifyBox small{display:block}.pushNotifyBox b{color:#ecfeff;font-size:13px;margin-bottom:4px}.pushNotifyBox small{color:#a8b3c7;line-height:1.45;font-weight:800}.pushNotifyBox.active{border-color:rgba(34,197,94,.32);background:rgba(34,197,94,.10)}.pushNotifyBox.error{border-color:rgba(248,113,113,.35);background:rgba(248,113,113,.10)}.pushNotifyBox.error small{color:#fecaca}.notificationsList{display:grid;gap:8px}.notificationItem{border-radius:18px;padding:11px;background:rgba(2,6,23,.28);border:1px solid rgba(0,229,255,.20)}.notificationItem.read{opacity:.68}.notificationItem b,.notificationItem p,.notificationItem small{display:block;margin:0}.notificationItem p{color:#cbd5e1;font-size:12px;line-height:1.45;margin-top:5px}.notificationItem small{color:#94a3b8;margin-top:6px}.notificationsModalBackdrop{position:fixed;inset:0;z-index:2147483643;background:rgba(0,0,0,.62);display:grid;place-items:center;padding:16px}.notificationsModal{width:min(520px,100%);max-height:min(88vh,760px);overflow:auto;border-radius:30px;padding:18px;color:#f8fafc;font-family:Tahoma,Arial,sans-serif}.notificationsModal>header{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}.notificationsModal>header small{display:block;color:var(--cyan);font-weight:1000}.notificationsModal>header h3{margin:0;font-size:25px}.notificationsModal>header button{width:38px;height:38px;border:0;border-radius:999px;background:rgba(255,255,255,.10);color:white;font-size:24px;cursor:pointer}.offerModalBackdrop{position:fixed;inset:0;z-index:2147483642;background:rgba(0,0,0,.62);display:grid;place-items:center;padding:16px}.playerOfferModal{width:min(560px,100%);max-height:min(92vh,820px);overflow:auto;border-radius:30px;padding:18px;color:#f8fafc;direction:rtl;font-family:Tahoma,Arial,sans-serif}.playerOfferModal header{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}.playerOfferModal header small{display:block;color:var(--cyan);font-weight:1000;margin-bottom:4px}.playerOfferModal header h3{margin:0;font-size:25px}.playerOfferModal header button{width:38px;height:38px;border:0;border-radius:999px;color:white;background:rgba(255,255,255,.10);font-size:24px;cursor:pointer}.offerTargetPlayer{display:grid;grid-template-columns:58px 1fr 54px;gap:12px;align-items:center;border-radius:22px;padding:12px;margin-bottom:10px}.offerTargetPlayer img{width:58px;height:58px;border-radius:18px;background:rgba(255,255,255,.08);object-fit:contain}.offerTargetPlayer b,.offerTargetPlayer small{display:block}.offerTargetPlayer small{color:#a8b3c7;margin-top:4px}.offerTargetPlayer strong{width:48px;height:48px;display:grid;place-items:center;border-radius:16px;background:linear-gradient(135deg,var(--cyan),var(--blue));color:#020617}.offerBalanceRow{display:flex;align-items:center;justify-content:space-between;border-radius:18px;padding:11px 12px;margin-bottom:10px}.offerBalanceRow span{color:#a8b3c7;font-weight:900}.offerBalanceRow b{font-size:22px;direction:ltr;color:#ecfeff}.offerField{display:block;margin-bottom:10px;text-align:right}.offerField>span,.offerOwnPlayersHead span{display:block;color:#dbeafe;font-size:13px;font-weight:1000;margin-bottom:7px}.offerField input,.offerField select,.offerField textarea{width:100%;border-radius:18px;border:1px solid rgba(255,255,255,.14);background:#0b1224;color:white;outline:none;padding:0 12px;font-weight:900}.offerField input,.offerField select{height:46px}.offerField textarea{min-height:74px;padding:12px;resize:vertical}.offerSegmented{display:grid;grid-template-columns:1fr 1fr;gap:8px}.offerSegmented button{height:44px;border-radius:16px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);color:white;font-weight:1000;cursor:pointer}.offerSegmented button.active{background:linear-gradient(135deg,var(--cyan),var(--blue));color:#020617;border-color:transparent}.offerOwnPlayers{margin:10px 0}.offerOwnPlayersHead{display:flex;align-items:center;justify-content:space-between}.offerOwnPlayersHead small{color:var(--cyan);font-weight:1000}.offerOwnPlayersGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;max-height:210px;overflow:auto;padding:2px}.offerOwnPlayer{min-width:0;border-radius:18px;border:1px solid rgba(255,255,255,.12);background:rgba(2,6,23,.28);color:white;padding:8px;display:flex;align-items:center;gap:8px;text-align:right;cursor:pointer}.offerOwnPlayer.active{border-color:rgba(0,229,255,.55);background:rgba(0,229,255,.16)}.offerOwnPlayer img{width:42px;height:42px;border-radius:14px;background:rgba(255,255,255,.08);object-fit:contain}.offerOwnPlayer b,.offerOwnPlayer small{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.offerOwnPlayer small{color:#a8b3c7;margin-top:3px}.offerSummary{border-radius:18px;padding:11px 12px;margin:8px 0 10px;display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center}.offerSummary span{color:#a8b3c7;font-weight:900}.offerSummary b{color:#ecfeff;direction:ltr}.offerSummary b.danger{color:#fecaca}.offerSubmitBtn{width:100%;height:50px;border:0;border-radius:18px;cursor:pointer;color:#020617;font-weight:1000;background:linear-gradient(135deg,var(--cyan),var(--blue))}.offerSubmitBtn:disabled{opacity:.6;cursor:not-allowed}@media(max-width:720px){.playerCard.hasOfferAction{min-height:84px;grid-template-columns:54px minmax(0,1fr) 52px;overflow:hidden}.playerOfferActions{right:72px;left:60px;bottom:10px}.offerModalBackdrop{align-items:end;padding:10px}.playerOfferModal{border-radius:28px 28px 0 0;max-height:88vh}.offerOwnPlayersGrid{grid-template-columns:1fr}.memberActionPanel{align-items:stretch;display:grid;gap:10px}.memberActionPanel button{width:100%;min-width:0}}
.transferSummaryStrip{display:grid;grid-template-columns:1fr auto 1fr auto;gap:10px;align-items:center;margin-top:12px;padding:12px 14px;border-radius:20px}.transferSummaryStrip span{color:#a8b3c7;font-weight:900;font-size:12px}.transferSummaryStrip b{min-width:38px;height:30px;display:grid;place-items:center;border-radius:12px;background:linear-gradient(135deg,var(--cyan),var(--blue));color:#020617;font-weight:1000}.transferSearchBox{display:grid;gap:7px;margin-top:10px;padding:11px 12px;border-radius:18px}.transferSearchBox span{color:#dbeafe;font-size:12px;font-weight:1000}.transferSearchBox input{width:100%;height:42px;border-radius:15px;border:1px solid rgba(255,255,255,.14);background:rgba(2,6,23,.45);color:white;outline:none;padding:0 12px;font-weight:900}.freeAgentsTransferSection{margin-top:16px;padding:14px;border-radius:24px}.freeAgentsTransferSection .sectionHead strong{min-width:42px;height:34px;display:grid;place-items:center;border-radius:14px;background:rgba(0,229,255,.14);color:#cffafe}.freeAgentsGrid{margin-top:10px}@media(max-width:720px){.transferSummaryStrip{grid-template-columns:1fr auto}.freeAgentsTransferSection{padding:12px}}.clickableNotification{width:100%;text-align:right;color:white;cursor:pointer}.disabledNotification{cursor:default;opacity:.55;filter:grayscale(.15)}.playerOwnerTools{margin-top:14px;padding:14px;border-radius:24px}.playerOwnerToolsHead{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}.playerOwnerToolsHead b{display:block;color:#ecfeff;font-size:18px}.playerOwnerToolsHead small{display:block;color:#a8b3c7;margin-top:4px;font-weight:800}.freeAgentFeeBtn{background:linear-gradient(135deg,#67e8f9,#22c55e)!important}.playerReleaseBtn{height:42px;border:0;border-radius:999px;padding:0 14px;cursor:pointer;font-weight:1000;color:#020617;background:linear-gradient(135deg,#fecaca,#fb7185)}.incomingOffersBox h3{margin:10px 0 12px;font-size:20px}.incomingOffersList{display:grid;gap:10px}.incomingOfferCard{border-radius:20px;padding:12px;background:rgba(2,6,23,.28);border:1px solid rgba(255,255,255,.12)}.incomingOfferTop{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}.incomingOfferTop b{font-size:17px;color:#ecfeff}.incomingOfferTop span{height:28px;border-radius:999px;padding:0 10px;display:inline-flex;align-items:center;background:rgba(0,229,255,.13);border:1px solid rgba(0,229,255,.22);color:#cffafe;font-weight:1000;font-size:12px}.incomingOfferMeta{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.incomingOfferMeta span{border-radius:14px;background:rgba(255,255,255,.06);padding:9px;min-width:0}.incomingOfferMeta small,.incomingOfferMeta strong{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.incomingOfferMeta small{color:#94a3b8;font-size:11px}.incomingOfferMeta strong{color:#ecfeff;margin-top:4px;direction:ltr}.incomingOfferedPlayers{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px}.incomingOfferedPlayers span{border-radius:999px;padding:5px 9px;background:rgba(255,255,255,.08);color:#e0f2fe;font-weight:900;font-size:12px}.incomingOfferNotes{margin:9px 0 0;color:#cbd5e1;font-size:12px;line-height:1.45}.incomingOfferActions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}.incomingOfferActions button{height:40px;border:0;border-radius:14px;font-weight:1000;cursor:pointer;color:#020617}.incomingOfferActions .accept{background:linear-gradient(135deg,#86efac,#22c55e)}.incomingOfferActions .reject{background:linear-gradient(135deg,#fecaca,#fb7185)}.fgConfirmBackdrop{position:fixed;inset:0;z-index:2147483646;background:rgba(0,0,0,.64);display:grid;place-items:center;padding:16px}.fgConfirmBox{width:min(390px,100%);border-radius:28px;padding:20px;color:#f8fafc;text-align:center;font-family:Tahoma,Arial,sans-serif}.fgConfirmIcon{width:52px;height:52px;margin:0 auto 10px;border-radius:18px;display:grid;place-items:center;font-weight:1000;color:#020617;background:linear-gradient(135deg,var(--cyan),var(--blue));font-size:24px}.fgConfirmIcon.danger{background:linear-gradient(135deg,#fecaca,#fb7185)}.fgConfirmIcon.success{background:linear-gradient(135deg,#86efac,#22c55e)}.fgConfirmBox h3{margin:0 0 8px;font-size:22px}.fgConfirmBox p{margin:0;color:#cbd5e1;line-height:1.6;font-size:14px}.fgConfirmActions{display:grid;grid-template-columns:1fr 1.2fr;gap:8px;margin-top:16px}.fgConfirmActions button{height:44px;border:0;border-radius:16px;font-weight:1000;cursor:pointer}.fgConfirmActions .secondary{background:rgba(255,255,255,.10);color:white;border:1px solid rgba(255,255,255,.14)}.fgConfirmActions .primary{background:linear-gradient(135deg,var(--cyan),var(--blue));color:#020617}.fgConfirmActions .danger{background:linear-gradient(135deg,#fecaca,#fb7185);color:#020617}@media(max-width:720px){.playerOwnerToolsHead{display:grid}.playerReleaseBtn{width:100%}.incomingOfferMeta{grid-template-columns:1fr}.incomingOfferActions{grid-template-columns:1fr}}.profileImageExportBtn{position:absolute;left:16px;bottom:16px;width:42px;height:42px;border:0;border-radius:999px;background:linear-gradient(135deg,var(--cyan),var(--blue));color:#020617;font-weight:1000;font-size:22px;display:grid;place-items:center;cursor:pointer;box-shadow:0 14px 32px rgba(0,0,0,.28)}.simpleCompetitionItem{min-height:58px!important;justify-content:center!important;text-align:center!important}.simpleCompetitionItem b{font-size:18px!important;color:#ecfeff}.competitionStatsBox .statsPanelGrid.compactStats{grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.competitionTypeShell{padding:16px!important}.competitionTypeGrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-top:10px}.competitionTypeCard{min-height:148px;border:1px solid rgba(255,255,255,.13);border-radius:26px;background:linear-gradient(135deg,rgba(0,229,255,.10),rgba(47,140,255,.055));display:grid;place-items:center;gap:8px;color:#ecfeff;cursor:pointer;text-align:center;padding:14px;box-shadow:inset 0 1px 0 rgba(255,255,255,.10)}.competitionTypeCard.active{border-color:rgba(0,229,255,.48);background:linear-gradient(135deg,rgba(0,229,255,.18),rgba(47,140,255,.12));transform:translateY(-1px)}.competitionTypeIcon{width:62px;height:62px;border-radius:20px;object-fit:cover;display:grid;place-items:center;background:rgba(255,255,255,.10);font-size:34px}.competitionTypeCard b{font-size:18px}.competitionTypeCard small{color:#a8b3c7;font-weight:900}.competitionInstanceList{display:grid;gap:10px;margin-top:14px}.competitionInstanceCard{display:flex;align-items:center;gap:12px;width:100%;min-height:74px;padding:12px 14px;border-radius:22px;border:1px solid rgba(255,255,255,.12);background:rgba(2,6,23,.30);color:#fff;text-align:right;cursor:pointer}.competitionInstanceCard.active{border-color:rgba(0,229,255,.42);background:rgba(0,229,255,.12)}.competitionInstanceIcon{width:46px;height:46px;border-radius:16px;object-fit:cover;display:grid;place-items:center;background:rgba(255,255,255,.10);font-size:24px;flex:0 0 auto}.competitionInstanceCard div{min-width:0;display:grid;gap:4px}.competitionInstanceCard b{font-size:17px;color:#ecfeff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.competitionInstanceCard small{color:#94a3b8;font-weight:900;font-size:12px}.competitionDetailHead{display:flex!important;align-items:center;gap:12px}.competitionDetailIcon{width:60px;height:60px;border-radius:20px;object-fit:cover;display:grid;place-items:center;background:rgba(255,255,255,.10);font-size:30px;flex:0 0 auto}.leagueMatchActions{display:grid;gap:6px}.dangerMiniBtn{background:linear-gradient(135deg,#fecaca,#fb7185)!important;color:#020617!important}.adminCompetitionInstanceList{max-height:520px;overflow:auto}.fallbackCompetitionIcon{line-height:1}@media(max-width:720px){.profileImageExportBtn{left:12px;bottom:12px;width:38px;height:38px}.competitionStatsBox .statsPanelGrid.compactStats{grid-template-columns:repeat(2,minmax(0,1fr))}}.offerCenterActions{grid-column:1/-1;display:flex;gap:8px;flex-wrap:wrap}.offerCenterActions button{height:34px;border:0;border-radius:12px;padding:0 12px;background:linear-gradient(135deg,var(--cyan),var(--blue));color:#020617;font-weight:1000}.offerCenterActions button.danger{background:linear-gradient(135deg,#fecaca,#fb7185)}.managedOfferCard{align-items:center}
.enableDeviceNotifyBtn.stop{background:linear-gradient(135deg,#fecaca,#fb7185)!important;color:#020617}.transferRestrictionBanner{margin:12px 0;padding:13px 14px;border-radius:20px;border:1px solid rgba(248,113,113,.28);background:rgba(127,29,29,.20)}.transferRestrictionBanner b{display:block;color:#fecaca;margin-bottom:7px}.transferRestrictionBanner p{margin:4px 0;color:#fee2e2;font-weight:900;font-size:12px;line-height:1.5}.restrictionChecks{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.restrictionChecks label{display:flex;gap:7px;align-items:center;border-radius:16px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);padding:10px;color:#e0f2fe;font-weight:900;font-size:12px}.adminDisciplineBox{margin-top:0}@media(max-width:720px){.restrictionChecks{grid-template-columns:1fr}}.fifaAdminShell{display:grid;gap:14px}.fifaAdminHero{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:18px;border-radius:28px}.fifaAdminHero h2{margin:2px 0 6px;font-size:30px;color:#f8fafc}.fifaAdminHero p{margin:0;color:#a8b3c7;font-weight:800;line-height:1.55}.fifaAdminHero strong{width:62px;height:62px;border-radius:22px;display:grid;place-items:center;background:linear-gradient(135deg,var(--cyan),var(--blue));font-size:30px}.adminGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.adminForm{display:grid;gap:10px}.adminForm textarea{width:100%;min-height:86px;border-radius:18px;border:1px solid rgba(255,255,255,.14);background:#0b1224;color:white;outline:none;padding:12px;font-weight:900;resize:vertical}.adminMessage{padding:12px 14px;border-radius:18px;color:#e0f2fe;font-weight:1000;text-align:center;border:1px solid rgba(0,229,255,.20)}.adminRecentBox h3{margin:0 0 10px;color:#e0f2fe}.sectionHead.compact{margin-bottom:0}.sectionHead.compact h3{margin:0}.sectionHead.compact p{margin:4px 0 0}@media(max-width:720px){.adminGrid{grid-template-columns:1fr}.fifaAdminHero h2{font-size:25px}.fifaAdminHero{align-items:flex-start}.fifaAdminHero strong{width:52px;height:52px}}
`;

const dealCss = `
.transferContractBtn{grid-column:1/-1;height:38px;border:1px solid rgba(0,229,255,.24);border-radius:999px;background:rgba(0,229,255,.12);color:#cffafe;font-weight:1000;cursor:pointer}.transferContractBtn:hover{background:rgba(0,229,255,.20)}.transferContractModal{width:min(560px,100%);max-height:min(92vh,820px);overflow:auto;border-radius:30px;padding:18px;color:#f8fafc;font-family:Tahoma,Arial,sans-serif}.transferContractModal header{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}.transferContractModal header small{display:block;color:var(--cyan);font-weight:1000;margin-bottom:4px}.transferContractModal header h3{margin:0;font-size:25px}.transferContractModal header button{width:38px;height:38px;border:0;border-radius:999px;color:white;background:rgba(255,255,255,.10);font-size:24px;cursor:pointer}.transferContractCard{position:relative;overflow:hidden;border-radius:28px;padding:18px;margin-bottom:12px}.contractWatermark{position:absolute;left:16px;top:10px;font-size:92px;font-weight:1000;color:rgba(255,255,255,.035);letter-spacing:-6px}.contractTopLine{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:14px}.contractTopLine span{color:#a8b3c7;font-weight:900}.contractTopLine b{height:32px;border-radius:999px;padding:0 12px;display:inline-flex;align-items:center;background:rgba(0,229,255,.15);border:1px solid rgba(0,229,255,.24);color:#cffafe}.contractPlayerBlock{display:grid;grid-template-columns:78px 1fr 58px;gap:12px;align-items:center;border-radius:22px;padding:12px;background:rgba(2,6,23,.24);border:1px solid rgba(255,255,255,.10)}.contractPlayerBlock img{width:78px;height:78px;border-radius:22px;object-fit:contain;background:rgba(255,255,255,.08)}.contractPlayerBlock h2{margin:0;font-size:28px;line-height:1.15}.contractPlayerBlock p{margin:6px 0 0;color:#a8b3c7;font-weight:900}.contractPlayerBlock strong{width:56px;height:56px;border-radius:18px;display:grid;place-items:center;background:linear-gradient(135deg,var(--cyan),var(--blue));color:#020617;font-size:24px;font-weight:1000}.contractRoute{display:grid;grid-template-columns:1fr auto 1fr;gap:10px;align-items:center;margin:12px 0}.contractRoute>div{border-radius:18px;padding:12px;background:rgba(255,255,255,.06);text-align:center}.contractRoute span{color:var(--cyan);font-weight:1000;font-size:24px}.contractRoute small,.contractMetaGrid small,.contractSignatures small{display:block;color:#94a3b8;font-size:12px;font-weight:900}.contractRoute b,.contractMetaGrid b{display:block;color:#f8fafc;margin-top:5px;font-size:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.contractMetaGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.contractMetaGrid div{border-radius:16px;padding:10px;background:rgba(255,255,255,.055);text-align:center}.contractSwapPlayers{margin-top:12px;border-radius:18px;padding:10px;background:rgba(255,255,255,.055)}.contractSwapPlayers>small{display:block;color:#94a3b8;font-weight:900;margin-bottom:8px}.contractSwapPlayers>div{display:flex;gap:8px;flex-wrap:wrap}.contractSwapPlayers span{display:flex;align-items:center;gap:6px;border-radius:999px;background:rgba(255,255,255,.08);padding:5px 9px}.contractSwapPlayers img{width:28px;height:28px;border-radius:999px;object-fit:contain;background:rgba(255,255,255,.08)}.contractSwapPlayers b{color:#e0f2fe;font-size:12px}.contractSignatures{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px}.contractSignatures div{border-radius:18px;padding:12px;background:rgba(2,6,23,.22);border:1px solid rgba(255,255,255,.10);text-align:center}.contractSignatures span{display:block;width:80%;height:1px;margin:0 auto 8px;background:rgba(255,255,255,.24)}.contractSignatures b{display:block;color:#e0f2fe;margin-bottom:4px}.playerTransferHistoryBox{margin-top:14px;padding:14px;border-radius:24px}.playerTransferHistoryList{display:grid;gap:8px}.playerTransferHistoryItem{border-radius:18px;padding:11px;background:rgba(2,6,23,.28);border:1px solid rgba(255,255,255,.12);display:grid;gap:4px}.playerTransferHistoryItem span{color:#67e8f9;font-weight:1000;font-size:12px}.playerTransferHistoryItem b{color:#f8fafc}.playerTransferHistoryItem small{color:#a8b3c7;font-weight:900}@media(max-width:720px){.transferContractModal{border-radius:28px 28px 0 0;max-height:88vh}.contractPlayerBlock{grid-template-columns:64px 1fr 50px}.contractPlayerBlock img{width:64px;height:64px}.contractPlayerBlock h2{font-size:22px}.contractRoute,.contractMetaGrid,.contractSignatures{grid-template-columns:1fr}.contractRoute span{display:none}}.freeAgentUnavailable{opacity:.68;filter:saturate(.7)}.dealSummaryGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:10px 0 14px}.dealSummaryGrid div{border-radius:18px;padding:12px;background:rgba(2,6,23,.28);border:1px solid rgba(255,255,255,.12);text-align:center}.dealSummaryGrid small{display:block;color:#94a3b8;font-weight:900;margin-bottom:6px}.dealSummaryGrid b{font-size:26px;color:#ecfeff}.dealSectionTitle{margin:16px 0 10px;color:#e0f2fe;font-size:17px}.memberDealList{display:grid;gap:9px}.memberDealCard{display:grid;grid-template-columns:54px minmax(0,1fr) auto;gap:10px;align-items:center;border-radius:18px;padding:10px;background:rgba(2,6,23,.28);border:1px solid rgba(255,255,255,.12)}.memberDealCard.offer{border-color:rgba(0,229,255,.18)}.memberDealCard img{width:54px;height:54px;border-radius:16px;object-fit:contain;background:rgba(255,255,255,.08)}.memberDealCard b,.memberDealCard small,.memberDealCard p{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin:0}.memberDealCard b{color:#f8fafc;font-size:16px}.memberDealCard small{color:#67e8f9;font-weight:900;margin-top:3px}.memberDealCard p{color:#a8b3c7;font-size:12px;margin-top:4px}.memberDealCard strong{font-size:13px;color:#ecfeff;direction:ltr;max-width:120px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.transferSwapPreview{grid-column:1/-1;display:flex;gap:7px;flex-wrap:wrap;margin-top:2px}.transferSwapPreview span,.miniSwapPlayers span{display:inline-flex;align-items:center;gap:6px;max-width:100%;border-radius:999px;background:rgba(255,255,255,.08);padding:5px 8px;color:#e0f2fe;font-size:11px;font-weight:900}.transferSwapPreview img,.miniSwapPlayers img{width:26px;height:26px;border-radius:999px;object-fit:contain;background:rgba(255,255,255,.08)}.freeAgentFilters{margin:10px 0}.dealPeriodGroup{display:grid;gap:8px}.dealPeriodTitle{display:flex;align-items:center;justify-content:space-between;border-radius:16px;padding:9px 11px;background:rgba(0,229,255,.09);border:1px solid rgba(0,229,255,.16)}.dealPeriodTitle b{color:#e0f2fe}.dealPeriodTitle span{color:#67e8f9;font-size:12px;font-weight:1000}.miniSwapPlayers{display:flex;gap:6px;flex-wrap:wrap;margin-top:7px}@media(max-width:720px){.dealSummaryGrid{grid-template-columns:1fr 1fr}.memberDealCard{grid-template-columns:48px minmax(0,1fr);}.memberDealCard strong{grid-column:1/-1;max-width:none;text-align:center;background:rgba(255,255,255,.06);border-radius:12px;padding:7px}}
.adminTabs{display:flex;gap:8px;overflow:auto;padding:8px;border-radius:22px}.adminTabs button{height:38px;border:1px solid rgba(255,255,255,.12);border-radius:999px;background:rgba(255,255,255,.06);color:#dbeafe;font-weight:1000;padding:0 13px;white-space:nowrap;cursor:pointer}.adminTabs button.active{background:linear-gradient(135deg,var(--cyan),var(--blue));color:#020617;border-color:transparent}.adminStatsGrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.adminStatBox,.adminDecisionCard{border-radius:18px;padding:12px;background:rgba(2,6,23,.28);border:1px solid rgba(255,255,255,.12)}.adminStatBox{text-align:center}.adminStatBox small,.adminMonitorGrid small{display:block;color:#94a3b8;font-weight:900;margin-bottom:6px}.adminStatBox b,.adminMonitorGrid b{display:block;color:#ecfeff;font-size:22px}.adminHealthList{display:grid;gap:8px}.adminHealthList p{margin:0;border-radius:14px;background:rgba(255,255,255,.06);padding:10px;color:#cbd5e1}.adminHealthList b{color:#e0f2fe}.adminMonitorGrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-bottom:10px}.adminMonitorGrid div{border-radius:16px;padding:10px;background:rgba(255,255,255,.06);text-align:center}.inlineAdminBtn{margin-top:8px;height:32px;border:0;border-radius:999px;background:rgba(0,229,255,.16);color:#cffafe;font-weight:1000;padding:0 10px;cursor:pointer}.inlineAdminBtn.danger,.dangerBtn{background:linear-gradient(135deg,#fecaca,#fb7185)!important;color:#020617!important}.adminCheckLine{display:flex;align-items:center;gap:8px;color:#e0f2fe;font-weight:900;border-radius:16px;background:rgba(255,255,255,.06);padding:10px}.compactList{margin-top:10px}@media(max-width:720px){.adminStatsGrid,.adminMonitorGrid{grid-template-columns:repeat(2,minmax(0,1fr))}.adminTabs{padding:6px}.adminTabs button{height:34px;padding:0 10px}}`;

const leagueAdminCss = `
.leagueAdminShell{display:grid;gap:14px}.leagueMembersGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;max-height:260px;overflow:auto;padding:2px}.leagueRewardGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.leagueRuleNote{border-radius:16px;border:1px solid rgba(0,229,255,.20);background:rgba(0,229,255,.08);padding:9px 10px;color:#cffafe;font-size:12px;font-weight:900;line-height:1.7}.adminCheckLine{display:flex;align-items:center;gap:8px;color:#e0f2fe;font-weight:900}.adminCheckLine input{width:18px;height:18px}.leagueMembersGrid.compact{max-height:none}.leagueMemberPick{display:flex;align-items:center;gap:8px;min-width:0;border-radius:16px;padding:9px;border:1px solid rgba(255,255,255,.12);background:rgba(2,6,23,.28);color:#e0f2fe;font-weight:900;cursor:pointer}.leagueMemberPick.active{border-color:rgba(0,229,255,.45);background:rgba(0,229,255,.12)}.leagueMemberPick.relegated.active{border-color:rgba(248,113,113,.45);background:rgba(127,29,29,.20)}.leagueMemberPick img{width:34px;height:34px;border-radius:12px;object-fit:cover;background:rgba(255,255,255,.08)}.activeLeagueItem{border-color:rgba(0,229,255,.34)!important;background:rgba(0,229,255,.10)!important}.leagueSummaryStrip{display:grid;grid-template-columns:repeat(4,1fr auto);gap:8px;align-items:center;margin-top:10px}.leagueSummaryStrip span{color:#94a3b8;font-weight:900;font-size:12px}.leagueSummaryStrip b{min-height:32px;border-radius:13px;padding:6px 9px;display:grid;place-items:center;background:rgba(255,255,255,.07);color:#ecfeff}.leagueTable{display:grid;gap:6px;margin-top:10px;overflow:auto}.leagueTableHead,.leagueTableRow{display:grid;grid-template-columns:32px minmax(90px,1.6fr) repeat(8,minmax(42px,.55fr));gap:6px;align-items:center;min-width:620px}.leagueTableHead span{color:#67e8f9;font-weight:1000;font-size:11px;text-align:center}.leagueTableRow{border-radius:16px;padding:8px;background:rgba(2,6,23,.28);border:1px solid rgba(255,255,255,.10)}.leagueTableRow span,.leagueTableRow b{text-align:center;color:#e2e8f0;font-weight:900}.leagueTableRow span:nth-child(2){text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.leagueTableRow.champion{border-color:rgba(250,204,21,.70);background:rgba(250,204,21,.10)}.leagueTableRow.qualified{border-color:rgba(34,197,94,.46);background:rgba(34,197,94,.11)}.leagueTableRow.relegated{border-color:rgba(248,113,113,.58);background:rgba(127,29,29,.20)}.leagueRoundsList{display:grid;gap:12px}.leagueRoundBox{border-radius:20px;padding:10px;background:rgba(2,6,23,.22);border:1px solid rgba(255,255,255,.10)}.leagueRoundBox h4{margin:0 0 8px;color:#e0f2fe}.leagueMatchesList{display:grid;gap:8px}.leagueMatchCard{display:grid;grid-template-columns:1.4fr minmax(92px,.7fr) auto minmax(92px,.6fr) auto;gap:8px;align-items:center;border-radius:16px;padding:9px;background:rgba(255,255,255,.055);border:1px solid rgba(255,255,255,.10)}.leagueMatchCard.completed{border-color:rgba(0,229,255,.24);background:rgba(0,229,255,.08)}.leagueMatchTeams{display:grid;grid-template-columns:1fr auto 1fr;gap:8px;align-items:center}.leagueMatchTeams b{color:#f8fafc;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.leagueMatchTeams span{color:#67e8f9;font-weight:1000}.leagueMatchMeta{display:grid;gap:2px;justify-items:center}.leagueMatchMeta span{border-radius:999px;padding:5px 9px;background:rgba(0,229,255,.12);border:1px solid rgba(0,229,255,.22);color:#67e8f9;font-weight:1000;font-size:11px}.leagueMatchMeta small{color:#94a3b8;font-size:10px}.leagueGameSelect{height:36px;border-radius:12px;border:1px solid rgba(255,255,255,.14);background:#0b1224;color:white;font-weight:900}.playoffBadge{display:inline-flex;margin-inline-start:6px;border-radius:999px;padding:2px 6px;background:rgba(251,191,36,.16);color:#fde68a;font-style:normal;font-size:10px}.leagueMatchScore{display:flex;align-items:center;gap:6px}.leagueMatchScore input{width:44px;height:36px;border-radius:12px;border:1px solid rgba(255,255,255,.14);background:#0b1224;color:white;text-align:center;font-weight:1000}.leagueMatchScore strong{color:#94a3b8}.leagueMatchCard button{height:36px;border:0;border-radius:13px;padding:0 12px;background:linear-gradient(135deg,var(--cyan),var(--blue));color:#020617;font-weight:1000;cursor:pointer}.leagueMatchCard button:disabled{opacity:.55;cursor:not-allowed} .leagueTableRow.absent{border-color:rgba(251,191,36,.42);background:rgba(113,63,18,.18)}.leagueMemberPick.absent.active{border-color:rgba(251,191,36,.48);background:rgba(113,63,18,.20)}.absentBadge{display:inline-flex;margin-inline-start:6px;border-radius:999px;padding:2px 6px;background:rgba(251,191,36,.16);color:#fde68a;font-style:normal;font-size:10px}.imageActionRow{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.imageActionRow button{height:38px;border:1px solid rgba(0,229,255,.24);border-radius:999px;background:rgba(0,229,255,.12);color:#cffafe;font-weight:1000;cursor:pointer;padding:0 12px}.imageActionRow button:disabled{opacity:.45;cursor:not-allowed}.seasonHubPage{display:grid;gap:14px}.seasonHubHero p{display:none}.seasonHubTabs{margin:0}.rankingList.compact{display:grid;gap:8px}.dangerZone{border-color:rgba(248,113,113,.22)!important}.moneySubmitBtn.danger{background:linear-gradient(135deg,#fecaca,#fb7185)!important}.leagueMatchScore.pens input{border-color:rgba(251,191,36,.28)}@media(max-width:720px){.leagueMembersGrid,.leagueRewardGrid{grid-template-columns:1fr}.leagueSummaryStrip{grid-template-columns:repeat(2,1fr auto)}.leagueMatchCard{grid-template-columns:1fr}.leagueMatchTeams{grid-template-columns:1fr auto 1fr}.leagueMatchCard button,.leagueGameSelect{width:100%}.imageActionRow{display:grid}.imageActionRow button{width:100%}}
`;

const authCss = `
.authShell{
  min-height:100vh;
  width:100%;
  display:grid;
  place-items:center;
  padding:18px;
  color:#f8fafc;
  font-family:Tahoma,Arial,sans-serif;
  background:
    radial-gradient(circle at 15% 10%,rgba(0,229,255,.20),transparent 28%),
    radial-gradient(circle at 90% 8%,rgba(139,92,246,.18),transparent 30%),
    linear-gradient(135deg,#020617 0%,#07111f 48%,#030712 100%);
}
.authCard{
  width:min(420px,100%);
  border-radius:30px;
  padding:24px;
  text-align:center;
  background:linear-gradient(135deg,rgba(255,255,255,.14),rgba(255,255,255,.055));
  border:1px solid rgba(255,255,255,.18);
  box-shadow:0 26px 90px rgba(0,0,0,.42),inset 0 1px 0 rgba(255,255,255,.22);
  backdrop-filter:blur(26px) saturate(150%);
  -webkit-backdrop-filter:blur(26px) saturate(150%);
}
.authLogo{
  width:74px;
  height:74px;
  margin:0 auto 14px;
  border-radius:24px;
  display:grid;
  place-items:center;
  color:#020617;
  font-weight:1000;
  font-size:28px;
  background:linear-gradient(135deg,#00e5ff,#2f8cff);
  box-shadow:0 18px 40px rgba(0,229,255,.18);
}
.authKicker{
  margin:0 0 6px;
  color:#67e8f9;
  font-weight:1000;
  letter-spacing:.5px;
}
.authCard h1{
  margin:0;
  font-size:34px;
  line-height:1.1;
}
.authSub{
  margin:10px auto 20px;
  color:#b8c6dc;
  line-height:1.55;
  font-weight:800;
}
.authForm{
  display:grid;
  gap:12px;
}
.authForm label{
  display:grid;
  gap:7px;
  text-align:right;
}
.authForm span{
  color:#dbeafe;
  font-size:13px;
  font-weight:1000;
}
.authForm input,
.authForm select{
  height:48px;
  border-radius:17px;
  border:1px solid rgba(255,255,255,.14);
  background:rgba(2,6,23,.46);
  color:white;
  outline:none;
  padding:0 14px;
  font-size:16px;
}
.authForm select option{
  color:#020617;
}
.authForm button{
  height:50px;
  margin-top:4px;
  border:0;
  border-radius:18px;
  color:#020617;
  font-size:16px;
  font-weight:1000;
  background:linear-gradient(135deg,#00e5ff,#2f8cff);
  cursor:pointer;
}
.authForm button:disabled{
  opacity:.65;
  cursor:not-allowed;
}
.authMessage{
  margin:0;
  padding:10px 12px;
  border-radius:14px;
  color:#fecaca;
  background:rgba(239,68,68,.12);
  border:1px solid rgba(239,68,68,.24);
  font-weight:900;
}
.authSwitch{
  margin-top:14px;
  border:0;
  background:transparent;
  color:#67e8f9;
  font-weight:1000;
  cursor:pointer;
}
.authMiniBadge{
  position:fixed;
  top:calc(48px + env(safe-area-inset-top));
  left:12px;
  z-index:2147483500;
  height:34px;
  display:flex;
  align-items:center;
  gap:8px;
  padding:0 8px 0 12px;
  border-radius:999px;
  direction:rtl;
}
.authMiniBadge span{
  max-width:120px;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
  color:#e0f2fe;
  font-size:12px;
  font-weight:1000;
}
.authMiniBadge button{
  height:24px;
  border:0;
  border-radius:999px;
  padding:0 9px;
  background:rgba(255,255,255,.12);
  color:white;
  font-size:11px;
  font-weight:1000;
  cursor:pointer;
}
@media(max-width:720px){
  .authMiniBadge{
    top:calc(44px + env(safe-area-inset-top));
    left:8px;
  }
}
`;



function generateLeagueRoundRobinMatches(participants = [], roundsMode = "single") {
  const base = (participants || []).map((item) => ({ ...item }));
  if (base.length < 2) return [];
  const hasBye = base.length % 2 === 1;
  const teams = hasBye ? [...base, { memberId: "__bye__", memberName: "راحة" }] : base.slice();
  const rounds = teams.length - 1;
  const half = teams.length / 2;
  const generated = [];
  let rotating = teams.slice();

  for (let round = 1; round <= rounds; round += 1) {
    for (let i = 0; i < half; i += 1) {
      const a = rotating[i];
      const b = rotating[rotating.length - 1 - i];
      if (!a || !b || a.memberId === "__bye__" || b.memberId === "__bye__") continue;
      const swap = round % 2 === 0;
      const home = swap ? b : a;
      const away = swap ? a : b;
      generated.push({
        id: `R${round}-M${i + 1}-${cleanId(home.memberId)}-${cleanId(away.memberId)}`,
        round,
        leg: 1,
        homeMemberId: cleanId(home.memberId),
        homeName: home.memberName || home.name || cleanId(home.memberId),
        awayMemberId: cleanId(away.memberId),
        awayName: away.memberName || away.name || cleanId(away.memberId),
        homeGoals: "",
        awayGoals: "",
        status: "scheduled",
        resultStatus: "scheduled",
      });
    }
    const fixed = rotating[0];
    const rest = rotating.slice(1);
    rest.unshift(rest.pop());
    rotating = [fixed, ...rest];
  }

  if (clean(roundsMode) === "double") {
    const secondLeg = generated.map((match) => ({
      ...match,
      id: match.id.replace(/^R(\d+)/, (full, n) => `R${Number(n) + rounds}`) + "-L2",
      round: match.round + rounds,
      leg: 2,
      homeMemberId: match.awayMemberId,
      homeName: match.awayName,
      awayMemberId: match.homeMemberId,
      awayName: match.homeName,
      homeGoals: "",
      awayGoals: "",
      status: "scheduled",
      resultStatus: "scheduled",
    }));
    return [...generated, ...secondLeg];
  }

  return generated;
}

function computeLeagueStandings(participants = [], matches = []) {
  const table = new Map();
  (participants || []).forEach((item) => {
    const memberId = cleanId(item.memberId || item.id);
    if (!memberId || memberId === "__bye__") return;
    table.set(memberId, {
      memberId,
      memberName: item.memberName || item.name || memberId,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 0,
    });
  });

  (matches || []).forEach((match) => {
    if (clean(match.resultStatus || match.status) !== "completed") return;
    const homeId = cleanId(match.homeMemberId);
    const awayId = cleanId(match.awayMemberId);
    const home = table.get(homeId);
    const away = table.get(awayId);
    if (!home || !away) return;
    const hg = toNumber(match.homeGoals);
    const ag = toNumber(match.awayGoals);
    home.played += 1;
    away.played += 1;
    home.goalsFor += hg;
    home.goalsAgainst += ag;
    away.goalsFor += ag;
    away.goalsAgainst += hg;
    if (hg > ag) {
      home.wins += 1;
      away.losses += 1;
      home.points += 3;
    } else if (ag > hg) {
      away.wins += 1;
      home.losses += 1;
      away.points += 3;
    } else {
      home.draws += 1;
      away.draws += 1;
      home.points += 1;
      away.points += 1;
    }
  });

  const rows = Array.from(table.values()).map((row) => ({
    ...row,
    goalDifference: row.goalsFor - row.goalsAgainst,
  }));
  return annotateLeagueStandings(rows.sort(compareLeagueStanding));
}

function compareLeagueStanding(a, b) {
  return (
    toNumber(b.points) - toNumber(a.points) ||
    toNumber(b.goalDifference) - toNumber(a.goalDifference) ||
    toNumber(b.goalsFor) - toNumber(a.goalsFor) ||
    toNumber(a.goalsAgainst) - toNumber(b.goalsAgainst) ||
    clean(a.memberName).localeCompare(clean(b.memberName), "ar")
  );
}

function leagueStandingTieKey(row) {
  return [
    toNumber(row.points),
    toNumber(row.goalDifference),
    toNumber(row.goalsFor),
    toNumber(row.goalsAgainst),
  ].join("|");
}

function annotateLeagueStandings(rows = []) {
  const map = new Map();
  (rows || []).forEach((row) => {
    const key = leagueStandingTieKey(row);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row.memberId);
  });
  return (rows || []).map((row) => ({
    ...row,
    needsPlayoff: (map.get(leagueStandingTieKey(row)) || []).length > 1,
    playoffMemberIds: map.get(leagueStandingTieKey(row)) || [],
  }));
}

function buildCompetitionStats(competition = {}) {
  const typeKey = competitionTypeKey(competition.type || "league");
  const matches = (competition.matches || []).filter((match) => clean(match.resultStatus || match.status) === "completed" && clean(match.phase || "") !== "bye");
  const participantMap = new Map();
  (competition.participants || []).forEach((item) => {
    const memberId = cleanId(item.memberId || item.id);
    if (!memberId || String(memberId).startsWith("__") || memberId === "__bye__") return;
    participantMap.set(memberId, { memberId, memberName: item.memberName || item.name || memberId });
  });
  matches.forEach((match) => {
    [[match.homeMemberId, match.homeName], [match.awayMemberId, match.awayName]].forEach(([id, name]) => {
      const memberId = cleanId(id);
      if (!memberId || String(memberId).startsWith("__") || memberId === "__bye__") return;
      if (!participantMap.has(memberId)) participantMap.set(memberId, { memberId, memberName: name || memberId });
    });
  });
  const standings = computeLeagueStandings(Array.from(participantMap.values()), matches);
  const championRow = typeKey === "league" ? standings[0] : getKnockoutChampion(competition);
  const champion = competition.championMemberName || championRow?.memberName || "-";
  const playedRows = standings.filter((row) => toNumber(row.played) > 0);
  const topScorer = playedRows.slice().sort((a, b) => toNumber(b.goalsFor) - toNumber(a.goalsFor) || clean(a.memberName).localeCompare(clean(b.memberName), "ar"))[0];
  const bestAttack = topScorer;
  const bestDefense = playedRows.slice().sort((a, b) => toNumber(a.goalsAgainst) - toNumber(b.goalsAgainst) || clean(a.memberName).localeCompare(clean(b.memberName), "ar"))[0];
  const mostConceded = playedRows.slice().sort((a, b) => toNumber(b.goalsAgainst) - toNumber(a.goalsAgainst) || clean(a.memberName).localeCompare(clean(b.memberName), "ar"))[0];
  const mostWins = playedRows.slice().sort((a, b) => toNumber(b.wins) - toNumber(a.wins) || clean(a.memberName).localeCompare(clean(b.memberName), "ar"))[0];
  const mostLosses = playedRows.slice().sort((a, b) => toNumber(b.losses) - toNumber(a.losses) || clean(a.memberName).localeCompare(clean(b.memberName), "ar"))[0];
  const totalGoals = matches.reduce((sum, match) => sum + toNumber(match.homeGoals) + toNumber(match.awayGoals), 0);
  return { champion, topScorer, bestAttack, bestDefense, mostConceded, mostWins, mostLosses, totalGoals, matchesPlayed: matches.length };
}

function CompetitionStatsBox({ competition }) {
  if (competitionTypeKey(competition?.type || "") === "super_cup") return null;
  const stats = buildCompetitionStats(competition || {});
  const isLeague = clean(competition?.type || "league") === "league";
  return (
    <section className="sectionBox glassSoft competitionStatsBox">
      <div className="sectionHead compact"><div><h3>إحصائيات البطولة</h3></div></div>
      <div className="statsPanelGrid compactStats">
        <StatCard icon="🏆" value={stats.champion || "-"} label={isLeague ? "البطل الحالي" : "بطل البطولة"} />
        <StatCard icon="⚽" value={stats.totalGoals} label="إجمالي الأهداف" />
        <StatCard icon="🔥" value={stats.topScorer?.memberName || "-"} label={stats.topScorer ? `أكثر تسجيلًا (${stats.topScorer.goalsFor})` : "أكثر تسجيلًا"} />
        <StatCard icon="🛡️" value={stats.bestDefense?.memberName || "-"} label={stats.bestDefense ? `أفضل دفاع (${stats.bestDefense.goalsAgainst})` : "أفضل دفاع"} />
        <StatCard icon="🥅" value={stats.mostConceded?.memberName || "-"} label={stats.mostConceded ? `الأكثر استقبالًا (${stats.mostConceded.goalsAgainst})` : "الأكثر استقبالًا"} />
        <StatCard icon="✅" value={stats.mostWins?.memberName || "-"} label={stats.mostWins ? `الأكثر فوزًا (${stats.mostWins.wins})` : "الأكثر فوزًا"} />
      </div>
    </section>
  );
}

function isAbdullahLike(member = {}) {
  const id = cleanId(member.memberId || member.id);
  const name = String(member.memberName || member.name || "").replace(/\s+/g, "");
  return same(id, "1") || name.includes("عبدالله") || name.includes("عبداللّه") || name.includes("عبد الله".replace(/\s+/g, ""));
}

function assignLeagueGamePlatforms(matches = [], participants = [], options = {}) {
  const onlineMemberId = cleanId(options.onlineMemberId || (participants.find(isAbdullahLike)?.memberId) || "");
  const maxFifaPerRound = Math.max(1, toNumber(options.maxFifaPerRound ?? 2));
  const nonOnlineIds = (participants || [])
    .map((item) => cleanId(item.memberId || item.id))
    .filter((id) => id && !same(id, onlineMemberId));
  const totalCounts = new Map(nonOnlineIds.map((id) => [id, 0]));
  const onlineCounts = new Map(nonOnlineIds.map((id) => [id, 0]));
  const extraCounts = new Map(nonOnlineIds.map((id) => [id, 0]));

  const rows = (matches || []).map((match) => ({
    ...match,
    gameTitle: "PES 2017",
    gameCode: "pes17",
    gameReason: "النظام الأساسي",
  }));

  const byRound = new Map();
  rows.forEach((match, index) => {
    const round = toNumber(match.round || 1) || 1;
    if (!byRound.has(round)) byRound.set(round, []);
    byRound.get(round).push(index);
  });

  Array.from(byRound.keys()).sort((a, b) => a - b).forEach((round) => {
    const indexes = byRound.get(round) || [];
    let fifaThisRound = 0;

    indexes.forEach((index) => {
      const match = rows[index];
      const homeId = cleanId(match.homeMemberId);
      const awayId = cleanId(match.awayMemberId);
      if (onlineMemberId && (same(homeId, onlineMemberId) || same(awayId, onlineMemberId))) {
        const otherId = same(homeId, onlineMemberId) ? awayId : homeId;
        if (onlineCounts.has(otherId)) onlineCounts.set(otherId, (onlineCounts.get(otherId) || 0) + 1);
        if (totalCounts.has(otherId)) totalCounts.set(otherId, (totalCounts.get(otherId) || 0) + 1);
        rows[index] = { ...match, gameTitle: "FIFA 2025", gameCode: "fifa25", gameReason: "مباراة أونلاين" };
        fifaThisRound += 1;
      }
    });

    const candidates = indexes
      .filter((index) => clean(rows[index].gameCode) !== "fifa25")
      .filter((index) => totalCounts.has(cleanId(rows[index].homeMemberId)) && totalCounts.has(cleanId(rows[index].awayMemberId)))
      .sort((a, b) => {
        const ah = totalCounts.get(cleanId(rows[a].homeMemberId)) || 0;
        const aa = totalCounts.get(cleanId(rows[a].awayMemberId)) || 0;
        const bh = totalCounts.get(cleanId(rows[b].homeMemberId)) || 0;
        const ba = totalCounts.get(cleanId(rows[b].awayMemberId)) || 0;
        return (ah + aa) - (bh + ba) || Math.max(ah, aa) - Math.max(bh, ba) || a - b;
      });

    for (const index of candidates) {
      if (fifaThisRound >= maxFifaPerRound) break;
      const match = rows[index];
      const homeId = cleanId(match.homeMemberId);
      const awayId = cleanId(match.awayMemberId);
      rows[index] = { ...match, gameTitle: "FIFA 2025", gameCode: "fifa25", gameReason: "توزيع عادل داخل الجولة" };
      extraCounts.set(homeId, (extraCounts.get(homeId) || 0) + 1);
      extraCounts.set(awayId, (extraCounts.get(awayId) || 0) + 1);
      totalCounts.set(homeId, (totalCounts.get(homeId) || 0) + 1);
      totalCounts.set(awayId, (totalCounts.get(awayId) || 0) + 1);
      fifaThisRound += 1;
    }
  });

  return {
    matches: rows,
    gameQuota: {
      onlineMemberId,
      maxFifaPerRound,
      onlineCounts: Object.fromEntries(onlineCounts),
      extraCounts: Object.fromEntries(extraCounts),
      totalCounts: Object.fromEntries(totalCounts),
      warnings: [],
    },
  };
}

function applyCompetitionGameMode(matches = [], options = {}) {
  const mode = ["auto", "fifa2025_only", "pes2017_only", "mixed_manual"].includes(clean(options.gameDistributionMode || "auto")) ? clean(options.gameDistributionMode || "auto") : "auto";
  const rows = (matches || []).map((match) => ({ ...match }));
  if (mode === "auto") return rows;
  const playableIndexes = rows
    .map((match, index) => ({ match, index }))
    .filter(({ match }) => clean(match.phase || "") !== "bye" && clean(match.homeMemberId || "") !== "__bye__" && clean(match.awayMemberId || "") !== "__bye__")
    .map(({ index }) => index);
  const setGame = (index, isFifa, reason) => {
    rows[index] = {
      ...rows[index],
      gameTitle: isFifa ? "FIFA 2025" : "PES 2017",
      gameCode: isFifa ? "fifa25" : "pes17",
      gameReason: reason,
    };
  };
  if (mode === "fifa2025_only") {
    playableIndexes.forEach((index) => setGame(index, true, "اختيار إداري: كل المباريات على FIFA 2025"));
    return rows;
  }
  if (mode === "pes2017_only") {
    playableIndexes.forEach((index) => setGame(index, false, "اختيار إداري: كل المباريات على PES 2017"));
    return rows;
  }
  const fifaCount = Math.max(0, Math.min(playableIndexes.length, toNumber(options.fifa2025MatchCount || 0)));
  playableIndexes.forEach((index, order) => setGame(index, order < fifaCount, order < fifaCount ? "اختيار إداري: مكس يدوي FIFA 2025" : "اختيار إداري: مكس يدوي PES 2017"));
  return rows;
}

function generateLeagueQualifierMatches(participants = [], qualifiersCount = 1, options = {}) {
  const rows = [];
  const cleanParticipants = (participants || []).map((item) => ({ ...item, memberId: cleanId(item.memberId || item.id), memberName: item.memberName || item.name || cleanId(item.memberId || item.id) })).filter((item) => item.memberId);
  const onlineMemberId = cleanId(options.onlineMemberId || cleanParticipants.find(isAbdullahLike)?.memberId || "");
  const gameFor = (homeId, awayId, reason = "ملحق الدوري") => {
    const fifa = onlineMemberId && (same(homeId, onlineMemberId) || same(awayId, onlineMemberId));
    return { gameTitle: fifa ? "FIFA 2025" : "PES 2017", gameCode: fifa ? "fifa25" : "pes17", gameReason: fifa ? "مباراة أونلاين" : reason };
  };
  const q = Math.max(1, Math.min(toNumber(qualifiersCount || 1), Math.max(1, cleanParticipants.length - 1)));

  if (cleanParticipants.length === 2) {
    const [a, b] = cleanParticipants;
    rows.push({ id: "Q1-M1", round: 1, phase: "final", label: q === 1 ? "نهائي الملحق" : "مباراة تأهل", homeMemberId: a.memberId, homeName: a.memberName, awayMemberId: b.memberId, awayName: b.memberName, homeGoals: "", awayGoals: "", status: "scheduled", resultStatus: "scheduled", ...gameFor(a.memberId, b.memberId) });
  } else if (q >= 2) {
    let matchNo = 1;
    for (let i = 0; i < cleanParticipants.length; i += 2) {
      const a = cleanParticipants[i];
      const b = cleanParticipants[i + 1];
      if (!b) {
        rows.push({ id: `Q1-BYE-${a.memberId}`, round: 1, phase: "bye", label: "تأهل مباشر", homeMemberId: a.memberId, homeName: a.memberName, awayMemberId: "__bye__", awayName: "تأهل مباشر", winnerMemberId: a.memberId, winnerName: a.memberName, homeGoals: "", awayGoals: "", status: "completed", resultStatus: "completed", gameTitle: "-", gameCode: "bye", gameReason: "تأهل مباشر" });
      } else {
        rows.push({ id: `Q1-M${matchNo}`, round: 1, phase: "qualifier", label: "مباراة تأهل", homeMemberId: a.memberId, homeName: a.memberName, awayMemberId: b.memberId, awayName: b.memberName, homeGoals: "", awayGoals: "", status: "scheduled", resultStatus: "scheduled", ...gameFor(a.memberId, b.memberId) });
        matchNo += 1;
      }
    }
  } else {
    const [a, b, ...rest] = cleanParticipants;
    rows.push({ id: "Q1-M1", round: 1, phase: "preliminary", label: "الدور التمهيدي", homeMemberId: a.memberId, homeName: a.memberName, awayMemberId: b.memberId, awayName: b.memberName, homeGoals: "", awayGoals: "", status: "scheduled", resultStatus: "scheduled", ...gameFor(a.memberId, b.memberId) });
    if (rest[0]) {
      rows.push({ id: "Q2-M1", round: 2, phase: "final", label: "نهائي الملحق", homeMemberId: "__winner__Q1-M1", homeName: "الفائز من الدور التمهيدي", awayMemberId: rest[0].memberId, awayName: rest[0].memberName, waitingForWinnerOf: "Q1-M1", homeGoals: "", awayGoals: "", status: "scheduled", resultStatus: "scheduled", ...gameFor("", rest[0].memberId, "نهائي الملحق") });
    }
  }

  return { matches: rows, gameQuota: { onlineMemberId, qualifiersCount: q } };
}


function groupLetterName(index = 0) {
  return ["1", "2", "3"][index] || String(index + 1);
}

function generateWorldCupMatches(participants = [], options = {}) {
  const cleanParticipants = (participants || [])
    .map((item, index) => ({
      ...item,
      memberId: cleanId(item.memberId || item.id),
      memberName: item.memberName || item.name || cleanId(item.memberId || item.id),
      seed: Math.max(1, toNumber(item.seed || item.order || index + 1)),
    }))
    .filter((item) => item.memberId)
    .sort((a, b) => toNumber(a.seed) - toNumber(b.seed) || clean(a.memberName).localeCompare(clean(b.memberName), "ar"));
  const onlineMemberId = cleanId(options.onlineMemberId || cleanParticipants.find(isAbdullahLike)?.memberId || "");
  const enableQualifiers = Boolean(options.enableQualifiers);
  const groupKeys = ["A", "B", "C"];
  const gameFor = (homeId, awayId, reason = "كأس العالم") => {
    const fifa = onlineMemberId && (same(homeId, onlineMemberId) || same(awayId, onlineMemberId));
    return { gameTitle: fifa ? "FIFA 2025" : "PES 2017", gameCode: fifa ? "fifa25" : "pes17", gameReason: fifa ? "مباراة أونلاين" : reason };
  };
  const matches = [];
  let mainParticipants = cleanParticipants;
  let qualificationInfo = null;

  if (cleanParticipants.length > 9) {
    if (!enableQualifiers) throw new Error("فعّل تصفيات كأس العالم عند اختيار أكثر من 9 مشاركين.");
    const excess = cleanParticipants.length - 9;
    const poolSize = excess * 2;
    if (poolSize > cleanParticipants.length) throw new Error("عدد المشاركين غير مناسب لتصفيات دور واحد. قلّل العدد أو استخدم 18 مشاركًا كحد أقصى.");
    const shuffled = [...cleanParticipants].sort(() => Math.random() - 0.5);
    const qualifierPool = shuffled.slice(0, poolSize);
    const directRows = shuffled.slice(poolSize);
    const qualifierWinnerSlots = [];
    for (let i = 0; i < qualifierPool.length; i += 2) {
      const a = qualifierPool[i];
      const b = qualifierPool[i + 1];
      const qNo = i / 2 + 1;
      const matchId = `WC-Q${qNo}`;
      matches.push({
        id: matchId,
        round: 0,
        phase: "qualification",
        label: `تصفيات كأس العالم - مباراة ${qNo}`,
        homeMemberId: a.memberId,
        homeName: a.memberName,
        awayMemberId: b.memberId,
        awayName: b.memberName,
        homeGoals: "",
        awayGoals: "",
        status: "scheduled",
        resultStatus: "scheduled",
        ...gameFor(a.memberId, b.memberId, "تصفيات كأس العالم"),
      });
      qualifierWinnerSlots.push({
        memberId: `__winner__${matchId}`,
        memberName: `فائز تصفيات ${qNo}`,
        seed: 900 + qNo,
        sourceQualifierMatchId: matchId,
        isQualifierWinnerSlot: true,
      });
    }
    mainParticipants = [...directRows, ...qualifierWinnerSlots];
    qualificationInfo = {
      enabled: true,
      selectedCount: cleanParticipants.length,
      directCount: directRows.length,
      qualifierMatchesCount: qualifierWinnerSlots.length,
      note: "تصفيات عشوائية إقصائية لتأهيل 9 أعضاء إلى دور المجموعات",
    };
  }

  mainParticipants = mainParticipants
    .slice(0, 9)
    .sort((a, b) => toNumber(a.seed) - toNumber(b.seed) || clean(a.memberName).localeCompare(clean(b.memberName), "ar"));

  const groups = distributeSeedPotsToGroups(mainParticipants, 3, groupKeys, groupLetterName, 3);

  let matchNo = 1;
  groups.forEach((groupRows, groupIndex) => {
    for (let i = 0; i < groupRows.length; i += 1) {
      for (let j = i + 1; j < groupRows.length; j += 1) {
        const home = groupRows[i];
        const away = groupRows[j];
        matches.push({
          id: `WC-G${groupIndex + 1}-M${matchNo}`,
          round: groupIndex + 1,
          phase: "group",
          groupKey: groupKeys[groupIndex],
          groupName: groupLetterName(groupIndex),
          label: `مباريات المجموعة ${groupLetterName(groupIndex)}`,
          matchNumber: matchNo,
          homeMemberId: home.memberId,
          homeName: home.memberName,
          awayMemberId: away.memberId,
          awayName: away.memberName,
          homeGoals: "",
          awayGoals: "",
          status: "scheduled",
          resultStatus: "scheduled",
          ...gameFor(home.memberId, away.memberId, "مباريات دور المجموعات"),
        });
        matchNo += 1;
      }
    }
  });
  matches.push({ id: "WC-SF1", round: 4, phase: "semifinal", knockoutRound: 1, label: "مباريات نصف النهائي", homeMemberId: "__wc_group_A_first__", homeName: "أول المجموعة 1", awayMemberId: "__wc_best_second__", awayName: "أفضل ثاني", homeGoals: "", awayGoals: "", status: "scheduled", resultStatus: "scheduled", ...gameFor("", "", "مباريات نصف النهائي") });
  matches.push({ id: "WC-SF2", round: 4, phase: "semifinal", knockoutRound: 1, label: "مباريات نصف النهائي", homeMemberId: "__wc_group_B_first__", homeName: "أول المجموعة 2", awayMemberId: "__wc_group_C_first__", awayName: "أول المجموعة 3", homeGoals: "", awayGoals: "", status: "scheduled", resultStatus: "scheduled", ...gameFor("", "", "مباريات نصف النهائي") });
  matches.push({ id: "WC-THIRD", round: 5, phase: "third_place", knockoutRound: 2, label: "مباراة تحديد الثالث", homeMemberId: "__loser__WC-SF1", homeName: "خاسر نصف النهائي 1", awayMemberId: "__loser__WC-SF2", awayName: "خاسر نصف النهائي 2", homeWaitingForLoserOf: "WC-SF1", awayWaitingForLoserOf: "WC-SF2", homeGoals: "", awayGoals: "", status: "scheduled", resultStatus: "scheduled", ...gameFor("", "", "مباراة تحديد الثالث") });
  matches.push({ id: "WC-FINAL", round: 6, phase: "final", knockoutRound: 3, label: "المباراة النهائية", homeMemberId: "__winner__WC-SF1", homeName: "فائز نصف النهائي 1", awayMemberId: "__winner__WC-SF2", awayName: "فائز نصف النهائي 2", homeWaitingForWinnerOf: "WC-SF1", awayWaitingForWinnerOf: "WC-SF2", homeGoals: "", awayGoals: "", status: "scheduled", resultStatus: "scheduled", ...gameFor("", "", "المباراة النهائية") });
  const groupByeInfo = groups.map((rows, index) => ({
    groupKey: groupKeys[index],
    groupName: groupLetterName(index),
    participantIds: rows.map((row) => row.memberId),
    byeSlots: Math.max(0, 3 - rows.length),
  }));
  const groupParticipants = groups.flat();
  return {
    matches: resolveWorldCupDependencies({ participants: groupParticipants, matches }),
    participants: groupParticipants,
    gameQuota: {
      onlineMemberId,
      format: "world_cup_groups_knockout",
      groups: groupByeInfo,
      qualification: qualificationInfo,
      byeMode: groupByeInfo.some((group) => toNumber(group.byeSlots) > 0) ? "balanced_groups_rest" : "none",
    },
  };
}

function worldCupGroupStageReady(competition = {}) {
  const matches = Array.isArray(competition.matches) ? competition.matches : [];
  const groupMatches = matches.filter((match) => clean(match.phase) === "group");
  return groupMatches.every((match) => clean(match.resultStatus || match.status) === "completed");
}

function worldCupGroupRows(competition = {}) {
  const matches = Array.isArray(competition.matches) ? competition.matches : [];
  const participants = (competition.participants || []).filter((item) => cleanId(item.memberId || item.id));
  const qualifierWinnerMap = new Map();
  matches.forEach((match) => {
    if (clean(match.phase) === "qualification" && clean(match.resultStatus || match.status) === "completed" && match.winnerMemberId) {
      qualifierWinnerMap.set(match.id, { memberId: cleanId(match.winnerMemberId), memberName: match.winnerName || match.winnerMemberName || match.winnerMemberId });
    }
  });
  const resolveQualifierSide = (id, name) => {
    const raw = String(id || "");
    if (raw.startsWith("__winner__")) {
      const ref = cleanId(raw.replace("__winner__", ""));
      return qualifierWinnerMap.get(ref) || { memberId: raw, memberName: name || raw };
    }
    return { memberId: cleanId(id), memberName: name || cleanId(id) };
  };
  const rows = [];
  ["A", "B", "C"].forEach((groupKey, groupIndex) => {
    const rawGroupMatches = matches.filter((match) => clean(match.phase) === "group" && clean(match.groupKey) === clean(groupKey));
    const groupMatches = rawGroupMatches.map((match) => {
      const home = resolveQualifierSide(match.homeMemberId, match.homeName);
      const away = resolveQualifierSide(match.awayMemberId, match.awayName);
      return { ...match, homeMemberId: home.memberId, homeName: home.memberName, awayMemberId: away.memberId, awayName: away.memberName };
    });
    const fromMatches = new Map();
    groupMatches.forEach((match) => {
      [[match.homeMemberId, match.homeName], [match.awayMemberId, match.awayName]].forEach(([id, name]) => {
        const safeId = cleanId(id);
        if (!safeId || safeId === "__bye__") return;
        fromMatches.set(safeId, { memberId: safeId, memberName: name || safeId, groupKey, groupName: groupLetterName(groupIndex) });
      });
    });
    let groupParticipants = [...fromMatches.values()];
    if (!groupParticipants.length) groupParticipants = participants.filter((item) => clean(item.groupKey || "") === clean(groupKey));
    if (!groupParticipants.length) groupParticipants = participants.filter((_, index) => index % 3 === groupIndex);
    const standings = computeLeagueStandings(groupParticipants, groupMatches);
    rows.push({ groupKey, groupName: groupLetterName(groupIndex), participants: groupParticipants, matches: groupMatches, standings });
  });
  return rows;
}

function computeWorldCupQualifiedRows(competition = {}) {
  const groups = worldCupGroupRows(competition);
  if (!worldCupGroupStageReady(competition)) {
    return { groups, firsts: [], seconds: [], bestSecond: null, qualified: [] };
  }
  const firsts = groups.map((group) => ({ ...(group.standings[0] || {}), groupKey: group.groupKey, groupName: group.groupName, qualification: "first" })).filter((row) => row.memberId);
  const seconds = groups.map((group) => ({ ...(group.standings[1] || {}), groupKey: group.groupKey, groupName: group.groupName, qualification: "second" })).filter((row) => row.memberId);
  const bestSecond = seconds.sort(compareLeagueStanding)[0] || null;
  return { groups, firsts, seconds, bestSecond, qualified: [...firsts, ...(bestSecond ? [{ ...bestSecond, qualification: "best_second" }] : [])] };
}

function computeWorldCupQualifiedIds(competition = {}) {
  return computeWorldCupQualifiedRows(competition).qualified.map((row) => cleanId(row.memberId)).filter(Boolean);
}

function worldCupQualifierTokenMap(competition = {}) {
  const data = computeWorldCupQualifiedRows(competition);
  const map = new Map();
  if ((data.qualified || []).length < 4) return map;
  data.firsts.forEach((row) => {
    const token = row.groupKey === "A" ? "__wc_group_A_first__" : row.groupKey === "B" ? "__wc_group_B_first__" : "__wc_group_C_first__";
    map.set(token, { memberId: cleanId(row.memberId), memberName: row.memberName });
  });
  if (data.bestSecond?.memberId) map.set("__wc_best_second__", { memberId: cleanId(data.bestSecond.memberId), memberName: data.bestSecond.memberName });
  return map;
}

function matchLoserInfo(match = {}) {
  if (clean(match.resultStatus || match.status) !== "completed" || !match.winnerMemberId) return null;
  const winnerId = cleanId(match.winnerMemberId);
  const homeId = cleanId(match.homeMemberId);
  const awayId = cleanId(match.awayMemberId);
  const loserId = same(winnerId, homeId) ? awayId : homeId;
  if (!loserId || loserId === "__bye__" || String(loserId).startsWith("__")) return null;
  return { memberId: loserId, memberName: same(loserId, homeId) ? match.homeName : match.awayName };
}

function resolveWorldCupDependencies(competition = {}) {
  const matches = Array.isArray(competition.matches) ? competition.matches : [];
  const qualifierMap = worldCupQualifierTokenMap(competition);
  const winnerMap = new Map();
  const loserMap = new Map();
  matches.forEach((match) => {
    if (clean(match.resultStatus || match.status) === "completed" && match.winnerMemberId) {
      winnerMap.set(match.id, { memberId: cleanId(match.winnerMemberId), memberName: match.winnerName || match.winnerMemberName || match.winnerMemberId });
      const loser = matchLoserInfo(match);
      if (loser) loserMap.set(match.id, loser);
    }
  });
  const resolveSide = (id, winnerRef, loserRef) => {
    const raw = String(id || "");
    if (raw.startsWith("__wc_")) return qualifierMap.get(raw) || null;
    const win = cleanId(winnerRef || (raw.startsWith("__winner__") ? raw.replace("__winner__", "") : ""));
    if (win) return winnerMap.get(win) || null;
    const lose = cleanId(loserRef || (raw.startsWith("__loser__") ? raw.replace("__loser__", "") : ""));
    if (lose) return loserMap.get(lose) || null;
    return null;
  };
  return matches.map((match) => {
    const next = { ...match };
    const home = resolveSide(next.homeMemberId, next.homeWaitingForWinnerOf, next.homeWaitingForLoserOf);
    const away = resolveSide(next.awayMemberId, next.awayWaitingForWinnerOf, next.awayWaitingForLoserOf);
    if (home) { next.homeMemberId = home.memberId; next.homeName = home.memberName; }
    if (away) { next.awayMemberId = away.memberId; next.awayName = away.memberName; }
    return next;
  });
}

function getWorldCupThirdPlace(competition = {}) {
  const match = (competition.matches || []).find((item) => clean(item.phase) === "third_place" && clean(item.resultStatus || item.status) === "completed" && item.winnerMemberId);
  return match ? { memberId: cleanId(match.winnerMemberId), memberName: match.winnerName || getMemberName(competition.participants || [], match.winnerMemberId) || match.winnerMemberId } : null;
}

function championsLeagueGroupLetterName(index = 0) {
  return [""][index] || String(index + 1);
}

function shuffleRows(rows = []) {
  const arr = [...(rows || [])];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function distributeSeedPotsToGroups(rows = [], groupCount = 2, groupKeys = [], groupNameForIndex = (index) => String(index + 1), maxPerGroup = null) {
  const groups = Array.from({ length: groupCount }, () => []);
  const bySeed = new Map();
  (rows || []).forEach((row) => {
    const seed = Math.max(1, toNumber(row.seed || row.order || 1));
    if (!bySeed.has(seed)) bySeed.set(seed, []);
    bySeed.get(seed).push({ ...row, seed });
  });
  Array.from(bySeed.keys()).sort((a, b) => a - b).forEach((seed) => {
    const potRows = shuffleRows(bySeed.get(seed) || []);
    const orderedGroups = shuffleRows(Array.from({ length: groupCount }, (_, index) => index))
      .sort((a, b) => groups[a].length - groups[b].length || a - b);
    potRows.forEach((row, index) => {
      const available = orderedGroups.filter((groupIndex) => !maxPerGroup || groups[groupIndex].length < maxPerGroup);
      const targetGroupIndex = available[index % Math.max(1, available.length)] ?? orderedGroups[index % orderedGroups.length] ?? 0;
      groups[targetGroupIndex].push({ ...row, groupKey: groupKeys[targetGroupIndex] || String(targetGroupIndex + 1), groupName: groupNameForIndex(targetGroupIndex) });
    });
  });
  return groups;
}

function isLeagueGroupsCompetition(competition = {}) {
  return competitionTypeKey(competition.type || "league") === "league" && clean(competition.bracketMode || competition.roundsMode || competition.leagueFormat) === "league_two_groups_knockout";
}

function leagueTwoGroupsAdminRoundTitle(match = {}, fallbackRound = "") {
  const phase = clean(match.phase || "");
  if (phase === "qualification") return "ملحق الدوري";
  if (phase === "group") return "مباريات المجموعة " + (match.groupName || championsLeagueGroupLetterName(Math.max(0, toNumber(match.round) - 1)));
  if (phase === "semifinal") return "مباريات نصف النهائي";
  if (phase === "third_place") return "مباراة تحديد الثالث";
  if (phase === "final") return "المباراة النهائية";
  return match.label || (fallbackRound ? "المباريات" : "المباريات");
}

function buildBalancedGroupMatchPairs(groupRows = []) {
  const rows = (groupRows || []).filter(Boolean);
  if (rows.length < 2) return [];
  if (rows.length === 2) return [[rows[0], rows[1]]];
  if (rows.length === 3) {
    return [
      [rows[1], rows[2]],
      [rows[0], rows[2]],
      [rows[0], rows[1]],
    ];
  }
  if (rows.length === 4) {
    return [
      [rows[0], rows[3]],
      [rows[1], rows[2]],
      [rows[0], rows[2]],
      [rows[3], rows[1]],
      [rows[0], rows[1]],
      [rows[2], rows[3]],
    ];
  }
  const pairs = [];
  for (let i = 0; i < rows.length; i += 1) {
    for (let j = i + 1; j < rows.length; j += 1) pairs.push([rows[i], rows[j]]);
  }
  return pairs;
}

function generateChampionsLeagueMatches(participants = [], options = {}) {
  const cleanParticipants = (participants || [])
    .map((item, index) => ({
      ...item,
      memberId: cleanId(item.memberId || item.id),
      memberName: item.memberName || item.name || cleanId(item.memberId || item.id),
      seed: Math.max(1, toNumber(item.seed || item.order || index + 1)),
    }))
    .filter((item) => item.memberId)
    .sort((a, b) => toNumber(a.seed) - toNumber(b.seed) || clean(a.memberName).localeCompare(clean(b.memberName), "ar"));
  const onlineMemberId = cleanId(options.onlineMemberId || cleanParticipants.find(isAbdullahLike)?.memberId || "");
  const enableQualifiers = Boolean(options.enableQualifiers);
  const groupKeys = ["A", "B"];
  const gameFor = (homeId, awayId, reason = "دوري الأبطال") => {
    const fifa = onlineMemberId && (same(homeId, onlineMemberId) || same(awayId, onlineMemberId));
    return { gameTitle: fifa ? "FIFA 2025" : "PES 2017", gameCode: fifa ? "fifa25" : "pes17", gameReason: fifa ? "مباراة أونلاين" : reason };
  };
  const matches = [];
  let mainParticipants = cleanParticipants;
  let qualificationInfo = null;

  if (cleanParticipants.length > 8) {
    if (!enableQualifiers) throw new Error("فعّل ملحق دوري الأبطال عند اختيار أكثر من 8 مشاركين.");
    const excess = cleanParticipants.length - 8;
    const poolSize = excess * 2;
    if (poolSize > cleanParticipants.length) throw new Error("عدد المشاركين غير مناسب لملحق دور واحد. قلّل العدد أو استخدم 16 مشاركًا كحد أقصى.");
    const shuffled = [...cleanParticipants].sort(() => Math.random() - 0.5);
    const qualifierPool = shuffled.slice(0, poolSize);
    const directRows = shuffled.slice(poolSize);
    const qualifierWinnerSlots = [];
    for (let i = 0; i < qualifierPool.length; i += 2) {
      const a = qualifierPool[i];
      const b = qualifierPool[i + 1];
      const qNo = i / 2 + 1;
      const matchId = `UCL-Q${qNo}`;
      matches.push({
        id: matchId,
        round: 0,
        phase: "qualification",
        label: `ملحق دوري الأبطال - مباراة ${qNo}`,
        homeMemberId: a.memberId,
        homeName: a.memberName,
        awayMemberId: b.memberId,
        awayName: b.memberName,
        homeGoals: "",
        awayGoals: "",
        status: "scheduled",
        resultStatus: "scheduled",
        ...gameFor(a.memberId, b.memberId, "ملحق دوري الأبطال"),
      });
      qualifierWinnerSlots.push({
        memberId: `__winner__${matchId}`,
        memberName: `فائز ملحق ${qNo}`,
        seed: 900 + qNo,
        sourceQualifierMatchId: matchId,
        isQualifierWinnerSlot: true,
      });
    }
    mainParticipants = [...directRows, ...qualifierWinnerSlots];
    qualificationInfo = {
      enabled: true,
      selectedCount: cleanParticipants.length,
      directCount: directRows.length,
      qualifierMatchesCount: qualifierWinnerSlots.length,
      note: "ملحق عشوائي إقصائي لتأهيل 8 أعضاء إلى مجموعات دوري الأبطال",
    };
  }

  mainParticipants = mainParticipants
    .slice(0, 8)
    .sort((a, b) => toNumber(a.seed) - toNumber(b.seed) || clean(a.memberName).localeCompare(clean(b.memberName), "ar"));

  const groups = distributeSeedPotsToGroups(mainParticipants, 2, groupKeys, championsLeagueGroupLetterName, 4);

  let matchNo = 1;
  groups.forEach((groupRows, groupIndex) => {
    const balancedPairs = buildBalancedGroupMatchPairs(groupRows);
    balancedPairs.forEach(([home, away], pairIndex) => {
      matches.push({
        id: `UCL-G${groupIndex + 1}-M${pairIndex + 1}`,
        round: groupIndex + 1,
        phase: "group",
        groupKey: groupKeys[groupIndex],
        groupName: championsLeagueGroupLetterName(groupIndex),
        label: `مباريات المجموعة ${championsLeagueGroupLetterName(groupIndex)}`,
        matchNumber: matchNo,
        homeMemberId: home.memberId,
        homeName: home.memberName,
        awayMemberId: away.memberId,
        awayName: away.memberName,
        homeGoals: "",
        awayGoals: "",
        status: "scheduled",
        resultStatus: "scheduled",
        ...gameFor(home.memberId, away.memberId, "مباريات دور المجموعات"),
      });
      matchNo += 1;
    });
  });
  matches.push({ id: "UCL-SF1", round: 4, phase: "semifinal", knockoutRound: 1, label: "مباريات نصف النهائي", homeMemberId: "__ucl_group_A_first__", homeName: "أول المجموعة 1", awayMemberId: "__ucl_group_B_second__", awayName: "ثاني المجموعة 2", homeGoals: "", awayGoals: "", status: "scheduled", resultStatus: "scheduled", ...gameFor("", "", "مباريات نصف النهائي") });
  matches.push({ id: "UCL-SF2", round: 4, phase: "semifinal", knockoutRound: 1, label: "مباريات نصف النهائي", homeMemberId: "__ucl_group_B_first__", homeName: "أول المجموعة 2", awayMemberId: "__ucl_group_A_second__", awayName: "ثاني المجموعة 1", homeGoals: "", awayGoals: "", status: "scheduled", resultStatus: "scheduled", ...gameFor("", "", "مباريات نصف النهائي") });
  matches.push({ id: "UCL-THIRD", round: 5, phase: "third_place", knockoutRound: 2, label: "مباراة تحديد الثالث", homeMemberId: "__loser__UCL-SF1", homeName: "خاسر نصف النهائي 1", awayMemberId: "__loser__UCL-SF2", awayName: "خاسر نصف النهائي 2", homeWaitingForLoserOf: "UCL-SF1", awayWaitingForLoserOf: "UCL-SF2", homeGoals: "", awayGoals: "", status: "scheduled", resultStatus: "scheduled", ...gameFor("", "", "مباراة تحديد الثالث") });
  matches.push({ id: "UCL-FINAL", round: 6, phase: "final", knockoutRound: 3, label: "المباراة النهائية", homeMemberId: "__winner__UCL-SF1", homeName: "فائز نصف النهائي 1", awayMemberId: "__winner__UCL-SF2", awayName: "فائز نصف النهائي 2", homeWaitingForWinnerOf: "UCL-SF1", awayWaitingForWinnerOf: "UCL-SF2", homeGoals: "", awayGoals: "", status: "scheduled", resultStatus: "scheduled", ...gameFor("", "", "المباراة النهائية") });

  const groupByeInfo = groups.map((rows, index) => ({
    groupKey: groupKeys[index],
    groupName: championsLeagueGroupLetterName(index),
    participantIds: rows.map((row) => row.memberId),
    byeSlots: Math.max(0, 4 - rows.length),
  }));
  const groupParticipants = groups.flat();
  return {
    matches: resolveChampionsLeagueDependencies({ participants: groupParticipants, matches }),
    participants: groupParticipants,
    gameQuota: {
      onlineMemberId,
      format: "champions_league_groups_knockout",
      groups: groupByeInfo,
      qualification: qualificationInfo,
      byeMode: groupByeInfo.some((group) => toNumber(group.byeSlots) > 0) ? "balanced_groups_rest" : "none",
    },
  };
}

function generateLeagueTwoGroupsMatches(participants = [], options = {}) {
  const plan = generateChampionsLeagueMatches(participants, options);
  const matches = (plan.matches || []).map((match) => ({
    ...match,
    label: clean(match.phase) === "qualification" ? String(match.label || "").replace("دوري الأبطال", "الدوري") : match.label,
    gameReason: String(match.gameReason || "").replace("دوري الأبطال", "الدوري"),
  }));
  return {
    ...plan,
    matches,
    gameQuota: { ...(plan.gameQuota || {}), format: "league_two_groups_knockout" },
  };
}

function championsLeagueGroupStageReady(competition = {}) {
  const matches = Array.isArray(competition.matches) ? competition.matches : [];
  const groupMatches = matches.filter((match) => clean(match.phase) === "group");
  return groupMatches.every((match) => clean(match.resultStatus || match.status) === "completed");
}

function championsLeagueGroupRows(competition = {}) {
  const matches = Array.isArray(competition.matches) ? competition.matches : [];
  const participants = (competition.participants || []).filter((item) => cleanId(item.memberId || item.id));
  const qualifierWinnerMap = new Map();
  matches.forEach((match) => {
    if (clean(match.phase) === "qualification" && clean(match.resultStatus || match.status) === "completed" && match.winnerMemberId) {
      qualifierWinnerMap.set(match.id, { memberId: cleanId(match.winnerMemberId), memberName: match.winnerName || match.winnerMemberName || match.winnerMemberId });
    }
  });
  const resolveQualifierSide = (id, name) => {
    const raw = String(id || "");
    if (raw.startsWith("__winner__")) {
      const ref = cleanId(raw.replace("__winner__", ""));
      return qualifierWinnerMap.get(ref) || { memberId: raw, memberName: name || raw };
    }
    return { memberId: cleanId(id), memberName: name || cleanId(id) };
  };
  const rows = [];
  ["A", "B"].forEach((groupKey, groupIndex) => {
    const rawGroupMatches = matches.filter((match) => clean(match.phase) === "group" && clean(match.groupKey) === clean(groupKey));
    const groupMatches = rawGroupMatches.map((match) => {
      const home = resolveQualifierSide(match.homeMemberId, match.homeName);
      const away = resolveQualifierSide(match.awayMemberId, match.awayName);
      return { ...match, homeMemberId: home.memberId, homeName: home.memberName, awayMemberId: away.memberId, awayName: away.memberName };
    });
    const fromMatches = new Map();
    groupMatches.forEach((match) => {
      [[match.homeMemberId, match.homeName], [match.awayMemberId, match.awayName]].forEach(([id, name]) => {
        const safeId = cleanId(id);
        if (!safeId || safeId === "__bye__") return;
        fromMatches.set(safeId, { memberId: safeId, memberName: name || safeId, groupKey, groupName: championsLeagueGroupLetterName(groupIndex) });
      });
    });
    let groupParticipants = [...fromMatches.values()];
    if (!groupParticipants.length) groupParticipants = participants.filter((item) => clean(item.groupKey || "") === clean(groupKey));
    if (!groupParticipants.length) groupParticipants = participants.filter((_, index) => index % 2 === groupIndex);
    const standings = computeLeagueStandings(groupParticipants, groupMatches);
    rows.push({ groupKey, groupName: championsLeagueGroupLetterName(groupIndex), participants: groupParticipants, matches: groupMatches, standings });
  });
  return rows;
}

function computeChampionsLeagueQualifiedRows(competition = {}) {
  const groups = championsLeagueGroupRows(competition);
  if (!championsLeagueGroupStageReady(competition)) return { groups, qualified: [] };
  const qualified = groups.flatMap((group) => [
    { ...(group.standings[0] || {}), groupKey: group.groupKey, groupName: group.groupName, qualification: "first" },
    { ...(group.standings[1] || {}), groupKey: group.groupKey, groupName: group.groupName, qualification: "second" },
  ]).filter((row) => row.memberId);
  return { groups, qualified };
}

function computeChampionsLeagueQualifiedIds(competition = {}) {
  return computeChampionsLeagueQualifiedRows(competition).qualified.map((row) => cleanId(row.memberId)).filter(Boolean);
}

function championsLeagueQualifierTokenMap(competition = {}) {
  const data = computeChampionsLeagueQualifiedRows(competition);
  const map = new Map();
  if ((data.qualified || []).length < 4) return map;
  (data.qualified || []).forEach((row) => {
    const token = row.groupKey === "A"
      ? (row.qualification === "first" ? "__ucl_group_A_first__" : "__ucl_group_A_second__")
      : (row.qualification === "first" ? "__ucl_group_B_first__" : "__ucl_group_B_second__");
    map.set(token, { memberId: cleanId(row.memberId), memberName: row.memberName });
  });
  return map;
}

function resolveChampionsLeagueDependencies(competition = {}) {
  const matches = Array.isArray(competition.matches) ? competition.matches : [];
  const qualifierMap = championsLeagueQualifierTokenMap(competition);
  const winnerMap = new Map();
  const loserMap = new Map();
  matches.forEach((match) => {
    if (clean(match.resultStatus || match.status) === "completed" && match.winnerMemberId) {
      winnerMap.set(match.id, { memberId: cleanId(match.winnerMemberId), memberName: match.winnerName || match.winnerMemberName || match.winnerMemberId });
      const loser = matchLoserInfo(match);
      if (loser) loserMap.set(match.id, loser);
    }
  });
  const resolveSide = (id, winnerRef, loserRef) => {
    const raw = String(id || "");
    if (raw.startsWith("__ucl_")) return qualifierMap.get(raw) || null;
    const win = cleanId(winnerRef || (raw.startsWith("__winner__") ? raw.replace("__winner__", "") : ""));
    if (win) return winnerMap.get(win) || null;
    const lose = cleanId(loserRef || (raw.startsWith("__loser__") ? raw.replace("__loser__", "") : ""));
    if (lose) return loserMap.get(lose) || null;
    return null;
  };
  return matches.map((match) => {
    const next = { ...match };
    const home = resolveSide(next.homeMemberId, next.homeWaitingForWinnerOf, next.homeWaitingForLoserOf);
    const away = resolveSide(next.awayMemberId, next.awayWaitingForWinnerOf, next.awayWaitingForLoserOf);
    if (home) { next.homeMemberId = home.memberId; next.homeName = home.memberName; }
    if (away) { next.awayMemberId = away.memberId; next.awayName = away.memberName; }
    return next;
  });
}

function championsLeagueAdminRoundTitle(match = {}, fallbackRound = "") {
  const phase = clean(match.phase || "");
  if (phase === "qualification") return "ملحق دوري الأبطال";
  if (phase === "group") return "مباريات المجموعة " + (match.groupName || championsLeagueGroupLetterName(Math.max(0, toNumber(match.round) - 1)));
  if (phase === "semifinal") return "مباريات نصف النهائي";
  if (phase === "third_place") return "مباراة تحديد الثالث";
  if (phase === "final") return "المباراة النهائية";
  return match.label || (fallbackRound ? "الجولة " + fallbackRound : "المباريات");
}

function generateSeededKnockoutBracketMatches(participants = [], options = {}) {
  const cleanParticipants = (participants || [])
    .map((item, index) => ({
      ...item,
      memberId: cleanId(item.memberId || item.id),
      memberName: item.memberName || item.name || cleanId(item.memberId || item.id),
      seed: Math.max(1, toNumber(item.seed || item.order || index + 1)),
    }))
    .filter((item) => item.memberId)
    .sort((a, b) => toNumber(a.seed) - toNumber(b.seed) || clean(a.memberName).localeCompare(clean(b.memberName), "ar"));
  const onlineMemberId = cleanId(options.onlineMemberId || cleanParticipants.find(isAbdullahLike)?.memberId || "");
  const gameFor = (homeId, awayId, reason = "الكأس") => {
    const fifa = onlineMemberId && (same(homeId, onlineMemberId) || same(awayId, onlineMemberId));
    return { gameTitle: fifa ? "FIFA 2025" : "PES 2017", gameCode: fifa ? "fifa25" : "pes17", gameReason: fifa ? "مباراة أونلاين" : reason };
  };
  const size = cleanParticipants.length <= 2 ? 2 : cleanParticipants.length <= 4 ? 4 : 8;
  const seededSlots = buildSeededBracketSlots(cleanParticipants, size);
  const roundsCount = Math.log2(size);
  const matches = [];
  const previousRoundSlots = [];
  for (let i = 0; i < size; i += 2) {
    const home = seededSlots[i];
    const away = seededSlots[i + 1];
    const matchNumber = Math.floor(i / 2) + 1;
    const id = `K1-M${matchNumber}`;
    if (home && !away) {
      matches.push({ id, round: 1, phase: "bye", label: "تأهل مباشر", bracketSlot: matchNumber, homeMemberId: home.memberId, homeName: home.memberName, awayMemberId: "__bye__", awayName: "تأهل مباشر", winnerMemberId: home.memberId, winnerName: home.memberName, homeGoals: "", awayGoals: "", status: "completed", resultStatus: "completed", gameTitle: "-", gameCode: "bye", gameReason: "تأهل مباشر" });
    } else if (!home && away) {
      matches.push({ id, round: 1, phase: "bye", label: "تأهل مباشر", bracketSlot: matchNumber, homeMemberId: away.memberId, homeName: away.memberName, awayMemberId: "__bye__", awayName: "تأهل مباشر", winnerMemberId: away.memberId, winnerName: away.memberName, homeGoals: "", awayGoals: "", status: "completed", resultStatus: "completed", gameTitle: "-", gameCode: "bye", gameReason: "تأهل مباشر" });
    } else if (home && away) {
      matches.push({ id, round: 1, phase: roundsCount === 1 ? "final" : "knockout", label: roundLabelForBracket(1, roundsCount), bracketSlot: matchNumber, homeMemberId: home.memberId, homeName: home.memberName, awayMemberId: away.memberId, awayName: away.memberName, homeGoals: "", awayGoals: "", status: "scheduled", resultStatus: "scheduled", ...gameFor(home.memberId, away.memberId) });
    }
    previousRoundSlots.push(id);
  }
  let previous = previousRoundSlots;
  for (let round = 2; round <= roundsCount; round += 1) {
    const next = [];
    for (let i = 0; i < previous.length; i += 2) {
      const left = previous[i];
      const right = previous[i + 1];
      const id = `K${round}-M${Math.floor(i / 2) + 1}`;
      matches.push({
        id,
        round,
        phase: round === roundsCount ? "final" : "knockout",
        label: roundLabelForBracket(round, roundsCount),
        bracketSlot: Math.floor(i / 2) + 1,
        homeMemberId: `__winner__${left}`,
        homeName: "الفائز من " + matchShortLabel(left),
        awayMemberId: right ? `__winner__${right}` : "__bye__",
        awayName: right ? "الفائز من " + matchShortLabel(right) : "تأهل مباشر",
        homeWaitingForWinnerOf: left,
        awayWaitingForWinnerOf: right || "",
        waitingForWinnerOf: left,
        homeGoals: "",
        awayGoals: "",
        status: "scheduled",
        resultStatus: "scheduled",
        ...gameFor("", "", roundLabelForBracket(round, roundsCount)),
      });
      next.push(id);
    }
    previous = next;
  }
  return { matches: resolveKnockoutBracketDependencies(matches), gameQuota: { onlineMemberId, bracketSize: size, format: "seeded_knockout" } };
}

function buildSeededBracketSlots(participants = [], size = 8) {
  const seedOrder = size === 2 ? [1, 2] : size === 4 ? [1, 4, 2, 3] : [1, 8, 4, 5, 2, 7, 3, 6];
  const bySeed = new Map((participants || []).map((item) => [toNumber(item.seed), item]));
  return seedOrder.map((seed) => bySeed.get(seed) || null);
}

function roundLabelForBracket(round, roundsCount) {
  if (round === roundsCount) return "النهائي";
  if (round === roundsCount - 1) return "نصف النهائي";
  if (round === roundsCount - 2) return "ربع النهائي";
  return `الدور ${round}`;
}

function matchShortLabel(id = "") {
  const text = String(id || "");
  const parts = text.match(/K(\d+)-M(\d+)/);
  if (!parts) return text;
  const roundNo = toNumber(parts[1]);
  const roundName = roundNo === 1 ? "ربع النهائي" : roundNo === 2 ? "نصف النهائي" : roundNo === 3 ? "النهائي" : "الدور " + roundNo;
  return roundName + " - مباراة " + parts[2];
}

function getCompetitionChampionInfo(competition = {}) {
  const champion = competition.championMemberName || competition.championName
    ? { memberId: cleanId(competition.championMemberId || ""), memberName: competition.championMemberName || competition.championName || "" }
    : getKnockoutChampion(competition);
  if (!champion?.memberName && !champion?.memberId) return null;
  const participant = (competition.participants || []).find((item) =>
    (champion.memberId && same(item.memberId || item.id, champion.memberId)) ||
    (champion.memberName && clean(item.memberName || item.name) === clean(champion.memberName))
  );
  const memberName = champion.memberName || participant?.memberName || participant?.name || "";
  return {
    memberId: cleanId(champion.memberId || participant?.memberId || participant?.id || ""),
    memberName,
    avatar: participant?.avatar || participant?.image || avatar(memberName),
  };
}

function isKnockoutCompetitionType(type) {
  return ["cup", "super_cup", "champions_league", "world_cup"].includes(competitionTypeKey(type || ""));
}


function competitionMatchSortValue(match = {}) {
  const phase = clean(match.phase || "");
  const groupKey = clean(match.groupKey || "");
  const groupIndex = groupKey === "A" ? 1 : groupKey === "B" ? 2 : groupKey === "C" ? 3 : Math.max(1, toNumber(match.round || 1));
  const idMatchNo = String(match.id || "").match(/-M(\d+)/i);
  const matchNo = Math.max(1, toNumber(match.groupMatchNo || (idMatchNo ? idMatchNo[1] : match.matchNumber || match.bracketSlot || 1)));
  const phaseRank = phase === "qualification" ? 0 : phase === "group" ? 1 : phase === "semifinal" ? 2 : phase === "third_place" ? 3 : phase === "final" ? 4 : 9;
  if (phase === "group") return phaseRank * 100000 + matchNo * 100 + groupIndex;
  return phaseRank * 100000 + toNumber(match.round || 0) * 1000 + matchNo;
}

function sortedCompetitionMatchesForSchedule(competition = {}) {
  const typeKey = competitionTypeKey(competition.type || "league");
  const leagueGroupsMode = isLeagueGroupsCompetition(competition);
  const rawMatches = Array.isArray(competition.matches) ? competition.matches : [];
  const matches = typeKey === "world_cup" ? resolveWorldCupDependencies({ ...competition, matches: rawMatches }) : (typeKey === "champions_league" || leagueGroupsMode) ? resolveChampionsLeagueDependencies({ ...competition, matches: rawMatches }) : rawMatches;
  const groupOrderMap = new Map();
  const groupCounters = new Map();
  matches.forEach((match, index) => {
    if (clean(match.phase || "") !== "group") return;
    const groupKey = clean(match.groupKey || match.groupName || match.round || "A");
    const order = groupCounters.get(groupKey) || 0;
    groupCounters.set(groupKey, order + 1);
    groupOrderMap.set(String(match.id || index), order + 1);
  });
  const groupIndexFor = (match = {}) => {
    const groupKey = clean(match.groupKey || "");
    if (groupKey === "A") return 1;
    if (groupKey === "B") return 2;
    if (groupKey === "C") return 3;
    return Math.max(1, toNumber(match.round || 1));
  };
  const sortValue = (match = {}, index = 0) => {
    if (clean(match.phase || "") === "group") {
      const localOrder = groupOrderMap.get(String(match.id || index)) || toNumber(match.groupMatchNo || match.matchNumber || 1) || 1;
      return 100000 + localOrder * 100 + groupIndexFor(match);
    }
    return competitionMatchSortValue(match);
  };
  return [...matches].map((match, index) => ({ match, index })).sort((a, b) => sortValue(a.match, a.index) - sortValue(b.match, b.index) || a.index - b.index).map(({ match }) => match);
}

function scheduleStageTitleForMatch(competition = {}, match = {}) {
  const typeKey = competitionTypeKey(competition.type || "league");
  const leagueGroupsMode = isLeagueGroupsCompetition(competition);
  const phase = clean(match.phase || "");
  if (typeKey === "world_cup") return worldCupAdminRoundTitle(match, match.round || "");
  if (typeKey === "champions_league") return championsLeagueAdminRoundTitle(match, match.round || "");
  if (leagueGroupsMode) return leagueTwoGroupsAdminRoundTitle(match, match.round || "");
  if (phase === "qualification") return match.label || "الملحق المؤهل";
  return match.round ? "الجولة " + match.round : (match.label || "المباريات");
}

function resolveKnockoutBracketDependencies(matches = []) {
  const winnerMap = new Map();
  (matches || []).forEach((match) => {
    if (clean(match.resultStatus || match.status) === "completed" && match.winnerMemberId) {
      winnerMap.set(match.id, { memberId: cleanId(match.winnerMemberId), memberName: match.winnerName || match.winnerMemberName || match.winnerMemberId });
    }
  });
  return (matches || []).map((match) => {
    const next = { ...match };
    const homeRef = cleanId(next.homeWaitingForWinnerOf || (String(next.homeMemberId || "").startsWith("__winner__") ? String(next.homeMemberId).replace("__winner__", "") : ""));
    const awayRef = cleanId(next.awayWaitingForWinnerOf || (String(next.awayMemberId || "").startsWith("__winner__") ? String(next.awayMemberId).replace("__winner__", "") : ""));
    const homeWinner = homeRef ? winnerMap.get(homeRef) : null;
    const awayWinner = awayRef ? winnerMap.get(awayRef) : null;
    if (homeWinner) {
      next.homeMemberId = homeWinner.memberId;
      next.homeName = homeWinner.memberName;
    }
    if (awayWinner) {
      next.awayMemberId = awayWinner.memberId;
      next.awayName = awayWinner.memberName;
    }
    return next;
  });
}

function computeKnockoutQualifiedIds(competition = {}) {
  const champion = getKnockoutChampion(competition);
  return champion?.memberId ? [champion.memberId] : [];
}

function getKnockoutChampion(competition = {}) {
  const matches = Array.isArray(competition.matches) ? competition.matches : [];
  const typeKey = competitionTypeKey(competition.type || "");
  const finalMatch = ["world_cup", "champions_league"].includes(typeKey)
    ? matches.find((match) => clean(match.phase || "") === "final" && clean(match.resultStatus || match.status) === "completed" && match.winnerMemberId)
    : matches.slice().sort((a, b) => toNumber(b.round) - toNumber(a.round) || String(b.id || "").localeCompare(String(a.id || ""))).find((match) => clean(match.resultStatus || match.status) === "completed" && match.winnerMemberId);
  if (!finalMatch) return null;
  return { memberId: cleanId(finalMatch.winnerMemberId), memberName: finalMatch.winnerName || getMemberName(competition.participants || [], finalMatch.winnerMemberId) || finalMatch.winnerMemberId };
}

function getKnockoutRewardRows(competition = {}) {
  const matches = Array.isArray(competition.matches) ? competition.matches : [];
  const sortedCompleted = matches
    .slice()
    .sort((a, b) => toNumber(b.round) - toNumber(a.round) || String(b.id || "").localeCompare(String(a.id || "")))
    .filter((match) => clean(match.resultStatus || match.status) === "completed" && match.winnerMemberId);
  const finalMatch = sortedCompleted.find((match) => clean(match.phase || "") === "final") || (competitionTypeKey(competition.type || "") === "super_cup" ? sortedCompleted[0] : null);
  if (!finalMatch) return [];
  const winnerId = cleanId(finalMatch.winnerMemberId);
  const homeId = cleanId(finalMatch.homeMemberId);
  const awayId = cleanId(finalMatch.awayMemberId);
  const runnerId = same(winnerId, homeId) ? awayId : homeId;
  const rows = [];
  if (winnerId) rows.push({ rank: 1, memberId: winnerId, memberName: finalMatch.winnerName || getMemberName(competition.participants || [], winnerId) || winnerId });
  if (runnerId && runnerId !== "__bye__") rows.push({ rank: 2, memberId: runnerId, memberName: getMemberName(competition.participants || [], runnerId) || (same(runnerId, homeId) ? finalMatch.homeName : finalMatch.awayName) || runnerId });
  if (["world_cup", "champions_league"].includes(competitionTypeKey(competition.type || ""))) {
    const thirdMatch = sortedCompleted.find((match) => clean(match.phase || "") === "third_place");
    if (thirdMatch) {
      const thirdId = cleanId(thirdMatch.winnerMemberId);
      const thirdHomeId = cleanId(thirdMatch.homeMemberId);
      const thirdAwayId = cleanId(thirdMatch.awayMemberId);
      const fourthId = same(thirdId, thirdHomeId) ? thirdAwayId : thirdHomeId;
      if (thirdId) rows.push({ rank: 3, memberId: thirdId, memberName: thirdMatch.winnerName || getMemberName(competition.participants || [], thirdId) || thirdId });
      if (fourthId && fourthId !== "__bye__") rows.push({ rank: 4, memberId: fourthId, memberName: getMemberName(competition.participants || [], fourthId) || (same(fourthId, thirdHomeId) ? thirdMatch.homeName : thirdMatch.awayName) || fourthId });
    }
  }
  return rows;
}

function resolveLeagueQualifierDependencies(matches = []) {
  const winnerMap = new Map();
  (matches || []).forEach((match) => {
    if (clean(match.resultStatus || match.status) === "completed" && match.winnerMemberId) {
      winnerMap.set(match.id, { memberId: match.winnerMemberId, memberName: match.winnerName || match.winnerMemberName || match.winnerMemberId });
    }
  });
  return (matches || []).map((match) => {
    if (!match.waitingForWinnerOf) return match;
    const winner = winnerMap.get(match.waitingForWinnerOf);
    if (!winner) return match;
    const next = { ...match };
    if (String(next.homeMemberId || "").startsWith("__winner__")) {
      next.homeMemberId = winner.memberId;
      next.homeName = winner.memberName;
    }
    if (String(next.awayMemberId || "").startsWith("__winner__")) {
      next.awayMemberId = winner.memberId;
      next.awayName = winner.memberName;
    }
    return next;
  });
}

function computeLeagueQualifierQualifiedIds(competition = {}) {
  const matches = Array.isArray(competition.matches) ? competition.matches : [];
  const q = Math.max(1, toNumber(competition.qualifiersCount || 1));
  const ids = [];
  matches.forEach((match) => {
    if (match.phase === "bye" && match.winnerMemberId) ids.push(cleanId(match.winnerMemberId));
    if (clean(match.resultStatus || match.status) === "completed" && match.winnerMemberId && ["qualifier", "final"].includes(clean(match.phase || ""))) ids.push(cleanId(match.winnerMemberId));
  });
  return Array.from(new Set(ids.filter(Boolean))).slice(0, q);
}

function getLeagueQualifierChampion(competition = {}) {
  const matches = Array.isArray(competition.matches) ? competition.matches : [];
  const finalMatch = matches.slice().reverse().find((match) => clean(match.resultStatus || match.status) === "completed" && match.winnerMemberId);
  if (!finalMatch) return null;
  return { memberId: cleanId(finalMatch.winnerMemberId), memberName: finalMatch.winnerName || getMemberName(competition.participants || [], finalMatch.winnerMemberId) || finalMatch.winnerMemberId };
}

async function loadCanvasImage(src) {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = normalizeImageUrl(src) || src;
  });
}

async function downloadMemberProfileImage({ member = {}, players = [], balance = 0, trophiesCount = 0, logoUrl = "", contracts = [], memberId = "" } = {}) {
  const width = 1080;
  const visibleCount = Math.min(26, players.length);
  const rowHeight = 44;
  const height = Math.max(1450, 820 + visibleCount * rowHeight + (players.length > visibleCount ? 46 : 0));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.direction = "rtl";

  const grad = ctx.createLinearGradient(0, 0, width, height);
  grad.addColorStop(0, "#020617");
  grad.addColorStop(0.45, "#0f172a");
  grad.addColorStop(1, "#06111f");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "rgba(0,229,255,.12)";
  ctx.beginPath();
  ctx.arc(160, 150, 170, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(47,140,255,.13)";
  ctx.beginPath();
  ctx.arc(940, 300, 220, 0, Math.PI * 2);
  ctx.fill();

  roundRect(ctx, 70, 70, width - 140, 310, 42, "rgba(255,255,255,.10)", "rgba(255,255,255,.22)");
  const brandLogo = await loadCanvasImage(logoUrl);
  if (brandLogo) {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(width - 225, 96, 110, 110, 28) : ctx.rect(width - 225, 96, 110, 110);
    ctx.clip();
    ctx.drawImage(brandLogo, width - 225, 96, 110, 110);
    ctx.restore();
  }
  ctx.fillStyle = "#67e8f9";
  ctx.font = "900 34px Tahoma, Arial";
  ctx.textAlign = "right";
  ctx.fillText("FIFA GROUP", brandLogo ? width - 250 : width - 115, 132);
  ctx.fillStyle = "#f8fafc";
  ctx.font = "900 72px Tahoma, Arial";
  ctx.fillText(member.name || "عضو", width - 115, 218);
  ctx.fillStyle = "#cbd5e1";
  ctx.font = "800 30px Tahoma, Arial";
  ctx.fillText((member.team || "بدون فريق") + "  •  " + (member.nationalteam || member.nationalTeam || "بدون منتخب"), width - 115, 270);

  const avatarImg = await loadCanvasImage(member.avatar);
  ctx.save();
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(100, 112, 210, 210, 42) : ctx.rect(100, 112, 210, 210);
  ctx.clip();
  if (avatarImg) ctx.drawImage(avatarImg, 100, 112, 210, 210);
  else {
    const avGrad = ctx.createLinearGradient(100, 112, 310, 322);
    avGrad.addColorStop(0, "#22d3ee");
    avGrad.addColorStop(1, "#2563eb");
    ctx.fillStyle = avGrad;
    ctx.fillRect(100, 112, 210, 210);
    ctx.fillStyle = "#020617";
    ctx.font = "900 88px Tahoma, Arial";
    ctx.textAlign = "center";
    ctx.fillText(String(member.name || "F").slice(0, 1), 205, 248);
  }
  ctx.restore();

  const statY = 420;
  drawStatBox(ctx, width - 70 - 290, statY, 290, 130, "الرصيد", formatMoney(balance));
  drawStatBox(ctx, width - 70 - 610, statY, 290, 130, "إجمالي البطولات", String(trophiesCount));
  drawStatBox(ctx, 70, statY, 290, 130, "عدد اللاعبين", String(players.length));

  roundRect(ctx, 70, 590, width - 140, height - 710, 38, "rgba(255,255,255,.08)", "rgba(255,255,255,.18)");
  ctx.fillStyle = "#ecfeff";
  ctx.font = "900 38px Tahoma, Arial";
  ctx.textAlign = "right";
  ctx.fillText("قائمة اللاعبين", width - 115, 655);

  const startY = 710;
  const visiblePlayers = players.slice(0, visibleCount);
  visiblePlayers.forEach((player, index) => {
    const y = startY + index * rowHeight;
    const kindLabel = getPlayerRosterKindLabel(player, contracts, memberId);
    ctx.fillStyle = index % 2 ? "rgba(255,255,255,.035)" : "rgba(255,255,255,.065)";
    ctx.fillRect(100, y - 28, width - 200, 38);
    ctx.fillStyle = "#f8fafc";
    ctx.font = "800 24px Tahoma, Arial";
    ctx.textAlign = "right";
    ctx.fillText(`${index + 1}. ${player.name || "لاعب"}`, width - 125, y);
    ctx.fillStyle = "#a8b3c7";
    ctx.font = "800 20px Tahoma, Arial";
    ctx.textAlign = "left";
    ctx.fillText(`${kindLabel}  •  ${player.position || "-"}  •  ${player.rating || "-"}`, 120, y);
  });
  if (players.length > visiblePlayers.length) {
    ctx.fillStyle = "#67e8f9";
    ctx.font = "900 24px Tahoma, Arial";
    ctx.textAlign = "center";
    ctx.fillText(`+ ${players.length - visiblePlayers.length} لاعبين آخرين`, width / 2, startY + visiblePlayers.length * rowHeight + 24);
  }

  const exportDate = new Date().toLocaleString("ar", { hour12: false });
  ctx.fillStyle = "#94a3b8";
  ctx.font = "800 22px Tahoma, Arial";
  ctx.textAlign = "center";
  ctx.fillText(`تم إنشاء البطاقة من تطبيق FIFA GROUP • ${exportDate}`, width / 2, height - 55);

  try {
    const link = document.createElement("a");
    link.download = `FIFA-GROUP-${safeFileName(member.name || "member")}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  } catch (err) {
    console.error("Member profile image failed:", err);
    alert("تعذر حفظ صورة العضو بسبب قيود تحميل الصور الخارجية. جرّب لاحقًا أو غيّر صورة العضو لرابط مباشر.");
  }
}

function drawStatBox(ctx, x, y, w, h, label, value) {
  roundRect(ctx, x, y, w, h, 30, "rgba(255,255,255,.09)", "rgba(255,255,255,.18)");
  ctx.fillStyle = "#94a3b8";
  ctx.font = "800 24px Tahoma, Arial";
  ctx.textAlign = "center";
  ctx.fillText(label, x + w / 2, y + 42);
  ctx.fillStyle = "#ecfeff";
  ctx.font = "900 34px Tahoma, Arial";
  ctx.fillText(String(value), x + w / 2, y + 92);
}

function exportDateTimeLabel() {
  return new Date().toLocaleString("ar", { hour12: false });
}

function isCompetitionCompleted(competition = {}) {
  return clean(competition.status || "") === "completed";
}

async function downloadCompetitionStandingsImage(competition = {}, config = {}, trophyMap = {}) {
  try {
    if (["world_cup", "champions_league"].includes(competitionTypeKey(competition.type)) || isLeagueGroupsCompetition(competition)) {
      await downloadWorldCupGroupsStandingsImage(competition, config, trophyMap);
      return;
    }
    const rows = computeLeagueStandings(competition.participants || [], competition.matches || []);
    const title = (competition.name || "ترتيب الدوري") + " - الترتيب";
    const subtitle = isCompetitionCompleted(competition) && competition.championMemberName ? "البطل: " + competition.championMemberName : "";
    const headers = ["#", "العضو", "لعب", "ف", "ت", "خ", "له", "عليه", "فارق", "نقاط"];
    const body = rows.map((row, index) => [index + 1, row.memberName, row.played, row.wins, row.draws, row.losses, row.goalsFor, row.goalsAgainst, row.goalDifference, row.points]);
    const relegatedIds = Array.isArray(competition.relegatedMemberIds) ? competition.relegatedMemberIds : [];
    const rowStyles = rows.map((row, index) => index === 0 ? { stroke: "rgba(250,204,21,.95)", fill: "rgba(250,204,21,.10)", lineWidth: 2.6 } : relegatedIds.some((id) => same(id, row.memberId)) ? { stroke: "rgba(248,113,113,.95)", fill: "rgba(127,29,29,.20)", lineWidth: 2.4 } : null);
    await drawFifaGroupTableImage({ title, subtitle, headers, rows: body, rowStyles, filename: safeFileName(title) + ".png", footer: exportDateTimeLabel(), logoUrl: exportBrandLogoUrl(config), competition, trophyMap });
  } catch (err) {
    console.error("download standings image failed", err);
  }
}

async function downloadWorldCupGroupsStandingsImage(competition = {}, config = {}, trophyMap = {}) {
  if (typeof document === "undefined") return;
  const typeKey = competitionTypeKey(competition.type || "");
  const leagueGroupsMode = isLeagueGroupsCompetition(competition);
  const groups = (typeKey === "champions_league" || leagueGroupsMode) ? championsLeagueGroupRows(competition || {}) : worldCupGroupRows(competition || {});
  const worldCupQualifiedIds = typeKey === "world_cup" ? computeWorldCupQualifiedIds(competition || {}) : [];
  const defaultName = leagueGroupsMode ? "الدوري" : typeKey === "champions_league" ? "دوري الأبطال" : "كأس العالم";
  const title = (competition.name || defaultName) + " - ترتيب دور المجموعات";
  const subtitle = (typeKey === "champions_league" || leagueGroupsMode) ? "يتأهل الأول والثاني من كل مجموعة" : "يتأهل أول كل مجموعة + أفضل ثاني";
  const width = 1200;
  const groupBoxW = (typeKey === "champions_league" || leagueGroupsMode) ? 460 : 344;
  const groupGap = (typeKey === "champions_league" || leagueGroupsMode) ? 42 : 24;
  const rowH = 48;
  const headerH = 190;
  const footerH = 74;
  const maxRows = Math.max(1, ...groups.map((group) => Math.max(1, (group.standings || []).length)));
  const groupBoxH = 92 + rowH * (maxRows + 1) + 26;
  const height = headerH + groupBoxH + footerH;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.direction = "rtl";

  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#020617");
  gradient.addColorStop(0.55, "#081126");
  gradient.addColorStop(1, "#0f172a");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "rgba(0,229,255,0.13)";
  ctx.beginPath(); ctx.arc(135, 98, 180, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "rgba(139,92,246,0.12)";
  ctx.beginPath(); ctx.arc(1070, 86, 220, 0, Math.PI * 2); ctx.fill();

  const compLogo = await loadCanvasImage(competitionLogoUrl(competition || {}, config, trophyMap));
  if (compLogo) {
    ctx.save();
    roundRect(ctx, width - 150, 34, 88, 88, 24);
    ctx.clip();
    ctx.drawImage(compLogo, width - 150, 34, 88, 88);
    ctx.restore();
  }
  const brandLogo = await loadCanvasImage(exportBrandLogoUrl(config));
  if (brandLogo) {
    ctx.save();
    roundRect(ctx, 58, 38, 82, 82, 22);
    ctx.clip();
    ctx.drawImage(brandLogo, 58, 38, 82, 82);
    ctx.restore();
  }

  ctx.textAlign = "right";
  ctx.fillStyle = "#e0f2fe";
  ctx.font = "900 48px Tahoma, Arial";
  ctx.fillText(title, width - (compLogo ? 170 : 58), 76);
  ctx.fillStyle = "#67e8f9";
  ctx.font = "800 24px Tahoma, Arial";
  ctx.fillText(subtitle, width - (compLogo ? 170 : 58), 118);

  const startY = headerH;
  const startX = width - 48 - groupBoxW;
  const headers = ["#", "العضو", "لعب", "فارق", "نقاط"];
  const colRatios = [0.15, 0.40, 0.15, 0.15, 0.15];
  groups.forEach((group, groupIndex) => {
    const x = startX - groupIndex * (groupBoxW + groupGap);
    roundRect(ctx, x, startY, groupBoxW, groupBoxH, 24);
    ctx.fillStyle = "rgba(15,23,42,.72)";
    ctx.fill();
    ctx.strokeStyle = "rgba(56,189,248,.24)";
    ctx.lineWidth = 1.8;
    ctx.stroke();

    ctx.textAlign = "center";
    ctx.fillStyle = "#67e8f9";
    ctx.font = "900 26px Tahoma, Arial";
    ctx.fillText("المجموعة " + group.groupName, x + groupBoxW / 2, startY + 42);
    const expectedGroupSize = (typeKey === "champions_league" || leagueGroupsMode) ? 4 : 3;
    if (group.participants.length < expectedGroupSize) {
      ctx.fillStyle = "#fde68a";
      ctx.font = "800 15px Tahoma, Arial";
      ctx.fillText("راحة / BYE: " + Math.max(0, expectedGroupSize - group.participants.length) + " مقعد", x + groupBoxW / 2, startY + 68);
    }

    const tableX = x + 16;
    const tableW = groupBoxW - 32;
    const tableY = startY + 82;
    roundRect(ctx, tableX, tableY, tableW, rowH, 16);
    ctx.fillStyle = "rgba(0,229,255,.16)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.10)";
    ctx.lineWidth = 1;
    ctx.stroke();

    let cx = tableX + tableW;
    ctx.textAlign = "center";
    ctx.fillStyle = "#cffafe";
    ctx.font = "900 16px Tahoma, Arial";
    headers.forEach((head, i) => {
      const cw = tableW * colRatios[i];
      ctx.fillText(head, cx - cw / 2, tableY + 30);
      cx -= cw;
    });

    const rows = (group.standings || []);
    if (!rows.length) {
      ctx.fillStyle = "#94a3b8";
      ctx.font = "900 18px Tahoma, Arial";
      ctx.fillText("لا يوجد مشاركون", x + groupBoxW / 2, tableY + rowH + 34);
    } else {
      rows.forEach((row, index) => {
        const y = tableY + rowH + index * rowH;
        roundRect(ctx, tableX, y + 4, tableW, rowH - 8, 14);
        const isQualifiedRow = (typeKey === "champions_league" || leagueGroupsMode) ? index < 2 : worldCupQualifiedIds.some((id) => same(id, row.memberId));
        ctx.fillStyle = isQualifiedRow ? "rgba(34,197,94,.12)" : "rgba(15,23,42,.68)";
        ctx.fill();
        ctx.strokeStyle = isQualifiedRow ? "rgba(34,197,94,.24)" : "rgba(147,197,253,.08)";
        ctx.lineWidth = 1;
        ctx.stroke();
        const values = [index + 1, row.memberName || "-", row.played ?? 0, row.goalDifference ?? 0, row.points ?? 0];
        let vx = tableX + tableW;
        values.forEach((value, i) => {
          const cw = tableW * colRatios[i];
          ctx.fillStyle = i === 4 ? "#f8fafc" : isQualifiedRow && i === 1 ? "#bbf7d0" : "#e5e7eb";
          ctx.font = i === 1 ? "900 17px Tahoma, Arial" : "900 18px Tahoma, Arial";
          ctx.textAlign = "center";
          ctx.fillText(String(value), vx - cw / 2, y + 33);
          vx -= cw;
        });
      });
    }
  });

  ctx.textAlign = "center";
  ctx.fillStyle = "#94a3b8";
  ctx.font = "800 22px Tahoma, Arial";
  ctx.fillText(exportDateTimeLabel(), width / 2, height - 30);
  const link = document.createElement("a");
  link.download = safeFileName(title) + ".png";
  link.href = canvas.toDataURL("image/png");
  link.click();
}

async function downloadCompetitionResultsImage(competition = {}, config = {}, trophyMap = {}) {
  try {
    if (competitionTypeKey(competition.type) === "super_cup") {
      await drawFifaGroupSuperCupFinalImage({
        competition,
        config,
        trophyMap,
        filename: safeFileName((competition.name || "كأس السوبر") + "-final") + ".png",
      });
      return;
    }
    if (competitionTypeKey(competition.type) === "league_qualifier" || isKnockoutCompetitionType(competitionTypeKey(competition.type)) || isLeagueGroupsCompetition(competition)) {
      await drawFifaGroupBracketImage({
        competition,
        config,
        trophyMap,
        filename: safeFileName((competition.name || "الأدوار الإقصائية") + "-knockout") + ".png",
      });
      return;
    }
    const matchesLabel = isCompetitionCompleted(competition) ? "نتائج المباريات" : "جدول المباريات";
    const title = (competition.name || "الدوري") + " - " + matchesLabel;
    const leagueGroupsMode = isLeagueGroupsCompetition(competition);
    const rows = sortedCompetitionMatchesForSchedule(competition).map((match) => {
      const completed = clean(match.resultStatus || match.status) === "completed";
      const stageLabel = leagueGroupsMode ? scheduleStageTitleForMatch(competition, match) : (match.round || "-");
      return [
        stageLabel,
        match.homeName || "-",
        completed ? `${match.homeGoals} - ${match.awayGoals}` : "-",
        match.awayName || "-",
        match.gameTitle || "-",
      ];
    });
    await drawFifaGroupTableImage({
      title,
      subtitle: "",
      headers: [leagueGroupsMode ? "المرحلة / المجموعة" : "الجولة", "الطرف الأول", "النتيجة", "الطرف الثاني", "اللعبة"],
      rows,
      filename: safeFileName(title) + ".png",
      footer: exportDateTimeLabel(),
      logoUrl: exportBrandLogoUrl(config),
      competition,
      trophyMap,
    });
  } catch (err) {
    console.error("download results image failed", err);
  }
}


async function downloadCompetitionScheduleTableImage(competition = {}, config = {}, trophyMap = {}) {
  try {
    const matchesLabel = isCompetitionCompleted(competition) ? "نتائج المباريات" : "جدول المباريات";
    const title = (competition.name || "البطولة") + " - " + matchesLabel;
    const rows = sortedCompetitionMatchesForSchedule(competition).map((match) => {
      const completed = clean(match.resultStatus || match.status) === "completed";
      return [
        scheduleStageTitleForMatch(competition, match),
        match.homeName || "-",
        completed ? `${match.homeGoals} - ${match.awayGoals}` : "-",
        match.awayName || "-",
        match.gameTitle || "-",
      ];
    });
    await drawFifaGroupTableImage({
      title,
      subtitle: "",
      headers: ["المرحلة / المجموعة", "الطرف الأول", "النتيجة", "الطرف الثاني", "اللعبة"],
      rows,
      filename: safeFileName(title) + ".png",
      footer: exportDateTimeLabel(),
      logoUrl: exportBrandLogoUrl(config),
      competition,
      trophyMap,
    });
  } catch (err) {
    console.error("download schedule table image failed", err);
  }
}

async function drawFifaGroupSuperCupFinalImage({ competition = {}, config = {}, trophyMap = {}, filename = "fifa-group-super-cup.png" }) {
  if (typeof document === "undefined") return;
  const matches = Array.isArray(competition.matches) ? competition.matches : [];
  const finalMatch = matches.find((match) => clean(match.phase || "") === "final") || matches[0] || {};
  const completed = clean(finalMatch.resultStatus || finalMatch.status) === "completed";
  const winnerName = clean(finalMatch.winnerName || "");
  const homeWinner = winnerName && same(winnerName, finalMatch.homeName);
  const awayWinner = winnerName && same(winnerName, finalMatch.awayName);
  const scoreText = completed ? `${finalMatch.homeGoals} - ${finalMatch.awayGoals}` : "-";
  const pensText = completed && finalMatch.homePens !== null && finalMatch.homePens !== undefined && finalMatch.awayPens !== null && finalMatch.awayPens !== undefined ? `ترجيح ${finalMatch.homePens} - ${finalMatch.awayPens}` : "";
  const width = 1200;
  const height = 720;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.direction = "rtl";

  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#020617");
  gradient.addColorStop(0.55, "#081126");
  gradient.addColorStop(1, "#0f172a");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "rgba(0,229,255,0.13)";
  ctx.beginPath(); ctx.arc(130, 100, 180, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "rgba(139,92,246,0.12)";
  ctx.beginPath(); ctx.arc(1080, 85, 220, 0, Math.PI * 2); ctx.fill();

  const compLogo = await loadCanvasImage(competitionLogoUrl(competition || {}, config, trophyMap));
  if (compLogo) {
    ctx.save();
    roundRect(ctx, width - 150, 34, 88, 88, 24);
    ctx.clip();
    ctx.drawImage(compLogo, width - 150, 34, 88, 88);
    ctx.restore();
  }
  const brandLogo = await loadCanvasImage(exportBrandLogoUrl(config));
  if (brandLogo) {
    ctx.save();
    roundRect(ctx, 58, 38, 78, 78, 22);
    ctx.clip();
    ctx.drawImage(brandLogo, 58, 38, 78, 78);
    ctx.restore();
  }

  ctx.textAlign = "right";
  ctx.fillStyle = "#e0f2fe";
  ctx.font = "900 50px Tahoma, Arial";
  ctx.fillText((competition.name || "كأس السوبر") + " - النهائي", width - (compLogo ? 170 : 58), 78);

  roundRect(ctx, 76, 160, 1048, 430, 32);
  ctx.fillStyle = "rgba(15,23,42,.72)";
  ctx.fill();
  ctx.strokeStyle = "rgba(250,204,21,.32)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.textAlign = "center";
  ctx.fillStyle = "#fde68a";
  ctx.font = "900 30px Tahoma, Arial";
  ctx.fillText("النهائي", width / 2, 210);

  const cardX = 150;
  const cardY = 258;
  const cardW = 900;
  const cardH = 170;
  roundRect(ctx, cardX, cardY, cardW, cardH, 26);
  ctx.fillStyle = "rgba(0,229,255,.10)";
  ctx.fill();
  ctx.strokeStyle = "rgba(0,229,255,.35)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.textAlign = "right";
  ctx.font = homeWinner ? "900 36px Tahoma, Arial" : "900 32px Tahoma, Arial";
  ctx.fillStyle = homeWinner ? "#bbf7d0" : "#f8fafc";
  ctx.fillText(finalMatch.homeName || "-", cardX + cardW - 44, cardY + 62);
  ctx.font = awayWinner ? "900 36px Tahoma, Arial" : "900 32px Tahoma, Arial";
  ctx.fillStyle = awayWinner ? "#bbf7d0" : "#f8fafc";
  ctx.fillText(finalMatch.awayName || "-", cardX + cardW - 44, cardY + 126);

  ctx.textAlign = "center";
  ctx.font = "1000 46px Tahoma, Arial";
  ctx.fillStyle = "#67e8f9";
  ctx.fillText(scoreText, cardX + 132, cardY + 76);
  ctx.font = "900 20px Tahoma, Arial";
  ctx.fillText(finalMatch.gameTitle || "PES 2017", cardX + 132, cardY + 112);
  if (pensText) {
    ctx.fillStyle = "#bbf7d0";
    ctx.font = "900 20px Tahoma, Arial";
    ctx.fillText(pensText, cardX + 132, cardY + 142);
  }

  if (winnerName) {
    roundRect(ctx, 365, 462, 470, 64, 22);
    ctx.fillStyle = "rgba(34,197,94,.16)";
    ctx.fill();
    ctx.strokeStyle = "rgba(34,197,94,.28)";
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.fillStyle = "#bbf7d0";
    ctx.font = "900 26px Tahoma, Arial";
    ctx.textAlign = "center";
    ctx.fillText("بطل السوبر: " + winnerName, width / 2, 503);
  }

  ctx.textAlign = "center";
  ctx.fillStyle = "#94a3b8";
  ctx.font = "800 22px Tahoma, Arial";
  ctx.fillText(exportDateTimeLabel(), width / 2, height - 32);
  const link = document.createElement("a");
  link.download = filename;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

async function drawFifaGroupBracketImage({ competition = {}, config = {}, trophyMap = {}, filename = "fifa-group-bracket.png" }) {
  if (typeof document === "undefined") return;
  const typeKey = competitionTypeKey(competition.type || "");
  const leagueGroupsMode = isLeagueGroupsCompetition(competition);
  const bracketMatches = (["world_cup", "champions_league"].includes(typeKey) || leagueGroupsMode)
    ? (competition.matches || []).filter((match) => clean(match.phase) !== "group")
    : (competition.matches || []);
  const grouped = typeKey === "world_cup"
    ? worldCupKnockoutColumns({ ...competition, matches: bracketMatches }).map((column, index) => ({ round: index + 1, key: column.key, label: column.title, matches: column.matches }))
    : typeKey === "champions_league"
      ? championsLeagueKnockoutColumns({ ...competition, matches: bracketMatches }).map((column, index) => ({ round: index + 1, key: column.key, label: column.title, matches: column.matches }))
      : groupLeagueMatchesByRound(bracketMatches).map((group, index) => ({ ...group, round: index + 1 }));
  const width = 1200;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  const cardHeight = 108;
  const gapCard = 16;
  const columnGap = 18;
  const panelTop = 140;
  const panelBottomPad = 76;
  const panelHeight = 560;
  const height = panelTop + panelHeight + panelBottomPad;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.direction = "rtl";

  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#020617");
  gradient.addColorStop(0.55, "#081126");
  gradient.addColorStop(1, "#0f172a");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "rgba(0,229,255,0.13)";
  ctx.beginPath(); ctx.arc(130, 100, 180, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "rgba(139,92,246,0.12)";
  ctx.beginPath(); ctx.arc(1080, 90, 220, 0, Math.PI * 2); ctx.fill();

  const title = (competition.name || "ملحق الدوري") + " - الأدوار الإقصائية";
  const compLogo = await loadCanvasImage(competitionLogoUrl(competition || {}, config, trophyMap));
  if (compLogo) {
    ctx.save();
    roundRect(ctx, width - 150, 34, 88, 88, 24);
    ctx.clip();
    ctx.drawImage(compLogo, width - 150, 34, 88, 88);
    ctx.restore();
  }
  const brandLogo = await loadCanvasImage(exportBrandLogoUrl(config));
  if (brandLogo) {
    ctx.save();
    roundRect(ctx, 58, 38, 78, 78, 22);
    ctx.clip();
    ctx.drawImage(brandLogo, 58, 38, 78, 78);
    ctx.restore();
  }
  ctx.fillStyle = "#e0f2fe";
  ctx.font = "800 48px Tahoma, Arial";
  ctx.textAlign = "right";
  ctx.fillText(title, width - (compLogo ? 170 : 58), 78);

  const columnCount = Math.max(1, grouped.length);
  const usableWidth = width - 110;
  const columnWidth = Math.floor((usableWidth - (columnGap * (columnCount - 1))) / columnCount);
  const startX = width - 34 - columnWidth;
  grouped.forEach((group, colIndex) => {
    const x = startX - colIndex * (columnWidth + columnGap);
    const isFinalRound = typeKey === "world_cup" ? clean(group.key) === "final" : colIndex === columnCount - 1;
    roundRect(ctx, x, panelTop, columnWidth, panelHeight, 22);
    ctx.fillStyle = isFinalRound ? "rgba(250,204,21,.10)" : "rgba(37,99,235,.16)";
    ctx.fill();
    ctx.strokeStyle = isFinalRound ? "rgba(250,204,21,.30)" : "rgba(56,189,248,.20)";
    ctx.lineWidth = 1.6;
    ctx.stroke();

    ctx.textAlign = "center";
    ctx.fillStyle = isFinalRound ? "#fde68a" : "#dbeafe";
    ctx.font = "900 22px Tahoma, Arial";
    ctx.fillText(group.label || roundLabelForBracket(group.round, grouped.length), x + columnWidth / 2, panelTop + 34);

    const cardsAreaTop = panelTop + 54;
    const cardsAreaHeight = panelHeight - 84;
    const stackHeight = group.matches.length * cardHeight + Math.max(0, group.matches.length - 1) * gapCard;
    const startY = cardsAreaTop + Math.max(0, (cardsAreaHeight - stackHeight) / 2);

    group.matches.forEach((match, rowIndex) => {
      const y = startY + rowIndex * (cardHeight + gapCard);
      const completed = clean(match.resultStatus || match.status) === "completed";
      const score = completed ? `${match.homeGoals} - ${match.awayGoals}` : "-";
      const pens = completed && match.homePens !== null && match.homePens !== undefined && match.awayPens !== null && match.awayPens !== undefined ? `ترجيح ${match.homePens} - ${match.awayPens}` : "";
      const winnerName = clean(match.winnerName || "");
      const homeWinner = winnerName && same(winnerName, match.homeName);
      const awayWinner = winnerName && same(winnerName, match.awayName);
      roundRect(ctx, x + 14, y, columnWidth - 28, cardHeight, 18);
      ctx.fillStyle = isFinalRound ? "rgba(15,23,42,.82)" : completed ? "rgba(0,229,255,.10)" : "rgba(15,23,42,.74)";
      ctx.fill();
      ctx.strokeStyle = isFinalRound ? "rgba(250,204,21,.34)" : completed ? "rgba(0,229,255,.30)" : "rgba(147,197,253,.14)";
      ctx.lineWidth = 1.6;
      ctx.stroke();

      ctx.textAlign = "right";
      ctx.font = homeWinner ? "900 24px Tahoma, Arial" : "900 22px Tahoma, Arial";
      ctx.fillStyle = homeWinner ? "#bbf7d0" : "#f8fafc";
      ctx.fillText(match.homeName || "-", x + columnWidth - 34, y + 36);
      ctx.font = awayWinner ? "900 24px Tahoma, Arial" : "900 22px Tahoma, Arial";
      ctx.fillStyle = awayWinner ? "#bbf7d0" : "#f8fafc";
      ctx.fillText(match.awayName || "-", x + columnWidth - 34, y + 78);

      ctx.textAlign = "center";
      ctx.font = "1000 28px Tahoma, Arial";
      ctx.fillStyle = "#67e8f9";
      ctx.fillText(score, x + 76, y + 52);
      ctx.font = "800 15px Tahoma, Arial";
      ctx.fillStyle = "#67e8f9";
      ctx.fillText(match.gameTitle || "PES 2017", x + 76, y + 76);
      ctx.font = "800 14px Tahoma, Arial";
      ctx.fillStyle = pens ? "#bbf7d0" : "#94a3b8";
      ctx.fillText(pens || (winnerName ? `الفائز: ${winnerName}` : (completed ? "مكتملة" : "بانتظار النتيجة")), x + 76, y + 96);
    });
  });

  ctx.textAlign = "center";
  ctx.fillStyle = "#94a3b8";
  ctx.font = "800 22px Tahoma, Arial";
  ctx.fillText(exportDateTimeLabel(), width / 2, height - 28);
  const link = document.createElement("a");
  link.download = filename;
  link.href = canvas.toDataURL("image/png");
  link.click();
}


async function drawFifaGroupTableImage({ title, subtitle = "", headers = [], rows = [], rowStyles = [], filename = "fifa-group.png", footer = "", logoUrl = "", competition = null, trophyMap = {} }) {
  if (typeof document === "undefined") return;
  const width = 1200;
  const rowHeight = 54;
  const headerHeight = 190;
  const footerHeight = 70;
  const height = Math.max(420, headerHeight + rowHeight * (rows.length + 1) + footerHeight);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.direction = "rtl";

  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#020617");
  gradient.addColorStop(0.55, "#081126");
  gradient.addColorStop(1, "#0f172a");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "rgba(0,229,255,0.14)";
  ctx.beginPath(); ctx.arc(170, 90, 180, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "rgba(139,92,246,0.12)";
  ctx.beginPath(); ctx.arc(1050, 80, 210, 0, Math.PI * 2); ctx.fill();

  const compLogo = await loadCanvasImage(competitionLogoUrl(competition || {}, {}, trophyMap));
  if (compLogo) {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(width - 150, 34, 88, 88, 24) : ctx.rect(width - 150, 34, 88, 88);
    ctx.clip();
    ctx.drawImage(compLogo, width - 150, 34, 88, 88);
    ctx.restore();
  }
  ctx.fillStyle = "#e0f2fe";
  ctx.font = "700 48px Tahoma, Arial";
  ctx.textAlign = "right";
  ctx.fillText(title, width - (compLogo ? 170 : 58), 76);
  if (subtitle) {
    ctx.fillStyle = "#67e8f9";
    ctx.font = "700 24px Tahoma, Arial";
    ctx.fillText(subtitle, width - 60, 120);
  }
  const brandLogo = await loadCanvasImage(logoUrl);
  if (brandLogo) {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(58, 38, 86, 86, 22) : ctx.rect(58, 38, 86, 86);
    ctx.clip();
    ctx.drawImage(brandLogo, 58, 38, 86, 86);
    ctx.restore();
  }

  const margin = 48;
  const tableWidth = width - margin * 2;
  const y0 = headerHeight;
  const colCount = Math.max(1, headers.length);
  const colWidth = tableWidth / colCount;
  const headerY = y0;
  ctx.fillStyle = "rgba(0,229,255,0.18)";
  roundRect(ctx, margin, headerY, tableWidth, rowHeight, 18);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.14)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = "#cffafe";
  ctx.font = "800 22px Tahoma, Arial";
  headers.forEach((head, i) => {
    ctx.textAlign = "center";
    ctx.fillText(String(head), margin + tableWidth - colWidth * i - colWidth / 2, headerY + 35);
  });

  rows.forEach((row, rIndex) => {
    const y = headerY + rowHeight * (rIndex + 1) + 8;
    const rowStyle = rowStyles[rIndex] || {};
    ctx.fillStyle = rowStyle.fill || (rIndex % 2 === 0 ? "rgba(255,255,255,0.065)" : "rgba(255,255,255,0.035)");
    roundRect(ctx, margin, y, tableWidth, rowHeight - 4, 16);
    ctx.fill();
    if (rowStyle.stroke) {
      ctx.strokeStyle = rowStyle.stroke;
      ctx.lineWidth = rowStyle.lineWidth || 2;
      ctx.stroke();
    }
    ctx.fillStyle = "#f8fafc";
    ctx.font = "700 21px Tahoma, Arial";
    row.forEach((cell, i) => {
      ctx.textAlign = "center";
      ctx.fillText(String(cell ?? "-"), margin + tableWidth - colWidth * i - colWidth / 2, y + 34);
    });
  });

  if (footer) {
    ctx.textAlign = "center";
    ctx.fillStyle = "#94a3b8";
    ctx.font = "700 20px Tahoma, Arial";
    ctx.fillText(footer, width / 2, height - 30);
  }

  const link = document.createElement("a");
  link.download = filename;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function safeFileName(value) {
  return String(value || "fifa-group").replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, "-").slice(0, 90);
}


function normalizeCompetitionRewards(rewards = {}) {
  return {
    first: Math.max(0, toNumber(rewards.first)),
    second: Math.max(0, toNumber(rewards.second)),
    third: Math.max(0, toNumber(rewards.third)),
    fourth: Math.max(0, toNumber(rewards.fourth)),
  };
}

function rewardRankLabel(rank) {
  const labels = { 1: "البطل", 2: "الوصيف", 3: "الثالث", 4: "الرابع" };
  return labels[rank] || `المركز ${rank}`;
}

function groupLeagueMatchesByRound(matches = []) {
  const map = new Map();
  (matches || []).forEach((match) => {
    const round = toNumber(match.round || 1) || 1;
    if (!map.has(round)) map.set(round, []);
    map.get(round).push(match);
  });
  return Array.from(map.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([round, rows]) => ({ round, matches: rows }));
}

function competitionTypeLabel(type) {
  const value = clean(type || "league");
  const labels = {
    league: "الدوري",
    league_qualifier: "ملحق الدوري",
    cup: "الكأس",
    super_cup: "السوبر",
    champions_league: "دوري الأبطال",
    world_cup: "كأس العالم",
  };
  return labels[value] || "بطولة";
}


function competitionTypeKey(type = "") {
  return clean(type || "league") || "league";
}

function competitionDefaultIcon(type = "") {
  const value = competitionTypeKey(type);
  const icons = {
    league: "🏆",
    league_qualifier: "🎯",
    cup: "🏅",
    super_cup: "⭐",
    champions_league: "⭐",
    world_cup: "🌐",
  };
  return icons[value] || "🏟️";
}

function competitionTrophyLookupKeys(type = "") {
  const value = competitionTypeKey(type);
  const keys = {
    league: ["league", "الدوري", "دوري", "الدورى", "درع الدوري", "بطولة الدوري"],
    league_qualifier: ["league_qualifier", "ملحق الدوري", "ملحق"],
    cup: ["cup", "الكأس", "الكاس", "كأس"],
    super_cup: ["super_cup", "super", "السوبر", "كأس السوبر"],
    champions_league: ["champions_league", "دوري الأبطال", "دوري الابطال", "دوري أبطال", "الأبطال", "ابطال", "أبطال", "Champions League", "UCL"],
    world_cup: ["world_cup", "كأس العالم", "كاس العالم"],
  };
  return keys[value] || [value];
}

function competitionLogoFromTrophyMap(type = "", trophyMap = {}) {
  const values = Object.values(trophyMap || {});
  const keys = competitionTrophyLookupKeys(type);
  for (const key of keys) {
    const direct = trophyMap[cleanId(key)] || trophyMap[clean(key)] || trophyMap[key];
    const url = normalizeImageUrl(direct?.image || direct?.logo || direct?.icon || direct?.trophyImage || "");
    if (url) return url;
  }
  for (const row of values) {
    const name = clean(row?.name || row?.title || row?.trophyId || "");
    if (!name) continue;
    const matched = keys.some((key) => name === clean(key) || name.includes(clean(key)) || clean(key).includes(name));
    if (matched) {
      const url = normalizeImageUrl(row?.image || row?.logo || row?.icon || row?.trophyImage || "");
      if (url) return url;
    }
  }
  return "";
}

function competitionLogoFromConfig(type = "", config = {}) {
  const value = competitionTypeKey(type);
  const map = {
    league: config.leagueLogo || config.leagueIcon || config.dawriLogo,
    league_qualifier: config.leagueQualifierLogo || config.leagueLogo || config.leagueIcon,
    cup: config.cupLogo || config.cupIcon,
    super_cup: config.superCupLogo || config.superCupIcon,
    champions_league: config.championsLeagueLogo || config.championsLeagueIcon,
    world_cup: config.worldCupLogo || config.worldCupIcon,
  };
  return normalizeImageUrl(map[value] || "");
}

function competitionLogoUrl(competition = {}, config = {}, trophyMap = {}) {
  return normalizeImageUrl(
    competition.logo ||
      competition.icon ||
      competition.image ||
      competition.trophyImage ||
      competition.trophyLogo ||
      ""
  ) || competitionLogoFromTrophyMap(competition.type, trophyMap) || competitionLogoFromConfig(competition.type, config);
}

function exportBrandLogoUrl(config = {}) {
  return normalizeImageUrl(config.exportLogo || config.groupLogo || config.appIcon || config.headerImage || "");
}

function CompetitionIcon({ competition = {}, config = {}, trophyMap = {}, className = "competitionIcon" }) {
  const logo = competitionLogoUrl(competition, config, trophyMap);
  if (logo) return <img className={className} src={logo} alt="" />;
  return <span className={className + " fallbackCompetitionIcon"}>{competitionDefaultIcon(competition.type)}</span>;
}

function competitionStatusLabel(status) {
  const value = clean(status || "active");
  const labels = {
    draft: "مسودة",
    active: "نشط",
    completed: "مغلق",
    cancelled: "ملغى",
  };
  return labels[value] || status || "نشط";
}

function competitionTimeValue(item = {}) {
  return notificationTimeValue(item.updatedAt || item.createdAt || item.date || item.completedAt);
}

function isFifaAdminProfile(profile) {
  if (!profile) return false;
  return clean(profile.role) === "admin" || same(profile.memberId || profile.memberid, "FIFA") || clean(profile.username) === "fifa";
}

function isNotificationVisibleToMember(item, memberId) {
  if (!item) return false;
  const id = cleanId(memberId);
  const audience = clean(item.audience || "");
  if (audience === "all" || clean(item.toMemberId) === "all") return true;
  if (!id) return false;
  return same(item.toMemberId, id) || same(item.memberId, id) || same(item.targetMemberId, id);
}

function pushTokenDocId(token) {
  return String(token || "").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 900);
}

function adminRewardTypeLabel(type) {
  const value = clean(type || "admin_reward");
  const labels = {
    admin_reward: "مكافأة بطولة",
    admin_compensation: "تعويض إداري",
    admin_adjustment: "تسوية مالية",
    admin_bonus: "جائزة خاصة",
    admin_penalty: "غرامة مالية",
    admin_deduction: "خصم إداري",
    admin_member_compensation: "تعويض مالي لعضو",
  };
  return labels[value] || "عملية إدارية";
}

function adminDecisionTypeLabel(type) {
  const value = clean(type || "admin_decision");
  const labels = {
    admin_decision: "قرار إداري",
    admin_notification: "إشعار إداري",
    admin_reward: "مكافأة بطولة",
    admin_compensation: "تعويض إداري من FIFA",
    admin_adjustment: "تسوية مالية",
    admin_bonus: "جائزة خاصة",
    admin_penalty: "غرامة مالية",
    admin_deduction: "خصم إداري",
    admin_member_compensation: "تعويض مالي بين عضوين",
    transfer_restriction: "إيقاف من نظام الانتقالات",
    transfer_restriction_lifted: "رفع إيقاف انتقالات",
    transfer_restriction_cancelled: "إلغاء إيقاف انتقالات",
    admin_financial_reversal: "عكس عملية مالية",
    admin_financial_correction: "تصحيح عملية مالية",
    admin_member_note: "ملاحظة إدارية",
  };
  return labels[value] || adminRewardTypeLabel(value) || "قرار إداري";
}

function adminDecisionStatusLabel(status) {
  const value = clean(status || "active");
  const labels = {
    active: "نشط",
    completed: "منفذ",
    corrected: "تم تصحيحه",
    reversed: "تم عكسه",
    cancelled: "ملغي",
    lifted: "مرفوع",
    expired: "منتهي",
  };
  return labels[value] || status || "-";
}

function adminViolationCategoryLabel(category) {
  const value = clean(category || "general");
  const labels = {
    general: "مخالفة عامة",
    transfer_violation: "مخالفة نظام الانتقالات",
    financial_violation: "مخالفة النظام المالي",
    disciplinary_violation: "مخالفة نظام العقوبات",
    financial_compensation: "تعويض مالي",
    tournament_violation: "مخالفة بطولة",
    late_payment: "تأخير دفع",
    refused_decision: "رفض تنفيذ قرار",
    unsporting_behavior: "سلوك غير رياضي",
  };
  return labels[value] || category || "مخالفة عامة";
}

function isFifaAdminMoneyTransfer(row = {}) {
  const type = clean(row.type || "");
  const direction = clean(row.direction || "");
  const source = clean(row.source || "");
  return (
    same(row.fromMemberId, "FIFA") ||
    same(row.toMemberId, "FIFA") ||
    type.startsWith("admin") ||
    direction.startsWith("admin") ||
    source.startsWith("fifa_admin")
  );
}

function isCorrectionMoneyTransfer(row = {}) {
  const type = clean(row.type || "");
  return Boolean(row.reversalOfMoneyTransferId || row.correctionOfMoneyTransferId || type.includes("reversal") || type.includes("correction"));
}

function hasMoneyTransferCorrection(rows = [], id = "") {
  const safeId = cleanId(id);
  if (!safeId) return false;
  return (rows || []).some((row) =>
    same(row.reversalOfMoneyTransferId, safeId) ||
    same(row.correctionOfMoneyTransferId, safeId) ||
    same(row.originalMoneyTransferId, safeId)
  );
}

function adminDecisionTimeValue(row = {}) {
  return notificationTimeValue(row.createdAt || row.updatedAt || row.date);
}

function adminMoneyTransferLabel(row = {}, members = []) {
  const amount = formatMoney(row.amount || 0);
  const fromName = row.fromMemberName || getMemberName(members, row.fromMemberId) || row.fromMemberId || "-";
  const toName = row.toMemberName || getMemberName(members, row.toMemberId) || row.toMemberId || "-";
  const label = row.typeLabel || adminDecisionTypeLabel(row.type) || "عملية مالية";
  return `${label} • ${fromName} ← ${toName} • ${amount}`;
}

function buildAdminTransferRestrictionPayload(payload = {}) {
  const banSendOffers = payload.banSendOffers !== false;
  const banReceiveOffers = payload.banReceiveOffers !== false;
  const banSquadChanges = payload.banSquadChanges !== false;
  return {
    banSendOffers,
    banReceiveOffers,
    banSquadChanges,
    blockedActions: [
      banSendOffers ? "send_offer" : "",
      banReceiveOffers ? "receive_offer" : "",
      banSquadChanges ? "squad_change" : "",
    ].filter(Boolean),
  };
}

function timestampMs(value) {
  if (!value) return 0;
  if (value?.toDate) return value.toDate().getTime();
  if (typeof value === "number") return value;
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

function dateOnlyMs(value, fallback = 0) {
  const text = String(value || "").slice(0, 10);
  if (!text) return fallback;
  const parsed = Date.parse(text + "T00:00:00");
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isTransferRestrictionActive(row) {
  if (!row) return false;
  const status = clean(row.status || "active");
  if (!["active", "enabled"].includes(status)) return false;
  const now = Date.now();
  const start = dateOnlyMs(row.startDate, 0);
  const end = dateOnlyMs(row.endDate, Number.POSITIVE_INFINITY);
  return now >= start && now <= end + 86399999;
}

function getActiveMemberRestrictions(rows = [], memberId = "") {
  const id = cleanId(memberId);
  if (!id) return [];
  return (rows || [])
    .filter((row) => same(row.memberId, id) && isTransferRestrictionActive(row))
    .sort((a, b) => dateOnlyMs(a.endDate, Number.POSITIVE_INFINITY) - dateOnlyMs(b.endDate, Number.POSITIVE_INFINITY));
}

function getBlockingTransferRestriction(rows = [], memberId = "", action = "send_offer") {
  return getActiveMemberRestrictions(rows, memberId).find((row) => {
    const actions = Array.isArray(row.blockedActions) ? row.blockedActions.map(clean) : [];
    if (actions.includes(action)) return true;
    if (action === "send_offer" && row.banSendOffers) return true;
    if (action === "receive_offer" && row.banReceiveOffers) return true;
    if (action === "squad_change" && row.banSquadChanges) return true;
    return false;
  }) || null;
}

function transferActionArabic(action) {
  const labels = {
    send_offer: "إرسال العروض",
    receive_offer: "استقبال العروض",
    squad_change: "تعديل القائمة أو البيع أو الإعارة أو الاستغناء",
  };
  return labels[action] || "نظام الانتقالات";
}

function transferRestrictionShortText(row) {
  const blocked = [];
  if (row.banSendOffers || (row.blockedActions || []).includes("send_offer")) blocked.push("إرسال العروض");
  if (row.banReceiveOffers || (row.blockedActions || []).includes("receive_offer")) blocked.push("استقبال العروض");
  if (row.banSquadChanges || (row.blockedActions || []).includes("squad_change")) blocked.push("تعديل القائمة والبيع والإعارة والاستغناء");
  return "إيقاف انتقالات" + (blocked.length ? ": " + blocked.join("، ") : " شامل");
}

function transferRestrictionBlockMessage(row, action) {
  return "لا يمكنك " + transferActionArabic(action) + " بسبب إيقاف إداري من نظام الانتقالات حتى " + (row.endDate || "نهاية المدة") + (row.reason ? " - السبب: " + row.reason : ".");
}

function formatRestrictionNotificationBody({ reason, startDate, endDate, restriction }) {
  return transferRestrictionShortText(restriction || {}) + " من " + (startDate || "اليوم") + " حتى " + (endDate || "نهاية المدة") + (reason ? " بسبب: " + reason : ".");
}

function getAdminTargetMembers(members = []) {
  return getActiveMembers(members).sort((a, b) =>
    String(a.name || a.id || "").localeCompare(String(b.name || b.id || ""), "ar")
  );
}

function getTopBarTitle({ page, config, selectedMember, detailView, infoModal, menuOpen }) {
  if (menuOpen) return "القائمة";
  if (infoModal?.title) return infoModal.title;
  if (selectedMember?.name && !detailView) return selectedMember.name;

  if (detailView) {
    if (detailView.title) return detailView.title;
    if (detailView.member?.name) return detailView.member.name;
    if (detailView.group?.name) return detailView.group.name;
    if (detailView.record?.name) return detailView.record.name;
    if (detailView.type === "record") return "تفاصيل البطولة";
    if (detailView.type === "memberFinance") return "السجل المالي";
    if (detailView.type === "memberPlayers") return "قائمة اللاعبين";
    if (detailView.type === "memberFinals") return "النهائيات";
    return "التفاصيل";
  }

  const titles = {
    members: config.membersTitle || "الأعضاء",
    season: config.seasonName || config.seasonTitle || "الموسم",
    league: "البطولات التنافسية",
    archive: config.archiveTitle || "السجل العام",
    ranking: config.rankingTitle || "التصنيف",
    stats: config.statsTitle || "الإحصائيات",
    transfers: "سوق الانتقالات",
    links: config.linksTitle || "الروابط",
    fifaAdmin: "لوحة FIFA",
    leagueAdmin: "إدارة البطولات التنافسية",
  };

  return titles[page] || config.mainTitle || "FIFA GROUP";
}

function TopSystemBar({ title, scrolled, unreadCount = 0, onNotificationsClick }) {
  const top = (
    <div className={scrolled ? "topSystemPortalBar scrolled" : "topSystemPortalBar"} aria-hidden="false">
      <div className="topSystemInner titleOnly">
        <button className="topNotifyBtn" type="button" onClick={onNotificationsClick} aria-label="الإشعارات">
          🔔
          {unreadCount ? <span>{unreadCount > 9 ? "9+" : unreadCount}</span> : null}
        </button>
        <strong className="topSystemTitle">{title || "FIFA GROUP"}</strong>
      </div>
    </div>
  );

  if (typeof document === "undefined") return top;
  return createPortal(top, document.body);
}

function BottomNav({ page, goPage, menuOpen, setMenuOpen, config }) {
  const navStyle = {
    position: "fixed",
    left: "50%",
    right: "auto",
    bottom: "calc(10px + env(safe-area-inset-bottom))",
    transform: "translateX(-50%)",
    width: "min(640px, calc(100vw - 18px))",
    maxWidth: "640px",
    height: "72px",
    minHeight: "72px",
    maxHeight: "72px",
    margin: 0,
    padding: "7px",
    display: "grid",
    gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
    gap: "5px",
    borderRadius: "26px",
    overflow: "hidden",
    background: "linear-gradient(180deg,#081126,#050a17)",
    border: "1px solid rgba(255,255,255,.14)",
    boxShadow:
      "0 -8px 28px rgba(0,0,0,.32), 0 18px 60px rgba(0,0,0,.58), inset 0 1px 0 rgba(255,255,255,.14)",
    zIndex: 2147483601,
    direction: "rtl",
    boxSizing: "border-box",
  };

  const curtainStyle = {
    position: "fixed",
    left: 0,
    right: 0,
    bottom: 0,
    height: "calc(92px + env(safe-area-inset-bottom))",
    background: "#020617",
    zIndex: 2147483600,
    pointerEvents: "none",
  };

  const nav = (
    <>
      <div
        className="bottomNavPortalCurtain forceBottomCurtain"
        aria-hidden="true"
        style={curtainStyle}
      />
      <nav className="mainNav glassSoft forceBottomNav" style={navStyle}>
        <NavButton
          page={page}
          menuOpen={menuOpen}
          id="members"
          icon={config.navMembersIcon}
          label="الأعضاء"
          onClick={() => goPage("members")}
        />
        {isEnabled(config.showSeasonTournaments) ? (
          <NavButton
            page={page}
            menuOpen={menuOpen}
            id="season"
            icon={config.navSeasonIcon}
            label="الموسم"
            onClick={() => goPage("season")}
          />
        ) : null}
        {isEnabled(config.showTransfers) ? (
          <NavButton
            page={page}
            menuOpen={menuOpen}
            id="transfers"
            icon={config.menuTransfersIcon}
            label="الانتقالات"
            onClick={() => goPage("transfers")}
          />
        ) : null}
        {isEnabled(config.showArchive) ? (
          <NavButton
            page={page}
            menuOpen={menuOpen}
            id="archive"
            icon={config.navArchiveIcon}
            label="السجل"
            onClick={() => goPage("archive")}
          />
        ) : null}
        <button
          className={menuOpen ? "navBtn active" : "navBtn"}
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <span className="navIcon">{renderSmartIcon(config.navMoreIcon)}</span>
          <span className="navLabel">المزيد</span>
        </button>
      </nav>
    </>
  );

  if (typeof document === "undefined") return nav;
  return createPortal(nav, document.body);
}

function NavButton({ page, menuOpen, id, icon, label, onClick }) {
  return (
    <button
      className={!menuOpen && page === id ? "navBtn active" : "navBtn"}
      onClick={onClick}
    >
      <span className="navIcon">{renderSmartIcon(icon)}</span>
      <span className="navLabel">{label}</span>
    </button>
  );
}

function SideMenu({ open, setOpen, goPage, config, isFifaAdmin = false }) {
  if (!open) return null;

  const items = [
    isFifaAdmin ? ["fifaAdmin", "🛡️", "لوحة FIFA"] : null,
    ["season", "🏆", config.seasonName || "الموسم"],
    isFifaAdmin ? ["leagueAdmin", "🏟️", "إدارة البطولات التنافسية"] : null,
    isEnabled(config.showStats) ? ["stats", config.menuStatsIcon, "الإحصائيات العامة"] : null,
    isEnabled(config.showTransfers)
      ? ["transfers", config.menuTransfersIcon, "سوق الانتقالات"]
      : null,
    isEnabled(config.showLinks) ? ["links", config.menuLinksIcon, config.linksTitle] : null,
  ].filter(Boolean);

  function selectPage(id) {
    setOpen(false);
    goPage(id);
  }

  const drawer = (
    <div className="fgMenuBackdrop" onClick={() => setOpen(false)}>
      <aside
        className="fgMenuPanel"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="fgMenuHeader">
          <h2>القائمة</h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="إغلاق"
          >
            ×
          </button>
        </header>

        <div className="fgMenuItems">
          {items.map(([id, icon, label]) => (
            <button
              className="fgMenuItem"
              type="button"
              key={id}
              onClick={() => selectPage(id)}
            >
              <span className="fgMenuIcon">{renderSmartIcon(icon)}</span>
              <b>{label}</b>
            </button>
          ))}
        </div>
      </aside>
    </div>
  );

  if (typeof document === "undefined") return drawer;
  return createPortal(drawer, document.body);
}

function MembersPage(props) {
  const {
    config,
    rankedMembers,
    members,
    selectedMember,
    selectedMemberId,
    totalForMember,
    setSelectedId,
    memberTab,
    setMemberTab,
    players,
    trophies,
    finance,
    financeBalance,
    currentMemberId,
    isFifaAdmin = false,
    currentMemberBalance,
    currentMemberAvailableBalance,
    currentMemberPlayers,
    playerContracts = [],
    playerOffers,
    freeAgentRegistrations = [],
    freePlayerStatus = [],
    freeAgentQueue = [],
    memberRestrictions = [],
    currentMemberRestrictions = [],
    transferHistory = [],
    allPlayerOffers = [],
    notifications = [],
    pushStatus = getInitialPushStatus(),
    pushBusy = false,
    onEnablePushNotifications,
    onDisablePushNotifications,
    onOpenNotification,
    onCreateMoneyTransfer,
    onCreatePlayerOffer,
    onUpdatePlayerOffer,
    onCancelPlayerOffer,
    onAcceptOffer,
    onRejectOffer,
    onReleasePlayer,
    onTerminateLoan,
    onRegisterFreeAgentFee,
    isMarketOpen,
    stats,
    search,
    setSearch,
    onOpenView,
    onInfo,
  } = props;

  const [moneyModal, setMoneyModal] = useState(null);
  const [offerModal, setOfferModal] = useState(null);
  const [playerDetail, setPlayerDetail] = useState(null);
  const playerDetailReturnScrollRef = useRef(0);
  const canSendMoney = Boolean(currentMemberId && selectedMember?.id && !same(currentMemberId, selectedMember.id));
  const isCurrentMemberProfile = Boolean(currentMemberId && selectedMember?.id && same(currentMemberId, selectedMember.id));
  const canViewMemberOffers = Boolean(isCurrentMemberProfile || isFifaAdmin);

  useEffect(() => {
    if (memberTab === "offers" && !canViewMemberOffers) {
      setMemberTab("players");
    }
  }, [memberTab, canViewMemberOffers, setMemberTab]);

  useEffect(() => {
    if (!playerDetail) return undefined;

    function handlePlayerDetailBack(event) {
      event.stopImmediatePropagation?.();
      closePlayerDetail();
      try {
        window.history.replaceState({ fifaGroupMember: true }, "");
      } catch {}
    }

    window.addEventListener("popstate", handlePlayerDetailBack, true);
    return () => window.removeEventListener("popstate", handlePlayerDetailBack, true);
  }, [playerDetail]);

  function openMoneyTransfer(prefillMember = null) {
    setMoneyModal({ toMemberId: prefillMember?.id || "" });
  }

  function openPlayerOffer(player, existingOffer = null, targetMember = null) {
    setOfferModal({ player, existingOffer, targetMember });
  }

  function openPlayerDetail(player) {
    const appNode = document.querySelector(".app");
    playerDetailReturnScrollRef.current = appNode ? appNode.scrollTop : window.scrollY || 0;
    try {
      window.history.pushState({ fifaGroupPlayerDetail: true }, "");
    } catch {}
    setPlayerDetail(player);
    requestAnimationFrame(() => {
      const nextAppNode = document.querySelector(".app");
      if (nextAppNode) nextAppNode.scrollTo({ top: 0, behavior: "auto" });
    });
  }

  function closePlayerDetail() {
    const returnTop = Math.max(0, Number(playerDetailReturnScrollRef.current) || 0);
    setPlayerDetail(null);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const appNode = document.querySelector(".app");
        if (appNode) {
          appNode.style.scrollBehavior = "auto";
          appNode.scrollTop = returnTop;
          requestAnimationFrame(() => {
            appNode.scrollTop = returnTop;
            appNode.style.scrollBehavior = "";
          });
        } else {
          window.scrollTo(0, returnTop);
        }
      });
    });
  }

  async function handleCancelPlayerOffer(existingOffer) {
    if (!existingOffer?.id) return;
    await onCancelPlayerOffer(existingOffer.id);
  }

  function openMember(memberId) {
    try {
      window.history.pushState({ fifaGroupMember: true }, "");
    } catch {}
    setSelectedId(memberId);
    setMemberTab("players");
    setSearch("");
    setPlayerDetail(null);
    const appNode = document.querySelector(".app");
    if (appNode) appNode.scrollTo({ top: 0, behavior: "auto" });
    
  }

  function backToMembers() {
    setSelectedId("");
    setMemberTab("players");
    setSearch("");
    setPlayerDetail(null);
    try {
      window.history.replaceState({ fifaGroupRoot: true }, "");
    } catch {}
    const appNode = document.querySelector(".app");
    if (appNode) appNode.scrollTo({ top: 0, behavior: "auto" });
    
  }

  if (!selectedMember) {
    const topThreeMembers = rankedMembers.slice(0, 3);
    const leaderMember = topThreeMembers[0] || rankedMembers[0];
    const membersTotalTrophies = rankedMembers.reduce(
      (sum, member) => sum + totalForMember(member.id),
      0
    );
    const totalPlayersCount = (props.allPlayers || []).length;
    const getMemberRating = (member, index) => {
      const trophiesCount = totalForMember(member.id);
      const baseRating = 78 + Math.min(18, Math.floor(trophiesCount / 4));
      const rankBoost = Math.max(0, 4 - index);
      return Math.max(72, Math.min(99, baseRating + rankBoost));
    };

    return (
      <main className="utMembersPage">
        <section className="utMembersHero">
          <div className="utHeroText">
            <span className="utEyebrow">FIFA GROUP • SEASON 06</span>
            <h1>الأعضاء</h1>
            <p>واجهة المشاركين الرسمية، مرتبة حسب البطولات وبأسلوب Ultimate Team.</p>
          </div>
          <div className="utHeroBall">⚽</div>
        </section>

        {leaderMember ? (
          <section className="utLeaderCard" onClick={() => openMember(leaderMember.id)}>
            <div className="utLeaderRank">#1</div>
            <div className="utLeaderImageWrap">
              <img src={leaderMember.avatar || avatar(leaderMember.name)} alt="" />
            </div>
            <div className="utLeaderInfo">
              <span>المتصدر</span>
              <h2>{leaderMember.name}</h2>
              <p>{leaderMember.team || "بدون فريق"}</p>
              <div className="utLogoStrip">
                {leaderMember.nationallogo ? <img src={leaderMember.nationallogo} alt="" /> : null}
                {leaderMember.teamlogo ? <img src={leaderMember.teamlogo} alt="" /> : null}
              </div>
            </div>
            <div className="utLeaderRating">
              <b>{getMemberRating(leaderMember, 0)}</b>
              <small>GRP</small>
            </div>
          </section>
        ) : null}

        <section className="utQuickStats">
          <div>
            <b>{rankedMembers.length}</b>
            <span>عضو</span>
          </div>
          <div>
            <b>{membersTotalTrophies}</b>
            <span>بطولة</span>
          </div>
          <div>
            <b>{totalPlayersCount || "—"}</b>
            <span>لاعب</span>
          </div>
        </section>

        {topThreeMembers.length ? (
          <section className="utPodium">
            {topThreeMembers.map((member, index) => (
              <button
                key={`podium-${member.id || index}`}
                className={`utPodiumCard rank${index + 1}`}
                type="button"
                onClick={() => openMember(member.id)}
              >
                <span className="utPodiumMedal">{index === 0 ? "👑" : index === 1 ? "🥈" : "🥉"}</span>
                <img src={member.avatar || avatar(member.name)} alt="" />
                <b>{member.name}</b>
                <small>{totalForMember(member.id)} 🏆</small>
              </button>
            ))}
          </section>
        ) : null}

        <section className="utMembersBoard">
          <div className="utBoardHead">
            <div>
              <span>MEMBERS</span>
              <h2>قائمة المشاركين</h2>
            </div>
            <em>{rankedMembers.length} أعضاء</em>
          </div>

          <div className="utMembersRows">
            {rankedMembers.map((member, index) => {
              const trophiesCount = totalForMember(member.id);
              const rating = getMemberRating(member, index);
              return (
                <button
                  key={String(member.id || index)}
                  className={`utMemberRow ${index === 0 ? "isLeader" : ""}`}
                  type="button"
                  onClick={() => openMember(member.id)}
                >
                  <span className="utRankPill">#{index + 1}</span>
                  <div className="utMemberAvatar">
                    <img src={member.avatar || avatar(member.name)} alt="" />
                  </div>
                  <div className="utMemberMeta">
                    <b>{member.name}</b>
                    <small>{member.team || "بدون فريق"}</small>
                    <div className="utMemberLogos">
                      {member.nationallogo ? <img src={member.nationallogo} alt="" /> : null}
                      {member.teamlogo ? <img src={member.teamlogo} alt="" /> : null}
                    </div>
                  </div>
                  <div className="utMemberNumbers">
                    <span className="utRatingBadge">{rating}</span>
                    <span className="utTrophyBadge">🏆 {trophiesCount}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      </main>
    );
  }

  if (playerDetail) {
    return (
      <main className="widePage glass playerDetailFullPage">
        {offerModal ? (
          <PlayerOfferModal
            targetMember={offerModal.targetMember || selectedMember}
            targetPlayer={offerModal.player}
            existingOffer={offerModal.existingOffer}
            currentMemberId={currentMemberId}
            currentAvailableBalance={currentMemberAvailableBalance}
            currentMemberPlayers={currentMemberPlayers}
            onClose={() => setOfferModal(null)}
            onSubmit={offerModal.existingOffer ? onUpdatePlayerOffer : onCreatePlayerOffer}
          />
        ) : null}

        <PlayerDetailSubPage
          player={playerDetail}
          ownerMember={selectedMember}
          currentMemberId={currentMemberId}
          currentMember={members.find((member) => same(member.id, currentMemberId))}
          playerOffers={playerOffers}
          playerContracts={playerContracts}
          freeAgentRegistrations={freeAgentRegistrations}
          freePlayerStatus={freePlayerStatus}
          freeAgentQueue={freeAgentQueue}
          memberRestrictions={memberRestrictions}
          ownerPlayerCount={players.length}
          canMakeOffer={Boolean(currentMemberId && selectedMemberId && !same(currentMemberId, selectedMemberId))}
          isMarketOpen={isMarketOpen}
          members={members}
          onBack={closePlayerDetail}
          onOffer={openPlayerOffer}
          onCancelOffer={handleCancelPlayerOffer}
          onAcceptOffer={onAcceptOffer}
          onRejectOffer={onRejectOffer}
          onReleasePlayer={onReleasePlayer}
          onTerminateLoan={onTerminateLoan}
          onRegisterFreeAgentFee={onRegisterFreeAgentFee}
          logoUrl={exportBrandLogoUrl(config)}
        />
      </main>
    );
  }

  return (
    <main className="memberProfilePage glass">
      <button className="backToMembersBtn" onClick={backToMembers}>
        ← الأعضاء
      </button>
      <section className="profileCard">
        <div className="profileMain">
          <img
            src={selectedMember.avatar || avatar(selectedMember.name)}
            alt=""
          />
          <div>
            <h2>{selectedMember.name}</h2>
            <div className="chips">
              <span>{renderSmartIcon(config.memberTeamIcon)} {selectedMember.team || "بدون فريق"}</span>
              <span>{renderSmartIcon(config.memberNationalIcon)} {selectedMember.nationalteam || "بدون منتخب"}</span>
            </div>
          </div>
        </div>
        <div className="logos" aria-label="شعارات العضو">
          {selectedMember.teamlogo ? (
            <div className="logoItem" title={selectedMember.team || "شعار الفريق"}>
              <img src={selectedMember.teamlogo} alt="" />
            </div>
          ) : null}
          {selectedMember.nationallogo ? (
            <div className="logoItem" title={selectedMember.nationalteam || "شعار المنتخب"}>
              <img src={selectedMember.nationallogo} alt="" />
            </div>
          ) : null}
        </div>
        <button
          type="button"
          className="profileImageExportBtn"
          aria-label="تحميل بطاقة العضو"
          title="تحميل بطاقة العضو"
          onClick={() => downloadMemberProfileImage({ member: selectedMember, players, balance: financeBalance, trophiesCount: trophies.reduce((sum, item) => sum + item.count, 0), logoUrl: exportBrandLogoUrl(config), contracts: playerContracts, memberId: selectedMemberId })}
        >
          ⤓
        </button>
      </section>

      <section className="statGrid memberMainStats">
        <StatCard
          icon={config.balanceIcon}
          value={formatMoney(financeBalance)}
          label="الرصيد"
          onClick={() =>
            onOpenView({
              type: "memberFinance",
              member: selectedMember,
              rows: finance,
            })
          }
        />
        <StatCard
          icon={config.totalTrophiesIcon}
          value={trophies.reduce((sum, item) => sum + item.count, 0)}
          label="إجمالي البطولات"
          onClick={() =>
            onOpenView({
              type: "memberAllTrophies",
              member: selectedMember,
              groups: trophies,
            })
          }
        />
      </section>

      <section className="memberActionPanel glassSoft">
        <div>
          <b>العمليات المالية</b>
          <small>
            {isCurrentMemberProfile
              ? "حوّل الأموال لأي عضو من حسابك الحالي."
              : canSendMoney
              ? `إرسال تحويل مالي إلى ${selectedMember.name}.`
              : "سجّل الدخول بحساب مربوط بعضو لتفعيل التحويلات."}
          </small>
        </div>
        <button
          type="button"
          disabled={!currentMemberId}
          onClick={() => openMoneyTransfer(canSendMoney ? selectedMember : null)}
        >
          💸 تحويل أموال
        </button>
      </section>

      {currentMemberRestrictions?.length ? (
        <TransferRestrictionBanner rows={currentMemberRestrictions} />
      ) : null}

      {moneyModal ? (
        <MoneyTransferModal
          members={members}
          currentMemberId={currentMemberId}
          currentBalance={currentMemberBalance}
          defaultToMemberId={moneyModal.toMemberId}
          onClose={() => setMoneyModal(null)}
          onSubmit={onCreateMoneyTransfer}
        />
      ) : null}

      {offerModal ? (
        <PlayerOfferModal
          targetMember={selectedMember}
          targetPlayer={offerModal.player}
          existingOffer={offerModal.existingOffer}
          currentMemberId={currentMemberId}
          currentAvailableBalance={currentMemberAvailableBalance}
          currentMemberPlayers={currentMemberPlayers}
          onClose={() => setOfferModal(null)}
          onSubmit={offerModal.existingOffer ? onUpdatePlayerOffer : onCreatePlayerOffer}
        />
      ) : null}

      {playerDetail ? (
        <PlayerDetailSubPage
          player={playerDetail}
          ownerMember={selectedMember}
          currentMemberId={currentMemberId}
          currentMember={members.find((member) => same(member.id, currentMemberId))}
          playerOffers={playerOffers}
          playerContracts={playerContracts}
          freeAgentRegistrations={freeAgentRegistrations}
          freePlayerStatus={freePlayerStatus}
          freeAgentQueue={freeAgentQueue}
          memberRestrictions={memberRestrictions}
          ownerPlayerCount={players.length}
          canMakeOffer={Boolean(currentMemberId && selectedMemberId && !same(currentMemberId, selectedMemberId))}
          isMarketOpen={isMarketOpen}
          members={members}
          onBack={closePlayerDetail}
          onOffer={openPlayerOffer}
          onCancelOffer={handleCancelPlayerOffer}
          onAcceptOffer={onAcceptOffer}
          onRejectOffer={onRejectOffer}
          onReleasePlayer={onReleasePlayer}
          onTerminateLoan={onTerminateLoan}
          onRegisterFreeAgentFee={onRegisterFreeAgentFee}
        />
      ) : (
        <>
      <nav className="tabs">
        <TabButton
          tab={memberTab}
          id="players"
          label={config.playersTitle}
          setTab={setMemberTab}
        />
        {isEnabled(config.showMemberTrophies) ? (
          <TabButton
            tab={memberTab}
            id="trophies"
            label={config.trophiesTitle}
            setTab={setMemberTab}
          />
        ) : null}
        <TabButton
          tab={memberTab}
          id="memberStats"
          label="إحصائيات"
          setTab={setMemberTab}
        />
        <TabButton
          tab={memberTab}
          id="deals"
          label="سجل الصفقات"
          setTab={setMemberTab}
        />
        {canViewMemberOffers ? (
          <TabButton
            tab={memberTab}
            id="offers"
            label="عروض الانتقالات"
            setTab={setMemberTab}
          />
        ) : null}
        {isEnabled(config.showFinance) ? (
          <TabButton
            tab={memberTab}
            id="finance"
            label={config.financeTitle}
            setTab={setMemberTab}
          />
        ) : null}
        {isCurrentMemberProfile ? (
          <TabButton
            tab={memberTab}
            id="notifications"
            label={"الإشعارات" + (notifications.length ? ` (${notifications.length})` : "")}
            setTab={setMemberTab}
          />
        ) : null}
      </nav>

      {memberTab === "players" ? (
        <PlayersSection
          config={config}
          rows={players}
          search={search}
          setSearch={setSearch}
          playerCount={players.length}
          showOfferButton={Boolean(currentMemberId || selectedMemberId)}
          onOpenPlayerDetail={openPlayerDetail}
          playerContracts={playerContracts}
          selectedMemberId={selectedMemberId}
        />
      ) : null}
      {memberTab === "trophies" && isEnabled(config.showMemberTrophies) ? (
        <MemberTrophiesSection
          rows={trophies}
          member={selectedMember}
          onOpenView={onOpenView}
        />
      ) : null}
      {memberTab === "memberStats" ? (
        <MemberStatsSection
          config={config}
          stats={stats}
          member={selectedMember}
          members={members}
          onOpenView={onOpenView}
          onInfo={onInfo}
        />
      ) : null}
      {memberTab === "deals" ? (
        <MemberDealsSection
          member={selectedMember}
          members={members}
          transferHistory={transferHistory}
          playerOffers={allPlayerOffers}
          memberRestrictions={memberRestrictions}
          logoUrl={exportBrandLogoUrl(config)}
          onOpenPlayer={(player, ownerMember) => player && ownerMember && openPlayerDetail(player)}
        />
      ) : null}
      {memberTab === "offers" && canViewMemberOffers ? (
        <MemberOffersSection
          member={selectedMember}
          members={members}
          allPlayers={props.allPlayers || []}
          playerOffers={allPlayerOffers}
          currentMemberId={currentMemberId}
          isFifaAdmin={isFifaAdmin}
          logoUrl={exportBrandLogoUrl(config)}
          onOpenPlayer={(player) => player && openPlayerDetail(player)}
          onEditOffer={(offer, player, targetMember) => player && targetMember && openPlayerOffer(player, offer, targetMember)}
          onCancelOffer={handleCancelPlayerOffer}
          onAcceptOffer={onAcceptOffer}
          onRejectOffer={onRejectOffer}
        />
      ) : null}
      {memberTab === "finance" && isEnabled(config.showFinance) ? (
        <FinanceSection
          config={config}
          rows={finance}
          member={selectedMember}
          members={members}
        />
      ) : null}
      {memberTab === "notifications" && isCurrentMemberProfile ? (
        <NotificationsPanel
          rows={notifications}
          members={members}
          currentMemberId={currentMemberId}
          pushStatus={pushStatus}
          pushBusy={pushBusy}
          onEnablePushNotifications={onEnablePushNotifications}
          onDisablePushNotifications={onDisablePushNotifications}
          onOpenNotification={onOpenNotification}
        />
      ) : null}
        </>
      )}
    </main>
  );
}

function PlayerOfferModal({
  targetMember,
  targetPlayer,
  existingOffer,
  currentMemberId,
  currentAvailableBalance,
  currentMemberPlayers,
  onClose,
  onSubmit,
}) {
  const isEditMode = Boolean(existingOffer?.id);
  const [contractType, setContractType] = useState(clean(existingOffer?.type) === "loan" ? "loan" : "buy");
  const [loanDurationMonths, setLoanDurationMonths] = useState(String(existingOffer?.loanDurationMonths || "2"));
  const [amount, setAmount] = useState(existingOffer?.amount ? String(existingOffer.amount) : "");
  const [selectedPlayerIds, setSelectedPlayerIds] = useState(Array.isArray(existingOffer?.offeredPlayers) ? existingOffer.offeredPlayers.map((player) => cleanId(player.playerId)) : []);
  const [exchangeTerms, setExchangeTerms] = useState(() => {
    const map = {};
    (Array.isArray(existingOffer?.offeredPlayers) ? existingOffer.offeredPlayers : []).forEach((player) => {
      const id = cleanId(player.playerId);
      if (!id) return;
      const exchangeContractType = normalizeExchangeContractType(player.exchangeContractType || player.swapContractType || player.contractMode);
      map[id] = {
        exchangeContractType,
        exchangeLoanDurationMonths: exchangeContractType === "loan" ? normalizeExchangeLoanDuration(player.exchangeLoanDurationMonths || player.loanDurationMonths) : 2,
      };
    });
    return map;
  });
  const [notes, setNotes] = useState(existingOffer?.notes || "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const cleanAmount = Math.max(0, parseFinanceAmount(amount));
  const selectedPlayers = (currentMemberPlayers || []).filter((player) =>
    selectedPlayerIds.includes(getPlayerStableId(player))
  );
  const previousReservedAmount = isEditMode ? Math.max(0, toNumber(existingOffer?.reservedAmount ?? existingOffer?.amount)) : 0;
  const afterOfferBalance = currentAvailableBalance + previousReservedAmount - cleanAmount - OFFER_FEE;

  function togglePlayer(playerId) {
    setSelectedPlayerIds((ids) => {
      if (ids.includes(playerId)) {
        setExchangeTerms((terms) => {
          const next = { ...terms };
          delete next[playerId];
          return next;
        });
        return ids.filter((id) => id !== playerId);
      }
      setExchangeTerms((terms) => ({
        ...terms,
        [playerId]: terms[playerId] || { exchangeContractType: "owned", exchangeLoanDurationMonths: 2 },
      }));
      return [...ids, playerId];
    });
  }

  function updateExchangeTerm(playerId, patch) {
    setExchangeTerms((terms) => ({
      ...terms,
      [playerId]: {
        exchangeContractType: "owned",
        exchangeLoanDurationMonths: 2,
        ...(terms[playerId] || {}),
        ...patch,
      },
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (busy) return;
    setMessage("");
    setBusy(true);
    const offerPayload = {
      contractType,
      targetMemberId: targetMember?.id,
      targetPlayerId: getPlayerStableId(targetPlayer),
      targetPlayerName: targetPlayer?.name || "",
      targetPlayerImage: targetPlayer?.image || "",
      targetPlayerPosition: targetPlayer?.position || "",
      targetPlayerRating: targetPlayer?.rating || "",
      amount: cleanAmount,
      offeredPlayers: selectedPlayers.map((player) => {
        const playerId = getPlayerStableId(player);
        const terms = exchangeTerms[playerId] || { exchangeContractType: "owned", exchangeLoanDurationMonths: 2 };
        const exchangeContractType = normalizeExchangeContractType(terms.exchangeContractType);
        const exchangeLoanDurationMonths = exchangeContractType === "loan" ? normalizeExchangeLoanDuration(terms.exchangeLoanDurationMonths) : null;
        return {
          playerId,
          playerName: player.name || "",
          playerImage: player.image || "",
          playerPosition: player.position || "",
          playerRating: player.rating || "",
          position: player.position || "",
          rating: player.rating || "",
          exchangeContractType,
          exchangeLoanDurationMonths,
          exchangeTypeLabel: exchangeContractType === "loan" ? "إعارة" : "بيع كامل",
        };
      }),
      loanDurationMonths: contractType === "loan" ? loanDurationMonths : null,
      notes,
    };

    try {
      if (isEditMode) {
        await onSubmit(existingOffer.id, offerPayload);
      } else {
        await onSubmit(offerPayload);
      }
      setMessage(isEditMode ? "تم تعديل العرض بنجاح." : "تم إرسال العرض بنجاح.");
      window.setTimeout(onClose, 800);
    } catch (err) {
      setMessage(err?.message || (isEditMode ? "تعذر تعديل العرض." : "تعذر إرسال العرض."));
    } finally {
      setBusy(false);
    }
  }

  return createPortal(
    <div className="offerModalBackdrop" onClick={onClose}>
      <form className="playerOfferModal glass" onSubmit={handleSubmit} onClick={(event) => event.stopPropagation()}>
        <header>
          <div>
            <small>سوق الانتقالات</small>
            <h3>{isEditMode ? "تعديل العرض" : "تقديم عرض"}</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="إغلاق">×</button>
        </header>

        <section className="offerTargetPlayer glassSoft">
          <img src={targetPlayer?.image || avatar(targetPlayer?.name)} alt="" />
          <div>
            <b>{targetPlayer?.name || "لاعب"}</b>
            <small>{targetMember?.name || "عضو"} • {targetPlayer?.position || "-"}</small>
          </div>
          <strong>{targetPlayer?.rating || "-"}</strong>
        </section>

        <div className="offerBalanceRow glassSoft">
          <span>الرصيد المتاح للعروض</span>
          <b>{formatMoney(currentAvailableBalance)}</b>
        </div>

        <label className="offerField">
          <span>نوع العقد</span>
          <div className="offerSegmented">
            <button type="button" className={contractType === "buy" ? "active" : ""} onClick={() => setContractType("buy")}>عقد شراء</button>
            <button type="button" className={contractType === "loan" ? "active" : ""} onClick={() => setContractType("loan")}>عقد إعارة</button>
          </div>
        </label>

        {contractType === "loan" ? (
          <label className="offerField">
            <span>مدة عقد الإعارة</span>
            <select value={loanDurationMonths} onChange={(event) => setLoanDurationMonths(event.target.value)}>
              <option value="2">شهرين</option>
              <option value="4">4 شهور</option>
              <option value="6">6 شهور</option>
            </select>
          </label>
        ) : null}

        <label className="offerField">
          <span>مبلغ العرض (اختياري)</span>
          <input inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="مثال: 15000000" />
        </label>

        <section className="offerOwnPlayers">
          <div className="offerOwnPlayersHead">
            <span>لاعبون من قائمتك (اختياري)</span>
            <small>{selectedPlayers.length} محدد</small>
          </div>
          <div className="offerOwnPlayersGrid">
            {(currentMemberPlayers || []).length ? (
              currentMemberPlayers.map((player) => {
                const playerId = getPlayerStableId(player);
                const active = selectedPlayerIds.includes(playerId);
                return (
                  <button type="button" key={playerId} className={active ? "offerOwnPlayer active" : "offerOwnPlayer"} onClick={() => togglePlayer(playerId)}>
                    <img src={player.image || avatar(player.name)} alt="" />
                    <span>
                      <b>{player.name}</b>
                      <small>{player.position || "-"} • {player.rating || "-"}</small>
                    </span>
                  </button>
                );
              })
            ) : (
              <div className="empty">لا توجد قائمة لاعبين مرتبطة بحسابك.</div>
            )}
          </div>
          {selectedPlayers.length ? (
            <div className="offerExchangeTerms glassSoft">
              <b>تحديد عقد لاعبي التبادل</b>
              <small>اختر لكل لاعب هل ينتقل بيعًا كاملًا أو إعارة لمدة شهرين / 4 أشهر / 6 أشهر.</small>
              {selectedPlayers.map((player) => {
                const playerId = getPlayerStableId(player);
                const terms = exchangeTerms[playerId] || { exchangeContractType: "owned", exchangeLoanDurationMonths: 2 };
                const termType = normalizeExchangeContractType(terms.exchangeContractType);
                return (
                  <article className="offerExchangeTermRow" key={playerId}>
                    <div>
                      <b>{player.name || "لاعب"}</b>
                      <small>{player.position || "-"} • {player.rating || "-"}</small>
                    </div>
                    <div className="offerSegmented">
                      <button type="button" className={termType === "owned" ? "active" : ""} onClick={() => updateExchangeTerm(playerId, { exchangeContractType: "owned" })}>بيع كامل</button>
                      <button type="button" className={termType === "loan" ? "active" : ""} onClick={() => updateExchangeTerm(playerId, { exchangeContractType: "loan" })}>إعارة</button>
                    </div>
                    {termType === "loan" ? (
                      <div className="offerSegmented">
                        {[2, 4, 6].map((months) => (
                          <button
                            type="button"
                            key={months}
                            className={normalizeExchangeLoanDuration(terms.exchangeLoanDurationMonths) === months ? "active" : ""}
                            onClick={() => updateExchangeTerm(playerId, { exchangeLoanDurationMonths: months })}
                          >
                            {months} شهر
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          ) : null}
        </section>

        <label className="offerField">
          <span>ملاحظات (اختياري)</span>
          <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="اكتب تفاصيل إضافية للعرض" />
        </label>

        <div className="offerSummary glassSoft">
          <span>{isEditMode ? "رسوم تعديل العرض غير مستردة" : "رسوم تقديم العرض غير مستردة"}</span>
          <b>{formatMoney(OFFER_FEE)}</b>
          <span>المتبقي بعد العرض والرسوم</span>
          <b className={afterOfferBalance < 0 ? "danger" : ""}>{formatMoney(afterOfferBalance)}</b>
        </div>

        {message ? <div className="moneyModalMessage">{message}</div> : null}

        <button type="submit" className="offerSubmitBtn" disabled={busy || !currentMemberId || afterOfferBalance < 0}>
          {busy ? "جارٍ الحفظ..." : isEditMode ? "حفظ التعديل" : "إرسال العرض"}
        </button>
      </form>
    </div>,
    document.body
  );
}


function getFifaAdminNoticeTemplates() {
  return [
    { id: "custom", name: "رسالة مخصصة", type: "system_news", title: "", body: "" },
    { id: "league_reminder", name: "موعد دوري", type: "tournament_reminder", title: "موعد الدوري القادم", body: "الدوري القادم يوم [اليوم] الساعة [الوقت]. يرجى الحضور قبل الموعد بعشر دقائق." },
    { id: "cup_reminder", name: "موعد بطولة كأس", type: "tournament_reminder", title: "موعد بطولة الكأس", body: "تذكير بموعد بطولة الكأس. يرجى الالتزام بالحضور في الموعد المحدد." },
    { id: "market_open", name: "فتح سوق الانتقالات", type: "transfer_window_open", title: "فتح سوق الانتقالات", body: "تم فتح سوق الانتقالات رسميًا. يمكنكم إرسال العروض وإدارة القوائم حسب النظام." },
    { id: "market_closed", name: "إغلاق سوق الانتقالات", type: "transfer_window_closed", title: "إغلاق سوق الانتقالات", body: "تم إغلاق سوق الانتقالات رسميًا. سيتم إيقاف إرسال العروض وتعديل القوائم حتى الفترة القادمة." },
    { id: "financial_notice", name: "تنبيه مالي", type: "financial_alert", title: "تنبيه مالي", body: "يرجى مراجعة السجل المالي والالتزام بالقرارات المالية الصادرة من FIFA." },
    { id: "discipline_notice", name: "تنبيه عقوبة", type: "discipline_alert", title: "قرار إداري", body: "تم إصدار قرار إداري من FIFA. يرجى مراجعة الإشعارات والسجل الخاص بك." },
    { id: "congratulations", name: "تهنئة", type: "system_news", title: "تهانينا", body: "تهنئ إدارة FIFA GROUP الفائزين وتتمنى التوفيق للجميع." },
  ];
}

function getFifaAdminNoticeTemplate(id) {
  return getFifaAdminNoticeTemplates().find((item) => item.id === id) || null;
}

function adminDecisionMainLine(item = {}, members = []) {
  const fromName = item.fromMemberName || getMemberName(members, item.fromMemberId) || "";
  const toName = item.toMemberName || getMemberName(members, item.toMemberId) || "";
  const targetName = item.targetMemberName || item.memberName || getMemberName(members, item.targetMemberId || item.memberId) || "";
  if (fromName || toName) return [fromName || "-", toName || "-", item.amount ? formatMoney(item.amount) : ""].filter(Boolean).join(" ← ");
  if (targetName) return [targetName, item.reason || item.note || item.title || "", item.endDate ? "حتى " + item.endDate : ""].filter(Boolean).join(" • ");
  return item.title || item.body || item.reason || item.note || "قرار إداري";
}

function adminNoteCategoryLabel(category = "") {
  const value = clean(category || "general_note");
  const labels = {
    general_note: "ملاحظة عامة",
    transfer_note: "سوق الانتقالات",
    financial_note: "مالية",
    discipline_note: "عقوبات",
    tournament_note: "بطولات",
    transfer_violation: "مخالفة انتقالات",
    financial_violation: "مخالفة مالية",
    discipline_history: "سجل عقوبات",
    tournament_violation: "مخالفة بطولة",
  };
  return labels[value] || category || "ملاحظة";
}

function adminSeverityLabel(severity = "") {
  const value = clean(severity || "normal");
  if (value === "critical") return "حرجة";
  if (value === "important") return "مهمة";
  return "عادية";
}

function buildFifaAdminSmartAlerts({ members = [], financeRows = [], memberRestrictions = [], transferWindows = [], playerOffers = [], playerContracts = [], pushTokens = [] } = {}) {
  const alerts = [];
  const activeRestrictions = (memberRestrictions || []).filter(isTransferRestrictionActive);
  const soonRestrictions = activeRestrictions.filter((row) => {
    const end = dateOnlyMs(row.endDate, 0);
    const diffDays = Math.ceil((end - Date.now()) / 86400000);
    return end && diffDays >= 0 && diffDays <= 2;
  });
  if (soonRestrictions.length) alerts.push({ title: "إيقافات تنتهي قريبًا", body: soonRestrictions.length + " إيقاف انتقالات ينتهي خلال يومين." });
  const pendingOffers = (playerOffers || []).filter((offer) => clean(offer.status || "pending") === "pending" && !isOfferExpired(offer));
  if (pendingOffers.length >= 5) alerts.push({ title: "عروض معلقة كثيرة", body: "يوجد " + pendingOffers.length + " عرض انتقال معلق يحتاج متابعة." });
  const openWindows = (transferWindows || []).filter((row) => clean(row.status || "") === "open");
  const closingSoon = openWindows.find((row) => { const end = dateOnlyMs(row.endDate, 0); const diffDays = Math.ceil((end - Date.now()) / 86400000); return end && diffDays >= 0 && diffDays <= 2; });
  if (closingSoon) alerts.push({ title: "سوق الانتقالات يقترب من الإغلاق", body: "الفترة المفتوحة تنتهي في " + (closingSoon.endDate || "موعد قريب") + "." });
  const activePush = (pushTokens || []).filter((token) => token.active !== false).length;
  if (!activePush) alerts.push({ title: "لا توجد أجهزة Push نشطة", body: "لم يتم تسجيل أي جهاز لتلقي إشعارات الجوال بعد." });
  const expiringLoans = (playerContracts || []).filter((contract) => clean(contract.status || "active") === "active" && clean(contract.contractType) === "loan" && contract.loanEndDate).filter((contract) => { const end = dateOnlyMs(contract.loanEndDate, 0); const diffDays = Math.ceil((end - Date.now()) / 86400000); return diffDays >= 0 && diffDays <= 7; });
  if (expiringLoans.length) alerts.push({ title: "إعارات قاربت على الانتهاء", body: expiringLoans.length + " عقد إعارة ينتهي خلال 7 أيام." });
  return alerts.slice(0, 6);
}

function FifaAdminPage({
  members = [], notifications = [], moneyTransfers = [], financeRows = [], memberRestrictions = [], adminDecisions = [], adminNotes = [], pushTokens = [], transferWindows = [], playerOffers = [], playerContracts = [], transferHistory = [], playerReleases = [], isMarketOpen = false,
  onSendNotification, onCreateReward, onCreateDiscipline, onCorrectMoneyTransfer, onCancelRestriction, onCreateAdminNote, onMarketControl,
}) {
  const adminTargets = getAdminTargetMembers(members);
  const [activeTab, setActiveTab] = useState("overview");
  const [noticeMode, setNoticeMode] = useState("all");
  const [noticeMemberId, setNoticeMemberId] = useState("");
  const [noticeType, setNoticeType] = useState("system_news");
  const [noticeTemplate, setNoticeTemplate] = useState("custom");
  const [noticeTitle, setNoticeTitle] = useState("");
  const [noticeBody, setNoticeBody] = useState("");
  const [rewardMemberId, setRewardMemberId] = useState("");
  const [rewardType, setRewardType] = useState("admin_reward");
  const [rewardAmount, setRewardAmount] = useState("");
  const [rewardNote, setRewardNote] = useState("");
  const [disciplineType, setDisciplineType] = useState("financial_penalty");
  const [disciplineMemberId, setDisciplineMemberId] = useState("");
  const [disciplineBeneficiaryId, setDisciplineBeneficiaryId] = useState("");
  const [disciplineAmount, setDisciplineAmount] = useState("");
  const [disciplineReason, setDisciplineReason] = useState("");
  const [disciplineStartDate, setDisciplineStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [disciplineEndDate, setDisciplineEndDate] = useState("");
  const [banSendOffers, setBanSendOffers] = useState(true);
  const [banReceiveOffers, setBanReceiveOffers] = useState(true);
  const [banSquadChanges, setBanSquadChanges] = useState(true);
  const [selectedMoneyTransferId, setSelectedMoneyTransferId] = useState("");
  const [correctionMode, setCorrectionMode] = useState("full_reverse");
  const [correctAmount, setCorrectAmount] = useState("");
  const [correctionReason, setCorrectionReason] = useState("");
  const [liftRestrictionId, setLiftRestrictionId] = useState("");
  const [liftReason, setLiftReason] = useState("");
  const [noteMemberId, setNoteMemberId] = useState("");
  const [noteCategory, setNoteCategory] = useState("general_note");
  const [noteSeverity, setNoteSeverity] = useState("normal");
  const [noteText, setNoteText] = useState("");
  const [windowName, setWindowName] = useState("فترة الانتقالات");
  const [windowStartDate, setWindowStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [windowEndDate, setWindowEndDate] = useState("");
  const [windowAnnounce, setWindowAnnounce] = useState(true);
  const [closeMarketReason, setCloseMarketReason] = useState("إغلاق إداري لسوق الانتقالات");
  const [busyAction, setBusyAction] = useState("");
  const [message, setMessage] = useState("");

  const activeRestrictions = (memberRestrictions || []).filter(isTransferRestrictionActive).sort((a, b) => dateValue(a.endDate) - dateValue(b.endDate));
  const openWindows = (transferWindows || []).filter((item) => clean(item.status || "") === "open");
  const transferWindowRows = (transferWindows || []).slice().sort((a, b) => notificationTimeValue(b.createdAt || b.startDate) - notificationTimeValue(a.createdAt || a.startDate));
  const activePushTokens = (pushTokens || []).filter((item) => item.active !== false);
  const inactivePushTokens = (pushTokens || []).filter((item) => item.active === false);
  const pendingOffers = (playerOffers || []).filter((item) => clean(item.status || "pending") === "pending" && !isOfferExpired(item));
  const approvedOffers = (playerOffers || []).filter((item) => clean(item.status || "") === "approvedpendingwindow");
  const activeLoans = (playerContracts || []).filter((item) => clean(item.contractType || "") === "loan" && clean(item.status || "active") === "active");
  const recentTransfers = (transferHistory || []).slice().sort((a,b)=>notificationTimeValue(b.createdAt || b.date)-notificationTimeValue(a.createdAt || a.date)).slice(0, 8);
  const adminMoneyRows = (moneyTransfers || []).filter((item) => same(item.fromMemberId, "FIFA") || same(item.toMemberId, "FIFA") || clean(item.direction).startsWith("admin") || clean(item.type).startsWith("admin") || clean(item.source).startsWith("fifa_admin")).slice().sort((a, b) => notificationTimeValue(b.createdAt || b.date) - notificationTimeValue(a.createdAt || a.date));
  const recentAdminMoney = adminMoneyRows.slice(0, 12);
  const selectedMoneyTransfer = adminMoneyRows.find((item) => same(item.id, selectedMoneyTransferId)) || null;
  const recentAdminNotifications = (notifications || []).filter((item) => same(item.fromMemberId, "FIFA") || clean(item.source).startsWith("fifa_admin")).slice().sort((a,b)=>notificationTimeValue(b.createdAt || b.date)-notificationTimeValue(a.createdAt || a.date)).slice(0, 10);
  const recentDecisions = (adminDecisions || []).slice().sort((a,b)=>notificationTimeValue(b.createdAt || b.date)-notificationTimeValue(a.createdAt || a.date)).slice(0, 16);
  const recentNotes = (adminNotes || []).slice().sort((a,b)=>notificationTimeValue(b.createdAt || b.date)-notificationTimeValue(a.createdAt || a.date)).slice(0, 10);
  const smartAlerts = buildFifaAdminSmartAlerts({ members, memberRestrictions, transferWindows, playerOffers, playerContracts, pushTokens });

  const healthStats = [["أعضاء الموسم الحالي", adminTargets.length], ["أجهزة Push النشطة", activePushTokens.length], ["أجهزة غير نشطة", inactivePushTokens.length], ["إيقافات نشطة", activeRestrictions.length], ["عروض معلقة", pendingOffers.length], ["إعارات نشطة", activeLoans.length], ["السوق", isMarketOpen || openWindows.length ? "مفتوح" : "مغلق"], ["قرارات FIFA", (adminDecisions || []).length]];
  const tabs = [["overview", "الرئيسية"], ["notify", "الإشعارات"], ["finance", "المال"], ["discipline", "العقوبات"], ["correction", "التراجع"], ["market", "السوق"], ["monitor", "المراقبة"], ["notes", "الملاحظات"], ["logs", "السجل"]];

  function applyNoticeTemplate(value) { setNoticeTemplate(value); const template = getFifaAdminNoticeTemplate(value); if (!template || value === "custom") return; setNoticeType(template.type); setNoticeTitle(template.title); setNoticeBody(template.body); }
  async function runAdminAction(actionName, action, success = "تم تنفيذ العملية بنجاح.") { if (busyAction) return; setMessage(""); setBusyAction(actionName); try { await action(); setMessage(success); } catch (err) { setMessage(err?.message || "تعذر تنفيذ العملية."); } finally { setBusyAction(""); } }
  async function submitNotification(event) { event.preventDefault(); await runAdminAction("notice", async () => { await onSendNotification?.({ targetMode: noticeMode, targetMemberId: noticeMemberId, type: noticeType, title: noticeTitle, body: noticeBody }); setNoticeTitle(""); setNoticeBody(""); setNoticeTemplate("custom"); if (noticeMode === "all") setNoticeMemberId(""); }, "تم إرسال الإشعار بنجاح."); }
  async function submitReward(event) { event.preventDefault(); await runAdminAction("reward", async () => { await onCreateReward?.({ toMemberId: rewardMemberId, rewardType, amount: rewardAmount, note: rewardNote }); setRewardAmount(""); setRewardNote(""); }, "تم تنفيذ العملية المالية وإرسال إشعار للعضو."); }
  async function submitDiscipline(event) { event.preventDefault(); await runAdminAction("discipline", async () => { await onCreateDiscipline?.({ actionType: disciplineType, memberId: disciplineMemberId, beneficiaryMemberId: disciplineBeneficiaryId, amount: disciplineAmount, reason: disciplineReason, startDate: disciplineStartDate, endDate: disciplineEndDate, banSendOffers, banReceiveOffers, banSquadChanges }); setDisciplineAmount(""); setDisciplineReason(""); if (disciplineType !== "transfer_restriction") setDisciplineEndDate(""); }, "تم تنفيذ القرار الإداري وإرسال الإشعارات اللازمة."); }
  async function submitCorrection(event) { event.preventDefault(); await runAdminAction("correction", async () => { await onCorrectMoneyTransfer?.({ transferId: selectedMoneyTransferId, mode: correctionMode, correctAmount, reason: correctionReason }); setSelectedMoneyTransferId(""); setCorrectAmount(""); setCorrectionReason(""); }, "تم تنفيذ حركة التصحيح أو العكس بشفافية."); }
  async function submitLiftRestriction(event) { event.preventDefault(); await runAdminAction("lift", async () => { const row = activeRestrictions.find((item) => same(item.id, liftRestrictionId)); if (!row) throw new Error("اختر إيقافًا نشطًا."); await onCreateDiscipline?.({ actionType: "lift_transfer_restriction", memberId: row.memberId, reason: liftReason || "رفع الإيقاف بقرار FIFA" }); setLiftRestrictionId(""); setLiftReason(""); }, "تم رفع الإيقاف عن العضو."); }
  async function cancelRestriction(row) { const reason = window.prompt("سبب إلغاء قرار الإيقاف:", "إدخال خاطئ / قرار ملغى"); if (reason === null) return; await runAdminAction("cancelRestriction", async () => { await onCancelRestriction?.({ restrictionId: row.id, reason }); }, "تم إلغاء قرار الإيقاف مع الاحتفاظ بالسجل."); }
  async function submitMemberNote(event) { event.preventDefault(); await runAdminAction("note", async () => { await onCreateAdminNote?.({ memberId: noteMemberId, category: noteCategory, severity: noteSeverity, note: noteText }); setNoteText(""); }, "تم حفظ الملاحظة الإدارية."); }
  async function submitTransferWindow(event) { event.preventDefault(); await runAdminAction("window", async () => { await onMarketControl?.({ action: "open_window", title: windowName, startDate: windowStartDate, endDate: windowEndDate, status: "open", announce: windowAnnounce, note: windowName }); setWindowName("فترة الانتقالات"); setWindowEndDate(""); }, "تم حفظ فترة الانتقالات وإرسال الإشعار عند الطلب."); }
  async function submitCloseMarket(event) { event.preventDefault(); await runAdminAction("closeMarket", async () => { await onMarketControl?.({ action: "close_windows", note: closeMarketReason }); setCloseMarketReason("إغلاق إداري لسوق الانتقالات"); }, "تم إغلاق سوق الانتقالات."); }
  async function editTransferWindow(row) {
    const nextTitle = window.prompt("اسم فترة الانتقالات:", row.title || row.name || "فترة انتقالات");
    if (nextTitle === null) return;
    const nextStartDate = window.prompt("تاريخ بداية الفترة:", row.startDate || new Date().toISOString().slice(0, 10));
    if (nextStartDate === null) return;
    const nextEndDate = window.prompt("تاريخ نهاية الفترة:", row.endDate || "");
    if (nextEndDate === null) return;
    const note = window.prompt("ملاحظة التعديل:", row.note || "تعديل إداري لفترة الانتقالات") || "";
    await runAdminAction("windowEdit" + row.id, async () => { await onMarketControl?.({ action: "update_window", windowId: row.id, title: nextTitle, startDate: nextStartDate, endDate: nextEndDate, note }); }, "تم تعديل فترة الانتقالات.");
  }
  async function extendTransferWindow(row) {
    const nextEndDate = window.prompt("تاريخ النهاية الجديد:", row.endDate || "");
    if (!nextEndDate) return;
    const note = window.prompt("سبب التمديد:", "تمديد فترة الانتقالات") || "تمديد فترة الانتقالات";
    await runAdminAction("windowExtend" + row.id, async () => { await onMarketControl?.({ action: "update_window", windowId: row.id, title: row.title || row.name || "فترة انتقالات", startDate: row.startDate || "", endDate: nextEndDate, note }); }, "تم تمديد فترة الانتقالات.");
  }
  async function cancelTransferWindow(row) {
    const note = window.prompt("سبب إلغاء الفترة:", "إلغاء إداري لفترة الانتقالات");
    if (note === null) return;
    await runAdminAction("windowCancel" + row.id, async () => { await onMarketControl?.({ action: "cancel_window", windowId: row.id, note }); }, "تم إلغاء فترة الانتقالات.");
  }
  async function deleteTransferWindow(row) {
    const ok = window.confirm("حذف فترة الانتقالات من السجلات؟ استخدم هذا فقط للفترات المدخلة بالخطأ.");
    if (!ok) return;
    const note = window.prompt("سبب الحذف:", "حذف فترة مدخلة بالخطأ") || "حذف فترة مدخلة بالخطأ";
    await runAdminAction("windowDelete" + row.id, async () => { await onMarketControl?.({ action: "delete_window", windowId: row.id, note }); }, "تم حذف فترة الانتقالات من السجلات.");
  }

  return (
    <main className="pageShell fifaAdminShell">
      <section className="sectionBox glassSoft fifaAdminHero"><div><span className="heroKicker">FIFA ADMIN v43</span><h2>لوحة FIFA</h2><p>إدارة قرارات FIFA، التراجع والتصحيح، المراقبة، صحة النظام، والملاحظات الداخلية بدون تدخل مباشر في الصفقات.</p></div><strong>🛡️</strong></section>
      {message ? <div className="adminMessage glassSoft">{message}</div> : null}
      <div className="adminTabs glassSoft">{tabs.map(([id, label]) => <button key={id} type="button" className={activeTab === id ? "active" : ""} onClick={() => setActiveTab(id)}>{label}</button>)}</div>
      {activeTab === "overview" ? <><section className="adminStatsGrid">{healthStats.map(([label, value]) => <div className="adminStatBox" key={label}><small>{label}</small><b>{value}</b></div>)}</section><section className="adminGrid"><div className="sectionBox glassSoft adminRecentBox"><h3>تنبيهات FIFA الذكية</h3><div className="notificationsList">{smartAlerts.length ? smartAlerts.map((item, i) => <article className="notificationItem" key={i}><b>{item.title}</b><p>{item.body}</p></article>) : <div className="empty">لا توجد تنبيهات حالية.</div>}</div></div><div className="sectionBox glassSoft adminRecentBox"><h3>صحة النظام</h3><div className="adminHealthList"><p><b>إجمالي Push Tokens:</b> {pushTokens.length}</p><p><b>آخر إشعار FIFA:</b> {recentAdminNotifications[0]?.title || "لا يوجد"}</p><p><b>آخر قرار:</b> {recentDecisions[0]?.title || adminDecisionTypeLabel(recentDecisions[0]?.type) || "لا يوجد"}</p><p><b>فترات الانتقالات:</b> {(transferWindows || []).length}</p></div></div></section></> : null}
      {activeTab === "notify" ? <section className="sectionBox glassSoft adminForm"><div className="sectionHead compact"><div><h3>إرسال إشعار</h3><p>قوالب جاهزة أو رسالة مخصصة تصل للجرس والجوال.</p></div></div><form className="adminForm" onSubmit={submitNotification}><label className="moneyField"><span>قالب سريع</span><select value={noticeTemplate} onChange={(event) => applyNoticeTemplate(event.target.value)}>{getFifaAdminNoticeTemplates().map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label><label className="moneyField"><span>الإرسال إلى</span><select value={noticeMode} onChange={(event) => setNoticeMode(event.target.value)}><option value="all">جميع الأعضاء</option><option value="member">عضو محدد</option></select></label>{noticeMode === "member" ? <label className="moneyField"><span>العضو</span><select value={noticeMemberId} onChange={(event) => setNoticeMemberId(event.target.value)}><option value="">اختر العضو</option>{adminTargets.map((member) => <option key={member.id} value={member.id}>{member.name || member.id}</option>)}</select></label> : null}<label className="moneyField"><span>نوع الإشعار</span><select value={noticeType} onChange={(event) => setNoticeType(event.target.value)}><option value="system_news">خبر إداري</option><option value="tournament_reminder">موعد بطولة</option><option value="transfer_window_open">فتح سوق الانتقالات</option><option value="transfer_window_closed">إغلاق سوق الانتقالات</option><option value="important_alert">تنبيه مهم</option><option value="financial_alert">تنبيه مالي</option><option value="discipline_alert">تنبيه عقوبة</option></select></label><label className="moneyField"><span>العنوان</span><input value={noticeTitle} onChange={(event) => setNoticeTitle(event.target.value)} placeholder="مثال: الدوري القادم" /></label><label className="moneyField"><span>نص الإشعار</span><textarea value={noticeBody} onChange={(event) => setNoticeBody(event.target.value)} placeholder="اكتب نص التنبيه الرسمي..." /></label><button className="moneySubmitBtn" type="submit" disabled={busyAction === "notice"}>{busyAction === "notice" ? "جارٍ الإرسال..." : "إرسال الإشعار"}</button></form></section> : null}
      {activeTab === "finance" ? <section className="adminGrid"><form className="sectionBox glassSoft adminForm" onSubmit={submitReward}><div className="sectionHead compact"><div><h3>مكافأة / تعويض من FIFA</h3><p>عملية مالية من FIFA للعضو مع إشعار وسجل قرار.</p></div></div><label className="moneyField"><span>العضو المستفيد</span><select value={rewardMemberId} onChange={(event) => setRewardMemberId(event.target.value)}><option value="">اختر العضو</option>{adminTargets.map((member) => <option key={member.id} value={member.id}>{member.name || member.id}</option>)}</select></label><label className="moneyField"><span>نوع العملية</span><select value={rewardType} onChange={(event) => setRewardType(event.target.value)}><option value="admin_reward">مكافأة بطولة</option><option value="admin_compensation">تعويض إداري من FIFA</option><option value="admin_adjustment">تسوية مالية</option><option value="admin_bonus">جائزة خاصة</option></select></label><label className="moneyField"><span>المبلغ</span><input inputMode="numeric" value={rewardAmount} onChange={(event) => setRewardAmount(event.target.value)} placeholder="مثال: 15000000" /></label><label className="moneyField"><span>السبب / الملاحظة</span><textarea value={rewardNote} onChange={(event) => setRewardNote(event.target.value)} placeholder="مثال: مكافأة الفوز بالدوري" /></label><button className="moneySubmitBtn" type="submit" disabled={busyAction === "reward"}>{busyAction === "reward" ? "جارٍ التنفيذ..." : "تنفيذ العملية"}</button></form><div className="sectionBox glassSoft adminRecentBox"><h3>آخر العمليات المالية الإدارية</h3><div className="notificationsList">{recentAdminMoney.length ? recentAdminMoney.map((item) => <article className="notificationItem" key={item.id}><b>{item.typeLabel || adminDecisionTypeLabel(item.type)}</b><p>{item.fromMemberName || getMemberName(members, item.fromMemberId) || "-"} ← {item.toMemberName || getMemberName(members, item.toMemberId) || "-"}</p><small>{formatMoney(item.amount)} • {item.note || "بدون ملاحظة"}</small><button type="button" className="inlineAdminBtn" onClick={() => { setSelectedMoneyTransferId(item.id); setActiveTab("correction"); }}>تصحيح هذه العملية</button></article>) : <div className="empty">لا توجد عمليات مالية إدارية.</div>}</div></div></section> : null}
      {activeTab === "discipline" ? <section className="sectionBox glassSoft adminForm adminDisciplineBox"><div className="sectionHead compact"><div><h3>العقوبات والقرارات الإدارية</h3><p>غرامات، خصومات، تعويضات إجبارية بين الأعضاء، وإيقاف فعلي من الانتقالات.</p></div></div><form className="adminForm" onSubmit={submitDiscipline}><label className="moneyField"><span>نوع القرار</span><select value={disciplineType} onChange={(event) => setDisciplineType(event.target.value)}><option value="financial_penalty">غرامة مالية لصالح FIFA</option><option value="financial_deduction">خصم إداري لصالح FIFA</option><option value="member_compensation">تعويض مالي لعضو متضرر</option><option value="transfer_restriction">إيقاف من نظام الانتقالات</option><option value="lift_transfer_restriction">رفع إيقاف الانتقالات</option></select></label><label className="moneyField"><span>العضو المخالف / صاحب القرار</span><select value={disciplineMemberId} onChange={(event) => setDisciplineMemberId(event.target.value)}><option value="">اختر العضو</option>{adminTargets.map((member) => <option key={member.id} value={member.id}>{member.name || member.id}</option>)}</select></label>{disciplineType === "member_compensation" ? <label className="moneyField"><span>العضو المستفيد من التعويض</span><select value={disciplineBeneficiaryId} onChange={(event) => setDisciplineBeneficiaryId(event.target.value)}><option value="">اختر العضو المستفيد</option>{adminTargets.map((member) => <option key={member.id} value={member.id}>{member.name || member.id}</option>)}</select></label> : null}{["financial_penalty", "financial_deduction", "member_compensation"].includes(disciplineType) ? <label className="moneyField"><span>المبلغ</span><input inputMode="numeric" value={disciplineAmount} onChange={(event) => setDisciplineAmount(event.target.value)} placeholder="مثال: 5000000" /></label> : null}{disciplineType === "transfer_restriction" ? <><div className="restrictionChecks"><label><input type="checkbox" checked={banSendOffers} onChange={(event) => setBanSendOffers(event.target.checked)} /> منع إرسال العروض</label><label><input type="checkbox" checked={banReceiveOffers} onChange={(event) => setBanReceiveOffers(event.target.checked)} /> منع استقبال العروض</label><label><input type="checkbox" checked={banSquadChanges} onChange={(event) => setBanSquadChanges(event.target.checked)} /> منع تعديل القائمة والبيع والإعارة والاستغناء</label></div><label className="moneyField"><span>بداية الإيقاف</span><input type="date" value={disciplineStartDate} onChange={(event) => setDisciplineStartDate(event.target.value)} /></label><label className="moneyField"><span>نهاية الإيقاف</span><input type="date" value={disciplineEndDate} onChange={(event) => setDisciplineEndDate(event.target.value)} /></label></> : null}<label className="moneyField"><span>سبب القرار</span><textarea value={disciplineReason} onChange={(event) => setDisciplineReason(event.target.value)} placeholder="مثال: مخالفة نظام الانتقالات / مخالفة مالية / تعويض عضو متضرر" /></label><button className="moneySubmitBtn" type="submit" disabled={busyAction === "discipline"}>{busyAction === "discipline" ? "جارٍ التنفيذ..." : "تنفيذ القرار"}</button></form></section> : null}
      {activeTab === "correction" ? <section className="adminGrid"><form className="sectionBox glassSoft adminForm" onSubmit={submitCorrection}><div className="sectionHead compact"><div><h3>تصحيح / عكس عملية مالية</h3><p>لا نحذف السجل المالي؛ ننشئ حركة عكسية شفافة.</p></div></div><label className="moneyField"><span>العملية الأصلية</span><select value={selectedMoneyTransferId} onChange={(event) => setSelectedMoneyTransferId(event.target.value)}><option value="">اختر عملية مالية</option>{adminMoneyRows.slice(0, 40).map((item) => <option key={item.id} value={item.id}>{notificationDisplayDate(item.createdAt || item.date)} • {item.typeLabel || adminDecisionTypeLabel(item.type)} • {formatMoney(item.amount)} • {item.fromMemberName || getMemberName(members, item.fromMemberId)} ← {item.toMemberName || getMemberName(members, item.toMemberId)}</option>)}</select></label>{selectedMoneyTransfer ? <div className="adminDecisionCard"><b>{selectedMoneyTransfer.typeLabel || adminDecisionTypeLabel(selectedMoneyTransfer.type)}</b><p>{selectedMoneyTransfer.fromMemberName || getMemberName(members, selectedMoneyTransfer.fromMemberId)} ← {selectedMoneyTransfer.toMemberName || getMemberName(members, selectedMoneyTransfer.toMemberId)} • {formatMoney(selectedMoneyTransfer.amount)}</p><small>{selectedMoneyTransfer.note || "بدون ملاحظة"}</small></div> : null}<label className="moneyField"><span>نوع التصحيح</span><select value={correctionMode} onChange={(event) => setCorrectionMode(event.target.value)}><option value="full_reverse">عكس العملية بالكامل</option><option value="amount_correction">تصحيح المبلغ فقط</option></select></label>{correctionMode === "amount_correction" ? <label className="moneyField"><span>المبلغ الصحيح</span><input inputMode="numeric" value={correctAmount} onChange={(event) => setCorrectAmount(event.target.value)} placeholder="مثال: 10000000" /></label> : null}<label className="moneyField"><span>سبب التصحيح</span><textarea value={correctionReason} onChange={(event) => setCorrectionReason(event.target.value)} placeholder="مثال: تم إدخال 100 مليون بدل 10 مليون" /></label><button className="moneySubmitBtn" type="submit" disabled={busyAction === "correction"}>{busyAction === "correction" ? "جارٍ التصحيح..." : "تنفيذ التصحيح"}</button></form><div className="sectionBox glassSoft adminForm"><div className="sectionHead compact"><div><h3>رفع / إلغاء إيقاف انتقالات</h3><p>رفع إيقاف نشط أو إلغاء قرار تم إدخاله بالخطأ.</p></div></div><form className="adminForm" onSubmit={submitLiftRestriction}><label className="moneyField"><span>الإيقاف النشط</span><select value={liftRestrictionId} onChange={(event) => setLiftRestrictionId(event.target.value)}><option value="">اختر إيقافًا نشطًا</option>{activeRestrictions.map((item) => <option key={item.id} value={item.id}>{item.memberName || getMemberName(members, item.memberId)} • حتى {item.endDate || "-"}</option>)}</select></label><label className="moneyField"><span>سبب الرفع</span><textarea value={liftReason} onChange={(event) => setLiftReason(event.target.value)} placeholder="مثال: تم قبول الاستئناف / قرار إداري تصحيحي" /></label><button className="moneySubmitBtn" type="submit" disabled={busyAction === "lift"}>{busyAction === "lift" ? "جارٍ الرفع..." : "رفع الإيقاف"}</button></form><div className="notificationsList compactList">{activeRestrictions.length ? activeRestrictions.slice(0, 8).map((item) => <article className="notificationItem" key={item.id}><b>{item.memberName || getMemberName(members, item.memberId)}</b><p>{transferRestrictionShortText(item)}</p><small>{item.startDate || "-"} ← {item.endDate || "-"} • {item.reason || "بدون سبب"}</small><button type="button" className="inlineAdminBtn danger" onClick={() => cancelRestriction(item)}>إلغاء القرار</button></article>) : <div className="empty">لا توجد إيقافات نشطة.</div>}</div></div></section> : null}
      {activeTab === "market" ? <section className="adminGrid"><form className="sectionBox glassSoft adminForm" onSubmit={submitTransferWindow}><div className="sectionHead compact"><div><h3>مركز سوق الانتقالات</h3><p>إنشاء فترة انتقالات أو فتحها وإشعار الأعضاء.</p></div></div><label className="moneyField"><span>اسم الفترة</span><input value={windowName} onChange={(event) => setWindowName(event.target.value)} placeholder="مثال: الفترة الأولى" /></label><label className="moneyField"><span>بداية الفترة</span><input type="date" value={windowStartDate} onChange={(event) => setWindowStartDate(event.target.value)} /></label><label className="moneyField"><span>نهاية الفترة</span><input type="date" value={windowEndDate} onChange={(event) => setWindowEndDate(event.target.value)} /></label><label className="adminCheckLine"><input type="checkbox" checked={windowAnnounce} onChange={(event) => setWindowAnnounce(event.target.checked)} /> إرسال إشعار للأعضاء</label><button className="moneySubmitBtn" type="submit" disabled={busyAction === "window"}>{busyAction === "window" ? "جارٍ الحفظ..." : "حفظ فترة الانتقالات"}</button></form><form className="sectionBox glassSoft adminForm" onSubmit={submitCloseMarket}><div className="sectionHead compact"><div><h3>إغلاق السوق المفتوح</h3><p>يغلق كل الفترات المفتوحة ويرسل إشعارًا عامًا.</p></div></div><div className="adminDecisionCard"><b>الفترات المفتوحة حاليًا: {openWindows.length}</b><p>{openWindows.length ? openWindows.map((item) => item.name || item.title || item.id).join("، ") : "لا توجد فترة مفتوحة."}</p></div><label className="moneyField"><span>سبب الإغلاق</span><textarea value={closeMarketReason} onChange={(event) => setCloseMarketReason(event.target.value)} /></label><button className="moneySubmitBtn dangerBtn" type="submit" disabled={busyAction === "closeMarket" || !openWindows.length}>{busyAction === "closeMarket" ? "جارٍ الإغلاق..." : "إغلاق السوق الآن"}</button></form><div className="sectionBox glassSoft adminRecentBox"><div className="sectionHead compact"><div><h3>إدارة فترات السوق</h3><p>بطاقة مستقلة لكل فترة مع تعديل، تمديد، إلغاء، حذف وإحصائيات تنفيذ.</p></div></div><div className="notificationsList compactList">{transferWindowRows.length ? transferWindowRows.map((row) => { const status = clean(row.status || "open"); const isOpen = status === "open"; const isCancelled = status === "cancelled"; const stats = computeTransferWindowStats(row, transferHistory, moneyTransfers, playerReleases); return <article className="notificationItem" key={row.id}><b>{row.title || row.name || "فترة انتقالات"}</b><p>{row.startDate || "-"} ← {row.endDate || "-"}</p><small>{transferWindowStatusLabel(row)}{row.note ? " • " + row.note : ""}</small><div className="statStrip miniStats"><span>💰 {formatMoney(stats.moneySpent)}</span><span>بيع: {stats.sales}</span><span>إعارة: {stats.loans}</span><span>استغناء: {stats.releases}</span><span>معلّقة نُفذت: {stats.pendingExecuted}</span></div><div className="offerActions compactActions"><button type="button" className="inlineAdminBtn" onClick={() => editTransferWindow(row)} disabled={busyAction === "windowEdit" + row.id}>تعديل</button><button type="button" className="inlineAdminBtn" onClick={() => extendTransferWindow(row)} disabled={busyAction === "windowExtend" + row.id}>تمديد</button>{!isCancelled ? <button type="button" className="inlineAdminBtn danger" onClick={() => cancelTransferWindow(row)} disabled={busyAction === "windowCancel" + row.id}>{isOpen ? "إلغاء / إغلاق" : "إلغاء"}</button> : null}<button type="button" className="inlineAdminBtn danger" onClick={() => deleteTransferWindow(row)} disabled={busyAction === "windowDelete" + row.id}>حذف</button></div></article>; }) : <div className="empty">لا توجد فترات انتقالات مسجلة.</div>}</div></div></section> : null}
      {activeTab === "monitor" ? <section className="adminGrid"><div className="sectionBox glassSoft adminRecentBox"><h3>مراقبة العروض</h3><div className="adminMonitorGrid"><div><small>معلقة</small><b>{pendingOffers.length}</b></div><div><small>مقبولة بانتظار السوق</small><b>{approvedOffers.length}</b></div><div><small>إعارات نشطة</small><b>{activeLoans.length}</b></div><div><small>صفقات حديثة</small><b>{recentTransfers.length}</b></div></div><div className="notificationsList compactList">{pendingOffers.slice(0, 8).map((offer) => <article className="notificationItem" key={offer.id}><b>{offer.targetPlayerName || "عرض لاعب"}</b><p>{offer.fromMemberName || getMemberName(members, offer.fromMemberId)} ← {offer.toMemberName || getMemberName(members, offer.toMemberId)} • {formatMoney(offer.amount)}</p><small>{offer.typeLabel || offer.type || "عرض"}</small></article>)}</div></div><div className="sectionBox glassSoft adminRecentBox"><h3>آخر الصفقات</h3><div className="notificationsList">{recentTransfers.length ? recentTransfers.map((item) => <article className="notificationItem" key={item.id}><b>{item.playerName || "صفقة"}</b><p>{item.fromMemberName || getMemberName(members, item.fromMemberId)} ← {item.toMemberName || getMemberName(members, item.toMemberId)}</p><small>{item.typeLabel || item.type || "انتقال"} • {formatMoney(item.amount || 0)}</small></article>) : <div className="empty">لا توجد صفقات حديثة.</div>}</div></div></section> : null}
      {activeTab === "notes" ? <section className="adminGrid"><form className="sectionBox glassSoft adminForm" onSubmit={submitMemberNote}><div className="sectionHead compact"><div><h3>ملاحظات إدارية داخلية</h3><p>لا تظهر للأعضاء، وتساعد FIFA في متابعة المخالفات والسلوك.</p></div></div><label className="moneyField"><span>العضو</span><select value={noteMemberId} onChange={(event) => setNoteMemberId(event.target.value)}><option value="">اختر العضو</option>{adminTargets.map((member) => <option key={member.id} value={member.id}>{member.name || member.id}</option>)}</select></label><label className="moneyField"><span>تصنيف الملاحظة</span><select value={noteCategory} onChange={(event) => setNoteCategory(event.target.value)}><option value="general_note">ملاحظة عامة</option><option value="transfer_violation">مخالفة انتقالات</option><option value="financial_violation">مخالفة مالية</option><option value="discipline_history">سجل عقوبات</option><option value="tournament_violation">مخالفة بطولة</option></select></label><label className="moneyField"><span>الأهمية</span><select value={noteSeverity} onChange={(event) => setNoteSeverity(event.target.value)}><option value="normal">عادية</option><option value="important">مهمة</option><option value="critical">حرجة</option></select></label><label className="moneyField"><span>الملاحظة</span><textarea value={noteText} onChange={(event) => setNoteText(event.target.value)} placeholder="اكتب ملاحظة داخلية لا يراها العضو..." /></label><button className="moneySubmitBtn" type="submit" disabled={busyAction === "note"}>{busyAction === "note" ? "جارٍ الحفظ..." : "حفظ الملاحظة"}</button></form><div className="sectionBox glassSoft adminRecentBox"><h3>آخر الملاحظات</h3><div className="notificationsList">{recentNotes.length ? recentNotes.map((item) => <article className="notificationItem" key={item.id}><b>{item.memberName || getMemberName(members, item.memberId)} • {adminNoteCategoryLabel(item.category)}</b><p>{item.note || "-"}</p><small>{adminSeverityLabel(item.severity)} • {notificationDisplayDate(item.createdAt || item.date)}</small></article>) : <div className="empty">لا توجد ملاحظات إدارية بعد.</div>}</div></div></section> : null}
      {activeTab === "logs" ? <section className="adminGrid"><div className="sectionBox glassSoft adminRecentBox"><h3>سجل قرارات FIFA</h3><div className="notificationsList">{recentDecisions.length ? recentDecisions.map((item) => <article className="notificationItem" key={item.id}><b>{item.title || adminDecisionTypeLabel(item.type)}</b><p>{adminDecisionMainLine(item, members)}</p><small>{adminDecisionStatusLabel(item.status)} • {item.reason || item.note || item.body || "بدون سبب"} • {notificationDisplayDate(item.createdAt || item.date)}</small></article>) : <div className="empty">لا توجد قرارات إدارية مسجلة بعد.</div>}</div></div><div className="sectionBox glassSoft adminRecentBox"><h3>آخر إشعارات FIFA</h3><div className="notificationsList">{recentAdminNotifications.length ? recentAdminNotifications.map((item) => <article className="notificationItem" key={item.id}><b>{item.title || "إشعار"}</b><p>{item.body || "-"}</p><small>{item.audience === "all" ? "جميع الأعضاء" : item.toMemberName || item.toMemberId || "عضو"} • {notificationDisplayDate(item.createdAt || item.date)}</small></article>) : <div className="empty">لا توجد إشعارات إدارية بعد.</div>}</div></div><div className="sectionBox glassSoft adminRecentBox"><h3>آخر عمليات FIFA المالية</h3><div className="notificationsList">{recentAdminMoney.length ? recentAdminMoney.map((item) => <article className="notificationItem" key={item.id}><b>{item.typeLabel || adminDecisionTypeLabel(item.type)}</b><p>{item.fromMemberName || getMemberName(members, item.fromMemberId) || "-"} ← {item.toMemberName || getMemberName(members, item.toMemberId) || "-"} • {formatMoney(item.amount)}</p><small>{item.note || "-"} • {notificationDisplayDate(item.createdAt || item.date)}</small></article>) : <div className="empty">لا توجد عمليات مالية إدارية بعد.</div>}</div></div></section> : null}
    </main>
  );
}



function SeasonHubPage({ config, activeSeason, groups = [], total = 0, members = [], competitions = [], trophyMap = {}, currentMemberId = "", focusedCompetitionId = "", rankingRows = [], onOpenView }) {
  const [tab, setTab] = useState("competitions");
  const seasonTitle = activeSeason?.seasonName || activeSeason?.name || config.seasonName || config.seasonTitle || "الموسم";
  return (
    <main className="pageShell seasonHubPage leagueAdminShell">
      <section className="sectionBox glassSoft fifaAdminHero seasonHubHero">
        <div>
          <span className="heroKicker">FIFA GROUP SEASON</span>
          <h2>{seasonTitle}</h2>
        </div>
        <strong>🏆</strong>
      </section>
      <nav className="archiveModeTabs glassSoft seasonHubTabs">
        <button className={tab === "competitions" ? "active" : ""} onClick={() => setTab("competitions")}>البطولات التنافسية</button>
        <button className={tab === "records" ? "active" : ""} onClick={() => setTab("records")}>سجل البطولات</button>
        <button className={tab === "ranking" ? "active" : ""} onClick={() => setTab("ranking")}>تصنيف الأعضاء</button>
      </nav>

      {tab === "competitions" ? (
        <CompetitionViewerSection competitions={competitions} currentMemberId={currentMemberId} focusedCompetitionId={focusedCompetitionId} config={config} trophyMap={trophyMap} />
      ) : null}

      {tab === "records" ? (
        <section className="sectionBox glassSoft">
          <div className="sectionHead compact"><div><h3>سجل البطولات</h3><p>{total} بطولة مسجلة من Google Sheets.</p></div></div>
          <div className="seasonSimpleList">
            {groups.length ? groups.map((item) => (
              <button
                key={item.trophyId}
                className="seasonSimpleRow glassSoft"
                onClick={() => onOpenView?.({ type: "seasonTrophy", title: `${item.name} — ${seasonTitle}`, group: item })}
              >
                <img src={item.image || avatar(item.name)} alt="" />
                <div><b>{item.name}</b><small>{item.count} نسخة</small></div>
                <span>{renderSmartIcon(config.seasonCountIcon)} {item.count}</span>
                <span>{renderSmartIcon(config.seasonPointsIcon)} {item.points || 0}</span>
              </button>
            )) : <div className="empty">لا توجد بطولات مسجلة في Google Sheets لهذا الموسم.</div>}
          </div>
        </section>
      ) : null}

      {tab === "ranking" ? (
        <section className="sectionBox glassSoft rankingInlineBox">
          <div className="sectionHead compact"><div><h3>تصنيف الأعضاء</h3></div></div>
          <div className="rankingList">
            {(rankingRows || []).length ? rankingRows.map((row, index) => {
              const rank = index + 1;
              return (
                <button
                  key={row.memberId || row.id || index}
                  className={rank === 1 ? "rankingCard rankingCompactCard first clickable" : "rankingCard rankingCompactCard clickable"}
                  onClick={() => row.memberId ? onOpenView?.({ type: "rankingMemberWins", member: row, rows: row.rows || [], title: `بطولات ${row.name || row.memberName || row.memberId} في الموسم` }) : null}
                >
                  <span className="rankingRank">#{rank}</span>
                  <img className="rankingAvatar" src={row.avatar || avatar(row.name || row.memberName)} alt="" />
                  <div className="rankingIdentity"><b>{row.name || row.memberName || row.memberId}</b></div>
                  <div className="rankingSeasonLogos">{row.teamLogo ? <img src={row.teamLogo} alt="" /> : null}{row.nationalLogo ? <img src={row.nationalLogo} alt="" /> : null}</div>
                  <div className="rankingInlineStats"><span>{renderSmartIcon(config.rankingTitlesIcon)} {row.titles}</span><span>{renderSmartIcon(config.rankingPointsIcon)} {row.points}</span></div>
                </button>
              );
            }) : <div className="empty">لا يوجد تصنيف متاح لهذا الموسم.</div>}
          </div>
        </section>
      ) : null}
    </main>
  );
}

function LeagueViewerPage({ competitions = [], currentMemberId = "", focusedCompetitionId = "", config = {}, trophyMap = {} }) {
  return (
    <main className="pageShell leagueAdminShell">
      <CompetitionViewerSection competitions={competitions} currentMemberId={currentMemberId} focusedCompetitionId={focusedCompetitionId} config={config} trophyMap={trophyMap} standalone />
    </main>
  );
}

function CompetitionViewerSection({ competitions = [], currentMemberId = "", focusedCompetitionId = "", config = {}, trophyMap = {}, standalone = false }) {
  const competitionRows = (competitions || [])
    .filter((item) => ["league", "league_qualifier", "cup", "super_cup", "champions_league", "world_cup"].includes(clean(item.type || "league")))
    .sort((a, b) => competitionTimeValue(b) - competitionTimeValue(a));
  const mainCompetitionTypes = ["league", "cup", "super_cup", "world_cup", "champions_league"];
  const rowsForType = (type) => competitionRows.filter((item) => {
    const key = competitionTypeKey(item.type);
    if (type === "league") return key === "league";
    return key === type;
  });
  const typeGroups = mainCompetitionTypes
    .map((type) => ({ type, rows: rowsForType(type) }))
    .filter((group) => group.rows.length);
  const focusedCompetition = focusedCompetitionId ? competitionRows.find((item) => same(item.id, focusedCompetitionId)) : null;
  const defaultType = focusedCompetition ? (competitionTypeKey(focusedCompetition.type) === "league_qualifier" ? "league" : competitionTypeKey(focusedCompetition.type)) : (typeGroups[0]?.type || "league");
  const [selectedType, setSelectedType] = useState(defaultType);
  const currentTypeRows = rowsForType(selectedType);
  const activeCompetition = currentTypeRows.find((item) => clean(item.status || "active") === "active") || currentTypeRows[0] || competitionRows[0] || null;
  const [selectedCompetitionId, setSelectedCompetitionId] = useState(focusedCompetitionId || activeCompetition?.id || "");
  const selectedCompetition = competitionRows.find((item) => same(item.id, selectedCompetitionId)) || activeCompetition;
  useEffect(() => {
    if (focusedCompetition) {
      setSelectedType(competitionTypeKey(focusedCompetition.type) === "league_qualifier" ? "league" : competitionTypeKey(focusedCompetition.type));
      setSelectedCompetitionId(focusedCompetition.id);
      return;
    }
    if (!currentTypeRows.some((item) => same(item.id, selectedCompetitionId))) {
      setSelectedCompetitionId(currentTypeRows[0]?.id || activeCompetition?.id || "");
    }
  }, [focusedCompetitionId, competitionRows.length, selectedType, currentTypeRows.length]);
  const standings = selectedCompetition && clean(selectedCompetition.type || "league") === "league" && !isLeagueGroupsCompetition(selectedCompetition) ? computeLeagueStandings(selectedCompetition.participants || [], selectedCompetition.matches || []) : [];
  const groupedMatches = selectedCompetition ? groupLeagueMatchesByRound(selectedCompetition.matches || []) : [];
  const myMatches = currentMemberId ? (selectedCompetition?.matches || []).filter((match) => same(match.homeMemberId, currentMemberId) || same(match.awayMemberId, currentMemberId)) : [];
  const viewerLeagueGroupsMode = selectedCompetition ? isLeagueGroupsCompetition(selectedCompetition) : false;
  const isLeague = clean(selectedCompetition?.type || "league") === "league";
  const qualifierRowsForSelectedLeague = selectedCompetition && isLeague
    ? competitionRows.filter((item) =>
        competitionTypeKey(item.type) === "league_qualifier" &&
        same(item.seasonId || "", selectedCompetition.seasonId || "")
      )
    : [];
  const qualifiedIds = selectedCompetition?.qualifiedMemberIds || computeLeagueQualifierQualifiedIds(selectedCompetition || {});

  return (
    <>
      {standalone ? (
        <section className="sectionBox glassSoft fifaAdminHero">
          <div><span className="heroKicker">FIFA GROUP</span><h2>البطولات التنافسية</h2></div><strong>📊</strong>
        </section>
      ) : null}
      <section className="sectionBox glassSoft competitionTypeShell">
        <div className="sectionHead compact"><div><h3>البطولات التنافسية</h3></div></div>
        {typeGroups.length ? (
          <>
            <div className="competitionTypeGrid">
              {typeGroups.map((group) => {
                const sample = group.rows[0] || { type: group.type };
                return (
                  <button key={group.type} type="button" className={selectedType === group.type ? "competitionTypeCard active" : "competitionTypeCard"} onClick={() => { setSelectedType(group.type); setSelectedCompetitionId(group.rows[0]?.id || ""); }}>
                    <CompetitionIcon competition={{ ...sample, type: group.type }} config={config} trophyMap={trophyMap} className="competitionTypeIcon" />
                    <b>{competitionTypeLabel(group.type)}</b>
                    <small>{group.rows.length} بطولة</small>
                  </button>
                );
              })}
            </div>
            <div className="competitionInstanceList">
              {currentTypeRows.map((competition) => (
                <button key={competition.id} type="button" className={same(selectedCompetition?.id, competition.id) ? "competitionInstanceCard active" : "competitionInstanceCard"} onClick={() => setSelectedCompetitionId(competition.id)}>
                  <CompetitionIcon competition={competition} config={config} trophyMap={trophyMap} className="competitionInstanceIcon" />
                  <div><b>{competition.name || competitionTypeLabel(competition.type)}</b><small>{competitionStatusLabel(competition.status)}{competition.startDate ? ` • ${competition.startDate}` : ""}</small></div>
                </button>
              ))}
            </div>
          </>
        ) : <div className="empty">لا توجد بطولات تنافسية منشأة بعد.</div>}
      </section>
      {selectedCompetition ? (
        <>
          <section className="sectionBox glassSoft">
            <div className="sectionHead compact competitionDetailHead"><CompetitionIcon competition={selectedCompetition} config={config} trophyMap={trophyMap} className="competitionDetailIcon" /><div><h3>{selectedCompetition.name}</h3><p>{competitionTypeLabel(selectedCompetition.type)} • {competitionStatusLabel(selectedCompetition.status)} {selectedCompetition.startDate ? `• ${selectedCompetition.startDate}` : ""}{selectedCompetition.endDate ? ` → ${selectedCompetition.endDate}` : ""}</p></div></div>
            <div className="leagueSummaryStrip"><span>المشاركون</span><b>{(selectedCompetition.participants || []).length}</b><span>المباريات</span><b>{(selectedCompetition.matches || []).length}</b><span>المكتملة</span><b>{(selectedCompetition.matches || []).filter((m) => clean(m.resultStatus || m.status) === "completed").length}</b><span>{isLeague || ["cup", "super_cup", "world_cup", "champions_league"].includes(competitionTypeKey(selectedCompetition.type)) ? "البطل" : "المتأهلون"}</span><b>{isLeague ? (selectedCompetition.championMemberName || standings[0]?.memberName || "-") : ["cup", "super_cup", "world_cup", "champions_league"].includes(competitionTypeKey(selectedCompetition.type)) ? (selectedCompetition.championMemberName || getKnockoutChampion(selectedCompetition)?.memberName || "-") : (qualifiedIds.length || "-")}</b></div>
            <div className="imageActionRow"><button type="button" onClick={() => downloadCompetitionStandingsImage(selectedCompetition, config, trophyMap)} disabled={!isLeague && !["world_cup", "champions_league"].includes(competitionTypeKey(selectedCompetition.type))}>{["world_cup", "champions_league"].includes(competitionTypeKey(selectedCompetition.type)) ? "تحميل ترتيب المجموعات" : "تحميل صورة الترتيب"}</button>{(["world_cup", "champions_league"].includes(competitionTypeKey(selectedCompetition.type)) || isLeagueGroupsCompetition(selectedCompetition)) ? <button type="button" onClick={() => downloadCompetitionScheduleTableImage(selectedCompetition, config, trophyMap)}>{clean(selectedCompetition.status) === "completed" ? "تحميل نتائج المباريات" : "تحميل جدول المباريات"}</button> : null}<button type="button" onClick={() => downloadCompetitionResultsImage(selectedCompetition, config, trophyMap)}>{(["world_cup", "champions_league"].includes(competitionTypeKey(selectedCompetition.type)) || isLeagueGroupsCompetition(selectedCompetition)) ? "تحميل صورة الأدوار الإقصائية" : clean(selectedCompetition.status) === "completed" ? "تحميل نتائج المباريات" : "تحميل جدول المباريات"}</button></div>
          </section>
          {competitionTypeKey(selectedCompetition.type) === "world_cup" ? <WorldCupGroupsSection competition={selectedCompetition} config={config} trophyMap={trophyMap} /> : (competitionTypeKey(selectedCompetition.type) === "champions_league" || isLeagueGroupsCompetition(selectedCompetition)) ? <ChampionsLeagueGroupsSection competition={selectedCompetition} config={config} trophyMap={trophyMap} /> : null}
          {isLeague && !isLeagueGroupsCompetition(selectedCompetition) ? (
            <section className="sectionBox glassSoft">
              <div className="sectionHead compact"><div><h3>الترتيب</h3></div></div>
              <div className="leagueTable">
                <div className="leagueTableHead"><span>#</span><span>العضو</span><span>لعب</span><span>ف</span><span>ت</span><span>خ</span><span>له</span><span>عليه</span><span>فارق</span><span>نقاط</span></div>
                {standings.map((row, index) => (
                  <div key={row.memberId} className={index === 0 ? "leagueTableRow champion" : (selectedCompetition.relegatedMemberIds || []).some((id) => same(id, row.memberId)) ? "leagueTableRow relegated" : (selectedCompetition.absentMemberIds || []).some((id) => same(id, row.memberId)) ? "leagueTableRow absent" : "leagueTableRow"}>
                    <span>{index + 1}</span><span>{row.memberName}{row.needsPlayoff ? <em className="playoffBadge">فاصلة</em> : null}{(selectedCompetition.absentMemberIds || []).some((id) => same(id, row.memberId)) ? <em className="absentBadge">غائب</em> : null}</span><span>{row.played}</span><span>{row.wins}</span><span>{row.draws}</span><span>{row.losses}</span><span>{row.goalsFor}</span><span>{row.goalsAgainst}</span><span>{row.goalDifference}</span><b>{row.points}</b>
                  </div>
                ))}
              </div>
            </section>
          ) : !["cup", "super_cup", "world_cup", "champions_league"].includes(competitionTypeKey(selectedCompetition.type)) && qualifiedIds.length ? (
            <section className="sectionBox glassSoft"><div className="sectionHead compact"><div><h3>المتأهلون</h3></div></div><div className="incomingOfferedPlayers">{qualifiedIds.map((id) => <span key={id}>{getMemberName(selectedCompetition.participants || [], id) || id}</span>)}</div></section>
          ) : null}
          {myMatches.length ? (
            <section className="sectionBox glassSoft"><div className="sectionHead compact"><div><h3>مبارياتي</h3></div></div><div className="leagueMatchesList">{myMatches.map((match) => <ReadonlyLeagueMatch key={match.id} match={match} />)}</div></section>
          ) : null}
          {isLeague ? (
            <section className="sectionBox glassSoft">
              <div className="sectionHead compact"><div><h3>{clean(selectedCompetition.status) === "completed" ? "نتائج المباريات" : "جدول المباريات"}</h3></div></div>
              <div className="leagueRoundsList">{groupedMatches.map((round) => <div className="leagueRoundBox" key={round.round}><h4>{isLeagueGroupsCompetition(selectedCompetition) ? leagueTwoGroupsAdminRoundTitle(round.matches?.[0] || {}, round.round) : `الجولة ${round.round}`}</h4><div className="leagueMatchesList">{round.matches.map((match) => <ReadonlyLeagueMatch key={match.id} match={match} />)}</div></div>)}</div>
            </section>
          ) : (
            <KnockoutBracketSection competition={selectedCompetition} title="الأدوار الإقصائية" />
          )}
          {isLeague && !selectedCompetition?.leagueQualifier?.enabled && qualifierRowsForSelectedLeague.length ? (
            <LeagueQualifierSection qualifiers={qualifierRowsForSelectedLeague} />
          ) : null}
          <EmbeddedQualifierSection competition={selectedCompetition} config={config} trophyMap={trophyMap} />
          <CompetitionStatsBox competition={selectedCompetition} />
        </>
      ) : null}
    </>
  );
}


function embeddedQualifierCompetitionForDisplay(competition = {}) {
  const typeKey = competitionTypeKey(competition.type || "");
  if (typeKey === "league" && competition.leagueQualifier?.enabled) {
    const qualifier = competition.leagueQualifier || {};
    const matches = Array.isArray(qualifier.matches) ? qualifier.matches : [];
    if (!matches.length) return null;
    return {
      title: "الملحق المؤهل للدوري",
      description: "مرحلة مرتبطة بنفس نسخة الدوري، ولا تعتبر بطولة مستقلة.",
      buttonLabel: "تحميل نتائج الملحق المؤهل",
      competition: {
        ...qualifier,
        id: `${competition.id || "league"}-embedded-qualifier`,
        type: "league_qualifier",
        name: qualifier.name || `ملحق ${competition.name || "الدوري"}`,
        seasonId: competition.seasonId || qualifier.seasonId || "",
        startDate: qualifier.startDate || competition.startDate || "",
        endDate: qualifier.endDate || competition.endDate || "",
        participants: Array.isArray(qualifier.participants) ? qualifier.participants : [],
        matches,
        qualifiedMemberIds: Array.isArray(qualifier.qualifiedMemberIds) ? qualifier.qualifiedMemberIds : computeLeagueQualifierQualifiedIds({ matches, qualifiersCount: qualifier.qualifiedCount || 1 }),
        qualifiersCount: qualifier.qualifiedCount || 1,
        status: qualifier.status || competition.status || "active",
      },
    };
  }
  if (typeKey === "world_cup") {
    const matches = (competition.matches || []).filter((match) => clean(match.phase || "") === "qualification");
    if (!matches.length) return null;
    const normalizedMatches = matches.map((match, index) => ({
      ...match,
      round: toNumber(match.round) > 0 ? toNumber(match.round) : 1,
      label: match.label || `تصفيات كأس العالم - مباراة ${index + 1}`,
    }));
    return {
      title: "تصفيات كأس العالم",
      description: "مرحلة إقصائية مرتبطة بنفس نسخة كأس العالم، والمتأهلون يدخلون دور المجموعات.",
      buttonLabel: "تحميل نتائج التصفيات",
      competition: {
        ...competition,
        id: `${competition.id || "world-cup"}-qualification`,
        type: "league_qualifier",
        name: `تصفيات ${competition.name || "كأس العالم"}`,
        participants: Array.isArray(competition.participants) ? competition.participants : [],
        matches: normalizedMatches,
        qualifiersCount: normalizedMatches.length,
        qualifiedMemberIds: computeLeagueQualifierQualifiedIds({ matches: normalizedMatches, qualifiersCount: normalizedMatches.length }),
        status: competition.status || "active",
      },
    };
  }
  if (typeKey === "champions_league") {
    const qualifier = competition.qualifier || competition.championsLeagueQualifier || {};
    const embeddedMatches = Array.isArray(qualifier.matches) ? qualifier.matches : [];
    const phaseMatches = (competition.matches || []).filter((match) => ["qualification", "qualifier", "playoff"].includes(clean(match.phase || "")));
    const matches = embeddedMatches.length ? embeddedMatches : phaseMatches;
    if (!matches.length) return null;
    const normalizedMatches = matches.map((match, index) => ({
      ...match,
      round: toNumber(match.round) > 0 ? toNumber(match.round) : 1,
      label: match.label || `ملحق دوري الأبطال - مباراة ${index + 1}`,
    }));
    return {
      title: "الملحق المؤهل لدوري الأبطال",
      description: "مرحلة إقصائية مرتبطة بنفس نسخة دوري الأبطال، ولا تعتبر بطولة مستقلة.",
      buttonLabel: "تحميل نتائج الملحق المؤهل",
      competition: {
        ...qualifier,
        id: `${competition.id || "champions-league"}-qualifier`,
        type: "league_qualifier",
        name: qualifier.name || `ملحق ${competition.name || "دوري الأبطال"}`,
        seasonId: competition.seasonId || qualifier.seasonId || "",
        startDate: qualifier.startDate || competition.startDate || "",
        endDate: qualifier.endDate || competition.endDate || "",
        participants: Array.isArray(qualifier.participants) ? qualifier.participants : (Array.isArray(competition.participants) ? competition.participants : []),
        matches: normalizedMatches,
        qualifiersCount: qualifier.qualifiedCount || normalizedMatches.length,
        qualifiedMemberIds: Array.isArray(qualifier.qualifiedMemberIds) ? qualifier.qualifiedMemberIds : computeLeagueQualifierQualifiedIds({ matches: normalizedMatches, qualifiersCount: qualifier.qualifiedCount || normalizedMatches.length }),
        status: qualifier.status || competition.status || "active",
      },
    };
  }
  return null;
}

function EmbeddedQualifierSection({ competition = {}, config = {}, trophyMap = {} }) {
  const info = embeddedQualifierCompetitionForDisplay(competition);
  if (!info?.competition) return null;
  return (
    <section className="sectionBox glassSoft leagueQualifierInlineSection">
      <div className="sectionHead compact">
        <div><h3>{info.title}</h3><p>{info.description}</p></div>
        <button type="button" className="miniDownloadBtn" onClick={() => downloadCompetitionResultsImage(info.competition, config, trophyMap)}>{info.buttonLabel}</button>
      </div>
      <QualifierBracket competition={info.competition} />
    </section>
  );
}

function LeagueQualifierSection({ qualifiers = [] }) {
  const rows = (qualifiers || []).filter(Boolean);
  if (!rows.length) return null;
  return (
    <section className="sectionBox glassSoft leagueQualifierInlineSection">
      <div className="sectionHead compact"><div><h3>الملحق المؤهل للدوري</h3></div></div>
      <div className="leagueQualifierList">
        {rows.map((competition) => (
          <article className="leagueQualifierCard" key={competition.id || competition.name}>
            <div className="leagueQualifierTitle">
              <b>{competition.name || "ملحق الدوري"}</b>
              <small>{competitionStatusLabel(competition.status)}{competition.startDate ? ` • ${competition.startDate}` : ""}</small>
            </div>
            <QualifierBracket competition={competition} />
          </article>
        ))}
      </div>
    </section>
  );
}

function worldCupAdminRoundTitle(match = {}, fallbackRound = "") {
  const phase = clean(match.phase || "");
  if (phase === "qualification") return "تصفيات كأس العالم";
  if (phase === "group") return "مباريات المجموعة " + (match.groupName || groupLetterName(Math.max(0, toNumber(match.round) - 1)));
  if (phase === "semifinal") return "مباريات نصف النهائي";
  if (phase === "third_place") return "مباراة تحديد الثالث";
  if (phase === "final") return "المباراة النهائية";
  return match.label || (fallbackRound ? "الجولة " + fallbackRound : "المباريات");
}

function WorldCupGroupsSection({ competition = {}, config = {}, trophyMap = {} }) {
  const groups = worldCupGroupRows(competition || {});
  const qualifiedIds = computeWorldCupQualifiedIds(competition || {});
  return (
    <section className="sectionBox glassSoft worldCupGroupsSection">
      <div className="sectionHead compact"><div><h3>مجموعات كأس العالم</h3><p>يتأهل أول كل مجموعة + أفضل ثاني إلى الأدوار الإقصائية.</p></div><button type="button" className="miniDownloadBtn" onClick={() => downloadCompetitionStandingsImage(competition, config, trophyMap)}>تحميل ترتيب المجموعات</button></div>
      <div className="worldCupGroupsGrid">
        {groups.map((group) => (
          <article className="worldCupGroupCard" key={group.groupKey}>
            <h4>المجموعة {group.groupName}</h4>
            {group.participants.length < 3 ? <p className="worldCupByeNote">راحة / BYE: {3 - group.participants.length} مقعد</p> : null}
            <div className="leagueTable miniWorldCupTable">
              <div className="leagueTableHead"><span>#</span><span>العضو</span><span>لعب</span><span>له</span><span>عليه</span><span>فارق</span><span>نقاط</span></div>
              {(group.standings || []).map((row, index) => (
                <div key={row.memberId} className={qualifiedIds.some((id) => same(id, row.memberId)) ? "leagueTableRow qualified" : "leagueTableRow"}>
                  <span>{index + 1}</span><span>{row.memberName}</span><span>{row.played}</span><span>{row.goalsFor}</span><span>{row.goalsAgainst}</span><span>{row.goalDifference}</span><b>{row.points}</b>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function ChampionsLeagueGroupsSection({ competition = {}, config = {}, trophyMap = {} }) {
  const groups = championsLeagueGroupRows(competition || {});
  const leagueGroupsMode = isLeagueGroupsCompetition(competition);
  const sectionTitle = leagueGroupsMode ? "مجموعات الدوري" : "مجموعات دوري الأبطال";
  return (
    <section className="sectionBox glassSoft worldCupGroupsSection championsLeagueGroupsSection">
      <div className="sectionHead compact"><div><h3>{sectionTitle}</h3><p>يتأهل الأول والثاني من كل مجموعة إلى نصف النهائي.</p></div><button type="button" className="miniDownloadBtn" onClick={() => downloadCompetitionStandingsImage(competition, config, trophyMap)}>تحميل ترتيب المجموعات</button></div>
      <div className="worldCupGroupsGrid championsLeagueGroupsGrid">
        {groups.map((group) => (
          <article className="worldCupGroupCard" key={group.groupKey}>
            <h4>المجموعة {group.groupName}</h4>
            {group.participants.length < 4 ? <p className="worldCupByeNote">راحة / BYE: {4 - group.participants.length} مقعد</p> : null}
            <div className="leagueTable miniWorldCupTable">
              <div className="leagueTableHead"><span>#</span><span>العضو</span><span>لعب</span><span>له</span><span>عليه</span><span>فارق</span><span>نقاط</span></div>
              {(group.standings || []).map((row, index) => (
                <div key={row.memberId} className={index < 2 ? "leagueTableRow qualified" : "leagueTableRow"}>
                  <span>{index + 1}</span><span>{row.memberName}</span><span>{row.played}</span><span>{row.goalsFor}</span><span>{row.goalsAgainst}</span><span>{row.goalDifference}</span><b>{row.points}</b>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function KnockoutBracketSection({ competition = {}, title = "الأدوار الإقصائية" }) {
  if (!competition) return null;
  return (
    <section className="sectionBox glassSoft leagueQualifierInlineSection">
      <div className="sectionHead compact"><div><h3>{title}</h3><p>{competitionTypeLabel(competition.type)} ضمن الأدوار الإقصائية.</p></div></div>
      <QualifierBracket competition={competition} />
    </section>
  );
}


function championsLeagueKnockoutColumns(competition = {}) {
  const knockoutMatches = (competition.matches || []).filter((match) => !["group", "qualification"].includes(clean(match.phase)));
  const semifinals = knockoutMatches.filter((match) => clean(match.phase) === "semifinal");
  const finalMatch = knockoutMatches.filter((match) => clean(match.phase) === "final");
  const thirdPlace = knockoutMatches.filter((match) => clean(match.phase) === "third_place");
  return [
    { key: "semifinal", title: "مباريات نصف النهائي", className: "semifinalColumn", matches: semifinals },
    { key: "third_place", title: "مباراة تحديد الثالث", className: "thirdPlaceColumn", matches: thirdPlace },
    { key: "final", title: "المباراة النهائية", className: "finalColumn", matches: finalMatch },
  ].filter((column) => column.matches.length);
}

function worldCupKnockoutColumns(competition = {}) {
  const knockoutMatches = (competition.matches || []).filter((match) => clean(match.phase) !== "group");
  const semifinals = knockoutMatches.filter((match) => clean(match.phase) === "semifinal");
  const finalMatch = knockoutMatches.filter((match) => clean(match.phase) === "final");
  const thirdPlace = knockoutMatches.filter((match) => clean(match.phase) === "third_place");
  return [
    { key: "semifinal", title: "مباريات نصف النهائي", className: "semifinalColumn", matches: semifinals },
    { key: "third_place", title: "مباراة تحديد الثالث", className: "thirdPlaceColumn", matches: thirdPlace },
    { key: "final", title: "المباراة النهائية", className: "finalColumn", matches: finalMatch },
  ].filter((column) => column.matches.length);
}

function QualifierBracket({ competition = {} }) {
  const typeKey = competitionTypeKey(competition.type || "");
  const leagueGroupsMode = isLeagueGroupsCompetition(competition);
  const qualifiedIds = typeKey === "league_qualifier" ? (competition.qualifiedMemberIds || computeLeagueQualifierQualifiedIds(competition)) : [];
  if (["world_cup", "champions_league"].includes(typeKey) || leagueGroupsMode) {
    const columns = (typeKey === "champions_league" || leagueGroupsMode) ? championsLeagueKnockoutColumns(competition) : worldCupKnockoutColumns(competition);
    return (
      <div className={(typeKey === "champions_league" || leagueGroupsMode) ? "qualifierBracket cupRoadBracket worldCupRoadBracket championsLeagueRoadBracket" : "qualifierBracket cupRoadBracket worldCupRoadBracket"}>
        <div className="qualifierBracketRounds worldCupKnockoutSeparatedRounds">
          {columns.map((column) => (
            <div className={`qualifierBracketRound ${column.className || ""} ${column.key === "final" ? "finalRound" : ""}`} key={column.key}>
              <h4>{column.title}</h4>
              <div className="cupRoundMatchesStack">
                {column.matches.map((match) => (
                  <ReadonlyLeagueMatch key={match.id} match={match} isFinalRound={column.key === "final"} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  const bracketMatches = typeKey === "world_cup"
    ? (competition.matches || []).filter((match) => clean(match.phase) !== "group").map((match) => ({ ...match, round: clean(match.phase) === "semifinal" ? 1 : 2 }))
    : (competition.matches || []);
  const grouped = groupLeagueMatchesByRound(bracketMatches);
  return (
    <div className={typeKey === "cup" ? "qualifierBracket cupRoadBracket" : typeKey === "super_cup" ? "qualifierBracket superCupFinalRoad" : typeKey === "world_cup" ? "qualifierBracket cupRoadBracket worldCupRoadBracket" : "qualifierBracket"}>
      <div className="qualifierBracketRounds">
        {grouped.map((round) => {
          const isFinalRound = round.round === grouped.length;
          return (
            <div className={isFinalRound ? "qualifierBracketRound finalRound" : "qualifierBracketRound"} key={round.round}>
              <h4>{roundLabelForBracket(round.round, grouped.length)}</h4>
              <div className="cupRoundMatchesStack">
                {round.matches.map((match) => (
                  <ReadonlyLeagueMatch key={match.id} match={match} isFinalRound={isFinalRound} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {qualifiedIds.length ? (
        <div className="qualifierQualifiedBox">
          <span>المتأهلون</span>
          <b>{qualifiedIds.map((id) => getMemberName(competition.participants || [], id) || id).join("، ")}</b>
        </div>
      ) : null}
    </div>
  );
}

function ReadonlyLeagueMatch({ match, isFinalRound = false }) {
  const completed = clean(match.resultStatus || match.status) === "completed";
  const hasPens = completed && match.homePens !== null && match.homePens !== undefined && match.awayPens !== null && match.awayPens !== undefined;
  const scoreText = completed ? `${match.homeGoals} - ${match.awayGoals}` : "-";
  const pensText = hasPens ? `ترجيح ${match.homePens} - ${match.awayPens}` : "";
  const winnerName = clean(match.winnerName || "");
  return (
    <article className={completed ? `readonlyLeagueMatch compactResultMatch completed${isFinalRound ? " finalRoundMatch" : ""}` : `readonlyLeagueMatch compactResultMatch${isFinalRound ? " finalRoundMatch" : ""}`}>
      <b className={same(winnerName, match.homeName) ? "compactTeamName home winnerTeam" : "compactTeamName home"}>{match.homeName || "-"}</b>
      <div className="compactMatchCenter">
        <strong>{scoreText}</strong>
        <small>{match.gameTitle || "PES 2017"}{pensText ? ` • ${pensText}` : ""}</small>
      </div>
      <b className={same(winnerName, match.awayName) ? "compactTeamName away winnerTeam" : "compactTeamName away"}>{match.awayName || "-"}</b>
      <span className={completed && winnerName ? "compactMatchStatus winnerStatus" : "compactMatchStatus"}>{completed && winnerName ? `الفائز: ${winnerName}` : completed ? "مكتملة" : "بانتظار النتيجة"}</span>
    </article>
  );
}

function FifaLeagueAdminPage({ members = [], seasons = [], activeSeasonId = "S6", competitions = [], trophyMap = {}, config = {}, onCreateLeague, onUpdateMatchResult, onClearMatchResult, onFinalizeLeague, onCancelCompetition }) {
  const activeMembers = getActiveMembers(members);
  const competitionRows = (competitions || [])
    .filter((item) => ["league", "league_qualifier", "cup", "super_cup", "world_cup", "champions_league"].includes(competitionTypeKey(item.type || "league")))
    .sort((a, b) => competitionTimeValue(b) - competitionTimeValue(a));
  const [selectedCompetitionId, setSelectedCompetitionId] = useState(competitionRows[0]?.id || "");
  const selectedCompetition = competitionRows.find((item) => same(item.id, selectedCompetitionId)) || competitionRows[0] || null;
  const [competitionType, setCompetitionType] = useState("league");
  const [leagueName, setLeagueName] = useState("دوري الموسم");
  const [leagueSeasonId, setLeagueSeasonId] = useState(activeSeasonId || "S6");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState("");
  const [roundsMode, setRoundsMode] = useState("single");
  const [leagueFormat, setLeagueFormat] = useState("single_group");
  const leagueTwoGroupsEnabled = competitionType === "league" && leagueFormat === "two_groups";
  const [onlineMemberId, setOnlineMemberId] = useState("");
  const [fifaQuotaPerMember, setFifaQuotaPerMember] = useState("2");
  const [gameDistributionMode, setGameDistributionMode] = useState("auto");
  const [fifa2025MatchCount, setFifa2025MatchCount] = useState("2");
  const [qualifiersCount, setQualifiersCount] = useState("1");
  const [leagueQualifierEnabled, setLeagueQualifierEnabled] = useState(false);
  const [leagueQualifierParticipantIds, setLeagueQualifierParticipantIds] = useState([]);
  const [leagueQualifierQualifiedCount, setLeagueQualifierQualifiedCount] = useState("1");
  const [rewardFirst, setRewardFirst] = useState("20000000");
  const [rewardSecond, setRewardSecond] = useState("10000000");
  const [rewardThird, setRewardThird] = useState("5000000");
  const [rewardFourth, setRewardFourth] = useState("");
  const [autoPayRewards, setAutoPayRewards] = useState(false);
  const [participantIds, setParticipantIds] = useState([]);
  const [manualSeedMap, setManualSeedMap] = useState({});
  const [worldCupQualifiersEnabled, setWorldCupQualifiersEnabled] = useState(false);
  const [championsLeagueQualifiersEnabled, setChampionsLeagueQualifiersEnabled] = useState(false);
  const [resultInputs, setResultInputs] = useState({});
  const [relegatedIds, setRelegatedIds] = useState([]);
  const [absentIds, setAbsentIds] = useState([]);
  const [cancelReason, setCancelReason] = useState("حذف إداري بسبب خطأ في إنشاء البطولة");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!participantIds.length && activeMembers.length) setParticipantIds(activeMembers.map((member) => cleanId(member.id)).filter(Boolean));
  }, [activeMembers.length]);
  useEffect(() => {
    setManualSeedMap((current) => {
      const next = { ...current };
      participantIds.forEach((id, index) => {
        const safeId = cleanId(id);
        if (safeId && !next[safeId]) next[safeId] = String(index + 1);
      });
      Object.keys(next).forEach((id) => {
        if (!participantIds.some((item) => same(item, id))) delete next[id];
      });
      return next;
    });
  }, [participantIds.join("|")]);
  useEffect(() => {
    if (!selectedCompetitionId && competitionRows[0]?.id) setSelectedCompetitionId(competitionRows[0].id);
  }, [competitionRows.length, selectedCompetitionId]);
  useEffect(() => {
    if (selectedCompetition) {
      setRelegatedIds(Array.isArray(selectedCompetition.relegatedMemberIds) ? selectedCompetition.relegatedMemberIds : []);
      setAbsentIds(Array.isArray(selectedCompetition.absentMemberIds) ? selectedCompetition.absentMemberIds : []);
    }
  }, [selectedCompetition?.id]);

  const selectedTypeKey = competitionTypeKey(selectedCompetition?.type || "league");
  const selectedLeagueGroupsMode = selectedCompetition ? isLeagueGroupsCompetition(selectedCompetition) : false;
  const selectedIsLeague = selectedTypeKey === "league" && !selectedLeagueGroupsMode;
  const selectedIsAnyLeague = selectedTypeKey === "league";
  const selectedMatches = Array.isArray(selectedCompetition?.matches) ? selectedCompetition.matches : [];
  const embeddedLeagueQualifierMatches = selectedTypeKey === "league" && !selectedLeagueGroupsMode && selectedCompetition?.leagueQualifier?.enabled ? (selectedCompetition.leagueQualifier.matches || []).map((match) => ({ ...match, scope: "league_qualifier" })) : [];
  const selectedStandings = useMemo(() => {
    if (!selectedCompetition || !selectedIsLeague) return [];
    return computeLeagueStandings(selectedCompetition.participants || [], selectedCompetition.matches || []);
  }, [selectedCompetition, selectedIsLeague]);
  const selectedRelegationRows = selectedIsLeague ? selectedStandings : selectedIsAnyLeague ? (selectedCompetition?.participants || []) : [];
  const groupedMatches = groupLeagueMatchesByRound([...embeddedLeagueQualifierMatches, ...selectedMatches]);
  const completedCount = selectedMatches.filter((match) => clean(match.resultStatus || match.status) === "completed").length;
  const qualifiedIds = !selectedIsLeague && selectedCompetition ? (selectedTypeKey === "league_qualifier" ? computeLeagueQualifierQualifiedIds(selectedCompetition) : computeKnockoutQualifiedIds(selectedCompetition)) : [];

  function toggleParticipant(id) {
    const safeId = cleanId(id);
    setParticipantIds((current) => current.some((item) => same(item, safeId)) ? current.filter((item) => !same(item, safeId)) : [...current, safeId]);
  }
  function toggleLeagueQualifierParticipant(id) {
    const safeId = cleanId(id);
    setLeagueQualifierParticipantIds((current) => current.some((item) => same(item, safeId)) ? current.filter((item) => !same(item, safeId)) : [...current, safeId]);
  }
  function updateManualSeed(memberId, seed) {
    const safeId = cleanId(memberId);
    setManualSeedMap((current) => ({ ...current, [safeId]: String(seed || "") }));
  }
  function toggleRelegated(id) {
    const safeId = cleanId(id);
    setRelegatedIds((current) => current.some((item) => same(item, safeId)) ? current.filter((item) => !same(item, safeId)) : [...current, safeId]);
  }
  function toggleAbsent(id) {
    const safeId = cleanId(id);
    setAbsentIds((current) => current.some((item) => same(item, safeId)) ? current.filter((item) => !same(item, safeId)) : [...current, safeId]);
  }

  async function submitCreateCompetition(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setMessage("");
    try {
      await onCreateLeague?.({
        competitionType,
        name: leagueName,
        seasonId: leagueSeasonId,
        startDate,
        endDate,
        roundsMode,
        leagueFormat,
        onlineMemberId,
        fifaQuotaPerMember,
        maxFifaPerRound: fifaQuotaPerMember,
        gameDistributionMode,
        fifa2025MatchCount,
        qualifiersCount,
        worldCupQualifiersEnabled,
        championsLeagueQualifiersEnabled,
        leagueQualifierEnabled,
        leagueQualifierParticipantIds,
        leagueQualifierQualifiedCount,
        participantIds,
        manualSeeds: manualSeedMap,
        rewards: { first: rewardFirst, second: rewardSecond, third: rewardThird, fourth: rewardFourth },
        autoPayRewards,
      });
      setMessage(competitionType === "league_qualifier" ? "تم إنشاء ملحق الدوري بنجاح." : competitionType === "cup" ? "تم إنشاء بطولة الكأس وبناء الأدوار الإقصائية." : competitionType === "super_cup" ? "تم إنشاء كأس السوبر كمباراة نهائية واحدة." : competitionType === "world_cup" ? "تم إنشاء كأس العالم بنظام 3 مجموعات ثم الأدوار الإقصائية." : competitionType === "champions_league" ? "تم إنشاء دوري الأبطال بنظام مجموعتين ثم الأدوار الإقصائية." : leagueTwoGroupsEnabled ? "تم إنشاء الدوري بنظام مجموعتين ثم الأدوار الإقصائية." : leagueQualifierEnabled ? "تم إنشاء الدوري مع ملحق مؤهل مرتبط بنفس النسخة." : "تم إنشاء الدوري وجدولة المباريات بنجاح.");
    } catch (err) { setMessage(err?.message || "تعذر إنشاء البطولة."); }
    finally { setBusy(false); }
  }

  async function submitMatchResult(match) {
    if (!selectedCompetition || busy) return;
    const values = resultInputs[match.id] || {};
    const homeGoals = values.homeGoals ?? (clean(match.resultStatus || match.status) === "completed" ? match.homeGoals : "");
    const awayGoals = values.awayGoals ?? (clean(match.resultStatus || match.status) === "completed" ? match.awayGoals : "");
    const homePens = values.homePens ?? (clean(match.resultStatus || match.status) === "completed" ? match.homePens : "");
    const awayPens = values.awayPens ?? (clean(match.resultStatus || match.status) === "completed" ? match.awayPens : "");
    setBusy(true); setMessage("");
    try {
      await onUpdateMatchResult?.({ competitionId: selectedCompetition.id, matchId: match.id, homeGoals, awayGoals, homePens, awayPens, gameTitle: values.gameTitle ?? match.gameTitle });
      setMessage("تم حفظ النتيجة وتحديث البيانات.");
    } catch (err) { setMessage(err?.message || "تعذر حفظ النتيجة."); }
    finally { setBusy(false); }
  }

  async function submitClearMatchResult(match) {
    if (!selectedCompetition || busy) return;
    if (typeof window !== "undefined" && !window.confirm("حذف نتيجة هذه المباراة وإعادتها إلى انتظار النتيجة؟")) return;
    setBusy(true); setMessage("");
    try {
      await onClearMatchResult?.({ competitionId: selectedCompetition.id, matchId: match.id });
      setResultInputs((current) => ({ ...current, [match.id]: { ...(current[match.id] || {}), homeGoals: "", awayGoals: "", homePens: "", awayPens: "" } }));
      setMessage("تم حذف النتيجة وتحديث الترتيب.");
    } catch (err) { setMessage(err?.message || "تعذر حذف النتيجة."); }
    finally { setBusy(false); }
  }

  async function submitFinalizeCompetition() {
    if (!selectedCompetition || busy) return;
    setBusy(true); setMessage("");
    try {
      await onFinalizeLeague?.({ competitionId: selectedCompetition.id, relegatedMemberIds: relegatedIds, absentMemberIds: absentIds });
      setMessage(clean(selectedCompetition.status) === "completed" && ["cup", "super_cup"].includes(selectedTypeKey) ? "تم إعادة اعتماد البطولة وتصحيح المكافآت حسب النتائج الحالية." : "تم اعتماد البطولة وأرشفتها داخل البطولات التنافسية.");
    } catch (err) { setMessage(err?.message || "تعذر اعتماد البطولة."); }
    finally { setBusy(false); }
  }

  async function submitCancelCompetition() {
    if (!selectedCompetition || busy) return;
    setBusy(true); setMessage("");
    try {
      await onCancelCompetition?.({ competitionId: selectedCompetition.id, reason: cancelReason });
      setMessage("تم حذف البطولة نهائيًا مع حفظ أثر القرار في سجل FIFA.");
    } catch (err) { setMessage(err?.message || "تعذر حذف البطولة."); }
    finally { setBusy(false); }
  }

  return (
    <main className="pageShell fifaAdminShell leagueAdminShell">
      <section className="sectionBox glassSoft fifaAdminHero">
        <div><span className="heroKicker">FIFA ADMIN</span><h2>إدارة البطولات التنافسية</h2></div><strong>🏟️</strong>
      </section>
      {message ? <div className="adminMessage glassSoft">{message}</div> : null}

      <section className="adminGrid">
        <form className="sectionBox glassSoft adminForm" onSubmit={submitCreateCompetition}>
          <div className="sectionHead compact"><div><h3>إنشاء بطولة</h3></div></div>
          <label className="moneyField"><span>نوع البطولة</span><select value={competitionType} onChange={(event) => setCompetitionType(event.target.value)}><option value="league">دوري</option><option value="cup">الكأس</option><option value="super_cup">كأس السوبر</option><option value="world_cup">كأس العالم</option><option value="champions_league">دوري الأبطال</option></select></label>
          <label className="moneyField"><span>اسم البطولة</span><input value={leagueName} onChange={(event) => setLeagueName(event.target.value)} placeholder={competitionType === "league_qualifier" ? "مثال: ملحق الدوري" : competitionType === "cup" ? "مثال: كأس الموسم السادس" : competitionType === "super_cup" ? "مثال: كأس السوبر" : competitionType === "world_cup" ? "مثال: كأس العالم" : competitionType === "champions_league" ? "مثال: دوري الأبطال" : "مثال: دوري الموسم السادس"} /></label>
          <label className="moneyField"><span>الموسم</span><select value={leagueSeasonId} onChange={(event) => setLeagueSeasonId(event.target.value)}>{(seasons || []).length ? seasons.map((season) => <option key={season.id || season.seasonId || season.name} value={season.id || season.seasonId || activeSeasonId}>{season.name || season.title || season.id || activeSeasonId}</option>) : <option value={activeSeasonId}>{activeSeasonId}</option>}</select></label>
          {competitionType !== "league" ? <><label className="moneyField"><span>نظام اللعبة للمباريات</span><select value={gameDistributionMode} onChange={(event) => setGameDistributionMode(event.target.value)}><option value="auto">توزيع تلقائي حسب عضو الأونلاين</option><option value="fifa2025_only">كل المباريات FIFA 2025</option><option value="pes2017_only">كل المباريات PES 2017</option><option value="mixed_manual">مكس يدوي بين FIFA 2025 و PES 2017</option></select></label>{gameDistributionMode === "auto" ? <><label className="moneyField"><span>عضو الأونلاين / FIFA 2025</span><select value={onlineMemberId} onChange={(event) => setOnlineMemberId(event.target.value)}><option value="">تلقائي حسب عبد الله</option>{activeMembers.map((member) => <option key={member.id} value={member.id}>{member.name || member.id}</option>)}</select></label><label className="moneyField"><span>عدد مباريات FIFA 2025 في كل جولة</span><input inputMode="numeric" value={fifaQuotaPerMember} onChange={(event) => setFifaQuotaPerMember(event.target.value)} placeholder="2" /></label></> : null}{gameDistributionMode === "mixed_manual" ? <label className="moneyField"><span>عدد مباريات FIFA 2025 في البطولة</span><input inputMode="numeric" value={fifa2025MatchCount} onChange={(event) => setFifa2025MatchCount(event.target.value)} placeholder="مثال: 4" /></label> : null}<div className="leagueRuleNote">{gameDistributionMode === "fifa2025_only" ? "سيتم إنشاء كل المباريات على FIFA 2025." : gameDistributionMode === "pes2017_only" ? "سيتم إنشاء كل المباريات على PES 2017." : gameDistributionMode === "mixed_manual" ? "سيتم توزيع عدد مباريات FIFA 2025 الذي تحدده، والباقي PES 2017." : "توزيع اللعبة تلقائي حسب عضو الأونلاين ثم التوزيع العادل."}</div></> : null}
          <div className="leagueRewardGrid"><label className="moneyField"><span>تاريخ البداية</span><input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label><label className="moneyField"><span>تاريخ النهاية</span><input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label></div>
          {competitionType === "league" ? <>
            <div className="leagueRuleNote">الدوري يعمل بنظامك المستقر. يمكن إضافة ملحق مؤهل داخل نفس نسخة الدوري، وليس كبطولة مستقلة.</div>
            <label className="moneyField"><span>شكل الدوري</span><select value={leagueFormat} onChange={(event) => { setLeagueFormat(event.target.value); if (event.target.value === "two_groups") { setRoundsMode("single"); setLeagueQualifierEnabled(false); } }}><option value="single_group">مجموعة واحدة</option><option value="two_groups">مجموعتان + أدوار إقصائية</option></select></label>
            {!leagueTwoGroupsEnabled ? <label className="moneyField"><span>نظام الدوري</span><select value={roundsMode} onChange={(event) => setRoundsMode(event.target.value)}><option value="single">ذهاب فقط</option><option value="double">ذهاب وإياب</option></select></label> : <div className="leagueRuleNote">في نظام المجموعتين، التصنيف يصبح مستويات ويمكن تكراره، ويتم توزيع أعضاء كل مستوى على المجموعتين بالقرعة قدر الإمكان.</div>}
            <label className="moneyField"><span>نظام اللعبة للمباريات</span><select value={gameDistributionMode} onChange={(event) => setGameDistributionMode(event.target.value)}><option value="auto">توزيع تلقائي حسب عضو الأونلاين</option><option value="fifa2025_only">كل المباريات FIFA 2025</option><option value="pes2017_only">كل المباريات PES 2017</option><option value="mixed_manual">مكس يدوي بين FIFA 2025 و PES 2017</option></select></label>
            {gameDistributionMode === "auto" ? <><label className="moneyField"><span>عضو الأونلاين / FIFA 2025</span><select value={onlineMemberId} onChange={(event) => setOnlineMemberId(event.target.value)}><option value="">تلقائي حسب عبد الله</option>{activeMembers.map((member) => <option key={member.id} value={member.id}>{member.name || member.id}</option>)}</select></label><label className="moneyField"><span>عدد مباريات FIFA 2025 في كل جولة</span><input inputMode="numeric" value={fifaQuotaPerMember} onChange={(event) => setFifaQuotaPerMember(event.target.value)} placeholder="2" /></label></> : null}
            {gameDistributionMode === "mixed_manual" ? <label className="moneyField"><span>عدد مباريات FIFA 2025 في البطولة</span><input inputMode="numeric" value={fifa2025MatchCount} onChange={(event) => setFifa2025MatchCount(event.target.value)} placeholder="مثال: 4" /></label> : null}
            {competitionType === "league" && !leagueTwoGroupsEnabled ? <><label className="adminCheckLine"><input type="checkbox" checked={leagueQualifierEnabled} onChange={(event) => setLeagueQualifierEnabled(event.target.checked)} /><span>إضافة ملحق مؤهل مرتبط بنفس نسخة الدوري</span></label>
            {leagueQualifierEnabled ? <div className="sectionBox glassSoft"><div className="sectionHead compact"><div><h3>ملحق الدوري داخل نفس النسخة</h3><p>المشاركون المختارون في قائمة البطولة هم المشاركون المباشرون في الدوري. اختر هنا أعضاء الملحق فقط، وحدد عدد المتأهلين منهم إلى نفس نسخة الدوري.</p></div></div><label className="moneyField"><span>عدد المتأهلين من الملحق</span><select value={leagueQualifierQualifiedCount} onChange={(event) => setLeagueQualifierQualifiedCount(event.target.value)}><option value="1">متأهل واحد</option><option value="2">متأهلان</option><option value="3">3 متأهلين</option><option value="4">4 متأهلين</option></select></label><div className="leagueMembersGrid compact">{activeMembers.map((member) => <label key={`lq-${member.id}`} className={leagueQualifierParticipantIds.some((id) => same(id, member.id)) ? "leagueMemberPick active" : "leagueMemberPick"}><input type="checkbox" checked={leagueQualifierParticipantIds.some((id) => same(id, member.id))} onChange={() => toggleLeagueQualifierParticipant(member.id)} /><span>{member.name}</span></label>)}</div><div className="leagueRuleNote">لا يظهر الملحق كبطولة مستقلة، ولا يوجد بطل للملحق. الإشعار يكون للمتأهل/المتأهلين فقط.</div></div> : null}</> : null}
          </> : competitionType === "league_qualifier" ? <label className="moneyField"><span>عدد المتأهلين من الملحق</span><select value={qualifiersCount} onChange={(event) => setQualifiersCount(event.target.value)}><option value="1">متأهل واحد</option><option value="2">متأهلان</option></select></label> : competitionType === "super_cup" ? <div className="leagueRuleNote">كأس السوبر مباراة نهائية واحدة فقط. اختر عضوين يدويًا، والمكافآت للبطل والوصيف فقط.</div> : competitionType === "world_cup" ? <><div className="leagueRuleNote">كأس العالم الأساسي: حتى 9 أعضاء في 3 مجموعات. إذا زاد العدد عن 9 فعّل التصفيات داخل نفس النسخة، والتصفيات تكون إقصائية عشوائية لتأهيل 9 أعضاء لدور المجموعات.</div><label className="adminCheckLine"><input type="checkbox" checked={worldCupQualifiersEnabled} onChange={(event) => setWorldCupQualifiersEnabled(event.target.checked)} /><span>تشغيل تصفيات كأس العالم عند اختيار أكثر من 9 أعضاء</span></label></> : competitionType === "champions_league" ? <><div className="leagueRuleNote">دوري الأبطال: حتى 8 أعضاء في مجموعتين، ويتأهل الأول والثاني من كل مجموعة إلى نصف النهائي. إذا زاد العدد عن 8 فعّل الملحق داخل نفس النسخة.</div><label className="adminCheckLine"><input type="checkbox" checked={championsLeagueQualifiersEnabled} onChange={(event) => setChampionsLeagueQualifiersEnabled(event.target.checked)} /><span>تشغيل ملحق دوري الأبطال عند اختيار أكثر من 8 أعضاء</span></label></> : <div className="leagueRuleNote">الكأس بطولة إقصائية كاملة: 1 × 8، 2 × 7، 3 × 6، 4 × 5، ثم فائز 1/8 ضد فائز 4/5، وفائز 2/7 ضد فائز 3/6.</div>}
          <div className="leagueRewardGrid">
            <label className="moneyField"><span>مكافأة البطل</span><input inputMode="numeric" value={rewardFirst} onChange={(event) => setRewardFirst(event.target.value)} /></label>
            <label className="moneyField"><span>مكافأة الوصيف</span><input inputMode="numeric" value={rewardSecond} onChange={(event) => setRewardSecond(event.target.value)} /></label>
            {competitionType !== "super_cup" ? <label className="moneyField"><span>مكافأة الثالث</span><input inputMode="numeric" value={rewardThird} onChange={(event) => setRewardThird(event.target.value)} /></label> : null}
            {competitionType !== "super_cup" ? <label className="moneyField"><span>مكافأة الرابع</span><input inputMode="numeric" value={rewardFourth} onChange={(event) => setRewardFourth(event.target.value)} /></label> : null}
          </div>
          {["league", "cup", "super_cup", "world_cup", "champions_league"].includes(competitionType) ? <label className="adminCheckLine"><input type="checkbox" checked={autoPayRewards} onChange={(event) => setAutoPayRewards(event.target.checked)} /><span>{competitionType === "super_cup" ? "صرف مكافآت كأس السوبر تلقائيًا للبطل والوصيف عند الاعتماد" : competitionType === "world_cup" ? "صرف مكافآت كأس العالم تلقائيًا عند اعتماد النتائج" : competitionType === "champions_league" ? "صرف مكافآت دوري الأبطال تلقائيًا عند اعتماد النتائج" : competitionType === "cup" ? "صرف مكافآت الكأس تلقائيًا عند اعتماد النتائج" : "صرف المكافآت تلقائيًا عند اعتماد الدوري"}</span></label> : null}
          {competitionType === "league" ? <div className="leagueRuleNote">{gameDistributionMode === "fifa2025_only" ? "سيتم إنشاء كل مباريات الدوري على FIFA 2025." : gameDistributionMode === "pes2017_only" ? "سيتم إنشاء كل مباريات الدوري على PES 2017." : gameDistributionMode === "mixed_manual" ? "سيتم توزيع عدد مباريات FIFA 2025 الذي تحدده، والباقي PES 2017." : "توزيع اللعبة تلقائي: مباريات عضو الأونلاين على FIFA 2025، والباقي حسب التوزيع العادل."}</div> : null}
          <div className="leagueMembersGrid">{activeMembers.map((member) => <label key={member.id} className={participantIds.some((id) => same(id, member.id)) ? "leagueMemberPick active" : "leagueMemberPick"}><input type="checkbox" checked={participantIds.some((id) => same(id, member.id))} onChange={() => toggleParticipant(member.id)} /><img src={member.avatar || avatar(member.name)} alt="" /><span>{member.name || member.id}</span></label>)}</div>
          {["league", "cup", "world_cup", "champions_league"].includes(competitionType) ? <div className="leagueSeedGrid"><h4 className="dealSectionTitle">{competitionType === "league" ? "تصنيف الدوري اليدوي" : competitionType === "world_cup" ? "تصنيف كأس العالم اليدوي" : competitionType === "champions_league" ? "تصنيف دوري الأبطال اليدوي" : "تصنيف الكأس اليدوي"}</h4>{participantIds.map((memberId, index) => { const member = activeMembers.find((item) => same(item.id, memberId)); const maxSeed = competitionType === "cup" ? 8 : Math.max(1, participantIds.length); return <label key={memberId} className="moneyField"><span>{member?.name || memberId}</span><select value={manualSeedMap[cleanId(memberId)] || String(index + 1)} onChange={(event) => updateManualSeed(memberId, event.target.value)}>{Array.from({ length: maxSeed }, (_, i) => i + 1).map((seed) => <option key={seed} value={seed}>تصنيف {seed}</option>)}</select></label>; })}</div> : null}
          <button className="moneySubmitBtn" type="submit" disabled={busy}>{busy ? "جارٍ التنفيذ..." : "إنشاء البطولة"}</button>
        </form>

        <section className="sectionBox glassSoft adminRecentBox">
          <div className="sectionHead compact"><div><h3>البطولات المحفوظة</h3><p>{competitionRows.length ? `${competitionRows.length} بطولة` : "لا توجد بطولات بعد"}</p></div></div>
          <div className="competitionInstanceList adminCompetitionInstanceList">{competitionRows.length ? competitionRows.map((competition) => <button type="button" key={competition.id} className={same(selectedCompetition?.id, competition.id) ? "competitionInstanceCard active" : "competitionInstanceCard"} onClick={() => setSelectedCompetitionId(competition.id)}><CompetitionIcon competition={competition} config={config} trophyMap={trophyMap} className="competitionInstanceIcon" /><div><b>{competition.name || competitionTypeLabel(competition.type)}</b><small>{competitionTypeLabel(competition.type)} • {competitionStatusLabel(competition.status)}</small></div></button>) : <div className="empty">أنشئ أول بطولة من النموذج.</div>}</div>
        </section>
      </section>

      {selectedCompetition ? <>
        <section className="sectionBox glassSoft">
          <div className="sectionHead compact competitionDetailHead"><CompetitionIcon competition={selectedCompetition} config={config} trophyMap={trophyMap} className="competitionDetailIcon" /><div><h3>{selectedCompetition.name}</h3><p>{competitionTypeLabel(selectedCompetition.type)} • {competitionStatusLabel(selectedCompetition.status)} {selectedCompetition.startDate ? `• ${selectedCompetition.startDate}` : ""}{selectedCompetition.endDate ? ` → ${selectedCompetition.endDate}` : ""}</p></div></div>
          <div className="leagueSummaryStrip"><span>المشاركون</span><b>{(selectedCompetition.participants || []).length}</b><span>المباريات</span><b>{selectedMatches.length}</b><span>المكتملة</span><b>{completedCount}</b><span>{selectedIsLeague || ["cup", "super_cup", "world_cup", "champions_league"].includes(selectedTypeKey) ? "البطل" : "المتأهلون"}</span><b>{selectedIsLeague ? (selectedCompetition.championMemberName || selectedStandings[0]?.memberName || "-") : ["cup", "super_cup", "world_cup", "champions_league"].includes(selectedTypeKey) ? (selectedCompetition.championMemberName || getKnockoutChampion(selectedCompetition)?.memberName || "-") : (qualifiedIds.length || "-")}</b></div>
          <div className="imageActionRow"><button type="button" onClick={() => downloadCompetitionStandingsImage(selectedCompetition, config, trophyMap)} disabled={!selectedIsLeague && !["world_cup", "champions_league"].includes(selectedTypeKey)}>{["world_cup", "champions_league"].includes(selectedTypeKey) ? "تحميل ترتيب المجموعات" : "تحميل صورة الترتيب"}</button>{(["world_cup", "champions_league"].includes(selectedTypeKey) || selectedLeagueGroupsMode) ? <button type="button" onClick={() => downloadCompetitionScheduleTableImage(selectedCompetition, config, trophyMap)}>{clean(selectedCompetition.status) === "completed" ? "تحميل نتائج المباريات" : "تحميل جدول المباريات"}</button> : null}<button type="button" onClick={() => downloadCompetitionResultsImage(selectedCompetition, config, trophyMap)}>{(["world_cup", "champions_league"].includes(selectedTypeKey) || selectedLeagueGroupsMode) ? "تحميل صورة الأدوار الإقصائية" : clean(selectedCompetition.status) === "completed" ? "تحميل نتائج المباريات" : "تحميل جدول المباريات"}</button></div>
        </section>

        {selectedTypeKey === "world_cup" ? <WorldCupGroupsSection competition={selectedCompetition} config={config} trophyMap={trophyMap} /> : (selectedTypeKey === "champions_league" || selectedLeagueGroupsMode) ? <ChampionsLeagueGroupsSection competition={selectedCompetition} config={config} trophyMap={trophyMap} /> : null}

        {selectedIsLeague ? <section className="sectionBox glassSoft"><div className="sectionHead compact"><div><h3>ترتيب الدوري</h3></div></div><div className="leagueTable"><div className="leagueTableHead"><span>#</span><span>العضو</span><span>لعب</span><span>ف</span><span>ت</span><span>خ</span><span>له</span><span>عليه</span><span>فارق</span><span>نقاط</span></div>{selectedStandings.map((row, index) => <div key={row.memberId} className={index === 0 ? "leagueTableRow champion" : relegatedIds.some((id) => same(id, row.memberId)) ? "leagueTableRow relegated" : absentIds.some((id) => same(id, row.memberId)) ? "leagueTableRow absent" : "leagueTableRow"}><span>{index + 1}</span><span>{row.memberName}{row.needsPlayoff ? <em className="playoffBadge">فاصلة</em> : null}{absentIds.some((id) => same(id, row.memberId)) ? <em className="absentBadge">غائب</em> : null}</span><span>{row.played}</span><span>{row.wins}</span><span>{row.draws}</span><span>{row.losses}</span><span>{row.goalsFor}</span><span>{row.goalsAgainst}</span><span>{row.goalDifference}</span><b>{row.points}</b></div>)}</div></section> : <KnockoutBracketSection competition={selectedCompetition} title="الأدوار الإقصائية" />}

        <section className="sectionBox glassSoft"><div className="sectionHead compact"><div><h3>{clean(selectedCompetition.status) === "completed" ? "نتائج المباريات" : "جدول المباريات"}</h3></div></div><div className="leagueRoundsList">{groupedMatches.map((round) => <div className="leagueRoundBox" key={round.round}><h4>{selectedIsLeague ? (round.matches?.[0]?.scope === "league_qualifier" ? `ملحق الدوري - ${round.matches?.[0]?.label || roundLabelForBracket(round.round, groupedMatches.length)}` : `الجولة ${round.round}`) : selectedTypeKey === "world_cup" ? worldCupAdminRoundTitle(round.matches?.[0] || {}, round.round) : selectedLeagueGroupsMode ? leagueTwoGroupsAdminRoundTitle(round.matches?.[0] || {}, round.round) : selectedTypeKey === "champions_league" ? championsLeagueAdminRoundTitle(round.matches?.[0] || {}, round.round) : roundLabelForBracket(round.round, groupedMatches.length)}</h4><div className="leagueMatchesList">{round.matches.map((match) => { const values = resultInputs[match.id] || {}; const completed = clean(match.resultStatus || match.status) === "completed"; const waiting = String(match.homeMemberId || "").startsWith("__") || String(match.awayMemberId || "").startsWith("__"); return <article className={completed ? "leagueMatchCard completed" : "leagueMatchCard"} key={match.id}><div className="leagueMatchTeams"><b>{match.homeName}</b><span>vs</span><b>{match.awayName}</b></div><div className="leagueMatchMeta"><span>{match.gameTitle || "PES 2017"}</span><small>{match.label || match.gameReason || ""}</small></div><div className="leagueMatchScore"><input inputMode="numeric" value={values.homeGoals ?? (completed ? match.homeGoals : "")} onChange={(event) => setResultInputs((current) => ({ ...current, [match.id]: { ...(current[match.id] || {}), homeGoals: event.target.value } }))} disabled={waiting || (clean(selectedCompetition.status) === "completed" && !["cup", "super_cup", "world_cup", "champions_league"].includes(selectedTypeKey) && !selectedLeagueGroupsMode) || clean(selectedCompetition.status) === "cancelled" || match.phase === "bye"} /><strong>-</strong><input inputMode="numeric" value={values.awayGoals ?? (completed ? match.awayGoals : "")} onChange={(event) => setResultInputs((current) => ({ ...current, [match.id]: { ...(current[match.id] || {}), awayGoals: event.target.value } }))} disabled={waiting || (clean(selectedCompetition.status) === "completed" && !["cup", "super_cup", "world_cup", "champions_league"].includes(selectedTypeKey) && !selectedLeagueGroupsMode) || clean(selectedCompetition.status) === "cancelled" || match.phase === "bye"} /></div>{(!selectedIsLeague || match.scope === "league_qualifier") ? <div className="leagueMatchScore pens"><input inputMode="numeric" placeholder="ترجيح" value={values.homePens ?? (completed && match.homePens !== null ? match.homePens : "")} onChange={(event) => setResultInputs((current) => ({ ...current, [match.id]: { ...(current[match.id] || {}), homePens: event.target.value } }))} disabled={waiting || (clean(selectedCompetition.status) === "completed" && !["cup", "super_cup", "world_cup", "champions_league"].includes(selectedTypeKey) && !selectedLeagueGroupsMode) || clean(selectedCompetition.status) === "cancelled" || match.phase === "bye"} /><strong>ر</strong><input inputMode="numeric" placeholder="ترجيح" value={values.awayPens ?? (completed && match.awayPens !== null ? match.awayPens : "")} onChange={(event) => setResultInputs((current) => ({ ...current, [match.id]: { ...(current[match.id] || {}), awayPens: event.target.value } }))} disabled={waiting || (clean(selectedCompetition.status) === "completed" && !["cup", "super_cup", "world_cup", "champions_league"].includes(selectedTypeKey) && !selectedLeagueGroupsMode) || clean(selectedCompetition.status) === "cancelled" || match.phase === "bye"} /></div> : null}<select className="leagueGameSelect" value={values.gameTitle ?? match.gameTitle ?? "PES 2017"} onChange={(event) => setResultInputs((current) => ({ ...current, [match.id]: { ...(current[match.id] || {}), gameTitle: event.target.value } }))} disabled={waiting || (clean(selectedCompetition.status) === "completed" && !["cup", "super_cup", "world_cup", "champions_league"].includes(selectedTypeKey) && !selectedLeagueGroupsMode) || clean(selectedCompetition.status) === "cancelled" || match.phase === "bye"}><option value="PES 2017">PES 2017</option><option value="FIFA 2025">FIFA 2025</option></select><div className="leagueMatchActions"><button type="button" onClick={() => submitMatchResult(match)} disabled={busy || waiting || (clean(selectedCompetition.status) === "completed" && !["cup", "super_cup", "world_cup", "champions_league"].includes(selectedTypeKey) && !selectedLeagueGroupsMode) || clean(selectedCompetition.status) === "cancelled" || match.phase === "bye"}>{waiting ? "بانتظار متأهل" : completed ? "تحديث" : "حفظ"}</button>{completed ? <button type="button" className="dangerMiniBtn" onClick={() => submitClearMatchResult(match)} disabled={busy || (clean(selectedCompetition.status) === "completed" && !["cup", "super_cup", "world_cup", "champions_league"].includes(selectedTypeKey) && !selectedLeagueGroupsMode) || clean(selectedCompetition.status) === "cancelled"}>حذف النتيجة</button> : null}</div></article>; })}</div></div>)}</div></section>

        <CompetitionStatsBox competition={selectedCompetition} />

        <section className="sectionBox glassSoft adminForm"><div className="sectionHead compact"><div><h3>الاعتماد والغياب{selectedIsAnyLeague ? " والهبوط" : ""}</h3></div></div>{selectedIsAnyLeague ? <><h4 className="dealSectionTitle">الهابطون</h4><div className="leagueMembersGrid compact">{selectedRelegationRows.map((row) => <label key={row.memberId} className={relegatedIds.some((id) => same(id, row.memberId)) ? "leagueMemberPick relegated active" : "leagueMemberPick"}><input type="checkbox" checked={relegatedIds.some((id) => same(id, row.memberId))} onChange={() => toggleRelegated(row.memberId)} /><span>{row.memberName}</span></label>)}</div></> : null}<h4 className="dealSectionTitle">الغائبون</h4><div className="leagueMembersGrid compact">{(selectedCompetition.participants || []).map((row) => <label key={row.memberId} className={absentIds.some((id) => same(id, row.memberId)) ? "leagueMemberPick absent active" : "leagueMemberPick"}><input type="checkbox" checked={absentIds.some((id) => same(id, row.memberId))} onChange={() => toggleAbsent(row.memberId)} /><span>{row.memberName}</span></label>)}</div><button className="moneySubmitBtn" type="button" disabled={busy || (clean(selectedCompetition.status) === "completed" && !["cup", "super_cup", "world_cup", "champions_league"].includes(selectedTypeKey) && !selectedLeagueGroupsMode) || clean(selectedCompetition.status) === "cancelled"} onClick={submitFinalizeCompetition}>{clean(selectedCompetition.status) === "completed" && (["cup", "super_cup", "world_cup", "champions_league"].includes(selectedTypeKey) || selectedLeagueGroupsMode) ? "إعادة اعتماد النتائج وتصحيح المكافآت" : clean(selectedCompetition.status) === "completed" ? "معتمدة" : "اعتماد النتائج"}</button></section>

        <section className="sectionBox glassSoft adminForm dangerZone"><div className="sectionHead compact"><div><h3>حذف البطولة</h3><p>استخدمه عند إنشاء بطولة بالخطأ. سيتم حذفها نهائيًا من البطولات المحفوظة مع حفظ أثر إداري في سجل FIFA.</p></div></div><label className="moneyField"><span>سبب الإلغاء</span><textarea value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} /></label><button className="moneySubmitBtn danger" type="button" disabled={busy || (clean(selectedCompetition.status) === "completed" && !["cup", "super_cup", "world_cup", "champions_league"].includes(selectedTypeKey) && !selectedLeagueGroupsMode) || clean(selectedCompetition.status) === "cancelled"} onClick={submitCancelCompetition}>حذف البطولة نهائيًا</button></section>
      </> : null}
    </main>
  );
}

function NotificationsPanel({ rows, members, currentMemberId, pushStatus, pushBusy, onEnablePushNotifications, onDisablePushNotifications, onOpenNotification }) {
  const visibleRows = rows || [];
  const initialPush = getInitialPushStatus();
  const pushState = pushStatus?.state || initialPush.state;
  const pushMessage = pushStatus?.message || initialPush.message;
  const pushEnabled = pushState === "enabled";
  const permissionLabel = pushBusy
    ? "جاري التنفيذ..."
    : pushEnabled
    ? "إيقاف إشعارات هذا الجهاز"
    : "تفعيل إشعارات الجوال";
  const buttonHandler = pushEnabled ? onDisablePushNotifications : onEnablePushNotifications;

  return (
    <section className="notificationsPanel glassSoft">
      <div className="notificationsHead">
        <b>🔔 الإشعارات</b>
        <div className="notificationsHeadActions">
          <small>{visibleRows.length ? `${visibleRows.length} آخر إشعارات` : "لا توجد إشعارات"}</small>
          <button
            type="button"
            className={pushEnabled ? "enableDeviceNotifyBtn active stop" : "enableDeviceNotifyBtn"}
            onClick={buttonHandler}
            disabled={pushBusy || !buttonHandler}
            title={pushMessage}
          >
            {permissionLabel}
          </button>
        </div>
      </div>

      <div className={pushEnabled ? "pushNotifyBox active" : pushState === "error" ? "pushNotifyBox error" : "pushNotifyBox"}>
        <div>
          <b>{pushEnabled ? "إشعارات الجوال مفعلة" : "إشعارات الجوال"}</b>
          <small>{pushMessage}</small>
        </div>
      </div>

      {visibleRows.length ? (
        <div className="notificationsList">
          {visibleRows.map((item) => {
            const read = clean(item.status || "unread") === "read";
            const passive = Boolean(item.navigationDisabled);
            return (
              <button
                type="button"
                key={item.id}
                className={(read ? "notificationItem read clickableNotification" : "notificationItem clickableNotification") + (passive ? " disabledNotification" : "")}
                disabled={Boolean(passive)}
                onClick={() => !passive && onOpenNotification?.(item)}
              >
                <b>{item.title || "إشعار"}</b>
                <p>{item.body || "-"}</p>
                <small>{notificationDisplayDate(item.createdAt || item.date)}</small>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="empty">لا توجد إشعارات حالياً.</div>
      )}
    </section>
  );
}

function NotificationsModal({ rows, members, currentMemberId, pushStatus, pushBusy, onEnablePushNotifications, onDisablePushNotifications, onClose, onOpenNotification }) {
  return createPortal(
    <div className="notificationsModalBackdrop" onClick={onClose}>
      <section className="notificationsModal glass" onClick={(event) => event.stopPropagation()} dir="rtl">
        <header>
          <div>
            <small>FIFA GROUP</small>
            <h3>الإشعارات</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="إغلاق">×</button>
        </header>
        <NotificationsPanel
          rows={rows}
          members={members}
          currentMemberId={currentMemberId}
          pushStatus={pushStatus}
          pushBusy={pushBusy}
          onEnablePushNotifications={onEnablePushNotifications}
          onDisablePushNotifications={onDisablePushNotifications}
          onOpenNotification={onOpenNotification}
        />
      </section>
    </div>,
    document.body
  );
}

function MoneyTransferModal({
  members,
  currentMemberId,
  currentBalance,
  defaultToMemberId,
  onClose,
  onSubmit,
}) {
  const [toMemberId, setToMemberId] = useState(defaultToMemberId || "");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const recipients = getActiveMembers(members).filter(
    (member) => cleanId(member.id) && !same(member.id, currentMemberId)
  );
  const selectedRecipient = recipients.find((member) => same(member.id, toMemberId));

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    setBusy(true);
    try {
      await onSubmit({ toMemberId, amount, note });
      setMessage("تم تنفيذ التحويل بنجاح.");
      window.setTimeout(onClose, 650);
    } catch (err) {
      setMessage(err?.message || "تعذر تنفيذ التحويل.");
    } finally {
      setBusy(false);
    }
  }

  return createPortal(
    <div className="moneyModalBackdrop" onClick={onClose}>
      <form
        className="moneyTransferModal glass"
        onSubmit={handleSubmit}
        onClick={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <small>تحويل تلقائي</small>
            <h3>تحويل أموال</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="إغلاق">×</button>
        </header>

        <div className="moneyBalanceBox glassSoft">
          <span>رصيدك المتاح</span>
          <b>{formatMoney(currentBalance)}</b>
        </div>

        <label className="moneyField">
          <span>العضو المستقبل</span>
          <select value={toMemberId} onChange={(event) => setToMemberId(event.target.value)}>
            <option value="">اختر عضوًا</option>
            {recipients.map((member) => (
              <option key={member.id} value={member.id}>{member.name}</option>
            ))}
          </select>
        </label>

        {selectedRecipient ? (
          <div className="moneyRecipientPreview glassSoft">
            <img src={selectedRecipient.avatar || avatar(selectedRecipient.name)} alt="" />
            <div>
              <b>{selectedRecipient.name}</b>
              <small>{selectedRecipient.team || "بدون فريق"}</small>
            </div>
          </div>
        ) : null}

        <label className="moneyField">
          <span>المبلغ</span>
          <input inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="مثال: 5000000" />
        </label>

        <label className="moneyField">
          <span>ملاحظة اختيارية</span>
          <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="سبب التحويل" />
        </label>

        {message ? <p className="moneyModalMessage">{message}</p> : null}

        <button className="moneySubmitBtn" type="submit" disabled={busy}>
          {busy ? "جاري التنفيذ..." : "تنفيذ التحويل"}
        </button>
      </form>
    </div>,
    document.body
  );
}

function TabButton({ tab, id, label, setTab }) {
  return (
    <button
      className={tab === id ? "tabBtn active" : "tabBtn"}
      onClick={() => setTab(id)}
    >
      {label}
    </button>
  );
}

function StatCard({ icon, value, label, onClick }) {
  const content = (
    <>
      <span className="statIcon">{renderSmartIcon(icon)}</span>
      <b>{value}</b>
      <small>{label}</small>
    </>
  );
  return onClick ? (
    <button className="statCard clickable glassSoft" onClick={onClick}>
      {content}
    </button>
  ) : (
    <article className="statCard glassSoft">{content}</article>
  );
}

function renderSmartIcon(value) {
  const icon = String(value || "").trim();
  if (!icon) return null;
  if (/^https?:\/\//i.test(icon) || icon.startsWith("data:image")) {
    return <img className="smartIconImg" src={icon} alt="" />;
  }
  return icon;
}


function normalizeExchangeContractType(value = "") {
  const kind = clean(value || "owned");
  return kind === "loan" ? "loan" : "owned";
}

function normalizeExchangeLoanDuration(value) {
  const months = toNumber(value);
  return [2, 4, 6].includes(months) ? months : 2;
}

function exchangeContractLabel(item = {}) {
  const kind = normalizeExchangeContractType(item.exchangeContractType || item.swapContractType || item.contractMode || item.contractType);
  if (kind === "loan") return "إعارة " + loanDurationLabel(item.exchangeLoanDurationMonths || item.loanDurationMonths || 2);
  return "بيع كامل";
}

function normalizeOfferExchangeClauseForSave(item = {}) {
  const exchangeContractType = normalizeExchangeContractType(item.exchangeContractType || item.swapContractType || item.contractMode);
  const exchangeLoanDurationMonths = exchangeContractType === "loan"
    ? normalizeExchangeLoanDuration(item.exchangeLoanDurationMonths || item.loanDurationMonths)
    : null;
  return {
    ...item,
    exchangeContractType,
    exchangeLoanDurationMonths,
    exchangeTypeLabel: exchangeContractType === "loan" ? "إعارة" : "بيع كامل",
  };
}

function TransferRestrictionBanner({ rows = [] }) {
  const activeRows = (rows || []).filter(isTransferRestrictionActive);
  if (!activeRows.length) return null;
  return (
    <section className="transferRestrictionBanner glassSoft">
      <b>⛔ إيقاف من نظام الانتقالات</b>
      {activeRows.map((row) => (
        <p key={row.id || `${row.memberId}-${row.endDate}`}>{transferRestrictionShortText(row)} • من {row.startDate || "-"} حتى {row.endDate || "-"}{row.reason ? " • " + row.reason : ""}</p>
      ))}
    </section>
  );
}

function MemberDealsSection({ member, members = [], transferHistory = [], playerOffers = [], memberRestrictions = [], logoUrl = "" }) {
  const memberId = cleanId(member?.id);
  const [dealSearch, setDealSearch] = useState("");
  const [selectedDealContract, setSelectedDealContract] = useState(null);
  const q = clean(dealSearch);
  const matchDeal = (row) => !q || clean([
    row.playerName,
    row.player,
    row.name,
    row.fromMemberName,
    row.toMemberName,
    row.type,
    row.typeLabel,
    row.status,
    row.periodName,
    row.date,
    isLoanTransferRow(row) ? loanDurationLabel(row.loanDurationMonths) : "",
    Array.isArray(row.offeredPlayers) ? row.offeredPlayers.map((item) => item.playerName || item.name || "").join(" ") : "",
  ].join(" ")).includes(q);
  const memberDeals = (transferHistory || [])
    .filter((row) => same(row.fromMemberId, memberId) || same(row.toMemberId, memberId) || same(row.originalOwnerMemberId, memberId))
    .filter(matchDeal)
    .sort((a, b) => dateValue(b.date || formatTransferDate(b.createdAt)) - dateValue(a.date || formatTransferDate(a.createdAt)));
  const memberDealGroups = memberDeals.reduce((groups, row) => {
    const key = row.periodId || row.periodName || row.period || "انتقالات Firebase";
    if (!groups[key]) groups[key] = [];
    groups[key].push(row);
    return groups;
  }, {});
  const activeRestrictions = getActiveMemberRestrictions(memberRestrictions, memberId);

  function openDealContract(row) {
    const player = {
      id: row?.playerId || row?.playerid || row?.playerID || row?.player_id || "",
      playerid: row?.playerId || row?.playerid || row?.playerID || row?.player_id || "",
      name: row?.playerName || row?.player || row?.name || "لاعب",
      image: row?.playerImage || FALLBACK_PLAYER_IMAGE,
      rating: row?.playerRating || "",
      position: row?.playerPosition || "",
    };
    setSelectedDealContract({ row, player });
  }

  return (
    <section className="sectionBox glassSoft memberDealsPanel">
      <div className="sectionHead">
        <div>
          <h3>سجل الصفقات</h3>
          <p>مرتبط بسجل فترات الانتقالات، لكنه مفلتر لهذا العضو فقط.</p>
        </div>
        <input value={dealSearch} onChange={(event) => setDealSearch(event.target.value)} placeholder="ابحث عن لاعب، عضو، نوع الصفقة، فترة..." />
      </div>
      {activeRestrictions.length ? <TransferRestrictionBanner rows={activeRestrictions} /> : null}
      <h4 className="dealSectionTitle">الصفقات حسب فترات الانتقالات</h4>
      <div className="memberDealList">
        {memberDeals.length ? Object.entries(memberDealGroups).map(([periodName, groupRows]) => (
          <div className="dealPeriodGroup" key={periodName}>
            <div className="dealPeriodTitle"><b>{periodName}</b><span>{groupRows.length} صفقة</span></div>
            {groupRows.map((row, index) => {
              const outgoing = same(row.fromMemberId, memberId);
              const incoming = same(row.toMemberId, memberId);
              const sideLabel = outgoing ? "خارج من القائمة" : incoming ? "داخل إلى القائمة" : "مالك أصلي";
              return (
                <article className="memberDealCard" key={String(row.id || row.relatedOfferId || index)}>
                  <img src={row.playerImage || FALLBACK_PLAYER_IMAGE} alt="" />
                  <div>
                    <b>{row.playerName || row.player || row.name || "لاعب"}</b>
                    <small>{sideLabel} • {row.typeLabel || row.type || "صفقة"}{isLoanTransferRow(row) ? " • " + loanDurationLabel(row.loanDurationMonths) : ""}</small>
                    <p>{row.periodName || row.period || "فترة انتقالات"} • {row.fromMemberName || row.from || "-"} ← {row.toMemberName || row.to || "-"}</p>
                    {Array.isArray(row.offeredPlayers) && row.offeredPlayers.length ? (
                      <div className="miniSwapPlayers">
                        {row.offeredPlayers.map((item, swapIndex) => (
                          <span key={item.playerId || item.playerName || swapIndex}>
                            <img src={item.playerImage || item.image || FALLBACK_PLAYER_IMAGE} alt="" />
                            {item.playerName || item.name || "لاعب"} • {exchangeContractLabel(item)}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <strong>{formatMoney(row.amount || 0)}</strong>
                  <button type="button" className="transferContractBtn" onClick={() => openDealContract(row)}>تحميل صورة العقد</button>
                </article>
              );
            })}
          </div>
        )) : <div className="empty">لا توجد صفقات لهذا العضو في سجل الفترات.</div>}
      </div>
      {selectedDealContract ? (
        <TransferContractModal
          row={selectedDealContract.row}
          player={selectedDealContract.player}
          logoUrl={logoUrl}
          onClose={() => setSelectedDealContract(null)}
        />
      ) : null}
    </section>
  );
}


function MemberOffersSection({ member, members = [], allPlayers = [], playerOffers = [], currentMemberId = "", isFifaAdmin = false, logoUrl = "", onOpenPlayer, onEditOffer, onCancelOffer, onAcceptOffer, onRejectOffer }) {
  const memberId = cleanId(member?.id);
  const [offerSearch, setOfferSearch] = useState("");
  const [offerSubTab, setOfferSubTab] = useState("incoming_active");
  const [selectedOfferContract, setSelectedOfferContract] = useState(null);
  const q = clean(offerSearch);
  const isOwnOfferCenter = Boolean(currentMemberId && same(currentMemberId, memberId));
  const isReadOnlyAdminView = Boolean(isFifaAdmin && !isOwnOfferCenter);

  const memberOffers = (playerOffers || [])
    .filter((offer) => same(offer.fromMemberId, memberId) || same(offer.toMemberId, memberId))
    .filter((offer) => {
      if (!q) return true;
      const offeredNames = Array.isArray(offer.offeredPlayers)
        ? offer.offeredPlayers.map((item) => [item.playerName || item.name || "", exchangeContractLabel(item)].join(" ")).join(" ")
        : "";
      return clean([
        offer.targetPlayerName,
        offer.fromMemberName,
        offer.toMemberName,
        offer.typeLabel,
        offer.type,
        offer.status,
        offer.amount,
        offeredNames,
      ].join(" ")).includes(q);
    })
    .sort((a, b) => notificationTimeValue(b.createdAt) - notificationTimeValue(a.createdAt));

  function offerStatusKey(offer) {
    const status = clean(offer.status || "pending");
    if (status === "pending" && isOfferExpired(offer)) return "expired";
    if (status === "approvedpendingwindow" && (offer.completedAt || offer.marketWasOpenAtApproval || offer.executedAt || offer.loanStartDate)) return "completed";
    return status;
  }

  function isPendingOffer(offer) {
    return offerStatusKey(offer) === "pending";
  }

  function isPendingWindowOffer(offer) {
    return offerStatusKey(offer) === "approvedpendingwindow";
  }

  function isCompletedOffer(offer) {
    return offerStatusKey(offer) === "completed";
  }

  function isClosedOffer(offer) {
    const status = offerStatusKey(offer);
    return [
      "rejected",
      "cancelledbybuyer",
      "cancelledbyseller",
      "cancelled",
      "expired",
      "cancelledbecauseplayerunavailable",
      "cancelledbecauseplayerreleased",
    ].includes(status);
  }

  function offerCenterStatusLabel(offer) {
    const status = offerStatusKey(offer);
    if (status === "pending") return "بانتظار الرد";
    if (status === "approvedpendingwindow") return "مقبول بانتظار فتح السوق";
    if (status === "completed") return "مكتملة";
    if (status === "rejected") return "مرفوضة";
    if (status === "cancelledbybuyer" || status === "cancelledbyseller" || status === "cancelled") return "ملغاة";
    if (status === "expired") return "منتهية";
    if (status === "cancelledbecauseplayerunavailable") return "أغلقت لارتباط اللاعب";
    if (status === "cancelledbecauseplayerreleased") return "أغلقت بسبب الاستغناء";
    return playerOfferStatusMessage(status);
  }

  const incomingActiveOffers = memberOffers.filter((offer) => same(offer.toMemberId, memberId) && isPendingOffer(offer));
  const outgoingActiveOffers = memberOffers.filter((offer) => same(offer.fromMemberId, memberId) && isPendingOffer(offer));
  const pendingWindowOffers = memberOffers.filter(isPendingWindowOffer);
  const completedOffers = memberOffers.filter(isCompletedOffer);
  const closedOffers = memberOffers.filter(isClosedOffer);

  const offerTabs = [
    ["incoming_active", "الواردة", incomingActiveOffers],
    ["outgoing_active", "الصادرة", outgoingActiveOffers],
    ["pending_window", "بانتظار السوق", pendingWindowOffers],
    ["completed", "المكتملة", completedOffers],
    ["closed", "المرفوضة / الملغاة", closedOffers],
  ];
  const activeTab = offerTabs.find(([id]) => id === offerSubTab) || offerTabs[0];
  const visibleOffers = activeTab[2] || [];

  function findOfferPlayer(offer) {
    return (allPlayers || []).find((player) => same(getPlayerStableId(player), offer.targetPlayerId)) || {
      playerid: offer.targetPlayerId,
      id: offer.targetPlayerId,
      name: offer.targetPlayerName,
      image: offer.targetPlayerImage,
      position: offer.targetPlayerPosition,
      rating: offer.targetPlayerRating,
      memberid: offer.toMemberId,
    };
  }

  function targetMemberForOffer(offer) {
    return (members || []).find((item) => same(item.id, offer.toMemberId)) || { id: offer.toMemberId, name: offer.toMemberName };
  }

  function offerDirectionLabel(offer) {
    if (same(offer.toMemberId, memberId)) return "عرض وارد";
    if (same(offer.fromMemberId, memberId)) return "عرض صادر";
    return "عرض مرتبط";
  }

  function offerTypeLine(offer) {
    const type = offer.type === "loan" ? "عقد إعارة" : "عقد شراء";
    const duration = offer.type === "loan" ? " • " + loanDurationLabel(offer.loanDurationMonths) : "";
    return type + duration;
  }

  function openCompletedOfferContract(offer, player) {
    const row = normalizeOfferAsTransferContractRow(offer);
    const contractPlayer = {
      id: row.playerId || row.playerid || player?.id || player?.playerid || "",
      playerid: row.playerId || row.playerid || player?.playerid || player?.id || "",
      name: row.playerName || player?.name || "لاعب",
      image: row.playerImage || player?.image || FALLBACK_PLAYER_IMAGE,
      rating: row.playerRating || player?.rating || "",
      position: row.playerPosition || player?.position || "",
    };
    setSelectedOfferContract({ row, player: contractPlayer });
  }

  return (
    <section className="sectionBox glassSoft memberDealsPanel">
      <div className="sectionHead">
        <div>
          <h3>عروض الانتقالات</h3>
          <p>{isReadOnlyAdminView ? "استعراض إداري للعروض المرتبطة بهذا العضو دون تنفيذ قرارات نيابة عنه." : "مركز منظم لإدارة عروضك حسب الحالة."}</p>
        </div>
        <input value={offerSearch} onChange={(event) => setOfferSearch(event.target.value)} placeholder="ابحث عن لاعب، عضو، نوع العرض..." />
      </div>
      <nav className="tabs">
        {offerTabs.map(([id, label, rows]) => (
          <button key={id} className={offerSubTab === id ? "tabBtn active" : "tabBtn"} onClick={() => setOfferSubTab(id)}>
            {label} ({rows.length})
          </button>
        ))}
      </nav>
      <div className="memberDealList">
        {visibleOffers.length ? visibleOffers.map((offer, index) => {
          const pending = isPendingOffer(offer);
          const canManageOutgoingOffer = Boolean(pending && currentMemberId && same(currentMemberId, offer.fromMemberId));
          const canManageIncomingOffer = Boolean(pending && currentMemberId && same(currentMemberId, offer.toMemberId));
          const player = findOfferPlayer(offer);
          const targetMember = targetMemberForOffer(offer);
          const offeredPlayers = Array.isArray(offer.offeredPlayers) ? offer.offeredPlayers : [];
          return (
            <article className="memberDealCard offer managedOfferCard" key={String(offer.id || index)}>
              <img src={offer.targetPlayerImage || player.image || FALLBACK_PLAYER_IMAGE} alt="" />
              <div>
                <b>{offer.targetPlayerName || player.name || "لاعب"}</b>
                <small>{offerDirectionLabel(offer)} • {offerTypeLine(offer)}</small>
                <p>{offer.fromMemberName || getMemberName(members, offer.fromMemberId)} ← {offer.toMemberName || getMemberName(members, offer.toMemberId)} • {formatMoney(offer.amount || 0)}</p>
                {offeredPlayers.length ? (
                  <div className="miniSwapPlayers">
                    {offeredPlayers.map((item, swapIndex) => (
                      <span key={item.playerId || item.playerName || swapIndex}>
                        <img src={item.playerImage || item.image || FALLBACK_PLAYER_IMAGE} alt="" />
                        {item.playerName || item.name || "لاعب"} • {exchangeContractLabel(item)}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
              <strong>{offerCenterStatusLabel(offer)}</strong>
              <div className="offerCenterActions">
                <button type="button" onClick={() => onOpenPlayer?.(player)}>صفحة اللاعب</button>
                {canManageOutgoingOffer ? <button type="button" onClick={() => onEditOffer?.(offer, player, targetMember)}>تعديل</button> : null}
                {canManageOutgoingOffer ? <button className="danger" type="button" onClick={() => onCancelOffer?.(offer)}>إلغاء</button> : null}
                {canManageIncomingOffer ? <button type="button" onClick={() => onAcceptOffer?.(offer.id)}>قبول</button> : null}
                {canManageIncomingOffer ? <button className="danger" type="button" onClick={() => onRejectOffer?.(offer.id)}>رفض</button> : null}
              </div>
            </article>
          );
        }) : <div className="empty">لا توجد عروض في هذه الخانة.</div>}
      </div>
      {selectedOfferContract ? (
        <TransferContractModal
          row={selectedOfferContract.row}
          player={selectedOfferContract.player}
          logoUrl={logoUrl}
          onClose={() => setSelectedOfferContract(null)}
        />
      ) : null}
    </section>
  );
}


function PlayersSection({ config, rows, search, setSearch, playerCount, showOfferButton = false, onOpenPlayerDetail, playerContracts = [], selectedMemberId = "" }) {
  const memberId = cleanId(selectedMemberId);
  const activeContracts = (playerContracts || []).filter((contract) => clean(contract.status || "active") === "active");
  const playerKindCounts = (rows || []).reduce(
    (counts, player) => {
      const playerId = getPlayerStableId(player);
      const contract = activeContracts.find((item) => same(item.playerId, playerId));
      const kind = getRosterPlayerKindFromContract(player, contract, memberId);
      if (kind === "free") counts.free += 1;
      else if (kind === "pro_owned" || kind === "pro_loan") counts.pro += 1;
      else counts.base += 1;
      return counts;
    },
    { base: 0, free: 0, pro: 0 }
  );

  const loanRows = activeContracts
    .filter((contract) => clean(contract.contractType || "") === "loan")
    .filter((contract) => {
      const current = cleanId(contract.currentMemberId || "");
      const original = cleanId(contract.originalOwnerMemberId || contract.ownerMemberId || contract.baseOwnerMemberId || "");
      return same(current, memberId) || same(original, memberId);
    })
    .map((contract) => {
      const current = cleanId(contract.currentMemberId || "");
      const original = cleanId(contract.originalOwnerMemberId || contract.ownerMemberId || contract.baseOwnerMemberId || "");
      const endDate = contract.loanEndDate || contract.endDate || "";
      const daysLeft = endDate ? Math.ceil((dateOnlyMs(endDate, 0) - Date.now()) / 86400000) : null;
      return {
        id: contract.id || contract.playerId,
        playerName: contract.playerName || "لاعب",
        playerImage: contract.playerImage || FALLBACK_PLAYER_IMAGE,
        currentMemberName: contract.currentMemberName || getMemberName([], current) || current,
        originalOwnerName: contract.originalOwnerMemberName || contract.ownerMemberName || contract.baseOwnerMemberName || original,
        directionLabel: same(current, memberId) ? "معار لديك" : "معار إلى " + (contract.currentMemberName || current || "عضو"),
        endDate,
        daysLeft,
      };
    });

  return (
    <section className="sectionBox glassSoft">
      <div className="sectionHead">
        <div>
          <h3>
            {config.playersTitle}{" "}
            <span className="playersCountBadge">{playerCount}</span>
          </h3>
          <p>مرتبة حسب القدرة من الأعلى إلى الأقل</p>
        </div>
        {isEnabled(config.showSearch) ? (
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={config.searchPlaceholder}
          />
        ) : null}
      </div>
      <div className="playersGrid">
        {rows.length ? (
          rows.map((player, index) => (
            <article
              className={onOpenPlayerDetail ? "playerCard playerCardClickable" : "playerCard"}
              key={String(getPlayerStableId(player) || player.name || index)}
              onClick={onOpenPlayerDetail ? () => onOpenPlayerDetail?.(player) : undefined}
              role={onOpenPlayerDetail ? "button" : undefined}
              tabIndex={onOpenPlayerDetail ? 0 : undefined}
              onKeyDown={onOpenPlayerDetail ? (event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onOpenPlayerDetail?.(player);
                }
              } : undefined}
            >
              <img
                className="playerPhoto"
                src={player.image || avatar(player.name)}
                alt=""
              />
              <div className="playerInfo">
                <h4>{player.name}</h4>
                <p className="playerMeta">
                  <span className="playerPosition">{player.position || "مركز غير محدد"}</span>
                  <span className="playerContract">{getPlayerRosterKindLabel(player, playerContracts, selectedMemberId)}</span>
                </p>
              </div>
              <b className="playerRating">{player.rating}</b>
            </article>
          ))
        ) : (
          <div className="empty">لا توجد بيانات لاعبين.</div>
        )}
      </div>

      {loanRows.length ? (
        <section className="loanedPlayersPanel glassSoft">
          <div className="loanedPlayersHead">
            <b>اللاعبون المعارون حاليًا</b>
            <small>{loanRows.length} إعارة نشطة</small>
          </div>
          <div className="loanedPlayersList">
            {loanRows.map((loan) => (
              <article className="loanedPlayerRow" key={String(loan.id)}>
                <img src={loan.playerImage || FALLBACK_PLAYER_IMAGE} alt="" />
                <div>
                  <b>{loan.playerName}</b>
                  <small>{loan.directionLabel}</small>
                </div>
                <span>{loan.endDate ? (loan.daysLeft !== null && loan.daysLeft >= 0 ? `باقي ${loan.daysLeft} يوم` : "انتهت المدة") : "بدون تاريخ"}</span>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <div className="playerRosterStats glassSoft">
        <span><small>أساسي</small><b>{playerKindCounts.base}</b></span>
        <span><small>لاعب حر</small><b>{playerKindCounts.free}</b></span>
        <span><small>محترف</small><b>{playerKindCounts.pro}</b></span>
      </div>
    </section>
  );
}

function PlayerDetailSubPage({
  player,
  ownerMember,
  currentMemberId,
  currentMember,
  playerOffers,
  playerContracts = [],
  freeAgentRegistrations = [],
  freePlayerStatus = [],
  freeAgentQueue = [],
  ownerPlayerCount = 0,
  canMakeOffer,
  isMarketOpen,
  members = [],
  onBack,
  onOffer,
  onCancelOffer,
  onAcceptOffer,
  onRejectOffer,
  onReleasePlayer,
  onTerminateLoan,
  onRegisterFreeAgentFee,
  logoUrl = "",
}) {
  const playerId = getPlayerStableId(player);
  const activeContract = (playerContracts || []).find((contract) => same(contract.playerId, playerId) && clean(contract.status || "active") === "active");
  const activeContractType = clean(activeContract?.contractType || "");
  const playerReleased = activeContractType === "released" || Boolean(activeContract?.permanentlyRemoved);
  const playerHasActiveContract = Boolean(activeContract && !isFreeAgentPoolContract(activeContract));
  const playerBlocksNewOffer = Boolean(activeContract && activeContractType === "released");
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [actionMessage, setActionMessage] = useState("");
  const [busyAction, setBusyAction] = useState(false);
  const [instantContract, setInstantContract] = useState(null);

  const existingOffer = (playerOffers || []).find((offer) =>
    same(offer.fromMemberId, currentMemberId) &&
    same(offer.targetPlayerId, playerId) &&
    isBlockingOwnPlayerOfferStillValid(offer)
  );
  const existingOfferStatus = clean(existingOffer?.status || "");
  const acceptedDeal = (playerOffers || []).find((offer) =>
    same(offer.targetPlayerId, playerId) && isAcceptedOrCompletedPlayerOffer(offer)
  );
  const acceptedDealStatus = clean(acceptedDeal?.status || "") === "approvedpendingwindow" && (acceptedDeal?.completedAt || acceptedDeal?.marketWasOpenAtApproval || acceptedDeal?.executedAt || acceptedDeal?.loanStartDate || acceptedDeal?.marketExecutionCompletedAt) ? "completed" : clean(acceptedDeal?.status || "");
  const canCancelOffer = existingOffer && existingOfferStatus === "pending" && !acceptedDeal;
  const canEdit = canCancelOffer && toNumber(existingOffer.editCount) < toNumber(existingOffer.maxEdits || 1);
  const isAvailableFreeAgentContract = isFreeAgentPoolContract(activeContract);
  const isLooseFreeAgent = Boolean((isFreeAgentPlayer(player) && !activeContract && !cleanId(player.memberid)) || isAvailableFreeAgentContract);
  const displayOwnerId = activeContract && activeContractType !== "released" && !isAvailableFreeAgentContract
    ? cleanId(activeContract.currentMemberId)
    : (isLooseFreeAgent ? "" : cleanId(ownerMember?.id));
  const effectiveOwnerId = displayOwnerId;
  const realOwnerIdForDisplay = activeContract && activeContractType === "loan"
    ? cleanId(activeContract.originalOwnerMemberId || activeContract.ownerMemberId)
    : displayOwnerId;
  const realOwnerNameForDisplay = isLooseFreeAgent
    ? "لا يوجد"
    : activeContract && activeContractType === "loan"
    ? (activeContract.originalOwnerMemberName || activeContract.ownerMemberName || getMemberName(members, realOwnerIdForDisplay))
    : activeContract
    ? (activeContract.currentMemberName || getMemberName(members, displayOwnerId))
    : (ownerMember?.name || "-");
  const ownerIntroText = isLooseFreeAgent ? "لاعب حر متاح" : "لاعب في قائمة " + (activeContract?.currentMemberName || ownerMember?.name || "العضو");
  const isOwner = Boolean(currentMemberId && effectiveOwnerId && same(currentMemberId, effectiveOwnerId));
  const playerRosterKindForOwner = getRosterPlayerKindFromContract(player, activeContract, effectiveOwnerId);
  const canReleasePlayer = Boolean(
    isOwner &&
      isMarketOpen &&
      !playerReleased &&
      !acceptedDeal &&
      playerRosterKindForOwner !== "free" &&
      (!activeContract || activeContractType === "owned") &&
      toNumber(ownerPlayerCount) > MIN_SQUAD_PLAYERS
  );
  const canTerminateLoan = Boolean(
    activeContract &&
      activeContractType === "loan" &&
      isMarketOpen &&
      (same(activeContract.currentMemberId, currentMemberId) || same(activeContract.originalOwnerMemberId || activeContract.ownerMemberId, currentMemberId))
  );
  const canManagePlayer = Boolean(isOwner || canTerminateLoan);
  const freeAgentFeeRegistered = hasFreeAgentRegistrationRecord(freeAgentRegistrations, playerId, currentMemberId);
  const memberFreeContract = (playerContracts || []).find((contract) =>
    same(contract.currentMemberId, currentMemberId) &&
    isFreeOriginContract(contract) &&
    same(getFreeAgentSlotOwnerIdFromContract(contract, contract.originalOwnerMemberId || contract.ownerMemberId || currentMemberId), currentMemberId) &&
    clean(contract.status || "active") === "active" &&
    clean(contract.contractType || "owned") === "owned"
  );
  const memberFreeStatus = (freePlayerStatus || []).find((item) => same(item.memberId || item.id, currentMemberId));
  const hasPendingFreeAgentRequest = (freeAgentQueue || []).some((item) =>
    same(item.memberId, currentMemberId) && ["pending_window", "processing"].includes(clean(item.status || "pending_window"))
  );
  const freeAgentActionIsReplacement = Boolean(memberFreeContract && !same(memberFreeContract.playerId, playerId));
  const freeAgentSlotEverUsed = hasEverUsedFreeAgentSlot(freeAgentRegistrations, memberFreeStatus, memberFreeContract, currentMemberId);
  const freeAgentSlotLost = Boolean(freeAgentSlotEverUsed && !memberFreeContract);
  const freeAgentAlreadyCurrent = Boolean(memberFreeContract && same(memberFreeContract.playerId, playerId));
  const freeAgentIsAvailableForRegistration = Boolean(isLooseFreeAgent);
  const canRegisterFreeAgentFee = Boolean(
    currentMemberId &&
      freeAgentIsAvailableForRegistration &&
      !freeAgentFeeRegistered &&
      !playerReleased &&
      !freeAgentAlreadyCurrent &&
      !freeAgentSlotLost &&
      !hasPendingFreeAgentRequest
  );
  const receivedOffers = (playerOffers || [])
    .filter((offer) =>
      same(offer.toMemberId, currentMemberId) &&
      same(offer.targetPlayerId, playerId) &&
      clean(offer.status || "pending") === "pending" &&
      !isOfferExpired(offer)
    )
    .sort((a, b) => notificationTimeValue(b.createdAt) - notificationTimeValue(a.createdAt));

  function askConfirm(options) {
    setActionMessage("");
    setConfirmDialog(options);
  }

  async function runConfirmedAction() {
    if (!confirmDialog?.onConfirm || busyAction) return;
    setBusyAction(true);
    setActionMessage("");
    try {
      const result = await confirmDialog.onConfirm();
      setActionMessage(confirmDialog.successMessage || "تم تنفيذ العملية بنجاح.");
      setConfirmDialog(null);
      if (result?.instantContract) {
        setInstantContract(result.instantContract);
      }
    } catch (err) {
      setActionMessage(err?.message || "تعذر تنفيذ العملية.");
    } finally {
      setBusyAction(false);
    }
  }

  function confirmCancelOffer(offer) {
    askConfirm({
      title: "إلغاء العرض؟",
      body: "سيتم تحرير المبلغ المحجوز، لكن رسوم التقديم لا ترجع.",
      confirmText: "نعم، إلغاء العرض",
      tone: "danger",
      successMessage: "تم إلغاء العرض.",
      onConfirm: async () => onCancelOffer?.(offer),
    });
  }

  function confirmAcceptOffer(offer) {
    askConfirm({
      title: "قبول العرض؟",
      body: isMarketOpen
        ? "سيتم قبول العرض وتسجيل الصفقة فورًا."
        : "سيتم قبول العرض ووضع الصفقة بانتظار فتح سوق الانتقالات.",
      confirmText: "قبول العرض",
      tone: "success",
      successMessage: "تم قبول العرض.",
      onConfirm: async () => onAcceptOffer?.(offer.id),
    });
  }

  function confirmRejectOffer(offer) {
    askConfirm({
      title: "رفض العرض؟",
      body: "سيتم رفض العرض وإبلاغ العضو مقدم العرض.",
      confirmText: "رفض العرض",
      tone: "danger",
      successMessage: "تم رفض العرض.",
      onConfirm: async () => onRejectOffer?.(offer.id),
    });
  }

  function confirmReleasePlayer() {
    askConfirm({
      title: "استغناء عن اللاعب؟",
      body: "سيتم إنهاء عقد اللاعب مع قائمتك ونقله إلى قائمة اللاعبين الأحرار ليصبح متاحًا للتسجيل خلال سوق الانتقالات.",
      confirmText: "تأكيد الاستغناء",
      tone: "danger",
      successMessage: "تم تسجيل الاستغناء.",
      onConfirm: async () => onReleasePlayer?.(player),
    });
  }

  function confirmTerminateLoan() {
    const isOriginalOwner = same(activeContract?.originalOwnerMemberId || activeContract?.ownerMemberId, currentMemberId);
    askConfirm({
      title: "فسخ عقد الإعارة؟",
      body: isOriginalOwner
        ? "سيعود اللاعب لقائمتك، ويسترد المستعير مبلغ الإعارة مع تعويض 10,000,000."
        : "سيعود اللاعب لمالكه الأصلي، وستدفع تعويض 10,000,000 وتخسر مبلغ الإعارة.",
      confirmText: "تأكيد الفسخ",
      tone: "danger",
      successMessage: "تم فسخ عقد الإعارة.",
      onConfirm: async () => onTerminateLoan?.(activeContract),
    });
  }

  function confirmRegisterFreeAgentFee() {
    askConfirm({
      title: freeAgentActionIsReplacement ? "تبديل اللاعب الحر؟" : "تسجيل اللاعب الحر؟",
      body: freeAgentActionIsReplacement
        ? (isMarketOpen ? "سيتم خصم 5,000,000 وتنفيذ تبديل اللاعب الحر فورًا." : "سيتم حفظ طلب التبديل وخصم 5,000,000 عند فتح سوق الانتقالات إذا توفر الرصيد.")
        : (isMarketOpen ? "سيتم تسجيل هذا اللاعب كلاعب حر فورًا وبدون رسوم." : "سيتم حفظ طلب تسجيل هذا اللاعب الحر وتنفيذه عند فتح سوق الانتقالات بدون رسوم."),
      confirmText: freeAgentActionIsReplacement ? "تأكيد التبديل" : "تأكيد التسجيل",
      tone: "success",
      successMessage: freeAgentActionIsReplacement ? (isMarketOpen ? "تم تبديل اللاعب الحر وخصم الرسوم." : "تم حفظ طلب تبديل اللاعب الحر.") : (isMarketOpen ? "تم تسجيل اللاعب الحر بدون رسوم." : "تم حفظ طلب تسجيل اللاعب الحر."),
      onConfirm: async () => onRegisterFreeAgentFee?.(player),
    });
  }

  return (
    <section className="playerDetailSubPage glassSoft">
      <button className="backToMembersBtn" type="button" onClick={onBack}>← قائمة اللاعبين</button>

      <div className="playerDetailHero">
        <div className="playerDetailImageBox">
          <img src={player.image || avatar(player.name)} alt={player.name || ""} />
        </div>
        <div className="playerDetailInfo">
          <small>{ownerIntroText}</small>
          <h2>{player.name || "لاعب"}</h2>
          <div className="playerDetailChips">
            <span>{player.position || "مركز غير محدد"}</span>
            <span>{getPlayerRosterKindLabel(player, playerContracts, effectiveOwnerId || currentMemberId)}</span>
            {player.team ? <span>{player.team}</span> : null}
          </div>
        </div>
        <strong className="playerDetailRating">{player.rating || "-"}</strong>
      </div>

      <div className="playerDetailStatsGrid">
        <div><small>المركز</small><b>{player.position || "-"}</b></div>
        <div><small>حالة اللاعب</small><b>{getPlayerRosterKindLabel(player, playerContracts, effectiveOwnerId || currentMemberId)}</b></div>
        <div><small>التقييم</small><b>{player.rating || "-"}</b></div>
        <div><small>{activeContractType === "loan" ? "المالك الحقيقي" : "المالك"}</small><b>{realOwnerNameForDisplay}</b></div>
      </div>

      {playerReleased ? (
        <section className="playerDealStatus glassSoft danger">
          <b>تم الاستغناء عن اللاعب</b>
          <p>تم إنهاء عقد هذا اللاعب وخروجه من اللعبة نهائيًا.</p>
          <small>لا يمكن تقديم عروض شراء أو إعارة على هذا اللاعب ولا يمكن إعادته لأي قائمة.</small>
        </section>
      ) : null}

      {acceptedDeal ? (
        <section className="playerDealStatus glassSoft">
          <b>{acceptedDealStatus === "completed" ? "صفقة مكتملة" : "صفقة مقبولة بانتظار فتح السوق"}</b>
          <p>
            تم قبول عرض من {acceptedDeal.fromMemberName || getMemberName(members, acceptedDeal.fromMemberId)}
            {toNumber(acceptedDeal.amount) ? " بقيمة " + formatMoney(acceptedDeal.amount) : " بدون مبلغ مالي"}.
          </p>
          <small>هذا اللاعب غير متاح لعروض جديدة حتى يتم إلغاء الصفقة أو تحديث حالتها من الإدارة.</small>
        </section>
      ) : null}

      {playerBlocksNewOffer && !acceptedDeal ? (
        <section className="playerDealStatus glassSoft">
          <b>{activeContract.contractType === "loan" ? "عقد إعارة نشط" : "عقد ملكية نشط"}</b>
          <p>
            اللاعب حاليًا في قائمة {getMemberName(members, activeContract.currentMemberId)}
            {activeContract.contractType === "loan" && activeContract.loanDurationMonths ? " بعقد إعارة لمدة " + activeContract.loanDurationMonths + " شهور" : ""}.
          </p>
          <small>العقد النشط يحدد نوع العروض المتاحة لهذا اللاعب.</small>
        </section>
      ) : null}

      {canMakeOffer && !playerReleased && !acceptedDeal && !playerBlocksNewOffer ? (
        <div className="playerDetailActions">
          {!existingOffer ? (
            <button type="button" className="playerDetailPrimaryBtn" onClick={() => onOffer?.(player, null)}>
              التقدم بعرض
            </button>
          ) : canCancelOffer ? (
            <>
              {canEdit ? (
                <button type="button" className="playerDetailPrimaryBtn edit" onClick={() => onOffer?.(player, existingOffer)}>
                  تعديل العرض
                </button>
              ) : null}
              <button type="button" className="playerDetailPrimaryBtn cancel" onClick={() => confirmCancelOffer(existingOffer)}>
                إلغاء العرض
              </button>
            </>
          ) : (
            <div className="playerDetailNotice">{playerOfferStatusMessage(existingOfferStatus)}</div>
          )}
        </div>
      ) : null}

      {(isOwner || canTerminateLoan || canRegisterFreeAgentFee) ? (
        <section className="playerOwnerTools glassSoft">
          <div className="playerOwnerToolsHead">
            <div>
              <b>إدارة اللاعب</b>
              <small>{isMarketOpen ? "سوق الانتقالات مفتوح الآن" : "التنفيذ النهائي ينتظر فتح السوق"}</small>
            </div>
            {isOwner ? (
              canReleasePlayer ? (
                <button type="button" className="playerReleaseBtn" onClick={confirmReleasePlayer}>استغناء عن اللاعب</button>
              ) : playerRosterKindForOwner !== "free" ? (
                <span className="playerOwnerLockedNote">
                  {playerReleased
                    ? "تم الاستغناء عن هذا اللاعب"
                    : !isMarketOpen
                    ? "الاستغناء متاح فقط خلال فترة الانتقالات"
                    : toNumber(ownerPlayerCount) <= MIN_SQUAD_PLAYERS
                    ? "لا يمكن الاستغناء عندما تكون القائمة 17 لاعبًا"
                    : "لا يمكن الاستغناء عن لاعب مرتبط بعقد أو صفقة مقبولة"}
                </span>
              ) : null
            ) : null}
            {activeContractType === "loan" ? (
              canTerminateLoan ? (
                <button type="button" className="playerReleaseBtn" onClick={confirmTerminateLoan}>فسخ الإعارة</button>
              ) : (
                <span className="playerOwnerLockedNote">فسخ الإعارة متاح فقط لأطراف العقد خلال فترة الانتقالات</span>
              )
            ) : null}
            {canRegisterFreeAgentFee ? (
              <button type="button" className="playerReleaseBtn freeAgentFeeBtn" onClick={confirmRegisterFreeAgentFee}>
                {freeAgentActionIsReplacement ? "تبديل اللاعب الحر" : "تسجيل اللاعب الحر"}
              </button>
            ) : null}
          </div>

          <div className="incomingOffersBox">
            <h3>استعراض العروض المقدمة</h3>
            {receivedOffers.length ? (
              <div className="incomingOffersList">
                {receivedOffers.map((offer) => (
                  <article className="incomingOfferCard" key={offer.id}>
                    <div className="incomingOfferTop">
                      <b>{offer.fromMemberName || getMemberName(members, offer.fromMemberId)}</b>
                      <span>{offer.type === "loan" ? "عقد إعارة" : "عقد شراء"}</span>
                    </div>
                    <div className="incomingOfferMeta">
                      <span><small>المبلغ</small><strong>{formatMoney(offer.amount || 0)}</strong></span>
                      {offer.type === "loan" ? <span><small>المدة</small><strong>{offer.loanDurationMonths || "-"} شهور</strong></span> : null}
                      <span><small>لاعبون مقابل الصفقة</small><strong>{Array.isArray(offer.offeredPlayers) ? offer.offeredPlayers.length : 0}</strong></span>
                    </div>
                    {Array.isArray(offer.offeredPlayers) && offer.offeredPlayers.length ? (
                      <div className="incomingOfferedPlayers">
                        {offer.offeredPlayers.map((item) => (
                          <span key={item.playerId || item.playerName}>{item.playerName} • {exchangeContractLabel(item)}</span>
                        ))}
                      </div>
                    ) : null}
                    {offer.notes ? <p className="incomingOfferNotes">{offer.notes}</p> : null}
                    <div className="incomingOfferActions">
                      <button type="button" className="accept" onClick={() => confirmAcceptOffer(offer)}>الموافقة على العرض</button>
                      <button type="button" className="reject" onClick={() => confirmRejectOffer(offer)}>رفض العرض</button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty">لا توجد عروض نشطة على هذا اللاعب حالياً.</div>
            )}
          </div>
        </section>
      ) : !canMakeOffer ? (
        <div className="playerDetailNotice">لا توجد إجراءات متاحة لهذا اللاعب حاليًا.</div>
      ) : null}

      {actionMessage ? <div className="moneyModalMessage">{actionMessage}</div> : null}

      {instantContract ? (
        <TransferContractModal row={instantContract.row} player={instantContract.player} logoUrl={logoUrl} onClose={() => setInstantContract(null)} />
      ) : null}

      {confirmDialog ? (
        <ConfirmDialog
          title={confirmDialog.title}
          body={confirmDialog.body}
          confirmText={confirmDialog.confirmText}
          tone={confirmDialog.tone}
          busy={busyAction}
          onCancel={() => !busyAction && setConfirmDialog(null)}
          onConfirm={runConfirmedAction}
        />
      ) : null}
    </section>
  );
}

function ConfirmDialog({ title, body, confirmText, tone, busy, onCancel, onConfirm }) {
  return createPortal(
    <div className="fgConfirmBackdrop" onClick={onCancel}>
      <section className="fgConfirmBox glass" onClick={(event) => event.stopPropagation()} dir="rtl">
        <div className={tone === "danger" ? "fgConfirmIcon danger" : tone === "success" ? "fgConfirmIcon success" : "fgConfirmIcon"}>
          {tone === "danger" ? "!" : "✓"}
        </div>
        <h3>{title || "تأكيد العملية"}</h3>
        <p>{body || "هل تريد المتابعة؟"}</p>
        <div className="fgConfirmActions">
          <button type="button" className="secondary" onClick={onCancel} disabled={busy}>لا</button>
          <button type="button" className={tone === "danger" ? "danger" : "primary"} onClick={onConfirm} disabled={busy}>
            {busy ? "جارٍ التنفيذ..." : confirmText || "نعم"}
          </button>
        </div>
      </section>
    </div>,
    document.body
  );
}


function PlayerOfferAction({ player, currentMemberId, playerOffers, onOffer, onCancelOffer }) {
  const playerId = getPlayerStableId(player);
  const existingOffer = (playerOffers || []).find((offer) =>
    same(offer.fromMemberId, currentMemberId) &&
    same(offer.targetPlayerId, playerId) &&
    isActivePlayerOfferStatus(offer.status) &&
    !isOfferExpired(offer)
  );

  if (!existingOffer) {
    return (
      <div className="playerOfferActions oneAction">
        <button type="button" className="playerOfferButton" onClick={() => onOffer?.(player, null)}>
          تقديم عرض
        </button>
      </div>
    );
  }

  const canEdit = toNumber(existingOffer.editCount) < toNumber(existingOffer.maxEdits || 1);

  if (canEdit) {
    return (
      <div className="playerOfferActions forceTwoActions">
        <button type="button" className="playerOfferButton edit" onClick={() => onOffer?.(player, existingOffer)}>
          تعديل العرض
        </button>
        <button type="button" className="playerOfferButton cancel" onClick={() => onCancelOffer?.(existingOffer)}>
          إلغاء العرض
        </button>
      </div>
    );
  }

  return (
    <div className="playerOfferActions oneAction">
      <button type="button" className="playerOfferButton cancel" onClick={() => onCancelOffer?.(existingOffer)}>
        إلغاء العرض
      </button>
    </div>
  );
}

function MemberTrophiesSection({ rows, member, onOpenView }) {
  return (
    <section className="sectionBox glassSoft">
      <div className="sectionHead compact">
        <div>
          <h3>بطولات {member.name}</h3>
          <p>اضغط على أي بطولة لفتح صفحة تفاصيل كاملة.</p>
        </div>
      </div>
      <div className="trophyGrid">
        {rows.length ? (
          rows.map((item) => (
            <button
              className="trophyCard won"
              key={item.trophyId}
              onClick={() =>
                onOpenView({ type: "memberTrophy", member, group: item })
              }
            >
              <img src={item.image || avatar(item.name)} alt="" />
              <h4>{item.name}</h4>
              <b>{item.count}</b>
            </button>
          ))
        ) : (
          <div className="empty">لا توجد بطولات مسجلة لهذا العضو.</div>
        )}
      </div>
    </section>
  );
}

function MemberStatsSection({ config, stats, member, members, onOpenView, onInfo }) {
  return (
    <section className="sectionBox glassSoft">
      <div className="sectionHead compact">
        <div>
          <h3>إحصائيات {member.name}</h3>
          <p>اضغط على الكروت لفتح التفاصيل.</p>
        </div>
      </div>
      <div className="statsPanelGrid">
        <StatCard
          icon={config.finalsPlayedIcon}
          value={stats.finalsPlayed}
          label="نهائيات خاضها"
          onClick={() =>
            onOpenView({
              type: "memberFinals",
              member,
              title: `نهائيات ${member.name}`,
              rows: stats.finals,
            })
          }
        />
        <StatCard
          icon={config.finalsWonIcon}
          value={stats.finalsWon}
          label="نهائيات فاز بها"
          onClick={() =>
            onOpenView({
              type: "memberFinals",
              member,
              title: `نهائيات فاز بها ${member.name}`,
              rows: stats.finals.filter((row) => row.result === "win"),
            })
          }
        />
        <StatCard
          icon={config.finalsLostIcon}
          value={stats.finalsLost}
          label="نهائيات خسرها"
          onClick={() =>
            onOpenView({
              type: "memberFinals",
              member,
              title: `نهائيات خسرها ${member.name}`,
              rows: stats.finals.filter((row) => row.result === "loss"),
            })
          }
        />
        <StatCard
          icon={config.goalsForIcon}
          value={stats.finalGoalsFor}
          label="أهداف سجلها"
          onClick={() =>
            onInfo(buildGoalsForMessage(stats, members, member.name))
          }
        />
        <StatCard
          icon={config.goalsAgainstIcon}
          value={stats.finalGoalsAgainst}
          label="أهداف تلقاها"
          onClick={() =>
            onInfo(buildGoalsAgainstMessage(stats, members, member.name))
          }
        />
        <StatCard icon={config.relegationsIcon} value={stats.relegations} label="مرات الهبوط" />
      </div>
    </section>
  );
}

function FinalsSubPage({ title, rows, members, onBack, onOpenView }) {
  const safeRows = Array.isArray(rows)
    ? rows.filter((item) => item && item.tournament)
    : [];
  const sorted = safeRows
    .slice()
    .sort((a, b) => sortByDateAsc(a.tournament, b.tournament));

  return (
    <main className="widePage glass finalsSubPage">
      <BackButton onBack={onBack} />
      <header className="pageHead">
        <h2>{title || "تفاصيل النهائيات"}</h2>
        <p>{sorted.length} نهائي مرتبة من الأقدم إلى الأحدث.</p>
      </header>

      <div className="finalsCardsList">
        {sorted.length ? (
          sorted.map((item, index) => {
            const row = item.tournament;
            const finalText =
              row.finalResult && row.finalResult !== "-"
                ? row.finalResult
                : row.notes && row.notes.includes("النهائي")
                ? String(row.notes).replace(/^النهائي\s*\/\s*/, "")
                : "";
            return (
              <button
                className={
                  item.result === "win" ? "finalsCard win" : "finalsCard loss"
                }
                key={row.id || index}
                onClick={() => onOpenView({ type: "record", record: row })}
              >
                <div className="finalsCardTop">
                  <span>{item.result === "win" ? "فوز" : "خسارة"}</span>
                  <b>
                    {row.trophyName ||
                      row.name ||
                      getTrophyDisplayName(row.trophyId) ||
                      row.trophyId}
                  </b>
                  <small>{row.date || "-"}</small>
                </div>

                <div className="finalsCardMeta">
                  <span>
                    <small>النسخة</small>
                    <b>{row.edition || "-"}</b>
                  </span>
                  <span>
                    <small>الخصم</small>
                    <b>{getMemberName(members, item.opponentId)}</b>
                  </span>
                  <span>
                    <small>الأهداف</small>
                    <b>
                      {item.goalsFor} - {item.goalsAgainst}
                    </b>
                  </span>
                </div>

                {finalText ? (
                  <strong className="finalsResultText">
                    النهائي: {finalText}
                  </strong>
                ) : null}
              </button>
            );
          })
        ) : (
          <div className="empty">لا توجد نهائيات مسجلة لهذا الاختيار.</div>
        )}
      </div>
    </main>
  );
}

function FinanceSection({ config, rows, member, members = [] }) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const memberId = cleanId(member?.id || member?.memberId || member?.memberid);
  const balance = computeMemberBalance(safeRows, 0, memberId);

  return (
    <section className="sectionBox glassSoft financeSectionBox">
      <div className="sectionHead compact financeSectionHead">
        <div>
          <h3>{config.financeTitle}</h3>
          <p>الحركات المالية المسجلة</p>
        </div>
        <div className="financeBalancePill">
          <small>الرصيد الحالي</small>
          <b>{formatMoney(balance)}</b>
        </div>
      </div>
      <div className="listGrid financeListGrid">
        {safeRows.length ? (
          safeRows.map((item, index) => {
            const direction = getFinanceDirection(item, memberId);
            const signedAmount = getFinanceSignedAmount(item, memberId);
            return (
              <article
                className={`financeCard ${financeTypeClass(item, memberId)}`}
                key={String(item.id || index)}
              >
                <b className="financeAmountValue">
                  {direction === "income" ? "+" : direction === "expense" ? "-" : ""}
                  {formatMoney(Math.abs(signedAmount))}
                </b>
                <div>
                  <strong>{getFinanceDisplayTitle(item, memberId, members)}</strong>
                  <span>{financeDirectionLabel(direction)}</span>
                  <small>{item.date || item.createdat || "-"}</small>
                  <p>{item.note || item.from || item.description || item.details || "-"}</p>
                </div>
              </article>
            );
          })
        ) : (
          <div className="empty">لا يوجد سجل مالي لهذا العضو.</div>
        )}
      </div>
    </section>
  );
}

function SeasonPage({
  config,
  activeSeason,
  groups,
  total,
  members,
  onOpenView,
}) {
  return (
    <main className="widePage glass seasonCardsPage">
      <header className="pageHead">
        <h2>{config.seasonTournamentsTitle}</h2>
        <p>
          {activeSeason?.seasonName || config.seasonName}: {total} بطولة مسجلة
          تلقائيًا من الأرشيف.
        </p>
      </header>

      <div className="seasonSimpleList">
        {groups.map((item) => (
          <button
            key={item.trophyId}
            className="seasonSimpleRow glassSoft"
            onClick={() =>
              onOpenView({
                type: "seasonTrophy",
                title: `${item.name} — ${activeSeason?.seasonName || "الموسم"}`,
                group: item,
              })
            }
          >
            <img src={item.image || avatar(item.name)} alt="" />
            <div>
              <b>{item.name}</b>
              <small>{item.count} نسخة</small>
            </div>
            <span>{renderSmartIcon(config.seasonCountIcon)} {item.count}</span>
            <span>{renderSmartIcon(config.seasonPointsIcon)} {item.points || 0}</span>
          </button>
        ))}
      </div>
    </main>
  );
}

function ArchivePage({
  config,
  seasons,
  allTournaments,
  members,
  trophyMap,
  onOpenView,
}) {
  const [archiveMode, setArchiveMode] = useState("trophy");

  const trophyRows = useMemo(() => {
    return groupByTrophy(allTournaments || [], trophyMap).sort(
      (a, b) =>
        b.count - a.count || String(a.name).localeCompare(String(b.name), "ar")
    );
  }, [allTournaments, trophyMap]);

  const memberRows = useMemo(() => {
    const map = {};
    (allTournaments || []).forEach((row) => {
      const memberId = cleanId(row.winnerId);
      if (!memberId) return;
      const member = (members || []).find((item) => same(item.id, memberId));
      if (!map[memberId]) {
        map[memberId] = {
          memberId,
          name: member?.name || memberId,
          avatar: member?.avatar || "",
          rows: [],
          trophyMap: {},
        };
      }
      map[memberId].rows.push(row);
      const trophyId = cleanId(row.trophyId);
      if (!map[memberId].trophyMap[trophyId]) {
        const trophy = trophyMap[trophyId] || {};
        map[memberId].trophyMap[trophyId] = {
          trophyId,
          name: trophy.name || row.trophyName || trophyId,
          image: trophy.image || "",
          count: 0,
        };
      }
      map[memberId].trophyMap[trophyId].count += 1;
    });

    return Object.values(map)
      .map((item) => ({
        ...item,
        total: item.rows.length,
        rows: sortRecordsAsc(item.rows),
        trophies: Object.values(item.trophyMap).sort(
          (a, b) =>
            b.count - a.count ||
            String(a.name).localeCompare(String(b.name), "ar")
        ),
      }))
      .sort(
        (a, b) =>
          b.total - a.total ||
          String(a.name).localeCompare(String(b.name), "ar")
      );
  }, [allTournaments, members, trophyMap]);

  return (
    <main className="widePage glass archiveHubPage">
      <header className="pageHead archiveHubHead">
        <h2>{config.archiveTitle}</h2>
        <p>اختر طريقة العرض: حسب البطولة، حسب الموسم، أو حسب العضو الفائز.</p>
      </header>

      <nav className="archiveModeTabs glassSoft">
        <button
          className={archiveMode === "trophy" ? "active" : ""}
          onClick={() => setArchiveMode("trophy")}
        >
          {renderSmartIcon(config.archiveTrophyTabIcon)} حسب البطولة
        </button>
        <button
          className={archiveMode === "season" ? "active" : ""}
          onClick={() => setArchiveMode("season")}
        >
          {renderSmartIcon(config.archiveSeasonTabIcon)} حسب الموسم
        </button>
        <button
          className={archiveMode === "member" ? "active" : ""}
          onClick={() => setArchiveMode("member")}
        >
          {renderSmartIcon(config.archiveMemberTabIcon)} حسب العضو
        </button>
      </nav>

      {archiveMode === "trophy" ? (
        <section className="archiveTrophyTable">
          {trophyRows.map((group, index) => (
            <button
              key={group.trophyId}
              className="archiveTrophyRow glassSoft"
              onClick={() =>
                onOpenView({
                  type: "archiveTrophy",
                  title: `${group.name} — جميع المواسم`,
                  group,
                })
              }
            >
              <span className="archiveRowRank">#{index + 1}</span>
              <img src={group.image || avatar(group.name)} alt="" />
              <b>{group.name}</b>
              <em>{group.count}</em>
            </button>
          ))}
        </section>
      ) : null}

      {archiveMode === "season" ? (
        <section className="archiveSeasonGrid bigArchiveGrid">
          {seasons.map((season) => (
            <article
              key={season.seasonId}
              className="archiveSeasonCard glassSoft"
            >
              <em>{season.count}</em>
              <h3>{season.seasonName}</h3>
              <p>
                {season.startDate || "-"} — {season.endDate || "الآن"}
              </p>
              <small>الأعضاء: {season.membersCount || "-"}</small>
              <div className="seasonTrophyChips">
                {season.groups.map((group) => (
                  <button
                    key={group.trophyId}
                    onClick={() =>
                      onOpenView({
                        type: "archiveTrophy",
                        title: `${group.name} — ${season.seasonName}`,
                        group,
                      })
                    }
                  >
                    <img src={group.image || avatar(group.name)} alt="" />
                    <span>{group.count}</span>
                  </button>
                ))}
              </div>
            </article>
          ))}
        </section>
      ) : null}

      {archiveMode === "member" ? (
        <section className="archiveMemberList">
          {memberRows.map((member, index) => (
            <button
              key={member.memberId}
              className="archiveMemberCard glassSoft"
              onClick={() =>
                onOpenView({
                  type: "archiveMemberWins",
                  title: `بطولات ${member.name} — كل المواسم`,
                  rows: member.rows,
                })
              }
            >
              <span className="archiveMemberRank">#{index + 1}</span>
              <img
                className="archiveMemberAvatar"
                src={member.avatar || avatar(member.name)}
                alt=""
              />
              <div className="archiveMemberInfo">
                <b>{member.name}</b>
                <div className="archiveMemberTrophies">
                  {member.trophies.map((trophy) => (
                    <span key={trophy.trophyId}>
                      <img src={trophy.image || avatar(trophy.name)} alt="" />
                      <strong>{trophy.count}</strong>
                    </span>
                  ))}
                </div>
              </div>
              <em>{member.total}</em>
            </button>
          ))}
        </section>
      ) : null}
    </main>
  );
}

function RankingPage({ config, rows, onOpenView }) {
  let lastPoints = null;
  let lastTitles = null;
  let lastRank = 0;
  return (
    <main className="widePage glass rankingPage">
      <header className="pageHead">
        <h2>{config.rankingTitle}</h2>
        <p>كل أعضاء الموسم يظهرون حتى بدون بطولة، والتعادل يعطي نفس المركز.</p>
      </header>
      <div className="rankingList rankingCompactList">
        {rows.map((row, index) => {
          const rank =
            row.points === lastPoints && row.titles === lastTitles
              ? lastRank
              : index + 1;
          lastPoints = row.points;
          lastTitles = row.titles;
          lastRank = rank;

          return (
            <button
              className={
                rank === 1
                  ? "rankingCard rankingCompactCard first clickable"
                  : "rankingCard rankingCompactCard clickable"
              }
              key={row.memberId}
              onClick={() =>
                onOpenView({
                  type: "rankingMemberWins",
                  member: row,
                  rows: row.rows,
                  title: `بطولات ${row.name} في الموسم`,
                })
              }
            >
              <span className="rankingRank">#{rank}</span>
              <img
                className="rankingAvatar"
                src={row.avatar || avatar(row.name)}
                alt=""
              />
              <div className="rankingIdentity">
                <b>{row.name}</b>
              </div>
              <div className="rankingSeasonLogos">
                {row.teamLogo ? <img src={row.teamLogo} alt="" /> : null}
                {row.nationalLogo ? (
                  <img src={row.nationalLogo} alt="" />
                ) : null}
              </div>
              <div className="rankingInlineStats">
                <span>{renderSmartIcon(config.rankingTitlesIcon)} {row.titles}</span>
                <span>{renderSmartIcon(config.rankingPointsIcon)} {row.points}</span>
              </div>
            </button>
          );
        })}
      </div>
    </main>
  );
}

function GeneralStatsPage({ config, statsMap, members, onOpenView }) {
  const rows = Object.values(statsMap)
    .filter((row) => getMemberName(members, row.memberId) !== row.memberId)
    .sort(
      (a, b) =>
        b.finalsPlayed - a.finalsPlayed ||
        b.finalsWon - a.finalsWon ||
        b.finalGoalsFor - a.finalGoalsFor
    );
  const topFinals = rows[0];
  const topWins = rows.slice().sort((a, b) => b.finalsWon - a.finalsWon)[0];
  const topGoals = rows
    .slice()
    .sort((a, b) => b.finalGoalsFor - a.finalGoalsFor)[0];
  const topRelegated = rows
    .slice()
    .sort((a, b) => b.relegations - a.relegations)[0];
  const maxFinals = Math.max(1, ...rows.map((r) => r.finalsPlayed));
  return (
    <main className="widePage glass">
      <header className="pageHead">
        <h2>{config.statsTitle}</h2>
        <p>نهائيات، أهداف، وهبوط الدوري محسوبة تلقائيًا من الأرشيف.</p>
      </header>
      <section className="statsPanelGrid generalTopStats">
        <StatCard
          icon={config.finalsPlayedIcon}
          value={topFinals ? getMemberName(members, topFinals.memberId) : "-"}
          label="الأكثر لعبًا"
        />
        <StatCard
          icon={config.finalsWonIcon}
          value={topWins ? getMemberName(members, topWins.memberId) : "-"}
          label="الأكثر فوزًا"
        />
        <StatCard
          icon={config.goalsForIcon}
          value={topGoals ? getMemberName(members, topGoals.memberId) : "-"}
          label="الأكثر تسجيلًا"
        />
        <StatCard
          icon={config.relegationsIcon}
          value={
            topRelegated ? getMemberName(members, topRelegated.memberId) : "-"
          }
          label="الأكثر هبوطًا"
        />
      </section>
      <div className="statsTable glassSoft">
        <div className="statsTableHead">
          <span>العضو</span>
          <span>نهائيات</span>
          <span>فاز</span>
          <span>خسر</span>
          <span>سجل</span>
          <span>استقبل</span>
          <span>هبوط</span>
        </div>
        {rows.map((row) => (
          <button
            className="statsTableRow clickable"
            key={row.memberId}
            onClick={() =>
              onOpenView({
                type: "memberFinals",
                member: {
                  id: row.memberId,
                  name: getMemberName(members, row.memberId),
                },
                title: `نهائيات ${getMemberName(members, row.memberId)}`,
                rows: row.finals,
              })
            }
          >
            <b>{getMemberName(members, row.memberId)}</b>
            <span>{row.finalsPlayed}</span>
            <span>{row.finalsWon}</span>
            <span>{row.finalsLost}</span>
            <span>{row.finalGoalsFor}</span>
            <span>{row.finalGoalsAgainst}</span>
            <span>{row.relegations}</span>
            <i
              style={{
                width: `${Math.round((row.finalsPlayed / maxFinals) * 100)}%`,
              }}
            />
          </button>
        ))}
      </div>
    </main>
  );
}

function TransfersPage({
  config,
  periods,
  activePeriodId,
  setTransferPeriod,
  rows,
  players,
  members = [],
  currentMember,
  currentMemberId,
  playerContracts = [],
  freeAgentQueue = [],
  onOpenView,
}) {
  const [selectedTransfer, setSelectedTransfer] = useState(null);
  const [transferSearch, setTransferSearch] = useState("");
  const [marketTab, setMarketTab] = useState("history");
  const [freeAgentFilter, setFreeAgentFilter] = useState("all");
  const normalizedTransferSearch = clean(transferSearch);

  const filteredTransferRows = (rows || []).filter((row) => {
    if (!normalizedTransferSearch) return true;
    return clean([
      row.playerName,
      row.player,
      row.name,
      row.from,
      row.to,
      row.fromMemberName,
      row.toMemberName,
      row.type,
      row.typeLabel,
      row.note,
      row.period,
      row.periodName,
      row.date,
    ].join(" ")).includes(normalizedTransferSearch);
  });

  const allFreeAgents = (players || [])
    .map((player) => {
      const playerId = getPlayerStableId(player);
      const activeContract = (playerContracts || []).find((contract) =>
        same(contract.playerId, playerId) && clean(contract.status || "active") === "active"
      );
      const pendingQueue = (freeAgentQueue || []).find((item) =>
        same(item.newPlayerId, playerId) && ["pending_window", "processing"].includes(clean(item.status || "pending_window"))
      );
      const freeAgentPoolAvailable = isFreeAgentPoolContract(activeContract);
      const freeAgentStatusKey = activeContract && !freeAgentPoolAvailable ? "registered" : pendingQueue ? "pending" : "available";
      return { ...player, activeContract, pendingQueue, freeAgentStatusKey, freeAgentPoolAvailable };
    })
    .filter((player) => isFreeAgentPlayer(player) || player.freeAgentPoolAvailable)
    .filter((player) => freeAgentFilter === "all" || player.freeAgentStatusKey === freeAgentFilter)
    .filter((player) => {
      if (!normalizedTransferSearch) return true;
      const status = player.activeContract ? "مسجل" : player.pendingQueue ? "محجوز" : "متاح";
      return clean([player.name, player.position, player.team, player.rating, player.playerType, status].join(" ")).includes(normalizedTransferSearch);
    })
    .sort((a, b) => toNumber(b.rating) - toNumber(a.rating));

  const availableFreeCount = allFreeAgents.filter((player) => !player.activeContract && !player.pendingQueue).length;

  function getTransferPlayer(row) {
    const playerId = cleanId(row.playerid || row.playerId || row.playerID || row.player_id);
    const fallbackName = row.playerName || row.name || row.player || "لاعب غير مسجل";
    const found = playerId
      ? (players || []).find((player) => same(getPlayerStableId(player), playerId))
      : (players || []).find((player) => clean(player.name) === clean(fallbackName));
    if (!found)
      return {
        name: fallbackName,
        image: row.playerImage || FALLBACK_PLAYER_IMAGE,
        rating: row.playerRating || "",
        position: row.playerPosition || "",
        isFallback: true,
      };
    return {
      name: row.playerName || row.name || found.name || fallbackName,
      image: row.playerImage || found.image || FALLBACK_PLAYER_IMAGE,
      rating: row.playerRating || found.rating || "",
      position: row.playerPosition || found.position || "",
      isFallback: false,
    };
  }

  function openTransfer(row, player) {
    setSelectedTransfer({ row, player });
  }

  return (
    <main className="widePage glass">
      <header className="pageHead">
        <h2>سوق الانتقالات</h2>
        <p>سجل الصفقات واللاعبون الأحرار في مكان واحد، مع بحث داخل كل صفحة فرعية.</p>
      </header>

      <nav className="tabs">
        <button className={marketTab === "history" ? "tabBtn active" : "tabBtn"} onClick={() => setMarketTab("history")}>سجل الانتقالات</button>
        <button className={marketTab === "free" ? "tabBtn active" : "tabBtn"} onClick={() => setMarketTab("free")}>اللاعبون الأحرار</button>
      </nav>

      {marketTab === "history" ? (
        <>
          <label className="transferSearchBox glassSoft">
            <span>بحث في سجل الانتقالات</span>
            <input
              value={transferSearch}
              onChange={(event) => setTransferSearch(event.target.value)}
              placeholder="ابحث باسم لاعب، عضو، نوع صفقة، تاريخ..."
            />
          </label>
          <nav className="tabs">
            {periods.map((period, index) => (
              <button
                key={period.id}
                className={same(period.id, activePeriodId) ? "tabBtn active" : "tabBtn"}
                onClick={() => setTransferPeriod(period.id)}
              >
                {period.name || `الفترة ${index + 1}`}
              </button>
            ))}
          </nav>
          <div className="listGrid transferList">
            {filteredTransferRows.length ? filteredTransferRows.map((row, index) => {
              const player = getTransferPlayer(row);
              return (
                <article className={`transferCard ${transferTypeClass(row.typeLabel || row.type)}`} key={String(row.id || index)}>
                  <img className={player.isFallback ? "transferAvatar fallbackTransferAvatar" : "transferAvatar"} src={player.image} alt={player.name} />
                  <div className="transferMain">
                    <h3>{player.name}</h3>
                    <p><span>{row.fromMemberName || row.from}</span><b>←</b><span>{row.toMemberName || row.to}</span></p>
                  </div>
                  {player.rating ? <strong className="transferRating">{player.rating}</strong> : null}
                  <div className="transferBadges">
                    <small>{renderSmartIcon(config.transferAmountIcon)} {formatMoney(row.amount || 0)}</small>
                    <small>{renderSmartIcon(config.transferTypeIcon)} {row.typeLabel || row.type}</small>
                    <small>{renderSmartIcon(config.transferDateIcon)} {row.date}</small>
                    <small>{isLoanTransferRow(row) ? "⏳ " + loanDurationLabel(row.loanDurationMonths) : renderSmartIcon(config.transferNoteIcon) + " " + (row.note && row.note !== "-" ? row.note : "-")}</small>
                  </div>
                  {Array.isArray(row.offeredPlayers) && row.offeredPlayers.length ? (
                    <div className="transferSwapPreview">
                      {row.offeredPlayers.map((item, swapIndex) => (
                        <span key={item.playerId || item.playerName || swapIndex}>
                          <img src={item.playerImage || item.image || FALLBACK_PLAYER_IMAGE} alt="" />
                          <b>{item.playerName || item.name || "لاعب"} • {exchangeContractLabel(item)}</b>
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <button type="button" className="transferContractBtn" onClick={() => openTransfer(row, player)}>العقد الخاص بالصفقة</button>
                </article>
              );
            }) : <div className="empty">لا توجد انتقالات مطابقة لهذا البحث في هذه الفترة.</div>}
          </div>
        </>
      ) : (
        <section className="freeAgentsTransferSection glassSoft">
          <label className="transferSearchBox glassSoft">
            <span>بحث في اللاعبين الأحرار</span>
            <input
              value={transferSearch}
              onChange={(event) => setTransferSearch(event.target.value)}
              placeholder="ابحث باسم لاعب، مركز، فريق أو تقييم..."
            />
          </label>
          <div className="sectionHead compact">
            <div>
              <h3>اللاعبون الأحرار</h3>
              <p>كل اللاعبين الأحرار الموجودين في الشيت، مع حالة كل لاعب.</p>
            </div>
            <strong>{allFreeAgents.length}</strong>
          </div>
          <nav className="tabs freeAgentFilters">
            <button className={freeAgentFilter === "all" ? "tabBtn active" : "tabBtn"} onClick={() => setFreeAgentFilter("all")}>الكل</button>
            <button className={freeAgentFilter === "available" ? "tabBtn active" : "tabBtn"} onClick={() => setFreeAgentFilter("available")}>متاح</button>
            <button className={freeAgentFilter === "registered" ? "tabBtn active" : "tabBtn"} onClick={() => setFreeAgentFilter("registered")}>مسجل</button>
            <button className={freeAgentFilter === "pending" ? "tabBtn active" : "tabBtn"} onClick={() => setFreeAgentFilter("pending")}>بانتظار القيد</button>
          </nav>
          <div className="playersGrid freeAgentsGrid">
            {allFreeAgents.length ? allFreeAgents.map((player, index) => {
              const unavailable = Boolean((player.activeContract && !player.freeAgentPoolAvailable) || player.pendingQueue);
              const statusLabel = player.activeContract && !player.freeAgentPoolAvailable ? "مسجل" : player.pendingQueue ? "بانتظار القيد" : "متاح";
              const currentOwner = player.activeContract && !player.freeAgentPoolAvailable ? getMemberName(members, player.activeContract.currentMemberId) : "";
              return (
                <article
                  className={unavailable ? "playerCard clickable freeAgentUnavailable" : "playerCard clickable"}
                  key={String(getPlayerStableId(player) || player.name || index)}
                  onClick={() => {
                    const ownerMember = player.activeContract && !player.freeAgentPoolAvailable && player.activeContract.currentMemberId
                      ? members.find((member) => same(member.id, player.activeContract.currentMemberId))
                      : { id: "", name: "" };
                    if (!onOpenView) return;
                    onOpenView({ type: "playerDetailOffer", player, ownerMember });
                  }}
                >
                  <img className="playerPhoto" src={player.image || avatar(player.name)} alt="" />
                  <div className="playerInfo">
                    <h4>{player.name}</h4>
                    <p className="playerMeta">
                      <span className="playerPosition">{player.position || "-"}</span>
                      <span className="playerContract">{statusLabel}</span>
                      {currentOwner ? <span className="playerContract">{currentOwner}</span> : null}
                    </p>
                  </div>
                  <b className="playerRating">{player.rating || "-"}</b>
                </article>
              );
            }) : <div className="empty">لا توجد لاعبين أحرار مطابقين للبحث.</div>}
          </div>
        </section>
      )}

      {selectedTransfer ? (
        <TransferContractModal row={selectedTransfer.row} player={selectedTransfer.player} logoUrl={exportBrandLogoUrl(config)} onClose={() => setSelectedTransfer(null)} />
      ) : null}
    </main>
  );
}

function TransferContractModal({ row, player, logoUrl = "", onClose }) {
  const parties = getTransferContractParties(row);
  const loan = isLoanTransferRow(row);
  const contractTitle = row?.typeLabel || (loan ? "عقد إعارة" : clean(row?.type) === "buy" ? "عقد شراء" : row?.type || "صفقة");
  const amountLabel = formatMoney(row?.amount || row?.rawAmount || row?.amountNumber || 0);
  const offeredPlayers = Array.isArray(row?.offeredPlayers) ? row.offeredPlayers : [];

  function handleDownload() {
    downloadTransferContractImage(row, player, logoUrl);
  }

  return createPortal(
    <div className="offerModalBackdrop" onClick={onClose}>
      <section className="transferContractModal glass" onClick={(event) => event.stopPropagation()} dir="rtl">
        <header>
          <div>
            <small>FIFA GROUP</small>
            <h3>العقد الخاص بالصفقة</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="إغلاق">×</button>
        </header>

        <div className="transferContractCard glassSoft">
          <div className="contractWatermark">FG</div>
          <div className="contractTopLine">
            <span>{row?.period || row?.periodName || "سوق الانتقالات"}</span>
            <b>{contractTitle}</b>
          </div>
          <div className="contractPlayerBlock">
            <img src={player?.image || row?.playerImage || FALLBACK_PLAYER_IMAGE} alt="" />
            <div>
              <h2>{player?.name || row?.playerName || row?.player || "لاعب"}</h2>
              <p>{player?.position || row?.playerPosition || ""}</p>
            </div>
            <strong>{player?.rating || row?.playerRating || "-"}</strong>
          </div>
          <div className="contractRoute">
            <div><small>{parties.fromLabel}</small><b>{parties.from}</b></div>
            <span>←</span>
            <div><small>{parties.toLabel}</small><b>{parties.to}</b></div>
          </div>
          <div className="contractMetaGrid">
            <div><small>قيمة الصفقة</small><b>{amountLabel}</b></div>
            {loan ? <div><small>مدة الإعارة</small><b>{loanDurationLabel(row?.loanDurationMonths)}</b></div> : null}
            {loan ? <div><small>بداية الإعارة</small><b>{row?.loanStartDate || row?.date || formatTransferDate(row?.createdAt)}</b></div> : null}
            <div><small>تاريخ الإصدار</small><b>{formatContractIssuedAt(row)}</b></div>
            <div><small>الحالة</small><b>{effectiveTransferStatusLabel(row)}</b></div>
          </div>
          {offeredPlayers.length ? (
            <div className="contractSwapPlayers">
              <small>لاعبون ضمن المقابل</small>
              <div>
                {offeredPlayers.map((item, index) => (
                  <span key={item.playerId || item.playerName || index}>
                    <img src={item.playerImage || item.image || FALLBACK_PLAYER_IMAGE} alt="" />
                    <b>{item.playerName || item.name || "لاعب"} • {exchangeContractLabel(item)}</b>
                  </span>
                ))}
              </div>
            </div>
          ) : null}
          <div className="contractSignatures">
            <div><span /> <b>{parties.from || "الطرف الأول"}</b><small>{parties.signerFromLabel}</small></div>
            <div><span /> <b>{parties.to || "الطرف الثاني"}</b><small>{parties.signerToLabel}</small></div>
          </div>
        </div>

        <button type="button" className="offerSubmitBtn" onClick={handleDownload}>حفظ العقد كصورة PNG</button>
      </section>
    </div>,
    document.body
  );
}

function LinksPage({ config, links }) {
  return (
    <main className="widePage glass">
      <header className="pageHead">
        <h2>{config.linksTitle}</h2>
        <p>{config.linksSubtitle}</p>
      </header>
      <div className="linkGrid">
        {links.map((link, index) => (
          <a
            className="linkTile glassSoft"
            href={link.link}
            target="_blank"
            rel="noreferrer"
            key={String(index)}
          >
            <span>{renderSmartIcon(linkIcon(link.name, config))}</span>
            <b>{link.name}</b>
            <small>فتح الرابط</small>
          </a>
        ))}
      </div>
    </main>
  );
}

function DetailPage({
  config = DEFAULT_CONFIG,
  view,
  members,
  players,
  finance,
  trophyMap = {},
  playerContracts = [],
  freeAgentRegistrations = [],
  freePlayerStatus = [],
  freeAgentQueue = [],
  currentMemberId,
  currentMember,
  playerOffers,
  isMarketOpen,
  onBack,
  onOpenView,
  onInfo,
  onAcceptOffer,
  onRejectOffer,
  onReleasePlayer,
  onTerminateLoan,
  onRegisterFreeAgentFee,
}) {
  if (!view) return null;
  if (view.type === "playerDetailOffer")
    return (
      <main className="widePage glass">
        <BackButton onBack={onBack} />
        <PlayerDetailSubPage
          player={view.player}
          ownerMember={view.ownerMember}
          currentMemberId={currentMemberId}
          currentMember={currentMember}
          playerOffers={playerOffers}
          playerContracts={playerContracts}
          freeAgentRegistrations={freeAgentRegistrations}
          freePlayerStatus={freePlayerStatus}
          freeAgentQueue={freeAgentQueue}
          ownerPlayerCount={(players || []).filter((item) => same(item.memberid, view.ownerMember?.id) && !isPlayerReleasedByContracts(playerContracts, getPlayerStableId(item))).length}
          canMakeOffer={Boolean(currentMemberId && view.ownerMember?.id && !same(currentMemberId, view.ownerMember.id))}
          isMarketOpen={isMarketOpen}
          members={members}
          onBack={onBack}
          onOffer={() => {}}
          onCancelOffer={() => {}}
          onAcceptOffer={onAcceptOffer}
          onRejectOffer={onRejectOffer}
          onReleasePlayer={onReleasePlayer}
          onTerminateLoan={onTerminateLoan}
          onRegisterFreeAgentFee={onRegisterFreeAgentFee}
        />
      </main>
    );
  if (view.type === "record")
    return (
      <RecordDetailPage
        record={view.record}
        members={members}
        onBack={onBack}
      />
    );
  if (view.type === "memberTrophy")
    return (
      <RecordsSubPage
        title={`${view.group.name} — ${view.group.count} بطولة`}
        subtitle={`بطولات ${view.member.name}`}
        rows={view.group.rows}
        members={members}
        hideWinner
        onBack={onBack}
        onOpenView={onOpenView}
      />
    );
  if (view.type === "memberAllTrophies")
    return (
      <MemberAllTrophiesSubPage
        member={view.member}
        groups={view.groups}
        onBack={onBack}
        onOpenView={onOpenView}
      />
    );
  if (view.type === "memberFinance")
    return (
      <main className="widePage glass">
        <BackButton onBack={onBack} />
        <header className="pageHead">
          <h2>السجل المالي — {view.member.name}</h2>
          <p>كل الحركات المالية الخاصة بالعضو.</p>
        </header>
        <FinanceSection
          config={{ financeTitle: "السجل المالي" }}
          rows={view.rows || []}
          member={view.member}
          members={members}
        />
      </main>
    );
  if (view.type === "memberPlayers")
    return (
      <main className="widePage glass">
        <BackButton onBack={onBack} />
        <header className="pageHead">
          <h2>لاعبو {view.member.name}</h2>
          <p>قائمة لاعبي العضو.</p>
        </header>
        <PlayersSection
          config={{
            playersTitle: "قائمة اللاعبين",
            showSearch: "false",
            searchPlaceholder: "",
          }}
          rows={view.rows || []}
          search=""
          setSearch={() => {}}
          playerCount={(view.rows || []).length}
        />
      </main>
    );
  if (view.type === "memberFinals")
    return (
      <FinalsSubPage
        title={view.title}
        rows={view.rows || []}
        members={members}
        onBack={onBack}
        onOpenView={onOpenView}
      />
    );
  if (view.type === "seasonTrophy" || view.type === "archiveTrophy")
    return (
      <RecordsSubPage
        title={view.title}
        rows={view.group.rows}
        members={members}
        onBack={onBack}
        onOpenView={onOpenView}
      />
    );
  if (view.type === "rankingMemberWins") {
    const groups = groupByTrophy(view.rows || [], trophyMap);
    return (
      <MemberAllTrophiesSubPage
        member={{ name: view.member?.name || "العضو" }}
        groups={groups}
        onBack={onBack}
        onOpenView={onOpenView}
      />
    );
  }
  if (view.type === "archiveMemberWins")
    return (
      <RecordsSubPage
        title={view.title}
        subtitle="كل البطولات التي فاز بها العضو في جميع المواسم."
        rows={view.rows || []}
        members={members}
        hideWinner
        onBack={onBack}
        onOpenView={onOpenView}
      />
    );
  return (
    <main className="widePage glass">
      <BackButton onBack={onBack} />
      <div className="empty">لا توجد تفاصيل متاحة لهذا الكرت.</div>
    </main>
  );
}

function BackButton({ onBack }) {
  return (
    <button className="floatingBackBtn" onClick={onBack} aria-label="رجوع">
      <span>←</span>
    </button>
  );
}

function MemberAllTrophiesSubPage({ member, groups, onBack, onOpenView }) {
  return (
    <main className="widePage glass">
      <BackButton onBack={onBack} />
      <header className="pageHead">
        <h2>بطولات {member.name}</h2>
        <p>كل البطولات التي فاز بها العضو مجمعة حسب نوع البطولة.</p>
      </header>
      <div className="trophyGrid">
        {groups.length ? (
          groups.map((group) => (
            <button
              className="trophyCard won"
              key={group.trophyId}
              onClick={() =>
                onOpenView({ type: "memberTrophy", member, group })
              }
            >
              <img src={group.image || avatar(group.name)} alt="" />
              <h4>{group.name}</h4>
              <b>{group.count}</b>
            </button>
          ))
        ) : (
          <div className="empty">لا توجد بطولات.</div>
        )}
      </div>
    </main>
  );
}

function RecordsSubPage({
  title,
  subtitle,
  rows,
  members,
  hideWinner,
  onBack,
  onOpenView,
}) {
  const sorted = sortRecordsAsc(rows || []);
  return (
    <main className="widePage glass">
      <BackButton onBack={onBack} />
      <header className="pageHead">
        <h2>{title}</h2>
        <p>{subtitle || `${sorted.length} نسخة مرتبة من الأقدم إلى الأحدث.`}</p>
      </header>
      <div className="listGrid tournamentRecordsList">
        {sorted.length ? (
          sorted.map((row, index) => (
            <RecordCard
              key={row.id || index}
              row={row}
              members={members}
              hideWinner={hideWinner}
              onClick={() => onOpenView({ type: "record", record: row })}
            />
          ))
        ) : (
          <div className="empty">لا توجد تفاصيل.</div>
        )}
      </div>
    </main>
  );
}

function RecordCard({ row, members, hideWinner, onClick }) {
  const finalText =
    row.finalResult && row.finalResult !== "-"
      ? row.finalResult
      : row.notes && row.notes.includes("النهائي")
      ? String(row.notes).replace(/^النهائي\s*\/\s*/, "")
      : "";

  return (
    <button
      className={
        finalText
          ? "tournamentRecordCard hasFinal"
          : "tournamentRecordCard noFinal"
      }
      onClick={onClick}
    >
      <div className="recordCardMeta">
        <span>
          <small>النسخة</small>
          <b>{row.edition || "-"}</b>
        </span>
        {!hideWinner ? (
          <span>
            <small>البطل</small>
            <b>{getMemberName(members, row.winnerId)}</b>
          </span>
        ) : null}
        <span>
          <small>التاريخ</small>
          <b>{row.date || "-"}</b>
        </span>
      </div>

      {finalText ? (
        <div className="recordCardFinal">
          <small>النهائي</small>
          <strong>{finalText}</strong>
        </div>
      ) : (
        <div className="recordCardFinal muted">
          <small>تفاصيل</small>
          <strong>
            {row.notes && row.notes !== "-" ? row.notes : "لا يوجد نهائي مسجل"}
          </strong>
        </div>
      )}
    </button>
  );
}

function RecordDetailPage({ record, members, onBack }) {
  const finalText =
    record.finalResult && record.finalResult !== "-" ? record.finalResult : "";
  const notesText = record.notes && record.notes !== "-" ? record.notes : "";

  return (
    <main className="widePage glass">
      <BackButton onBack={onBack} />
      <section className="recordHero glassSoft">
        {record.image ? <img src={record.image} alt="" /> : null}
        <div>
          <h2>
            {record.name} — النسخة {record.edition}
          </h2>
          <p>
            {record.date} • {record.seasonId}
          </p>
        </div>
      </section>

      <section className="recordDetailCard glassSoft">
        <div className="recordDetailTop">
          <div>
            <span>النسخة</span>
            <b>{record.edition || "-"}</b>
          </div>
          <div>
            <span>البطل</span>
            <b>{getMemberName(members, record.winnerId)}</b>
          </div>
          <div>
            <span>التاريخ</span>
            <b>{record.date || "-"}</b>
          </div>
        </div>

        {finalText ? (
          <div className="recordFinalBox">
            <span>النهائي</span>
            <b>{finalText}</b>
          </div>
        ) : null}

        {notesText ? (
          <div className="recordNotesBox">
            <span>ملاحظات</span>
            <p>{notesText}</p>
          </div>
        ) : null}
      </section>
    </main>
  );
}

function InfoModal({ data, onClose }) {
  return (
    <div className="drawerBackdrop" onClick={onClose}>
      <article
        className="infoModal glass"
        onClick={(event) => event.stopPropagation()}
      >
        <button className="modalClose" onClick={onClose}>
          ×
        </button>
        <h3>{data.title}</h3>
        <p>{data.body}</p>
        {data.rows?.length ? (
          <div className="infoRows">
            {data.rows.map((row, index) => (
              <div key={index}>
                <b>{row.name}</b>
                <span>{row.value}</span>
              </div>
            ))}
          </div>
        ) : null}
      </article>
    </div>
  );
}

function SystemScreen({ title, subtitle, loading }) {
  return (
    <div className="systemScreen" dir="rtl">
      <style>{css}</style>
      <div className="systemCard glass">
        {loading ? <div className="spinner" /> : null}
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
    </div>
  );
}

async function loadCSV(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`CSV failed: ${url}`);
  return parseCSV(await response.text());
}

async function loadOptionalCSV(url) {
  if (!url) return [];
  try {
    return await loadCSV(url);
  } catch {
    return [];
  }
}

function parseCSV(text) {
  const cleanText = removeBom(String(text || ""));
  if (!cleanText.trim()) return [];
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < cleanText.length; i += 1) {
    const char = cleanText[i];
    const next = cleanText[i + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      i += 1;
    } else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }
  row.push(cell);
  rows.push(row);
  const nonEmpty = rows.filter((r) => r.some((c) => String(c || "").trim()));
  if (!nonEmpty.length) return [];
  const headers = nonEmpty[0].map((item) => normalizeKey(item));
  return nonEmpty.slice(1).map((values) => {
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = String(values[index] || "").trim();
    });
    return obj;
  });
}

function buildConfig(rows) {
  const raw = { ...DEFAULT_CONFIG };
  rows.forEach((row) => {
    const key = normalizeKey(row.key || row.name || "");
    const value = row.value || row.val || "";
    if (key && value) raw[key] = value;
  });
  return {
    ...DEFAULT_CONFIG,
    mainTitle: raw.maintitle || raw.mainTitle || DEFAULT_CONFIG.mainTitle,
    seasonName: raw.seasonname || raw.seasonName || DEFAULT_CONFIG.seasonName,
    seasonTitle:
      raw.seasontitle || raw.seasonTitle || DEFAULT_CONFIG.seasonTitle,
    membersTitle:
      raw.memberstitle || raw.membersTitle || DEFAULT_CONFIG.membersTitle,
    seasonTournamentsTitle:
      raw.seasontournamentstitle ||
      raw.seasonTournamentsTitle ||
      DEFAULT_CONFIG.seasonTournamentsTitle,
    transfersTitle:
      raw.transferstitle || raw.transfersTitle || DEFAULT_CONFIG.transfersTitle,
    rankingTitle:
      raw.rankingtitle || raw.rankingTitle || DEFAULT_CONFIG.rankingTitle,
    linksTitle: raw.linkstitle || raw.linksTitle || DEFAULT_CONFIG.linksTitle,
    playersTitle:
      raw.playerstitle || raw.playersTitle || DEFAULT_CONFIG.playersTitle,
    trophiesTitle:
      raw.trophiestitle || raw.trophiesTitle || DEFAULT_CONFIG.trophiesTitle,
    financeTitle:
      raw.financetitle || raw.financeTitle || DEFAULT_CONFIG.financeTitle,
    archiveTitle:
      raw.archivetitle || raw.archiveTitle || DEFAULT_CONFIG.archiveTitle,
    statsTitle: raw.statstitle || raw.statsTitle || DEFAULT_CONFIG.statsTitle,
    transfersSubtitle:
      raw.transferssubtitle ||
      raw.transfersSubtitle ||
      DEFAULT_CONFIG.transfersSubtitle,
    rankingSubtitle:
      raw.rankingsubtitle ||
      raw.rankingSubtitle ||
      DEFAULT_CONFIG.rankingSubtitle,
    linksSubtitle:
      raw.linkssubtitle || raw.linksSubtitle || DEFAULT_CONFIG.linksSubtitle,
    searchPlaceholder:
      raw.searchplaceholder ||
      raw.searchPlaceholder ||
      DEFAULT_CONFIG.searchPlaceholder,
    loadingTitle:
      raw.loadingtitle || raw.loadingTitle || DEFAULT_CONFIG.loadingTitle,
    loadingSubtitle:
      raw.loadingsubtitle ||
      raw.loadingSubtitle ||
      DEFAULT_CONFIG.loadingSubtitle,
    noDataTitle:
      raw.nodatatitle || raw.noDataTitle || DEFAULT_CONFIG.noDataTitle,
    errorTitle: raw.errortitle || raw.errorTitle || DEFAULT_CONFIG.errorTitle,
    appStatus: raw.appstatus || raw.appStatus || DEFAULT_CONFIG.appStatus,
    maintenanceMessage:
      raw.maintenancemessage ||
      raw.maintenanceMessage ||
      DEFAULT_CONFIG.maintenanceMessage,
    showFinance:
      raw.showfinance || raw.showFinance || DEFAULT_CONFIG.showFinance,
    showRanking:
      raw.showranking || raw.showRanking || DEFAULT_CONFIG.showRanking,
    showTransfers:
      raw.showtransfers || raw.showTransfers || DEFAULT_CONFIG.showTransfers,
    showLinks: raw.showlinks || raw.showLinks || DEFAULT_CONFIG.showLinks,
    showSeasonTournaments:
      raw.showseasontournaments ||
      raw.showSeasonTournaments ||
      DEFAULT_CONFIG.showSeasonTournaments,
    showMemberTrophies:
      raw.showmembertrophies ||
      raw.showMemberTrophies ||
      DEFAULT_CONFIG.showMemberTrophies,
    showSearch: raw.showsearch || raw.showSearch || DEFAULT_CONFIG.showSearch,
    showArchive:
      raw.showarchive || raw.showArchive || DEFAULT_CONFIG.showArchive,
    showStats: raw.showstats || raw.showStats || DEFAULT_CONFIG.showStats,
    defaultPage:
      raw.defaultpage || raw.defaultPage || DEFAULT_CONFIG.defaultPage,
    activeSeasonId:
      raw.activeseasonid || raw.activeSeasonId || DEFAULT_CONFIG.activeSeasonId,
    primaryColor:
      raw.primarycolor || raw.primaryColor || DEFAULT_CONFIG.primaryColor,
    secondaryColor:
      raw.secondarycolor || raw.secondaryColor || DEFAULT_CONFIG.secondaryColor,
    accentColor:
      raw.accentcolor || raw.accentColor || DEFAULT_CONFIG.accentColor,
    headerImage:
      raw.headerimage || raw.headerImage || DEFAULT_CONFIG.headerImage,
    appIcon: raw.appicon || raw.appIcon || DEFAULT_CONFIG.appIcon,
    groupLogo: raw.grouplogo || raw.groupLogo || DEFAULT_CONFIG.groupLogo,
    exportLogo: raw.exportlogo || raw.exportLogo || DEFAULT_CONFIG.exportLogo,
    leagueLogo: raw.leaguelogo || raw.leagueLogo || raw.leagueicon || raw.leagueIcon || raw.dawrilogo || raw.dawriLogo || "",
    cupLogo: raw.cuplogo || raw.cupLogo || raw.cupicon || raw.cupIcon || "",
    superCupLogo: raw.supercuplogo || raw.superCupLogo || raw.supercupicon || raw.superCupIcon || "",
    championsLeagueLogo: raw.championsleaguelogo || raw.championsLeagueLogo || raw.championsleagueicon || raw.championsLeagueIcon || "",
    worldCupLogo: raw.worldcuplogo || raw.worldCupLogo || raw.worldcupicon || raw.worldCupIcon || "",
    leagueQualifierLogo: raw.leaguequalifierlogo || raw.leagueQualifierLogo || "",
    announcement: raw.announcement || DEFAULT_CONFIG.announcement,
    coverHeight:
      raw.coverheight || raw.coverHeight || DEFAULT_CONFIG.coverHeight,
    coverHeightMobile:
      raw.coverheightmobile || raw.coverHeightMobile || DEFAULT_CONFIG.coverHeightMobile,
    balanceIcon:
      raw.balanceicon || raw.balanceIcon || DEFAULT_CONFIG.balanceIcon,
    totalTrophiesIcon:
      raw.totaltrophiesicon ||
      raw.totalTrophiesIcon ||
      raw.trophiesicon ||
      raw.trophiesIcon ||
      DEFAULT_CONFIG.totalTrophiesIcon,
    navMembersIcon: raw.navmembersicon || raw.navMembersIcon || DEFAULT_CONFIG.navMembersIcon,
    navSeasonIcon: raw.navseasonicon || raw.navSeasonIcon || DEFAULT_CONFIG.navSeasonIcon,
    navArchiveIcon: raw.navarchiveicon || raw.navArchiveIcon || DEFAULT_CONFIG.navArchiveIcon,
    navRankingIcon: raw.navrankingicon || raw.navRankingIcon || DEFAULT_CONFIG.navRankingIcon,
    navMoreIcon: raw.navmoreicon || raw.navMoreIcon || DEFAULT_CONFIG.navMoreIcon,
    menuStatsIcon: raw.menustatsicon || raw.menuStatsIcon || DEFAULT_CONFIG.menuStatsIcon,
    menuTransfersIcon: raw.menutransfersicon || raw.menuTransfersIcon || DEFAULT_CONFIG.menuTransfersIcon,
    menuLinksIcon: raw.menulinksicon || raw.menuLinksIcon || DEFAULT_CONFIG.menuLinksIcon,
    memberTeamIcon: raw.memberteamicon || raw.memberTeamIcon || DEFAULT_CONFIG.memberTeamIcon,
    memberNationalIcon: raw.membernationalicon || raw.memberNationalIcon || DEFAULT_CONFIG.memberNationalIcon,
    finalsPlayedIcon: raw.finalsplayedicon || raw.finalsPlayedIcon || DEFAULT_CONFIG.finalsPlayedIcon,
    finalsWonIcon: raw.finalswonicon || raw.finalsWonIcon || DEFAULT_CONFIG.finalsWonIcon,
    finalsLostIcon: raw.finalslosticon || raw.finalsLostIcon || DEFAULT_CONFIG.finalsLostIcon,
    goalsForIcon: raw.goalsforicon || raw.goalsForIcon || DEFAULT_CONFIG.goalsForIcon,
    goalsAgainstIcon: raw.goalsagainsticon || raw.goalsAgainstIcon || DEFAULT_CONFIG.goalsAgainstIcon,
    relegationsIcon: raw.relegationsicon || raw.relegationsIcon || DEFAULT_CONFIG.relegationsIcon,
    seasonCountIcon: raw.seasoncounticon || raw.seasonCountIcon || DEFAULT_CONFIG.seasonCountIcon,
    seasonPointsIcon: raw.seasonpointsicon || raw.seasonPointsIcon || DEFAULT_CONFIG.seasonPointsIcon,
    rankingTitlesIcon: raw.rankingtitlesicon || raw.rankingTitlesIcon || DEFAULT_CONFIG.rankingTitlesIcon,
    rankingPointsIcon: raw.rankingpointsicon || raw.rankingPointsIcon || DEFAULT_CONFIG.rankingPointsIcon,
    transferAmountIcon: raw.transferamounticon || raw.transferAmountIcon || DEFAULT_CONFIG.transferAmountIcon,
    transferTypeIcon: raw.transfertypeicon || raw.transferTypeIcon || DEFAULT_CONFIG.transferTypeIcon,
    transferDateIcon: raw.transferdateicon || raw.transferDateIcon || DEFAULT_CONFIG.transferDateIcon,
    transferNoteIcon: raw.transfernoteicon || raw.transferNoteIcon || DEFAULT_CONFIG.transferNoteIcon,
    linkFacebookIcon: raw.linkfacebookicon || raw.linkFacebookIcon || DEFAULT_CONFIG.linkFacebookIcon,
    linkTournamentsIcon: raw.linktournamentsicon || raw.linkTournamentsIcon || DEFAULT_CONFIG.linkTournamentsIcon,
    linkSeasonIcon: raw.linkseasonicon || raw.linkSeasonIcon || DEFAULT_CONFIG.linkSeasonIcon,
    linkDefaultIcon: raw.linkdefaulticon || raw.linkDefaultIcon || DEFAULT_CONFIG.linkDefaultIcon,
    memberCardTrophyIcon: raw.membercardtrophyicon || raw.memberCardTrophyIcon || DEFAULT_CONFIG.memberCardTrophyIcon,
    archiveTrophyTabIcon: raw.archivetrophytabicon || raw.archiveTrophyTabIcon || DEFAULT_CONFIG.archiveTrophyTabIcon,
    archiveSeasonTabIcon: raw.archiveseasontabicon || raw.archiveSeasonTabIcon || DEFAULT_CONFIG.archiveSeasonTabIcon,
    archiveMemberTabIcon: raw.archivemembertabicon || raw.archiveMemberTabIcon || DEFAULT_CONFIG.archiveMemberTabIcon,
  };
}

function buildTrophyMap(rows) {
  const map = {};
  rows.forEach((row) => {
    const trophyId = cleanId(
      row.trophyid || row.id || row.trophy || row.trophy_id
    );
    if (!trophyId) return;
    map[trophyId] = {
      trophyId,
      name: row.name || row.trophyname || row.title || trophyId,
      image: normalizeImageUrl(
        row.image || row.logo || row.icon || row.trophyimage
      ),
      points: toNumber(row.points || row.point || row.score),
      order: toNumber(row.order || row.sort || row.rank),
    };
  });
  return map;
}

function normalizeTournamentRow(row, source, trophyMap) {
  const trophyId = cleanId(
    row.trophyid || row.trophy || (source === "league" ? "league" : "")
  );
  const info = trophyMap[trophyId] || {};
  const id =
    row.id || `${trophyId}_${String(row.edition || "").padStart(3, "0")}`;
  return {
    ...row,
    id,
    source,
    trophyId,
    name:
      info.name ||
      row.trophyname ||
      (trophyId === "league" ? "الدوري" : trophyId),
    image: info.image || row.image || "",
    points: info.points || toNumber(row.points),
    order: info.order || 999,
    edition: row.edition || row.version || "",
    winnerId: cleanId(row.winnerid || row.memberid || row.winner),
    date: normalizeDate(row.date || row.tournamentdate || ""),
    seasonId: cleanId(row.seasonid || row.season),
    system: row.system || "",
    finalResult: row.finalresult || row.final || "",
    finalPlayer1Id: cleanId(row.finalplayer1id || row.finalp1id),
    finalPlayer1Goals: toNumber(row.finalplayer1goals || row.finalp1goals),
    finalPlayer2Id: cleanId(row.finalplayer2id || row.finalp2id),
    finalPlayer2Goals: toNumber(row.finalplayer2goals || row.finalp2goals),
    relegatedIds: row.relegatedids || row.relegated || "",
    notes: row.notes || row.note || "",
  };
}

function groupMemberTrophies(allTournaments, memberId, trophyMap) {
  const map = {};
  allTournaments
    .filter((item) => same(item.winnerId, memberId))
    .forEach((item) => {
      const key = cleanId(item.trophyId);
      if (!map[key]) {
        const info = trophyMap[key] || {};
        map[key] = {
          trophyId: key,
          name: info.name || item.name || key,
          image: info.image || item.image || "",
          count: 0,
          rows: [],
        };
      }
      map[key].count += 1;
      map[key].rows.push(item);
    });
  return Object.values(map)
    .map((group) => ({ ...group, rows: sortRecordsAsc(group.rows) }))
    .sort((a, b) => b.count - a.count || trophySort(a, b));
}

function groupByTrophy(rows, trophyMap) {
  const map = {};
  rows.forEach((item) => {
    const key = cleanId(item.trophyId);
    if (!key) return;
    if (!map[key]) {
      const info = trophyMap[key] || {};
      map[key] = {
        trophyId: key,
        name: info.name || item.name || key,
        image: info.image || item.image || "",
        points: info.points || item.points || 0,
        order: info.order || item.order || 999,
        count: 0,
        rows: [],
      };
    }
    map[key].count += 1;
    map[key].rows.push(item);
  });
  return Object.values(map)
    .sort(trophySort)
    .map((group) => ({ ...group, rows: sortRecordsAsc(group.rows) }));
}

function buildArchiveSeasons(seasons, allTournaments, trophyMap) {
  const fallback = unique(
    allTournaments.map((item) => item.seasonId).filter(Boolean)
  ).map((seasonId) => ({ seasonid: seasonId, seasonname: seasonId }));
  const list = seasons.length ? seasons : fallback;
  return list
    .map((season) => {
      const seasonId = cleanId(season.seasonid || season.id);
      const rows = allTournaments.filter((item) =>
        same(item.seasonId, seasonId)
      );
      const groups = groupByTrophy(rows, trophyMap);
      return {
        seasonId,
        seasonName: season.seasonname || season.name || seasonId,
        startDate: season.startdate || season.start || "",
        endDate: season.enddate || season.end || "",
        membersCount: season.memberscount || season.members || "",
        count: toNumber(season.count) || rows.length,
        rows,
        groups,
      };
    })
    .filter((season) => season.seasonId)
    .sort((a, b) => seasonNumber(a.seasonId) - seasonNumber(b.seasonId));
}

function computeSeasonRanking(members, rows, trophyMap) {
  const map = {};
  members.forEach((member) => {
    const memberId = cleanId(member.id);
    if (memberId)
      map[memberId] = {
        memberId,
        name: member.name || memberId,
        team: member.team || "",
        avatar: member.avatar || "",
        teamLogo: member.teamlogo || "",
        nationalLogo: member.nationallogo || "",
        titles: 0,
        points: 0,
        rows: [],
      };
  });
  rows.forEach((row) => {
    const memberId = cleanId(row.winnerId);
    if (!memberId) return;
    if (!map[memberId])
      map[memberId] = {
        memberId,
        name: memberId,
        team: "",
        avatar: "",
        teamLogo: "",
        nationalLogo: "",
        titles: 0,
        points: 0,
        rows: [],
      };
    const trophy = trophyMap[cleanId(row.trophyId)] || {};
    map[memberId].titles += 1;
    map[memberId].points += toNumber(trophy.points || row.points || 1);
    map[memberId].rows.push(row);
  });
  return Object.values(map)
    .map((row) => ({ ...row, rows: sortRecordsAsc(row.rows) }))
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.titles - a.titles ||
        String(a.name).localeCompare(String(b.name), "ar")
    );
}

function computeMemberStats(members, tournaments) {
  const map = {};
  members.forEach((member) => {
    const id = cleanId(member.id);
    if (id) map[id] = emptyMemberStats(id);
  });
  tournaments.forEach((item) => {
    const p1 = cleanId(item.finalPlayer1Id);
    const p2 = cleanId(item.finalPlayer2Id);
    if (p1 && p2 && p1 !== "-" && p2 !== "-") {
      if (!map[p1]) map[p1] = emptyMemberStats(p1);
      if (!map[p2]) map[p2] = emptyMemberStats(p2);
      addFinalForMember(
        map[p1],
        item,
        p1,
        p2,
        toNumber(item.finalPlayer1Goals),
        toNumber(item.finalPlayer2Goals)
      );
      addFinalForMember(
        map[p2],
        item,
        p2,
        p1,
        toNumber(item.finalPlayer2Goals),
        toNumber(item.finalPlayer1Goals)
      );
    }
    if (item.source === "league") {
      splitIds(item.relegatedIds).forEach((memberId) => {
        if (!map[memberId]) map[memberId] = emptyMemberStats(memberId);
        map[memberId].relegations += 1;
      });
    }
  });
  Object.values(map).forEach((stats) => {
    stats.finalsPlayed = stats.finals.length;
    stats.finalsWon = stats.finals.filter(
      (item) => item.result === "win"
    ).length;
    stats.finalsLost = stats.finals.filter(
      (item) => item.result === "loss"
    ).length;
  });
  return map;
}

function addFinalForMember(
  stats,
  tournament,
  memberId,
  opponentId,
  goalsFor,
  goalsAgainst
) {
  const result = same(tournament.winnerId, memberId) ? "win" : "loss";
  stats.finals.push({ tournament, opponentId, goalsFor, goalsAgainst, result });
  stats.finalGoalsFor += goalsFor;
  stats.finalGoalsAgainst += goalsAgainst;
  stats.goalsForAgainst[opponentId] =
    (stats.goalsForAgainst[opponentId] || 0) + goalsFor;
  stats.goalsAgainstFrom[opponentId] =
    (stats.goalsAgainstFrom[opponentId] || 0) + goalsAgainst;
  if (result === "win")
    stats.winsAgainst[opponentId] = (stats.winsAgainst[opponentId] || 0) + 1;
}

function emptyMemberStats(memberId) {
  return {
    memberId: cleanId(memberId),
    finalsPlayed: 0,
    finalsWon: 0,
    finalsLost: 0,
    finalGoalsFor: 0,
    finalGoalsAgainst: 0,
    relegations: 0,
    finals: [],
    goalsForAgainst: {},
    goalsAgainstFrom: {},
    winsAgainst: {},
  };
}

function buildGoalsForMessage(stats, members, memberName) {
  const topGoals = topMap(stats.goalsForAgainst, members);
  const topWins = topMap(stats.winsAgainst, members);
  return {
    title: `أهداف ${memberName} في النهائيات`,
    body: "هذه الأرقام لا تحتسب ركلات الترجيح، وتعتمد فقط على أهداف الوقت/المباراة في النهائي.",
    rows: [
      {
        name: "أكثر عضو تلقى أهدافًا منه",
        value: topGoals ? `${topGoals.name} — ${topGoals.value}` : "لا يوجد",
      },
      {
        name: "أكثر عضو خسر منه في النهائيات",
        value: topWins ? `${topWins.name} — ${topWins.value}` : "لا يوجد",
      },
    ],
  };
}

function buildGoalsAgainstMessage(stats, members, memberName) {
  const top = topMap(stats.goalsAgainstFrom, members);
  return {
    title: `أهداف تلقاها ${memberName}`,
    body: "هذه الأرقام لا تحتسب ركلات الترجيح.",
    rows: [
      {
        name: "أكثر عضو سجل عليه في النهائيات",
        value: top ? `${top.name} — ${top.value}` : "لا يوجد",
      },
    ],
  };
}

function topMap(map, members) {
  const rows = Object.entries(map || {})
    .map(([id, value]) => ({ id, name: getMemberName(members, id), value }))
    .sort((a, b) => b.value - a.value);
  return rows[0] || null;
}

function isFifaSystemMember(member) {
  return same(member?.id, "FIFA") || clean(member?.name) === "fifa";
}

function isActiveSeasonMember(member) {
  if (!member || !cleanId(member.id) || isFifaSystemMember(member)) return false;
  const status = clean(
    member.status ??
      member.memberstatus ??
      member.active ??
      member.isactive ??
      ""
  );
  return ["active", "true", "yes", "1", "نشط", "فعال"].includes(status);
}

function getActiveMembers(members) {
  const source = Array.isArray(members) ? members : [];
  const active = source.filter(isActiveSeasonMember);
  return active.length
    ? active
    : source.filter((member) => cleanId(member.id) && !isFifaSystemMember(member));
}

function getActiveSeasonId(seasons, config) {
  const configId = cleanId(config.activeSeasonId);
  if (configId) return configId;
  const open = seasons.find((season) => !clean(season.enddate || season.end));
  return cleanId(open?.seasonid || open?.id || "S6");
}

function findSeason(seasons, seasonId) {
  const row = seasons.find((season) =>
    same(season.seasonid || season.id, seasonId)
  );
  if (!row) return { seasonId, seasonName: seasonId };
  return {
    seasonId,
    seasonName: row.seasonname || row.name || seasonId,
    startDate: row.startdate || "",
    endDate: row.enddate || "",
    membersCount: row.memberscount || "",
  };
}

function trophySort(a, b) {
  if (toNumber(a.order) !== toNumber(b.order))
    return toNumber(a.order) - toNumber(b.order);
  return String(a.name || "").localeCompare(String(b.name || ""), "ar");
}
function sortByDateAsc(a, b) {
  return (
    dateValue(a.date) - dateValue(b.date) ||
    toNumber(a.edition) - toNumber(b.edition)
  );
}
function sortRecordsAsc(rows) {
  return (rows || []).slice().sort(sortByDateAsc);
}
function splitIds(value) {
  return String(value || "")
    .split(/[\/،,|]+/)
    .map((item) => cleanId(item))
    .filter(
      (item) =>
        item &&
        !["none", "unknown", "لايوجد", "لابيانات", "-"].includes(clean(item))
    );
}

function getTrophyDisplayName(trophyId) {
  const value = cleanId(trophyId);
  const names = {
    league: "الدوري",
    cup: "الكأس",
    ucl: "دوري الأبطال",
    super_local: "السوبر المحلي",
    super_continental: "السوبر القاري",
    confederation_cup: "كأس الكونفدرالية",
    world_cup: "كأس العالم",
    club_world_cup: "كأس العالم للأندية",
    confederations_cup: "كأس القارات",
    afc_cl: "أبطال آسيا",
    caf_cl: "أبطال أفريقيا",
    libertadores: "ليبرتادوريس",
    euro: "أمم أوروبا",
    copa_america: "كوبا أمريكا",
    asia_cup: "أمم آسيا",
    africa_cup: "أمم أفريقيا",
    arab_cup: "كأس العرب",
    concacaf_cl: "أبطال كونكاكاف",
  };
  return names[value] || "";
}

function getMemberName(members, memberId) {
  const id = cleanId(memberId);
  const row = (members || []).find((member) => same(member.id || member.memberId || member.memberid, id));
  return row?.name || row?.memberName || row?.membername || memberId || "-";
}
function normalizeImageUrl(value) {
  const url = String(value || "").trim();
  if (!url) return "";
  const driveMatch = url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if (driveMatch?.[1])
    return `https://drive.google.com/thumbnail?id=${driveMatch[1]}&sz=w1200`;
  const imgurMatch = url.match(/^https?:\/\/imgur\.com\/([A-Za-z0-9]+)$/);
  if (imgurMatch?.[1]) return `https://i.imgur.com/${imgurMatch[1]}.png`;
  return url;
}
function getPlayerStableId(player) {
  return cleanId(player?.playerid || player?.playerId || player?.id || player?.name);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + Number(days || 0));
  return next;
}

function localDateKey(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}


function transferWindowStatusLabel(row = {}) {
  const status = clean(row.status || "open");
  if (status === "open") return "مفتوحة";
  if (status === "closed") return "مغلقة";
  if (status === "cancelled") return "ملغاة";
  if (status === "ended" || status === "expired") return "منتهية";
  return row.status || "-";
}

function rowBelongsToTransferWindow(row = {}, windowRow = {}) {
  if (!row || !windowRow) return false;
  const windowId = cleanId(windowRow.id || windowRow.windowId || "");
  const windowName = clean(windowRow.title || windowRow.name || "");
  if (windowId && (same(row.periodId, windowId) || same(row.marketExecutionWindowId, windowId) || same(row.transferWindowId, windowId) || same(row.relatedTransferWindowId, windowId))) return true;
  if (windowName && clean(row.periodName || row.marketExecutionWindowName || row.period || "") === windowName) return true;
  const rowDate = String(row.date || row.completedDate || row.releaseDate || row.releasedDate || "").slice(0, 10);
  const start = String(windowRow.startDate || "").slice(0, 10);
  const end = String(windowRow.endDate || "").slice(0, 10);
  if (rowDate && start && end) return rowDate >= start && rowDate <= end;
  return false;
}

function computeTransferWindowStats(windowRow = {}, transferHistory = [], moneyTransfers = [], playerReleases = []) {
  const rows = (transferHistory || []).filter((row) => rowBelongsToTransferWindow(row, windowRow));
  const releaseRows = (playerReleases || []).filter((row) => rowBelongsToTransferWindow(row, windowRow));
  const moneyRows = (moneyTransfers || []).filter((row) => rowBelongsToTransferWindow(row, windowRow));
  const isSale = (row) => {
    const value = clean([row.type, row.typeLabel, row.contractType].join(" "));
    return value.includes("buy") || value.includes("sale") || value.includes("شراء") || value.includes("بيع");
  };
  const isLoan = (row) => {
    const value = clean([row.type, row.typeLabel, row.contractType].join(" "));
    return value.includes("loan") || value.includes("إعارة") || value.includes("اعارة");
  };
  const isRelease = (row) => {
    const value = clean([row.type, row.typeLabel, row.status, row.note].join(" "));
    return value.includes("release") || value.includes("استغناء") || value.includes("released");
  };
  const moneyFromTransfers = rows.reduce((sum, row) => sum + Math.max(0, toNumber(row.amount || row.rawAmount || row.amountNumber)), 0);
  const moneyFromMoneyRows = moneyRows.reduce((sum, row) => sum + Math.max(0, toNumber(row.amount)), 0);
  const releaseKeys = new Set();
  const addReleaseKey = (row) => {
    const key = cleanId(row.relatedReleaseId || row.id || [row.playerId || row.playerid, row.memberId || row.fromMemberId, row.date || row.releasedDate || row.createdAt].join("-"));
    if (key) releaseKeys.add(key);
  };
  releaseRows.forEach(addReleaseKey);
  rows.filter(isRelease).forEach(addReleaseKey);
  return {
    moneySpent: Math.max(moneyFromTransfers, moneyFromMoneyRows),
    sales: rows.filter(isSale).length,
    loans: rows.filter(isLoan).length,
    releases: releaseKeys.size,
    pendingExecuted: rows.filter((row) => Boolean(row.marketExecutedAtWindowOpen || row.marketExecutionWindowId || row.marketExecutionCompletedAt)).length,
  };
}

function isTransferMarketOpen(windows = []) {
  const today = localDateKey();
  return (windows || []).some((windowRow) => {
    const status = clean(windowRow.status || "");
    if (status !== "open") return false;
    const start = String(windowRow.startDate || windowRow.startdate || "").slice(0, 10);
    const end = String(windowRow.endDate || windowRow.enddate || "").slice(0, 10);
    if (start && today < start) return false;
    if (end && today > end) return false;
    return true;
  });
}

function isPlayerReleasedByContracts(contracts = [], playerId = "") {
  const id = cleanId(playerId);
  if (!id) return false;
  return (contracts || []).some((contract) =>
    same(contract.playerId, id) &&
    clean(contract.status || "active") === "active" &&
    (clean(contract.contractType) === "released" || Boolean(contract.permanentlyRemoved))
  );
}

function isActivePlayerOfferStatus(status) {
  return ["pending", "approvedpendingwindow"].includes(clean(status));
}

function isBlockingOwnPlayerOfferStatus(status) {
  return ["pending", "approvedpendingwindow"].includes(clean(status));
}

function isBlockingOwnPlayerOfferStillValid(offer) {
  const status = clean(offer?.status || "");
  if (["approvedpendingwindow"].includes(status)) return true;
  if (status === "pending") return !isOfferExpired(offer);
  return false;
}

function isAcceptedOrCompletedPlayerOffer(offer) {
  return ["approvedpendingwindow"].includes(clean(offer?.status || ""));
}

function isFinanciallyReservedPlayerOffer(offer) {
  const status = clean(offer?.status || "");
  if (status === "approvedpendingwindow") return true;
  if (status === "pending") return !isOfferExpired(offer);
  return false;
}

function isTerminalPlayerOfferStatus(status) {
  return ["completed", "rejected", "cancelledbybuyer", "expired", "cancelled", "cancelledbyseller", "cancelledbecauseplayerunavailable", "cancelledbecauseplayerreleased"].includes(clean(status));
}

function playerOfferStatusMessage(status) {
  const value = clean(status);
  if (value === "approvedpendingwindow") return "تم قبول عرضك وهو بانتظار فتح سوق الانتقالات.";
  if (value === "completed") return "تم قبول هذا العرض واكتملت الصفقة، ولا يمكن تقديم عرض جديد على نفس اللاعب.";
  if (value === "cancelledbecauseplayerunavailable") return "تم إغلاق العرض لأن اللاعب أصبح مرتبطًا بصفقة أخرى.";
  return "يوجد عرض سابق على هذا اللاعب ولا يمكن تقديم عرض جديد حالياً.";
}

function isOfferExpired(offer) {
  if (!offer?.expiresAt) return false;
  return new Date(offer.expiresAt).getTime() < Date.now();
}

function notificationTimeValue(value) {
  if (!value) return 0;
  if (typeof value?.toDate === "function") return value.toDate().getTime();
  if (value?.seconds) return Number(value.seconds) * 1000;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function getInitialPushStatus() {
  if (typeof window === "undefined") {
    return { state: "ready", message: "فعّل إشعارات الجوال لهذا الجهاز." };
  }

  if (!("Notification" in window)) {
    return { state: "unsupported", message: "هذا المتصفح لا يدعم إشعارات الويب." };
  }

  if (window.Notification.permission === "granted") {
    return { state: "enabled", message: "إشعارات الجوال مفعلة لهذا الجهاز." };
  }

  if (window.Notification.permission === "denied") {
    return { state: "denied", message: "تم رفض الإشعارات من إعدادات المتصفح أو الجهاز." };
  }

  return { state: "ready", message: "فعّل الإشعارات لهذا الجهاز لمتابعة أخبار اللعبة والصفقات والتحويلات." };
}

function notificationDisplayDate(value) {
  const time = notificationTimeValue(value);
  if (!time) return "الآن";
  return new Date(time).toLocaleDateString("ar", { month: "short", day: "numeric" });
}


function normalizeFirebaseTransferRows(rows = []) {
  return (rows || []).map((row) => ({
    ...row,
    playerid: row.playerId || row.playerid || "",
    name: row.playerName || row.name || row.player || "لاعب غير مسجل",
    player: row.playerName || row.name || row.player || "لاعب غير مسجل",
    from: row.fromMemberName || row.from || "-",
    to: row.toMemberName || row.to || "-",
    amount: formatMoney(row.amount || 0),
    type: row.typeLabel || row.type || "انتقال",
    date: row.date || formatTransferDate(row.createdAt),
    note: row.note || row.periodName || row.status || "-",
    period: row.periodName || row.period || "انتقالات Firebase",
  }));
}

function mergeTransferPeriods(sheetPeriods = [], firebasePeriods = []) {
  const map = new Map();
  [...(sheetPeriods || []), ...(firebasePeriods || [])].forEach((period) => {
    const id = clean(period?.id || period?.name || "");
    if (!id) return;
    if (!map.has(id)) map.set(id, { ...period, rows: [] });
    const current = map.get(id);
    current.name = current.name || period.name;
    current.rows = [...(current.rows || []), ...(period.rows || [])];
  });
  return Array.from(map.values()).map((period) => ({
    ...period,
    rows: (period.rows || []).slice().sort((a, b) => String(b.date || "").localeCompare(String(a.date || ""))),
  }));
}

function getTransferWindowForDate(windows = [], dateKey = "") {
  const day = String(dateKey || new Date().toISOString().slice(0, 10)).slice(0, 10);
  return (windows || []).find((windowRow) => {
    const start = String(windowRow.startDate || windowRow.startdate || "").slice(0, 10);
    const end = String(windowRow.endDate || windowRow.enddate || "").slice(0, 10);
    if (start && day < start) return false;
    if (end && day > end) return false;
    return true;
  }) || null;
}

function getTransferWindowNameForDate(windows = [], dateKey = "") {
  const found = getTransferWindowForDate(windows, dateKey);
  return found?.name || found?.title || found?.period || "انتقالات Firebase";
}

function getTransferWindowIdForDate(windows = [], dateKey = "") {
  const found = getTransferWindowForDate(windows, dateKey);
  return clean(found?.id || found?.name || found?.title || "انتقالات Firebase");
}

function isFreeAgentPlayer(player = {}) {
  const text = clean([
    player?.rosterType,
    player?.rostertype,
    player?.playerType,
    player?.playertype,
    player?.registrationType,
    player?.registrationtype,
    player?.sourceType,
    player?.sourcetype,
    player?.status,
    player?.notes,
    player?.note,
    player?.freeAgent,
    player?.freeagent,
    player?.isFreeAgent,
    player?.isfreeagent,
  ].join(" "));
  return Boolean(
    text.includes("free_agent") ||
    text.includes("free agent") ||
    text.includes("free") ||
    text.includes("حر") ||
    text.includes("لاعبحر") ||
    text.includes("لاعب حر")
  );
}

function toBooleanFlag(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const text = clean(value);
  if (!text) return false;
  return ["true", "1", "yes", "y", "on", "active", "نعم", "صح", "صحيح"].includes(text);
}

function isFreeOriginContract(contract = {}) {
  if (!contract) return false;
  const rosterType = clean(contract.rosterType || contract.rostertype || "");
  return Boolean(
    toBooleanFlag(contract.isFreeOrigin) ||
      toBooleanFlag(contract.freeAgentOrigin) ||
      rosterType === "free" ||
      rosterType.includes("حر")
  );
}

function isFreeAgentPoolContract(contract = {}) {
  if (!contract) return false;
  const type = clean(contract.contractType || "");
  const status = clean(contract.status || "active");
  return Boolean(
    status === "active" &&
      !cleanId(contract.currentMemberId) &&
      (type === "free_agent" ||
        type === "freeagent" ||
        toBooleanFlag(contract.availableFreeAgent) ||
        toBooleanFlag(contract.releasedToFreeAgent))
  );
}

function getFreeAgentSlotOwnerIdFromContract(contract = {}, fallbackOwnerId = "") {
  if (!contract) return cleanId(fallbackOwnerId);
  return cleanId(
    contract.freeAgentSlotOwnerMemberId ||
      contract.freeagentslotownermemberid ||
      (isFreeOriginContract(contract) ? contract.originalOwnerMemberId || contract.ownerMemberId || fallbackOwnerId : fallbackOwnerId)
  );
}

function hasEverUsedFreeAgentSlot(registrations = [], status = null, activeFreeContract = null, memberId = "") {
  const id = cleanId(memberId);
  if (!id) return false;
  return Boolean(
    activeFreeContract ||
      toBooleanFlag(status?.hasUsedFreeSlot) ||
      cleanId(status?.currentFreePlayerId || status?.lostFreePlayerId || "") ||
      hasAnyFreeAgentRegistrationForMember(registrations, id)
  );
}

function normalizeOfferAsTransferContractRow(offer = {}) {
  const type = clean(offer?.type || offer?.contractType || "buy") === "loan" ? "loan" : "buy";
  const amountValue = toNumber(offer?.amount || offer?.rawAmount || offer?.amountNumber || 0);
  const status = clean(offer?.status || "completed");
  return {
    ...offer,
    playerId: offer?.targetPlayerId || offer?.playerId || offer?.playerid || "",
    playerid: offer?.targetPlayerId || offer?.playerId || offer?.playerid || "",
    playerName: offer?.targetPlayerName || offer?.playerName || offer?.player || offer?.name || "لاعب",
    playerImage: offer?.targetPlayerImage || offer?.playerImage || "",
    playerRating: offer?.targetPlayerRating || offer?.playerRating || "",
    playerPosition: offer?.targetPlayerPosition || offer?.playerPosition || "",
    type,
    typeLabel: offer?.typeLabel || (type === "loan" ? "عقد إعارة" : (Array.isArray(offer?.offeredPlayers) && offer.offeredPlayers.length ? "عقد شراء + تبادل" : "عقد شراء")),
    amount: amountValue,
    rawAmount: amountValue,
    from: offer?.fromMemberName || offer?.from || "",
    to: offer?.toMemberName || offer?.to || "",
    date: offer?.completedDate || offer?.completedAt || offer?.approvedAt || offer?.date || formatTransferDate(offer?.createdAt),
    status: status === "approvedpendingwindow" && (offer?.completedAt || offer?.marketWasOpenAtApproval || offer?.executedAt || offer?.loanStartDate) ? "completed" : (offer?.status || "completed"),
  };
}

function getTransferContractParties(row = {}) {
  const loan = isLoanTransferRow(row);
  const seller = row?.fromMemberName || row?.from || row?.previousMemberName || "-";
  const buyer = row?.toMemberName || row?.to || row?.currentMemberName || "-";
  const realOwner = row?.originalOwnerMemberName || row?.ownerMemberName || row?.realOwnerMemberName || seller || "-";
  return {
    from: loan ? realOwner : seller,
    to: buyer,
    fromLabel: loan ? "المالك الحقيقي" : "من",
    toLabel: loan ? "المستعير" : "إلى",
    signerFromLabel: loan ? "توقيع المالك الحقيقي" : "توقيع الطرف الأول",
    signerToLabel: loan ? "توقيع المستلم" : "توقيع الطرف الثاني",
  };
}

function hasFreeAgentRegistrationRecord(rows = [], playerId = "", memberId = "") {
  const id = cleanId(playerId);
  const ownerId = cleanId(memberId);
  if (!id || !ownerId) return false;
  return (rows || []).some((item) =>
    same(item.playerId, id) &&
    same(item.memberId || item.toMemberId || item.currentMemberId, ownerId) &&
    !["cancelled", "reversed"].includes(clean(item.status || "completed"))
  );
}

function hasAnyFreeAgentRegistrationForMember(rows = [], memberId = "") {
  const ownerId = cleanId(memberId);
  if (!ownerId) return false;
  return (rows || []).some((item) =>
    same(item.memberId || item.toMemberId || item.currentMemberId, ownerId) &&
    !["cancelled", "reversed"].includes(clean(item.status || "completed"))
  );
}

function getRosterKindCode({ contractType, originalOwnerMemberId, currentMemberId, freeAgent }) {
  if (freeAgent) return "free";
  const type = clean(contractType || "");
  if (type === "loan") return "pro_loan";
  if (type === "owned" && originalOwnerMemberId && currentMemberId && !same(originalOwnerMemberId, currentMemberId)) return "pro_owned";
  return "base";
}

function getRosterPlayerKindFromContract(player, contract, memberId = "") {
  if (!contract) return isFreeAgentPlayer(player) ? "free" : "base";
  const type = clean(contract.contractType || "");
  if (type === "free_agent" || isFreeAgentPoolContract(contract)) return "free";
  const currentOwner = cleanId(contract.currentMemberId || memberId || "");
  const freeSlotOwner = getFreeAgentSlotOwnerIdFromContract(contract, contract.originalOwnerMemberId || memberId || "");
  if (type === "loan") return "pro_loan";
  if (type === "owned") {
    if (isFreeAgentPlayer(player) || isFreeOriginContract(contract)) {
      if (freeSlotOwner && currentOwner && same(freeSlotOwner, currentOwner)) return "free";
      return "pro_owned";
    }
    const originalOwner = cleanId(contract.baseOwnerMemberId || contract.baseOwnerId || contract.originalBaseOwnerMemberId || contract.originalOwnerMemberId || player?.memberid || "");
    if (originalOwner && currentOwner && !same(originalOwner, currentOwner)) return "pro_owned";
  }
  return "base";
}

function getPlayerRosterKindLabel(player, contracts = [], memberId = "") {
  const playerId = getPlayerStableId(player);
  const contract = (contracts || []).find((item) => same(item.playerId, playerId) && clean(item.status || "active") === "active");
  const kind = getRosterPlayerKindFromContract(player, contract, memberId);
  if (kind === "pro_owned") return "محترف شراء";
  if (kind === "pro_loan") return "محترف إعارة";
  if (kind === "free") return "لاعب حر";
  return "لاعب أساسي";
}

function getTransferPeriods(rows) {
  const names = [];
  rows.forEach((row) => {
    const name = row.period || row["الفترة"] || "الفترة الأولى";
    if (name && !names.includes(name)) names.push(name);
  });
  return names.map((name) => ({
    id: clean(name),
    name,
    rows: rows.filter(
      (row) =>
        clean(row.period || row["الفترة"] || "الفترة الأولى") === clean(name)
    ),
  }));
}
function toCssSize(value, fallback = "50px") {
  const raw = String(value || "").trim();
  if (!raw) return fallback;
  if (/^-?\d+(\.\d+)?$/.test(raw)) return `${raw}px`;
  return raw;
}

function normalizeKey(value) {
  return removeBom(String(value || ""))
    .trim()
    .replaceAll(" ", "")
    .toLowerCase();
}
function removeBom(value) {
  const text = String(value || "");
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}
function clean(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}
function cleanId(value) {
  return String(value || "").trim();
}
function same(a, b) {
  return cleanId(a) === cleanId(b);
}
function hasRecord(row) {
  return cleanId(row.id) || cleanId(row.trophyid) || cleanId(row.edition);
}
function toNumber(value) {
  const number = Number(String(value || "0").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(number) ? number : 0;
}
function formatMoney(value) {
  const raw = String(value || "0").trim();
  const number = Number(raw.replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(number)) return raw;
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(
    Math.max(Math.min(number, 999999999), -999999999)
  );
}
function avatar(seed) {
  return (
    "https://api.dicebear.com/8.x/initials/svg?seed=" +
    encodeURIComponent(seed || "user")
  );
}
function isEnabled(value) {
  return String(value).toLowerCase() !== "false" && String(value) !== "0";
}
function getFinanceMemberId(row) {
  return cleanId(
    row?.memberid ||
      row?.memberId ||
      row?.member ||
      row?.member_id ||
      row?.membercode ||
      row?.playerid ||
      row?.userid ||
      row?.["رقمالعضو"] ||
      row?.["العضو"]
  );
}

function getFinanceFromMemberId(row) {
  return cleanId(
    row?.frommemberid ||
      row?.fromMemberId ||
      row?.from_member_id ||
      row?.fromid ||
      row?.fromId ||
      row?.senderid ||
      row?.senderId ||
      row?.["من"] ||
      row?.["منالعضو"]
  );
}

function getFinanceToMemberId(row) {
  return cleanId(
    row?.tomemberid ||
      row?.toMemberId ||
      row?.to_member_id ||
      row?.toid ||
      row?.toId ||
      row?.receiverid ||
      row?.receiverId ||
      row?.["إلى"] ||
      row?.["الى"] ||
      row?.["الىالعضو"] ||
      row?.["إلىالعضو"]
  );
}

function isFinanceTransfer(row) {
  const explicit = clean(
    row?.direction ||
      row?.dir ||
      row?.kind ||
      row?.status ||
      row?.operation ||
      row?.["الاتجاه"] ||
      row?.["نوعالحركة"]
  );

  const text = clean(
    [
      explicit,
      row?.type,
      row?.note,
      row?.description,
      row?.details,
      row?.["النوع"],
      row?.["ملاحظات"],
      row?.["البيان"],
    ].join(" ")
  );

  return (
    explicit === "transfer" ||
    explicit === "تحويل" ||
    text.includes("transfer") ||
    text.includes("تحويل") ||
    Boolean(getFinanceFromMemberId(row) && getFinanceToMemberId(row))
  );
}

function getMemberFinanceRows(rows, memberId) {
  const id = cleanId(memberId);
  if (!id) return [];
  return (rows || [])
    .filter((item) => {
      if (isFinanceTransfer(item)) {
        return same(getFinanceFromMemberId(item), id) || same(getFinanceToMemberId(item), id);
      }
      return same(getFinanceMemberId(item), id);
    })
    .slice()
    .sort((a, b) => dateValue(b.date || b.createdat) - dateValue(a.date || a.createdat));
}

function getFinanceRawAmount(row) {
  return (
    row?.amount ??
    row?.value ??
    row?.total ??
    row?.price ??
    row?.cost ??
    row?.fee ??
    row?.money ??
    row?.balance ??
    row?.["المبلغ"] ??
    row?.["القيمة"] ??
    row?.["السعر"] ??
    ""
  );
}

function normalizeDigits(value) {
  const arabic = "٠١٢٣٤٥٦٧٨٩";
  const persian = "۰۱۲۳۴۵۶۷۸۹";
  return String(value || "")
    .replace(/[٠-٩]/g, (d) => String(arabic.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String(persian.indexOf(d)));
}

function parseFinanceAmount(value) {
  let raw = normalizeDigits(value).trim();
  if (!raw) return 0;

  const negative =
    raw.startsWith("-") ||
    raw.includes("(خ") ||
    raw.includes("خصم") ||
    raw.includes("expense") ||
    /^\(.*\)$/.test(raw);

  let multiplier = 1;
  const compact = raw.toLowerCase();

  if (
    compact.includes("مليار") ||
    compact.includes("billion") ||
    compact.includes("bn") ||
    /\bb\b/.test(compact)
  ) {
    multiplier = 1000000000;
  } else if (
    compact.includes("مليون") ||
    compact.includes("ملايين") ||
    compact.includes("million") ||
    compact.includes("mn") ||
    /\bm\b/.test(compact)
  ) {
    multiplier = 1000000;
  } else if (
    compact.includes("ألف") ||
    compact.includes("الف") ||
    compact.includes("thousand") ||
    /\bk\b/.test(compact)
  ) {
    multiplier = 1000;
  }

  raw = raw
    .replace(/[^\d.,-]/g, "")
    .replace(/^\((.*)\)$/, "$1")
    .trim();

  if (!raw) return 0;

  const hasComma = raw.includes(",");
  const hasDot = raw.includes(".");

  if (hasComma && hasDot) {
    const lastComma = raw.lastIndexOf(",");
    const lastDot = raw.lastIndexOf(".");
    if (lastComma > lastDot) {
      raw = raw.replace(/\./g, "").replace(",", ".");
    } else {
      raw = raw.replace(/,/g, "");
    }
  } else if (hasComma) {
    const parts = raw.split(",");
    const last = parts[parts.length - 1] || "";
    if (last.length === 3 && parts.length > 1) {
      raw = raw.replace(/,/g, "");
    } else {
      raw = raw.replace(",", ".");
    }
  } else if (hasDot) {
    const parts = raw.split(".");
    const allGroupsAreThousands =
      parts.length > 1 && parts.slice(1).every((part) => part.length === 3);
    if (allGroupsAreThousands) raw = raw.replace(/\./g, "");
  }

  const number = Number(raw);
  if (!Number.isFinite(number)) return 0;
  const signed = Math.abs(number) * multiplier;
  return negative || number < 0 ? -signed : signed;
}

function getFinanceDirection(row, memberId = "") {
  const id = cleanId(memberId);

  if (isFinanceTransfer(row)) {
    if (id && same(getFinanceFromMemberId(row), id)) return "expense";
    if (id && same(getFinanceToMemberId(row), id)) return "income";
    return "transfer";
  }

  const explicit = clean(
    row?.direction ||
      row?.dir ||
      row?.kind ||
      row?.status ||
      row?.operation ||
      row?.["الاتجاه"] ||
      row?.["نوعالحركة"]
  );

  if (["income", "in", "plus", "+", "add", "credit", "deposit", "دخل", "ايراد", "إيراد", "اضافة", "إضافة", "ايداع", "إيداع", "زيادة", "تحصيل", "استلام", "استقبال", "مكافأة", "مكافاه", "جائزة", "جوائز"].includes(explicit)) return "income";
  if (["expense", "out", "minus", "-", "subtract", "debit", "withdraw", "مصروف", "خصم", "شراء", "دفع", "سحب", "غرامة", "غرامه", "خروج", "ناقص", "صرف"].includes(explicit)) return "expense";

  const rawAmount = String(getFinanceRawAmount(row) || "").trim();
  if (parseFinanceAmount(rawAmount) < 0) return "expense";

  const text = clean([row?.type, row?.note, row?.from, row?.description, row?.details, row?.["النوع"], row?.["ملاحظات"], row?.["البيان"]].join(" "));

  if (text.includes("شراء") || text.includes("خصم") || text.includes("غرام") || text.includes("دفع") || text.includes("مصروف") || text.includes("عقد") || text.includes("سحب") || text.includes("صرف") || text.includes("خروج") || text.includes("expense") || text.includes("debit") || text.includes("withdraw")) return "expense";
  if (text.includes("جائزة") || text.includes("جوائز") || text.includes("مكاف") || text.includes("بيع") || text.includes("استقبال") || text.includes("استلام") || text.includes("إيداع") || text.includes("ايداع") || text.includes("دخل") || text.includes("إيراد") || text.includes("ايراد") || text.includes("تحصيل") || text.includes("income") || text.includes("credit") || text.includes("deposit")) return "income";

  return "neutral";
}

function getFinanceSignedAmount(row, memberId = "") {
  const parsedAmount = parseFinanceAmount(getFinanceRawAmount(row));
  const absoluteAmount = Math.abs(parsedAmount);
  const id = cleanId(memberId);

  if (isFinanceTransfer(row)) {
    if (id && same(getFinanceFromMemberId(row), id)) return -absoluteAmount;
    if (id && same(getFinanceToMemberId(row), id)) return absoluteAmount;
    return 0;
  }

  const direction = getFinanceDirection(row, id);
  if (direction === "expense") return -absoluteAmount;
  if (direction === "income") return absoluteAmount;
  return parsedAmount;
}

function computeMemberBalance(rows, fallbackValue = 0, memberId = "") {
  const safeRows = Array.isArray(rows) ? rows : [];
  if (!safeRows.length) return toNumber(fallbackValue);
  return safeRows.reduce((total, item) => total + getFinanceSignedAmount(item, memberId), 0);
}

function financeDirectionLabel(direction) {
  if (direction === "income") return "إضافة للرصيد";
  if (direction === "expense") return "خصم من الرصيد";
  if (direction === "transfer") return "تحويل مالي";
  return "حركة مالية";
}

function getFinanceDisplayTitle(row, memberId = "", members = []) {
  const rowType = clean(row?.type);
  if (rowType === "offer_fee") return "رسوم تقديم عرض لاعب";
  if (rowType === "offer_edit_fee") return "رسوم تعديل عرض لاعب";
  if (isFinanceTransfer(row)) {
    const fromId = getFinanceFromMemberId(row);
    const toId = getFinanceToMemberId(row);
    if (memberId && same(fromId, memberId)) return `تحويل إلى ${getMemberName(members, toId)}`;
    if (memberId && same(toId, memberId)) return `تحويل من ${getMemberName(members, fromId)}`;
    return "تحويل مالي";
  }
  const direction = getFinanceDirection(row, memberId);
  return row.type || (direction === "income" ? "إضافة" : direction === "expense" ? "خصم" : "حركة مالية");
}

function financeTypeClass(row, memberId = "") {
  const direction = getFinanceDirection(row, memberId);
  if (direction === "income") return "income";
  if (direction === "expense") return "expense";
  return "neutral";
}
function transferTypeClass(type) {
  const value = clean(type);
  if (value.includes("إعارة")) return "loan";
  if (value.includes("تبديل") || value.includes("تبادل")) return "swap";
  if (value.includes("استغ") || value.includes("استغناء")) return "release";
  if (value.includes("حر") || value.includes("عقد")) return "free";
  return "neutral";
}
function transferRowTimeValue(row = {}) {
  if (!row) return 0;
  if (row.createdAt?.toDate) return row.createdAt.toDate().getTime();
  if (row.createdAt?.seconds) return Number(row.createdAt.seconds) * 1000;
  const parsed = new Date(row.date || row.createdAt || 0).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function loanDurationLabel(months) {
  const value = toNumber(months);
  if (value === 2) return "شهرين";
  if (value === 4) return "4 شهور";
  if (value === 6) return "6 شهور";
  return value ? value + " شهور" : "-";
}

function isLoanTransferRow(row = {}) {
  const value = clean([row?.type, row?.typeLabel, row?.contractType].join(" "));
  return value.includes("loan") || value.includes("إعارة") || value.includes("اعارة");
}

function transferStatusLabel(status) {
  const value = clean(status || "");
  if (value === "completed") return "مكتملة";
  if (value === "approvedpendingwindow") return "بانتظار فتح السوق";
  if (value === "active") return "نشطة";
  if (value === "terminated") return "منتهية";
  if (value === "cancelled") return "ملغاة";
  return status || "مسجلة";
}

function effectiveTransferStatusLabel(row = {}) {
  if (clean(row?.status) === "approvedpendingwindow" && (row?.marketWasOpenAtApproval || row?.loanStartDate || row?.completedAt)) return "مكتملة";
  return transferStatusLabel(row?.status);
}

function formatContractIssuedAt(row = {}) {
  const raw = row?.approvedAt || row?.createdAt || row?.updatedAt || row?.date || null;
  let date = null;
  if (raw?.toDate) date = raw.toDate();
  else if (raw?.seconds) date = new Date(Number(raw.seconds) * 1000);
  else if (typeof raw === "string" && raw.length > 10) date = new Date(raw);
  if (!date || Number.isNaN(date.getTime())) date = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())} ${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function escapeSvgText(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function downloadTransferContractImage(row = {}, player = {}, logoUrl = "") {
  const width = 1200;
  const loanRow = isLoanTransferRow(row);
  const offeredPlayers = Array.isArray(row?.offeredPlayers) ? row.offeredPlayers : [];
  const hasSwap = offeredPlayers.length > 0;
  const height = hasSwap ? (loanRow ? 1080 : 920) : (loanRow ? 980 : 760);
  const playerName = player?.name || row?.playerName || row?.player || "لاعب";
  const playerRating = player?.rating || row?.playerRating || "-";
  const type = row?.typeLabel || (loanRow ? "عقد إعارة" : clean(row?.type) === "buy" ? "عقد شراء" : row?.type || "صفقة");
  const period = row?.period || row?.periodName || "سوق الانتقالات";
  const parties = getTransferContractParties(row);
  const from = parties.from || "-";
  const to = parties.to || "-";
  const amount = formatMoney(row?.amount || row?.rawAmount || row?.amountNumber || 0);
  const dealDate = row?.date || formatTransferDate(row?.createdAt);
  const issuedAt = formatContractIssuedAt(row);
  const status = effectiveTransferStatusLabel(row);
  const loanDuration = loanRow ? loanDurationLabel(row?.loanDurationMonths) : "";
  const loanStartDate = row?.loanStartDate || dealDate;
  const imageUrl = player?.image || row?.playerImage || FALLBACK_PLAYER_IMAGE;
  const brandLogoUrl = logoUrl || "";
  const safeName = String(playerName).replace(/[^\u0621-\u064Aa-zA-Z0-9_-]+/g, "-") || "contract";

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function fillText(text, x, y, size = 32, color = "#f8fafc", align = "center", weight = "900", maxWidth = undefined) {
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.direction = "rtl";
    ctx.font = `${weight} ${size}px Tahoma, Arial, sans-serif`;
    ctx.fillText(String(text || "-"), x, y, maxWidth);
  }

  function drawBox(label, value, x, y, w, h, valueSize = 26) {
    ctx.fillStyle = "rgba(255,255,255,.075)";
    roundRect(x, y, w, h, 18); ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.10)"; ctx.lineWidth = 1.2; ctx.stroke();
    fillText(label, x + w - 18, y + 28, 20, "#7dd3fc", "right", "900", w - 34);
    fillText(value, x + w / 2, y + h - 20, valueSize, "#f8fafc", "center", "900", w - 28);
  }

  function drawBase(playerImage = null, logoImage = null, offeredImages = []) {
    const bg = ctx.createLinearGradient(0, 0, width, height);
    bg.addColorStop(0, "#07111f");
    bg.addColorStop(.55, "#0f1b33");
    bg.addColorStop(1, "#020617");
    ctx.fillStyle = bg;
    roundRect(0, 0, width, height, 48); ctx.fill();

    ctx.fillStyle = "rgba(0,229,255,.10)";
    ctx.beginPath(); ctx.arc(150, 90, 180, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(139,92,246,.12)";
    ctx.beginPath(); ctx.arc(980, 80, 220, 0, Math.PI * 2); ctx.fill();

    if (logoImage) {
      ctx.save();
      roundRect(78, 62, 92, 92, 24); ctx.clip();
      ctx.drawImage(logoImage, 78, 62, 92, 92);
      ctx.restore();
    } else {
      fillText("FG", 124, 122, 42, "#67e8f9", "center", "1000");
    }

    fillText("FIFA GROUP", 600, 86, 26, "#a8b3c7", "center", "700");
    fillText("العقد الخاص بالصفقة", 600, 150, 58, "#ffffff", "center", "1000");
    fillText(`${period} • ${type}`, 600, 198, 26, "#a8b3c7", "center", "700");
    fillText(`تاريخ الإصدار: ${issuedAt}`, 600, 228, 23, "#bae6fd", "center", "900");

    ctx.fillStyle = "rgba(255,255,255,.08)";
    roundRect(70, 255, 1060, 196, 38); ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.20)"; ctx.lineWidth = 2; ctx.stroke();

    if (playerImage) {
      ctx.save(); roundRect(875, 290, 125, 125, 24); ctx.clip(); ctx.drawImage(playerImage, 875, 290, 125, 125); ctx.restore();
    } else {
      ctx.fillStyle = "rgba(255,255,255,.08)"; roundRect(875, 290, 125, 125, 24); ctx.fill();
      fillText("FG", 937, 363, 42, "#67e8f9", "center", "1000");
    }

    const accent = ctx.createLinearGradient(150, 295, 260, 405);
    accent.addColorStop(0, "#00e5ff"); accent.addColorStop(1, "#2f8cff");
    ctx.fillStyle = accent; roundRect(150, 295, 110, 110, 32); ctx.fill();
    fillText(playerRating, 205, 363, 46, "#020617", "center", "1000");
    fillText(playerName, 820, 338, 46, "#ffffff", "right", "1000", 520);
    fillText(status, 820, 386, 27, "#a8b3c7", "right", "800", 500);
    fillText(`تاريخ الإبرام: ${dealDate}`, 820, 421, 23, "#bae6fd", "right", "900", 500);

    ctx.fillStyle = "rgba(0,229,255,.08)";
    roundRect(70, 480, 1060, 116, 28); ctx.fill();
    ctx.strokeStyle = "rgba(0,229,255,.22)"; ctx.stroke();
    fillText(parties.fromLabel || "من", 970, 525, 24, "#7dd3fc", "center", "900");
    fillText(from, 970, 570, 34, "#f8fafc", "center", "900", 300);
    fillText("←", 600, 556, 44, "#67e8f9", "center", "1000");
    fillText(parties.toLabel || "إلى", 230, 525, 24, "#7dd3fc", "center", "900");
    fillText(to, 230, 570, 34, "#f8fafc", "center", "900", 300);

    const metaY = 625;
    const boxW = loanRow ? 250 : 310;
    drawBox("قيمة الصفقة", amount, 820, metaY, 310, 78, 28);
    drawBox("الحالة", status, 70, metaY, 310, 78, 26);
    if (loanRow) {
      drawBox("مدة الإعارة", loanDuration, 548, metaY, 250, 78, 28);
      drawBox("بداية الإعارة", loanStartDate, 390, metaY, 140, 78, 21);
    } else {
      drawBox("تاريخ الإبرام", dealDate, 445, metaY, 310, 78, 26);
    }

    if (hasSwap) {
      const swapY = metaY + 108;
      const swapBoxH = Math.min(190, Math.max(118, 70 + Math.ceil(Math.min(offeredPlayers.length, 6) / 2) * 54));
      ctx.fillStyle = "rgba(255,255,255,.055)";
      roundRect(70, swapY, 1060, swapBoxH, 22); ctx.fill();
      ctx.strokeStyle = "rgba(0,229,255,.12)"; ctx.lineWidth = 1.2; ctx.stroke();
      fillText("بنود التبادل ضمن الصفقة", 1060, swapY + 30, 21, "#7dd3fc", "right", "900");
      offeredPlayers.slice(0, 6).forEach((item, index) => {
        const col = index % 2;
        const rowIndex = Math.floor(index / 2);
        const x = col === 0 ? 865 : 365;
        const y = swapY + 48 + rowIndex * 54;
        const img = offeredImages[index];
        if (img) { ctx.save(); roundRect(x, y, 42, 42, 12); ctx.clip(); ctx.drawImage(img, x, y, 42, 42); ctx.restore(); }
        else { ctx.fillStyle = "rgba(255,255,255,.08)"; roundRect(x, y, 42, 42, 12); ctx.fill(); }
        fillText(item.playerName || item.name || "لاعب", x - 10, y + 19, 20, "#f8fafc", "right", "900", 360);
        fillText(exchangeContractLabel(item), x - 10, y + 43, 17, "#bae6fd", "right", "800", 360);
      });
      if (offeredPlayers.length > 6) {
        fillText(`+ ${offeredPlayers.length - 6} بنود إضافية`, 600, swapY + swapBoxH - 16, 17, "#94a3b8", "center", "800");
      }
      fillText("FIFA GROUP • وثيقة صفقة رقمية", 600, height - 34, 18, "#64748b", "center", "800");
    } else {
      // التواقيع محذوفة لتوفير مساحة في صورة العقد
    }

    const a = document.createElement("a");
    a.download = `FIFA-GROUP-${safeName}.png`;
    try { a.href = canvas.toDataURL("image/png"); }
    catch (err) {
      if (playerImage || logoImage) { drawBase(null, null, []); return; }
      console.error("Contract PNG export failed:", err); return;
    }
    document.body.appendChild(a); a.click(); a.remove();
  }

  function loadCanvasImage(url) {
    return new Promise((resolve) => {
      if (!url) return resolve(null);
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = url;
    });
  }

  Promise.all([
    loadCanvasImage(imageUrl),
    loadCanvasImage(brandLogoUrl),
    ...offeredPlayers.slice(0, 4).map((item) => loadCanvasImage(item.playerImage || item.image || "")),
  ]).then(([mainImage, logoImage, ...swapImages]) => drawBase(mainImage, logoImage, swapImages));
}

function linkIcon(name, config = DEFAULT_CONFIG) {
  const value = clean(name);
  if (value.includes("فيس")) return config.linkFacebookIcon;
  if (value.includes("بطولات")) return config.linkTournamentsIcon;
  if (value.includes("موسم")) return config.linkSeasonIcon;
  return config.linkDefaultIcon;
}
function unique(items) {
  return Array.from(new Set(items));
}
function dateValue(date) {
  const match = String(date || "").match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
  if (!match) return 0;
  return Number(match[1]) * 10000 + Number(match[2]) * 100 + Number(match[3]);
}
function normalizeDate(date) {
  const match = String(date || "").match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
  if (!match) return String(date || "");
  return `${Number(match[1])}/${Number(match[2])}/${Number(match[3])}`;
}
function seasonNumber(seasonId) {
  const n = String(seasonId || "").match(/\d+/);
  return n ? Number(n[0]) : 999;
}

const css = `
*{box-sizing:border-box}html,body,#root{margin:0;min-height:100%;width:100%;background:#020617;overflow-x:hidden;touch-action:pan-y;overscroll-behavior-x:none}button,input{font-family:inherit}.app{min-height:100vh;padding:14px 14px calc(102px + env(safe-area-inset-bottom));color:#f8fafc;font-family:Tahoma,Arial,sans-serif;background:#020617;position:relative;overflow-x:hidden}.app:before{content:"";position:fixed;inset:0;z-index:0;pointer-events:none;background:radial-gradient(circle at 12% 4%,rgba(0,229,255,.18),transparent 28%),radial-gradient(circle at 92% 8%,rgba(139,92,246,.16),transparent 30%),linear-gradient(135deg,#020617 0%,#07111f 48%,#030712 100%)}.app>*{position:relative;z-index:1}.bgOrb{position:fixed;border-radius:999px;filter:blur(12px);opacity:.2;z-index:0;pointer-events:none}.bgOrbOne{width:280px;height:280px;background:rgba(0,229,255,.16);top:80px;left:60px}.bgOrbTwo{width:260px;height:260px;background:rgba(139,92,246,.13);top:80px;right:40px}.glass{background:linear-gradient(135deg,rgba(255,255,255,.14),rgba(255,255,255,.055));border:1px solid rgba(255,255,255,.18);box-shadow:0 26px 90px rgba(0,0,0,.42),inset 0 1px 0 rgba(255,255,255,.22);backdrop-filter:blur(26px) saturate(150%);-webkit-backdrop-filter:blur(26px) saturate(150%)}.glassSoft{background:linear-gradient(135deg,rgba(255,255,255,.10),rgba(255,255,255,.045));border:1px solid rgba(255,255,255,.14);box-shadow:0 18px 55px rgba(0,0,0,.30),inset 0 1px 0 rgba(255,255,255,.15);backdrop-filter:blur(22px) saturate(140%);-webkit-backdrop-filter:blur(22px) saturate(140%)}.mainHero{max-width:1180px;height:226px;margin:0 auto 14px;border-radius:34px;display:flex;align-items:flex-end;padding:28px;text-align:right;overflow:hidden;position:relative}.mainHero.hasCoverImage{padding:0}.coverImage{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}.coverContent{width:100%;display:flex;align-items:center;justify-content:space-between;gap:18px}.heroKicker{display:flex;align-items:center;gap:8px;color:var(--cyan);font-weight:900;letter-spacing:3px;font-size:13px}.heroKicker span{width:10px;height:10px;border-radius:999px;background:var(--cyan);box-shadow:0 0 22px var(--cyan)}.mainHero h1{margin:8px 0 4px;font-size:56px;line-height:1.02;letter-spacing:1px;font-weight:1000}.mainHero p{margin:0;font-size:24px;font-weight:900;color:#dff7ff}.coverIconBox{width:92px;height:92px;border-radius:26px;display:grid;place-items:center;overflow:hidden;border:2px solid rgba(255,255,255,.26);background:rgba(255,255,255,.08)}.coverIconBox img{width:100%;height:100%;object-fit:cover}.coverIconBox b{font-size:30px;color:#020617;background:linear-gradient(135deg,var(--cyan),var(--blue));width:100%;height:100%;display:grid;place-items:center}.announcement{max-width:1180px;margin:0 auto 12px;padding:12px 16px;border-radius:18px;text-align:center;font-weight:900}.widePage,.membersHome,.memberProfilePage{max-width:1180px;margin:0 auto;border-radius:32px;padding:20px;overflow:hidden}.pageHead{margin-bottom:18px}.pageHead h2{margin:0;font-size:32px;line-height:1.18;font-weight:1000}.pageHead p{margin:8px 0 0;color:#a8b3c7;font-size:15px;line-height:1.45;font-weight:800}.mainNav{position:fixed!important;left:50%;right:auto;bottom:calc(12px + env(safe-area-inset-bottom));transform:translateX(-50%);width:min(94vw,520px);height:72px;margin:0;padding:7px;border-radius:24px;z-index:999;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:5px;background:linear-gradient(135deg,rgba(15,23,42,.90),rgba(2,6,23,.78));border:1px solid rgba(255,255,255,.18);box-shadow:0 22px 70px rgba(0,0,0,.48),inset 0 1px 0 rgba(255,255,255,.18);backdrop-filter:blur(24px) saturate(160%);-webkit-backdrop-filter:blur(24px) saturate(160%)}.navBtn{height:58px;min-width:0;padding:5px 2px;border-radius:18px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;border:1px solid transparent;background:transparent;color:#cbd5e1;cursor:pointer;font-weight:1000}.navBtn .navIcon{font-size:20px;line-height:1}.navBtn .navLabel{width:100%;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:9.5px}.navBtn.active{background:linear-gradient(135deg,rgba(0,229,255,.22),rgba(47,140,255,.26));border-color:rgba(0,229,255,.36);color:#ecfeff}.drawerBackdrop{position:fixed;inset:0;z-index:1200;background:rgba(0,0,0,.48);display:flex;justify-content:flex-start;align-items:stretch}.sideDrawer{width:min(82vw,340px);height:100%;padding:18px;border-radius:0 28px 28px 0}.sideDrawer header{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}.sideDrawer header b{font-size:24px}.sideDrawer header button,.modalClose{width:38px;height:38px;border-radius:50%;border:0;background:rgba(255,255,255,.10);color:white;font-size:24px;cursor:pointer}.sideDrawer>button{width:100%;height:58px;margin-bottom:10px;border-radius:18px;border:1px solid rgba(255,255,255,.13);background:rgba(255,255,255,.06);color:white;display:flex;align-items:center;gap:12px;padding:0 14px;cursor:pointer;text-align:right}.sideDrawer>button span{font-size:24px}.sideDrawer>button b{font-size:16px}.seasonMembersGrid,.listGrid,.rankingList{display:grid;gap:10px}.seasonMemberCard{height:88px;border-radius:22px;padding:10px 14px;border:0;color:white;cursor:pointer;display:grid;grid-template-columns:48px 62px minmax(0,1fr) 82px;gap:12px;align-items:center;text-align:right;direction:rtl;overflow:hidden}.seasonMemberRank{width:38px;height:38px;border-radius:999px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.075);border:1px solid rgba(255,255,255,.12);color:#b9f7ff;font-size:15px;font-weight:1000}.seasonMemberCard img{width:62px;height:62px;border-radius:18px;object-fit:cover;background:white}.seasonMemberCard b,.seasonMemberCard small{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.seasonMemberCard b{font-size:22px;line-height:1.16}.seasonMemberCard small{font-size:14px;color:#a8b3c7;margin-top:5px}.seasonMemberCard em{height:46px;border-radius:999px;display:flex;align-items:center;justify-content:center;font-style:normal;font-weight:1000;color:#020617;background:linear-gradient(135deg,var(--cyan),var(--blue));font-size:22px;direction:ltr}.backToMembersBtn{height:38px;margin:0 0 14px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.08);color:#ecfeff;border-radius:999px;padding:0 16px;font-weight:900;cursor:pointer}.profileCard{min-height:146px;border-radius:28px;border:1px solid rgba(255,255,255,.12);background:rgba(2,6,23,.22);padding:18px;display:flex;align-items:center;justify-content:space-between;gap:16px;overflow:visible}.profileMain{display:flex;align-items:center;gap:16px;min-width:0}.profileMain>img{width:108px;height:108px;border-radius:32px;object-fit:cover;background:white;border:2px solid rgba(255,255,255,.28)}.profileMain h2{margin:0 0 8px;font-size:42px;line-height:1.2;font-weight:1000}.chips{display:flex;flex-wrap:wrap;gap:8px}.chips span{height:34px;display:inline-flex;align-items:center;max-width:190px;padding:0 12px;border-radius:999px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14);color:#ecfeff;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.logos{display:flex;gap:10px}.logos button{border:0;background:transparent;padding:0;cursor:pointer}.logos img{width:64px;height:64px;object-fit:contain;filter:drop-shadow(0 10px 14px rgba(0,0,0,.35))}.statGrid,.statsPanelGrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin:14px 0}.statCard{height:142px;border-radius:26px;padding:18px;display:grid;align-content:center;gap:9px;text-align:center;color:white;border:1px solid rgba(255,255,255,.14);cursor:default}.statCard.clickable{cursor:pointer}.statCard span{font-size:28px}.statCard b{font-size:34px;color:#ecfeff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;direction:ltr;unicode-bidi:plaintext}.statCard small{font-size:14px;color:#d7e3f5;font-weight:900}.tabs{display:flex;gap:10px;align-items:center;margin:14px 0;overflow-x:auto}.tabBtn{height:38px;padding:0 17px;border-radius:999px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.06);color:white;cursor:pointer;font-weight:1000;white-space:nowrap}.tabBtn.active{background:linear-gradient(135deg,var(--cyan),var(--blue));color:#020617;border-color:transparent}.sectionBox{border-radius:28px;padding:18px;overflow:hidden}.sectionHead{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:14px}.sectionHead h3{margin:0;font-size:27px;line-height:1.18}.sectionHead p{margin:6px 0 0;color:#a8b3c7;font-size:14px}.sectionHead input{width:300px;height:44px;border-radius:18px;border:1px solid rgba(255,255,255,.14);background:rgba(2,6,23,.28);color:white;padding:0 14px;outline:none}.playersGrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px}.playerCard{height:96px;border-radius:22px;padding:12px;display:grid;grid-template-columns:62px 1fr 48px;gap:12px;align-items:center;background:rgba(2,6,23,.30);border:1px solid rgba(255,255,255,.12);overflow:hidden}.playerPhoto{width:62px;height:62px;border-radius:18px;object-fit:contain;background:rgba(255,255,255,.08)}.playerInfo h4{margin:0 0 8px;font-size:18px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.playerMeta{margin:0;display:flex;gap:6px;overflow:hidden}.playerMeta span{font-size:12px;padding:5px 8px;border-radius:999px;background:rgba(0,229,255,.12);border:1px solid rgba(0,229,255,.22);color:#cffafe;font-weight:900;white-space:nowrap}.playerRating{width:48px;height:48px;border-radius:16px;display:grid;place-items:center;background:linear-gradient(135deg,var(--cyan),var(--blue));color:#020617;font-weight:1000}.trophyGrid,.seasonGrid,.linkGrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px}.trophyCard,.seasonTile,.linkTile{min-height:178px;border-radius:24px;padding:14px;background:rgba(2,6,23,.28);border:1px solid rgba(255,255,255,.12);color:#cbd5e1;text-align:center;text-decoration:none;display:grid;place-items:center;overflow:hidden;cursor:pointer}.trophyCard.won,.seasonTile:hover{background:linear-gradient(180deg,rgba(0,229,255,.20),rgba(255,255,255,.055));border-color:rgba(0,229,255,.45)}.trophyCard img,.seasonTile img{width:74px;height:74px;object-fit:contain;filter:drop-shadow(0 10px 14px rgba(0,0,0,.35))}.trophyCard h4,.seasonTile b{margin:0;font-size:16px;line-height:1.22}.trophyCard b{font-size:34px;color:var(--cyan)}.seasonTile span{font-size:13px;padding:4px 8px;border-radius:999px;background:rgba(255,255,255,.08);font-weight:900}.archiveSeasonGrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:14px}.archiveSeasonCard{border-radius:28px;padding:18px;position:relative;overflow:hidden}.archiveSeasonCard em{position:absolute;top:16px;left:16px;width:58px;height:58px;border-radius:18px;display:grid;place-items:center;background:linear-gradient(135deg,var(--cyan),var(--blue));color:#020617;font-style:normal;font-weight:1000;font-size:22px}.archiveSeasonCard h3{margin:0 0 8px;font-size:26px}.archiveSeasonCard p,.archiveSeasonCard small{display:block;margin:4px 0;color:#a8b3c7;font-weight:800}.seasonTrophyChips{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}.seasonTrophyChips button{height:42px;min-width:62px;border-radius:999px;border:1px solid rgba(255,255,255,.12);background:rgba(255,255,255,.07);color:white;display:flex;align-items:center;gap:6px;padding:0 8px;cursor:pointer}.seasonTrophyChips img{width:26px;height:26px;object-fit:contain}.seasonTrophyChips span{font-weight:1000;color:var(--cyan)}.championRow{min-height:78px;border-radius:20px;padding:14px;background:rgba(2,6,23,.28);border:1px solid rgba(255,255,255,.12);display:grid;grid-template-columns:repeat(3,1fr);gap:10px;color:white;text-align:center;cursor:pointer}.championRow div{min-width:0;padding:8px;border-radius:12px;background:rgba(255,255,255,.045)}.championRow span{display:block;color:#a8b3c7;font-size:12px}.championRow b{display:block;margin-top:6px;font-size:18px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.championRow p{grid-column:1/-1;margin:4px 0 0;color:#cbd5e1;font-size:13px;text-align:right}.finalRow{min-height:88px;border-radius:20px;padding:14px;background:rgba(2,6,23,.28);border:1px solid rgba(255,255,255,.12);color:white;display:grid;grid-template-columns:70px 1fr 70px;gap:8px;align-items:center;text-align:right;cursor:pointer}.finalRow.win{border-color:rgba(34,197,94,.45)}.finalRow.loss{border-color:rgba(239,68,68,.45)}.finalRow span{height:32px;border-radius:999px;display:grid;place-items:center;background:rgba(255,255,255,.08);font-weight:900}.finalRow b{font-size:16px}.finalRow small{color:#a8b3c7}.finalRow em{font-style:normal;font-weight:1000;color:var(--cyan);direction:ltr}.financeCard{min-height:92px;border-radius:20px;padding:14px;background:rgba(2,6,23,.28);border:1px solid rgba(255,255,255,.12);display:grid;grid-template-columns:auto 1fr;gap:12px;align-items:center}.financeCard.income{border-color:rgba(34,197,94,.42)}.financeCard.expense{border-color:rgba(239,68,68,.48)}.financeCard>b{color:#ecfeff;font-size:28px;direction:ltr}.financeCard strong,.financeCard span,.financeCard small,.financeCard p{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.transferCard{min-height:118px;border-radius:20px;padding:14px;background:rgba(2,6,23,.28);border:1px solid rgba(255,255,255,.12);display:grid;grid-template-columns:66px 1fr auto;gap:12px;align-items:center}.transferAvatar{width:64px;height:64px;border-radius:18px;object-fit:contain;background:rgba(255,255,255,.075);padding:5px}.transferMain h3{margin:0 0 7px;font-size:20px}.transferMain p{margin:0;display:flex;gap:7px;color:#cbd5e1}.transferRating{width:44px;height:44px;border-radius:14px;display:grid;place-items:center;background:linear-gradient(135deg,var(--cyan),var(--blue));color:#020617;font-weight:1000}.transferBadges{grid-column:1/-1;display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.transferBadges small{height:34px;display:flex;align-items:center;justify-content:center;border-radius:999px;background:rgba(255,255,255,.075);font-size:12px;font-weight:900;color:#ecfeff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.rankingCard{min-height:92px;border-radius:22px;padding:14px;background:rgba(2,6,23,.28);border:1px solid rgba(255,255,255,.12);display:grid;grid-template-columns:56px 58px 1fr 130px 130px;align-items:center;gap:12px;color:white;text-align:right}.rankingCard.first{border-color:rgba(0,229,255,.52);background:linear-gradient(135deg,rgba(0,229,255,.18),rgba(2,6,23,.28))}.rankingCard>span{font-size:24px;color:var(--cyan);font-weight:1000}.rankingCard img{width:58px;height:58px;border-radius:18px;object-fit:cover;background:white}.rankingCard p{margin:0}.rankingCard p strong{font-size:22px;color:#ecfeff}.rankingCard small{color:#a8b3c7}.statsTable{border-radius:24px;padding:12px;overflow:hidden}.statsTableHead,.statsTableRow{position:relative;display:grid;grid-template-columns:1.3fr repeat(6,.7fr);gap:6px;align-items:center;padding:12px;border-radius:16px;color:white}.statsTableHead{background:rgba(255,255,255,.09);font-weight:1000}.statsTableRow{border:1px solid rgba(255,255,255,.08);background:rgba(2,6,23,.28);margin-top:8px;text-align:center;cursor:pointer}.statsTableRow b{text-align:right}.statsTableRow i{position:absolute;right:0;bottom:0;height:3px;background:linear-gradient(90deg,var(--cyan),var(--blue));border-radius:999px}.recordHero{border-radius:26px;padding:16px;display:flex;align-items:center;gap:14px;margin-bottom:14px}.recordHero img{width:78px;height:78px;object-fit:contain}.recordHero h2{margin:0;font-size:28px}.recordHero p{margin:6px 0 0;color:#a8b3c7}.modalStatsGrid,.detailsGridPage{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.modalStatsGrid div{border-radius:18px;padding:16px;background:rgba(2,6,23,.28);border:1px solid rgba(255,255,255,.12)}.modalStatsGrid span{display:block;color:#a8b3c7;font-size:13px;margin-bottom:8px}.modalStatsGrid b{display:block;font-size:17px;line-height:1.4}.infoModal{width:min(92vw,430px);align-self:center;margin:auto;border-radius:28px;padding:22px;position:relative}.infoModal h3{margin:0 0 10px;font-size:24px}.infoModal p{color:#cbd5e1;line-height:1.5}.infoRows{display:grid;gap:8px}.infoRows div{display:flex;justify-content:space-between;gap:12px;border-radius:14px;background:rgba(255,255,255,.07);padding:10px}.systemScreen{min-height:100vh;background:#020617;color:white;font-family:Tahoma,Arial,sans-serif;display:grid;place-items:center;text-align:center}.systemCard{padding:30px;border-radius:28px}.spinner{width:42px;height:42px;border-radius:50%;border:4px solid rgba(255,255,255,.15);border-top-color:var(--cyan);margin:0 auto 16px;animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}.empty{padding:18px;border-radius:18px;background:rgba(2,6,23,.25);color:#cbd5e1}.clickable{cursor:pointer}
@media(max-width:720px){.app{padding:10px 8px calc(100px + env(safe-area-inset-bottom))}.mainHero{width:100%;max-width:430px;height:188px;margin:0 auto 10px;border-radius:24px;padding:18px}.mainHero h1{font-size:34px}.mainHero p{font-size:17px}.heroKicker{font-size:10px}.coverIconBox{width:66px;height:66px;border-radius:20px}.widePage,.membersHome,.memberProfilePage{width:100%;max-width:430px;border-radius:20px;padding:14px}.pageHead h2{font-size:24px}.pageHead p{font-size:12.5px}.seasonMemberCard{height:82px;grid-template-columns:38px 52px minmax(0,1fr) 70px;gap:8px;padding:10px;border-radius:18px}.seasonMemberRank{width:32px;height:32px;font-size:13px}.seasonMemberCard img{width:52px;height:52px;border-radius:16px}.seasonMemberCard b{font-size:16.5px}.seasonMemberCard small{font-size:11px}.seasonMemberCard em{height:38px;font-size:17px}.profileCard{min-height:132px;padding:12px;border-radius:20px}.profileMain{gap:10px}.profileMain>img{width:76px;height:76px;border-radius:20px}.profileMain h2{font-size:32px}.chips span{height:28px;font-size:11px}.logos{position:absolute;left:14px;top:14px}.logos img{width:36px;height:36px}.statGrid{grid-template-columns:1.18fr .92fr}.statsPanelGrid{grid-template-columns:repeat(2,minmax(0,1fr))}.statCard{height:118px;border-radius:20px;padding:10px}.statCard b{font-size:clamp(26px,7vw,38px)}.sectionBox{padding:14px;border-radius:20px}.sectionHead{display:grid}.sectionHead h3{font-size:22px}.sectionHead p{font-size:12px}.sectionHead input{width:100%;height:38px}.playersGrid{grid-template-columns:1fr}.playerCard{height:78px;grid-template-columns:54px minmax(0,1fr) 52px;padding:9px}.playerPhoto{width:54px;height:54px}.playerInfo h4{font-size:14.5px}.playerMeta span{font-size:9px}.trophyGrid,.seasonGrid,.linkGrid{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.trophyCard,.seasonTile,.linkTile{min-height:132px;border-radius:18px}.trophyCard img,.seasonTile img{width:52px;height:52px}.archiveSeasonGrid{grid-template-columns:1fr}.archiveSeasonCard h3{font-size:22px}.championRow{grid-template-columns

/* ===== 2026-04 FINAL HOTFIX: no clipped numbers, compact ranking, native back, safe bottom ===== */
html,body,#root{
  min-height:100%;
  overflow-x:hidden!important;
  overscroll-behavior-y:auto!important;
}
.app{
  padding-bottom:calc(128px + env(safe-area-inset-bottom))!important;
}
.mainNav{
  position:fixed!important;
  left:50%!important;
  right:auto!important;
  bottom:calc(12px + env(safe-area-inset-bottom))!important;
  transform:translateX(-50%)!important;
  width:min(100% - 20px,1180px)!important;
  max-width:1180px!important;
  z-index:999!important;
  margin:0!important;
}
.widePage,.membersHome,.memberProfilePage{
  margin-bottom:calc(26px + env(safe-area-inset-bottom))!important;
}

/* hide visual back button; native phone back/swipe controls subpages */
.backToMembersBtn{
  display:none!important;
}

/* universal numeric protection */
.statCard,
.statsPanelGrid .statCard,
.memberStatsGrid .statCard,
.generalTopStats .statCard,
.trophyCard,
.seasonStatCard{
  overflow:visible!important;
}
.statCard b,
.statCard strong,
.trophyCard b,
.trophyCard strong,
.seasonStatCard b,
.seasonStatCard strong{
  display:block!important;
  direction:ltr!important;
  unicode-bidi:plaintext!important;
  font-variant-numeric:tabular-nums!important;
  white-space:nowrap!important;
  overflow:visible!important;
  text-overflow:clip!important;
  max-width:none!important;
  line-height:1.05!important;
  letter-spacing:-1.2px!important;
  transform:none!important;
  padding:0 2px!important;
}

@media(max-width:720px){
  .app{
    padding-bottom:calc(132px + env(safe-area-inset-bottom))!important;
  }
  .mainNav{
    width:calc(100% - 18px)!important;
    max-width:430px!important;
    height:88px!important;
    min-height:88px!important;
    border-radius:28px!important;
    padding:8px!important;
    display:grid!important;
    grid-template-columns:repeat(5,minmax(0,1fr))!important;
    gap:4px!important;
    overflow:visible!important;
  }
  .navBtn{
    height:72px!important;
    min-height:72px!important;
    padding:6px 4px!important;
    border-radius:20px!important;
    display:flex!important;
    flex-direction:column!important;
    align-items:center!important;
    justify-content:center!important;
    gap:5px!important;
    font-size:12px!important;
    line-height:1.05!important;
    min-width:0!important;
  }
  .navIcon{font-size:23px!important;line-height:1!important}
  .navLabel{font-size:12px!important;line-height:1.1!important;white-space:nowrap!important}

  .statGrid,
  .statsPanelGrid,
  .memberStatsGrid,
  .generalTopStats{
    overflow:visible!important;
  }
  .statCard{
    min-width:0!important;
    overflow:visible!important;
    padding-left:6px!important;
    padding-right:6px!important;
  }
  .statCard b,
  .statCard strong{
    font-size:clamp(22px,7.2vw,34px)!important;
    line-height:1.06!important;
    letter-spacing:-1.8px!important;
    transform:scaleX(.86)!important;
    transform-origin:center!important;
    width:116%!important;
    margin-left:-8%!important;
    margin-right:-8%!important;
    text-align:center!important;
  }
  .memberStatsGrid .statCard b,
  .memberStatsGrid .statCard strong,
  .statsPanelGrid .statCard b,
  .statsPanelGrid .statCard strong{
    font-size:clamp(20px,6.4vw,31px)!important;
    transform:scaleX(.84)!important;
  }
  .statCard small,
  .statCard p{
    font-size:clamp(10px,3.2vw,13px)!important;
    line-height:1.2!important;
    white-space:nowrap!important;
    overflow:hidden!important;
    text-overflow:ellipsis!important;
  }

  /* ranking compact card */
  .rankingList{gap:10px!important}
  .rankingCard{
    min-height:86px!important;
    height:86px!important;
    padding:10px!important;
    border-radius:18px!important;
    display:grid!important;
    grid-template-columns:54px 58px minmax(0,1fr) 96px!important;
    gap:10px!important;
    align-items:center!important;
    overflow:hidden!important;
  }
  .rankingRank{
    grid-column:1!important;
    width:44px!important;
    height:44px!important;
    border-radius:999px!important;
    display:flex!important;
    align-items:center!important;
    justify-content:center!important;
    font-size:20px!important;
    color:var(--cyan)!important;
    background:rgba(255,255,255,.07)!important;
    border:1px solid rgba(255,255,255,.12)!important;
  }
  .rankingAvatar{
    grid-column:2!important;
    width:58px!important;
    height:58px!important;
    min-width:58px!important;
    min-height:58px!important;
    border-radius:17px!important;
    object-fit:cover!important;
  }
  .rankingIdentity{
    grid-column:3!important;
    min-width:0!important;
    display:grid!important;
    gap:7px!important;
    align-content:center!important;
    text-align:right!important;
  }
  .rankingIdentity b{
    font-size:19px!important;
    line-height:1.1!important;
    white-space:nowrap!important;
    overflow:hidden!important;
    text-overflow:ellipsis!important;
  }
  .rankingIdentity small{display:none!important}
  .rankingLogos{
    display:flex!important;
    gap:7px!important;
    align-items:center!important;
    justify-content:flex-start!important;
    height:24px!important;
  }
  .rankingLogos img{
    width:24px!important;
    height:24px!important;
    object-fit:contain!important;
    background:transparent!important;
    border-radius:0!important;
    filter:drop-shadow(0 5px 8px rgba(0,0,0,.35))!important;
  }
  .rankingInlineStats{
    grid-column:4!important;
    display:flex!important;
    flex-direction:row!important;
    align-items:center!important;
    justify-content:flex-end!important;
    gap:6px!important;
    min-width:0!important;
  }
  .rankingInlineStats span{
    height:30px!important;
    min-width:42px!important;
    padding:0 8px!important;
    border-radius:999px!important;
    background:rgba(255,255,255,.075)!important;
    border:1px solid rgba(255,255,255,.10)!important;
    display:flex!important;
    align-items:center!important;
    justify-content:center!important;
    font-size:12px!important;
    font-weight:1000!important;
    direction:ltr!important;
    unicode-bidi:plaintext!important;
    white-space:nowrap!important;
  }
  .rankingCard p{display:none!important}
}

@media(max-width:380px){
  .rankingCard{
    grid-template-columns:46px 52px minmax(0,1fr) 84px!important;
    gap:7px!important;
    padding:9px!important;
  }
  .rankingRank{width:38px!important;height:38px!important;font-size:17px!important}
  .rankingAvatar{width:52px!important;height:52px!important;min-width:52px!important;min-height:52px!important}
  .rankingIdentity b{font-size:16px!important}
  .rankingInlineStats{gap:4px!important}
  .rankingInlineStats span{height:28px!important;min-width:38px!important;padding:0 6px!important;font-size:11px!important}
  .navLabel{font-size:11px!important}
}

:repeat(2,1fr);padding:10px}.championRow div:nth-child(3){grid-column:1/-1}.championRow b{font-size:14px}.finalRow{grid-template-columns:62px 1fr 54px}.transferCard{grid-template-columns:64px 1fr;align-items:start}.transferRating{position:absolute;left:14px;top:14px}.transferBadges{grid-template-columns:repeat(2,1fr)}.rankingCard{grid-template-columns:42px 52px 1fr;gap:10px}.rankingCard p{grid-column:1/-1;display:flex;justify-content:space-between;background:rgba(255,255,255,.06);border-radius:12px;padding:8px}.statsTable{overflow-x:auto}.statsTableHead,.statsTableRow{min-width:680px}.modalStatsGrid,.detailsGridPage{grid-template-columns:1fr}.recordHero h2{font-size:22px}.mainNav{width:calc(100% - 18px);max-width:430px;height:72px;bottom:calc(10px + env(safe-area-inset-bottom))}.sideDrawer{border-radius:0 24px 24px 0}}
@media(max-width:380px){.mainHero h1{font-size:29px}.seasonMemberCard{grid-template-columns:34px 48px minmax(0,1fr) 62px;gap:6px}.seasonMemberCard b{font-size:15px}.profileMain h2{font-size:30px}.trophyGrid,.seasonGrid,.linkGrid{grid-template-columns:1fr}.playerCard{grid-template-columns:50px minmax(0,1fr) 46px}}


/* ===== ARCHIVE HUB 3 MODES: trophy / season / member ===== */
.archiveHubHead p{max-width:680px}
.archiveModeTabs{
  max-width:780px;
  margin:0 auto 18px;
  padding:8px;
  border-radius:22px;
  display:grid;
  grid-template-columns:repeat(3,minmax(0,1fr));
  gap:8px;
}
.archiveModeTabs button{
  height:44px;
  border:1px solid rgba(255,255,255,.12);
  background:rgba(255,255,255,.055);
  color:#f8fafc;
  border-radius:16px;
  font-weight:1000;
  cursor:pointer;
}
.archiveModeTabs button.active{
  background:linear-gradient(135deg,var(--cyan),var(--blue));
  color:#020617;
  border-color:transparent;
  box-shadow:0 16px 38px rgba(0,229,255,.16);
}
.archiveTrophyTable,
.archiveMemberList{
  display:grid;
  gap:10px;
}
.archiveTrophyRow{
  min-height:82px;
  padding:12px 16px;
  border-radius:22px;
  border:0;
  color:#f8fafc;
  cursor:pointer;
  display:grid;
  grid-template-columns:54px 58px minmax(0,1fr) 82px;
  gap:12px;
  align-items:center;
  text-align:right;
}
.archiveTrophyRow img{
  width:52px;
  height:52px;
  object-fit:contain;
  filter:drop-shadow(0 8px 10px rgba(0,0,0,.35));
}
.archiveRowRank,
.archiveMemberRank{
  width:42px;
  height:42px;
  border-radius:999px;
  display:flex;
  align-items:center;
  justify-content:center;
  background:rgba(255,255,255,.075);
  border:1px solid rgba(255,255,255,.12);
  color:#b9f7ff;
  font-weight:1000;
}
.archiveTrophyRow b{
  font-size:20px;
  line-height:1.15;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}
.archiveTrophyRow em,
.archiveMemberCard em{
  justify-self:end;
  min-width:70px;
  height:44px;
  padding:0 14px;
  border-radius:999px;
  display:flex;
  align-items:center;
  justify-content:center;
  font-style:normal;
  font-size:22px;
  font-weight:1000;
  color:#020617;
  background:linear-gradient(135deg,var(--cyan),var(--blue));
  direction:ltr;
  unicode-bidi:plaintext;
}
.archiveMemberCard{
  min-height:104px;
  padding:14px 16px;
  border-radius:24px;
  border:0;
  color:#f8fafc;
  cursor:pointer;
  display:grid;
  grid-template-columns:54px 64px minmax(0,1fr) 86px;
  gap:12px;
  align-items:center;
  text-align:right;
}
.archiveMemberAvatar{
  width:64px;
  height:64px;
  border-radius:20px;
  object-fit:cover;
  background:white;
}
.archiveMemberInfo{
  min-width:0;
  display:grid;
  gap:10px;
}
.archiveMemberInfo>b{
  font-size:22px;
  line-height:1.15;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}
.archiveMemberTrophies{
  display:flex;
  gap:7px;
  overflow:hidden;
  align-items:center;
}
.archiveMemberTrophies span{
  min-width:42px;
  height:34px;
  padding:0 6px;
  border-radius:999px;
  background:rgba(255,255,255,.075);
  border:1px solid rgba(255,255,255,.10);
  display:flex;
  align-items:center;
  justify-content:center;
  gap:4px;
}
.archiveMemberTrophies img{
  width:20px;
  height:20px;
  object-fit:contain;
}
.archiveMemberTrophies strong{
  font-size:12px;
  direction:ltr;
  unicode-bidi:plaintext;
}

@media(max-width:720px){
  .archiveModeTabs{
    margin-bottom:12px!important;
    padding:6px!important;
    border-radius:18px!important;
    gap:6px!important;
  }
  .archiveModeTabs button{
    height:38px!important;
    border-radius:13px!important;
    font-size:11px!important;
    padding:0 4px!important;
    white-space:nowrap!important;
  }
  .archiveTrophyRow{
    min-height:74px!important;
    padding:10px!important;
    border-radius:18px!important;
    grid-template-columns:40px 48px minmax(0,1fr) 62px!important;
    gap:8px!important;
  }
  .archiveTrophyRow img{
    width:46px!important;
    height:46px!important;
  }
  .archiveRowRank,
  .archiveMemberRank{
    width:34px!important;
    height:34px!important;
    font-size:12px!important;
  }
  .archiveTrophyRow b{
    font-size:15px!important;
  }
  .archiveTrophyRow em,
  .archiveMemberCard em{
    min-width:56px!important;
    height:36px!important;
    padding:0 9px!important;
    font-size:18px!important;
  }
  .archiveMemberCard{
    min-height:92px!important;
    padding:10px!important;
    border-radius:19px!important;
    grid-template-columns:38px 52px minmax(0,1fr) 58px!important;
    gap:8px!important;
  }
  .archiveMemberAvatar{
    width:52px!important;
    height:52px!important;
    border-radius:16px!important;
  }
  .archiveMemberInfo{
    gap:7px!important;
  }
  .archiveMemberInfo>b{
    font-size:16px!important;
  }
  .archiveMemberTrophies{
    gap:5px!important;
  }
  .archiveMemberTrophies span{
    min-width:34px!important;
    height:28px!important;
    padding:0 5px!important;
  }
  .archiveMemberTrophies img{
    width:17px!important;
    height:17px!important;
  }
  .archiveMemberTrophies strong{
    font-size:10px!important;
  }
}



/* ===== ABSOLUTE FINAL FIX 2: numbers, ranking layout, native back, bottom safe area ===== */

/* safe bottom: content never goes under bottom bar */
.app{
  padding-bottom:calc(160px + env(safe-area-inset-bottom))!important;
}
.widePage,
.membersHome,
.memberProfilePage{
  margin-bottom:calc(46px + env(safe-area-inset-bottom))!important;
}
.mainNav{
  position:fixed!important;
  left:50%!important;
  right:auto!important;
  bottom:calc(12px + env(safe-area-inset-bottom))!important;
  transform:translateX(-50%)!important;
  width:min(1180px,calc(100% - 24px))!important;
  margin:0!important;
  z-index:9999!important;
  overflow:visible!important;
}

/* no visual back button: use iPhone swipe / Android system back */
.backToMembersBtn{
  display:none!important;
}

/* numbers must fit inside cards, not overflow and not be clipped */
.statCard,
.statGrid .statCard,
.statsPanelGrid .statCard,
.memberStatsGrid .statCard,
.generalTopStats .statCard{
  overflow:hidden!important;
  min-width:0!important;
}
.statCard b,
.statCard strong,
.statsPanelGrid .statCard b,
.statsPanelGrid .statCard strong,
.memberStatsGrid .statCard b,
.memberStatsGrid .statCard strong,
.generalTopStats .statCard b,
.generalTopStats .statCard strong{
  display:block!important;
  width:100%!important;
  max-width:100%!important;
  min-width:0!important;
  direction:ltr!important;
  unicode-bidi:plaintext!important;
  font-variant-numeric:tabular-nums!important;
  text-align:center!important;
  white-space:nowrap!important;
  overflow:visible!important;
  text-overflow:clip!important;
  line-height:1!important;
  letter-spacing:-2px!important;
  transform:scaleX(.72)!important;
  transform-origin:center!important;
  font-size:clamp(22px,5.8vw,34px)!important;
}
.statCard small,
.statCard p{
  width:100%!important;
  text-align:center!important;
  white-space:nowrap!important;
  overflow:hidden!important;
  text-overflow:ellipsis!important;
}

/* ranking: rebuilt compact card */
.rankingCompactList{
  display:grid!important;
  gap:10px!important;
}
.rankingCompactCard{
  width:100%!important;
  min-height:88px!important;
  height:88px!important;
  padding:12px 14px!important;
  border-radius:22px!important;
  display:grid!important;
  grid-template-columns:64px 66px minmax(0,1fr) 82px 126px!important;
  grid-template-rows:1fr!important;
  gap:12px!important;
  align-items:center!important;
  text-align:right!important;
  overflow:hidden!important;
}
.rankingCompactCard .rankingRank{
  grid-column:1!important;
  width:48px!important;
  height:48px!important;
  border-radius:999px!important;
  display:flex!important;
  align-items:center!important;
  justify-content:center!important;
  background:rgba(255,255,255,.075)!important;
  border:1px solid rgba(255,255,255,.14)!important;
  color:var(--cyan)!important;
  font-size:21px!important;
  font-weight:1000!important;
}
.rankingCompactCard .rankingAvatar{
  grid-column:2!important;
  width:66px!important;
  height:66px!important;
  min-width:66px!important;
  min-height:66px!important;
  border-radius:20px!important;
  object-fit:cover!important;
  background:white!important;
}
.rankingCompactCard .rankingIdentity{
  grid-column:3!important;
  min-width:0!important;
  overflow:hidden!important;
  display:flex!important;
  align-items:center!important;
  justify-content:flex-start!important;
}
.rankingCompactCard .rankingIdentity b{
  display:block!important;
  width:100%!important;
  font-size:24px!important;
  line-height:1.1!important;
  white-space:nowrap!important;
  overflow:hidden!important;
  text-overflow:ellipsis!important;
}
.rankingCompactCard .rankingIdentity small,
.rankingCompactCard p{
  display:none!important;
}
.rankingSeasonLogos{
  grid-column:4!important;
  display:flex!important;
  gap:8px!important;
  align-items:center!important;
  justify-content:center!important;
  min-width:0!important;
}
.rankingSeasonLogos img{
  width:34px!important;
  height:34px!important;
  object-fit:contain!important;
  background:transparent!important;
  border-radius:0!important;
  filter:drop-shadow(0 6px 8px rgba(0,0,0,.38))!important;
}
.rankingInlineStats{
  grid-column:5!important;
  display:flex!important;
  flex-direction:row!important;
  gap:8px!important;
  align-items:center!important;
  justify-content:flex-end!important;
  min-width:0!important;
}
.rankingInlineStats span{
  height:36px!important;
  min-width:54px!important;
  padding:0 10px!important;
  border-radius:999px!important;
  background:rgba(255,255,255,.08)!important;
  border:1px solid rgba(255,255,255,.12)!important;
  color:#ecfeff!important;
  display:flex!important;
  align-items:center!important;
  justify-content:center!important;
  font-size:14px!important;
  font-weight:1000!important;
  direction:ltr!important;
  unicode-bidi:plaintext!important;
  white-space:nowrap!important;
}

@media(max-width:720px){
  .app{
    padding-bottom:calc(148px + env(safe-area-inset-bottom))!important;
  }
  .mainNav{
    width:calc(100% - 18px)!important;
    max-width:430px!important;
    height:88px!important;
    min-height:88px!important;
    border-radius:30px!important;
    padding:8px!important;
    display:grid!important;
    grid-template-columns:repeat(5,minmax(0,1fr))!important;
    gap:4px!important;
  }
  .navBtn{
    min-width:0!important;
    width:100%!important;
    height:72px!important;
    min-height:72px!important;
    border-radius:22px!important;
    padding:6px 2px!important;
    display:flex!important;
    flex-direction:column!important;
    align-items:center!important;
    justify-content:center!important;
    gap:5px!important;
  }
  .navIcon{font-size:25px!important;line-height:1!important}
  .navLabel{font-size:12px!important;line-height:1.05!important;white-space:nowrap!important}

  .statGrid{
    display:grid!important;
    grid-template-columns:1fr 1fr!important;
    gap:10px!important;
  }
  .statCard{
    min-width:0!important;
    padding:10px 7px!important;
    overflow:hidden!important;
  }
  .statCard b,
  .statCard strong,
  .statsPanelGrid .statCard b,
  .statsPanelGrid .statCard strong,
  .memberStatsGrid .statCard b,
  .memberStatsGrid .statCard strong{
    font-size:clamp(22px,7vw,34px)!important;
    transform:scaleX(.64)!important;
    letter-spacing:-2.8px!important;
    width:132%!important;
    max-width:132%!important;
    margin-left:-16%!important;
    margin-right:-16%!important;
    line-height:1!important;
  }
  .memberStatsGrid .statCard b,
  .memberStatsGrid .statCard strong{
    font-size:clamp(20px,6.4vw,31px)!important;
    transform:scaleX(.68)!important;
    letter-spacing:-2px!important;
  }

  .rankingCompactCard{
    height:82px!important;
    min-height:82px!important;
    padding:10px!important;
    border-radius:19px!important;
    grid-template-columns:42px 56px minmax(0,1fr) 62px 92px!important;
    gap:8px!important;
  }
  .rankingCompactCard .rankingRank{
    width:34px!important;
    height:34px!important;
    font-size:13px!important;
  }
  .rankingCompactCard .rankingAvatar{
    width:56px!important;
    height:56px!important;
    min-width:56px!important;
    min-height:56px!important;
    border-radius:17px!important;
  }
  .rankingCompactCard .rankingIdentity b{
    font-size:18px!important;
  }
  .rankingSeasonLogos{
    gap:5px!important;
  }
  .rankingSeasonLogos img{
    width:25px!important;
    height:25px!important;
  }
  .rankingInlineStats{
    gap:5px!important;
  }
  .rankingInlineStats span{
    height:30px!important;
    min-width:40px!important;
    padding:0 7px!important;
    font-size:11px!important;
  }
}
@media(max-width:380px){
  .rankingCompactCard{
    grid-template-columns:36px 50px minmax(0,1fr) 52px 82px!important;
    gap:6px!important;
    padding:8px!important;
  }
  .rankingCompactCard .rankingAvatar{
    width:50px!important;
    height:50px!important;
    min-width:50px!important;
    min-height:50px!important;
  }
  .rankingCompactCard .rankingIdentity b{
    font-size:15px!important;
  }
  .rankingSeasonLogos img{
    width:22px!important;
    height:22px!important;
  }
  .rankingInlineStats span{
    min-width:36px!important;
    font-size:10px!important;
    padding:0 5px!important;
  }
}



/* ===== FINAL RESTORE: stable numbers, non-overlay nav, bounded mobile back, expanded member archive ===== */

/* Bottom bar is part of page flow, not overlaying content */
.app{
  padding-bottom:calc(18px + env(safe-area-inset-bottom))!important;
}
.mainNav{
  position:relative!important;
  left:auto!important;
  right:auto!important;
  bottom:auto!important;
  transform:none!important;
  width:min(1180px,100%)!important;
  max-width:1180px!important;
  margin:18px auto calc(10px + env(safe-area-inset-bottom))!important;
  z-index:10!important;
  overflow-x:auto!important;
  overflow-y:hidden!important;
}
.widePage,
.membersHome,
.memberProfilePage{
  margin-bottom:0!important;
}

/* Return numbers to readable state: no ugly horizontal compression */
.statCard,
.statGrid .statCard,
.statsPanelGrid .statCard,
.memberStatsGrid .statCard,
.generalTopStats .statCard{
  overflow:hidden!important;
  min-width:0!important;
}
.statCard b,
.statCard strong,
.statsPanelGrid .statCard b,
.statsPanelGrid .statCard strong,
.memberStatsGrid .statCard b,
.memberStatsGrid .statCard strong,
.generalTopStats .statCard b,
.generalTopStats .statCard strong,
.trophyCard b,
.trophyCard strong{
  display:block!important;
  width:100%!important;
  max-width:100%!important;
  min-width:0!important;
  direction:ltr!important;
  unicode-bidi:plaintext!important;
  font-variant-numeric:tabular-nums!important;
  text-align:center!important;
  white-space:nowrap!important;
  overflow:hidden!important;
  text-overflow:clip!important;
  line-height:1.06!important;
  letter-spacing:-.8px!important;
  transform:none!important;
  margin:0!important;
  padding:0 2px!important;
  font-size:clamp(22px,5.7vw,34px)!important;
}
.statCard small,
.statCard p{
  width:100%!important;
  text-align:center!important;
  white-space:nowrap!important;
  overflow:hidden!important;
  text-overflow:ellipsis!important;
}

/* Archive by member: larger card, all trophies visible */
.archiveMemberCard{
  min-height:144px!important;
  height:auto!important;
  align-items:start!important;
  grid-template-columns:54px 70px minmax(0,1fr) 90px!important;
  padding:16px!important;
  overflow:visible!important;
}
.archiveMemberAvatar{
  width:70px!important;
  height:70px!important;
}
.archiveMemberInfo{
  gap:12px!important;
  overflow:visible!important;
}
.archiveMemberTrophies{
  display:flex!important;
  flex-wrap:wrap!important;
  gap:8px!important;
  overflow:visible!important;
  align-items:center!important;
}
.archiveMemberTrophies span{
  min-width:46px!important;
  height:36px!important;
}
.archiveMemberTrophies img{
  width:22px!important;
  height:22px!important;
}
.archiveMemberCard em{
  align-self:center!important;
}

@media(max-width:720px){
  .app{
    padding-bottom:calc(12px + env(safe-area-inset-bottom))!important;
  }
  .mainNav{
    position:relative!important;
    left:auto!important;
    right:auto!important;
    bottom:auto!important;
    transform:none!important;
    width:100%!important;
    max-width:430px!important;
    height:auto!important;
    min-height:76px!important;
    margin:14px auto calc(8px + env(safe-area-inset-bottom))!important;
    border-radius:24px!important;
    padding:7px!important;
    display:grid!important;
    grid-template-columns:repeat(5,minmax(0,1fr))!important;
    gap:5px!important;
    overflow:visible!important;
  }
  .navBtn{
    width:100%!important;
    min-width:0!important;
    height:62px!important;
    min-height:62px!important;
    border-radius:18px!important;
    padding:5px 2px!important;
    display:flex!important;
    flex-direction:column!important;
    align-items:center!important;
    justify-content:center!important;
    gap:4px!important;
  }
  .navIcon{font-size:22px!important;line-height:1!important}
  .navLabel{font-size:11px!important;line-height:1.05!important;white-space:nowrap!important}

  .statGrid{
    display:grid!important;
    grid-template-columns:1fr 1fr!important;
    gap:10px!important;
  }
  .statCard{
    min-width:0!important;
    height:116px!important;
    min-height:116px!important;
    max-height:116px!important;
    padding:10px 8px!important;
    overflow:hidden!important;
  }
  .statCard b,
  .statCard strong,
  .statsPanelGrid .statCard b,
  .statsPanelGrid .statCard strong,
  .memberStatsGrid .statCard b,
  .memberStatsGrid .statCard strong{
    font-size:clamp(21px,5.8vw,31px)!important;
    line-height:1.08!important;
    letter-spacing:-1px!important;
    transform:none!important;
    width:100%!important;
    max-width:100%!important;
    margin:0!important;
    overflow:hidden!important;
  }
  .memberStatsGrid .statCard b,
  .memberStatsGrid .statCard strong{
    font-size:clamp(20px,5.4vw,29px)!important;
  }

  .archiveMemberCard{
    min-height:136px!important;
    height:auto!important;
    grid-template-columns:38px 54px minmax(0,1fr) 58px!important;
    gap:8px!important;
    padding:11px!important;
    border-radius:20px!important;
    overflow:visible!important;
  }
  .archiveMemberAvatar{
    width:54px!important;
    height:54px!important;
    border-radius:17px!important;
  }
  .archiveMemberInfo>b{
    font-size:17px!important;
  }
  .archiveMemberTrophies{
    flex-wrap:wrap!important;
    gap:6px!important;
    max-height:none!important;
    overflow:visible!important;
  }
  .archiveMemberTrophies span{
    min-width:38px!important;
    height:30px!important;
    padding:0 5px!important;
  }
  .archiveMemberTrophies img{
    width:18px!important;
    height:18px!important;
  }
  .archiveMemberTrophies strong{
    font-size:10px!important;
  }
}
@media(max-width:380px){
  .statCard b,
  .statCard strong{
    font-size:clamp(19px,5.2vw,27px)!important;
    letter-spacing:-1.2px!important;
  }
  .archiveMemberCard{
    grid-template-columns:34px 48px minmax(0,1fr) 52px!important;
    gap:6px!important;
    padding:9px!important;
  }
  .archiveMemberAvatar{
    width:48px!important;
    height:48px!important;
  }
  .archiveMemberInfo>b{
    font-size:15px!important;
  }
}



/* ===== RECORD DETAIL CARD: final result is the main focus ===== */
.recordDetailCard{
  border-radius:28px;
  padding:18px;
  display:grid;
  gap:14px;
  overflow:hidden;
}
.recordDetailTop{
  display:grid;
  grid-template-columns:repeat(3,minmax(0,1fr));
  gap:12px;
}
.recordDetailTop div{
  min-height:92px;
  border-radius:22px;
  background:rgba(2,6,23,.24);
  border:1px solid rgba(255,255,255,.08);
  display:grid;
  place-items:center;
  text-align:center;
  padding:12px;
  overflow:hidden;
}
.recordDetailTop span,
.recordFinalBox span,
.recordNotesBox span{
  display:block;
  color:#a8b3c7;
  font-size:14px;
  font-weight:900;
  margin-bottom:8px;
}
.recordDetailTop b{
  display:block;
  font-size:26px;
  line-height:1.15;
  color:#f8fafc;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}
.recordFinalBox{
  min-height:118px;
  border-radius:26px;
  padding:18px;
  display:grid;
  place-items:center;
  text-align:center;
  background:linear-gradient(135deg,rgba(0,229,255,.18),rgba(47,140,255,.10));
  border:1px solid rgba(0,229,255,.34);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.16),0 18px 45px rgba(0,229,255,.08);
}
.recordFinalBox span{
  color:#b9f7ff;
  font-size:16px;
}
.recordFinalBox b{
  display:block;
  width:100%;
  color:#ecfeff;
  font-size:34px;
  line-height:1.25;
  font-weight:1000;
  white-space:normal;
  overflow:visible;
}
.recordNotesBox{
  border-radius:22px;
  padding:14px 16px;
  background:rgba(255,255,255,.055);
  border:1px solid rgba(255,255,255,.10);
}
.recordNotesBox p{
  margin:0;
  color:#e5eef9;
  font-size:16px;
  line-height:1.6;
}
@media(max-width:720px){
  .recordDetailCard{
    border-radius:20px!important;
    padding:12px!important;
    gap:10px!important;
  }
  .recordDetailTop{
    grid-template-columns:repeat(3,minmax(0,1fr))!important;
    gap:8px!important;
  }
  .recordDetailTop div{
    min-height:74px!important;
    border-radius:16px!important;
    padding:8px 5px!important;
  }
  .recordDetailTop span,
  .recordFinalBox span,
  .recordNotesBox span{
    font-size:11px!important;
    margin-bottom:5px!important;
  }
  .recordDetailTop b{
    font-size:clamp(14px,4.4vw,20px)!important;
    line-height:1.15!important;
  }
  .recordFinalBox{
    min-height:104px!important;
    border-radius:18px!important;
    padding:14px 10px!important;
  }
  .recordFinalBox span{
    font-size:13px!important;
  }
  .recordFinalBox b{
    font-size:clamp(20px,6.2vw,30px)!important;
    line-height:1.3!important;
  }
  .recordNotesBox{
    border-radius:16px!important;
    padding:12px!important;
  }
  .recordNotesBox p{
    font-size:12px!important;
    line-height:1.55!important;
  }
}



/* ===== RESTORE ORIGINAL GOOD CARD SIZING + READABLE NUMBERS ===== */
/* This block intentionally overrides the experimental compressed-number rules. */
.memberProfilePage .statGrid{
  display:grid!important;
  grid-template-columns:1.2fr .9fr!important;
  gap:10px!important;
  margin:10px 0!important;
}
.memberProfilePage .statCard{
  height:132px!important;
  min-height:132px!important;
  max-height:132px!important;
  padding:12px 10px!important;
  border-radius:22px!important;
  display:grid!important;
  grid-template-rows:30px 56px 24px!important;
  align-items:center!important;
  justify-items:center!important;
  text-align:center!important;
  overflow:visible!important;
}
.memberProfilePage .statCard span{
  grid-row:1!important;
  font-size:27px!important;
  line-height:1!important;
  margin:0!important;
}
.memberProfilePage .statCard b{
  grid-row:2!important;
  display:block!important;
  width:100%!important;
  max-width:100%!important;
  height:56px!important;
  line-height:56px!important;
  margin:0!important;
  padding:0!important;
  font-size:clamp(30px,7.4vw,42px)!important;
  font-weight:1000!important;
  letter-spacing:-1.2px!important;
  text-align:center!important;
  direction:ltr!important;
  unicode-bidi:plaintext!important;
  font-variant-numeric:tabular-nums!important;
  white-space:nowrap!important;
  overflow:hidden!important;
  text-overflow:clip!important;
  transform:none!important;
  color:#ecfeff!important;
}
.memberProfilePage .statCard small{
  grid-row:3!important;
  width:100%!important;
  height:24px!important;
  line-height:24px!important;
  margin:0!important;
  font-size:14px!important;
  font-weight:1000!important;
  text-align:center!important;
  color:#d7e3f5!important;
  white-space:nowrap!important;
  overflow:hidden!important;
  text-overflow:ellipsis!important;
}

/* Member stats page cards: keep numbers clear, not squeezed */
.memberStatsGrid,
.statsPanelGrid{
  overflow:visible!important;
}
.memberStatsGrid .statCard,
.statsPanelGrid .statCard,
.generalTopStats .statCard{
  height:124px!important;
  min-height:124px!important;
  max-height:124px!important;
  padding:12px 9px!important;
  border-radius:20px!important;
  display:grid!important;
  grid-template-rows:30px 50px 24px!important;
  align-items:center!important;
  justify-items:center!important;
  text-align:center!important;
  overflow:visible!important;
}
.memberStatsGrid .statCard b,
.memberStatsGrid .statCard strong,
.statsPanelGrid .statCard b,
.statsPanelGrid .statCard strong,
.generalTopStats .statCard b,
.generalTopStats .statCard strong{
  display:block!important;
  width:100%!important;
  height:50px!important;
  line-height:50px!important;
  font-size:clamp(24px,6vw,36px)!important;
  font-weight:1000!important;
  letter-spacing:-1px!important;
  text-align:center!important;
  direction:ltr!important;
  unicode-bidi:plaintext!important;
  font-variant-numeric:tabular-nums!important;
  white-space:nowrap!important;
  overflow:hidden!important;
  text-overflow:clip!important;
  transform:none!important;
  color:#ecfeff!important;
}
.memberStatsGrid .statCard small,
.statsPanelGrid .statCard small,
.generalTopStats .statCard small{
  font-size:13px!important;
  font-weight:900!important;
}

/* Finance cards: restore strong readable amount */
.financeCard > b,
.financeCard b:first-child{
  min-width:132px!important;
  max-width:48%!important;
  font-size:clamp(22px,5.6vw,34px)!important;
  line-height:1!important;
  font-weight:1000!important;
  letter-spacing:-1.1px!important;
  direction:ltr!important;
  unicode-bidi:plaintext!important;
  white-space:nowrap!important;
  overflow:visible!important;
  text-overflow:clip!important;
  transform:none!important;
  color:#f4ffff!important;
}

/* Cancel every previous ugly compression */
.statCard b,
.statCard strong,
.trophyCard b,
.trophyCard strong,
.rankingInlineStats span,
.archiveTrophyRow em,
.archiveMemberCard em{
  transform:none!important;
}

/* Record details: final is the hero, not a side note */
.recordDetailCard{
  padding:18px!important;
  border-radius:28px!important;
  display:grid!important;
  gap:16px!important;
}
.recordTopRow{
  display:grid!important;
  grid-template-columns:repeat(3,minmax(0,1fr))!important;
  gap:12px!important;
}
.recordMiniBox{
  min-height:92px!important;
  border-radius:22px!important;
  background:rgba(255,255,255,.055)!important;
  border:1px solid rgba(255,255,255,.09)!important;
  display:grid!important;
  align-content:center!important;
  justify-items:center!important;
  gap:9px!important;
  text-align:center!important;
  padding:12px 8px!important;
}
.recordMiniBox span{
  color:#a8b3c7!important;
  font-size:14px!important;
  font-weight:900!important;
}
.recordMiniBox b{
  color:#f8fafc!important;
  font-size:24px!important;
  font-weight:1000!important;
  line-height:1.1!important;
  white-space:nowrap!important;
  overflow:hidden!important;
  text-overflow:ellipsis!important;
  max-width:100%!important;
}
.recordFinalBox{
  min-height:122px!important;
  border-radius:26px!important;
  padding:18px!important;
  background:linear-gradient(135deg,rgba(0,229,255,.16),rgba(47,140,255,.10))!important;
  border:1px solid rgba(0,229,255,.28)!important;
  display:grid!important;
  align-content:center!important;
  justify-items:center!important;
  gap:12px!important;
  text-align:center!important;
  box-shadow:0 18px 55px rgba(0,229,255,.10)!important;
}
.recordFinalBox span{
  color:var(--cyan)!important;
  font-size:17px!important;
  font-weight:1000!important;
}
.recordFinalBox strong{
  color:#f8fafc!important;
  font-size:clamp(24px,5vw,42px)!important;
  line-height:1.25!important;
  font-weight:1000!important;
  white-space:normal!important;
  overflow:visible!important;
  text-align:center!important;
}
.recordNotes{
  margin:0!important;
  padding:14px!important;
  border-radius:18px!important;
  background:rgba(255,255,255,.055)!important;
  color:#cbd5e1!important;
  font-size:14px!important;
  line-height:1.45!important;
}

@media(max-width:720px){
  .memberProfilePage .statGrid{
    grid-template-columns:1.15fr .85fr!important;
    gap:10px!important;
  }
  .memberProfilePage .statCard{
    height:128px!important;
    min-height:128px!important;
    max-height:128px!important;
    padding:11px 8px!important;
    grid-template-rows:30px 54px 24px!important;
  }
  .memberProfilePage .statCard b{
    height:54px!important;
    line-height:54px!important;
    font-size:clamp(27px,6.9vw,38px)!important;
    letter-spacing:-1.4px!important;
  }
  .memberProfilePage .statCard small{
    font-size:13px!important;
  }
  .memberStatsGrid .statCard,
  .statsPanelGrid .statCard,
  .generalTopStats .statCard{
    height:118px!important;
    min-height:118px!important;
    max-height:118px!important;
    grid-template-rows:28px 48px 23px!important;
  }
  .memberStatsGrid .statCard b,
  .memberStatsGrid .statCard strong,
  .statsPanelGrid .statCard b,
  .statsPanelGrid .statCard strong,
  .generalTopStats .statCard b,
  .generalTopStats .statCard strong{
    height:48px!important;
    line-height:48px!important;
    font-size:clamp(22px,5.8vw,32px)!important;
  }
  .financeCard > b,
  .financeCard b:first-child{
    font-size:clamp(21px,5.7vw,32px)!important;
    min-width:120px!important;
  }
  .recordDetailCard{
    padding:12px!important;
    border-radius:22px!important;
    gap:12px!important;
  }
  .recordTopRow{
    grid-template-columns:repeat(3,minmax(0,1fr))!important;
    gap:8px!important;
  }
  .recordMiniBox{
    min-height:78px!important;
    border-radius:17px!important;
    padding:9px 5px!important;
    gap:6px!important;
  }
  .recordMiniBox span{
    font-size:11px!important;
  }
  .recordMiniBox b{
    font-size:16px!important;
  }
  .recordFinalBox{
    min-height:112px!important;
    border-radius:20px!important;
    padding:14px 10px!important;
  }
  .recordFinalBox span{
    font-size:14px!important;
  }
  .recordFinalBox strong{
    font-size:clamp(21px,5.8vw,30px)!important;
    line-height:1.3!important;
  }
}
@media(max-width:380px){
  .memberProfilePage .statCard b{
    font-size:clamp(24px,6.4vw,34px)!important;
    letter-spacing:-1.6px!important;
  }
  .recordMiniBox b{
    font-size:14px!important;
  }
  .recordFinalBox strong{
    font-size:clamp(19px,5.4vw,27px)!important;
  }
}



/* ===== FINAL FIX: Tournament version cards + original-style stat cards ===== */

/* Cards inside member trophy lists / archive trophy lists */
.tournamentRecordsList{
  display:grid!important;
  gap:12px!important;
}
.tournamentRecordCard{
  width:100%!important;
  border:1px solid rgba(255,255,255,.12)!important;
  color:#f8fafc!important;
  cursor:default!important;
  text-align:right!important;
  border-radius:24px!important;
  padding:14px!important;
  background:rgba(2,6,23,.28)!important;
  display:grid!important;
  gap:12px!important;
  overflow:hidden!important;
}
.tournamentRecordCard.hasFinal{
  border-color:rgba(0,229,255,.24)!important;
  background:linear-gradient(135deg,rgba(0,229,255,.10),rgba(2,6,23,.26))!important;
}
.recordCardMeta{
  display:grid!important;
  grid-template-columns:repeat(3,minmax(0,1fr))!important;
  gap:9px!important;
}
.recordCardMeta span{
  min-height:64px!important;
  border-radius:16px!important;
  background:rgba(255,255,255,.052)!important;
  border:1px solid rgba(255,255,255,.07)!important;
  display:grid!important;
  align-content:center!important;
  justify-items:center!important;
  gap:5px!important;
  text-align:center!important;
  padding:8px 6px!important;
  overflow:hidden!important;
}
.recordCardMeta small{
  color:#a8b3c7!important;
  font-size:11px!important;
  line-height:1!important;
  font-weight:900!important;
  white-space:nowrap!important;
}
.recordCardMeta b{
  color:#f8fafc!important;
  font-size:15px!important;
  line-height:1.15!important;
  font-weight:1000!important;
  white-space:nowrap!important;
  overflow:hidden!important;
  text-overflow:ellipsis!important;
  max-width:100%!important;
}
.recordCardFinal{
  min-height:88px!important;
  border-radius:20px!important;
  padding:13px 12px!important;
  background:linear-gradient(135deg,rgba(0,229,255,.18),rgba(47,140,255,.10))!important;
  border:1px solid rgba(0,229,255,.26)!important;
  display:grid!important;
  align-content:center!important;
  justify-items:center!important;
  gap:8px!important;
  text-align:center!important;
}
.recordCardFinal small{
  color:var(--cyan)!important;
  font-size:13px!important;
  font-weight:1000!important;
  line-height:1!important;
}
.recordCardFinal strong{
  color:#f8fafc!important;
  font-size:clamp(18px,4.6vw,28px)!important;
  line-height:1.28!important;
  font-weight:1000!important;
  white-space:normal!important;
  overflow:visible!important;
}
.recordCardFinal.muted{
  background:rgba(255,255,255,.052)!important;
  border-color:rgba(255,255,255,.08)!important;
}
.recordCardFinal.muted small{
  color:#a8b3c7!important;
}
.recordCardFinal.muted strong{
  color:#cbd5e1!important;
  font-size:15px!important;
}

/* Restore stat-card composition: icon top / number center / label bottom */
.statGrid,
.memberStatsGrid,
.statsPanelGrid,
.generalTopStats{
  align-items:stretch!important;
}
.statCard,
.memberStatsGrid .statCard,
.statsPanelGrid .statCard,
.generalTopStats .statCard{
  height:132px!important;
  min-height:132px!important;
  max-height:132px!important;
  border-radius:22px!important;
  padding:12px 10px!important;
  display:grid!important;
  grid-template-rows:34px 54px 26px!important;
  align-items:center!important;
  justify-items:center!important;
  text-align:center!important;
  overflow:hidden!important;
  align-content:center!important;
}
.statCard span,
.memberStatsGrid .statCard span,
.statsPanelGrid .statCard span,
.generalTopStats .statCard span{
  grid-row:1!important;
  display:block!important;
  width:100%!important;
  font-size:28px!important;
  line-height:34px!important;
  margin:0!important;
  text-align:center!important;
}
.statCard b,
.statCard strong,
.memberStatsGrid .statCard b,
.memberStatsGrid .statCard strong,
.statsPanelGrid .statCard b,
.statsPanelGrid .statCard strong,
.generalTopStats .statCard b,
.generalTopStats .statCard strong{
  grid-row:2!important;
  display:block!important;
  width:100%!important;
  height:54px!important;
  line-height:54px!important;
  margin:0!important;
  padding:0!important;
  font-size:clamp(28px,6.8vw,42px)!important;
  font-weight:1000!important;
  color:#ecfeff!important;
  direction:ltr!important;
  unicode-bidi:plaintext!important;
  font-variant-numeric:tabular-nums!important;
  letter-spacing:-1.2px!important;
  white-space:nowrap!important;
  overflow:hidden!important;
  text-overflow:clip!important;
  transform:none!important;
  text-align:center!important;
}
.statCard small,
.statCard p,
.memberStatsGrid .statCard small,
.memberStatsGrid .statCard p,
.statsPanelGrid .statCard small,
.statsPanelGrid .statCard p,
.generalTopStats .statCard small,
.generalTopStats .statCard p{
  grid-row:3!important;
  display:block!important;
  width:100%!important;
  height:26px!important;
  line-height:26px!important;
  margin:0!important;
  padding:0!important;
  font-size:13px!important;
  font-weight:1000!important;
  color:#d7e3f5!important;
  white-space:nowrap!important;
  overflow:hidden!important;
  text-overflow:ellipsis!important;
  text-align:center!important;
}

/* keep main two profile cards roomy, same as the old good version */
.memberProfilePage .statGrid{
  display:grid!important;
  grid-template-columns:1.2fr .9fr!important;
  gap:10px!important;
}
.memberProfilePage .statCard{
  height:132px!important;
  min-height:132px!important;
  max-height:132px!important;
}

@media(max-width:720px){
  .tournamentRecordsList{
    gap:10px!important;
  }
  .tournamentRecordCard{
    border-radius:20px!important;
    padding:11px!important;
    gap:10px!important;
  }
  .recordCardMeta{
    gap:7px!important;
  }
  .recordCardMeta span{
    min-height:56px!important;
    border-radius:14px!important;
    padding:7px 4px!important;
  }
  .recordCardMeta small{
    font-size:9px!important;
  }
  .recordCardMeta b{
    font-size:12px!important;
  }
  .recordCardFinal{
    min-height:78px!important;
    border-radius:17px!important;
    padding:11px 8px!important;
  }
  .recordCardFinal small{
    font-size:11px!important;
  }
  .recordCardFinal strong{
    font-size:clamp(17px,5.2vw,24px)!important;
  }

  .statCard,
  .memberStatsGrid .statCard,
  .statsPanelGrid .statCard,
  .generalTopStats .statCard{
    height:124px!important;
    min-height:124px!important;
    max-height:124px!important;
    padding:11px 8px!important;
    grid-template-rows:32px 50px 24px!important;
  }
  .statCard span,
  .memberStatsGrid .statCard span,
  .statsPanelGrid .statCard span,
  .generalTopStats .statCard span{
    font-size:25px!important;
    line-height:32px!important;
  }
  .statCard b,
  .statCard strong,
  .memberStatsGrid .statCard b,
  .memberStatsGrid .statCard strong,
  .statsPanelGrid .statCard b,
  .statsPanelGrid .statCard strong,
  .generalTopStats .statCard b,
  .generalTopStats .statCard strong{
    height:50px!important;
    line-height:50px!important;
    font-size:clamp(24px,6.1vw,34px)!important;
    letter-spacing:-1.1px!important;
  }
  .statCard small,
  .statCard p,
  .memberStatsGrid .statCard small,
  .memberStatsGrid .statCard p,
  .statsPanelGrid .statCard small,
  .statsPanelGrid .statCard p,
  .generalTopStats .statCard small,
  .generalTopStats .statCard p{
    height:24px!important;
    line-height:24px!important;
    font-size:12px!important;
  }

  .memberProfilePage .statCard{
    height:128px!important;
    min-height:128px!important;
    max-height:128px!important;
  }
  .memberProfilePage .statCard b{
    font-size:clamp(26px,6.8vw,38px)!important;
  }
}
@media(max-width:380px){
  .recordCardFinal strong{
    font-size:clamp(15px,4.8vw,22px)!important;
  }
  .statCard b,
  .statCard strong,
  .memberStatsGrid .statCard b,
  .memberStatsGrid .statCard strong,
  .statsPanelGrid .statCard b,
  .statsPanelGrid .statCard strong,
  .generalTopStats .statCard b,
  .generalTopStats .statCard strong{
    font-size:clamp(21px,5.8vw,31px)!important;
    letter-spacing:-1.3px!important;
  }
}



/* ===== SEASON PAGE: clear stacked tournament cards ===== */
.seasonCardsList{
  display:grid!important;
  grid-template-columns:1fr!important;
  gap:14px!important;
}
.seasonTournamentCard{
  border-radius:28px!important;
  padding:14px!important;
  display:grid!important;
  gap:12px!important;
  overflow:hidden!important;
}
.seasonTournamentHeader{
  width:100%!important;
  min-height:88px!important;
  border:1px solid rgba(255,255,255,.10)!important;
  background:linear-gradient(135deg,rgba(0,229,255,.13),rgba(255,255,255,.045))!important;
  color:#f8fafc!important;
  border-radius:22px!important;
  padding:12px!important;
  cursor:pointer!important;
  display:grid!important;
  grid-template-columns:64px minmax(0,1fr) 72px 72px!important;
  gap:12px!important;
  align-items:center!important;
  text-align:right!important;
}
.seasonTournamentHeader img{
  width:58px!important;
  height:58px!important;
  object-fit:contain!important;
  filter:drop-shadow(0 8px 12px rgba(0,0,0,.35))!important;
}
.seasonTournamentHeader div{
  min-width:0!important;
  display:grid!important;
  gap:6px!important;
}
.seasonTournamentHeader b{
  font-size:22px!important;
  line-height:1.15!important;
  font-weight:1000!important;
  white-space:nowrap!important;
  overflow:hidden!important;
  text-overflow:ellipsis!important;
}
.seasonTournamentHeader small{
  font-size:13px!important;
  color:#a8b3c7!important;
  font-weight:900!important;
  white-space:nowrap!important;
  overflow:hidden!important;
  text-overflow:ellipsis!important;
}
.seasonTournamentHeader>span{
  height:42px!important;
  border-radius:999px!important;
  background:rgba(255,255,255,.08)!important;
  border:1px solid rgba(255,255,255,.10)!important;
  display:flex!important;
  align-items:center!important;
  justify-content:center!important;
  font-size:16px!important;
  font-weight:1000!important;
  direction:ltr!important;
  unicode-bidi:plaintext!important;
}
.seasonTournamentRows{
  display:grid!important;
  grid-template-columns:1fr!important;
  gap:9px!important;
}
.seasonMiniRecord{
  width:100%!important;
  min-height:78px!important;
  border:1px solid rgba(255,255,255,.09)!important;
  background:rgba(2,6,23,.24)!important;
  color:#f8fafc!important;
  border-radius:18px!important;
  padding:10px!important;
  cursor:pointer!important;
  display:grid!important;
  grid-template-columns:80px 1fr 1fr!important;
  gap:8px!important;
  align-items:center!important;
  text-align:center!important;
}
.seasonMiniRecord.hasFinal{
  grid-template-columns:72px 1fr 1fr!important;
  grid-template-rows:auto auto!important;
  border-color:rgba(0,229,255,.20)!important;
}
.seasonMiniRecord span{
  min-width:0!important;
  height:52px!important;
  border-radius:14px!important;
  background:rgba(255,255,255,.052)!important;
  border:1px solid rgba(255,255,255,.07)!important;
  display:grid!important;
  align-content:center!important;
  justify-items:center!important;
  gap:4px!important;
  padding:6px!important;
}
.seasonMiniRecord small{
  color:#a8b3c7!important;
  font-size:10px!important;
  font-weight:900!important;
  line-height:1!important;
}
.seasonMiniRecord b{
  color:#f8fafc!important;
  font-size:13px!important;
  font-weight:1000!important;
  line-height:1.1!important;
  white-space:nowrap!important;
  overflow:hidden!important;
  text-overflow:ellipsis!important;
  max-width:100%!important;
}
.seasonMiniRecord strong{
  grid-column:1/-1!important;
  min-height:46px!important;
  border-radius:14px!important;
  padding:10px!important;
  background:linear-gradient(135deg,rgba(0,229,255,.16),rgba(47,140,255,.08))!important;
  border:1px solid rgba(0,229,255,.20)!important;
  display:flex!important;
  align-items:center!important;
  justify-content:center!important;
  color:#ecfeff!important;
  font-size:15px!important;
  font-weight:1000!important;
  line-height:1.25!important;
  white-space:normal!important;
}
.seasonShowAllBtn{
  height:42px!important;
  border-radius:999px!important;
  border:1px solid rgba(0,229,255,.28)!important;
  background:rgba(0,229,255,.10)!important;
  color:#ecfeff!important;
  font-size:13px!important;
  font-weight:1000!important;
  cursor:pointer!important;
}

@media(max-width:720px){
  .seasonTournamentCard{
    border-radius:22px!important;
    padding:11px!important;
    gap:10px!important;
  }
  .seasonTournamentHeader{
    min-height:78px!important;
    border-radius:18px!important;
    padding:10px!important;
    grid-template-columns:50px minmax(0,1fr) 50px 50px!important;
    gap:8px!important;
  }
  .seasonTournamentHeader img{
    width:46px!important;
    height:46px!important;
  }
  .seasonTournamentHeader b{
    font-size:17px!important;
  }
  .seasonTournamentHeader small{
    font-size:10px!important;
  }
  .seasonTournamentHeader>span{
    height:32px!important;
    font-size:11px!important;
  }
  .seasonMiniRecord,
  .seasonMiniRecord.hasFinal{
    min-height:72px!important;
    border-radius:16px!important;
    padding:8px!important;
    grid-template-columns:58px 1fr 1fr!important;
    gap:6px!important;
  }
  .seasonMiniRecord span{
    height:48px!important;
    border-radius:12px!important;
    padding:5px!important;
  }
  .seasonMiniRecord small{
    font-size:8px!important;
  }
  .seasonMiniRecord b{
    font-size:11px!important;
  }
  .seasonMiniRecord strong{
    min-height:42px!important;
    border-radius:12px!important;
    padding:8px!important;
    font-size:12px!important;
  }
  .seasonShowAllBtn{
    height:38px!important;
    font-size:12px!important;
  }
}
@media(max-width:380px){
  .seasonTournamentHeader{
    grid-template-columns:44px minmax(0,1fr) 44px 44px!important;
    gap:6px!important;
  }
  .seasonTournamentHeader b{
    font-size:15px!important;
  }
  .seasonTournamentHeader>span{
    font-size:10px!important;
  }
  .seasonMiniRecord,
  .seasonMiniRecord.hasFinal{
    grid-template-columns:52px 1fr 1fr!important;
  }
  .seasonMiniRecord b{
    font-size:10px!important;
  }
}



/* ===== FIX: member stats cards open real finals page instead of blank screen ===== */
.finalsCardsList{
  display:grid!important;
  grid-template-columns:1fr!important;
  gap:12px!important;
}
.finalsCard{
  width:100%!important;
  border:1px solid rgba(255,255,255,.12)!important;
  color:#f8fafc!important;
  cursor:pointer!important;
  text-align:right!important;
  border-radius:24px!important;
  padding:14px!important;
  background:rgba(2,6,23,.28)!important;
  display:grid!important;
  gap:12px!important;
  overflow:hidden!important;
}
.finalsCard.win{
  border-color:rgba(34,197,94,.32)!important;
  background:linear-gradient(135deg,rgba(34,197,94,.12),rgba(2,6,23,.26))!important;
}
.finalsCard.loss{
  border-color:rgba(239,68,68,.30)!important;
  background:linear-gradient(135deg,rgba(239,68,68,.11),rgba(2,6,23,.26))!important;
}
.finalsCardTop{
  display:grid!important;
  grid-template-columns:74px minmax(0,1fr) 110px!important;
  gap:10px!important;
  align-items:center!important;
}
.finalsCardTop span{
  height:34px!important;
  border-radius:999px!important;
  display:flex!important;
  align-items:center!important;
  justify-content:center!important;
  font-weight:1000!important;
  background:rgba(255,255,255,.08)!important;
}
.finalsCardTop b{
  min-width:0!important;
  font-size:19px!important;
  line-height:1.15!important;
  white-space:nowrap!important;
  overflow:hidden!important;
  text-overflow:ellipsis!important;
}
.finalsCardTop small{
  direction:ltr!important;
  unicode-bidi:plaintext!important;
  color:#cbd5e1!important;
  font-size:13px!important;
  font-weight:900!important;
  text-align:left!important;
}
.finalsCardMeta{
  display:grid!important;
  grid-template-columns:repeat(3,minmax(0,1fr))!important;
  gap:8px!important;
}
.finalsCardMeta span{
  min-height:58px!important;
  border-radius:15px!important;
  background:rgba(255,255,255,.052)!important;
  border:1px solid rgba(255,255,255,.07)!important;
  display:grid!important;
  align-content:center!important;
  justify-items:center!important;
  gap:4px!important;
  padding:7px!important;
}
.finalsCardMeta small{
  color:#a8b3c7!important;
  font-size:10px!important;
  font-weight:900!important;
}
.finalsCardMeta b{
  color:#f8fafc!important;
  font-size:14px!important;
  font-weight:1000!important;
  white-space:nowrap!important;
  overflow:hidden!important;
  text-overflow:ellipsis!important;
  max-width:100%!important;
}
.finalsResultText{
  min-height:48px!important;
  border-radius:15px!important;
  padding:10px!important;
  background:rgba(0,229,255,.10)!important;
  border:1px solid rgba(0,229,255,.18)!important;
  display:flex!important;
  align-items:center!important;
  justify-content:center!important;
  color:#ecfeff!important;
  font-size:15px!important;
  line-height:1.25!important;
  font-weight:1000!important;
  text-align:center!important;
}

@media(max-width:720px){
  .finalsCard{
    border-radius:20px!important;
    padding:11px!important;
    gap:10px!important;
  }
  .finalsCardTop{
    grid-template-columns:58px minmax(0,1fr) 82px!important;
    gap:7px!important;
  }
  .finalsCardTop span{
    height:30px!important;
    font-size:11px!important;
  }
  .finalsCardTop b{
    font-size:15px!important;
  }
  .finalsCardTop small{
    font-size:10px!important;
  }
  .finalsCardMeta{
    gap:6px!important;
  }
  .finalsCardMeta span{
    min-height:52px!important;
    border-radius:13px!important;
    padding:6px 4px!important;
  }
  .finalsCardMeta small{
    font-size:8px!important;
  }
  .finalsCardMeta b{
    font-size:11px!important;
  }
  .finalsResultText{
    min-height:42px!important;
    border-radius:13px!important;
    padding:8px!important;
    font-size:12px!important;
  }
}



/* ===== SEASON PAGE SIMPLE ROW CARDS ONLY ===== */
.seasonCardsList,
.seasonGrid{
  display:none!important;
}
.seasonSimpleList{
  display:grid!important;
  grid-template-columns:1fr!important;
  gap:10px!important;
}
.seasonSimpleRow{
  width:100%!important;
  min-height:88px!important;
  border:0!important;
  color:#f8fafc!important;
  cursor:pointer!important;
  border-radius:24px!important;
  padding:12px 14px!important;
  display:grid!important;
  grid-template-columns:64px minmax(0,1fr) 78px 78px!important;
  gap:12px!important;
  align-items:center!important;
  text-align:right!important;
  overflow:hidden!important;
}
.seasonSimpleRow img{
  width:58px!important;
  height:58px!important;
  object-fit:contain!important;
  filter:drop-shadow(0 8px 12px rgba(0,0,0,.35))!important;
}
.seasonSimpleRow div{
  min-width:0!important;
  display:grid!important;
  gap:6px!important;
}
.seasonSimpleRow b{
  font-size:22px!important;
  line-height:1.15!important;
  font-weight:1000!important;
  white-space:nowrap!important;
  overflow:hidden!important;
  text-overflow:ellipsis!important;
}
.seasonSimpleRow small{
  font-size:13px!important;
  color:#a8b3c7!important;
  font-weight:900!important;
}
.seasonSimpleRow span{
  height:42px!important;
  border-radius:999px!important;
  background:rgba(255,255,255,.08)!important;
  border:1px solid rgba(255,255,255,.10)!important;
  display:flex!important;
  align-items:center!important;
  justify-content:center!important;
  font-size:16px!important;
  font-weight:1000!important;
  direction:ltr!important;
  unicode-bidi:plaintext!important;
  white-space:nowrap!important;
}

@media(max-width:720px){
  .seasonSimpleList{
    gap:9px!important;
  }
  .seasonSimpleRow{
    min-height:78px!important;
    border-radius:18px!important;
    padding:10px!important;
    grid-template-columns:50px minmax(0,1fr) 50px 50px!important;
    gap:8px!important;
  }
  .seasonSimpleRow img{
    width:46px!important;
    height:46px!important;
  }
  .seasonSimpleRow b{
    font-size:17px!important;
  }
  .seasonSimpleRow small{
    font-size:10px!important;
  }
  .seasonSimpleRow span{
    height:32px!important;
    font-size:11px!important;
  }
}
@media(max-width:380px){
  .seasonSimpleRow{
    grid-template-columns:44px minmax(0,1fr) 44px 44px!important;
    gap:6px!important;
  }
  .seasonSimpleRow b{
    font-size:15px!important;
  }
  .seasonSimpleRow span{
    font-size:10px!important;
  }
}



/* ===== FINAL ART FIX: stats alignment, fixed nav, profile logos inside card, trophy names ===== */

/* Stats cards: icon closer to center number, bottom label raised and aligned visually */
.statCard,
.memberStatsGrid .statCard,
.statsPanelGrid .statCard,
.generalTopStats .statCard{
  display:grid!important;
  grid-template-rows:38px 46px 30px!important;
  align-content:center!important;
  justify-items:center!important;
  text-align:center!important;
  overflow:hidden!important;
}
.statCard span,
.memberStatsGrid .statCard span,
.statsPanelGrid .statCard span,
.generalTopStats .statCard span{
  grid-row:1!important;
  align-self:end!important;
  margin:0 0 -2px!important;
  line-height:1!important;
}
.statCard b,
.statCard strong,
.memberStatsGrid .statCard b,
.memberStatsGrid .statCard strong,
.statsPanelGrid .statCard b,
.statsPanelGrid .statCard strong,
.generalTopStats .statCard b,
.generalTopStats .statCard strong{
  grid-row:2!important;
  align-self:center!important;
  margin:0!important;
  height:46px!important;
  line-height:46px!important;
}
.statCard small,
.statCard p,
.memberStatsGrid .statCard small,
.memberStatsGrid .statCard p,
.statsPanelGrid .statCard small,
.statsPanelGrid .statCard p,
.generalTopStats .statCard small,
.generalTopStats .statCard p{
  grid-row:3!important;
  align-self:start!important;
  margin:-4px 0 0!important;
  height:24px!important;
  line-height:24px!important;
}

/* Bottom bar fixed and stable */
.app{
  padding-bottom:calc(112px + env(safe-area-inset-bottom))!important;
}
.mainNav{
  position:fixed!important;
  left:50%!important;
  right:auto!important;
  bottom:calc(12px + env(safe-area-inset-bottom))!important;
  transform:translateX(-50%)!important;
  width:min(640px,calc(100% - 18px))!important;
  max-width:640px!important;
  margin:0!important;
  z-index:9999!important;
}

/* Keep profile logos inside the profile card */
.memberProfilePage .profileCard{
  position:relative!important;
  overflow:hidden!important;
  padding-left:88px!important;
}
.memberProfilePage .logos{
  position:absolute!important;
  left:14px!important;
  top:14px!important;
  display:flex!important;
  gap:7px!important;
  z-index:4!important;
  margin:0!important;
}
.memberProfilePage .logos .logoItem{
  width:38px!important;
  height:38px!important;
  min-width:38px!important;
  min-height:38px!important;
  padding:0!important;
  border:0!important;
  background:transparent!important;
  display:grid!important;
  place-items:center!important;
  cursor:default!important;
  pointer-events:none!important;
}
.memberProfilePage .logos img{
  width:38px!important;
  height:38px!important;
  min-width:38px!important;
  min-height:38px!important;
  max-width:38px!important;
  max-height:38px!important;
  padding:0!important;
  background:transparent!important;
  border-radius:0!important;
  object-fit:contain!important;
  filter:drop-shadow(0 8px 12px rgba(0,0,0,.35))!important;
}

@media(max-width:720px){
  .app{
    padding-bottom:calc(104px + env(safe-area-inset-bottom))!important;
  }
  .mainNav{
    width:calc(100% - 18px)!important;
    max-width:430px!important;
    height:72px!important;
    min-height:72px!important;
    border-radius:24px!important;
    padding:7px!important;
    display:grid!important;
    grid-template-columns:repeat(5,minmax(0,1fr))!important;
    gap:5px!important;
  }
  .navBtn{
    height:58px!important;
    min-height:58px!important;
  }

  .statCard,
  .memberStatsGrid .statCard,
  .statsPanelGrid .statCard,
  .generalTopStats .statCard{
    grid-template-rows:36px 44px 28px!important;
  }
  .statCard span,
  .memberStatsGrid .statCard span,
  .statsPanelGrid .statCard span,
  .generalTopStats .statCard span{
    margin-bottom:-3px!important;
  }
  .statCard b,
  .statCard strong,
  .memberStatsGrid .statCard b,
  .memberStatsGrid .statCard strong,
  .statsPanelGrid .statCard b,
  .statsPanelGrid .statCard strong,
  .generalTopStats .statCard b,
  .generalTopStats .statCard strong{
    height:44px!important;
    line-height:44px!important;
  }
  .statCard small,
  .statCard p,
  .memberStatsGrid .statCard small,
  .memberStatsGrid .statCard p,
  .statsPanelGrid .statCard small,
  .statsPanelGrid .statCard p,
  .generalTopStats .statCard small,
  .generalTopStats .statCard p{
    margin-top:-5px!important;
  }

  .memberProfilePage .profileCard{
    padding-left:82px!important;
  }
  .memberProfilePage .logos{
    left:12px!important;
    top:12px!important;
    gap:6px!important;
  }
  .memberProfilePage .logos .logoItem,
  .memberProfilePage .logos img{
    width:34px!important;
    height:34px!important;
    min-width:34px!important;
    min-height:34px!important;
    max-width:34px!important;
    max-height:34px!important;
  }
}
@media(max-width:380px){
  .memberProfilePage .profileCard{
    padding-left:74px!important;
  }
  .memberProfilePage .logos .logoItem,
  .memberProfilePage .logos img{
    width:31px!important;
    height:31px!important;
    min-width:31px!important;
    min-height:31px!important;
  }
}



/* ===== FIX: hero only on main members list + true fixed bottom app bar ===== */
.app{
  padding-bottom:calc(112px + env(safe-area-inset-bottom))!important;
}
.mainNav{
  position:fixed!important;
  left:50%!important;
  right:auto!important;
  bottom:calc(12px + env(safe-area-inset-bottom))!important;
  transform:translateX(-50%)!important;
  width:min(640px,calc(100% - 18px))!important;
  max-width:640px!important;
  height:74px!important;
  margin:0!important;
  padding:8px 10px!important;
  border-radius:26px!important;
  z-index:9999!important;
  display:grid!important;
  grid-template-columns:repeat(5,minmax(0,1fr))!important;
  gap:7px!important;
  overflow:visible!important;
}
.navBtn{
  height:58px!important;
  min-height:58px!important;
}
.widePage,
.membersHome,
.memberProfilePage{
  margin-bottom:calc(18px + env(safe-area-inset-bottom))!important;
}

/* The fixed bar should overlay only the reserved safe space, never cover useful content */
.listGrid,
.rankingList,
.playersGrid,
.trophyGrid,
.seasonSimpleList,
.archiveTrophyTable,
.archiveMemberList,
.archiveSeasonGrid,
.statsTable,
.finalsCardsList{
  padding-bottom:8px!important;
}

@media(max-width:720px){
  .app{
    padding-bottom:calc(104px + env(safe-area-inset-bottom))!important;
  }
  .mainNav{
    width:calc(100% - 18px)!important;
    max-width:430px!important;
    height:72px!important;
    min-height:72px!important;
    bottom:calc(10px + env(safe-area-inset-bottom))!important;
    border-radius:24px!important;
    padding:7px!important;
    gap:5px!important;
  }
  .navBtn{
    height:58px!important;
    min-height:58px!important;
    border-radius:18px!important;
  }
}



/* ===== iOS/SNOONU SAFE AREA + BOTTOM NAV + BACK BUTTON FIX ===== */

/* Full app respects iPhone status bar and home indicator */
html,
body,
#root{
  width:100%!important;
  min-height:100%!important;
  background:#020617!important;
  overflow-x:hidden!important;
}

body{
  margin:0!important;
  padding:0!important;
  padding-top:env(safe-area-inset-top)!important;
  background:#020617!important;
}

.iosSafeApp,
.app{
  min-height:100vh!important;
  padding-top:calc(14px + env(safe-area-inset-top))!important;
  padding-left:14px!important;
  padding-right:14px!important;
  padding-bottom:calc(118px + env(safe-area-inset-bottom))!important;
  overflow-x:hidden!important;
  background:#020617!important;
}

/* Page containers should never start under the iPhone clock/battery */
.mainHero,
.membersHome,
.memberProfilePage,
.widePage,
.announcement{
  position:relative!important;
  z-index:1!important;
}

/* Fixed app bar: real native-app style, not transparent enough to show cards below */
.mainNav{
  position:fixed!important;
  left:50%!important;
  right:auto!important;
  bottom:calc(12px + env(safe-area-inset-bottom))!important;
  transform:translateX(-50%)!important;
  width:min(640px,calc(100% - 18px))!important;
  max-width:640px!important;
  height:74px!important;
  min-height:74px!important;
  margin:0!important;
  padding:8px 10px!important;
  border-radius:28px!important;
  z-index:99999!important;
  display:grid!important;
  grid-template-columns:repeat(5,minmax(0,1fr))!important;
  gap:7px!important;
  overflow:hidden!important;
  background:linear-gradient(180deg,rgba(9,14,29,.98),rgba(5,10,23,.98))!important;
  border:1px solid rgba(255,255,255,.12)!important;
  box-shadow:
    0 -10px 34px rgba(0,0,0,.38),
    0 22px 70px rgba(0,0,0,.62),
    inset 0 1px 0 rgba(255,255,255,.12)!important;
  backdrop-filter:blur(26px) saturate(150%)!important;
  -webkit-backdrop-filter:blur(26px) saturate(150%)!important;
}

/* Strong bottom mask so scrolling content does not visually pass through/under the bar */
.mainNav:before{
  content:""!important;
  position:fixed!important;
  left:50%!important;
  bottom:0!important;
  transform:translateX(-50%)!important;
  width:100vw!important;
  height:calc(104px + env(safe-area-inset-bottom))!important;
  background:linear-gradient(180deg,rgba(2,6,23,0),#020617 32%,#020617 100%)!important;
  z-index:-1!important;
  pointer-events:none!important;
}

.navBtn{
  height:58px!important;
  min-height:58px!important;
  min-width:0!important;
  border-radius:22px!important;
  padding:5px 3px!important;
  display:flex!important;
  flex-direction:column!important;
  align-items:center!important;
  justify-content:center!important;
  gap:5px!important;
  color:#d7e3f5!important;
  background:transparent!important;
  border:1px solid transparent!important;
}

.navBtn.active{
  background:linear-gradient(135deg,rgba(0,229,255,.24),rgba(47,140,255,.28))!important;
  border-color:rgba(0,229,255,.42)!important;
  box-shadow:0 10px 28px rgba(0,229,255,.16)!important;
}

/* Snoonu-like circular back button on subpages */
.floatingBackBtn{
  position:sticky!important;
  top:calc(12px + env(safe-area-inset-top))!important;
  z-index:50!important;
  width:58px!important;
  height:58px!important;
  min-width:58px!important;
  min-height:58px!important;
  border:0!important;
  border-radius:999px!important;
  display:flex!important;
  align-items:center!important;
  justify-content:center!important;
  margin:0 0 14px auto!important;
  background:rgba(255,255,255,.13)!important;
  color:#f8fafc!important;
  font-size:36px!important;
  line-height:1!important;
  font-weight:900!important;
  box-shadow:0 16px 36px rgba(0,0,0,.34), inset 0 1px 0 rgba(255,255,255,.13)!important;
  backdrop-filter:blur(18px) saturate(140%)!important;
  -webkit-backdrop-filter:blur(18px) saturate(140%)!important;
  cursor:pointer!important;
}

/* Keep content ending above the fixed nav */
.widePage,
.membersHome,
.memberProfilePage{
  margin-bottom:calc(18px + env(safe-area-inset-bottom))!important;
}

@media(max-width:720px){
  .iosSafeApp,
  .app{
    padding-top:calc(12px + env(safe-area-inset-top))!important;
    padding-left:8px!important;
    padding-right:8px!important;
    padding-bottom:calc(112px + env(safe-area-inset-bottom))!important;
  }

  .mainNav{
    width:calc(100% - 18px)!important;
    max-width:430px!important;
    height:72px!important;
    min-height:72px!important;
    bottom:calc(10px + env(safe-area-inset-bottom))!important;
    border-radius:26px!important;
    padding:7px!important;
    gap:5px!important;
  }

  .navBtn{
    height:58px!important;
    min-height:58px!important;
    border-radius:20px!important;
  }

  .navIcon{
    font-size:22px!important;
    line-height:1!important;
  }

  .navLabel{
    font-size:10px!important;
    line-height:1.05!important;
    white-space:nowrap!important;
  }

  .floatingBackBtn{
    width:54px!important;
    height:54px!important;
    min-width:54px!important;
    min-height:54px!important;
    font-size:34px!important;
    margin-bottom:12px!important;
  }
}

@media(max-width:380px){
  .navLabel{
    font-size:9px!important;
  }
  .floatingBackBtn{
    width:50px!important;
    height:50px!important;
    min-width:50px!important;
    min-height:50px!important;
    font-size:31px!important;
  }
}



/* ===== HARD STRUCTURAL FIX: status bar, bottom curtain, native app nav ===== */
html{
  background:#020617!important;
  overflow-x:hidden!important;
}
body,#root{
  margin:0!important;
  width:100%!important;
  min-height:100%!important;
  background:#020617!important;
  overflow-x:hidden!important;
}

/* Real top protection for iPhone screenshots/status bar.
   env() can be zero in browser, so we add a small fixed mobile offset too. */
.app.iosSafeApp,
.iosSafeApp,
.app{
  min-height:100vh!important;
  background:#020617!important;
  padding-left:14px!important;
  padding-right:14px!important;
  padding-top:calc(18px + env(safe-area-inset-top))!important;
  padding-bottom:calc(124px + env(safe-area-inset-bottom))!important;
  overflow-x:hidden!important;
}

.bottomNavCurtain{
  position:fixed!important;
  left:0!important;
  right:0!important;
  bottom:0!important;
  height:calc(118px + env(safe-area-inset-bottom))!important;
  background:linear-gradient(180deg,rgba(2,6,23,0),#020617 28%,#020617 100%)!important;
  z-index:9998!important;
  pointer-events:none!important;
}

/* Force bottom nav to sit above the solid curtain, like a native app */
.mainNav.glassSoft,
.mainNav{
  position:fixed!important;
  left:50%!important;
  right:auto!important;
  bottom:calc(12px + env(safe-area-inset-bottom))!important;
  transform:translateX(-50%)!important;
  width:min(640px,calc(100vw - 18px))!important;
  max-width:640px!important;
  height:74px!important;
  min-height:74px!important;
  max-height:74px!important;
  margin:0!important;
  padding:8px 10px!important;
  border-radius:28px!important;
  z-index:9999!important;
  display:grid!important;
  grid-template-columns:repeat(5,minmax(0,1fr))!important;
  gap:7px!important;
  overflow:hidden!important;
  background:linear-gradient(180deg,#081126,#050a17)!important;
  border:1px solid rgba(255,255,255,.14)!important;
  box-shadow:0 -10px 34px rgba(0,0,0,.42),0 18px 60px rgba(0,0,0,.58),inset 0 1px 0 rgba(255,255,255,.14)!important;
  backdrop-filter:none!important;
  -webkit-backdrop-filter:none!important;
}
.mainNav:before{display:none!important;content:none!important}

.navBtn{
  height:58px!important;
  min-height:58px!important;
  max-height:58px!important;
  min-width:0!important;
  border-radius:21px!important;
  padding:5px 3px!important;
  display:flex!important;
  flex-direction:column!important;
  align-items:center!important;
  justify-content:center!important;
  gap:5px!important;
  overflow:hidden!important;
}

/* Snoonu-like circular back, visible on subpages */
.floatingBackBtn{
  position:sticky!important;
  top:calc(14px + env(safe-area-inset-top))!important;
  z-index:100!important;
  width:62px!important;
  height:62px!important;
  min-width:62px!important;
  min-height:62px!important;
  border:0!important;
  border-radius:999px!important;
  margin:0 0 14px auto!important;
  padding:0!important;
  display:flex!important;
  align-items:center!important;
  justify-content:center!important;
  background:#303033!important;
  color:#fff!important;
  box-shadow:0 16px 36px rgba(0,0,0,.35)!important;
  cursor:pointer!important;
}
.floatingBackBtn span{
  display:block!important;
  font-size:42px!important;
  line-height:1!important;
  font-weight:900!important;
  transform:translateX(-1px)!important;
}

/* Do not let page content sit under the fixed nav */
.widePage,
.membersHome,
.memberProfilePage{
  margin-bottom:0!important;
}

@media(max-width:720px){
  .app.iosSafeApp,
  .iosSafeApp,
  .app{
    padding-left:8px!important;
    padding-right:8px!important;
    /* Fixed extra top offset solves iPhone/Safari status overlay even when env() is not available */
    padding-top:calc(54px + env(safe-area-inset-top))!important;
    padding-bottom:calc(118px + env(safe-area-inset-bottom))!important;
  }
  .bottomNavCurtain{
    height:calc(112px + env(safe-area-inset-bottom))!important;
  }
  .mainNav.glassSoft,
  .mainNav{
    width:calc(100vw - 18px)!important;
    max-width:430px!important;
    height:72px!important;
    min-height:72px!important;
    max-height:72px!important;
    bottom:calc(10px + env(safe-area-inset-bottom))!important;
    border-radius:26px!important;
    padding:7px!important;
    gap:5px!important;
  }
  .navBtn{
    height:58px!important;
    min-height:58px!important;
    max-height:58px!important;
    border-radius:20px!important;
  }
  .floatingBackBtn{
    width:58px!important;
    height:58px!important;
    min-width:58px!important;
    min-height:58px!important;
    top:calc(8px + env(safe-area-inset-top))!important;
    margin-bottom:12px!important;
  }
  .floatingBackBtn span{
    font-size:40px!important;
  }
}
@media(max-width:380px){
  .app.iosSafeApp,
  .iosSafeApp,
  .app{
    padding-top:calc(50px + env(safe-area-inset-top))!important;
  }
  .navLabel{
    font-size:9px!important;
  }
  .floatingBackBtn{
    width:54px!important;
    height:54px!important;
    min-width:54px!important;
    min-height:54px!important;
  }
  .floatingBackBtn span{
    font-size:37px!important;
  }
}



/* ===== TOP SAFE AREA FINAL FIX: content never goes under iPhone status bar ===== */
html,
body,
#root{
  background:#020617!important;
}

body{
  padding-top:0!important;
}

/* keep bottom fix, add stronger real top offset */
.app.iosSafeApp,
.iosSafeApp,
.app{
  padding-top:calc(72px + env(safe-area-inset-top))!important;
}

/* pages and hero start safely below iOS clock/battery */
.mainHero,
.membersHome,
.memberProfilePage,
.widePage,
.announcement{
  margin-top:0!important;
}

/* sticky back button should sit below status bar too */
.floatingBackBtn{
  top:calc(72px + env(safe-area-inset-top))!important;
}

/* On larger desktop/tablet do not overpush too much */
@media(min-width:721px){
  .app.iosSafeApp,
  .iosSafeApp,
  .app{
    padding-top:calc(28px + env(safe-area-inset-top))!important;
  }
  .floatingBackBtn{
    top:calc(28px + env(safe-area-inset-top))!important;
  }
}

@media(max-width:720px){
  .app.iosSafeApp,
  .iosSafeApp,
  .app{
    padding-top:calc(76px + env(safe-area-inset-top))!important;
  }
  .floatingBackBtn{
    top:calc(76px + env(safe-area-inset-top))!important;
  }
}

@media(max-width:380px){
  .app.iosSafeApp,
  .iosSafeApp,
  .app{
    padding-top:calc(72px + env(safe-area-inset-top))!important;
  }
  .floatingBackBtn{
    top:calc(72px + env(safe-area-inset-top))!important;
  }
}



/* ===== FIX MAIN COVER HEADER: sticky/fixed top, content starts below it ===== */

/* Main cover visible only on members home, make it fixed like native top area */
.mainHero{
  position:fixed!important;
  top:calc(10px + env(safe-area-inset-top))!important;
  left:50%!important;
  transform:translateX(-50%)!important;
  width:min(1180px,calc(100% - 28px))!important;
  max-width:1180px!important;
  height:226px!important;
  margin:0!important;
  z-index:9990!important;
  border-radius:34px!important;
  overflow:hidden!important;
}

/* On the main members list only: reserve vertical space for the fixed cover */
.mainHero + .announcement,
.membersHome{
  margin-top:calc(238px + env(safe-area-inset-top))!important;
}

/* If there is no announcement, membersHome still needs room below fixed cover */
.app > .membersHome:first-of-type{
  margin-top:calc(238px + env(safe-area-inset-top))!important;
}

/* Other internal pages should not be pushed by main cover because cover is not rendered there */
.memberProfilePage,
.widePage{
  margin-top:0!important;
}

@media(max-width:720px){
  .mainHero{
    top:calc(8px + env(safe-area-inset-top))!important;
    width:calc(100% - 16px)!important;
    max-width:430px!important;
    height:188px!important;
    min-height:188px!important;
    border-radius:24px!important;
  }

  .mainHero + .announcement,
  .membersHome{
    margin-top:calc(202px + env(safe-area-inset-top))!important;
  }

  .app > .membersHome:first-of-type{
    margin-top:calc(202px + env(safe-area-inset-top))!important;
  }
}

@media(max-width:380px){
  .mainHero{
    height:174px!important;
    min-height:174px!important;
  }

  .mainHero + .announcement,
  .membersHome{
    margin-top:calc(188px + env(safe-area-inset-top))!important;
  }

  .app > .membersHome:first-of-type{
    margin-top:calc(188px + env(safe-area-inset-top))!important;
  }
}



/* ===== REAL TOP STATUS CURTAIN: prevents content showing under clock/battery while scrolling ===== */
.topStatusCurtain{
  position:fixed!important;
  top:0!important;
  left:0!important;
  right:0!important;
  height:calc(58px + env(safe-area-inset-top))!important;
  background:#020617!important;
  z-index:100000!important;
  pointer-events:none!important;
}

/* Push all app content below the visual status curtain */
.app.iosSafeApp,
.iosSafeApp,
.app{
  padding-top:calc(70px + env(safe-area-inset-top))!important;
}

/* Any fixed header must start below the curtain */
.mainHero{
  top:calc(64px + env(safe-area-inset-top))!important;
}

/* Sticky back button also starts below the curtain */
.floatingBackBtn{
  top:calc(66px + env(safe-area-inset-top))!important;
}

@media(max-width:720px){
  .topStatusCurtain{
    height:calc(62px + env(safe-area-inset-top))!important;
  }

  .app.iosSafeApp,
  .iosSafeApp,
  .app{
    padding-top:calc(74px + env(safe-area-inset-top))!important;
  }

  .mainHero{
    top:calc(66px + env(safe-area-inset-top))!important;
  }

  .floatingBackBtn{
    top:calc(68px + env(safe-area-inset-top))!important;
  }

  .mainHero + .announcement,
  .membersHome,
  .app > .membersHome:first-of-type{
    margin-top:calc(270px + env(safe-area-inset-top))!important;
  }
}

@media(max-width:380px){
  .topStatusCurtain{
    height:calc(58px + env(safe-area-inset-top))!important;
  }

  .app.iosSafeApp,
  .iosSafeApp,
  .app{
    padding-top:calc(70px + env(safe-area-inset-top))!important;
  }

  .mainHero{
    top:calc(62px + env(safe-area-inset-top))!important;
  }

  .mainHero + .announcement,
  .membersHome,
  .app > .membersHome:first-of-type{
    margin-top:calc(250px + env(safe-area-inset-top))!important;
  }
}



/* ===== FINAL TOP AREA TUNING: smaller status curtain + cover not fixed + Snoonu back space ===== */

/* Smaller top curtain: only protects clock/battery area, not a huge blank area */
.topStatusCurtain{
  height:calc(38px + env(safe-area-inset-top))!important;
  background:#020617!important;
}

/* App starts below small safe area only */
.app.iosSafeApp,
.iosSafeApp,
.app{
  padding-top:calc(46px + env(safe-area-inset-top))!important;
}

/* Unfix the main cover: it scrolls normally again */
.mainHero{
  position:relative!important;
  top:auto!important;
  left:auto!important;
  transform:none!important;
  width:100%!important;
  margin:0 auto 14px!important;
  z-index:1!important;
}

/* Remove the extra reserved space that was added for fixed cover */
.mainHero + .announcement,
.membersHome,
.app > .membersHome:first-of-type{
  margin-top:0!important;
}

/* Snoonu-like back button uses the top safe space nicely on subpages */
.floatingBackBtn{
  position:sticky!important;
  top:calc(46px + env(safe-area-inset-top))!important;
  z-index:100001!important;
  width:58px!important;
  height:58px!important;
  min-width:58px!important;
  min-height:58px!important;
  margin:0 0 14px auto!important;
  border-radius:999px!important;
  background:#303033!important;
  color:#fff!important;
  box-shadow:0 16px 36px rgba(0,0,0,.35)!important;
}

@media(max-width:720px){
  .topStatusCurtain{
    height:calc(40px + env(safe-area-inset-top))!important;
  }

  .app.iosSafeApp,
  .iosSafeApp,
  .app{
    padding-top:calc(48px + env(safe-area-inset-top))!important;
  }

  .mainHero{
    position:relative!important;
    top:auto!important;
    left:auto!important;
    transform:none!important;
    width:100%!important;
    max-width:430px!important;
    margin:0 auto 10px!important;
  }

  .mainHero + .announcement,
  .membersHome,
  .app > .membersHome:first-of-type{
    margin-top:0!important;
  }

  .floatingBackBtn{
    top:calc(48px + env(safe-area-inset-top))!important;
    width:56px!important;
    height:56px!important;
    min-width:56px!important;
    min-height:56px!important;
  }
}

@media(max-width:380px){
  .topStatusCurtain{
    height:calc(38px + env(safe-area-inset-top))!important;
  }

  .app.iosSafeApp,
  .iosSafeApp,
  .app{
    padding-top:calc(44px + env(safe-area-inset-top))!important;
  }

  .floatingBackBtn{
    top:calc(44px + env(safe-area-inset-top))!important;
    width:52px!important;
    height:52px!important;
    min-width:52px!important;
    min-height:52px!important;
  }
}



/* ===== SEASON PAGE NO EXTRA SCROLL WHEN CONTENT FITS ===== */
.seasonCardsPage{
  min-height:auto!important;
  height:auto!important;
  margin-bottom:0!important;
  padding-bottom:16px!important;
}

.seasonSimpleList{
  padding-bottom:0!important;
  margin-bottom:0!important;
}

/* prevent hidden old season grids from keeping extra scroll space */
.seasonCardsList,
.seasonGrid{
  display:none!important;
  height:0!important;
  min-height:0!important;
  max-height:0!important;
  margin:0!important;
  padding:0!important;
  overflow:hidden!important;
}

/* when season page is short, bottom reserved area stays only for nav, not extra fake scroll */
@media(max-width:720px){
  .seasonCardsPage{
    padding-bottom:10px!important;
  }

  .seasonSimpleRow:last-child{
    margin-bottom:0!important;
  }
}



/* ===== GLOBAL SCROLL FIX: no fake body scroll when content fits ===== */
/* The earlier safe-area padding made body taller than the viewport. 
   Now the app itself is the scroll container; body never creates extra scroll. */
html,
body,
#root{
  width:100%!important;
  height:100%!important;
  min-height:100%!important;
  margin:0!important;
  padding:0!important;
  overflow:hidden!important;
  background:#020617!important;
}

*{
  box-sizing:border-box!important;
}

.app,
.app.iosSafeApp,
.iosSafeApp{
  height:100dvh!important;
  min-height:100dvh!important;
  max-height:100dvh!important;
  overflow-x:hidden!important;
  overflow-y:auto!important;
  -webkit-overflow-scrolling:touch!important;
  overscroll-behavior-y:contain!important;
}

/* Loading / maintenance screen must never show a fake scrollbar */
.systemScreen{
  width:100%!important;
  height:100dvh!important;
  min-height:100dvh!important;
  max-height:100dvh!important;
  overflow:hidden!important;
}

/* If a page is shorter than the viewport, it should not force scroll */
.membersHome,
.memberProfilePage,
.widePage,
.seasonCardsPage{
  min-height:auto!important;
}

/* Keep bottom nav safe without adding body-height scroll */
.bottomNavCurtain,
.topStatusCurtain,
.mainNav{
  flex:0 0 auto!important;
}

@media(max-width:720px){
  .app,
  .app.iosSafeApp,
  .iosSafeApp{
    height:100dvh!important;
    min-height:100dvh!important;
    max-height:100dvh!important;
  }
}



/* ===== TRADINGVIEW-STYLE BOUNDED SCROLL MODEL ===== */
/* Goal: scrollbar/content area starts below status bar and ends above bottom nav. */

html,
body,
#root{
  width:100%!important;
  height:100%!important;
  min-height:100%!important;
  margin:0!important;
  padding:0!important;
  overflow:hidden!important;
  background:#020617!important;
}

/* The app itself is the ONLY scroll container.
   Its top and bottom boundaries match native apps: below status bar, above bottom nav. */
.app,
.app.iosSafeApp,
.iosSafeApp{
  position:fixed!important;
  left:0!important;
  right:0!important;
  top:calc(42px + env(safe-area-inset-top))!important;
  bottom:calc(100px + env(safe-area-inset-bottom))!important;
  width:100%!important;
  height:auto!important;
  min-height:0!important;
  max-height:none!important;
  padding:0 14px 14px!important;
  overflow-x:hidden!important;
  overflow-y:auto!important;
  -webkit-overflow-scrolling:touch!important;
  overscroll-behavior-y:contain!important;
  background:#020617!important;
}

/* no fake status curtain needed; scroll area itself starts below status bar */
.topStatusCurtain{
  display:none!important;
}

/* remove old huge safe-area padding leftovers */
.mainHero,
.membersHome,
.memberProfilePage,
.widePage,
.announcement{
  margin-top:0!important;
}

/* Bottom bar is outside the scroll area visually */
.bottomNavCurtain{
  position:fixed!important;
  left:0!important;
  right:0!important;
  bottom:0!important;
  height:calc(100px + env(safe-area-inset-bottom))!important;
  background:#020617!important;
  z-index:9998!important;
  pointer-events:none!important;
}

.mainNav,
.mainNav.glassSoft{
  position:fixed!important;
  left:50%!important;
  right:auto!important;
  bottom:calc(12px + env(safe-area-inset-bottom))!important;
  transform:translateX(-50%)!important;
  width:min(640px,calc(100vw - 18px))!important;
  max-width:640px!important;
  height:74px!important;
  min-height:74px!important;
  margin:0!important;
  padding:8px 10px!important;
  border-radius:28px!important;
  z-index:9999!important;
  display:grid!important;
  grid-template-columns:repeat(5,minmax(0,1fr))!important;
  gap:7px!important;
  overflow:hidden!important;
  background:linear-gradient(180deg,#081126,#050a17)!important;
  border:1px solid rgba(255,255,255,.14)!important;
  box-shadow:0 -8px 28px rgba(0,0,0,.32),0 18px 60px rgba(0,0,0,.58),inset 0 1px 0 rgba(255,255,255,.14)!important;
  backdrop-filter:none!important;
  -webkit-backdrop-filter:none!important;
}
.mainNav:before{
  display:none!important;
  content:none!important;
}

.navBtn{
  height:58px!important;
  min-height:58px!important;
  max-height:58px!important;
}

/* Main cover is normal, not fixed */
.mainHero{
  position:relative!important;
  top:auto!important;
  left:auto!important;
  transform:none!important;
  width:100%!important;
  margin:0 auto 14px!important;
  z-index:1!important;
}

/* Subpage back button lives at the top of the bounded scroll area */
.floatingBackBtn{
  position:sticky!important;
  top:8px!important;
  z-index:100!important;
  width:58px!important;
  height:58px!important;
  min-width:58px!important;
  min-height:58px!important;
  border:0!important;
  border-radius:999px!important;
  margin:0 0 14px auto!important;
  padding:0!important;
  display:flex!important;
  align-items:center!important;
  justify-content:center!important;
  background:#303033!important;
  color:#fff!important;
  box-shadow:0 16px 36px rgba(0,0,0,.35)!important;
  cursor:pointer!important;
}
.floatingBackBtn span{
  display:block!important;
  font-size:40px!important;
  line-height:1!important;
  font-weight:900!important;
}

/* Page containers should not add fake extra scroll */
.widePage,
.membersHome,
.memberProfilePage,
.seasonCardsPage{
  min-height:auto!important;
  margin-bottom:0!important;
}

.systemScreen{
  position:fixed!important;
  inset:0!important;
  width:100%!important;
  height:100dvh!important;
  min-height:100dvh!important;
  max-height:100dvh!important;
  overflow:hidden!important;
  background:#020617!important;
}

@media(max-width:720px){
  .app,
  .app.iosSafeApp,
  .iosSafeApp{
    top:calc(44px + env(safe-area-inset-top))!important;
    bottom:calc(92px + env(safe-area-inset-bottom))!important;
    padding:0 8px 10px!important;
  }

  .bottomNavCurtain{
    height:calc(92px + env(safe-area-inset-bottom))!important;
  }

  .mainNav,
  .mainNav.glassSoft{
    width:calc(100vw - 18px)!important;
    max-width:430px!important;
    height:72px!important;
    min-height:72px!important;
    bottom:calc(10px + env(safe-area-inset-bottom))!important;
    border-radius:26px!important;
    padding:7px!important;
    gap:5px!important;
  }

  .navBtn{
    height:58px!important;
    min-height:58px!important;
    max-height:58px!important;
  }

  .floatingBackBtn{
    width:56px!important;
    height:56px!important;
    min-width:56px!important;
    min-height:56px!important;
    top:8px!important;
  }

  .floatingBackBtn span{
    font-size:38px!important;
  }
}

@media(max-width:380px){
  .app,
  .app.iosSafeApp,
  .iosSafeApp{
    top:calc(40px + env(safe-area-inset-top))!important;
    bottom:calc(88px + env(safe-area-inset-bottom))!important;
    padding:0 8px 10px!important;
  }

  .bottomNavCurtain{
    height:calc(88px + env(safe-area-inset-bottom))!important;
  }

  .floatingBackBtn{
    width:52px!important;
    height:52px!important;
    min-width:52px!important;
    min-height:52px!important;
  }

  .floatingBackBtn span{
    font-size:35px!important;
  }
}



/* ===== FIX: bottom nav always visible on every page after bounded scroll ===== */
.bottomNavCurtain{
  display:block!important;
  position:fixed!important;
  left:0!important;
  right:0!important;
  bottom:0!important;
  height:calc(96px + env(safe-area-inset-bottom))!important;
  background:#020617!important;
  z-index:2147483000!important;
  pointer-events:none!important;
}

.mainNav,
.mainNav.glassSoft{
  display:grid!important;
  visibility:visible!important;
  opacity:1!important;
  pointer-events:auto!important;
  position:fixed!important;
  left:50%!important;
  right:auto!important;
  bottom:calc(10px + env(safe-area-inset-bottom))!important;
  transform:translateX(-50%)!important;
  width:min(640px,calc(100vw - 18px))!important;
  max-width:640px!important;
  height:74px!important;
  min-height:74px!important;
  max-height:74px!important;
  margin:0!important;
  padding:8px 10px!important;
  grid-template-columns:repeat(5,minmax(0,1fr))!important;
  gap:7px!important;
  border-radius:28px!important;
  overflow:hidden!important;
  background:linear-gradient(180deg,#081126,#050a17)!important;
  border:1px solid rgba(255,255,255,.14)!important;
  box-shadow:0 -8px 28px rgba(0,0,0,.32),0 18px 60px rgba(0,0,0,.58),inset 0 1px 0 rgba(255,255,255,.14)!important;
  z-index:2147483001!important;
}

.mainNav *,
.mainNav.glassSoft *{
  visibility:visible!important;
  opacity:1!important;
}

.navBtn{
  display:flex!important;
  visibility:visible!important;
  opacity:1!important;
  pointer-events:auto!important;
}

/* Prevent page panels/modals from covering the nav unless it is a real modal drawer */
.app,
.app.iosSafeApp,
.iosSafeApp{
  z-index:1!important;
}

.drawerBackdrop{
  z-index:2147483002!important;
}

/* Keep the scroll area ending above the nav */
.app,
.app.iosSafeApp,
.iosSafeApp{
  bottom:calc(96px + env(safe-area-inset-bottom))!important;
}

@media(max-width:720px){
  .bottomNavCurtain{
    height:calc(92px + env(safe-area-inset-bottom))!important;
  }

  .mainNav,
  .mainNav.glassSoft{
    width:calc(100vw - 18px)!important;
    max-width:430px!important;
    height:72px!important;
    min-height:72px!important;
    max-height:72px!important;
    bottom:calc(10px + env(safe-area-inset-bottom))!important;
    padding:7px!important;
    gap:5px!important;
    border-radius:26px!important;
  }

  .app,
  .app.iosSafeApp,
  .iosSafeApp{
    bottom:calc(92px + env(safe-area-inset-bottom))!important;
  }
}

@media(max-width:380px){
  .bottomNavCurtain{
    height:calc(88px + env(safe-area-inset-bottom))!important;
  }

  .app,
  .app.iosSafeApp,
  .iosSafeApp{
    bottom:calc(88px + env(safe-area-inset-bottom))!important;
  }
}



/* ===== MOBILE NAV PORTAL FIX: bottom nav rendered on body, always visible ===== */
.bottomNavCurtain{
  display:none!important;
}

.bottomNavPortalCurtain{
  position:fixed!important;
  left:0!important;
  right:0!important;
  bottom:0!important;
  height:calc(96px + env(safe-area-inset-bottom))!important;
  background:#020617!important;
  z-index:2147483600!important;
  pointer-events:none!important;
  display:block!important;
}

body > .mainNav,
body > .mainNav.glassSoft,
.mainNav,
.mainNav.glassSoft{
  display:grid!important;
  visibility:visible!important;
  opacity:1!important;
  pointer-events:auto!important;
  position:fixed!important;
  left:50%!important;
  right:auto!important;
  bottom:calc(10px + env(safe-area-inset-bottom))!important;
  transform:translateX(-50%)!important;
  width:min(640px,calc(100vw - 18px))!important;
  max-width:640px!important;
  height:74px!important;
  min-height:74px!important;
  max-height:74px!important;
  margin:0!important;
  padding:8px 10px!important;
  grid-template-columns:repeat(5,minmax(0,1fr))!important;
  gap:7px!important;
  border-radius:28px!important;
  overflow:hidden!important;
  background:linear-gradient(180deg,#081126,#050a17)!important;
  border:1px solid rgba(255,255,255,.14)!important;
  box-shadow:0 -8px 28px rgba(0,0,0,.32),0 18px 60px rgba(0,0,0,.58),inset 0 1px 0 rgba(255,255,255,.14)!important;
  z-index:2147483601!important;
  clip:auto!important;
}

body > .mainNav *,
.mainNav *{
  visibility:visible!important;
  opacity:1!important;
}

.navBtn{
  display:flex!important;
  visibility:visible!important;
  opacity:1!important;
  pointer-events:auto!important;
  height:58px!important;
  min-height:58px!important;
  max-height:58px!important;
}

.app,
.app.iosSafeApp,
.iosSafeApp{
  bottom:calc(96px + env(safe-area-inset-bottom))!important;
}

@media(max-width:720px){
  .bottomNavPortalCurtain{
    height:calc(92px + env(safe-area-inset-bottom))!important;
  }

  body > .mainNav,
  body > .mainNav.glassSoft,
  .mainNav,
  .mainNav.glassSoft{
    width:calc(100vw - 18px)!important;
    max-width:430px!important;
    height:72px!important;
    min-height:72px!important;
    max-height:72px!important;
    bottom:calc(10px + env(safe-area-inset-bottom))!important;
    padding:7px!important;
    gap:5px!important;
    border-radius:26px!important;
  }

  .app,
  .app.iosSafeApp,
  .iosSafeApp{
    bottom:calc(92px + env(safe-area-inset-bottom))!important;
  }
}

@media(max-width:380px){
  .bottomNavPortalCurtain{
    height:calc(88px + env(safe-area-inset-bottom))!important;
  }

  .app,
  .app.iosSafeApp,
  .iosSafeApp{
    bottom:calc(88px + env(safe-area-inset-bottom))!important;
  }
}



/* ===== FINAL GLOBAL APP BOUNDS: top system bar + bottom nav + drawer inside bounds ===== */
:root{
  --app-top-safe: calc(44px + env(safe-area-inset-top));
  --app-bottom-safe: calc(92px + env(safe-area-inset-bottom));
}

html,body,#root{
  width:100%!important;
  height:100%!important;
  min-height:100%!important;
  margin:0!important;
  padding:0!important;
  overflow:hidden!important;
  background:#020617!important;
}

/* The app scroll area is always between the upper and lower bars.
   This makes every current/future page obey the same safe area. */
.app,
.app.iosSafeApp,
.iosSafeApp{
  position:fixed!important;
  inset-inline:0!important;
  top:var(--app-top-safe)!important;
  bottom:var(--app-bottom-safe)!important;
  width:100%!important;
  height:auto!important;
  min-height:0!important;
  max-height:none!important;
  padding:0 14px 14px!important;
  overflow-x:hidden!important;
  overflow-y:auto!important;
  -webkit-overflow-scrolling:touch!important;
  overscroll-behavior-y:contain!important;
  background:#020617!important;
  z-index:1!important;
}

/* Top bar rendered through portal to body, so it appears on ALL pages */
.topSystemPortalBar{
  position:fixed!important;
  top:0!important;
  left:0!important;
  right:0!important;
  height:var(--app-top-safe)!important;
  background:#020617!important;
  z-index:2147483602!important;
  pointer-events:none!important;
  display:block!important;
}

/* Bottom bar rendered through portal to body */
.bottomNavPortalCurtain{
  position:fixed!important;
  left:0!important;
  right:0!important;
  bottom:0!important;
  height:var(--app-bottom-safe)!important;
  background:#020617!important;
  z-index:2147483600!important;
  pointer-events:none!important;
  display:block!important;
}

.bottomNavCurtain,
.topStatusCurtain{
  display:none!important;
}

/* Bottom nav always visible */
body > .mainNav,
body > .mainNav.glassSoft,
.mainNav,
.mainNav.glassSoft{
  display:grid!important;
  visibility:visible!important;
  opacity:1!important;
  pointer-events:auto!important;
  position:fixed!important;
  left:50%!important;
  right:auto!important;
  bottom:calc(10px + env(safe-area-inset-bottom))!important;
  transform:translateX(-50%)!important;
  width:min(640px,calc(100vw - 18px))!important;
  max-width:640px!important;
  height:74px!important;
  min-height:74px!important;
  max-height:74px!important;
  margin:0!important;
  padding:8px 10px!important;
  grid-template-columns:repeat(5,minmax(0,1fr))!important;
  gap:7px!important;
  border-radius:28px!important;
  overflow:hidden!important;
  background:linear-gradient(180deg,#081126,#050a17)!important;
  border:1px solid rgba(255,255,255,.14)!important;
  box-shadow:0 -8px 28px rgba(0,0,0,.32),0 18px 60px rgba(0,0,0,.58),inset 0 1px 0 rgba(255,255,255,.14)!important;
  z-index:2147483601!important;
  clip:auto!important;
}

.navBtn{
  display:flex!important;
  visibility:visible!important;
  opacity:1!important;
  pointer-events:auto!important;
  height:58px!important;
  min-height:58px!important;
  max-height:58px!important;
}

/* Drawer / menu is also bounded between top and bottom bars */
.drawerBackdrop{
  position:fixed!important;
  top:var(--app-top-safe)!important;
  bottom:var(--app-bottom-safe)!important;
  left:0!important;
  right:0!important;
  height:auto!important;
  inset:auto 0 var(--app-bottom-safe) 0!important;
  z-index:2147483599!important;
  background:rgba(0,0,0,.46)!important;
  display:flex!important;
  justify-content:flex-start!important;
  align-items:stretch!important;
  overflow:hidden!important;
}

.sideDrawer{
  height:100%!important;
  max-height:100%!important;
  overflow-y:auto!important;
  border-radius:0 28px 28px 0!important;
}

/* Back button remains inside the app's bounded scroll zone */
.floatingBackBtn{
  position:sticky!important;
  top:8px!important;
  z-index:100!important;
}

/* Main cover normal, no fixed behavior */
.mainHero{
  position:relative!important;
  top:auto!important;
  left:auto!important;
  transform:none!important;
  width:100%!important;
  margin:0 auto 14px!important;
  z-index:1!important;
}

.widePage,
.membersHome,
.memberProfilePage,
.seasonCardsPage{
  min-height:auto!important;
  margin-top:0!important;
  margin-bottom:0!important;
}

.systemScreen{
  position:fixed!important;
  inset:0!important;
  width:100%!important;
  height:100dvh!important;
  min-height:100dvh!important;
  max-height:100dvh!important;
  overflow:hidden!important;
  background:#020617!important;
}

@media(max-width:720px){
  :root{
    --app-top-safe: calc(44px + env(safe-area-inset-top));
    --app-bottom-safe: calc(92px + env(safe-area-inset-bottom));
  }

  .app,
  .app.iosSafeApp,
  .iosSafeApp{
    padding:0 8px 10px!important;
  }

  body > .mainNav,
  body > .mainNav.glassSoft,
  .mainNav,
  .mainNav.glassSoft{
    width:calc(100vw - 18px)!important;
    max-width:430px!important;
    height:72px!important;
    min-height:72px!important;
    max-height:72px!important;
    bottom:calc(10px + env(safe-area-inset-bottom))!important;
    padding:7px!important;
    gap:5px!important;
    border-radius:26px!important;
  }

  .navBtn{
    height:58px!important;
    min-height:58px!important;
    max-height:58px!important;
  }
}

@media(max-width:380px){
  :root{
    --app-top-safe: calc(40px + env(safe-area-inset-top));
    --app-bottom-safe: calc(88px + env(safe-area-inset-bottom));
  }
}



/* ===== FIX RTL NAV ORDER + RIGHT SIDE MENU ===== */

/* Bottom nav must keep RTL visual order:
   الأعضاء on the right, المزيد on the left */
body > .mainNav,
body > .mainNav.glassSoft,
.mainNav,
.mainNav.glassSoft{
  direction:rtl!important;
}

.mainNav .navBtn{
  direction:rtl!important;
}

/* Menu drawer opens from right side, inside app bounds */
.drawerBackdrop{
  justify-content:flex-end!important;
  align-items:stretch!important;
  direction:rtl!important;
}

.sideDrawer{
  width:min(86vw,360px)!important;
  height:100%!important;
  max-height:100%!important;
  min-height:100%!important;
  border-radius:28px 0 0 28px!important;
  padding:22px!important;
  direction:rtl!important;
  overflow-y:auto!important;
}

.sideDrawer header{
  min-height:64px!important;
  margin-bottom:18px!important;
}

.sideDrawer header b{
  font-size:30px!important;
  line-height:1.15!important;
}

.sideDrawer header button{
  width:52px!important;
  height:52px!important;
  min-width:52px!important;
  min-height:52px!important;
  font-size:34px!important;
}

.sideDrawer>button{
  height:72px!important;
  min-height:72px!important;
  border-radius:22px!important;
  margin-bottom:12px!important;
  padding:0 18px!important;
  justify-content:flex-start!important;
  gap:16px!important;
}

.sideDrawer>button span{
  font-size:30px!important;
}

.sideDrawer>button b{
  font-size:20px!important;
  line-height:1.1!important;
}

@media(max-width:720px){
  .sideDrawer{
    width:min(84vw,340px)!important;
    padding:20px!important;
    border-radius:26px 0 0 26px!important;
  }

  .sideDrawer header{
    min-height:60px!important;
  }

  .sideDrawer header b{
    font-size:28px!important;
  }

  .sideDrawer header button{
    width:50px!important;
    height:50px!important;
    min-width:50px!important;
    min-height:50px!important;
    font-size:32px!important;
  }

  .sideDrawer>button{
    height:70px!important;
    min-height:70px!important;
    border-radius:20px!important;
  }

  .sideDrawer>button span{
    font-size:28px!important;
  }

  .sideDrawer>button b{
    font-size:19px!important;
  }
}

@media(max-width:380px){
  .sideDrawer{
    width:min(86vw,320px)!important;
    padding:18px!important;
  }

  .sideDrawer>button{
    height:66px!important;
    min-height:66px!important;
  }

  .sideDrawer>button b{
    font-size:17px!important;
  }
}



/* ===== HARD FIX: right menu full bounded height, no black shadow/footer ===== */
:root{
  --app-top-safe: calc(44px + env(safe-area-inset-top));
  --app-bottom-safe: calc(92px + env(safe-area-inset-bottom));
}

/* Backdrop occupies exactly app viewport between top status area and bottom nav */
.drawerBackdrop{
  position:fixed!important;
  top:var(--app-top-safe)!important;
  right:0!important;
  bottom:var(--app-bottom-safe)!important;
  left:0!important;
  width:100vw!important;
  height:calc(100dvh - var(--app-top-safe) - var(--app-bottom-safe))!important;
  min-height:calc(100dvh - var(--app-top-safe) - var(--app-bottom-safe))!important;
  max-height:calc(100dvh - var(--app-top-safe) - var(--app-bottom-safe))!important;
  inset:auto!important;
  margin:0!important;
  padding:0!important;
  display:flex!important;
  align-items:stretch!important;
  justify-content:flex-end!important;
  background:rgba(0,0,0,.28)!important;
  box-shadow:none!important;
  overflow:hidden!important;
  z-index:2147483599!important;
  direction:rtl!important;
}

/* Drawer must fill the whole bounded area, no short card, no bottom shadow */
.sideDrawer,
.drawerBackdrop .sideDrawer{
  position:relative!important;
  align-self:stretch!important;
  width:min(86vw,360px)!important;
  height:100%!important;
  min-height:100%!important;
  max-height:100%!important;
  margin:0!important;
  padding:22px!important;
  border-radius:28px 0 0 28px!important;
  overflow-y:auto!important;
  overflow-x:hidden!important;
  background:linear-gradient(135deg,rgba(73,83,101,.98),rgba(41,47,59,.98))!important;
  border:1px solid rgba(255,255,255,.16)!important;
  border-right:0!important;
  box-shadow:none!important;
  backdrop-filter:blur(24px) saturate(150%)!important;
  -webkit-backdrop-filter:blur(24px) saturate(150%)!important;
  direction:rtl!important;
}

/* Remove any pseudo/shadow leftovers from glass or panels */
.sideDrawer:before,
.sideDrawer:after,
.drawerBackdrop:before,
.drawerBackdrop:after{
  display:none!important;
  content:none!important;
  box-shadow:none!important;
  background:none!important;
}

.sideDrawer header{
  min-height:64px!important;
  margin:0 0 18px!important;
  display:flex!important;
  align-items:center!important;
  justify-content:space-between!important;
}

.sideDrawer header b{
  font-size:30px!important;
  line-height:1.15!important;
  font-weight:1000!important;
}

.sideDrawer header button{
  width:52px!important;
  height:52px!important;
  min-width:52px!important;
  min-height:52px!important;
  border-radius:999px!important;
  font-size:34px!important;
  display:flex!important;
  align-items:center!important;
  justify-content:center!important;
}

.sideDrawer>button{
  width:100%!important;
  height:72px!important;
  min-height:72px!important;
  max-height:72px!important;
  margin:0 0 12px!important;
  padding:0 18px!important;
  border-radius:22px!important;
  display:flex!important;
  align-items:center!important;
  justify-content:flex-start!important;
  gap:16px!important;
  text-align:right!important;
  box-shadow:none!important;
}

.sideDrawer>button span{
  font-size:30px!important;
}

.sideDrawer>button b{
  font-size:20px!important;
  line-height:1.1!important;
}

/* Make sure bottom nav remains above the backdrop only visually if needed */
.bottomNavPortalCurtain{
  z-index:2147483600!important;
}
.mainNav,
.mainNav.glassSoft{
  z-index:2147483601!important;
}

@media(max-width:720px){
  :root{
    --app-top-safe: calc(44px + env(safe-area-inset-top));
    --app-bottom-safe: calc(92px + env(safe-area-inset-bottom));
  }

  .drawerBackdrop{
    height:calc(100dvh - var(--app-top-safe) - var(--app-bottom-safe))!important;
    min-height:calc(100dvh - var(--app-top-safe) - var(--app-bottom-safe))!important;
    max-height:calc(100dvh - var(--app-top-safe) - var(--app-bottom-safe))!important;
  }

  .sideDrawer,
  .drawerBackdrop .sideDrawer{
    width:min(84vw,340px)!important;
    height:100%!important;
    min-height:100%!important;
    max-height:100%!important;
    padding:20px!important;
    border-radius:26px 0 0 26px!important;
  }
}

@media(max-width:380px){
  :root{
    --app-top-safe: calc(40px + env(safe-area-inset-top));
    --app-bottom-safe: calc(88px + env(safe-area-inset-bottom));
  }

  .sideDrawer,
  .drawerBackdrop .sideDrawer{
    width:min(86vw,320px)!important;
    padding:18px!important;
  }

  .sideDrawer>button{
    height:66px!important;
    min-height:66px!important;
    max-height:66px!important;
  }
}



/* ===== MENU ONLY RESET: compact drawer like the earlier app, keep all other fixes ===== */
/* This block intentionally touches ONLY the menu/drawer. */

.drawerBackdrop{
  position:fixed!important;
  top:var(--app-top-safe)!important;
  right:0!important;
  bottom:var(--app-bottom-safe)!important;
  left:0!important;
  width:100vw!important;
  height:auto!important;
  min-height:0!important;
  max-height:none!important;
  inset:auto 0 var(--app-bottom-safe) 0!important;
  margin:0!important;
  padding:10px 0 0 0!important;
  display:flex!important;
  align-items:flex-start!important;
  justify-content:flex-end!important;
  background:rgba(0,0,0,.18)!important;
  box-shadow:none!important;
  overflow:hidden!important;
  z-index:2147483599!important;
  direction:rtl!important;
}

.sideDrawer,
.drawerBackdrop .sideDrawer{
  position:relative!important;
  align-self:flex-start!important;
  width:min(78vw,330px)!important;
  height:auto!important;
  min-height:0!important;
  max-height:calc(100dvh - var(--app-top-safe) - var(--app-bottom-safe) - 22px)!important;
  margin:0!important;
  padding:18px!important;
  border-radius:24px 0 0 24px!important;
  overflow-y:auto!important;
  overflow-x:hidden!important;
  background:linear-gradient(135deg,rgba(72,82,100,.94),rgba(42,48,61,.94))!important;
  border:1px solid rgba(255,255,255,.16)!important;
  border-right:0!important;
  box-shadow:0 18px 42px rgba(0,0,0,.28)!important;
  backdrop-filter:blur(22px) saturate(150%)!important;
  -webkit-backdrop-filter:blur(22px) saturate(150%)!important;
  direction:rtl!important;
}

.sideDrawer:before,
.sideDrawer:after,
.drawerBackdrop:before,
.drawerBackdrop:after{
  display:none!important;
  content:none!important;
}

.sideDrawer header{
  min-height:46px!important;
  height:46px!important;
  margin:0 0 14px!important;
  display:flex!important;
  align-items:center!important;
  justify-content:space-between!important;
}

.sideDrawer header b{
  font-size:24px!important;
  line-height:1.15!important;
  font-weight:1000!important;
}

.sideDrawer header button{
  width:42px!important;
  height:42px!important;
  min-width:42px!important;
  min-height:42px!important;
  border-radius:999px!important;
  font-size:28px!important;
  display:flex!important;
  align-items:center!important;
  justify-content:center!important;
}

.sideDrawer>button{
  width:100%!important;
  height:58px!important;
  min-height:58px!important;
  max-height:58px!important;
  margin:0 0 10px!important;
  padding:0 14px!important;
  border-radius:18px!important;
  display:flex!important;
  align-items:center!important;
  justify-content:flex-start!important;
  gap:12px!important;
  text-align:right!important;
  box-shadow:none!important;
}

.sideDrawer>button span{
  font-size:24px!important;
}

.sideDrawer>button b{
  font-size:16px!important;
  line-height:1.1!important;
}

@media(max-width:720px){
  .drawerBackdrop{
    padding-top:8px!important;
  }

  .sideDrawer,
  .drawerBackdrop .sideDrawer{
    width:min(78vw,320px)!important;
    padding:16px!important;
    border-radius:22px 0 0 22px!important;
    max-height:calc(100dvh - var(--app-top-safe) - var(--app-bottom-safe) - 18px)!important;
  }

  .sideDrawer header{
    height:44px!important;
    min-height:44px!important;
    margin-bottom:12px!important;
  }

  .sideDrawer header b{
    font-size:23px!important;
  }

  .sideDrawer header button{
    width:40px!important;
    height:40px!important;
    min-width:40px!important;
    min-height:40px!important;
    font-size:26px!important;
  }

  .sideDrawer>button{
    height:56px!important;
    min-height:56px!important;
    max-height:56px!important;
    border-radius:17px!important;
  }

  .sideDrawer>button span{
    font-size:23px!important;
  }

  .sideDrawer>button b{
    font-size:15px!important;
  }
}

@media(max-width:380px){
  .sideDrawer,
  .drawerBackdrop .sideDrawer{
    width:min(80vw,300px)!important;
    padding:15px!important;
  }

  .sideDrawer>button{
    height:54px!important;
    min-height:54px!important;
    max-height:54px!important;
  }
}



/* ===== MENU EXACT REFERENCE STYLE - FIFA DARK THEME ONLY ===== */
/* Touches menu only: tall right drawer, large rows, same app dark/glass theme. */

.drawerBackdrop{
  position:fixed!important;
  top:var(--app-top-safe)!important;
  right:0!important;
  bottom:var(--app-bottom-safe)!important;
  left:0!important;
  width:100vw!important;
  height:auto!important;
  min-height:0!important;
  max-height:none!important;
  inset:auto 0 var(--app-bottom-safe) 0!important;
  margin:0!important;
  padding:0!important;
  display:flex!important;
  align-items:stretch!important;
  justify-content:flex-end!important;
  background:rgba(2,6,23,.48)!important;
  box-shadow:none!important;
  overflow:hidden!important;
  z-index:2147483599!important;
  direction:rtl!important;
  backdrop-filter:blur(2px)!important;
  -webkit-backdrop-filter:blur(2px)!important;
}

.sideDrawer,
.drawerBackdrop .sideDrawer{
  position:relative!important;
  align-self:stretch!important;
  width:min(82vw,390px)!important;
  height:100%!important;
  min-height:100%!important;
  max-height:100%!important;
  margin:0!important;
  padding:34px 18px 18px!important;
  border-radius:0!important;
  overflow-y:auto!important;
  overflow-x:hidden!important;
  background:linear-gradient(180deg,rgba(15,23,42,.98),rgba(8,13,28,.985))!important;
  border-left:1px solid rgba(255,255,255,.12)!important;
  border-top:0!important;
  border-bottom:0!important;
  border-right:0!important;
  box-shadow:-18px 0 40px rgba(0,0,0,.34)!important;
  backdrop-filter:blur(26px) saturate(150%)!important;
  -webkit-backdrop-filter:blur(26px) saturate(150%)!important;
  direction:rtl!important;
}

.sideDrawer:before{
  content:""!important;
  position:absolute!important;
  inset:0!important;
  pointer-events:none!important;
  background:
    radial-gradient(circle at 92% 8%,rgba(0,229,255,.16),transparent 30%),
    radial-gradient(circle at 0% 35%,rgba(139,92,246,.12),transparent 32%)!important;
  opacity:1!important;
}

.sideDrawer:after{
  display:none!important;
  content:none!important;
}

.sideDrawer header{
  position:relative!important;
  z-index:1!important;
  min-height:58px!important;
  height:58px!important;
  margin:0 0 24px!important;
  padding:0 8px!important;
  display:flex!important;
  align-items:center!important;
  justify-content:space-between!important;
}

.sideDrawer header b{
  font-size:34px!important;
  line-height:1.1!important;
  font-weight:1000!important;
  color:#f8fafc!important;
  letter-spacing:-.7px!important;
}

.sideDrawer header button{
  width:58px!important;
  height:58px!important;
  min-width:58px!important;
  min-height:58px!important;
  border-radius:999px!important;
  border:0!important;
  font-size:38px!important;
  line-height:1!important;
  display:flex!important;
  align-items:center!important;
  justify-content:center!important;
  background:rgba(255,255,255,.10)!important;
  color:#fff!important;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.12)!important;
}

.sideDrawer>button{
  position:relative!important;
  z-index:1!important;
  width:100%!important;
  height:72px!important;
  min-height:72px!important;
  max-height:72px!important;
  margin:0 0 12px!important;
  padding:0 18px!important;
  border-radius:18px!important;
  display:flex!important;
  align-items:center!important;
  justify-content:flex-start!important;
  gap:16px!important;
  text-align:right!important;
  direction:rtl!important;
  background:rgba(255,255,255,.075)!important;
  border:1px solid rgba(255,255,255,.10)!important;
  color:#f8fafc!important;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.10)!important;
}

.sideDrawer>button:active{
  transform:scale(.985)!important;
  background:rgba(0,229,255,.14)!important;
  border-color:rgba(0,229,255,.28)!important;
}

.sideDrawer>button span{
  width:42px!important;
  min-width:42px!important;
  height:42px!important;
  display:flex!important;
  align-items:center!important;
  justify-content:center!important;
  font-size:30px!important;
  line-height:1!important;
  filter:drop-shadow(0 8px 10px rgba(0,0,0,.30))!important;
}

.sideDrawer>button b{
  font-size:22px!important;
  line-height:1.12!important;
  font-weight:1000!important;
  color:#f8fafc!important;
  white-space:nowrap!important;
  overflow:hidden!important;
  text-overflow:ellipsis!important;
}

@media(max-width:720px){
  .sideDrawer,
  .drawerBackdrop .sideDrawer{
    width:82vw!important;
    max-width:390px!important;
    padding:30px 16px 16px!important;
  }

  .sideDrawer header{
    height:56px!important;
    min-height:56px!important;
    margin-bottom:22px!important;
  }

  .sideDrawer header b{
    font-size:32px!important;
  }

  .sideDrawer header button{
    width:56px!important;
    height:56px!important;
    min-width:56px!important;
    min-height:56px!important;
    font-size:36px!important;
  }

  .sideDrawer>button{
    height:70px!important;
    min-height:70px!important;
    max-height:70px!important;
    border-radius:17px!important;
    padding:0 16px!important;
    gap:14px!important;
  }

  .sideDrawer>button span{
    width:40px!important;
    min-width:40px!important;
    height:40px!important;
    font-size:28px!important;
  }

  .sideDrawer>button b{
    font-size:21px!important;
  }
}

@media(max-width:380px){
  .sideDrawer,
  .drawerBackdrop .sideDrawer{
    width:84vw!important;
    padding:26px 14px 14px!important;
  }

  .sideDrawer header b{
    font-size:29px!important;
  }

  .sideDrawer header button{
    width:52px!important;
    height:52px!important;
    min-width:52px!important;
    min-height:52px!important;
    font-size:34px!important;
  }

  .sideDrawer>button{
    height:66px!important;
    min-height:66px!important;
    max-height:66px!important;
    padding:0 14px!important;
  }

  .sideDrawer>button b{
    font-size:19px!important;
  }
}



/* ===== DEFINITIVE MENU FIX - isolated classes, no legacy drawer CSS can affect it ===== */
.fgMenuBackdrop{
  position:fixed!important;
  top:var(--app-top-safe)!important;
  right:0!important;
  bottom:var(--app-bottom-safe)!important;
  left:0!important;
  width:100vw!important;
  height:calc(100dvh - var(--app-top-safe) - var(--app-bottom-safe))!important;
  padding:0!important;
  margin:0!important;
  z-index:2147483599!important;
  display:flex!important;
  align-items:stretch!important;
  justify-content:flex-end!important;
  background:rgba(2,6,23,.42)!important;
  backdrop-filter:blur(2px)!important;
  -webkit-backdrop-filter:blur(2px)!important;
  overflow:hidden!important;
  direction:rtl!important;
}

.fgMenuPanel{
  width:min(82vw,390px)!important;
  height:100%!important;
  min-height:100%!important;
  max-height:100%!important;
  margin:0!important;
  padding:30px 18px 18px!important;
  border:0!important;
  border-left:1px solid rgba(255,255,255,.14)!important;
  border-radius:0!important;
  background:
    radial-gradient(circle at 88% 8%,rgba(0,229,255,.16),transparent 28%),
    radial-gradient(circle at 0% 42%,rgba(139,92,246,.12),transparent 30%),
    linear-gradient(180deg,rgba(15,23,42,.98),rgba(6,10,24,.99))!important;
  box-shadow:-18px 0 42px rgba(0,0,0,.34)!important;
  overflow-y:auto!important;
  overflow-x:hidden!important;
  direction:rtl!important;
  box-sizing:border-box!important;
  display:flex!important;
  flex-direction:column!important;
}

.fgMenuHeader{
  height:58px!important;
  min-height:58px!important;
  margin:0 0 22px!important;
  padding:0 6px!important;
  display:flex!important;
  align-items:center!important;
  justify-content:space-between!important;
  gap:12px!important;
}

.fgMenuHeader h2{
  margin:0!important;
  padding:0!important;
  color:#f8fafc!important;
  font-size:34px!important;
  line-height:1.05!important;
  font-weight:1000!important;
  letter-spacing:-.8px!important;
}

.fgMenuHeader button{
  width:56px!important;
  height:56px!important;
  min-width:56px!important;
  min-height:56px!important;
  border:0!important;
  border-radius:999px!important;
  background:rgba(255,255,255,.10)!important;
  color:#fff!important;
  font-size:36px!important;
  line-height:1!important;
  display:flex!important;
  align-items:center!important;
  justify-content:center!important;
  cursor:pointer!important;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.13)!important;
}

.fgMenuItems{
  display:grid!important;
  grid-template-columns:1fr!important;
  gap:12px!important;
  width:100%!important;
}

.fgMenuItem{
  width:100%!important;
  height:72px!important;
  min-height:72px!important;
  max-height:72px!important;
  margin:0!important;
  padding:0 18px!important;
  border-radius:18px!important;
  border:1px solid rgba(255,255,255,.10)!important;
  background:rgba(255,255,255,.075)!important;
  color:#f8fafc!important;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.10)!important;
  display:flex!important;
  align-items:center!important;
  justify-content:flex-start!important;
  gap:16px!important;
  direction:rtl!important;
  text-align:right!important;
  cursor:pointer!important;
  box-sizing:border-box!important;
}

.fgMenuItem:active{
  transform:scale(.985)!important;
  background:rgba(0,229,255,.14)!important;
  border-color:rgba(0,229,255,.28)!important;
}

.fgMenuIcon{
  width:42px!important;
  min-width:42px!important;
  height:42px!important;
  display:flex!important;
  align-items:center!important;
  justify-content:center!important;
  font-size:30px!important;
  line-height:1!important;
  filter:drop-shadow(0 8px 10px rgba(0,0,0,.30))!important;
}

.fgMenuItem b{
  min-width:0!important;
  color:#f8fafc!important;
  font-size:22px!important;
  line-height:1.1!important;
  font-weight:1000!important;
  white-space:nowrap!important;
  overflow:hidden!important;
  text-overflow:ellipsis!important;
}

@media(max-width:720px){
  .fgMenuPanel{
    width:82vw!important;
    max-width:390px!important;
    padding:28px 16px 16px!important;
  }

  .fgMenuHeader{
    height:56px!important;
    min-height:56px!important;
    margin-bottom:20px!important;
  }

  .fgMenuHeader h2{
    font-size:32px!important;
  }

  .fgMenuHeader button{
    width:54px!important;
    height:54px!important;
    min-width:54px!important;
    min-height:54px!important;
    font-size:34px!important;
  }

  .fgMenuItem{
    height:70px!important;
    min-height:70px!important;
    max-height:70px!important;
    padding:0 16px!important;
    border-radius:17px!important;
    gap:14px!important;
  }

  .fgMenuIcon{
    width:40px!important;
    min-width:40px!important;
    height:40px!important;
    font-size:28px!important;
  }

  .fgMenuItem b{
    font-size:21px!important;
  }
}

@media(max-width:380px){
  .fgMenuPanel{
    width:84vw!important;
    padding:24px 14px 14px!important;
  }

  .fgMenuHeader h2{
    font-size:29px!important;
  }

  .fgMenuHeader button{
    width:50px!important;
    height:50px!important;
    min-width:50px!important;
    min-height:50px!important;
    font-size:32px!important;
  }

  .fgMenuItem{
    height:66px!important;
    min-height:66px!important;
    max-height:66px!important;
    padding:0 14px!important;
  }

  .fgMenuItem b{
    font-size:19px!important;
  }
}



/* ===== PAGE CHANGE SCROLL RESET FIX ===== */
.app,
.app.iosSafeApp,
.iosSafeApp{
  overflow-anchor:none!important;
  scroll-behavior:auto!important;
}

.seasonCardsPage,
.membersHome,
.memberProfilePage,
.widePage{
  overflow-anchor:none!important;
}



/* ===== VERCEL IPHONE FINAL NAV LOCK ===== */
html,
body,
#root{
  height:100%!important;
  min-height:100%!important;
  overflow:hidden!important;
  background:#020617!important;
}

.forceBottomCurtain{
  display:block!important;
  visibility:visible!important;
  opacity:1!important;
  position:fixed!important;
  left:0!important;
  right:0!important;
  bottom:0!important;
  height:calc(92px + env(safe-area-inset-bottom))!important;
  background:#020617!important;
  z-index:2147483600!important;
  pointer-events:none!important;
}

.forceBottomNav{
  display:grid!important;
  visibility:visible!important;
  opacity:1!important;
  pointer-events:auto!important;
  position:fixed!important;
  left:50%!important;
  right:auto!important;
  bottom:calc(10px + env(safe-area-inset-bottom))!important;
  transform:translateX(-50%)!important;
  width:min(640px,calc(100vw - 18px))!important;
  max-width:640px!important;
  height:72px!important;
  min-height:72px!important;
  max-height:72px!important;
  z-index:2147483601!important;
  direction:rtl!important;
  box-sizing:border-box!important;
  isolation:isolate!important;
}

.forceBottomNav .navBtn{
  display:flex!important;
  visibility:visible!important;
  opacity:1!important;
  pointer-events:auto!important;
  height:58px!important;
  min-height:58px!important;
  max-height:58px!important;
}

/* Use JS-measured viewport fallback on iPhone/Vercel */
.app,
.app.iosSafeApp,
.iosSafeApp{
  position:fixed!important;
  top:var(--app-top-safe)!important;
  bottom:calc(92px + env(safe-area-inset-bottom))!important;
  height:auto!important;
  min-height:0!important;
  max-height:none!important;
  overflow-y:auto!important;
  overflow-x:hidden!important;
  -webkit-overflow-scrolling:touch!important;
}

@media(max-width:720px){
  .forceBottomCurtain{
    height:calc(92px + env(safe-area-inset-bottom))!important;
  }

  .forceBottomNav{
    width:calc(100vw - 18px)!important;
    max-width:430px!important;
    height:72px!important;
    min-height:72px!important;
    max-height:72px!important;
    bottom:calc(10px + env(safe-area-inset-bottom))!important;
  }

  .app,
  .app.iosSafeApp,
  .iosSafeApp{
    bottom:calc(92px + env(safe-area-inset-bottom))!important;
  }
}

@media(max-width:380px){
  .forceBottomCurtain{
    height:calc(88px + env(safe-area-inset-bottom))!important;
  }

  .forceBottomNav{
    height:70px!important;
    min-height:70px!important;
    max-height:70px!important;
  }

  .app,
  .app.iosSafeApp,
  .iosSafeApp{
    bottom:calc(88px + env(safe-area-inset-bottom))!important;
  }
}



/* ===== FINAL MENU DOES NOT DISTURB IPHONE/VERCEL VIEWPORT ===== */
/* Opening the menu must not recalculate or move app/nav bounds. */
html.fg-menu-open,
body.fg-menu-open{
  overflow:hidden!important;
  height:100%!important;
  min-height:100%!important;
  background:#020617!important;
}

/* Keep app bounds identical whether menu is open or closed */
html.fg-menu-open .app,
html.fg-menu-open .app.iosSafeApp,
html.fg-menu-open .iosSafeApp,
body.fg-menu-open .app,
body.fg-menu-open .app.iosSafeApp,
body.fg-menu-open .iosSafeApp{
  position:fixed!important;
  top:var(--app-top-safe)!important;
  bottom:calc(92px + env(safe-area-inset-bottom))!important;
  left:0!important;
  right:0!important;
  overflow-y:auto!important;
  overflow-x:hidden!important;
}

/* Keep bottom nav identical while menu is open */
html.fg-menu-open .forceBottomNav,
body.fg-menu-open .forceBottomNav,
html.fg-menu-open .mainNav,
body.fg-menu-open .mainNav{
  position:fixed!important;
  left:50%!important;
  bottom:calc(10px + env(safe-area-inset-bottom))!important;
  transform:translateX(-50%)!important;
  display:grid!important;
  visibility:visible!important;
  opacity:1!important;
  z-index:2147483601!important;
}

/* Menu remains inside app viewport, but never changes app viewport */
.fgMenuBackdrop{
  top:var(--app-top-safe)!important;
  bottom:calc(92px + env(safe-area-inset-bottom))!important;
  height:auto!important;
  max-height:none!important;
  overflow:hidden!important;
}

/* Medium menu typography */
.fgMenuHeader h2{
  font-size:28px!important;
}

.fgMenuItem b{
  font-size:18px!important;
}

.fgMenuIcon{
  font-size:26px!important;
}

@media(max-width:720px){
  html.fg-menu-open .app,
  html.fg-menu-open .app.iosSafeApp,
  html.fg-menu-open .iosSafeApp,
  body.fg-menu-open .app,
  body.fg-menu-open .app.iosSafeApp,
  body.fg-menu-open .iosSafeApp{
    bottom:calc(92px + env(safe-area-inset-bottom))!important;
  }

  .fgMenuBackdrop{
    bottom:calc(92px + env(safe-area-inset-bottom))!important;
  }

  .fgMenuHeader h2{
    font-size:27px!important;
  }

  .fgMenuItem b{
    font-size:17px!important;
  }

  .fgMenuIcon{
    font-size:25px!important;
  }
}

@media(max-width:380px){
  html.fg-menu-open .app,
  html.fg-menu-open .app.iosSafeApp,
  html.fg-menu-open .iosSafeApp,
  body.fg-menu-open .app,
  body.fg-menu-open .app.iosSafeApp,
  body.fg-menu-open .iosSafeApp{
    bottom:calc(88px + env(safe-area-inset-bottom))!important;
  }

  .fgMenuBackdrop{
    bottom:calc(88px + env(safe-area-inset-bottom))!important;
  }

  .fgMenuItem b{
    font-size:16px!important;
  }

  .fgMenuIcon{
    font-size:24px!important;
  }
}



/* ===== ABSOLUTE STABLE BOUNDS: no env() layout changes when menu opens ===== */
/* These variables are set once by JS and DO NOT change when menu opens. */
:root{
  --fg-top-bound:44px;
  --fg-bottom-bound:92px;
  --fg-nav-bottom:10px;
}

html,
body,
#root{
  width:100%!important;
  height:100%!important;
  min-height:100%!important;
  margin:0!important;
  padding:0!important;
  overflow:hidden!important;
  background:#020617!important;
}

/* The app scroll viewport is fixed between stable top and bottom bounds. */
.app,
.app.iosSafeApp,
.iosSafeApp{
  position:fixed!important;
  top:var(--fg-top-bound)!important;
  bottom:var(--fg-bottom-bound)!important;
  left:0!important;
  right:0!important;
  width:100%!important;
  height:auto!important;
  min-height:0!important;
  max-height:none!important;
  padding:0 8px 10px!important;
  overflow-x:hidden!important;
  overflow-y:auto!important;
  -webkit-overflow-scrolling:touch!important;
  overscroll-behavior-y:contain!important;
  background:#020617!important;
  z-index:1!important;
  scroll-behavior:auto!important;
}

/* Bottom bar is always outside app scroll viewport. */
.forceBottomCurtain,
.bottomNavPortalCurtain{
  display:block!important;
  visibility:visible!important;
  opacity:1!important;
  position:fixed!important;
  left:0!important;
  right:0!important;
  bottom:0!important;
  height:var(--fg-bottom-bound)!important;
  background:#020617!important;
  z-index:2147483600!important;
  pointer-events:none!important;
}

.forceBottomNav,
.mainNav,
.mainNav.glassSoft{
  display:grid!important;
  visibility:visible!important;
  opacity:1!important;
  pointer-events:auto!important;
  position:fixed!important;
  left:50%!important;
  right:auto!important;
  bottom:var(--fg-nav-bottom)!important;
  transform:translateX(-50%)!important;
  width:calc(100vw - 18px)!important;
  max-width:430px!important;
  height:72px!important;
  min-height:72px!important;
  max-height:72px!important;
  margin:0!important;
  padding:7px!important;
  grid-template-columns:repeat(5,minmax(0,1fr))!important;
  gap:5px!important;
  border-radius:26px!important;
  overflow:hidden!important;
  background:linear-gradient(180deg,#081126,#050a17)!important;
  border:1px solid rgba(255,255,255,.14)!important;
  box-shadow:0 -8px 28px rgba(0,0,0,.32),0 18px 60px rgba(0,0,0,.58),inset 0 1px 0 rgba(255,255,255,.14)!important;
  z-index:2147483601!important;
  direction:rtl!important;
  box-sizing:border-box!important;
  isolation:isolate!important;
}

.forceBottomNav .navBtn,
.mainNav .navBtn,
.navBtn{
  height:58px!important;
  min-height:58px!important;
  max-height:58px!important;
  display:flex!important;
  visibility:visible!important;
  opacity:1!important;
  pointer-events:auto!important;
}

/* Menu also uses the SAME stable bounds and cannot affect app/nav layout. */
.fgMenuBackdrop{
  position:fixed!important;
  top:var(--fg-top-bound)!important;
  right:0!important;
  bottom:var(--fg-bottom-bound)!important;
  left:0!important;
  width:100vw!important;
  height:auto!important;
  margin:0!important;
  padding:0!important;
  display:flex!important;
  align-items:stretch!important;
  justify-content:flex-end!important;
  background:rgba(2,6,23,.42)!important;
  backdrop-filter:blur(2px)!important;
  -webkit-backdrop-filter:blur(2px)!important;
  overflow:hidden!important;
  z-index:2147483599!important;
  direction:rtl!important;
}

.fgMenuPanel{
  width:82vw!important;
  max-width:390px!important;
  height:100%!important;
  min-height:100%!important;
  max-height:100%!important;
  margin:0!important;
  padding:28px 16px 16px!important;
  border:0!important;
  border-left:1px solid rgba(255,255,255,.14)!important;
  border-radius:0!important;
  background:
    radial-gradient(circle at 88% 8%,rgba(0,229,255,.16),transparent 28%),
    radial-gradient(circle at 0% 42%,rgba(139,92,246,.12),transparent 30%),
    linear-gradient(180deg,rgba(15,23,42,.98),rgba(6,10,24,.99))!important;
  box-shadow:-18px 0 42px rgba(0,0,0,.34)!important;
  overflow-y:auto!important;
  overflow-x:hidden!important;
  direction:rtl!important;
  box-sizing:border-box!important;
  display:flex!important;
  flex-direction:column!important;
}

/* Medium menu text */
.fgMenuHeader h2{
  font-size:27px!important;
}
.fgMenuItem b{
  font-size:17px!important;
}
.fgMenuIcon{
  font-size:25px!important;
}

.topStatusCurtain,
.bottomNavCurtain{
  display:none!important;
}

.mainHero{
  position:relative!important;
  top:auto!important;
  left:auto!important;
  transform:none!important;
  width:100%!important;
  margin:0 auto 14px!important;
  z-index:1!important;
}

.widePage,
.membersHome,
.memberProfilePage,
.seasonCardsPage{
  min-height:auto!important;
  margin-top:0!important;
  margin-bottom:0!important;
  overflow-anchor:none!important;
}

@media(min-width:721px){
  .app,
  .app.iosSafeApp,
  .iosSafeApp{
    padding-left:14px!important;
    padding-right:14px!important;
  }

  .forceBottomNav,
  .mainNav,
  .mainNav.glassSoft{
    width:min(640px,calc(100vw - 18px))!important;
    max-width:640px!important;
  }
}

@media(max-width:380px){
  :root{
    --fg-top-bound:40px;
    --fg-bottom-bound:88px;
  }

  .forceBottomNav,
  .mainNav,
  .mainNav.glassSoft{
    height:70px!important;
    min-height:70px!important;
    max-height:70px!important;
  }

  .fgMenuPanel{
    width:84vw!important;
    padding:24px 14px 14px!important;
  }

  .fgMenuItem b{
    font-size:16px!important;
  }

  .fgMenuIcon{
    font-size:24px!important;
  }
}


/* ===== TOP SYSTEM BACK BUTTON: fixed header-level back, no in-content back ===== */
.topSystemPortalBar{
  pointer-events:auto!important;
  display:flex!important;
  align-items:flex-end!important;
  justify-content:center!important;
  padding:env(safe-area-inset-top) 12px 6px!important;
  height:var(--app-top-safe)!important;
  background:linear-gradient(180deg,#020617 0%,rgba(2,6,23,.96) 72%,rgba(2,6,23,.86) 100%)!important;
  border-bottom:1px solid rgba(255,255,255,.06)!important;
  box-shadow:0 10px 30px rgba(0,0,0,.20)!important;
}

.topSystemInner{
  width:min(640px,100%)!important;
  height:36px!important;
  display:grid!important;
  grid-template-columns:42px minmax(0,1fr) 42px!important;
  align-items:center!important;
  gap:8px!important;
  direction:rtl!important;
}

.topSystemBackBtn,
.topSystemBackSpacer{
  width:38px!important;
  height:38px!important;
  border-radius:999px!important;
  display:flex!important;
  align-items:center!important;
  justify-content:center!important;
}

.topSystemBackBtn{
  border:1px solid rgba(255,255,255,.16)!important;
  background:linear-gradient(135deg,rgba(255,255,255,.14),rgba(255,255,255,.06))!important;
  color:#ecfeff!important;
  box-shadow:0 12px 28px rgba(0,0,0,.28),inset 0 1px 0 rgba(255,255,255,.16)!important;
  backdrop-filter:blur(18px)!important;
  -webkit-backdrop-filter:blur(18px)!important;
  cursor:pointer!important;
  padding:0!important;
  -webkit-appearance:none!important;
  appearance:none!important;
}

.topSystemBackBtn span{
  display:block!important;
  font-size:34px!important;
  line-height:30px!important;
  font-weight:900!important;
  transform:translateY(-1px)!important;
}

.topSystemBackBtn:active{
  transform:scale(.94)!important;
}

.topSystemTitle{
  min-width:0!important;
  text-align:center!important;
  color:#f8fafc!important;
  font-size:13px!important;
  font-weight:1000!important;
  letter-spacing:1.6px!important;
  white-space:nowrap!important;
  overflow:hidden!important;
  text-overflow:ellipsis!important;
  opacity:.92!important;
}

/* Remove old in-page detail back buttons. Back now lives in the top system bar. */
.floatingBackBtn,
.backToMembersBtn{
  display:none!important;
}

@media(max-width:720px){
  .topSystemPortalBar{
    padding-left:10px!important;
    padding-right:10px!important;
    padding-bottom:6px!important;
  }

  .topSystemInner{
    height:34px!important;
    grid-template-columns:40px minmax(0,1fr) 40px!important;
  }

  .topSystemBackBtn,
  .topSystemBackSpacer{
    width:36px!important;
    height:36px!important;
  }

  .topSystemBackBtn span{
    font-size:32px!important;
    line-height:28px!important;
  }
}


/* ===== SAFE FIX: top bar title only, no back icon ===== */
.topSystemInner.titleOnly,
.topSystemInner{
  grid-template-columns:minmax(0,1fr)!important;
  justify-items:center!important;
}
.topSystemBackBtn,
.topSystemBackSpacer{
  display:none!important;
}
.topSystemTitle{
  grid-column:1!important;
  width:100%!important;
  text-align:center!important;
}

/* ===== FINAL FIX: native system title typography ===== */
.topSystemTitle{
  font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",system-ui,sans-serif!important;
  font-size:15px!important;
  font-weight:700!important;
  letter-spacing:0!important;
  line-height:1.15!important;
}
@media(max-width:720px){
  .topSystemTitle{
    font-size:15px!important;
    font-weight:700!important;
    letter-spacing:0!important;
  }
}



/* ===== SAFE GRADIENT BARS - NO SIZE CHANGE ===== */
.topSystemPortalBar{
  background:
    linear-gradient(180deg,
      rgba(2,6,23,.96) 0%,
      rgba(5,11,25,.86) 58%,
      rgba(5,11,25,.54) 82%,
      rgba(5,11,25,0) 100%)!important;
  box-shadow:none!important;
}
.topSystemPortalBar::before{
  content:"";
  position:absolute;
  inset:0;
  pointer-events:none;
  background:
    radial-gradient(circle at 18% 0%,rgba(0,229,255,.13),transparent 34%),
    radial-gradient(circle at 82% 0%,rgba(139,92,246,.12),transparent 36%);
  opacity:.9;
}
.topSystemInner{
  background:linear-gradient(135deg,rgba(255,255,255,.075),rgba(255,255,255,.025))!important;
  border-color:rgba(255,255,255,.105)!important;
  box-shadow:none!important;
}
.bottomNavPortalCurtain,
.forceBottomCurtain{
  height:calc(92px + env(safe-area-inset-bottom))!important;
  background:
    radial-gradient(circle at 18% 100%,rgba(0,229,255,.12),transparent 36%),
    radial-gradient(circle at 82% 100%,rgba(139,92,246,.11),transparent 34%),
    linear-gradient(0deg,
      rgba(2,6,23,.97) 0%,
      rgba(5,11,25,.86) 52%,
      rgba(5,11,25,.48) 78%,
      rgba(5,11,25,0) 100%)!important;
  backdrop-filter:blur(14px)!important;
  -webkit-backdrop-filter:blur(14px)!important;
  box-shadow:none!important;
}
.mainNav.forceBottomNav,
.forceBottomNav{
  height:72px!important;
  min-height:72px!important;
  max-height:72px!important;
  background:
    radial-gradient(circle at 18% 0%,rgba(0,229,255,.12),transparent 34%),
    radial-gradient(circle at 82% 100%,rgba(139,92,246,.10),transparent 36%),
    linear-gradient(180deg,rgba(13,23,43,.88),rgba(4,9,20,.78))!important;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.15)!important;
}
@media(max-width:720px){
  .mainNav.forceBottomNav,
  .forceBottomNav{
    height:88px!important;
    min-height:88px!important;
    max-height:88px!important;
  }
}

/* ===== FINAL TOP BAR SOLID COLOR + SCROLL EFFECT (NO GRADIENT, NO SIZE CHANGE) ===== */
.topSystemPortalBar{
  background:rgba(8,12,22,.72)!important;
  background-image:none!important;
  backdrop-filter:blur(16px) saturate(140%)!important;
  -webkit-backdrop-filter:blur(16px) saturate(140%)!important;
  border-bottom:1px solid rgba(255,255,255,.055)!important;
  box-shadow:none!important;
  transition:background-color .22s ease,border-color .22s ease,backdrop-filter .22s ease!important;
}
.topSystemPortalBar.scrolled{
  background:rgba(8,12,22,.92)!important;
  border-bottom-color:rgba(255,255,255,.10)!important;
  backdrop-filter:blur(20px) saturate(150%)!important;
  -webkit-backdrop-filter:blur(20px) saturate(150%)!important;
}
.topSystemPortalBar::before{
  display:none!important;
  content:none!important;
}
.topSystemInner{
  background:transparent!important;
  border:0!important;
  box-shadow:none!important;
}

/* ===== PREMIUM LIQUID GLASS BARS — FINAL SAFE OVERRIDE ===== */
/* Same sizes, same logic, only visual treatment for top and bottom bars. */

.topSystemPortalBar{
  background:
    linear-gradient(135deg, rgba(255,255,255,.145), rgba(255,255,255,.055)) !important;
  background-color:rgba(7,11,22,.42)!important;
  backdrop-filter:blur(28px) saturate(175%) brightness(1.08)!important;
  -webkit-backdrop-filter:blur(28px) saturate(175%) brightness(1.08)!important;
  border-bottom:1px solid rgba(255,255,255,.16)!important;
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.30),
    inset 0 -1px 0 rgba(255,255,255,.055),
    0 10px 34px rgba(0,0,0,.20) !important;
  transition:background-color .22s ease, border-color .22s ease, backdrop-filter .22s ease!important;
}
.topSystemPortalBar.scrolled{
  background:
    linear-gradient(135deg, rgba(255,255,255,.16), rgba(255,255,255,.065)) !important;
  background-color:rgba(7,11,22,.56)!important;
  border-bottom-color:rgba(255,255,255,.19)!important;
  backdrop-filter:blur(30px) saturate(185%) brightness(1.08)!important;
  -webkit-backdrop-filter:blur(30px) saturate(185%) brightness(1.08)!important;
}
.topSystemPortalBar::before{
  display:none!important;
  content:none!important;
}
.topSystemInner{
  background:transparent!important;
  border:0!important;
  box-shadow:none!important;
}
.topSystemTitle{
  color:rgba(255,255,255,.96)!important;
  text-shadow:0 1px 14px rgba(0,0,0,.28)!important;
  font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important;
}

/* The curtain stays invisible-to-soft, so it does not enlarge the nav visually. */
.bottomNavPortalCurtain,
.forceBottomCurtain{
  background:
    linear-gradient(
      to top,
      rgba(2,6,23,.50) 0%,
      rgba(2,6,23,.30) 44%,
      rgba(2,6,23,.10) 72%,
      rgba(2,6,23,0) 100%
    )!important;
  backdrop-filter:blur(10px) saturate(130%)!important;
  -webkit-backdrop-filter:blur(10px) saturate(130%)!important;
  box-shadow:none!important;
}

/* Keep exact nav dimensions from the stable version; only replace material. */
.mainNav,
.forceBottomNav{
  background:
    linear-gradient(135deg, rgba(255,255,255,.16), rgba(255,255,255,.055))!important;
  background-color:rgba(7,11,22,.46)!important;
  backdrop-filter:blur(30px) saturate(185%) brightness(1.08)!important;
  -webkit-backdrop-filter:blur(30px) saturate(185%) brightness(1.08)!important;
  border:1px solid rgba(255,255,255,.20)!important;
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.32),
    inset 0 -1px 0 rgba(255,255,255,.06),
    0 18px 46px rgba(0,0,0,.30)!important;
}

.mainNav .navBtn{
  background:rgba(255,255,255,.035)!important;
  border:1px solid rgba(255,255,255,.055)!important;
}
.mainNav .navBtn.active{
  background:
    linear-gradient(135deg, rgba(0,229,255,.34), rgba(47,140,255,.24))!important;
  border-color:rgba(255,255,255,.28)!important;
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.28),
    0 8px 22px rgba(0,229,255,.10)!important;
}


/* ===== ABSOLUTE FINAL: NO-STROKE LIQUID GLASS BARS ===== */
/* Visual-only override. It does not touch navigation, history, data, or layout sizes. */

.topSystemPortalBar,
.topSystemPortalBar.scrolled{
  background:transparent!important;
  background-color:transparent!important;
  border:0!important;
  border-bottom:0!important;
  outline:0!important;
  box-shadow:none!important;
  backdrop-filter:none!important;
  -webkit-backdrop-filter:none!important;
  padding:env(safe-area-inset-top) 12px 6px!important;
  height:var(--app-top-safe)!important;
  display:flex!important;
  align-items:flex-end!important;
  justify-content:center!important;
  pointer-events:auto!important;
}

.topSystemPortalBar::before,
.topSystemPortalBar::after{
  content:none!important;
  display:none!important;
}

.topSystemInner,
.topSystemInner.titleOnly{
  width:min(640px,calc(100vw - 24px))!important;
  height:36px!important;
  border-radius:999px!important;
  display:grid!important;
  grid-template-columns:minmax(0,1fr)!important;
  place-items:center!important;
  padding:0 18px!important;
  overflow:hidden!important;
  direction:rtl!important;

  background:
    radial-gradient(circle at 16% 12%,rgba(255,255,255,.28),transparent 30%),
    radial-gradient(circle at 78% 0%,rgba(0,229,255,.16),transparent 34%),
    linear-gradient(135deg,rgba(255,255,255,.18),rgba(255,255,255,.065))!important;
  background-color:rgba(8,12,24,.34)!important;
  backdrop-filter:blur(30px) saturate(180%) brightness(1.10)!important;
  -webkit-backdrop-filter:blur(30px) saturate(180%) brightness(1.10)!important;
  border:0!important;
  outline:0!important;
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.30),
    inset 0 -1px 0 rgba(255,255,255,.045),
    0 12px 30px rgba(0,0,0,.22)!important;
}

.topSystemTitle{
  width:100%!important;
  min-width:0!important;
  text-align:center!important;
  color:rgba(255,255,255,.96)!important;
  font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",system-ui,sans-serif!important;
  font-size:15px!important;
  font-weight:700!important;
  letter-spacing:0!important;
  line-height:1.15!important;
  white-space:nowrap!important;
  overflow:hidden!important;
  text-overflow:ellipsis!important;
  text-shadow:0 1px 12px rgba(0,0,0,.30)!important;
}

body > .mainNav.glassSoft,
.mainNav.glassSoft,
.mainNav,
.forceBottomNav{
  background:
    radial-gradient(circle at 18% 10%,rgba(255,255,255,.24),transparent 30%),
    radial-gradient(circle at 78% 0%,rgba(0,229,255,.14),transparent 34%),
    linear-gradient(135deg,rgba(255,255,255,.17),rgba(255,255,255,.055))!important;
  background-color:rgba(8,12,24,.38)!important;
  backdrop-filter:blur(30px) saturate(185%) brightness(1.08)!important;
  -webkit-backdrop-filter:blur(30px) saturate(185%) brightness(1.08)!important;
  border:0!important;
  outline:0!important;
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,.30),
    inset 0 -1px 0 rgba(255,255,255,.05),
    0 16px 44px rgba(0,0,0,.30)!important;
}

.bottomNavPortalCurtain,
.forceBottomCurtain{
  background:linear-gradient(to top,rgba(2,6,23,.36),rgba(2,6,23,.16) 46%,rgba(2,6,23,0))!important;
  backdrop-filter:blur(8px) saturate(120%)!important;
  -webkit-backdrop-filter:blur(8px) saturate(120%)!important;
  box-shadow:none!important;
}

.mainNav .navBtn{
  background:rgba(255,255,255,.025)!important;
  border:0!important;
  box-shadow:none!important;
}

.mainNav .navBtn.active{
  background:linear-gradient(135deg,rgba(0,229,255,.28),rgba(47,140,255,.20))!important;
  border:0!important;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.22),0 8px 22px rgba(0,229,255,.10)!important;
}

@media(max-width:720px){
  .topSystemInner,
  .topSystemInner.titleOnly{
    width:calc(100vw - 22px)!important;
    height:36px!important;
    padding:0 16px!important;
  }
  .topSystemTitle{
    font-size:15px!important;
  }
}


/* ===== FINAL TOP BAR CLEAN RESET: no visual style, keep title only ===== */
.topSystemPortalBar,
.topSystemPortalBar.scrolled{
  background:transparent!important;
  background-color:transparent!important;
  border:0!important;
  border-bottom:0!important;
  outline:0!important;
  box-shadow:none!important;
  backdrop-filter:none!important;
  -webkit-backdrop-filter:none!important;
}

.topSystemPortalBar::before,
.topSystemPortalBar::after,
.topSystemInner::before,
.topSystemInner::after{
  content:none!important;
  display:none!important;
}

.topSystemInner,
.topSystemInner.titleOnly{
  background:transparent!important;
  background-color:transparent!important;
  backdrop-filter:none!important;
  -webkit-backdrop-filter:none!important;
  border:0!important;
  outline:0!important;
  box-shadow:none!important;
}

.topSystemTitle{
  font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",system-ui,sans-serif!important;
  color:#f8fafc!important;
  text-shadow:none!important;
}


/* ===== 2026-04 SAFE FIX: tabs scrollbar, compact stat icons, configurable stat icons ===== */
.tabs{
  scrollbar-width:none!important;
  -ms-overflow-style:none!important;
  padding-bottom:0!important;
  margin-bottom:14px!important;
}
.tabs::-webkit-scrollbar{
  display:none!important;
  width:0!important;
  height:0!important;
}
.memberProfilePage .tabs,
.widePage .tabs{
  overflow-y:hidden!important;
}
.memberMainStats .statCard{
  display:grid!important;
  grid-template-rows:auto auto auto!important;
  place-items:center!important;
  align-content:center!important;
  gap:4px!important;
  padding-top:10px!important;
  padding-bottom:10px!important;
}
.memberMainStats .statIcon,
.statCard .statIcon{
  display:flex!important;
  align-items:center!important;
  justify-content:center!important;
  width:100%!important;
  height:28px!important;
  min-height:28px!important;
  font-size:25px!important;
  line-height:1!important;
  margin:0!important;
}
.memberMainStats .statCard b{
  margin:0!important;
  line-height:.96!important;
}
.memberMainStats .statCard small{
  margin:0!important;
  line-height:1.12!important;
}
.smartIconImg{
  width:28px!important;
  height:28px!important;
  object-fit:contain!important;
  display:block!important;
  filter:drop-shadow(0 6px 10px rgba(0,0,0,.28));
}
@media(max-width:720px){
  .memberMainStats .statCard{
    height:108px!important;
    min-height:108px!important;
    gap:3px!important;
    padding-top:8px!important;
    padding-bottom:8px!important;
  }
  .memberMainStats .statIcon,
  .statCard .statIcon{
    height:25px!important;
    min-height:25px!important;
    font-size:23px!important;
  }
  .smartIconImg{
    width:25px!important;
    height:25px!important;
  }
}



/* ===== SETTINGS-CONTROLLED ICONS: image or emoji, app-wide ===== */
.navIcon .smartIconImg,
.fgMenuIcon .smartIconImg{
  width:1.35em!important;
  height:1.35em!important;
  object-fit:contain!important;
  display:block!important;
}
.statIcon .smartIconImg{
  width:34px!important;
  height:34px!important;
  object-fit:contain!important;
  display:block!important;
  margin:0 auto!important;
}
.chips .smartIconImg,
.seasonMemberCard em .smartIconImg,
.archiveModeTabs button .smartIconImg,
.seasonSimpleRow span .smartIconImg,
.rankingInlineStats .smartIconImg,
.transferBadges .smartIconImg,
.linkTile span .smartIconImg{
  width:1.15em!important;
  height:1.15em!important;
  object-fit:contain!important;
  display:inline-block!important;
  vertical-align:-0.18em!important;
  margin-inline-end:3px!important;
}

/* ===== FINAL FIX: CONSISTENT FLAT TOP BAR BACKGROUND ===== */
/* The top bar must never inherit page/card gradients while scrolling or on subpages. */
.topSystemPortalBar,
.topSystemPortalBar.scrolled{
  background:#020617!important;
  background-color:#020617!important;
  background-image:none!important;
  border:0!important;
  border-bottom:0!important;
  outline:0!important;
  box-shadow:none!important;
  backdrop-filter:none!important;
  -webkit-backdrop-filter:none!important;
}

.topSystemPortalBar::before,
.topSystemPortalBar::after{
  content:none!important;
  display:none!important;
}

.topSystemInner,
.topSystemInner.titleOnly{
  background:transparent!important;
  background-color:transparent!important;
  background-image:none!important;
  border:0!important;
  outline:0!important;
  box-shadow:none!important;
  backdrop-filter:none!important;
  -webkit-backdrop-filter:none!important;
}

.topSystemTitle{
  color:#f8fafc!important;
  text-shadow:none!important;
}



/* ===== FINAL BACK-STABILITY FIX: prevent iOS return shake ===== */
html, body, #root {
  height: 100% !important;
  overflow: hidden !important;
  overscroll-behavior: none !important;
}
.app {
  overflow-y: auto !important;
  overflow-x: hidden !important;
  -webkit-overflow-scrolling: touch !important;
  overscroll-behavior-y: contain !important;
  scroll-behavior: auto !important;
}

/* ===== PREMIUM MOTION PACK: safe UI motion only, no layout changes ===== */
:root{
  --fg-motion-fast: 140ms;
  --fg-motion-normal: 240ms;
  --fg-motion-slow: 360ms;
  --fg-ease-out: cubic-bezier(.2,.9,.2,1);
  --fg-ease-soft: cubic-bezier(.16,1,.3,1);
}

/* Page entrance: light, native-app feel */
.membersHome,
.memberProfilePage,
.widePage,
.mainHero,
.announcement{
  animation: fgPageEnter var(--fg-motion-slow) var(--fg-ease-soft) both;
  will-change: transform, opacity;
}

@keyframes fgPageEnter{
  from{
    opacity:0;
    transform:translate3d(0,10px,0) scale(.992);
    filter:saturate(.92);
  }
  to{
    opacity:1;
    transform:translate3d(0,0,0) scale(1);
    filter:saturate(1);
  }
}

/* Cards stagger illusion: subtle and safe */
.seasonMemberCard,
.playerCard,
.trophyCard,
.seasonSimpleRow,
.archiveTrophyRow,
.archiveMemberCard,
.archiveSeasonCard,
.rankingCard,
.financeCard,
.transferCard,
.tournamentRecordCard,
.finalsCard,
.linkTile,
.statCard{
  animation: fgCardRise var(--fg-motion-slow) var(--fg-ease-soft) both;
  transform-origin:center;
  transition:
    transform var(--fg-motion-fast) var(--fg-ease-out),
    box-shadow var(--fg-motion-normal) ease,
    border-color var(--fg-motion-normal) ease,
    background var(--fg-motion-normal) ease,
    opacity var(--fg-motion-normal) ease;
  will-change: transform;
}

@keyframes fgCardRise{
  from{
    opacity:.001;
    transform:translate3d(0,8px,0) scale(.985);
  }
  to{
    opacity:1;
    transform:translate3d(0,0,0) scale(1);
  }
}

/* Touch feedback: premium but restrained */
button,
a,
.navBtn,
.tabBtn,
.fgMenuItem,
.seasonMemberCard,
.trophyCard,
.seasonSimpleRow,
.archiveTrophyRow,
.archiveMemberCard,
.rankingCard,
.tournamentRecordCard,
.finalsCard,
.linkTile,
.statCard.clickable{
  -webkit-tap-highlight-color:transparent;
  touch-action:manipulation;
  transition:
    transform var(--fg-motion-fast) var(--fg-ease-out),
    opacity var(--fg-motion-fast) ease,
    background var(--fg-motion-normal) ease,
    box-shadow var(--fg-motion-normal) ease,
    border-color var(--fg-motion-normal) ease;
}

button:active,
a:active,
.navBtn:active,
.tabBtn:active,
.fgMenuItem:active,
.seasonMemberCard:active,
.trophyCard:active,
.seasonSimpleRow:active,
.archiveTrophyRow:active,
.archiveMemberCard:active,
.rankingCard:active,
.tournamentRecordCard:active,
.finalsCard:active,
.linkTile:active,
.statCard.clickable:active{
  transform:scale(.975);
  opacity:.92;
}

/* Bottom navigation active feel */
.navBtn{
  position:relative;
  overflow:hidden;
}

.navBtn::after{
  content:"";
  position:absolute;
  left:50%;
  bottom:5px;
  width:18px;
  height:3px;
  border-radius:999px;
  background:linear-gradient(90deg,var(--cyan),var(--blue));
  transform:translateX(-50%) scaleX(0);
  opacity:0;
  transition:
    transform var(--fg-motion-normal) var(--fg-ease-soft),
    opacity var(--fg-motion-normal) ease;
  pointer-events:none;
}

.navBtn.active::after{
  transform:translateX(-50%) scaleX(1);
  opacity:.95;
}

.navBtn.active .navIcon,
.navBtn.active img{
  animation: fgNavPop 360ms var(--fg-ease-soft) both;
}

@keyframes fgNavPop{
  0%{transform:translateY(1px) scale(.94)}
  58%{transform:translateY(-1px) scale(1.08)}
  100%{transform:translateY(0) scale(1)}
}

/* Tabs feel sharper */
.tabBtn.active{
  animation: fgTabSelect 260ms var(--fg-ease-soft) both;
}

@keyframes fgTabSelect{
  from{transform:scale(.96);filter:saturate(.8)}
  to{transform:scale(1);filter:saturate(1)}
}

/* Drawer / modal entrance */
.fgMenuBackdrop,
.drawerBackdrop{
  animation: fgBackdropIn 220ms ease both;
}

.fgMenuPanel{
  animation: fgDrawerIn 320ms var(--fg-ease-soft) both;
  transform-origin:right center;
}

.infoModal{
  animation: fgModalIn 280ms var(--fg-ease-soft) both;
  transform-origin:center;
}

@keyframes fgBackdropIn{
  from{opacity:0}
  to{opacity:1}
}

@keyframes fgDrawerIn{
  from{
    opacity:.001;
    transform:translate3d(18px,0,0) scale(.985);
  }
  to{
    opacity:1;
    transform:translate3d(0,0,0) scale(1);
  }
}

@keyframes fgModalIn{
  from{
    opacity:.001;
    transform:translate3d(0,14px,0) scale(.97);
  }
  to{
    opacity:1;
    transform:translate3d(0,0,0) scale(1);
  }
}

/* Inputs feel responsive without changing layout */
input{
  transition:
    border-color var(--fg-motion-normal) ease,
    box-shadow var(--fg-motion-normal) ease,
    background var(--fg-motion-normal) ease;
}

input:focus{
  border-color:rgba(0,229,255,.38)!important;
  box-shadow:0 0 0 3px rgba(0,229,255,.08)!important;
}

/* Respect accessibility and reduce battery work */
@media (prefers-reduced-motion: reduce){
  *,
  *::before,
  *::after{
    animation-duration:.01ms!important;
    animation-iteration-count:1!important;
    scroll-behavior:auto!important;
    transition-duration:.01ms!important;
  }
}


/* ===== FINAL COVER SIZE FIX - source of truth from settings ===== */
.mainHero,
.mainHero.glass,
.mainHero.hasCoverImage{
  height:var(--fg-cover-height,118px)!important;
  min-height:0!important;
  max-height:var(--fg-cover-height,118px)!important;
  padding:14px 18px!important;
  margin:0 auto 10px!important;
  align-items:center!important;
}
.mainHero.hasCoverImage{
  padding:0!important;
}
.coverContent{
  height:100%!important;
  min-height:0!important;
  align-items:center!important;
}
.mainHero h1{
  font-size:clamp(24px,4vw,34px)!important;
  line-height:1!important;
  margin:3px 0 2px!important;
}
.mainHero p{
  font-size:15px!important;
  line-height:1.1!important;
}
.heroKicker{
  font-size:10px!important;
  line-height:1!important;
}
.coverIconBox{
  width:58px!important;
  height:58px!important;
  border-radius:18px!important;
  flex:0 0 auto!important;
}
@media(max-width:720px){
  .mainHero,
  .mainHero.glass,
  .mainHero.hasCoverImage{
    height:var(--fg-cover-height-mobile,50px)!important;
    min-height:0!important;
    max-height:var(--fg-cover-height-mobile,50px)!important;
    padding:6px 10px!important;
    margin:0 auto 8px!important;
    border-radius:16px!important;
  }
  .mainHero.hasCoverImage{
    padding:0!important;
  }
  .coverContent{
    gap:8px!important;
  }
  .heroKicker{
    display:none!important;
  }
  .mainHero h1{
    font-size:18px!important;
    line-height:1!important;
    margin:0!important;
    white-space:nowrap!important;
    overflow:hidden!important;
    text-overflow:ellipsis!important;
  }
  .mainHero p{
    display:none!important;
  }
  .coverIconBox{
    width:36px!important;
    height:36px!important;
    border-radius:11px!important;
  }
  .coverIconBox b{
    font-size:13px!important;
  }
}


/* ===== FINANCE LINKED BALANCE SYSTEM ===== */
.financeSectionHead{
  align-items:center!important;
}
.financeBalancePill{
  min-width:132px;
  min-height:54px;
  padding:8px 12px;
  border-radius:18px;
  display:grid;
  align-content:center;
  gap:3px;
  text-align:center;
  background:rgba(0,229,255,.08);
  border:1px solid rgba(0,229,255,.18);
}
.financeBalancePill small{
  color:#9fb4c8;
  font-size:11px;
  font-weight:900;
}
.financeBalancePill b{
  color:#ecfeff;
  font-size:20px;
  line-height:1;
  direction:ltr;
  unicode-bidi:plaintext;
  font-variant-numeric:tabular-nums;
}
.financeListGrid{
  gap:10px!important;
}
.financeCard{
  grid-template-columns:minmax(96px,auto) minmax(0,1fr)!important;
}
.financeCard.income .financeAmountValue{
  color:#86efac!important;
}
.financeCard.expense .financeAmountValue{
  color:#fca5a5!important;
}
.financeCard.neutral .financeAmountValue{
  color:#ecfeff!important;
}
.financeCard div{
  min-width:0;
}
@media(max-width:720px){
  .financeSectionHead{
    grid-template-columns:1fr!important;
  }
  .financeBalancePill{
    width:100%;
    min-height:48px;
    display:flex;
    align-items:center;
    justify-content:space-between;
    text-align:right;
  }
  .financeBalancePill b{
    font-size:19px;
  }
  .financeCard{
    grid-template-columns:118px minmax(0,1fr)!important;
    padding:12px!important;
    gap:10px!important;
  }
  .financeCard>b{
    font-size:23px!important;
  }
}


/* ===== PLAYER OFFER CARD LAYOUT FIX v10: stable 4-column player card ===== */
.playerCard.hasOfferAction{
  min-height:104px!important;
  height:auto!important;
  padding:12px 14px!important;
  display:grid!important;
  grid-template-columns:64px 140px minmax(0,1fr) 72px!important;
  grid-template-areas:"rating actions info photo"!important;
  gap:12px!important;
  align-items:center!important;
  direction:ltr!important;
  position:relative!important;
  overflow:hidden!important;
}
.playerCard.hasOfferAction .playerPhoto{
  grid-area:photo!important;
  width:70px!important;
  height:70px!important;
  border-radius:20px!important;
  justify-self:end!important;
  align-self:center!important;
  object-fit:contain!important;
  background:rgba(255,255,255,.08)!important;
  padding:3px!important;
}
.playerCard.hasOfferAction .playerInfo{
  grid-area:info!important;
  direction:rtl!important;
  text-align:right!important;
  min-width:0!important;
  width:100%!important;
  padding:0!important;
  align-self:center!important;
  display:flex!important;
  flex-direction:column!important;
  justify-content:center!important;
  gap:8px!important;
  overflow:hidden!important;
}
.playerCard.hasOfferAction .playerInfo h4{
  display:block!important;
  width:100%!important;
  font-size:22px!important;
  line-height:1.14!important;
  margin:0!important;
  color:#f8fafc!important;
  white-space:nowrap!important;
  overflow:hidden!important;
  text-overflow:ellipsis!important;
}
.playerCard.hasOfferAction .playerMeta{
  display:flex!important;
  align-items:center!important;
  justify-content:flex-start!important;
  flex-wrap:nowrap!important;
  gap:7px!important;
  margin:0!important;
  min-height:28px!important;
  overflow:hidden!important;
}
.playerCard.hasOfferAction .playerMeta span{
  display:inline-flex!important;
  align-items:center!important;
  justify-content:center!important;
  height:28px!important;
  max-width:96px!important;
  padding:0 10px!important;
  border-radius:999px!important;
  font-size:11px!important;
  line-height:1!important;
  white-space:nowrap!important;
  overflow:hidden!important;
  text-overflow:ellipsis!important;
  flex:0 1 auto!important;
}
.playerCard.hasOfferAction .playerRating{
  grid-area:rating!important;
  width:62px!important;
  height:62px!important;
  border-radius:19px!important;
  font-size:26px!important;
  justify-self:start!important;
  align-self:center!important;
  display:grid!important;
  place-items:center!important;
}
.playerCard.hasOfferAction .playerOfferActions,
.playerCard.hasOfferAction .playerOfferActions.oneAction,
.playerCard.hasOfferAction .playerOfferActions.forceTwoActions{
  grid-area:actions!important;
  position:static!important;
  inset:auto!important;
  transform:none!important;
  width:100%!important;
  min-width:0!important;
  height:auto!important;
  display:flex!important;
  flex-direction:column!important;
  align-items:stretch!important;
  justify-content:center!important;
  gap:8px!important;
  margin:0!important;
  overflow:visible!important;
  z-index:2!important;
}
.playerCard.hasOfferAction .playerOfferButton{
  width:100%!important;
  min-width:0!important;
  height:34px!important;
  border:0!important;
  border-radius:12px!important;
  padding:0 9px!important;
  font-size:11.5px!important;
  line-height:1!important;
  font-weight:1000!important;
  white-space:nowrap!important;
  overflow:hidden!important;
  text-overflow:ellipsis!important;
  box-shadow:0 10px 22px rgba(0,0,0,.18)!important;
}
.playerCard.hasOfferAction .playerOfferButton.edit{
  background:linear-gradient(135deg,#facc15,#fb923c)!important;
  color:#020617!important;
}
.playerCard.hasOfferAction .playerOfferButton.cancel{
  background:linear-gradient(135deg,#fb7185,#e11d48)!important;
  color:white!important;
}
@media(max-width:720px){
  .playerCard.hasOfferAction{
    min-height:104px!important;
    padding:10px 12px!important;
    grid-template-columns:56px 116px minmax(0,1fr) 64px!important;
    gap:8px!important;
  }
  .playerCard.hasOfferAction .playerPhoto{
    width:62px!important;
    height:62px!important;
    border-radius:18px!important;
  }
  .playerCard.hasOfferAction .playerInfo{
    gap:7px!important;
  }
  .playerCard.hasOfferAction .playerInfo h4{
    font-size:18.5px!important;
  }
  .playerCard.hasOfferAction .playerMeta{
    gap:5px!important;
    min-height:24px!important;
  }
  .playerCard.hasOfferAction .playerMeta span{
    height:24px!important;
    max-width:74px!important;
    padding:0 7px!important;
    font-size:9.5px!important;
  }
  .playerCard.hasOfferAction .playerRating{
    width:52px!important;
    height:52px!important;
    border-radius:16px!important;
    font-size:22px!important;
  }
  .playerCard.hasOfferAction .playerOfferActions,
  .playerCard.hasOfferAction .playerOfferActions.oneAction,
  .playerCard.hasOfferAction .playerOfferActions.forceTwoActions{
    gap:7px!important;
  }
  .playerCard.hasOfferAction .playerOfferButton{
    height:31px!important;
    border-radius:11px!important;
    font-size:9.2px!important;
    padding:0 6px!important;
  }
}
@media(max-width:390px){
  .playerCard.hasOfferAction{
    min-height:100px!important;
    grid-template-columns:50px 104px minmax(0,1fr) 56px!important;
    gap:6px!important;
    padding:9px 10px!important;
  }
  .playerCard.hasOfferAction .playerPhoto{
    width:54px!important;
    height:54px!important;
    border-radius:16px!important;
  }
  .playerCard.hasOfferAction .playerInfo h4{
    font-size:16.5px!important;
  }
  .playerCard.hasOfferAction .playerMeta span{
    max-width:64px!important;
    height:22px!important;
    font-size:8.8px!important;
    padding:0 6px!important;
  }
  .playerCard.hasOfferAction .playerRating{
    width:48px!important;
    height:48px!important;
    border-radius:15px!important;
    font-size:20px!important;
  }
  .playerCard.hasOfferAction .playerOfferButton{
    height:30px!important;
    font-size:8.5px!important;
    padding:0 5px!important;
  }
}


/* ===== PLAYER OFFER CARD FINAL FIX v11: stable, no-hidden-actions ===== */
.playerCard.hasOfferAction{
  min-height:150px!important;
  height:auto!important;
  padding:14px 16px!important;
  display:grid!important;
  grid-template-columns:64px 122px minmax(0,1fr) 76px!important;
  grid-template-areas:"rating actions info photo"!important;
  gap:12px!important;
  align-items:center!important;
  direction:ltr!important;
  overflow:visible!important;
}
.playerCard.hasOfferAction .playerPhoto{grid-area:photo!important;width:74px!important;height:74px!important;border-radius:20px!important;justify-self:end!important;align-self:center!important;object-fit:contain!important;background:rgba(255,255,255,.08)!important;padding:3px!important;}
.playerCard.hasOfferAction .playerInfo{grid-area:info!important;direction:rtl!important;text-align:right!important;min-width:0!important;width:100%!important;display:flex!important;flex-direction:column!important;justify-content:center!important;gap:10px!important;overflow:visible!important;}
.playerCard.hasOfferAction .playerInfo h4{font-size:22px!important;line-height:1.18!important;margin:0!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;color:#f8fafc!important;}
.playerCard.hasOfferAction .playerMeta{display:flex!important;flex-wrap:wrap!important;gap:8px!important;margin:0!important;overflow:visible!important;min-height:30px!important;}
.playerCard.hasOfferAction .playerMeta span{display:inline-flex!important;align-items:center!important;justify-content:center!important;min-height:30px!important;max-width:112px!important;padding:0 11px!important;border-radius:999px!important;font-size:11px!important;line-height:1!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;}
.playerCard.hasOfferAction .playerRating{grid-area:rating!important;width:62px!important;height:62px!important;border-radius:19px!important;font-size:26px!important;justify-self:start!important;align-self:center!important;display:grid!important;place-items:center!important;}
.playerCard.hasOfferAction .playerOfferActions,
.playerCard.hasOfferAction .playerOfferActions.oneAction,
.playerCard.hasOfferAction .playerOfferActions.forceTwoActions{grid-area:actions!important;position:static!important;left:auto!important;right:auto!important;bottom:auto!important;inset:auto!important;width:100%!important;min-width:0!important;display:flex!important;flex-direction:column!important;align-items:stretch!important;justify-content:center!important;gap:8px!important;margin:0!important;overflow:visible!important;z-index:2!important;}
.playerCard.hasOfferAction .playerOfferButton{width:100%!important;height:34px!important;min-width:0!important;border:0!important;border-radius:13px!important;padding:0 7px!important;font-size:10px!important;line-height:1!important;font-weight:1000!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;box-shadow:0 10px 22px rgba(0,0,0,.18)!important;}
.playerCard.hasOfferAction .playerOfferButton.edit{background:linear-gradient(135deg,#facc15,#fb923c)!important;color:#020617!important;}
.playerCard.hasOfferAction .playerOfferButton.cancel{background:linear-gradient(135deg,#fb7185,#e11d48)!important;color:white!important;}
@media(max-width:720px){
  .playerCard.hasOfferAction{min-height:144px!important;padding:12px!important;grid-template-columns:54px 104px minmax(0,1fr) 64px!important;gap:8px!important;}
  .playerCard.hasOfferAction .playerPhoto{width:62px!important;height:62px!important;border-radius:18px!important;}
  .playerCard.hasOfferAction .playerInfo{gap:8px!important;}
  .playerCard.hasOfferAction .playerInfo h4{font-size:18px!important;}
  .playerCard.hasOfferAction .playerMeta{gap:5px!important;min-height:26px!important;}
  .playerCard.hasOfferAction .playerMeta span{min-height:25px!important;max-width:78px!important;padding:0 7px!important;font-size:9.2px!important;}
  .playerCard.hasOfferAction .playerRating{width:52px!important;height:52px!important;border-radius:16px!important;font-size:22px!important;}
  .playerCard.hasOfferAction .playerOfferActions,.playerCard.hasOfferAction .playerOfferActions.oneAction,.playerCard.hasOfferAction .playerOfferActions.forceTwoActions{gap:7px!important;}
  .playerCard.hasOfferAction .playerOfferButton{height:31px!important;border-radius:11px!important;font-size:8.5px!important;padding:0 4px!important;}
}
@media(max-width:390px){
  .playerCard.hasOfferAction{min-height:138px!important;grid-template-columns:48px 94px minmax(0,1fr) 56px!important;gap:6px!important;padding:10px!important;}
  .playerCard.hasOfferAction .playerPhoto{width:54px!important;height:54px!important;border-radius:16px!important;}
  .playerCard.hasOfferAction .playerInfo h4{font-size:16px!important;}
  .playerCard.hasOfferAction .playerMeta span{max-width:66px!important;min-height:23px!important;font-size:8px!important;padding:0 5px!important;}
  .playerCard.hasOfferAction .playerRating{width:46px!important;height:46px!important;border-radius:14px!important;font-size:19px!important;}
  .playerCard.hasOfferAction .playerOfferButton{height:30px!important;font-size:7.6px!important;}
}


/* ===== PLAYER OFFER CARD FINAL FIX v12: actions under details, no overlap ===== */
.playerCard.hasOfferAction{
  min-height:132px!important;
  height:auto!important;
  padding:14px!important;
  display:grid!important;
  grid-template-columns:58px minmax(0,1fr) 64px!important;
  grid-template-rows:auto auto!important;
  grid-template-areas:
    "rating info photo"
    "rating actions photo"!important;
  column-gap:12px!important;
  row-gap:9px!important;
  align-items:center!important;
  direction:ltr!important;
  overflow:visible!important;
}
.playerCard.hasOfferAction .playerPhoto{grid-area:photo!important;width:62px!important;height:62px!important;border-radius:18px!important;justify-self:end!important;align-self:center!important;object-fit:contain!important;background:rgba(255,255,255,.08)!important;padding:3px!important;}
.playerCard.hasOfferAction .playerRating{grid-area:rating!important;width:54px!important;height:54px!important;border-radius:17px!important;font-size:23px!important;justify-self:start!important;align-self:center!important;display:grid!important;place-items:center!important;}
.playerCard.hasOfferAction .playerInfo{grid-area:info!important;direction:rtl!important;text-align:right!important;min-width:0!important;width:100%!important;display:flex!important;flex-direction:column!important;justify-content:center!important;gap:7px!important;overflow:visible!important;}
.playerCard.hasOfferAction .playerInfo h4{margin:0!important;font-size:18px!important;line-height:1.2!important;color:#f8fafc!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;}
.playerCard.hasOfferAction .playerMeta{display:flex!important;flex-wrap:wrap!important;gap:6px!important;margin:0!important;overflow:visible!important;min-height:26px!important;}
.playerCard.hasOfferAction .playerMeta span{display:inline-flex!important;align-items:center!important;justify-content:center!important;min-height:25px!important;max-width:96px!important;padding:0 9px!important;border-radius:999px!important;font-size:10px!important;line-height:1!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;}
.playerCard.hasOfferAction .playerOfferActions,.playerCard.hasOfferAction .playerOfferActions.oneAction,.playerCard.hasOfferAction .playerOfferActions.forceTwoActions{grid-area:actions!important;position:static!important;inset:auto!important;width:100%!important;min-width:0!important;display:flex!important;flex-direction:row!important;align-items:center!important;justify-content:stretch!important;gap:8px!important;margin:0!important;overflow:visible!important;z-index:2!important;}
.playerCard.hasOfferAction .playerOfferButton{flex:1 1 0!important;width:auto!important;height:32px!important;min-width:0!important;border:0!important;border-radius:12px!important;padding:0 7px!important;font-size:10px!important;line-height:1!important;font-weight:1000!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;box-shadow:0 10px 22px rgba(0,0,0,.18)!important;}
.playerCard.hasOfferAction .playerOfferActions.oneAction .playerOfferButton{flex:0 1 160px!important;max-width:180px!important;}
.playerCard.hasOfferAction .playerOfferButton.edit{background:linear-gradient(135deg,#facc15,#fb923c)!important;color:#020617!important;}
.playerCard.hasOfferAction .playerOfferButton.cancel{background:linear-gradient(135deg,#fb7185,#e11d48)!important;color:white!important;}
@media(max-width:720px){.playerCard.hasOfferAction{min-height:126px!important;padding:12px!important;grid-template-columns:52px minmax(0,1fr) 58px!important;column-gap:9px!important;row-gap:8px!important;}.playerCard.hasOfferAction .playerPhoto{width:56px!important;height:56px!important;border-radius:16px!important;}.playerCard.hasOfferAction .playerRating{width:48px!important;height:48px!important;border-radius:15px!important;font-size:20px!important;}.playerCard.hasOfferAction .playerInfo h4{font-size:16px!important;}.playerCard.hasOfferAction .playerMeta{gap:5px!important;min-height:24px!important;}.playerCard.hasOfferAction .playerMeta span{min-height:23px!important;max-width:72px!important;padding:0 6px!important;font-size:8.5px!important;}.playerCard.hasOfferAction .playerOfferActions,.playerCard.hasOfferAction .playerOfferActions.oneAction,.playerCard.hasOfferAction .playerOfferActions.forceTwoActions{gap:6px!important;}.playerCard.hasOfferAction .playerOfferButton{height:30px!important;border-radius:10px!important;font-size:8.2px!important;padding:0 4px!important;}.playerCard.hasOfferAction .playerOfferActions.oneAction .playerOfferButton{flex:0 1 130px!important;max-width:140px!important;}}
@media(max-width:390px){.playerCard.hasOfferAction{min-height:122px!important;padding:10px!important;grid-template-columns:48px minmax(0,1fr) 54px!important;column-gap:7px!important;row-gap:7px!important;}.playerCard.hasOfferAction .playerPhoto{width:52px!important;height:52px!important;border-radius:15px!important;}.playerCard.hasOfferAction .playerRating{width:44px!important;height:44px!important;border-radius:14px!important;font-size:18px!important;}.playerCard.hasOfferAction .playerInfo h4{font-size:15px!important;}.playerCard.hasOfferAction .playerMeta span{max-width:64px!important;min-height:22px!important;font-size:7.7px!important;padding:0 5px!important;}.playerCard.hasOfferAction .playerOfferButton{height:29px!important;font-size:7.4px!important;padding:0 3px!important;}.playerCard.hasOfferAction .playerOfferActions.oneAction .playerOfferButton{flex:0 1 118px!important;max-width:124px!important;}}

/* ===== Player detail offer flow: keep list cards clean ===== */
.playerCardClickable{cursor:pointer;transition:transform .15s ease,border-color .15s ease,background .15s ease}.playerCardClickable:hover{transform:translateY(-1px);border-color:rgba(0,229,255,.28);background:rgba(0,229,255,.08)}.playerDetailFullPage{min-height:calc(100vh - 140px)}.playerDetailSubPage{border-radius:28px;padding:16px;margin-top:0}.playerDetailHero{display:grid;grid-template-columns:150px minmax(0,1fr) 62px;gap:16px;align-items:center;border-radius:26px;padding:16px;background:rgba(2,6,23,.28);border:1px solid rgba(255,255,255,.12)}.playerDetailImageBox{width:150px;height:150px;border-radius:32px;display:grid;place-items:center;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14);overflow:hidden}.playerDetailImageBox img{width:100%;height:100%;object-fit:contain;padding:8px}.playerDetailInfo{min-width:0;text-align:right}.playerDetailInfo small{display:block;color:var(--cyan);font-weight:1000;margin-bottom:7px}.playerDetailInfo h2{margin:0;font-size:34px;line-height:1.18;font-weight:1000;color:#ecfeff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.playerDetailChips{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}.playerDetailChips span{height:32px;display:inline-flex;align-items:center;padding:0 12px;border-radius:999px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.13);font-weight:900;color:#dbeafe}.playerDetailRating{width:62px;height:62px;border-radius:20px;display:grid;place-items:center;background:linear-gradient(135deg,var(--cyan),var(--blue));color:#020617;font-size:24px;font-weight:1000}.playerDetailStatsGrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:12px 0}.playerDetailStatsGrid div{border-radius:20px;padding:12px;background:rgba(2,6,23,.28);border:1px solid rgba(255,255,255,.12);text-align:center}.playerDetailStatsGrid small{display:block;color:#94a3b8;font-weight:900;margin-bottom:6px}.playerDetailStatsGrid b{display:block;color:#ecfeff;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.playerDetailActions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:12px}.playerDetailPrimaryBtn{min-height:48px;border:0;border-radius:18px;cursor:pointer;color:#020617;font-weight:1000;background:linear-gradient(135deg,var(--cyan),var(--blue));box-shadow:0 14px 32px rgba(0,229,255,.16)}.playerDetailPrimaryBtn.edit{background:linear-gradient(135deg,#facc15,#fb923c)}.playerDetailPrimaryBtn.cancel{background:linear-gradient(135deg,#fecaca,#fb7185)}.playerDetailActions .playerDetailPrimaryBtn:only-child{grid-column:1/-1}.playerDetailNotice{margin-top:12px;border-radius:18px;padding:12px;text-align:center;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);color:#cbd5e1;font-weight:900}
@media(max-width:720px){.playerDetailSubPage{padding:12px;border-radius:22px}.playerDetailHero{grid-template-columns:112px minmax(0,1fr) 52px;gap:10px;padding:12px;border-radius:22px}.playerDetailImageBox{width:112px;height:112px;border-radius:24px}.playerDetailInfo h2{font-size:24px}.playerDetailChips span{height:28px;font-size:11px;padding:0 9px}.playerDetailRating{width:52px;height:52px;border-radius:16px;font-size:20px}.playerDetailStatsGrid{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.playerDetailActions{grid-template-columns:1fr}.playerDetailPrimaryBtn{min-height:46px}}

/* ===== PLAYER RELEASE FINAL STATE ===== */
.playerDealStatus.danger{border-color:rgba(239,68,68,.42)!important;background:linear-gradient(135deg,rgba(239,68,68,.14),rgba(255,255,255,.045))!important}

/* ===== SAFE USER BASE BATCH: compact competition matches + member roster summary ===== */
.memberDealsPanel .dealOnlyNotice{margin-top:12px;border-radius:16px;padding:10px 12px;color:#94a3b8;font-size:12px;font-weight:900;text-align:center;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.08)}
.loanedPlayersPanel{margin-top:14px;padding:12px;border-radius:22px}.loanedPlayersHead{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:9px}.loanedPlayersHead b{color:#ecfeff}.loanedPlayersHead small{color:#94a3b8;font-weight:900}.loanedPlayersList{display:grid;gap:8px}.loanedPlayerRow{display:grid;grid-template-columns:40px minmax(0,1fr) auto;gap:10px;align-items:center;padding:8px;border-radius:16px;background:rgba(2,6,23,.30);border:1px solid rgba(255,255,255,.09)}.loanedPlayerRow img{width:40px;height:40px;border-radius:13px;object-fit:cover}.loanedPlayerRow b,.loanedPlayerRow small{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.loanedPlayerRow b{color:#f8fafc;font-size:13px}.loanedPlayerRow small{color:#94a3b8;font-size:11px;font-weight:900;margin-top:2px}.loanedPlayerRow span{border-radius:999px;padding:5px 8px;background:rgba(0,229,255,.10);border:1px solid rgba(0,229,255,.18);color:#cffafe;font-size:11px;font-weight:1000;white-space:nowrap}.playerRosterStats{margin-top:12px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;padding:10px;border-radius:20px}.playerRosterStats span{border-radius:14px;background:rgba(255,255,255,.055);padding:9px 8px;text-align:center}.playerRosterStats small{display:block;color:#94a3b8;font-size:11px;font-weight:900}.playerRosterStats b{display:block;color:#ecfeff;font-size:18px;margin-top:3px}.readonlyLeagueMatch{grid-template-columns:minmax(0,1fr) auto auto!important;padding:7px 8px!important;border-radius:14px!important;gap:6px!important;min-height:0!important}.readonlyLeagueMatch .leagueMatchTeams{gap:5px!important}.readonlyLeagueMatch .leagueMatchTeams b{font-size:12px!important}.readonlyLeagueMatch .leagueMatchTeams span{font-size:10px!important}.readonlyLeagueMatch .leagueMatchMeta{justify-items:end!important}.readonlyLeagueMatch .leagueMatchMeta span{padding:3px 7px!important;font-size:10px!important}.readonlyLeagueMatch .leagueMatchMeta small{display:none!important}.readonlyLeagueMatch .leagueMatchScore.readonly{gap:4px!important}.readonlyLeagueMatch .leagueMatchScore.readonly b{font-size:14px!important}.readonlyLeagueMatch .leagueMatchScore.readonly strong{font-size:10px!important}.seasonHubPage .leagueRoundBox{padding:8px!important;border-radius:16px!important}.seasonHubPage .leagueRoundBox h4{font-size:13px!important;margin-bottom:6px!important}.seasonHubPage .leagueMatchesList{gap:6px!important}@media(max-width:720px){.readonlyLeagueMatch{grid-template-columns:1fr auto!important}.readonlyLeagueMatch .leagueMatchMeta{display:none!important}.loanedPlayerRow{grid-template-columns:36px minmax(0,1fr);}.loanedPlayerRow span{grid-column:1/-1;text-align:center}.playerRosterStats{grid-template-columns:repeat(3,minmax(0,1fr));}}

/* Safe patch: competition match compact layout + bottom nav cleanup */
.compactResultMatch{display:grid!important;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr)!important;align-items:center!important;gap:8px!important;border-radius:16px!important;padding:9px 10px!important;background:rgba(2,6,23,.30)!important;border:1px solid rgba(0,229,255,.18)!important;min-height:auto!important}
.compactResultMatch.completed{background:rgba(0,229,255,.075)!important;border-color:rgba(0,229,255,.30)!important}
.compactTeamName{color:#f8fafc;font-size:14px;font-weight:1000;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.3}.compactTeamName.home{text-align:right}.compactTeamName.away{text-align:left}.compactMatchCenter{display:grid;gap:3px;justify-items:center;min-width:84px}.compactMatchCenter strong{font-size:20px;color:#ecfeff;font-weight:1000;letter-spacing:.02em}.compactMatchCenter small{font-size:10px;color:#67e8f9;font-weight:1000;white-space:nowrap}.compactMatchStatus{grid-column:1/-1;justify-self:center;margin-top:2px;border-radius:999px;padding:2px 8px;background:rgba(255,255,255,.06);color:#94a3b8;font-size:10px;font-weight:900}.leagueMatchesList .compactResultMatch+.compactResultMatch{margin-top:0}.competitionTypeGrid{grid-template-columns:repeat(auto-fit,minmax(150px,1fr))}.competitionTypeCard small{font-size:11px}.memberDealsPanel .dealOnlyNotice{display:none!important}
@media(max-width:520px){.compactResultMatch{grid-template-columns:minmax(0,1fr) 78px minmax(0,1fr)!important;padding:8px!important}.compactTeamName{font-size:13px}.compactMatchCenter strong{font-size:18px}.compactMatchCenter small{font-size:9px}.mainNav{grid-template-columns:repeat(5,minmax(0,1fr))!important}}




/* ===== HOTFIX: cup bracket polish ===== */
.cupRoadBracket .qualifierBracketRounds{display:flex!important;gap:14px!important;align-items:stretch!important;overflow-x:auto!important;padding:8px 2px 12px!important;scroll-snap-type:x proximity!important}
.cupRoadBracket .qualifierBracketRound{min-width:240px!important;display:flex!important;flex-direction:column!important;justify-content:center!important;scroll-snap-align:center!important;background:linear-gradient(180deg,rgba(37,99,235,.20),rgba(15,23,42,.76))!important;border-color:rgba(56,189,248,.22)!important;box-shadow:0 18px 40px rgba(2,6,23,.24)!important}
.cupRoadBracket .qualifierBracketRound h4{color:#dbeafe!important;font-size:16px!important;letter-spacing:.2px!important}
.cupRoadBracket .leagueMatchCard,.cupRoadBracket .readonlyLeagueMatch{background:rgba(15,23,42,.62)!important;border-color:rgba(147,197,253,.18)!important}
.cupChampionBox{background:linear-gradient(135deg,rgba(250,204,21,.16),rgba(14,165,233,.12))!important;border-color:rgba(250,204,21,.32)!important}
.cupChampionBox span{color:#fde68a!important}
.cupChampionBox b{color:#fff7ed!important;font-size:18px!important}.cupChampionIdentity{display:flex!important;align-items:center!important;justify-content:center!important;gap:10px!important}.cupChampionIdentity img{width:42px!important;height:42px!important;border-radius:50%!important;object-fit:cover!important;border:1px solid rgba(250,204,21,.45)!important;background:rgba(255,255,255,.08)!important}
@media(max-width:720px){.cupRoadBracket .qualifierBracketRounds{display:flex!important}.cupRoadBracket .qualifierBracketRound{min-width:82vw!important}}
/* ===== SAFE PATCH: bottom transfers + qualifier bracket + member export polish ===== */
.leagueQualifierInlineSection{margin-top:14px!important}
.leagueQualifierList{display:grid!important;gap:12px!important}
.leagueQualifierCard{border-radius:22px!important;padding:12px!important;background:rgba(2,6,23,.28)!important;border:1px solid rgba(0,229,255,.18)!important}
.leagueQualifierTitle{display:flex!important;align-items:flex-start!important;justify-content:space-between!important;gap:10px!important;margin-bottom:10px!important}
.leagueQualifierTitle b{font-size:18px!important;color:#ecfeff!important;line-height:1.2!important}
.leagueQualifierTitle small{color:#94a3b8!important;font-weight:900!important;white-space:nowrap!important}
.qualifierBracketRounds{display:grid!important;grid-template-columns:repeat(auto-fit,minmax(220px,1fr))!important;gap:10px!important;align-items:start!important}
.qualifierBracketRound{border-radius:18px!important;padding:10px!important;background:rgba(255,255,255,.045)!important;border:1px solid rgba(255,255,255,.08)!important;position:relative!important}
.qualifierBracketRound h4{margin:0 0 8px!important;font-size:15px!important;color:#67e8f9!important;text-align:center!important}
.qualifierBracketRound .readonlyLeagueMatch{min-height:54px!important;margin-bottom:8px!important}
.qualifierQualifiedBox{margin-top:10px!important;border-radius:18px!important;padding:10px 12px!important;background:rgba(34,197,94,.10)!important;border:1px solid rgba(34,197,94,.22)!important;text-align:center!important}
.qualifierQualifiedBox span{display:block!important;color:#86efac!important;font-weight:1000!important;font-size:12px!important;margin-bottom:4px!important}
.qualifierQualifiedBox b{display:block!important;color:#f0fdf4!important;font-size:15px!important;line-height:1.5!important}
@media(max-width:720px){.qualifierBracketRounds{grid-template-columns:1fr!important}.leagueQualifierTitle{display:grid!important;gap:4px!important}.leagueQualifierTitle small{white-space:normal!important}}

/* ===== HOTFIX: cup knockout layout polish ===== */
.cupRoadBracket .qualifierBracketRounds{display:flex!important;flex-direction:row!important;gap:14px!important;align-items:stretch!important;overflow-x:auto!important;padding:8px 2px 12px!important;scroll-snap-type:x proximity!important}
.cupRoadBracket .qualifierBracketRound{min-width:240px!important;max-width:240px!important;min-height:360px!important;display:flex!important;flex-direction:column!important;justify-content:flex-start!important;scroll-snap-align:center!important;background:linear-gradient(180deg,rgba(37,99,235,.18),rgba(15,23,42,.76))!important;border:1px solid rgba(56,189,248,.22)!important;box-shadow:0 18px 40px rgba(2,6,23,.24)!important;padding:12px!important;border-radius:18px!important}
.cupRoadBracket .qualifierBracketRound.finalRound{background:linear-gradient(180deg,rgba(250,204,21,.10),rgba(15,23,42,.82))!important;border-color:rgba(250,204,21,.28)!important}
.cupRoadBracket .qualifierBracketRound h4{margin:2px 0 10px!important;font-size:18px!important;color:#dbeafe!important;text-align:center!important}
.cupRoadBracket .qualifierBracketRound.finalRound h4{color:#fde68a!important}
.cupRoadBracket .cupRoundMatchesStack{display:flex!important;flex-direction:column!important;justify-content:center!important;gap:12px!important;flex:1!important;min-height:0!important}
.cupRoadBracket .compactResultMatch{padding:12px 12px 10px!important;border-radius:18px!important;background:rgba(15,23,42,.68)!important;border:1px solid rgba(147,197,253,.16)!important;min-height:92px!important}
.cupRoadBracket .compactResultMatch.finalRoundMatch{border-color:rgba(250,204,21,.30)!important;background:rgba(15,23,42,.82)!important}
.cupRoadBracket .compactMatchStatus{margin-top:4px!important}
.cupRoadBracket .winnerStatus{background:rgba(34,197,94,.16)!important;color:#bbf7d0!important;border:1px solid rgba(34,197,94,.20)!important}
.cupRoadBracket .winnerTeam{color:#bbf7d0!important}
.cupRoadBracket .qualifierQualifiedBox,.cupRoadBracket .cupChampionBox{display:none!important}
@media(max-width:720px){.cupRoadBracket .qualifierBracketRound{min-width:82vw!important;max-width:82vw!important;min-height:320px!important}}


/* ===== HOTFIX: Super Cup final-only display ===== */
.superCupFinalRoad .qualifierBracketRounds{display:flex!important;justify-content:center!important;overflow:visible!important;padding:6px 0!important}
.superCupFinalRoad .qualifierBracketRound{width:min(100%,720px)!important;min-height:auto!important;background:linear-gradient(180deg,rgba(250,204,21,.10),rgba(15,23,42,.72))!important;border:1px solid rgba(250,204,21,.28)!important;border-radius:22px!important;padding:16px!important;box-shadow:0 18px 40px rgba(2,6,23,.24)!important}
.superCupFinalRoad .qualifierBracketRound h4{color:#fde68a!important;font-size:20px!important;margin:0 0 14px!important;text-align:center!important}
.superCupFinalRoad .cupRoundMatchesStack{display:block!important}
.superCupFinalRoad .compactResultMatch{min-height:112px!important;border-color:rgba(250,204,21,.28)!important;background:rgba(15,23,42,.80)!important}
.superCupFinalRoad .winnerTeam{color:#bbf7d0!important}
.superCupFinalRoad .winnerStatus{background:rgba(34,197,94,.16)!important;color:#bbf7d0!important;border:1px solid rgba(34,197,94,.22)!important}


/* ===== World Cup groups patch ===== */
.worldCupGroupsGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.worldCupGroupCard{background:rgba(15,23,42,.62);border:1px solid rgba(56,189,248,.18);border-radius:18px;padding:12px;box-shadow:0 14px 28px rgba(2,6,23,.20)}
.worldCupGroupCard h4{margin:0 0 10px;color:#67e8f9;font-size:17px;text-align:center}
.worldCupByeNote{margin:0 0 10px;color:#fde68a;font-weight:900;text-align:center;font-size:12px;background:rgba(250,204,21,.10);border:1px solid rgba(250,204,21,.18);border-radius:999px;padding:6px 10px}
.miniWorldCupTable .leagueTableHead,.miniWorldCupTable .leagueTableRow{grid-template-columns:34px 1.5fr .6fr .6fr .6fr .7fr .7fr;font-size:12px}
.worldCupRoadBracket .qualifierBracketRound{min-width:260px!important;max-width:260px!important}
.worldCupKnockoutSeparatedRounds .finalRound{background:linear-gradient(180deg,rgba(250,204,21,.10),rgba(15,23,42,.82))!important;border-color:rgba(250,204,21,.28)!important}
.worldCupKnockoutSeparatedRounds .finalRound h4{color:#fde68a!important}
.worldCupKnockoutSeparatedRounds .thirdPlaceColumn{background:linear-gradient(180deg,rgba(37,99,235,.14),rgba(15,23,42,.76))!important;border-color:rgba(56,189,248,.22)!important}
.worldCupKnockoutSeparatedRounds .thirdPlaceColumn h4{color:#dbeafe!important}
.miniDownloadBtn{height:36px;border:0;border-radius:999px;padding:0 14px;background:linear-gradient(135deg,var(--cyan),var(--blue));color:#020617;font-weight:1000;cursor:pointer;white-space:nowrap;box-shadow:0 10px 24px rgba(0,229,255,.14)}
@media(max-width:900px){.worldCupGroupsGrid{grid-template-columns:1fr}.worldCupRoadBracket .qualifierBracketRound{min-width:82vw!important;max-width:82vw!important}}
@media(max-width:720px){.worldCupGroupsSection .sectionHead{align-items:stretch}.miniDownloadBtn{width:100%}}


/* ===== ULTIMATE MEMBERS PAGE REAL LAYOUT PATCH ===== */
.utMembersPage{display:grid!important;gap:16px!important;padding:6px 0 18px!important;background:transparent!important;border:0!important;box-shadow:none!important}
.utMembersHero{position:relative!important;overflow:hidden!important;display:flex!important;align-items:center!important;justify-content:space-between!important;gap:14px!important;min-height:138px!important;border-radius:32px!important;padding:22px!important;background:radial-gradient(circle at 20% 0%,rgba(0,255,156,.24),transparent 35%),radial-gradient(circle at 100% 20%,rgba(0,229,255,.18),transparent 32%),linear-gradient(135deg,rgba(3,10,21,.94),rgba(12,16,36,.92))!important;border:1px solid rgba(0,255,156,.22)!important;box-shadow:0 22px 55px rgba(0,0,0,.48),inset 0 1px 0 rgba(255,255,255,.06)!important}
.utMembersHero:before{content:"";position:absolute;inset:auto -40px -80px -40px;height:160px;background:radial-gradient(circle,rgba(0,229,255,.12),transparent 68%);pointer-events:none}
.utHeroText{position:relative;z-index:1;text-align:right!important}.utEyebrow{display:block!important;color:#00ff9c!important;font-size:10px!important;font-weight:1000!important;letter-spacing:.34em!important;margin-bottom:8px!important}.utHeroText h1{font-size:44px!important;line-height:.95!important;margin:0 0 8px!important;color:#fff!important;text-shadow:0 0 24px rgba(0,229,255,.2)!important}.utHeroText p{margin:0!important;color:#a9b7cc!important;font-size:13px!important;font-weight:800!important;max-width:245px!important}.utHeroBall{position:relative;z-index:1;display:grid!important;place-items:center!important;width:58px!important;height:58px!important;border-radius:20px!important;background:linear-gradient(135deg,#00ff9c,#00e5ff,#2f8cff)!important;box-shadow:0 0 28px rgba(0,229,255,.35)!important;font-size:29px!important;color:#001018!important}
.utLeaderCard{position:relative!important;overflow:hidden!important;border:1px solid rgba(250,204,21,.28)!important;border-radius:32px!important;background:radial-gradient(circle at 15% 0%,rgba(250,204,21,.18),transparent 32%),radial-gradient(circle at 92% 10%,rgba(0,229,255,.16),transparent 34%),linear-gradient(135deg,rgba(15,23,42,.92),rgba(3,7,18,.94))!important;box-shadow:0 24px 60px rgba(0,0,0,.55),0 0 28px rgba(250,204,21,.1)!important;padding:18px!important;display:grid!important;grid-template-columns:auto 1fr auto!important;align-items:center!important;gap:14px!important;text-align:right!important;min-height:132px!important;color:#fff!important}.utLeaderCard:after{content:"";position:absolute;inset:-40% auto auto -20%;width:210px;height:210px;border-radius:999px;border:1px solid rgba(250,204,21,.12);box-shadow:0 0 0 45px rgba(0,229,255,.025);pointer-events:none}.utLeaderRank{position:absolute!important;top:14px!important;left:14px!important;width:44px!important;height:44px!important;border-radius:16px!important;display:grid!important;place-items:center!important;background:rgba(250,204,21,.14)!important;border:1px solid rgba(250,204,21,.28)!important;color:#fde68a!important;font-weight:1000!important}.utLeaderImageWrap{width:84px!important;height:84px!important;border-radius:28px!important;padding:3px!important;background:linear-gradient(135deg,#facc15,#00e5ff)!important;box-shadow:0 0 30px rgba(0,229,255,.26)!important}.utLeaderImageWrap img{width:100%!important;height:100%!important;border-radius:25px!important;object-fit:cover!important}.utLeaderInfo span{display:block!important;color:#facc15!important;font-size:12px!important;font-weight:1000!important}.utLeaderInfo h2{font-size:31px!important;margin:2px 0 2px!important}.utLeaderInfo p{margin:0!important;color:#a7b4c8!important;font-size:15px!important;font-weight:900!important}.utLogoStrip{display:flex!important;gap:8px!important;margin-top:8px!important}.utLogoStrip img{width:24px!important;height:24px!important;border-radius:999px!important;object-fit:contain!important;background:rgba(255,255,255,.08)!important;padding:2px!important}.utLeaderRating{display:grid!important;place-items:center!important;width:62px!important;height:72px!important;border-radius:20px!important;background:linear-gradient(180deg,rgba(250,204,21,.22),rgba(250,204,21,.08))!important;border:1px solid rgba(250,204,21,.26)!important}.utLeaderRating b{font-size:30px!important;color:#fff!important;line-height:1!important}.utLeaderRating small{font-size:10px!important;color:#fde68a!important;font-weight:1000!important;letter-spacing:.08em!important}
.utQuickStats{display:grid!important;grid-template-columns:repeat(3,1fr)!important;gap:10px!important}.utQuickStats div{min-height:74px!important;border-radius:24px!important;padding:12px!important;display:grid!important;place-items:center!important;background:linear-gradient(180deg,rgba(15,23,42,.74),rgba(2,6,23,.70))!important;border:1px solid rgba(0,229,255,.14)!important;box-shadow:0 12px 32px rgba(0,0,0,.32)!important}.utQuickStats b{font-size:24px!important;color:#00ff9c!important;line-height:1!important}.utQuickStats span{color:#94a3b8!important;font-size:12px!important;font-weight:900!important}
.utPodium{display:grid!important;grid-template-columns:repeat(3,1fr)!important;gap:10px!important;align-items:end!important}.utPodiumCard{height:132px!important;border:1px solid rgba(148,163,184,.14)!important;border-radius:28px!important;background:linear-gradient(180deg,rgba(15,23,42,.82),rgba(2,6,23,.78))!important;padding:12px 8px!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:5px!important;color:#fff!important;box-shadow:0 16px 38px rgba(0,0,0,.38)!important}.utPodiumCard.rank1{height:154px!important;border-color:rgba(250,204,21,.42)!important;background:radial-gradient(circle at 50% 0%,rgba(250,204,21,.22),transparent 36%),linear-gradient(180deg,rgba(30,25,10,.90),rgba(2,6,23,.78))!important}.utPodiumCard img{width:54px!important;height:54px!important;border-radius:19px!important;object-fit:cover!important}.utPodiumCard b{font-size:14px!important;font-weight:1000!important;color:#fff!important;max-width:100%!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}.utPodiumCard small{color:#cbd5e1!important;font-size:12px!important;font-weight:900!important}.utPodiumMedal{font-size:20px!important;line-height:1!important}
.utMembersBoard{border-radius:32px!important;padding:16px!important;background:linear-gradient(180deg,rgba(15,23,42,.62),rgba(2,6,23,.52))!important;border:1px solid rgba(0,229,255,.14)!important;box-shadow:0 18px 46px rgba(0,0,0,.36)!important}.utBoardHead{display:flex!important;align-items:flex-end!important;justify-content:space-between!important;margin-bottom:14px!important}.utBoardHead span{display:block!important;font-size:10px!important;letter-spacing:.32em!important;color:#00ff9c!important;font-weight:1000!important}.utBoardHead h2{font-size:28px!important;margin:2px 0 0!important}.utBoardHead em{font-style:normal!important;color:#93c5fd!important;background:rgba(37,99,235,.13)!important;border:1px solid rgba(59,130,246,.22)!important;border-radius:999px!important;padding:6px 10px!important;font-weight:1000!important;font-size:12px!important}.utMembersRows{display:grid!important;gap:12px!important}.utMemberRow{position:relative!important;overflow:hidden!important;width:100%!important;min-height:94px!important;border-radius:28px!important;border:1px solid rgba(0,229,255,.12)!important;background:radial-gradient(circle at 92% 0%,rgba(0,255,156,.13),transparent 28%),linear-gradient(135deg,rgba(9,16,29,.92),rgba(5,9,19,.86))!important;box-shadow:0 14px 38px rgba(0,0,0,.38)!important;display:grid!important;grid-template-columns:auto auto 1fr auto!important;gap:12px!important;align-items:center!important;text-align:right!important;padding:12px 14px!important;color:#fff!important}.utMemberRow:before{content:"";position:absolute;right:0;top:20px;bottom:20px;width:5px;border-radius:999px;background:linear-gradient(#00ff9c,#00e5ff);box-shadow:0 0 18px rgba(0,255,156,.45)}.utMemberRow.isLeader{border-color:rgba(250,204,21,.38)!important;background:radial-gradient(circle at 90% 0%,rgba(250,204,21,.18),transparent 30%),linear-gradient(135deg,rgba(22,20,11,.94),rgba(5,9,19,.88))!important}.utRankPill{width:42px!important;height:42px!important;border-radius:15px!important;display:grid!important;place-items:center!important;background:rgba(15,23,42,.92)!important;border:1px solid rgba(148,163,184,.18)!important;color:#dbeafe!important;font-weight:1000!important}.utMemberAvatar{width:62px!important;height:62px!important;border-radius:22px!important;padding:2px!important;background:linear-gradient(135deg,rgba(0,255,156,.9),rgba(0,229,255,.75))!important;box-shadow:0 0 22px rgba(0,229,255,.20)!important}.utMemberAvatar img{width:100%!important;height:100%!important;border-radius:20px!important;object-fit:cover!important}.utMemberMeta b{display:block!important;color:#fff!important;font-size:21px!important;font-weight:1000!important;line-height:1.1!important}.utMemberMeta small{display:block!important;margin-top:4px!important;color:#94a3b8!important;font-weight:900!important;font-size:13px!important}.utMemberLogos{display:flex!important;gap:6px!important;margin-top:7px!important}.utMemberLogos img{width:22px!important;height:22px!important;border-radius:999px!important;object-fit:contain!important;background:rgba(255,255,255,.08)!important;padding:2px!important}.utMemberNumbers{display:grid!important;gap:7px!important;justify-items:center!important}.utRatingBadge{min-width:46px!important;height:40px!important;border-radius:15px!important;display:grid!important;place-items:center!important;background:linear-gradient(135deg,#facc15,#f59e0b)!important;color:#111827!important;font-size:18px!important;font-weight:1000!important}.utTrophyBadge{min-width:58px!important;height:34px!important;border-radius:999px!important;display:grid!important;place-items:center!important;background:linear-gradient(135deg,#00e5ff,#2f8cff)!important;color:#001018!important;font-weight:1000!important;font-size:14px!important}
@media(max-width:430px){.utMembersPage{gap:14px!important}.utMembersHero{min-height:126px!important;border-radius:28px!important;padding:18px!important}.utHeroText h1{font-size:38px!important}.utHeroText p{font-size:12px!important;max-width:215px!important}.utHeroBall{width:52px!important;height:52px!important}.utLeaderCard{grid-template-columns:auto 1fr auto!important;padding:15px!important;border-radius:28px!important}.utLeaderImageWrap{width:72px!important;height:72px!important}.utLeaderInfo h2{font-size:27px!important}.utLeaderRating{width:56px!important;height:64px!important}.utLeaderRating b{font-size:26px!important}.utMemberRow{grid-template-columns:auto auto 1fr!important;min-height:92px!important}.utMemberNumbers{grid-column:1 / -1!important;display:flex!important;justify-content:flex-start!important;gap:8px!important;margin-right:54px!important}.utMemberMeta b{font-size:20px!important}.utPodiumCard{height:120px!important}.utPodiumCard.rank1{height:140px!important}.utPodiumCard img{width:48px!important;height:48px!important}}

`;


