// src/ChatHistory.jsx
import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import "./Dashboard.css";
import AsrarHeader from "./AsrarHeader";
import AsrarFooter from "./AsrarFooter";
import { useAuth } from "./hooks/useAuth";
import CharacterCarousel from "./CharacterCarousel";

import abuZainAvatar from "./assets/abu_zain_2.png";
import hanaAvatar from "./assets/hana_2.png";
import rashidAvatar from "./assets/rashid_2.png";
import nourAvatar from "./assets/nour_2.png";
import farahAvatar from "./assets/farah_2.png";

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

const CHAT_HISTORY_KEY = "asrar-chat-history";

const getInitialLang = () => {
  if (typeof window !== "undefined") {
    return localStorage.getItem("asrar-lang") || "ar";
  }
  return "ar";
};

const TEXT = {
  en: {
    eyebrow: "History",
    title: "Chat history",
    subtitle:
      "Review your recent conversations with each companion. Tap a card to jump back in.",
    emptyGlobal: "You haven't started any conversations yet.",
    noHistoryForChar: "No history yet with this companion.",
    resumeButton: "Resume chat",
  },
  ar: {
    eyebrow: "السجل",
    title: "سجل المحادثات",
    subtitle:
      "استعرض محادثاتك الأخيرة مع كل رفيق. اضغط على أي بطاقة للعودة للمحادثة.",
    emptyGlobal: "لم تبدأ أي محادثة بعد.",
    noHistoryForChar: "لا يوجد سجل بعد مع هذا الرفيق.",
    resumeButton: "متابعة المحادثة",
  },
};

export default function ChatHistory() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [lang, setLang] = useState(getInitialLang);
  const isAr = lang === "ar";
  const t = TEXT[isAr ? "ar" : "en"];

  const [historyMap, setHistoryMap] = useState({});
  const [windowWidth, setWindowWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1200
  );

  const hydrateHistory = useCallback(() => {
    if (!user) {
      setHistoryMap({});
      return;
    }
    if (typeof window === "undefined") return;

    const userId = user.id;
    if (!userId) {
      setHistoryMap({});
      return;
    }

    try {
      const map = {};
      CHARACTERS.forEach((c) => {
        const storageKey = `asrar-chat-history-${userId}-${c.id}`;
        const raw = localStorage.getItem(storageKey);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed) || !parsed.length) return;
        map[c.id] = { messages: parsed };
      });
      console.log("[ChatHistory] hydrated history", {
        userId,
        characters: Object.keys(map),
      });
      setHistoryMap(map);
    } catch (e) {
      console.error("[ChatHistory] Failed to load chat history", e);
      setHistoryMap({});
    }
  }, [user]);

  useEffect(() => {
    hydrateHistory();
  }, [hydrateHistory]);

  useEffect(() => {
    const handleResize = () => {
      if (typeof window === "undefined") return;
      setWindowWidth(window.innerWidth);
    };
    if (typeof window !== "undefined") {
      window.addEventListener("resize", handleResize);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("resize", handleResize);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handleCleared = () => {
      hydrateHistory();
    };
    window.addEventListener("asrar-conversations-deleted", handleCleared);
    return () => {
      window.removeEventListener("asrar-conversations-deleted", handleCleared);
    };
  }, [hydrateHistory]);

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

  const handleOpenChatForCharacter = (id) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("asrar-selected-character", id);
    }
    navigate("/chat");
  };

  const getName = (c) => (isAr ? c.nameAr : c.nameEn);
  const getRole = (c) => (isAr ? c.roleAr : c.roleEn);

  const charactersWithHistory = CHARACTERS.filter((c) => {
    const entry = historyMap[c.id];
    if (!entry || !Array.isArray(entry.messages) || !entry.messages.length) {
      return false;
    }
    // Only count this character if there is at least one user message
    return entry.messages.some((m) => m && m.from === "user");
  });

  const hasAnyHistory = charactersWithHistory.length > 0;
  const isMobile = windowWidth < 768;

  const getLastSnippet = (entry) => {
    if (!entry || !Array.isArray(entry.messages) || !entry.messages.length) {
      return "";
    }
    const reversed = [...entry.messages].reverse();
    const lastContent =
      reversed.find((m) => m.from === "user" || m.from === "ai") ||
      reversed[0];
    const text = lastContent.text || "";
    if (text.length <= 120) return text;
    return text.slice(0, 120) + "…";
  };

  return (
    <div
      className={`asrar-dash-page asrar-dashboard-page asrar-history-page ${
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

      <main className="asrar-dash-main">
        <section
          className="asrar-dash-panel asrar-history-panel"
          dir={isAr ? "rtl" : "ltr"}
        >
          <p className="asrar-dash-eyebrow">{t.eyebrow}</p>
          <h1 className="asrar-dash-title">{t.title}</h1>
          <p className="asrar-dash-subtitle">{t.subtitle}</p>

          {!hasAnyHistory && (
            <p className="asrar-history-empty-global">{t.emptyGlobal}</p>
          )}

          {hasAnyHistory && !isMobile && (
            <div className="asrar-dash-characters">
              <div className="asrar-dash-char-grid">
                {charactersWithHistory.map((c) => {
                  const entry = historyMap[c.id];

                  return (
                    <button
                      key={c.id}
                      type="button"
                      className="asrar-dash-char-card"
                      onClick={() => handleOpenChatForCharacter(c.id)}
                    >
                      <div className="asrar-dash-char-avatar-wrap">
                        <img
                          src={c.avatar}
                          alt={getName(c)}
                          className="asrar-dash-char-avatar"
                        />
                      </div>
                      <div className="asrar-dash-char-text">
                        <div className="asrar-dash-char-name">{getName(c)}</div>
                        <div className="asrar-dash-char-role">{getRole(c)}</div>
                        <div className="asrar-history-snippet">
                          {getLastSnippet(entry)}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {hasAnyHistory && isMobile && charactersWithHistory.length > 1 && (
            <div className="asrar-dash-characters">
              <CharacterCarousel
                characters={charactersWithHistory.map((c) => ({
                  ...c,
                  roleEn: getRole(c),
                  roleAr: getRole(c),
                }))}
                selectedCharacterId={charactersWithHistory[0].id}
                onChange={(char) => handleOpenChatForCharacter(char.id)}
                isAr={isAr}
                variant="dashboard"
                isFreePlan={false}
              />
            </div>
          )}

          {hasAnyHistory && isMobile && charactersWithHistory.length === 1 && (
            <div className="asrar-dash-characters">
              <div className="asrar-dash-char-grid">
                {charactersWithHistory.map((c) => {
                  const entry = historyMap[c.id];

                  return (
                    <button
                      key={c.id}
                      type="button"
                      className="asrar-dash-char-card"
                      onClick={() => handleOpenChatForCharacter(c.id)}
                    >
                      <div className="asrar-dash-char-avatar-wrap">
                        <img
                          src={c.avatar}
                          alt={getName(c)}
                          className="asrar-dash-char-avatar"
                        />
                      </div>
                      <div className="asrar-dash-char-text">
                        <div className="asrar-dash-char-name">{getName(c)}</div>
                        <div className="asrar-dash-char-role">{getRole(c)}</div>
                        <div className="asrar-history-snippet">
                          {getLastSnippet(entry)}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      </main>
      <AsrarFooter />
    </div>
  );
}
