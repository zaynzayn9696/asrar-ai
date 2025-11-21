import AsrarFooter from "./AsrarFooter";
import { Link } from "react-router-dom";
import React, { useState, useRef } from "react";
import "./HomePage.css";
import asrarLogo from "./assets/asrar-logo.png";
import abuZainAvatar from "./assets/abu_zain.png";
import hanaAvatar from "./assets/hana.png";
import rashidAvatar from "./assets/rashid.png";
import nourAvatar from "./assets/nour.png";
import farahAvatar from "./assets/farah.png";
import { useAuth } from "./hooks/useAuth";
import CharacterCarousel from "./CharacterCarousel";

// --- CORE 5 CHARACTERS ONLY -----------------------------------------
const CHARACTERS = [
  {
    id: "abu-zain",
    avatar: abuZainAvatar,
    nameEn: "Abu Zain",
    nameAr: "أبو زين",
    roleEn: "Guidance",
    roleAr: "إرشاد وحكمة",
    descriptionEn:
      "Warm, wise, grounded. Gives life lessons, emotional stability, and gentle guidance.",
    descriptionAr:
      "هادئ وحكيم ومتزن. يمنحك نصائح حياتية وتوازناً عاطفياً وإرشاداً صادقاً.",
  },
  {
    id: "hana",
    avatar: hanaAvatar,
    nameEn: "Hana",
    nameAr: "هَنا",
    roleEn: "Deep Support",
    roleAr: "دعم عاطفي عميق",
    descriptionEn:
      "Gentle, validating, reassuring. Helps with overthinking, sadness, loneliness, and stress.",
    descriptionAr:
      "لطيفة وتتفهم مشاعرك. تساعدك مع كثرة التفكير والحزن والوحدة والضغط.",
  },
  {
    id: "rashid",
    avatar: rashidAvatar,
    nameEn: "Rashid",
    nameAr: "راشد",
    roleEn: "Focus & Study",
    roleAr: "تركيز ودراسة",
    descriptionEn:
      "Structured, strategic, motivational. Helps with studying, planning, and routines.",
    descriptionAr:
      "منظّم واستراتيجي ومحفّز. يساعدك في الدراسة، التخطيط، والعادات اليومية.",
  },
  {
    id: "nour",
    avatar: nourAvatar,
    nameEn: "Nour",
    nameAr: "نور",
    roleEn: "Brutal Honesty",
    roleAr: "صراحة قاسية",
    descriptionEn:
      "Unfiltered, sharp, sarcastic. Tells you the truth with good intentions, no sugar-coating.",
    descriptionAr:
      "صريح بدون فلتر، حاد وساخر. يقول لك الحقيقة بنية طيبة بدون تلميع.",
  },
  {
    id: "farah",
    avatar: farahAvatar,
    nameEn: "Farah",
    nameAr: "فرح",
    roleEn: "Fun & Laughter",
    roleAr: "ضحك ومرح",
    descriptionEn:
      "Light-hearted, witty, sarcastic. Jokes, memes, and playful energy.",
    descriptionAr:
      "خفيفة ظل ومرحة وساخرة. نكت، ميمز، وطاقة ضحك ولعب.",
  },
];

