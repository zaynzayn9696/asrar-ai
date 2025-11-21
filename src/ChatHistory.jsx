// src/ChatHistory.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./Dashboard.css";
import AsrarHeader from "./AsrarHeader";
import AsrarFooter from "./AsrarFooter";
import { useAuth } from "./hooks/useAuth";

import abuZainAvatar from "./assets/abu_zain.png";
import hanaAvatar from "./assets/hana.png";
import rashidAvatar from "./assets/rashid.png";
import nourAvatar from "./assets/nour.png";
import farahAvatar from "./assets/farah.png";

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

const CHAT_HISTORY_KEY = "asrar-chat-history";

const getInitialLang = () => {
  if (typeof window !== "undefined") {
    return localStorage.getItem("asrar-lang") || "en";
  }
  return "en";
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

  useEffect(() => {
    if (!user) return;
    if (typeof window === "undefined") return;

    try {
      const raw = localStorage.getItem(CHAT_HISTORY_KEY);
      if (!raw) return;
      const all = JSON.parse(raw);
      const userKey = String(user.id || user.email || "anon");
      const userHist = all[userKey] || {};
      setHistoryMap(userHist);
    } catch (e) {
      console.error("Failed to load chat history", e);
    }
  }, [user]);

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

          {hasAnyHistory && (
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
