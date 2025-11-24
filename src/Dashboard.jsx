// src/Dashboard.jsx
import React, { useEffect, useState, useRef } from "react";
import "./Dashboard.css";
import AsrarFooter from "./AsrarFooter";
import CharacterCarousel from "./CharacterCarousel";

import abuZainAvatar from "./assets/abu_zain.png";
import hanaAvatar from "./assets/hana.png";
import rashidAvatar from "./assets/rashid.png";
import nourAvatar from "./assets/nour.png";
import farahAvatar from "./assets/farah.png";

import { useNavigate, Navigate } from "react-router-dom";
import AsrarHeader from "./AsrarHeader";
import { useAuth } from "./hooks/useAuth";
import { API_BASE } from "./apiBase";
import { createCheckoutSession } from "./api/billing";

// --- CHARACTERS (same 5 core) -----------------------------
const CHARACTERS = [
  {
    id: "abu-zain",
    avatar: abuZainAvatar,
    nameEn: "Abu Zain",
    nameAr: "أبو زين",
    roleEn: "Guidance",
    roleAr: "إرشاد وحكمة",
  },
  {
    id: "hana",
    avatar: hanaAvatar,
    nameEn: "Hana",
    nameAr: "هَنا",
    roleEn: "Deep Support",
    roleAr: "دعم عاطفي عميق",
  },
  {
    id: "rashid",
    avatar: rashidAvatar,
    nameEn: "Rashid",
    nameAr: "راشد",
    roleEn: "Focus & Study",
    roleAr: "تركيز ودراسة",
  },
  {
    id: "nour",
    avatar: nourAvatar,
    nameEn: "Nour",
    nameAr: "نور",
    roleEn: "Brutal Honesty",
    roleAr: "صراحة قاسية",
  },
  {
    id: "farah",
    avatar: farahAvatar,
    nameEn: "Farah",
    nameAr: "فرح",
    roleEn: "Fun & Laughter",
    roleAr: "ضحك ومرح",
  },
];

// --- DIALECTS ---------------------------------------------
const DIALECTS = [
  { id: "msa", labelEn: "Modern Standard Arabic", labelAr: "العربية الفصحى" },
  { id: "jo", labelEn: "Jordanian Arabic", labelAr: "اللهجة الأردنية" },
  { id: "sy", labelEn: "Syrian Arabic", labelAr: "اللهجة السورية" },
  { id: "lb", labelEn: "Lebanese Arabic", labelAr: "اللهجة اللبنانية" },
  { id: "ps", labelEn: "Palestinian Arabic", labelAr: "اللهجة الفلسطينية" },
  { id: "iq", labelEn: "Iraqi Arabic", labelAr: "اللهجة العراقية" },
  { id: "eg", labelEn: "Egyptian Arabic", labelAr: "اللهجة المصرية" },
  { id: "sa", labelEn: "Saudi Arabic", labelAr: "اللهجة السعودية" },
  { id: "ae", labelEn: "Emirati Arabic", labelAr: "اللهجة الإماراتية" },
  { id: "kw", labelEn: "Kuwaiti Arabic", labelAr: "اللهجة الكويتية" },
  { id: "bh", labelEn: "Bahraini Arabic", labelAr: "اللهجة البحرينية" },
  { id: "om", labelEn: "Omani Arabic", labelAr: "اللهجة العُمانية" },
  { id: "ye", labelEn: "Yemeni Arabic", labelAr: "اللهجة اليمنية" },
  { id: "en", labelEn: "English", labelAr: "الإنجليزية" },
];

// --- LANGUAGE ---------------------------------------------
const getInitialLang = () => {
  if (typeof window !== "undefined") {
    return localStorage.getItem("asrar-lang") || "en";
  }
  return "en";
};