// --- RECOMMENDATION LOGIC -------------------------------------------
function getCharacterRecommendation(message) {
  if (!message) return null;
  const text = message.toLowerCase();
  const hasAny = (words) => words.some((w) => text.includes(w));

  if (
    hasAny([
      // English sadness / loneliness
      "sad",
      "sadness",
      "lonely",
      "loneliness",
      "alone",
      "heartbroken",
      "broken heart",
      "empty",
      "numb",
      "down",
      "upset",
      "hurt",
      "depressed",
      "depression",
      "grief",
      "grieving",
      "anxious",
      "anxiety",
      "stressed",
      "stressed out",
      "overthinking",
      "overthink",
      "overwhelmed",
      "panic",
      "panic attack",
      "worried",
      "worry",
      "nervous",
      "tired",
      "exhausted",
      "drained",
      "burnout",
      "burned out",
      "burnt out",
      "bored",
      "boring",
      "boredom",
      "funny",
      "laugh",
      "laughing",
      "angry",
      "mad",
      "pissed",
      "frustrated",
      "jealous",
      "jealousy",
      "envy",
      "envious",
      "insecure",
      "worthless",
      "hopeless",
      "guilty",
      "guilt",
      "ashamed",
      "shame",
      "fear",
      "scared",
      // Arabic emotion words (common)
      "حزين",
      "حزينة",
      "حزن",
      "زعلان",
      "زعل",
      "مكسور",
      "مقهور",
      "قهر",
      "وحدة",
      "وحيد",
      "وحيدة",
      "مهموم",
      "ضيق",
      "ضيقة",
      "اكتئاب",
      "مكتئب",
      "قلق",
      "قلقان",
      "توتر",
      "متوتر",
      "خوف",
      "خايف",
      "مرعوب",
      "تعبان",
      "تعب",
      "مرهق",
      "منهك",
      "طفشان",
      "طفش",
      "زهقان",
      "ملل",
      "معصب",
      "عصبية",
      "غضبان",
      "غضب",
    ])
  ) {
    return "hana";
  }
  if (
    hasAny([
      // English anxiety / stress
      "anxious",
      "anxiety",
      "overthinking",
      "overthink",
      "panic",
      "panic attack",
      "worried",
      "worry",
      "nervous",
      "overwhelmed",
      "stressed",
      "stressed out",
      "pressure",
      "under pressure",
      // Arabic anxiety / stress
      "قلق",
      "قلقان",
      "توتر",
      "متوتر",
      "خوف",
      "خايف",
      "مرعوب",
      "مضغوط",
      "ضغط",
    ])
  ) {
    return "hana";
  }
  if (
    hasAny([
      // English low motivation / stuck
      "unmotivated",
      "no motivation",
      "lazy",
      "stuck",
      "no energy",
      "low energy",
      "procrastinate",
      "procrastinating",
      "procrastination",
      "can't focus",
      "cant focus",
      "hard to focus",
      // Arabic low motivation
      "كسل",
      "كسلان",
      "بدون طاقة",
      "مافي طاقة",
      "ما في طاقة",
      "خمول",
      "مو مركز",
      "مش مركز",
    ])
  ) {
    return "rashid";
  }
  if (
    hasAny([
      // English study / work
      "study",
      "studying",
      "homework",
      "assignment",
      "exam",
      "exams",
      "test",
      "university",
      "college",
      "school",
      "focus",
      "concentrate",
      "work",
      "job",
      "career",
      "project",
      "deadline",
      // Arabic study / work
      "دراسة",
      "ادرس",
      "أدرس",
      "امتحان",
      "امتحانات",
      "جامعة",
      "مدرسة",
      "شغل",
      "وظيفة",
      "مشروع",
      "دوام",
    ])
  ) {
    return "rashid";
  }
  if (
    hasAny([
      // English brutal honesty / roast
      "truth",
      "be honest",
      "honest",
      "no bullshit",
      "no bs",
      "no filter",
      "brutal",
      "brutally honest",
      "roast",
      "roast me",
      // Arabic directness
      "صارحني",
      "بدون مجاملة",
      "بدون مجاملات",
      "جلد",
    ])
  ) {
    return "nour";
  }
  if (
    hasAny([
      // English fun / boredom
      "bored",
      "boring",
      "boredom",
      "need fun",
      "something fun",
      "funny",
      "laugh",
      "laughing",
      "joke",
      "jokes",
      "meme",
      "memes",
      "lol",
      // Arabic fun / boredom
      "طفشان",
      "طفش",
      "زهقان",
      "ملل",
      "نكت",
      "ضحك",
      "اضحك",
      "أضحك",
      "ميمز",
    ])
  ) {
    return "farah";
  }
  if (
    hasAny([
      // English family / life guidance
      "family",
      "father",
      "dad",
      "mother",
      "mom",
      "parents",
      "marriage",
      "married",
      "wife",
      "husband",
      "relationship",
      "relationships",
      // Arabic family / life guidance
      "أب",
      "ابو",
      "أبو",
      "أم",
      "امي",
      "أمي",
      "أهل",
      "عائلة",
      "زواج",
      "متزوج",
      "زوجتي",
      "زوجي",
      "خطوبة",
    ])
  ) {
    return "abu-zain";
  }
  if (
    hasAny([
      // English exhaustion / burnout
      "tired",
      "exhausted",
      "drained",
      "burnout",
      "burned out",
      "burnt out",
      // Arabic exhaustion / burnout
      "تعبان",
      "تعب",
      "مرهق",
      "منهك",
    ])
  ) {
    return "abu-zain";
  }

  // default soft landing
  return "hana";
}

