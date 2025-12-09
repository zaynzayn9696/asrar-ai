// src/Dashboard.jsx
import React, { useEffect, useState, useRef } from "react";
import "./Dashboard.css";
import AsrarFooter from "./AsrarFooter";
import CharacterCarousel from "./CharacterCarousel";
import HomeSplash from "./components/HomeSplash";

import abuZainAvatar from "./assets/abu_zain_2.png";
import hanaAvatar from "./assets/nour_2.png";
import rashidAvatar from "./assets/rashid_2.png";
import nourAvatar from "./assets/hana_2.png";
import farahAvatar from "./assets/farah_2.png";

import { useNavigate, Navigate, useLocation } from "react-router-dom";
import AsrarHeader from "./AsrarHeader";
import { useAuth } from "./hooks/useAuth";
import { API_BASE } from "./apiBase";
import { createCheckoutSession } from "./api/billing";

// --- CHARACTERS (same 5 core) -----------------------------
const CHARACTERS = [
  {
    id: "sheikh-al-hara",
    avatar: abuZainAvatar,
    nameEn: "Sheikh Al-Hara",
    nameAr: "شيخ الحارة",
    roleEn: "Guidance",
    roleAr: "إرشاد وحكمة",
  },
  {
    id: "daloua",
    avatar: hanaAvatar,
    nameEn: "Daloua",
    nameAr: "دلوعة",
    roleEn: "Deep Support",
    roleAr: "دعم عاطفي عميق",
  },
  {
    id: "abu-mukh",
    avatar: rashidAvatar,
    nameEn: "Abu Mo5",
    nameAr: "أبو مخ",
    roleEn: "Focus & Study",
    roleAr: "تركيز ودراسة",
  },
  {
    id: "walaa",
    avatar: nourAvatar,
    nameEn: "Walaaa",
    nameAr: "ولاااء",
    roleEn: "Brutal Honesty",
    roleAr: "صراحة قاسية",
  },
  {
    id: "hiba",
    avatar: farahAvatar,
    nameEn: "HHHiba",
    nameAr: "هههبة",
    roleEn: "Fun & Laughter",
    roleAr: "ضحك ومرح",
  },
];

const FREE_CHARACTER_IDS = ["sheikh-al-hara", "abu-mukh", "daloua"];

// --- DIALECTS ---------------------------------------------
const DIALECTS = [
  { id: "msa", labelEn: "Modern Standard Arabic", labelAr: "العربية الفصحى الحديثة" },
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
  { id: "en", labelEn: "English", labelAr: "اللغة الإنجليزية" },
];

// --- LANGUAGE ---------------------------------------------
const getInitialLang = () => {
  if (typeof window !== "undefined") {
    return localStorage.getItem("asrar-lang") || "ar";
  }
  return "ar";
};

const DASHBOARD_TEXT = {
  en: {
    welcomeBack: "Welcome back",
    emotionalSpace: "Your emotional space is ready.",
    startChatting: "Start chatting",
    chatHistory: "Chat history",
    yourCompanions: "Your Companions",
    selectCompanion: "Choose who you want to talk to today",
    upgradeTitle: "Unlock all 5 companions",
    upgradeSubtitle:
      "Go Premium to talk to every character, keep longer history and remove limits.",
    upgradeCta: "Upgrade to Premium",
    talkTo: "Talk to",
    dialectLabel: "Communication dialect",
    selectDialect: "Select a communication dialect",
  },
  ar: {
    welcomeBack: "أهلاً بعودتك",
    emotionalSpace: "مساحتك العاطفية جاهزة.",
    startChatting: "ابدأ المحادثة",
    chatHistory: "سجل المحادثات",
    yourCompanions: "رفاقك",
    selectCompanion: "اختر من تريد التحدث معه اليوم",
    upgradeTitle: "افتح كل الرفقاء الخمسة",
    upgradeSubtitle:
      "رقِّ حسابك إلى بريميوم لتتحدث مع جميع الشخصيات وتزيد حدود الرسائل وتحصل على تجربة كاملة.",
    upgradeCta: "الترقية إلى بريميوم",
    talkTo: "تحدث مع",
    dialectLabel: "لهجة المحادثة",
    selectDialect: "اختر لهجة المحادثة",
  },
};