const DASHBOARD_TEXT = {
  en: {
    eyebrow: "AI Companions • For the Arab World",
    title: "Select your companion",
    subtitle:
      "Choose who you want to talk to, how you want them to speak, and how you feel right now.",
    dialectLabel: "Communication dialect",
    startButton: "Start chatting",
  },
  ar: {
    eyebrow: "رفاق ذكاء اصطناعي • للعالم العربي",
    title: "اختر رفيقك",
    subtitle:
      "اختر مَن تريد أن تحكي له، وكيف تحب أن يتحدث معك، وما الذي تشعر به الآن.",
    dialectLabel: "لهجة المحادثة",
    startButton: "ابدأ المحادثة",
  },
};

// --- Simple recommendation logic (like home) ---------------
function getCharacterRecommendationFromText(text) {
  if (!text) return "hana";
  const lower = text.toLowerCase();
  const has = (words) => words.some((w) => lower.includes(w));

  if (
    has([
      "lonely",
      "alone",
      "sad",
      "depressed",
      "heartbroken",
      "حزين",
      "وحدي",
      "مكسور",
      "اكتئاب",
    ])
  )
    return "hana";

  if (
    has(["study", "exam", "work", "focus", "دراسة", "امتحان", "شغل", "تركيز"])
  )
    return "rashid";

  if (has(["truth", "honest", "roast", "صارحني", "بلا مجاملة", "جلد"]))
    return "nour";

  if (has(["laugh", "funny", "joke", "memes", "نكت", "ضحك", "مزح"]))
    return "farah";

  if (has(["family", "father", "mother", "parents", "زواج", "عائلة", "أب"]))
    return "abu-zain";

  return "hana";
}