function getMiniChatReply(message, isAr) {
  const raw = message || "";
  const trimmed = raw.trim();

  if (!trimmed) {
    return {
      charId: null,
      text: isAr
        ? "اكتب لي جملة أو جملتين عن يومك أو الشيء اللي مضايقك، عشان أقدر أساعدك أكثر."
        : "Try writing one or two sentences about your day or what’s bothering you so I can actually help.",
    };
  }

  const words = trimmed.split(/\s+/).filter(Boolean);
  const isVeryShort = trimmed.length < 14 || words.length <= 2;

  const lower = trimmed.toLowerCase();
  const knownKeywords = [
    // English emotion / state words
    "sad",
    "sadness",
    "lonely",
    "loneliness",
    "alone",
    "heartbroken",
    "broken heart",
    "depressed",
    "depression",
    "down",
    "upset",
    "hurt",
    "empty",
    "numb",
    "grief",
    "grieving",
    "anxious",
    "anxiety",
    "stressed",
    "stressed out",
    "overthinking",
    "overthink",
    "overwhelmed",
    "panic",
    "panic attack",
    "worried",
    "worry",
    "nervous",
    "tired",
    "exhausted",
    "drained",
    "burnout",
    "burned out",
    "burnt out",
    "bored",
    "boring",
    "boredom",
    "funny",
    "laugh",
    "laughing",
    "angry",
    "mad",
    "pissed",
    "frustrated",
    "jealous",
    "jealousy",
    "envy",
    "envious",
    "insecure",
    "worthless",
    "hopeless",
    "guilty",
    "guilt",
    "ashamed",
    "shame",
    "fear",
    "scared",
    // Arabic emotion words (common)
    "حزين",
    "حزينة",
    "حزن",
    "زعلان",
    "زعل",
    "مكسور",
    "مقهور",
    "قهر",
    "وحدة",
    "وحيد",
    "وحيدة",
    "مهموم",
    "ضيق",
    "ضيقة",
    "اكتئاب",
    "مكتئب",
    "قلق",
    "قلقان",
    "توتر",
    "متوتر",
    "خوف",
    "خايف",
    "مرعوب",
    "تعبان",
    "تعب",
    "مرهق",
    "منهك",
    "طفشان",
    "طفش",
    "زهقان",
    "ملل",
    "معصب",
    "عصبية",
    "غضبان",
    "غضب",
  ];

  const hasKnownKeyword = knownKeywords.some((kw) => lower.includes(kw));

  // Very short input *without* any known emotional keyword → treat as unclear / gibberish.
  if (isVeryShort && !hasKnownKeyword) {
    return {
      charId: null,
      text: isAr
        ? "ما قدرت أفهم الكلمة اللي كتبتها. جرّب تكتب بجملك البسيطة عن شعورك أو عن الشيء اللي صاير معك عشان أقدر أفهمك أكثر."
        : "I couldn’t really understand what you wrote. Try using simple words to describe how you feel or what’s happening so I can follow you.",
    };
  }

  const recId = getCharacterRecommendation(trimmed);
  const char = recId && CHARACTERS.find((c) => c.id === recId);

  if (!char) {
    return {
      charId: null,
      text: isAr
        ? "أشعر بثقل الكلام الذي كتبته، وهذا مكان آمن تماماً لفضفضتك. حتى لو شعرت أنك وحدك، أنت لست وحدك هنا."
        : "I can feel there’s a lot in what you wrote. This is a safe place to unload – even if it feels like you’re alone, you’re not alone here.",
    };
  }

  if (isAr) {
    const intro = "أفهم أن ما كتبته ليس سهلاً، وشعورك مُهم هنا.";
    const body = `من بين رفقاء أسرار، أرى أن ${char.nameAr} (${char.roleAr}) أنسب رفيق لك الآن. ${char.descriptionAr}`;
    const ctaHint = "تقدر تبدأ محادثة كاملة معه/معها من الزر بالأسفل.";
    return {
      charId: recId,
      text: `${intro} ${body} ${ctaHint}`,
    };
  }

  const intro = "I can tell what you shared isn’t easy, and your feelings matter here.";
  const body = `Out of the Asrar companions, I’d match you with ${char.nameEn} (${char.roleEn}) right now. ${char.descriptionEn}`;
  const ctaHint = "You can start a full conversation with them using the button below.";

  return {
    charId: recId,
    text: `${intro} ${body} ${ctaHint}`,
  };
}