// --- Simple recommendation logic (like home) ---------------
function getCharacterRecommendationFromText(text) {
  if (!text) return "daloua";
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
    return "daloua";

  if (
    has(["study", "exam", "work", "focus", "دراسة", "امتحان", "شغل", "تركيز"])
  )
    return "abu-mukh";

  if (has(["truth", "honest", "roast", "صارحني", "بلا مجاملة", "جلد"]))
    return "walaa";

  if (has(["laugh", "funny", "joke", "memes", "نكت", "ضحك", "مزح"]))
    return "hiba";

  if (has(["family", "father", "mother", "parents", "زواج", "عائلة", "أب"]))
    return "sheikh-al-hara";

  return "daloua";
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
  const location = useLocation();

  // Determine initial selected character from route state or localStorage
  let initialSelectedId = CHARACTERS[0].id;
  const routeCharId =
    location && location.state && location.state.characterId;
  if (routeCharId && CHARACTERS.some((c) => c.id === routeCharId)) {
    initialSelectedId = routeCharId;
  } else if (typeof window !== "undefined") {
    try {
      const stored = window.localStorage.getItem("asrar-selected-character");
      if (stored && CHARACTERS.some((c) => c.id === stored)) {
        initialSelectedId = stored;
      }
    } catch (_) {}
  }

  const [lang, setLang] = useState(getInitialLang);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [selectedCharacterId, setSelectedCharacterId] = useState(
    initialSelectedId
  );
  const [selectedDialect, setSelectedDialect] = useState("");
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [billingSuccess, setBillingSuccess] = useState(false);
  const [sliderIndex, setSliderIndex] = useState(() => {
    const idx = CHARACTERS.findIndex((c) => c.id === initialSelectedId);
    return idx >= 0 ? idx : 0;
  });
  const [windowWidth, setWindowWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1200
  );
  const [validationError, setValidationError] = useState("");

  const sliderTouchStartXRef = useRef(null);
  const sliderTouchDeltaXRef = useRef(0);

  const goToSliderIndex = (nextIndex) => {
    const maxIndex = CHARACTERS.length - 1;
    const clamped = Math.max(0, Math.min(maxIndex, nextIndex));
    setSliderIndex(clamped);
    const char = CHARACTERS[clamped];
    if (char && char.id !== selectedCharacterId) {
      setSelectedCharacterId(char.id);
    }
  };

  const handleSliderTouchStart = (event) => {
    if (!event.touches || event.touches.length !== 1) return;
    const touch = event.touches[0];
    sliderTouchStartXRef.current = touch.clientX;
    sliderTouchDeltaXRef.current = 0;
  };

  const handleSliderTouchMove = (event) => {
    if (sliderTouchStartXRef.current == null || !event.touches) return;
    const touch = event.touches[0];
    sliderTouchDeltaXRef.current =
      touch.clientX - sliderTouchStartXRef.current;
  };

  const handleSliderTouchEnd = () => {
    const deltaX = sliderTouchDeltaXRef.current;
    sliderTouchStartXRef.current = null;
    sliderTouchDeltaXRef.current = 0;

    const threshold = 40;
    if (Math.abs(deltaX) < threshold) return;

    if (deltaX < 0) {
      goToSliderIndex(sliderIndex + 1);
    } else {
      goToSliderIndex(sliderIndex - 1);
    }
  };

  const isAr = lang === "ar";
  const t = DASHBOARD_TEXT[isAr ? "ar" : "en"];
  const isDesktop = windowWidth >= 1200;
  const isTablet = windowWidth >= 768 && windowWidth < 1200;
  const isMobile = windowWidth < 768;

  useEffect(() => {
    const tId = setTimeout(() => setIsPageLoading(false), 900);
    return () => clearTimeout(tId);
  }, []);

  if (isPageLoading) {
    return <HomeSplash />;
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
    setValidationError("");
    
    if (!selectedCharacterId) {
      setValidationError(isAr ? "يرجى اختيار رفيق أولاً" : "Please select a companion first");
      return;
    }
    
    if (!selectedDialect) {
      setValidationError(
        isAr
          ? "يرجى اختيار لهجة المحادثة"
          : "Please select a communication dialect"
      );
      return;
    }

    if (!hasPremium && !FREE_CHARACTER_IDS.includes(selectedCharacterId)) {
      setValidationError(isAr ? "للمشتركين في الخطة المدفوعة فقط حالياً" : "For Pro users only for now");
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
    const locked = !hasPremium && !FREE_CHARACTER_IDS.includes(char.id);
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

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

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

        {/* COMPANIONS SECTION */}
        <section className="asrar-companions-section" dir={isAr ? "rtl" : "ltr"}>
          <div className="asrar-companions-header">
            <h2 className="asrar-companions-title">{t.yourCompanions}</h2>
            <p className="asrar-companions-subtitle">{t.selectCompanion}</p>
          </div>

          {/* Upgrade teaser for free users */}
          {isFreePlan && (
            <div
              className="asrar-dash-upgrade-teaser"
              dir={isAr ? "rtl" : "ltr"}
            >
              <div className="asrar-dash-upgrade-teaser-text">
                <h3 className="asrar-dash-upgrade-title">{t.upgradeTitle}</h3>
                <p className="asrar-dash-upgrade-subtitle">
                  {t.upgradeSubtitle}
                </p>
              </div>
              <button
                type="button"
                className="asrar-dash-upgrade-btn"
                onClick={handleUpgrade}
              >
                {t.upgradeCta}
              </button>
            </div>
          )}

          {/* DESKTOP: 5-COLUMN GRID */}
          {isDesktop && (
            <div className="asrar-companions-grid">
              {CHARACTERS.map((char) => (
                <div
                  key={char.id}
                  className={`asrar-companion-card ${
                    selectedCharacterId === char.id ? "asrar-companion-card--selected" : ""
                  } ${!hasPremium && !FREE_CHARACTER_IDS.includes(char.id) ? "asrar-companion-card--locked" : ""}`}
                  onClick={() => handleCharacterChange(char)}
                >
                  <img
                    src={char.avatar}
                    alt={isAr ? char.nameAr : char.nameEn}
                    className="asrar-companion-card-image"
                  />
                  <div className="asrar-companion-card-content">
                    <h3 className="asrar-companion-card-name">
                      {isAr ? char.nameAr : char.nameEn}
                    </h3>
                    <p className="asrar-companion-card-role">
                      {isAr ? char.roleAr : char.roleEn}
                    </p>
                  </div>
                  {!hasPremium && !FREE_CHARACTER_IDS.includes(char.id) && (
                    <div className="asrar-companion-pro-badge">PRO</div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* TABLET/MOBILE: SLIDER */}
          {(isTablet || isMobile) && (
            <div className="asrar-companions-slider-wrapper" dir="ltr">
              <button
                className="asrar-slider-arrow asrar-slider-arrow-prev"
                onClick={() => goToSliderIndex(sliderIndex - 1)}
                disabled={sliderIndex === 0}
              >
                ‹
              </button>
              <div className="asrar-companions-slider" dir="ltr">
                <div
                  className="asrar-companions-slider-track"
                  style={{
                    transform: `translateX(${-sliderIndex * 100}%)`,
                  }}
                  onTouchStart={handleSliderTouchStart}
                  onTouchMove={handleSliderTouchMove}
                  onTouchEnd={handleSliderTouchEnd}
                >
                  {CHARACTERS.map((char) => (
                    <div key={char.id} className="asrar-companions-slider-item">
                      <div
                        className={`asrar-companion-card ${
                          selectedCharacterId === char.id ? "asrar-companion-card--selected" : ""
                        } ${!hasPremium && !FREE_CHARACTER_IDS.includes(char.id) ? "asrar-companion-card--locked" : ""}`}
                        onClick={() => handleCharacterChange(char)}
                      >
                        <img
                          src={char.avatar}
                          alt={isAr ? char.nameAr : char.nameEn}
                          className="asrar-companion-card-image"
                        />
                        <div className="asrar-companion-card-content">
                          <h3 className="asrar-companion-card-name">
                            {isAr ? char.nameAr : char.nameEn}
                          </h3>
                          <p className="asrar-companion-card-role">
                            {isAr ? char.roleAr : char.roleEn}
                          </p>
                        </div>
                        {!hasPremium && !FREE_CHARACTER_IDS.includes(char.id) && (
                          <div className="asrar-companion-pro-badge">PRO</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <button
                className="asrar-slider-arrow asrar-slider-arrow-next"
                onClick={() => goToSliderIndex(sliderIndex + 1)}
                disabled={sliderIndex === CHARACTERS.length - 1}
              >
                ›
              </button>
            </div>
          )}
        </section>

        {/* DIALECT + START CARD */}
        <div className="asrar-start-card" dir={isAr ? "rtl" : "ltr"}>
          <div className="asrar-start-card-inner">
            <label className="asrar-dialect-label">{t.dialectLabel}</label>
            <select
              className="asrar-dialect-select"
              value={selectedDialect}
              onChange={(e) => setSelectedDialect(e.target.value)}
            >
              <option value="">{t.selectDialect}</option>
              {DIALECTS.map((d) => (
                <option key={d.id} value={d.id}>
                  {isAr ? d.labelAr : d.labelEn}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="asrar-btn asrar-btn-start-primary"
              onClick={handleStartChat}
              disabled={!selectedCharacterId || !selectedDialect}
            >
              {t.startChatting}
            </button>
          </div>
          {validationError && (
            <div className="asrar-validation-error">{validationError}</div>
          )}
        </div>

      </main>
      <AsrarFooter />

      {showPremiumModal && (
        <div className="asrar-upgrade-layer" role="dialog" aria-modal="true">
          <div
            className="asrar-upgrade-overlay"
            onClick={() => setShowPremiumModal(false)}
          ></div>
          <div className="asrar-upgrade-panel">
            <button
              type="button"
              className="asrar-upgrade-close"
              aria-label="Close upgrade modal"
              onClick={() => setShowPremiumModal(false)}
            >
              &times;
            </button>
            <h3>
              {isAr ? "شخصية مميزة" : "Premium Character"}
            </h3>
            <p>
              {isAr ? "قم بالترقية إلى بريميوم لفتح هذه الشخصية وتجربة كاملة." : "Upgrade to Premium to unlock this character and the full experience."}
            </p>
            <div className="asrar-upgrade-actions">
              <button className="asrar-dash-start-button" onClick={handleUpgrade} style={{ flex: '1 1 180px' }}>
                {isAr ? "الترقية إلى بريميوم" : "Upgrade to Premium"}
              </button>
              <button
                type="button"
                className="asrar-upgrade-cancel"
                onClick={() => setShowPremiumModal(false)}
                style={{ flex: '1 1 180px' }}
              >
                {isAr ? "إغلاق" : "Close"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


