import AsrarFooter from "./AsrarFooter";
import { Link, useNavigate, Navigate } from "react-router-dom";
import React, { useState, useRef, useEffect } from "react";
import "./Dashboard.css";
import "./HomePage.css";
import "./CharacterCarousel.css";
import asrarLogo from "./assets/asrar-logo.png";
import abuZainAvatar from "./assets/abu_zain_2.png";
import hanaAvatar from "./assets/nour_2.png";
import rashidAvatar from "./assets/rashid_2.png";
import nourAvatar from "./assets/hana_2.png";
import farahAvatar from "./assets/farah_2.png";
import { useAuth } from "./hooks/useAuth";
import CharacterCarousel from "./CharacterCarousel";
import AsrarHeader from "./AsrarHeader";
import FeaturesAccordion from "./components/FeaturesAccordion";

// --- CORE 5 CHARACTERS ONLY -----------------------------------------
const CHARACTERS = [
  {
    id: "sheikh-al-hara",
    avatar: abuZainAvatar,
    nameEn: "Sheikh Al-Hara",
    nameAr: "شيخ الحارة",
    roleEn: "Guidance",
    roleAr: "إرشاد وحكمة",
    descriptionEn:
      "Sit down, let's talk. I've seen this before.\nThat wise voice when life's confusing and you need someone who's been around the block.",
    descriptionAr:
      "اقعد، خلينا نحكي. أنا شفت هالحكي قبل هيك.\nالصوت الحكيم لما تكون الدنيا معقدة ومحتاج حد عنده خبرة.",
  },
  {
    id: "daloua",
    avatar: hanaAvatar,
    nameEn: "Daloua",
    nameAr: "دلوعة",
    roleEn: "Deep Support",
    roleAr: "دعم عاطفي عميق",
    descriptionEn:
      "Yalla habibi, tell me everything. I'm here, I get it.\nFor when you're spiraling, feeling lonely, or just need someone who actually listens.",
    descriptionAr:
      "يلا حبيبي، قلي كل شي. أنا هون، بفهم عليك.\nلما تكون تايه بأفكارك، حاسس بالوحدة، أو محتاج حد يسمعك فعلاً.",
  },
  {
    id: "abu-mukh",
    avatar: rashidAvatar,
    nameEn: "Abu Mo5",
    nameAr: "أبو مخ",
    roleEn: "Focus & Study",
    roleAr: "تركيز ودراسة",
    descriptionEn:
      "Enough. Open the book. Let's do this properly.\nNo-nonsense study buddy who gets you organized and actually makes you finish stuff.",
    descriptionAr:
      "خلص. افتح الكتاب. يلا نشتغل صح.\nصاحبك اللي بنظملك حياتك وبخليك تخلص شغلك بدون هبل.",
  },
  {
    id: "walaa",
    avatar: nourAvatar,
    nameEn: "Walaaa",
    nameAr: "ولاااء",
    roleEn: "Brutal Honesty",
    roleAr: "صراحة قاسية",
    descriptionEn:
      "Walaaa shu? You know what you need to do, stop playing.\nThe truth you don't want to hear but absolutely need—straight up, no sugar.",
    descriptionAr:
      "ولا شو؟ انت عارف شو لازم تعمل، بطّل لف ودوران.\nالحقيقة اللي ما بدك تسمعها بس محتاجها—مباشرة، بلا سكر زيادة.",
  },
  {
    id: "hiba",
    avatar: farahAvatar,
    nameEn: "HHHiba",
    nameAr: "هههبة",
    roleEn: "Fun & Laughter",
    roleAr: "ضحك ومرح",
    descriptionEn:
      "Khalas, enough drama! Let's laugh before we lose our minds.\nYour chaos friend who brings memes, jokes, and reminds you life isn't that serious.",
    descriptionAr:
      "خلص، كفاية دراما! يلا نضحك قبل ما نجن.\nصاحبتك الفوضوية اللي بتجيبلك ميمز ونكت وبتفكرك إن الحياة مش نهاية العالم.",
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
    return "daloua";
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
    return "abu-mukh";
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
    return "walaa";
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
    return "hiba";
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
    return "sheikh-al-hara";
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
    return "sheikh-al-hara";
  }

  // default soft landing
  return "daloua";
}