export default function HomePage() {
  // language + mood gate
  const { user, loading } = useAuth(); // 
  const [language, setLanguage] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("asrar-lang") || "en";
    }
    return "en";
  });
  const [moodInput, setMoodInput] = useState("");
  const [submittedMood, setSubmittedMood] = useState("");
  const [recommendedId, setRecommendedId] = useState(null);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  // MINI CHAT STATE
  const [miniChatInput, setMiniChatInput] = useState("");
  const [miniChatUserText, setMiniChatUserText] = useState("");
  const [miniChatReply, setMiniChatReply] = useState(null);

  const [selectedCharacterId, setSelectedCharacterId] = useState(
    CHARACTERS[0].id
  );
  const selectedCharacter =
    CHARACTERS.find((c) => c.id === selectedCharacterId) || CHARACTERS[0];

  const isAr = language === "ar";
  const miniChatInputRef = useRef(null);
  const sliderTouchStartXRef = useRef(null);
  const sliderTouchDeltaXRef = useRef(0);
  const sliderRef = useRef(null);
  const scrollByAmount = 320;
  const scrollLeft = () => {
    if (sliderRef.current) {
      sliderRef.current.scrollBy({ left: -scrollByAmount, behavior: "smooth" });
    }
  };
  const scrollRight = () => {
    if (sliderRef.current) {
      sliderRef.current.scrollBy({ left: scrollByAmount, behavior: "smooth" });
    }
  };

  const navItems = isAr
    ? [
        { href: "#hero", label: "الرئيسية" },
        { href: "#about", label: "من نحن" },
        { href: "#characters", label: "الشخصيات" },
        { href: "#security-privacy", label: "الأمان والخصوصية" },
        { href: "#how-it-works", label: "كيف يعمل؟" },
        { href: "#pricing", label: "الأسعار" },
      ]
    : [
        { href: "#hero", label: "Home" },
        { href: "#about", label: "About" },
        { href: "#characters", label: "Characters" },
        { href: "#security-privacy", label: "Security & Privacy" },
        { href: "#how-it-works", label: "How it works" },
        { href: "#pricing", label: "Pricing" },
      ];

  const brandLabel = "ASRAR AI";

  const authLabels = isAr
    ? { login: "تسجيل الدخول", signup: "أنشئ حسابًا" }
    : { login: "Login", signup: "Create Account" };

  const chatInputTitle = isAr ? "اكتب رسالتك" : "Compose your message";
  const chatInputSubtitle = isAr
    ? "هذا سيصل مباشرة إلى رفيقك"
    : "Goes straight to your companion";
  const chatInputFootnote = isAr
    ? "اضغط Enter للإرسال • استخدم Shift+Enter لسطر جديد"
    : "Press Enter to send • Shift+Enter for a new line";

  const handleMiniChatChange = (event) => {
    const textarea = event.target;
    setMiniChatInput(textarea.value);
    textarea.style.height = "auto";
    const nextHeight = Math.min(textarea.scrollHeight, 240);
    textarea.style.height = `${Math.max(nextHeight, 120)}px`;
  };

  const sendMiniChat = () => {
    const trimmed = miniChatInput.trim();
    if (!trimmed) return;

    setMiniChatUserText(trimmed);
    setMiniChatReply(getMiniChatReply(trimmed, isAr));
    setMiniChatInput("");

    if (miniChatInputRef.current) {
      miniChatInputRef.current.style.height = "120px";
    }
  };

  const handleMiniChatSubmit = (e) => {
    e.preventDefault();
    sendMiniChat();
  };

  const handleMiniChatKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMiniChat();
    }
  };

  const handleMoodSubmit = (e) => {
    e.preventDefault();
    const trimmed = moodInput.trim();
    if (!trimmed) return;
    const recId = getCharacterRecommendation(trimmed);
    setSubmittedMood(trimmed);
    setRecommendedId(recId);

    const recIndex = CHARACTERS.findIndex((c) => c.id === recId);
    if (recIndex >= 0) {
      setSelectedCharacterId(CHARACTERS[recIndex].id);
    }
  };

  const handleResetMood = () => {
    setMoodInput("");
    setSubmittedMood("");
    setRecommendedId(null);
  };

  const handleCharacterPrev = () => {
    setCurrentCharacterIndex((prev) =>
      prev === 0 ? CHARACTERS.length - 1 : prev - 1
    );
  };

  const handleCharacterNext = () => {
    setCurrentCharacterIndex((prev) =>
      prev === CHARACTERS.length - 1 ? 0 : prev + 1
    );
  };

  const handleCharacterTouchStart = (event) => {
    if (!event.touches || event.touches.length !== 1) return;
    const touch = event.touches[0];
    sliderTouchStartXRef.current = touch.clientX;
    sliderTouchDeltaXRef.current = 0;
  };

  const handleCharacterTouchMove = (event) => {
    if (sliderTouchStartXRef.current == null || !event.touches) return;
    const touch = event.touches[0];
    sliderTouchDeltaXRef.current = touch.clientX - sliderTouchStartXRef.current;
  };

  const handleCharacterTouchEnd = () => {
    const deltaX = sliderTouchDeltaXRef.current;
    sliderTouchStartXRef.current = null;
    sliderTouchDeltaXRef.current = 0;

    const threshold = 40;
    if (Math.abs(deltaX) < threshold) return;

    if (deltaX < 0) {
      handleCharacterNext();
    } else {
      handleCharacterPrev();
    }
  };

  const handleNavClick = (href) => {
    if (!href || !href.startsWith("#")) return;
    const id = href.slice(1);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handleLanguageSwitch = (lang) => {
    setLanguage(lang);
    if (typeof window !== "undefined") {
      localStorage.setItem("asrar-lang", lang);
    }
  };

  const handleGoToCharacter = (id) => {
    const el = document.getElementById(`character-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    setIsMobileNavOpen(false);
  };

  const recommendedCharacter =
    recommendedId && CHARACTERS.find((c) => c.id === recommendedId);

  const miniChatCharacter =
    miniChatReply?.charId &&
    CHARACTERS.find((c) => c.id === miniChatReply.charId);

  const getName = (c) => (isAr ? c.nameAr : c.nameEn);
  const getRole = (c) => (isAr ? c.roleAr : c.roleEn);
  const getDesc = (c) => (isAr ? c.descriptionAr : c.descriptionEn);

  return (
    <div className={`asrar-page ${isAr ? "asrar-page--ar" : ""}`}>
      {/* HEADER */}
      <header className="asrar-header">
        <div className="asrar-header-left">
          <a href="#hero" className="asrar-brand-text">
            {brandLabel}
          </a>
        </div>

        <nav className="asrar-nav-wrapper">
          <nav
            className={`asrar-nav ${
              isMobileNavOpen ? "asrar-nav--open" : ""
            }`}
          >
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={(e) => {
                  e.preventDefault();
                  handleNavClick(item.href);
                  setIsMobileNavOpen(false);
                }}
              >
                {item.label}
              </a>
            ))}
          </nav>
        </nav>

        <div className="asrar-header-right">
          <div className="asrar-lang-toggle">
            <button
              className={language === "en" ? "active" : ""}
              onClick={() => handleLanguageSwitch("en")}
            >
              EN
            </button>
            <button
              className={language === "ar" ? "active" : ""}
              onClick={() => handleLanguageSwitch("ar")}
            >
              عربي
            </button>
          </div>
          {!loading && !user && (
            <>
              <Link to="/login" className="asrar-btn ghost">
                {authLabels.login}
              </Link>
              <Link to="/create-account" className="asrar-btn primary">
                {authLabels.signup}
              </Link>
            </>
          )}

          {!loading && user && (
            <Link to="/dashboard" className="asrar-btn primary">
              {isAr ? "لوحة التحكم" : "Dashboard"}
            </Link>
          )}
          <button
            className="asrar-header-menu"
            aria-label="Toggle navigation"
            onClick={() => setIsMobileNavOpen((prev) => !prev)}
          >
            <span></span>
            <span></span>
          </button>
        </div>
      </header>

      {/* MAIN */}
      <main>
        {/* HERO */}
        <section id="hero" className="asrar-hero">
          <div className="asrar-logo-frame">
            <div className="asrar-logo-inner">
              <img src={asrarLogo} alt="Asrar logo" />
            </div>
          </div>

          <p className="asrar-hero-eyebrow">
            {isAr
              ? "رفاق ذكاء اصطناعي خاصّون • مخصصون للعالم العربي"
              : "Private AI Companions • For the Arab World"}
          </p>

          <h1 className="asrar-hero-title">
            {isAr ? "أسرارك في أمان." : "Your secrets, guarded."}
            <br />
            {isAr
              ? "ورفيقك يُختار بناءً على شعورك."
              : "Your companion, chosen for you."}
          </h1>

          <p className="asrar-hero-subtitle">
            {isAr
              ? "اكتب ما تشعر به الآن، ودع أسرار تختار لك أنسب شخصية لتفريغ قلبك."
              : "Tell us how you feel, and let Asrar match you with the right companion."}
          </p>

          {/* HERO COLUMNS */}
          <div className="asrar-hero-columns">
            <div className="asrar-hero-left">
              <div className="asrar-chat-wrapper">
                <div className="asrar-chat-phone">
                  <div className="asrar-chat-header">
                    <div className="asrar-chat-avatar"></div>
                    <div className="asrar-chat-header-text">
                      <span className="asrar-chat-name">
                        {isAr ? "هَنا" : "Hana"}
                      </span>
                      <span className="asrar-chat-status">
                        {isAr
                          ? "متصلة • تستمع لك"
                          : "Online • Listening"}
                      </span>
                    </div>
                  </div>

                  <div className="asrar-chat-body">
                    <div className="bubble bubble-ai">
                      <div className="bubble-ai-label">
                        {isAr
                          ? "هَنا • دعم عميق"
                          : "Hana • Deep Support"}
                      </div>
                      <p className="bubble-ai-text">
                        {isAr
                          ? "أنا معك. خذ نفس عميق، واكتب لي بصراحة… ما الشيء اللي حاسس إنه جالس على صدرك اليوم؟"
                          : "I’m here. Take a slow breath. Tell me honestly — what’s been sitting on your chest lately?"}
                      </p>
                    </div>

                    {miniChatUserText && (
                      <div className="bubble bubble-user">
                        {miniChatUserText}
                      </div>
                    )}

                    {miniChatReply && (
                      <div className="bubble bubble-ai">
                        <p className="bubble-ai-text">{miniChatReply.text}</p>
                        {miniChatCharacter && (
                          <Link
                            to={user ? "/dashboard" : "/create-account"}
                            className="asrar-mini-chat-cta asrar-btn primary small"
                            onClick={() => {
                              if (typeof window !== "undefined") {
                                localStorage.setItem(
                                  "asrar-selected-character",
                                  miniChatCharacter.id
                                );
                              }
                            }}
                          >
                            {isAr
                              ? `ابدأ المحادثة مع ${miniChatCharacter.nameAr}`
                              : `Chat with ${miniChatCharacter.nameEn.split(" ")[0]}`}
                          </Link>
                        )}
                      </div>
                    )}
                  </div>

                  <form
                    className="asrar-chat-input"
                    onSubmit={handleMiniChatSubmit}
                  >
                    <div className="asrar-chat-input-shell">
                      <div className="asrar-chat-input-bar">
                        <textarea
                          ref={miniChatInputRef}
                          className="asrar-chat-input-field"
                          value={miniChatInput}
                          onChange={handleMiniChatChange}
                          onKeyDown={handleMiniChatKeyDown}
                          placeholder={
                            isAr
                              ? "اكتب كيف كان يومك فعلاً الآن..."
                              : "Type how you feel today..."
                          }
                        />
                        <button className="asrar-chat-send" type="submit">
                          ↗
                        </button>
                      </div>
                      <div className="asrar-chat-input-foot">
                        {chatInputFootnote}
                      </div>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ABOUT */}
        <section id="about" className="asrar-section asrar-section--about">
          <h2 className="asrar-section-title">
            {isAr ? "من نحن" : "We Are Asrar AI"}
          </h2>
          <p className="asrar-section-body">
            {isAr
              ? 'أسرار تعني "الأسرار". وُلد هذا المشروع من فكرة أن الناس في العالم العربي يستحقون مساحة خاصة وآمنة ليفضفضوا ويكتبوا ويُسمِعوا مشاعرهم في أي وقت. الشعار الذي تراه هو بخط يدي والدي، وتذكير أن خلف كل هذه التقنية قلوب وقصص حقيقية.'
              : 'Asrar means “secrets” in Arabic. This project was born from the idea that people in the Arab world deserve a private, culturally aware place to vent, think, and feel supported — any time of day. The logo you see is handwritten by my father, and it reminds us that behind all the tech there are real hearts and real stories.'}
          </p>
        </section>

        {/* CHARACTERS */}
        <section id="characters" className="asrar-section">
          <h2 className="asrar-section-title">
            {isAr ? "قلب عائلة أسرار" : "The Asrar Core Family"}
          </h2>
          <p className="asrar-section-subtitle">
            {isAr
              ? "خمسة رفقاء فقط، لكن كل واحد منهم يمثل جانباً مختلفاً من احتياجك."
              : "Five companions, each covering a different side of what you need."}
          </p>

          <CharacterCarousel
            characters={CHARACTERS}
            selectedCharacterId={selectedCharacterId}
            onChange={(char) => setSelectedCharacterId(char.id)}
            isAr={isAr}
            variant="home"
          />
        </section>

        {/* SECURITY & PRIVACY / WHY */}
        <section
          id="security-privacy"
          className="asrar-section asrar-section--features"
        >
          <h2 className="asrar-section-title">
            {isAr ? "لماذا مكان أسرارك هنا؟" : "Why Your Secrets Belong Here"}
          </h2>
          <p className="asrar-section-subtitle">
            {isAr ? "الأمان والخصوصية" : "Security & Privacy"}
          </p>

          <div className="asrar-section-body">
            <p>
              {isAr
                ? "خصوصيتك أولاً دائماً. أسرار AI مبني ليكون مساحة آمنة، وليس مصنع بيانات. محادثاتك لا تُخزَّن أبداً كنص واضح؛ بل تُشفَّر على مستوى التطبيق قبل أن تلمس قاعدة البيانات."
                : "Your privacy comes first. Asrar AI is built as a safe space, not a data farm. Your conversations are never stored in plain text — they’re encrypted at the application level before they ever touch our database."}
            </p>
            <p>
              {isAr
                ? "أنت المتحكّم دائماً: يمكنك إيقاف حفظ سجل المحادثات في أي وقت، تنزيل بياناتك، أو حذف حسابك وكل الرسائل في خطوات بسيطة. كما نطبّق حدوداً على عدد الطلبات من الحسابات والأجهزة للحد من الإساءة وحماية المنصّة للجميع."
                : "You’re always in control: you can turn chat history off at any time, download your data, or delete your account and all messages in a few clicks. We also strictly limit how often accounts and devices can hit our servers to reduce abuse and protect the platform for everyone."}
            </p>
            <p>
              {isAr
                ? "لا نبيع بياناتك، ولا ندرّب نماذجنا على محادثاتك الخاصة."
                : "We don’t sell your data, and we don’t train our models on your private conversations."}
            </p>
          </div>

          <div className="asrar-features-grid">
            <div className="feature">
              <div className="feature-icon">🔐</div>
              <h3>{isAr ? "محادثات مشفّرة" : "Encrypted Conversations"}</h3>
              <p>
                {isAr
                  ? "رسائلك تُشفَّر على مستوى التطبيق قبل أن تُخزَّن في قاعدة البيانات. لا توجد سجلات محادثة كنص واضح."
                  : "Your messages are encrypted at the application level before they’re stored in our database. There are no plain-text chat logs."}
              </p>
            </div>
            <div className="feature">
              <div className="feature-icon">🗂️</div>
              <h3>{isAr ? "تحكّم كامل في السجل" : "You Control History"}</h3>
              <p>
                {isAr
                  ? "يمكنك تشغيل أو إيقاف حفظ سجل المحادثات، تنزيل بياناتك، أو حذف حسابك وجميع الرسائل في أي وقت."
                  : "You can turn chat history on or off, download your data, or delete your account and all messages at any time."}
              </p>
            </div>
            <div className="feature">
              <div className="feature-icon">🚫</div>
              <h3>{isAr ? "بدون بيع بيانات" : "No Data Selling or Training"}</h3>
              <p>
                {isAr
                  ? "مشاعرك ليست منتجاً إعلانياً. لا نبيع بياناتك، ولا ندرّب نماذجنا على محادثاتك الخاصة."
                  : "Your feelings are not an ad product. We don’t sell your data, and we don’t train our models on your private conversations."}
              </p>
            </div>
            <div className="feature">
              <div className="feature-icon">ا</div>
              <h3>{isAr ? "تجربة بأولوية عربية" : "Arabic-First Experience"}</h3>
              <p>
                {isAr
                  ? "من البداية مصمَّم لطريقة التعبير العربية والثقافة المحلية، وليس مجرد ترجمة لمنتج غربي."
                  : "Built around Arabic expression and culture from day one, not just translated from a Western template."}
              </p>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section id="how-it-works" className="asrar-section">
          <h2 className="asrar-section-title">
            {isAr ? "كيف يعمل أسرار؟" : "How Asrar Works"}
          </h2>
          <div className="asrar-steps">
            <div className="step">
              <div className="step-number">1</div>
              <h3>{isAr ? "اكتب شعورك" : "Share your mood"}</h3>
              <p>
                {isAr
                  ? "استخدم بوابة المزاج لكتابة ما تشعر به في رسالة واحدة، أو ابدأ مباشرة مع شخصيتك المفضلة."
                  : "Use the Mood Gate to describe how you feel in one message, or jump straight into chat with your favorite companion."}
              </p>
            </div>
            <div className="step">
              <div className="step-number">2</div>
              <h3>{isAr ? "تحدّث بلغتك" : "Chat in your language"}</h3>
              <p>
                {isAr
                  ? "تحدث بالعربية أو الإنجليزية أو خلط بينهما. تبقى محادثاتك خاصة بينك وبين رفيقك."
                  : "Talk in Arabic, English, or both. Your conversations stay private between you and your companion."}
              </p>
            </div>
            <div className="step">
              <div className="step-number">3</div>
              <h3>{isAr ? "تتطوّر معك" : "Grow over time"}</h3>
              <p>
                {isAr
                  ? "بدّل بين الشخصيات مع تغيّر احتياجك، واصنع لنفسك صندوق أدوات عاطفي."
                  : "Switch companions when your needs change, and build your own emotional toolkit over time."}
              </p>
            </div>
          </div>
        </section>

        {/* PRICING */}
        <section id="pricing" className="asrar-section asrar-section--pricing">
          <h2 className="asrar-section-title">
            {isAr ? "الأسعار" : "Pricing"}
          </h2>

          <div className="asrar-pricing-grid">
            <div className="pricing-card">
              <h3>{isAr ? "مجاني" : "Free"}</h3>
              <p className="price">{isAr ? "٠$ / شهرياً" : "$0 / month"}</p>
              <ul>
                <li>{isAr ? "شخصية أساسية واحدة" : "1 core character"}</li>
                <li>{isAr ? "٥ رسائل يومياً" : "5 messages per day"}</li>
                <li>{isAr ? "دعم أساسي" : "Basic support"}</li>
              </ul>
              <button className="asrar-btn ghost">
                {isAr ? "ابدأ مجاناً" : "Start for free"}
              </button>
            </div>

            <div className="pricing-card pricing-card--accent">
              
              <h3>{isAr ? "برو" : "Pro"}</h3>
              <p className="price">{isAr ? "$4.99 / شهرياً" : "$4.99 / month"}</p>
              <ul>
                <li>{isAr ? "كل رفاق أسرار الخمسة" : "All 5 Asrar characters"}</li>
                <li>{isAr ? "حتى ١٠٠ رسالة يومياً و٣٠٠٠ شهرياً" : "Up to 100 messages/day & 3,000/month"}</li>
                <li>{isAr ? "ذاكرة محادثة ودعم ذو أولوية" : "Chat memory & priority support"}</li>
                <li>{isAr ? "بدون إعلانات ووصول مبكر" : "Ad‑free, priority access"}</li>
              </ul>
              <button className="asrar-btn primary" onClick={() => (window.location.href = "/create-account") }>
                {isAr ? "جرّب برو" : "Try Pro"}
              </button>
            </div>
          </div>
        </section>

      </main>

      <AsrarFooter />

      {/* SCROLL TO TOP ARROW */}
      <button
        className="asrar-scroll-top"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        aria-label="Back to top"
      >
        ↑
      </button>
    </div>
  );
}