function getMiniReply(message, isAr) {
  const recId = getCharacterRecommendationFromText(message);
  const char = CHARACTERS.find((c) => c.id === recId);

  if (!char) {
    return isAr
      ? "أفهم أن ما كتبته يحمل الكثير. حتى لو شعرت أنك وحدك، أنت لست وحدك هنا."
      : "I can feel there’s a lot in what you wrote. Even if it feels heavy, you’re not alone here.";
  }

  if (isAr) {
    return `من كلامك، أظن أن ${char.nameAr} أنسب رفيق لك الآن. دوره/دورها: ${char.roleAr}.`;
  }

  return `From what you wrote, I’d match you with ${char.nameEn}. Their role: ${char.roleEn}.`;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, setUser, isAuthLoading, logout } = useAuth();

  const [lang, setLang] = useState(getInitialLang);
  const [selectedCharacterId, setSelectedCharacterId] = useState(
    CHARACTERS[0].id
  );
  const [selectedDialect, setSelectedDialect] = useState("");
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [billingSuccess, setBillingSuccess] = useState(false);
  const [miniInput, setMiniInput] = useState("");
  const [miniUserText, setMiniUserText] = useState("");
  const [miniReply, setMiniReplyState] = useState("");

  const isAr = lang === "ar";
  const t = DASHBOARD_TEXT[isAr ? "ar" : "en"];

  // Show loading state while checking auth
  if (isAuthLoading) {
    return (
      <div className={`asrar-dash-page ${isAr ? "asrar-dash-page--ar" : ""}`}>
        <div className="asrar-dash-orbit asrar-dash-orbit--top" />
        <div className="asrar-dash-orbit asrar-dash-orbit--bottom" />
        <div className="asrar-dash-loading">
          <div className="asrar-loading-spinner"></div>
          <p>{isAr ? "جاري تحميل لوحة التحكم..." : "Loading your dashboard..."}</p>
        </div>
      </div>
    );
  }

  // If not authenticated, redirect to login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const handleLangSwitch = (newLang) => {
    setLang(newLang);
    if (typeof window !== "undefined") {
      localStorage.setItem("asrar-lang", newLang);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const getName = (c) => (isAr ? c.nameAr : c.nameEn);
  const getRole = (c) => (isAr ? c.roleAr : c.roleEn);

  const handleMiniSubmit = (e) => {
    e.preventDefault();
    const trimmed = miniInput.trim();
    if (!trimmed) return;

    const recId = getCharacterRecommendationFromText(trimmed);
    setSelectedCharacterId(recId);
    setMiniUserText(trimmed);
    setMiniReplyState(getMiniReply(trimmed, isAr));
    setMiniInput("");
  };

  const hasPremium = !!(user && (user.isPremium || user.plan === "pro" || user.plan === "premium"));

  const handleStartChat = () => {
    if (!selectedDialect) {
      alert(
        isAr
          ? "من فضلك اختر لهجة المحادثة أولاً."
          : "Please choose a communication dialect first."
      );
      return;
    }

    if (!hasPremium && selectedCharacterId !== "hana") {
      alert(isAr ? "للمشتركين في الخطة المدفوعة فقط حالياً." : "For Pro users only for now.");
      return;
    }

    if (typeof window !== "undefined") {
      localStorage.setItem("asrar-selected-character", selectedCharacterId);
      localStorage.setItem("asrar-dialect", selectedDialect);
    }

    navigate("/chat");
  };

  const isFreePlan = !hasPremium;

  const handleCharacterChange = (char) => {
    const locked = !hasPremium && char.id !== "hana";
    if (locked) {
      setShowPremiumModal(true);
      return;
    }
    setSelectedCharacterId(char.id);
  };

  const handleUpgrade = async () => {
    if (!user) {
      navigate("/login?next=/dashboard");
      return;
    }

    // Detect if mobile device
    const isMobile = /iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    if (isMobile) {
      // Mobile: redirect in same tab to avoid popup blockers
      try {
        const { url } = await createCheckoutSession();
        if (url) {
          window.location.href = url;
        } else {
          alert(isAr ? "حدث خطأ عند بدء عملية الدفع." : "Could not start checkout. Please try again.");
        }
      } catch (err) {
        console.error("[Billing] Upgrade error", err);
        const status = err?.status || err?.response?.status;
        if (status === 401) {
          navigate("/login?next=/dashboard");
        } else {
          alert(isAr ? "تعذر إنشاء عملية الدفع حالياً." : "Payment could not be started. Please try again.");
        }
      }
    } else {
      // Desktop: open in new tab
      const newTab = window.open("about:blank", "_blank");

      if (!newTab) {
        // Popup was blocked - show message, do NOT redirect
        alert(
          isAr
            ? "يرجى السماح بالنوافذ المنبثقة لموقع Asrar AI لفتح صفحة الدفع."
            : "Please allow pop-ups for Asrar AI to open the payment page."
        );
        return;
      }

      // Show loading message in new tab
      try {
        newTab.document.write('<html><body style="margin:0;padding:40px;font-family:system-ui,-apple-system,sans-serif;background:#0a0f1a;color:#eaf6ff;text-align:center;"><h2>Loading checkout...</h2><p>Please wait while we prepare your payment page.</p></body></html>');
      } catch (e) {
        // Ignore if we can't write to the tab
      }

      try {
        const { url } = await createCheckoutSession();
        if (url) {
          newTab.location.href = url;
        } else {
          newTab.close();
          alert(isAr ? "حدث خطأ عند بدء عملية الدفع." : "Could not start checkout. Please try again.");
        }
      } catch (err) {
        console.error("[Billing] Upgrade error", err);
        newTab.close();

        const status = err?.status || err?.response?.status;
        if (status === 401) {
          navigate("/login?next=/dashboard");
        } else {
          alert(isAr ? "تعذر إنشاء عملية الدفع حالياً." : "Payment could not be started. Please try again.");
        }
      }
    }
  };

  useEffect(() => {
    // Refresh user on billing=success
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("billing") === "success") {
      (async () => {
        try {
          const res = await fetch(`${API_BASE}/api/auth/me`, {
            method: "GET",
            credentials: "include",
          });
          if (res.ok) {
            const data = await res.json();
            if (data?.user) setUser(data.user);
            if (data?.user?.isPremium) setBillingSuccess(true);
          }
        } catch (e) {
          console.error("/api/auth/me refresh failed", e);
        } finally {
          const url = new URL(window.location.href);
          url.searchParams.delete("billing");
          window.history.replaceState({}, "", url.toString());
        }
      })();
    }
  }, [setUser]);

  return (
    <div
      className={`asrar-dash-page asrar-dashboard-page ${
        isAr ? "asrar-dash-page--ar" : ""
      }`}
    >
      {/* background glows */}
      <div className="asrar-dash-orbit asrar-dash-orbit--top" />
      <div className="asrar-dash-orbit asrar-dash-orbit--bottom" />

      <AsrarHeader
        lang={lang}
        isAr={isAr}
        onLangChange={handleLangSwitch}
        onLogout={handleLogout}
      />

      {/* MAIN */}
      <main className="asrar-dash-main">
        <section
          className="asrar-dash-panel"
          dir={isAr ? "rtl" : "ltr"}
        >
          <p className="asrar-dash-eyebrow">{t.eyebrow}</p>
          <h1 className="asrar-dash-title">{t.title}</h1>
          <p className="asrar-dash-subtitle">{t.subtitle}</p>

          {user?.isPremium ? (
            <div style={{ textAlign: 'center', marginBottom: '12px', color: '#9be7c4' }}>
              ✨ {isAr ? (
                <>أنت على <strong>أسرار بريميوم</strong></>
              ) : (
                <>You’re on <strong>Asrar AI Premium</strong></>
              )}
            </div>
          ) : (
            !hasPremium && (
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
                <button type="button" className="asrar-dash-start-button" onClick={handleUpgrade}>
                  {isAr ? "الترقية إلى بريميوم" : "Upgrade to Premium"}
                </button>
              </div>
            )
          )}

          {billingSuccess && (
            <div style={{ textAlign: 'center', color: '#9be7c4', marginBottom: '10px' }}>
              {isAr ? "✨ تم تفعيل اشتراكك المميز! تم فتح جميع الشخصيات." : "✨ Your premium subscription is active! All characters unlocked."}
            </div>
          )}

          {/* CHARACTERS GRID */}
          <div className="asrar-dash-characters">
            <CharacterCarousel
              characters={CHARACTERS}
              selectedCharacterId={selectedCharacterId}
              onChange={handleCharacterChange}
              isAr={isAr}
              isFreePlan={isFreePlan}
              variant="dashboard"
            />
          </div>

          {/* DIALECT + START BUTTON */}
          <div className="asrar-dash-footer-row">
            <div className="asrar-dash-dialect-block">
              <div className="asrar-dash-dialect-label">
                {t.dialectLabel}
              </div>
              <div className="asrar-dash-dialect-select-shell">
                <select
                  className="asrar-dash-dialect-select"
                  value={selectedDialect}
                  onChange={(e) => setSelectedDialect(e.target.value)}
                >
                  <option value="">
                    {isAr
                      ? "اختر لهجة المحادثة"
                      : "Select a communication dialect"}
                  </option>

                  {DIALECTS.map((d) => (
                    <option key={d.id} value={d.id}>
                      {isAr ? d.labelAr : d.labelEn}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="button"
              className="asrar-dash-start-button"
              onClick={handleStartChat}
            >
              {t.startButton}
            </button>
          </div>
        </section>
      </main>
      <AsrarFooter />

      {showPremiumModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{
            width: 'min(92vw, 420px)', borderRadius: 16, padding: '16px 16px 12px',
            background: 'radial-gradient(circle at top, #061627, #02040d)',
            border: '1px solid rgba(0,240,255,0.35)', color: '#e8f8ff', textAlign: 'center'
          }} role="dialog" aria-modal>
            <h3 style={{ marginTop: 0, marginBottom: 8 }}>
              {isAr ? "شخصية مميزة" : "Premium Character"}
            </h3>
            <p style={{ marginTop: 0, marginBottom: 14, color: '#9bb0c6' }}>
              {isAr ? "قم بالترقية إلى بريميوم لفتح هذه الشخصية وتجربة كاملة." : "Upgrade to Premium to unlock this character and the full experience."}
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button className="asrar-dash-start-button" onClick={handleUpgrade}>
                {isAr ? "الترقية إلى بريميوم" : "Upgrade to Premium"}
              </button>
              <button className="asrar-dash-header-link" onClick={() => setShowPremiumModal(false)}>
                {isAr ? "إغلاق" : "Close"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