function getMiniChatReply(message, isAr) {
  const raw = message || "";
  const trimmed = raw.trim();

  if (!trimmed) {
    return {
      charId: null,
      text: isAr
        ? "اكتب لي جملة أو جملتين عن يومك أو الشيء اللي مضايقك، عشان أقدر أساعدك أكثر."
        : "Try writing one or two sentences about your day or what's bothering you so I can actually help.",
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

  // Very short input *without* any known emotional keyword â†’ treat as unclear / gibberish.
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

  const intro = "I can tell what you shared isn't easy, and your feelings matter here.";
  const body = `Out of the Asrar companions, I'd match you with ${char.nameEn} (${char.roleEn}) right now. ${char.descriptionEn}`;
  const ctaHint = "You can start a full conversation with them using the button below.";

  return {
    charId: recId,
    text: `${intro} ${body} ${ctaHint}`,
  };
}

export default function HomePage() {
  // language + mood gate
  const { user, logout } = useAuth();
  const [language, setLanguage] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("asrar-lang") || "ar";
    }
    return "ar";
  });
  const [moodInput, setMoodInput] = useState("");
  const [submittedMood, setSubmittedMood] = useState("");
  const [recommendedId, setRecommendedId] = useState(null);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isHomeHeaderNavOpen, setIsHomeHeaderNavOpen] = useState(false);
  const [miniChatInput, setMiniChatInput] = useState("");
  const [miniChatUserText, setMiniChatUserText] = useState("");
  const [miniChatReply, setMiniChatReply] = useState(null);
  const [selectedCharacterId, setSelectedCharacterId] = useState(
    CHARACTERS[0].id // Start with Sheikh Al-Hara (index 0) selected by default
  );
  const [companionCarouselIndex, setCompanionCarouselIndex] = useState(0); // Start at Sheikh Al-Hara (index 0)

  const miniChatInputRef = useRef(null);
  const sliderTouchStartXRef = useRef(null);
  const sliderTouchDeltaXRef = useRef(0);
  const sliderRef = useRef(null);

  const isAr = language === "ar";
  const navigate = useNavigate();
  const selectedCharacter =
    CHARACTERS.find((c) => c.id === selectedCharacterId) || CHARACTERS[0];

  // Safe hash-based scroll after mount (e.g., arrive via /#emotional-engine)
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    const { hash } = window.location || {};
    if (!hash || hash.length <= 1) return;

    const id = hash.slice(1);

    const tryScroll = () => {
      const el = document.getElementById(id);
      if (!el) return false;
      try {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch (_) {}
      return true;
    };

    // Try immediately
    if (tryScroll()) return;

    // Try on next frame and after window load
    const raf = requestAnimationFrame(() => tryScroll());
    const onLoad = () => { tryScroll(); };
    window.addEventListener('load', onLoad, { once: true });

    // Fallback timer in case neither RAF nor load found the element yet
    const t = setTimeout(() => { tryScroll(); }, 200);

    return () => {
      try { cancelAnimationFrame(raf); } catch (_) {}
      try { window.removeEventListener('load', onLoad); } catch (_) {}
      clearTimeout(t);
    };
  }, []);

  // If user is logged in, we now allow access to the public Home page as well.
  // No redirect to /dashboard here.

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
        { href: "#characters", label: "الشخصيات" },
        { href: "#features", label: "لماذا أسرار؟" },
        { href: "#security-privacy", label: "الأمان والخصوصية" },
        { href: "#pricing", label: "الأسعار" },
        { href: "#contact", label: "تواصل معنا" },
      ]
    : [
        { href: "#hero", label: "Home" },
        { href: "#characters", label: "Characters" },
        { href: "#features", label: "Why Asrar?" },
        { href: "#security-privacy", label: "Security & Privacy" },
        { href: "#pricing", label: "Pricing" },
        { href: "#contact", label: "Contact" },
      ];

  const brandLabel = "ASRAR AI";

  const authLabels = isAr
    ? { login: "تسجيل الدخول", signup: "أنشئ حسابًا" }
    : { login: "Login", signup: "Create Account" };

  const homeDashboardLabel = isAr ? "لوحة التحكم" : "Dashboard";

  const chatInputTitle = isAr ? "كيف تشعر فعلاً؟" : "How are you really feeling?";
  const chatInputSubtitle = isAr
    ? "اكتب بصراحة. أنا هنا لأستمع وأفهم."
    : "Tell me honestly. I'm here to listen and understand.";
  const chatInputFootnote = isAr
    ? "اضغط Enter للإرسال • استخدم Shift+Enter لسطر جديد"
    : "Press Enter to send • Shift+Enter for a new line";

  const handleMiniChatChange = (event) => {
    const textarea = event.target;
    setMiniChatInput(textarea.value);
  };

  const sendMiniChat = () => {
    const trimmed = miniChatInput.trim();
    if (!trimmed) return;

    setMiniChatUserText(trimmed);
    setMiniChatReply(getMiniChatReply(trimmed, isAr));
    setMiniChatInput("");
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

  const goToPrevCompanion = () => {
    setCompanionCarouselIndex((prev) =>
      (prev - 1 + CHARACTERS.length) % CHARACTERS.length
    );
  };

  const goToNextCompanion = () => {
    setCompanionCarouselIndex((prev) => (prev + 1) % CHARACTERS.length);
  };

  const goToCompanion = (index) => {
    setCompanionCarouselIndex(index);
  };

  const handleHeroTouchStart = (event) => {
    if (!event.touches || event.touches.length !== 1) return;
    const touch = event.touches[0];
    sliderTouchStartXRef.current = touch.clientX;
    sliderTouchDeltaXRef.current = 0;
  };

  const handleHeroTouchMove = (event) => {
    if (sliderTouchStartXRef.current == null || !event.touches) return;
    const touch = event.touches[0];
    sliderTouchDeltaXRef.current = touch.clientX - sliderTouchStartXRef.current;
  };

  const handleHeroTouchEnd = () => {
    const deltaX = sliderTouchDeltaXRef.current;
    sliderTouchStartXRef.current = null;
    sliderTouchDeltaXRef.current = 0;

    const threshold = 40;
    if (Math.abs(deltaX) < threshold) return;

    if (deltaX < 0) {
      goToNextCompanion();
    } else {
      goToPrevCompanion();
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
    if (lang === language) return;
    setLanguage(lang);
    if (typeof window !== "undefined") {
      localStorage.setItem("asrar-lang", lang);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/");
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
      {/* CUSTOM HOME PAGE HEADER */}
     <header className="asrar-home-header">
  {/* LEFT: Logo */}
  <div className="asrar-home-header-left">
    <Link to="/" className="asrar-dash-logo-wrap">
      <span className="asrar-dash-brand">ASRAR AI</span>
    </Link>
  </div>

  {/* CENTER: Nav links, always visually centered */}
  <nav
    className={`asrar-home-header-center ${
      isAr ? "asrar-home-header-center--ar" : ""
    }`}
  >
    {navItems.map((item) => (
      <button
        key={item.href}
        type="button"
        className="asrar-home-header-nav-link"
        onClick={() => handleNavClick(item.href)}
      >
        {item.label}
      </button>
    ))}
  </nav>

  {/* RIGHT: language toggle + auth/dashboard + hamburger */}
  <div className="asrar-home-header-right">
    {/* language toggle – always LTR inside */}
    <div className="asrar-lang-toggle-wrapper">
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
    </div>

    {/* Auth buttons */}
    {!user && (
      <div className="asrar-header-auth-buttons">
        <Link to="/login" className="asrar-btn ghost">
          {authLabels.login}
        </Link>
        <Link to="/create-account" className="asrar-btn primary">
          {authLabels.signup}
        </Link>
      </div>
    )}

    {/* Dashboard button when logged in */}
    {user && (
      <Link to="/dashboard" className="asrar-btn primary">
        {homeDashboardLabel}
      </Link>
    )}

    {/* Mobile hamburger */}
    <button
      className="asrar-header-menu asrar-home-header-menu-toggle"
      aria-label="Toggle navigation"
      onClick={() => setIsMobileNavOpen((prev) => !prev)}
    >
      <span className="asrar-header-menu-line"></span>
      <span className="asrar-header-menu-line"></span>
      <span className="asrar-header-menu-line"></span>
    </button>
  </div>
</header>

      {/* MOBILE NAV DROPDOWN */}
      {isMobileNavOpen && (
        <div className="asrar-home-mobile-layer" role="dialog" aria-modal="true">
          <div
            className="asrar-home-mobile-overlay"
            onClick={() => setIsMobileNavOpen(false)}
          ></div>
          <nav
            className="asrar-home-mobile-nav asrar-home-mobile-nav--open"
            dir={isAr ? "rtl" : "ltr"}
          >
            <div className="asrar-home-mobile-nav-header">
              <span className="asrar-home-mobile-nav-title">ASRAR AI</span>
              <button
                type="button"
                className="asrar-mobile-close"
                aria-label="Close navigation"
                onClick={() => setIsMobileNavOpen(false)}
              >
                &times;
              </button>
            </div>
          {/* language toggle inside dropdown */}
          <div className="asrar-lang-toggle asrar-home-mobile-lang">
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

          {/* Nav links */}
          {navItems.map((item) => (
            <button
              key={item.href}
              type="button"
              className="asrar-home-mobile-nav-link"
              onClick={() => {
                handleNavClick(item.href);
                setIsMobileNavOpen(false);
              }}
            >
              {item.label}
            </button>
          ))}

          {/* Auth buttons */}
          {!user && (
            <div className="asrar-header-auth-buttons asrar-home-mobile-auth">
              <Link to="/login" className="asrar-btn ghost" onClick={() => setIsMobileNavOpen(false)}>
                {authLabels.login}
              </Link>
              <Link to="/create-account" className="asrar-btn primary" onClick={() => setIsMobileNavOpen(false)}>
                {authLabels.signup}
              </Link>
            </div>
          )}

          {/* Dashboard button when logged in */}
          {user && (
            <div className="asrar-header-auth-buttons asrar-home-mobile-auth">
              <Link to="/dashboard" className="asrar-btn primary" onClick={() => setIsMobileNavOpen(false)}>
                {homeDashboardLabel}
              </Link>
            </div>
          )}
          </nav>
        </div>
      )}

      {/* MAIN */}
      <main>
        {/* HERO */}
        <section id="hero" className="asrar-hero">
          <div className="asrar-hero-atmosphere" aria-hidden="true"></div>
          <div className="asrar-hero-content">
            {/* Glowing Orb */}
            <div className="asrar-hero-glow-orb"></div>

            {/* Restored Asrar Logo — Larger & More Prominent */}
            <div className="asrar-hero-logo-frame">
              <div className="asrar-hero-logo-inner">
                <img src={asrarLogo} alt="Asrar logo" className="asrar-hero-logo asrar-hero-logo--large" />
              </div>
            </div>

            {/* New Headline */}
            <h2 className="asrar-hero-tagline">
              {isAr 
                ? "الذكاء الاصطناعي العاطفي الأول للشرق الأوسط بخصوصية تامة" 
                : "The #1 Fully Private Emotional AI for the Middle East."}
            </h2>

            {/* Centered Copy */}
            <div className="asrar-hero-copy-centered">
              <h1 className="asrar-hero-title-centered">
                {isAr
                  ? "كيف تشعر فعلاً؟"
                  : "How do you really want to feel?"}
              </h1>
              <p className="asrar-hero-subtitle-centered">
                {isAr
                  ? "التقِ برفيقك الذكي العاطفي. مصمم لك. مبني للشرق الأوسط."
                  : "Meet your emotional AI companion. Designed for you. Built for the Middle East."}
              </p>
            </div>

            {/* Mood Capsule — Minimal Emotion Capsule */}
            <section className="asrar-mood-capsule">
            <form className="asrar-mood-capsule-inner" onSubmit={handleMiniChatSubmit}>
              {/* Header */}
              <div className="asrar-mood-capsule-header">
                <span className="asrar-mood-capsule-label">
                  {isAr ? "فحص المزاج" : "Mood check-in"}
                </span>
                <span className="asrar-mood-capsule-pill">
                  {isAr ? "دعم عميق" : "Deep Support"}
                </span>
              </div>

              {/* Question */}
              <div className="asrar-mood-capsule-question">
                <h2 className="asrar-mood-capsule-title">
                  {isAr
                    ? "كيف شعورك اليوم ؟"
                    : "How do you really feel today?"}
                </h2>
                <p className="asrar-mood-capsule-subtitle">
                  {isAr
                    ? "اكتب شيئاً عن مشاعرك…"
                    : "Tell me what's been sitting on your chest lately…"}
                </p>
              </div>

              {/* Input */}
              <div className="asrar-mood-capsule-input-row">
                <div className="asrar-mood-capsule-input-shell">
                  <textarea
                    className="asrar-mood-capsule-input"
                    placeholder={
                      isAr
                        ? "اكتب كيف تشعر الآن…"
                        : "Type how you feel right now…"
                    }
                    value={miniChatInput}
                    onChange={handleMiniChatChange}
                    onKeyDown={handleMiniChatKeyDown}
                    rows={1}
                  />
                  <button
                    type="submit"
                    className="asrar-mood-capsule-send"
                    disabled={!miniChatInput.trim()}
                  >
                    <span className="asrar-mood-capsule-send-icon">➜</span>
                  </button>
                </div>
                <p className="asrar-mood-capsule-hint">
                  {isAr
                    ? "اضغط Enter للإرسال • Shift+Enter لسطر جديد"
                    : "Press Enter to send · Shift+Enter for new line"}
                </p>
              </div>

              {/* Show recommendation if exists */}
              {miniChatReply && (
                <div className="asrar-mood-capsule-response">
                  <p className="asrar-mood-capsule-response-text">{miniChatReply.text}</p>
                  {miniChatCharacter && (
                    <Link
                      to={user ? "/dashboard" : "/create-account"}
                      className="asrar-mood-capsule-cta asrar-btn primary small"
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
                        ? `ابدأ مع ${miniChatCharacter.nameAr}`
                        : `Chat with ${miniChatCharacter.nameEn.split(" ")[0]}`}
                    </Link>
                  )}
                </div>
              )}
            </form>
          </section>
          </div>
        </section>
        <div className="asrar-section-divider" aria-hidden="true" />

        {/* CHARACTERS – HERO CAROUSEL */}
        <section id="characters" className="asrar-companions-section">
          <div className="asrar-companions-shell">
            <div className="asrar-companions-header">
              <h2 class="asrar-section-title">
                {isAr ? "رفقاؤك الذكيون العاطفيون" : "Your Emotional AI Companions"}
              </h2>
              <p>
                {isAr ? "خمس شخصيات مختلفة. رسالة واحدة مشتركة: فهمك." : "Five distinct personalities. One shared mission: to understand you."}
              </p>
            </div>

            <div className="asrar-companions-carousel-wrapper">
              <button
                type="button"
                className="asrar-companions-nav-btn asrar-companions-nav-btn--prev"
                onClick={goToPrevCompanion}
                aria-label={isAr ? "الرفيق السابق" : "Previous companion"}
              >
                ‹
              </button>

              <div className="asrar-companions-viewport">
                <div
                  className="asrar-companion-hero-track"
                  onTouchStart={handleHeroTouchStart}
                  onTouchMove={handleHeroTouchMove}
                  onTouchEnd={handleHeroTouchEnd}
                >
                  {CHARACTERS.map((companion, index) => {
                    const isActive = index === companionCarouselIndex;

                    return (
                      <div
                        key={companion.id}
                        className={
                          "asrar-companion-hero-slide" +
                          (isActive ? " asrar-companion-hero-slide--active" : "")
                        }
                      >
                        {/* Left: Text & CTA */}
                        <div className="asrar-companion-hero-content">
                          <div className="asrar-companion-hero-label">
                            {isAr ? companion.nameAr : companion.nameEn} — {isAr ? companion.roleAr : companion.roleEn}
                          </div>
                          <p className="asrar-companion-hero-description">
                            {isAr ? companion.descriptionAr : companion.descriptionEn}
                          </p>
                          {user ? (
                            <Link
                              to="/dashboard"
                              state={{ characterId: companion.id }}
                              className="asrar-companion-hero-cta"
                              onClick={() => {
                                if (typeof window !== "undefined") {
                                  try {
                                    localStorage.setItem(
                                      "asrar-selected-character",
                                      companion.id
                                    );
                                  } catch (_) {}
                                }
                              }}
                            >
                              {isAr
                                ? `ابدأ مع ${isAr ? companion.nameAr : companion.nameEn}`
                                : `Talk to ${companion.nameEn}`}
                            </Link>
                          ) : (
                            <Link
                              to="/create-account"
                              className="asrar-companion-hero-cta"
                            >
                              {isAr
                                ? `ابدأ مع ${isAr ? companion.nameAr : companion.nameEn}`
                                : `Talk to ${companion.nameEn}`}
                            </Link>
                          )}
                        </div>

                        {/* Right: Character Visual */}
                        <div className="asrar-companion-hero-visual">
                          <div
                            className={
                              "asrar-companion-hero-image" +
                              (isActive ? " asrar-companion-hero-image--active" : "")
                            }
                          >
                            <img src={companion.avatar} alt={isAr ? companion.nameAr : companion.nameEn} />
                            
                            {/* Mobile Pagination - Moved under the character image */}
                            <div className="asrar-companions-pagination-wrapper asrar-companions-pagination-mobile">
                              <button
                                type="button"
                                className="asrar-companions-mobile-arrow asrar-companions-mobile-arrow--prev"
                                onClick={goToPrevCompanion}
                                aria-label={isAr ? "الرفيق السابق" : "Previous companion"}
                              >
                                ‹
                              </button>

                              <div className="asrar-companions-pagination">
                                {CHARACTERS.map((_, idx) => (
                                  <button
                                    key={idx}
                                    type="button"
                                    className={
                                      idx === companionCarouselIndex
                                        ? "asrar-companion-dot asrar-companion-dot--active"
                                        : "asrar-companion-dot"
                                    }
                                    onClick={() => goToCompanion(idx)}
                                    aria-label={isAr ? `عرض ${CHARACTERS[idx].nameAr}` : `Show ${CHARACTERS[idx].nameEn}`}
                                    aria-current={idx === companionCarouselIndex ? "true" : "false"}
                                  />
                                ))}
                              </div>

                              <button
                                type="button"
                                className="asrar-companions-mobile-arrow asrar-companions-mobile-arrow--next"
                                onClick={goToNextCompanion}
                                aria-label={isAr ? "الرفيق التالي" : "Next companion"}
                              >
                                ›
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <button
                type="button"
                className="asrar-companions-nav-btn asrar-companions-nav-btn--next"
                onClick={goToNextCompanion}
                aria-label={isAr ? "الرفيق التالي" : "Next companion"}
              >
                ›
              </button>
            </div>

            {/* Desktop Pagination - Hidden on mobile */}
            <div className="asrar-companions-pagination-wrapper asrar-companions-pagination-desktop">
              <button
                type="button"
                className="asrar-companions-mobile-arrow asrar-companions-mobile-arrow--prev"
                onClick={goToPrevCompanion}
                aria-label={isAr ? "الرفيق السابق" : "Previous companion"}
              >
                ‹
              </button>

              <div className="asrar-companions-pagination">
                {CHARACTERS.map((companion, index) => (
                  <button
                    key={companion.id}
                    type="button"
                    className={
                      index === companionCarouselIndex
                        ? "asrar-companion-dot asrar-companion-dot--active"
                        : "asrar-companion-dot"
                    }
                    onClick={() => goToCompanion(index)}
                    aria-label={isAr ? `عرض ${companion.nameAr}` : `Show ${companion.nameEn}`}
                    aria-current={index === companionCarouselIndex ? "true" : "false"}
                  />
                ))}
              </div>

              <button
                type="button"
                className="asrar-companions-mobile-arrow asrar-companions-mobile-arrow--next"
                onClick={goToNextCompanion}
                aria-label={isAr ? "الرفيق التالي" : "Next companion"}
              >
                ›
              </button>
            </div>
          </div>
        </section>
        <div className="asrar-section-divider" aria-hidden="true" />

        {/* FEATURES ACCORDION */}
        <FeaturesAccordion isAr={isAr} />
        <div className="asrar-section-divider" aria-hidden="true" />

        {/* SECURITY & PRIVACY / WHY */}
        <section
          id="security-privacy"
          className="asrar-section asrar-section--features"
        >
          {isAr ? (
            <>
              <h2 className="asrar-section-title">
                {"خصوصيتك مقدسة"}
              </h2>
              <p className="asrar-section-subtitle">
                {"لا نبيع أو ندرب أو نشارك بياناتك. أبداً."}
              </p>

              <div className="asrar-trust-grid">
                <div className="asrar-trust-item">
                  <div className="asrar-trust-icon">🔒</div>
                  <h3>{"مشفّرة"}</h3>
                  <p>
                    {
                      "تشفير من طرف إلى طرف بشكل افتراضي"
                    }
                  </p>
                </div>
                <div className="asrar-trust-item">
                  <div className="asrar-trust-icon">👤</div>
                  <h3>{"أنت تتحكم"}</h3>
                  <p>
                    {
                      "بياناتك، قواعدك"
                    }
                  </p>
                </div>
                <div className="asrar-trust-item">
                  <div className="asrar-trust-icon">⚡</div>
                  <h3>{"بدون تدريب"}</h3>
                  <p>
                    {
                      "بياناتك لا تدرب ذكاءنا الاصطناعي"
                    }
                  </p>
                </div>
                <div className="asrar-trust-item">
                  <div className="asrar-trust-icon">🌍</div>
                  <h3>{"لك"}</h3>
                  <p>
                    {
                      "بياناتك تبقى لك"
                    }
                  </p>
                </div>
              </div>
            </>
          ) : (
            <>
              <h2 className="asrar-section-title">
                Your Privacy Is Sacred
              </h2>
              <p className="asrar-section-subtitle">
                We don't sell, train, or share your data. Ever.
              </p>

              <div className="asrar-trust-grid">
                <div className="asrar-trust-item">
                  <div className="asrar-trust-icon">🔒</div>
                  <h3>Encrypted</h3>
                  <p>
                    End-to-end encryption by default
                  </p>
                </div>

                <div className="asrar-trust-item">
                  <div className="asrar-trust-icon">👤</div>
                  <h3>You Control</h3>
                  <p>
                    Your data, your rules
                  </p>
                </div>

                <div className="asrar-trust-item">
                  <div className="asrar-trust-icon">⚡</div>
                  <h3>No Training</h3>
                  <p>
                    Your data never trains our AI
                  </p>
                </div>

                <div className="asrar-trust-item">
                  <div className="asrar-trust-icon">🌍</div>
                  <h3>Yours</h3>
                  <p>
                    Your data stays yours
                  </p>
                </div>
              </div>
            </>
          )}
        </section>

        {/* PRICING */}
        <section id="pricing" className="asrar-section asrar-section--pricing">
          <h2 className="asrar-section-title">
            {isAr ? "الأسعار" : "Pricing"}
          </h2>

          <div className="asrar-pricing-shell">
            <div className="asrar-pricing-cards-grid">
              {/* FREE PLAN */}
              <div className="asrar-pricing-card asrar-pricing-card--free">
                <h3>{isAr ? "مجاني" : "Free"}</h3>
                <p className="asrar-pricing-price">{isAr ? "٠$ / شهرياً" : "$0 / month"}</p>
                <ul className="asrar-pricing-features">
                  <li>{isAr ? "ثلاث شخصيات اساسية" : "3 core character"}</li>
                  <li>{isAr ? "٥ رسائل يومياً" : "5 messages per day"}</li>
                  <li>
                    {isAr
                      ? "محرك المشاعر الخفيف (ردود قصيرة ودعم أساسي)"
                      : "Lite Emotional Engine for short, supportive replies."}
                  </li>
                  <li>
                    {isAr
                      ? "نموذج GPT-4o mini سريع ومناسب للاستخدام اليومي"
                      : "Fast and reliable GPT-4o mini model for everyday use."}
                  </li>
                </ul>
                <button
                  className="asrar-btn ghost"
                  onClick={() => navigate("/dashboard")}
                >
                  {isAr ? "ابدأ مجاناً" : "Start for free"}
                </button>
              </div>

              {/* PRO PLAN */}
              <div className="asrar-pricing-card asrar-pricing-card--pro">
                <div className="asrar-pricing-badge">{isAr ? "الأكثر شيوعاً" : "Most Popular"}</div>
                <h3>{isAr ? "برو" : "Pro"}</h3>
                <p className="asrar-pricing-price">{isAr ? "$9.85 / شهرياً" : "$9.85 / month"}</p>
                <ul className="asrar-pricing-features">
                  <li>
                    {isAr
                      ? "جميع شخصيات أسرار الخمسة"
                      : "All 5 Asrar characters"}
                  </li>
                  <li>
                    {isAr ? "٣٠٠٠ رسالة شهرياً" : "3,000 messages per month"}
                  </li>
                  <li>
                    {isAr
                      ? "محرك المشاعر العميق V6 (إرشاد أعمق وخطوات عملية)"
                      : "Powered by the Asrar Emotional Engine V6 for longer, structured guidance."}
                  </li>
                  <li>
  {isAr
    ? "نموذج ذكاء أعلى GPT-4o لاستجابات أدق وأعمق"
    : "Higher-intelligence GPT-4o model for smarter, deeper responses."}
</li>
                  <li>
                    {isAr
                      ? "ذاكرة محادثة متقدمة"
                      : "Advanced chat memory."}
                  </li>
                  <li>
                    {isAr
                      ? "بدون إعلانات "
                      : "Ad-free experience."}
                  </li>
                  <li>
                    {isAr ? "إلغاء الاشتراك في أي وقت" : "Cancel anytime"}
                  </li>
                </ul>

                <button
                  className="asrar-btn primary"
                  onClick={() => {
                    if (user) {
                      window.location.href = "/dashboard";
                    } else {
                      window.location.href = "/create-account";
                    }
                  }}
                >
                  {isAr ? "جرّب برو" : "Try Pro"}
                </button>
              </div>
            </div>
          </div>
        </section>
        <div className="asrar-section-divider" aria-hidden="true" />

     <section
  id="contact"
  className="asrar-section asrar-section--contact"
>
  <h2 className="asrar-section-title">
    {isAr ? "تواصل معنا" : "Contact"}
  </h2>
  <p className="asrar-section-subtitle">
    {isAr
      ? "إذا كان لديك أي أسئلة، مشاكل في الحساب، أو اقتراحات لتحسين أسرار AI، يسعدنا سماعك."
      : "For support, ideas, or partnerships — we’d love to hear from you."}
  </p>

  <div className="asrar-contact-grid">

    {/* GENERAL SUPPORT */}
    <div className="asrar-contact-card">
    <div className="asrar-contact-icon">
    {/* Premium Minimal Question Mark */}
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
      <circle cx="12" cy="12" r="9.2" />
      <path d="M12 16.2v.01" strokeWidth="2" />
      <path d="M9.7 9.5a2.4 2.4 0 1 1 3.6 2.1c-.6.3-1.1.8-1.1 1.4v.2" />
    </svg>
  </div>

      <h3>{isAr ? "الدعم العام" : "General Support"}</h3>
      <p>
        {isAr
          ? "للمشاكل التقنية، استفسارات الحساب، أو الأسئلة العامة عن المنصة."
          : "Technical issues, account questions, or anything you’re unsure about."}
      </p>
      <a href="mailto:support@asrarai.com" className="asrar-contact-email">
        support@asrarai.com
      </a>
    </div>


    {/* FEEDBACK & IDEAS */}
    <div className="asrar-contact-card">
      <div className="asrar-contact-icon">
    {/* Premium Spark Icon */}
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
      <line x1="12" y1="4" x2="12" y2="20" />
      <line x1="4"  y1="12" x2="20" y2="12" />
      <line x1="6.5" y1="6.5" x2="17.5" y2="17.5" />
      <line x1="6.5" y1="17.5" x2="17.5" y2="6.5" />
    </svg>
  </div>
      <h3>{isAr ? "الاقتراحات والملاحظات" : "Feedback & Ideas"}</h3>
      <p>
        {isAr
          ? "شاركنا رأيك في تجربة أسرار AI أو أي ميزات تحب أن تراها في المستقبل."
          : "Share how Asrar feels to use and what you’d love to see next."}
      </p>
      <a href="mailto:ideas@asrarai.com?subject=Asrar%20AI%20Feedback" className="asrar-contact-email">
        ideas@asrarai.com
      </a>
    </div>


    {/* BUSINESS & INVESTORS */}
    <div className="asrar-contact-card">
    <div className="asrar-contact-icon">
    {/* Premium Diamond Frame */}
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round">
      <path d="M12 4 L20 12 L12 20 L4 12 Z" />
    </svg>
  </div>

      <h3>{isAr ? "الشراكات والمستثمرون" : "Business & Investors"}</h3>
      <p>
        {isAr
          ? "للاستفسارات المتعلقة بالشراكات، الإعلام، أو المستثمرين."
          : "For partnerships, media requests, or investor conversations."}
      </p>
      <a href="mailto:partners@asrarai.com?subject=Asrar%20AI%20Business" className="asrar-contact-email">
        partners@asrarai.com
      </a>
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
