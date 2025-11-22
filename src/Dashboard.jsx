// src/Dashboard.jsx
import React, { useState, useRef } from "react";
import "./Dashboard.css";
import AsrarFooter from "./AsrarFooter";
import CharacterCarousel from "./CharacterCarousel";

import abuZainAvatar from "./assets/abu_zain.png";
import hanaAvatar from "./assets/hana.png";
import rashidAvatar from "./assets/rashid.png";
import nourAvatar from "./assets/nour.png";
import farahAvatar from "./assets/farah.png";

import { useNavigate } from "react-router-dom";
import AsrarHeader from "./AsrarHeader";
import { useAuth } from "./hooks/useAuth";

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
  const { user, logout } = useAuth();

  const [lang, setLang] = useState(getInitialLang);
  const isAr = lang === "ar";
  const t = DASHBOARD_TEXT[isAr ? "ar" : "en"];

  const [selectedCharacterId, setSelectedCharacterId] = useState(
    CHARACTERS[0].id
  );
  const [selectedDialect, setSelectedDialect] = useState("");

  // mini mood chat (you can use later if you want)
  const [miniInput, setMiniInput] = useState("");
  const [miniUserText, setMiniUserText] = useState("");
  const [miniReply, setMiniReplyState] = useState("");

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

  const handleStartChat = () => {
    if (!selectedDialect) {
      alert(
        isAr
          ? "من فضلك اختر لهجة المحادثة أولاً."
          : "Please choose a communication dialect first."
      );
      return;
    }

    if (isFreePlan && selectedCharacterId !== "hana") {
      alert(isAr ? "للمشتركين في الخطة المدفوعة فقط حالياً." : "For Pro users only for now.");
      return;
    }

    if (typeof window !== "undefined") {
      localStorage.setItem("asrar-selected-character", selectedCharacterId);
      localStorage.setItem("asrar-dialect", selectedDialect);
    }

    navigate("/chat");
  };

  const isFreePlan = !user || user.plan !== "pro";

  const handleCharacterChange = (char) => {
    setSelectedCharacterId(char.id);
  };

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
    </div>
  );
}
