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
import HomeSplash from "./components/HomeSplash";

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
      "اقعد، خلينا نحكي.\nأنا شفت هالأيام قبل هيك. الصوت الحكيم لما الدنيا تخربط حوالينك ومحتاج حدا أكبر منك بالعقل والخبرة يهدّي الجو ويورجيك الطريق الصح.",
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
      "يلا حبيبي، إحكيلي كل إشي.\nأنا هون عشانك، وبفهم عليك من أول كلمة. لما تكون تايه بأفكارك، حاسس بالوحدة، أو بس بدك حدا يسمعلك من قلبه.",
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
      "خلص… افتح الكتاب، يلا نشتغل صح.\nصاحبك اللي بنظّم يومك، بكتبلك خطة، وبخلّيك تخلّص شغلك ودراستك بدون تسويف ولا هبل.",
  },
  {
    id: "walaa",
    avatar: nourAvatar,
    nameEn: "Walaaa",
    nameAr: "ولاااء",
    roleEn: "Brutal Honesty",
    roleAr: "صراحة قاسية ولا شو؟",
    descriptionEn:
      "Walaaa shu? You know what you need to do, stop playing.\nThe truth you don't want to hear but absolutely need—straight up, no sugar.",
    descriptionAr:
      "إنت عارف شو لازم تعمل… بس بطّل تلف وتدور.\nالحقيقة اللي يمكن ما بدك تسمعها، بس محتاجها. مباشرة، واضحة، بدون سكر زيادة وبدون مجاملات.",
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
      "خلص، كفاية دراما!\nيلا نضحك قبل ما نِجَن. صاحبتك الفوضوية اللطيفة، بتجيبلك ميمز ونكت، وبتفكّرك إن الحياة مش نهاية العالم، مهما كانت الأمور صعبة.",
  },
];

// --- RECOMMENDATION LOGIC -------------------------------------------
function getCharacterRecommendation(message) {
  if (!message) return null;
  const text = message.toLowerCase();
  const hasAny = (words) => words.some((w) => text.includes(w));

  // Abu Mo5 – study, work, discipline, focus, motivation
  if (
    hasAny([
      "study",
      "homework",
      "focus",
      "discipline",
      "productivity",
      "exam",
      "exams",
      "school",
      "university",
      "work",
      "job",
      "fix my life",
      "organize",
      "guide",
      "guidance",
      "mentor",
      "plan",
      "organized",
      "organised",
      "roadmap",
      "career",
      "grades",
      "ادرس",
      "دراسة",
      "امتحان",
      "امتحانات",
      "جامعة",
      "شغل",
      "تركيز",
      "ترتيب",
      "تنظيم",
      "بدي اركز",
      "بدي ادرس",
      "مذاكرة",
      "توجيه",
      "ارشاد",
      "خطّة",
      "خطة",
      "مستقبل",
      "علاماتي",
      "شهادة",
    ])
  ) {
    return "abu-mukh";
  }

  // HHHiba – fun, laugh, mood, lighten the vibe
  if (
    hasAny([
      "laugh",
      "funny",
      "bored",
      "entertainment",
      "fun",
      "joke",
      "cheer me up",
      "ضحك",
      "اضحكني",
      "ملان",
      "زهقان",
      "نكتة",
      "نكت",
    ])
  ) {
    return "hiba";
  }

  // Walaa – motivation, self-improvement, change, goals
  if (
    hasAny([
      "change",
      "improve",
      "better",
      "goals",
      "habits",
      "new life",
      "motivation",
      "تغيير",
      "تطوير",
      "تحسين",
      "هدفي",
      "أهدافي",
      "عادة",
      "عادات",
    ])
  ) {
    return "walaa";
  }

  // Sheikh Al-Hara – burnout, exhaustion, overwhelmed, life problems
  if (
    hasAny([
      "tired",
      "exhausted",
      "overwhelmed",
      "burnout",
      "stressed",
      "drained",
      "تعبان",
      "مرهق",
      "ضغط",
      "متضايق",
      "مخنوق",
      "منهك",
      "life advice",
      "life guidance",
      "what should i do",
      "i'm lost",
      "im lost",
      "lost in life",
      "confused about life",
      "تايه",
      "ضايع",
      "مش عارف شو أعمل",
      "شو أعمل",
      "احتاج نصيحة",
      "بدّي نصيحة",
    ])
  ) {
    return "sheikh-al-hara";
  }

  // Daloua – sadness, emotional heaviness, loneliness
  if (
    hasAny([
      "sad",
      "depressed",
      "lonely",
      "hurt",
      "emotional",
      "crying",
      "حزين",
      "زعلان",
      "مكتئب",
      "وحيد",
      "بكيت",
      "مضغوط عاطفياً",
    ])
  ) {
    return "daloua";
  }

  // default soft landing when nothing matches
  return "daloua";
}

function formatMoodBotReply({ character, isAr }) {
  const id = character.id;

  if (isAr) {
    if (id === "daloua") {
      return {
        title: "حاسّة بثقل الكلام اللي كتبته.",
        match: "دلوعه هي أكثر رفيقة تسمع لقلبك بدون استعجال.",
        hint: "لما تحس إنك جاهز، افتح معها محادثة كاملة وفضفض على مهلك.",
      };
    }

    if (id === "abu-mukh") {
      return {
        title: "واضح إنك ناوي ترتّب أمورك عن جد.",
        match: "أبو مخ هو اللي يعطيك خطة وترتيب بدل الكلام الفاضي.",
        hint: "ابدأ معه محادثة لما تكون جاهز نمشي خطوة خطوة.",
      };
    }

    if (id === "sheikh-al-hara") {
      return {
        title: "الكلام اللي قلته يحتاج صوت صريح وواعي.",
        match: "شيخ الحارة يسمع لك وبعدين يحكي لك الحقيقة بأسلوب أخ كبير.",
        hint: "افتح معه محادثة لما تحب نصيحة صريحة بدون تلميع.",
      };
    }

    if (id === "walaa") {
      return {
        title: "واضح إنك مستعد لتغيير معيّن.",
        match: "ولاء هي اللي تدفعك لعادات أحسن وخطوات صغيرة حقيقية.",
        hint: "احكي معها لما تحب تحوّل هذا الشعور لخطة فعلية.",
      };
    }

    if (id === "hiba") {
      return {
        title: "حاس فيك… ويمكن تحتاج شوية خفة مو بس جدية.",
        match: "هبة تمزح معك بس برضه تحترم مشاعرك.",
        hint: "ابدأ معها محادثة لما تحب الجو يخف شوي بس يظل حقيقي.",
      };
    }

    return {
      title: "حاسّة بثقل الكلام اللي كتبته.",
      match: `${isAr ? character.nameAr : character.nameEn} يمكن يكون الأنسب يسمعلك الآن.`,
      hint: "تقدر تفتح معه/معها محادثة كاملة من الزر بالأسفل.",
    };
  }

  if (id === "daloua") {
    return {
      title: "I feel the heaviness in what you shared.",
      match: "Daloua is the one who sits with your feelings and doesn’t rush you.",
      hint: "When you’re ready, you can open a full chat with her and unpack this slowly.",
    };
  }

  if (id === "abu-mukh") {
    return {
      title: "I can see you want to get serious and organized.",
      match: "Abu Mo5 is the one who gives you structure, not drama.",
      hint: "Start a chat with him when you’re ready to plan things step by step.",
    };
  }

  if (id === "sheikh-al-hara") {
    return {
      title: "What you’re talking about needs a grounded, honest voice.",
      match: "Sheikh Al-Hara listens, then tells you the truth the way a big brother would.",
      hint: "Open a chat with him when you want straight guidance, not sugar-coating.",
    };
  }

  if (id === "walaa") {
    return {
      title: "I can see you’re ready for some kind of change.",
      match: "Walaa is the one who pushes you toward better habits and small wins.",
      hint: "Chat with her when you want to turn that feeling into a real plan.",
    };
  }

  if (id === "hiba") {
    return {
      title: "I sense you need some lightness, not more heaviness.",
      match: "Hiba is the one who jokes with you but still takes your feelings seriously.",
      hint: "Start a chat with her when you want the mood a bit lighter but still real.",
    };
  }

  return {
    title: "I feel there’s something real in what you shared.",
    match: `${character.nameEn} is a good match to stay with you in this moment.`,
    hint: "You can start a full chat with them using the button below.",
  };
}

function getMiniChatReply(message, isAr) {
  const raw = message || "";
  const trimmed = raw.trim();

  if (!trimmed) {
    return {
      charId: null,
      text: isAr
        ? "اكتب جملة أو جملتين عن شعورك الآن عشان أقدر أساعدك صح."
        : "Write one or two sentences about how you feel right now so I can actually help.",
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

  const recId = getCharacterRecommendation(trimmed);
  const hasPersona = !!(recId && (recId !== "daloua" || hasKnownKeyword));

  // Very short input *without* any known emotional keyword â†’ treat as unclear / gibberish.
  if (isVeryShort && !hasKnownKeyword && !hasPersona) {
    return {
      charId: null,
      text: isAr
        ? "ما فهمت الجملة. جرّب تكتب ببساطة عن شعورك أو اللي صاير معك."
        : "I couldn’t understand that. Try a simple sentence about how you feel or what’s happening.",
    };
  }

  const char = recId && CHARACTERS.find((c) => c.id === recId);

  if (!char) {
    return {
      charId: null,
      text: isAr
        ? "أحس إن اللي كتبته مو سهل، وهذا المكان آمن لك."
        : "I can tell what you shared isn’t light, and this space is safe for you.",
    };
  }

  const formatted = formatMoodBotReply({ character: char, isAr });

  return {
    charId: recId,
    text: `${formatted.title} ${formatted.match} ${formatted.hint}`,
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
  const [isPageLoading, setIsPageLoading] = useState(true);
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
  
  // Slider refs and state
  const privacySliderRef = useRef(null);
  const featuresSliderRef = useRef(null);
  const [privacySlideIndex, setPrivacySlideIndex] = useState(0);
  const [featuresSlideIndex, setFeaturesSlideIndex] = useState(0);

  const isAr = language === "ar";
  const navigate = useNavigate();
  const selectedCharacter =
    CHARACTERS.find((c) => c.id === selectedCharacterId) || CHARACTERS[0];

  useEffect(() => {
    const t = setTimeout(() => setIsPageLoading(false), 900);
    return () => clearTimeout(t);
  }, []);

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
        { href: "#features", label: "ليش أسرار؟" },
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

  // Privacy slider navigation
  const goToPrevPrivacySlide = () => {
    setPrivacySlideIndex((prev) => (prev - 1 + 4) % 4);
  };

  const goToNextPrivacySlide = () => {
    setPrivacySlideIndex((prev) => (prev + 1) % 4);
  };

  const goToPrivacySlide = (index) => {
    setPrivacySlideIndex(index);
  };

  // Features slider navigation
  const goToPrevFeaturesSlide = () => {
    setFeaturesSlideIndex((prev) => (prev - 1 + 5) % 5);
  };

  const goToNextFeaturesSlide = () => {
    setFeaturesSlideIndex((prev) => (prev + 1) % 5);
  };

  const goToFeaturesSlide = (index) => {
    setFeaturesSlideIndex(index);
  };

  // Touch handlers for privacy slider
  const handlePrivacyTouchStart = (event) => {
    if (!event.touches || event.touches.length !== 1) return;
    const touch = event.touches[0];
    sliderTouchStartXRef.current = touch.clientX;
    sliderTouchDeltaXRef.current = 0;
  };

  const handlePrivacyTouchMove = (event) => {
    if (sliderTouchStartXRef.current == null || !event.touches) return;
    const touch = event.touches[0];
    sliderTouchDeltaXRef.current = touch.clientX - sliderTouchStartXRef.current;
  };

  const handlePrivacyTouchEnd = () => {
    const deltaX = sliderTouchDeltaXRef.current;
    sliderTouchStartXRef.current = null;
    sliderTouchDeltaXRef.current = 0;

    const threshold = 40;
    if (Math.abs(deltaX) < threshold) return;

    if (deltaX < 0) {
      goToNextPrivacySlide();
    } else {
      goToPrevPrivacySlide();
    }
  };

  // Touch handlers for features slider
  const handleFeaturesTouchStart = (event) => {
    if (!event.touches || event.touches.length !== 1) return;
    const touch = event.touches[0];
    sliderTouchStartXRef.current = touch.clientX;
    sliderTouchDeltaXRef.current = 0;
  };

  const handleFeaturesTouchMove = (event) => {
    if (sliderTouchStartXRef.current == null || !event.touches) return;
    const touch = event.touches[0];
    sliderTouchDeltaXRef.current = touch.clientX - sliderTouchStartXRef.current;
  };

  const handleFeaturesTouchEnd = () => {
    const deltaX = sliderTouchDeltaXRef.current;
    sliderTouchStartXRef.current = null;
    sliderTouchDeltaXRef.current = 0;

    const threshold = 40;
    if (Math.abs(deltaX) < threshold) return;

    if (deltaX < 0) {
      goToNextFeaturesSlide();
    } else {
      goToPrevFeaturesSlide();
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

  if (isPageLoading) {
    return <HomeSplash />;
  }

  return (
    <div
      className={`asrar-page asrar-page-fade-in ${
        isAr ? "asrar-page--ar" : ""
      }`}
    >
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
                ? " أول ذكاء اصطناعي عاطفي بالشرق الأوسط… بخصوصية تامة" 
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
                  ? "رفيقك اليومي اللي بسمعلك، بفهم عليك، وبيحافظ على أسرارك مثل ما هي: أسرار."
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
                  {isAr ? "دعم عاطفي عميق" : "Deep Support"}
                </span>
              </div>

              {/* Question */}
              <div className="asrar-mood-capsule-question">
                <h2 className="asrar-mood-capsule-title">
                  {isAr
                    ? "كيف حاسس اليوم؟"
                    : "How do you really feel today?"}
                </h2>
                <p className="asrar-mood-capsule-subtitle">
                  {isAr
                    ? "اكتب شوي عن مشاعرك عشان نقدر نساعدك أحسن."
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
                        ? "اكتبلي شو حاسّ بهاللحظة…"
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
                        : `Chat with ${miniChatCharacter.nameEn}`}
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
                {isAr ? "صحابك العاطفيين" : "Your Emotional AI Companions"}
              </h2>
              <p>
                {isAr ? "خمس شخصيات مختلفة… ورسالة وحدة: يفهموك عن جد." : "Five distinct personalities. One shared mission: to understand you."}
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
                {"ما بنبيع او بندرب بياناتك ابدا."}
              </p>

              {/* Mobile Slider - Arabic Privacy */}
              <div className="asrar-privacy-slider-container">
                <button
                  type="button"
                  className="asrar-privacy-slider-arrow asrar-privacy-slider-arrow--prev"
                  onClick={goToPrevPrivacySlide}
                  aria-label={isAr ? "السابق" : "Previous"}
                >
                  ‹
                </button>
                
                <div 
                  className="asrar-privacy-slider"
                  ref={privacySliderRef}
                  onTouchStart={handlePrivacyTouchStart}
                  onTouchMove={handlePrivacyTouchMove}
                  onTouchEnd={handlePrivacyTouchEnd}
                >
                  <div 
                    className="asrar-privacy-slider-track"
                    style={{ transform: `translateX(-${privacySlideIndex * 100}%)` }}
                  >
                    <div className="asrar-privacy-slide">
                      <div className="asrar-trust-item">
                        <div className="asrar-trust-icon">🔒</div>
                        <h3>{"مشفّرة"}</h3>
                        <p>
                          {"تشفير من طرف إلى طرف بشكل افتراضي"}
                        </p>
                      </div>
                    </div>
                    <div className="asrar-privacy-slide">
                      <div className="asrar-trust-item">
                        <div className="asrar-trust-icon">👤</div>
                        <h3>{"أنت بتتحكم"}</h3>
                        <p>
                          {"بياناتك، قواعدك"}
                        </p>
                      </div>
                    </div>
                    <div className="asrar-privacy-slide">
                      <div className="asrar-trust-item">
                        <div className="asrar-trust-icon">⚡</div>
                        <h3>{"بدون تدريب"}</h3>
                        <p>
                          {"بياناتك لا تدرب ذكاءنا الاصطناعي"}
                        </p>
                      </div>
                    </div>
                    <div className="asrar-privacy-slide">
                      <div className="asrar-trust-item">
                        <div className="asrar-trust-icon">🌍</div>
                        <h3>{"لك"}</h3>
                        <p>
                          {"بياناتك بتضل الك"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  className="asrar-privacy-slider-arrow asrar-privacy-slider-arrow--next"
                  onClick={goToNextPrivacySlide}
                  aria-label={isAr ? "التالي" : "Next"}
                >
                  ›
                </button>
              </div>

              {/* Dots */}
              <div className="asrar-privacy-slider-dots">
                {[0, 1, 2, 3].map((index) => (
                  <button
                    key={index}
                    className={`asrar-privacy-dot ${index === privacySlideIndex ? 'active' : ''}`}
                    onClick={() => goToPrivacySlide(index)}
                    aria-label={`Go to privacy feature ${index + 1}`}
                  />
                ))}
              </div>

              {/* Desktop Grid - Arabic Privacy */}

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
                  <h3>{"أنت بتتحكم"}</h3>
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
                     "بياناتك بتضل الك"
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

              {/* Mobile Slider - English Privacy */}
              <div className="asrar-privacy-slider-container">
                <button
                  type="button"
                  className="asrar-privacy-slider-arrow asrar-privacy-slider-arrow--prev"
                  onClick={goToPrevPrivacySlide}
                  aria-label={isAr ? "السابق" : "Previous"}
                >
                  ‹
                </button>
                
                <div 
                  className="asrar-privacy-slider"
                  ref={privacySliderRef}
                  onTouchStart={handlePrivacyTouchStart}
                  onTouchMove={handlePrivacyTouchMove}
                  onTouchEnd={handlePrivacyTouchEnd}
                >
                  <div 
                    className="asrar-privacy-slider-track"
                    style={{ transform: `translateX(-${privacySlideIndex * 100}%)` }}
                  >
                    <div className="asrar-privacy-slide">
                      <div className="asrar-trust-item">
                        <div className="asrar-trust-icon">🔒</div>
                        <h3>Encrypted</h3>
                        <p>
                          End-to-end encryption by default
                        </p>
                      </div>
                    </div>
                    <div className="asrar-privacy-slide">
                      <div className="asrar-trust-item">
                        <div className="asrar-trust-icon">👤</div>
                        <h3>You Control</h3>
                        <p>
                          Your data, your rules
                        </p>
                      </div>
                    </div>
                    <div className="asrar-privacy-slide">
                      <div className="asrar-trust-item">
                        <div className="asrar-trust-icon">⚡</div>
                        <h3>No Training</h3>
                        <p>
                          Your data never trains our AI
                        </p>
                      </div>
                    </div>
                    <div className="asrar-privacy-slide">
                      <div className="asrar-trust-item">
                        <div className="asrar-trust-icon">🌍</div>
                        <h3>Yours</h3>
                        <p>
                          Your data stays yours
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  className="asrar-privacy-slider-arrow asrar-privacy-slider-arrow--next"
                  onClick={goToNextPrivacySlide}
                  aria-label={isAr ? "التالي" : "Next"}
                >
                  ›
                </button>
              </div>

              {/* Dots */}
              <div className="asrar-privacy-slider-dots">
                {[0, 1, 2, 3].map((index) => (
                  <button
                    key={index}
                    className={`asrar-privacy-dot ${index === privacySlideIndex ? 'active' : ''}`}
                    onClick={() => goToPrivacySlide(index)}
                    aria-label={`Go to privacy feature ${index + 1}`}
                  />
                ))}
              </div>

              {/* Desktop Grid - English Privacy */}

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
        <div className="asrar-section-divider" aria-hidden="true" />

        {/* WHY ASRAR? */}
        <section id="features" className="asrar-section asrar-section--features">
          {isAr ? (
            <>
              <h2 className="asrar-section-title">
                {"لماذا أسرار؟"}
              </h2>
              <p className="asrar-section-subtitle">
                {"اكتشف ما يجعل أسرار مميزة وثورية حقًا."}
              </p>

              {/* Mobile Slider - Arabic Features */}
              <div className="asrar-features-slider-container">
                <button
                  type="button"
                  className="asrar-features-slider-arrow asrar-features-slider-arrow--prev"
                  onClick={goToPrevFeaturesSlide}
                  aria-label={isAr ? "السابق" : "Previous"}
                >
                  ‹
                </button>
                
                <div 
                  className="asrar-features-slider"
                  ref={featuresSliderRef}
                  onTouchStart={handleFeaturesTouchStart}
                  onTouchMove={handleFeaturesTouchMove}
                  onTouchEnd={handleFeaturesTouchEnd}
                >
                  <div 
                    className="asrar-features-slider-track"
                    style={{ transform: `translateX(-${featuresSlideIndex * 100}%)` }}
                  >
                    <div className="asrar-features-slide">
                      <div className="asrar-feature-item">
                        <div className="asrar-feature-icon">🧠</div>
                        <h3>{"محرك أسرار العاطفي™"}</h3>
                        <p>
                          {"محركنا العاطفي الملكي يحلل النبرة والأنماط والحالات العاطفية بمرور الوقت. يتكيف معك ويخلق محادثات شبيهة بالبشر بشكل عميق ومبنية على الواقعية النفسية."}
                        </p>
                        <div className="asrar-feature-hint">
                          {isAr ? "اكتشف" : "Discover"}
                        </div>
                      </div>
                    </div>
                    <div className="asrar-features-slide">
                      <div className="asrar-feature-item">
                        <div className="asrar-feature-icon">🛤️</div>
                        <h3>{"الرحلة العاطفية™"}</h3>
                        <p>
                          {"رفيقك يتتبع النمو العاطفي والأنماط والتحديات والانتصارات—يرشدك في رحلة شخصية لفهم نفسك بشكل أفضل كل يوم."}
                        </p>
                        <div className="asrar-feature-hint">
                          {isAr ? "اكتشف" : "Discover"}
                        </div>
                      </div>
                    </div>
                    <div className="asrar-features-slide">
                      <div className="asrar-feature-item">
                        <div className="asrar-feature-icon">🔮</div>
                        <h3>{"مرآتي™"}</h3>
                        <p>
                          {"وضع انعكاسي حيث يصبح رفيقك مرآة، يكشف عاداتك ونقاطك العمياء وحلقاتك العاطفية بوضوح واهتمام."}
                        </p>
                        <div className="asrar-feature-hint">
                          {isAr ? "اكتشف" : "Discover"}
                        </div>
                      </div>
                    </div>
                    <div className="asrar-features-slide">
                      <div className="asrar-feature-item">
                        <div className="asrar-feature-icon">🌊</div>
                        <h3>{"الجانب الخفي™"}</h3>
                        <p>
                          {"مساحة خاصة حيث يتم التقاط أنماط عاطفية أعمق وطويلة الأمد كـ'همسات' عنك وتفتح ببطء مع نمو الثقة."}
                        </p>
                        <div className="asrar-feature-hint">
                          {isAr ? "اكتشف" : "Discover"}
                        </div>
                      </div>
                    </div>
                    <div className="asrar-features-slide">
                      <div className="asrar-feature-item">
                        <div className="asrar-feature-icon">🌀</div>
                        <h3>{"١١ بوابة خفية™"}</h3>
                        <p>
                          {"اختبار غامر من ١١ خطوة يكشف طبقات خفية من شخصيتك عبر الاختيارات البصرية والقرارات الدقيقة، ثم يعكسها بطريقة دقيقة ومثيرة."}
                        </p>
                        <div className="asrar-feature-hint">
                          {isAr ? "اكتشف" : "Discover"}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  className="asrar-features-slider-arrow asrar-features-slider-arrow--next"
                  onClick={goToNextFeaturesSlide}
                  aria-label={isAr ? "التالي" : "Next"}
                >
                  ›
                </button>
              </div>

              {/* Dots */}
              <div className="asrar-features-slider-dots">
                {[0, 1, 2, 3, 4].map((index) => (
                  <button
                    key={index}
                    className={`asrar-features-dot ${index === featuresSlideIndex ? 'active' : ''}`}
                    onClick={() => goToFeaturesSlide(index)}
                    aria-label={`Go to feature ${index + 1}`}
                  />
                ))}
              </div>

              {/* Desktop Grid - Arabic Features */}

              <div className="asrar-features-grid">
                <div className="asrar-features-row-top">
                  <div className="asrar-feature-item">
                    <div className="asrar-feature-icon">🧠</div>
                    <h3>{"محرك أسرار العاطفي™"}</h3>
                    <p>
                      {"محركنا العاطفي الملكي يحلل النبرة والأنماط والحالات العاطفية بمرور الوقت. يتكيف معك ويخلق محادثات شبيهة بالبشر بشكل عميق ومبنية على الواقعية النفسية."}
                    </p>
                    <div className="asrar-feature-hint">
                      {isAr ? "اكتشف" : "Discover"}
                    </div>
                  </div>
                  <div className="asrar-feature-item">
                    <div className="asrar-feature-icon">🛤️</div>
                    <h3>{"الرحلة العاطفية™"}</h3>
                    <p>
                      {"رفيقك يتتبع النمو العاطفي والأنماط والتحديات والانتصارات—يرشدك في رحلة شخصية لفهم نفسك بشكل أفضل كل يوم."}
                    </p>
                    <div className="asrar-feature-hint">
                      {isAr ? "اكتشف" : "Discover"}
                    </div>
                  </div>
                  <div className="asrar-feature-item">
                    <div className="asrar-feature-icon">🪞</div>
                    <h3>{"مرآتي™"}</h3>
                    <p>
                      {"وضع انعكاسي حيث يصبح رفيقك مرآة، يكشف عاداتك ونقاطك العمياء وحلقاتك العاطفية بوضوح واهتمام."}
                    </p>
                    <div className="asrar-feature-hint">
                      {isAr ? "اكتشف" : "Discover"}
                    </div>
                  </div>
                </div>
                <div className="asrar-features-row-bottom">
                  <div className="asrar-feature-item">
                    <div className="asrar-feature-icon">🌊</div>
                    <h3>{"الجانب الخفي™"}</h3>
                    <p>
                      {"مساحة خاصة حيث يتم التقاط أنماط عاطفية أعمق وطويلة الأمد كـ'همسات' عنك وتفتح ببطء مع نمو الثقة."}
                    </p>
                    <div className="asrar-feature-hint">
                      {isAr ? "اكتشف" : "Discover"}
                    </div>
                  </div>
                  <div className="asrar-feature-item">
                    <div className="asrar-feature-icon">🌀</div>
                    <h3>{"١١ بوابة خفية™"}</h3>
                    <p>
                      {"اختبار غامر من ١١ خطوة يكشف طبقات خفية من شخصيتك عبر الاختيارات البصرية والقرارات الدقيقة، ثم يعكسها بطريقة دقيقة ومثيرة."}
                    </p>
                    <div className="asrar-feature-hint">
                      {isAr ? "اكتشف" : "Discover"}
                    </div>
                  </div>
                </div>
              </div>

              <div className="asrar-orbital-showcase">
                <div className="asrar-orbital-center">
                  <div className="asrar-center-icon">✨</div>
                  <div className="asrar-center-text">
                    <h4>{isAr ? "شخصيات متطورة" : "Evolved Personalities"}</h4>
                    <p>{isAr ? "ذكاء اصطناعي يتكيف معك" : "AI that adapts to you"}</p>
                  </div>
                </div>
                
                <div className="asrar-orbital-item asrar-orbital-1">
                  <div className="asrar-orbital-icon">🚪</div>
                  <div className="asrar-orbital-label">
                    <span>{isAr ? "بوابات ذكية" : "Smart Portals"}</span>
                    <small>{isAr ? "اكتشف آفاقا جديدة" : "Discover new horizons"}</small>
                  </div>
                  <div className="asrar-orbital-line"></div>
                </div>
                
                <div className="asrar-orbital-item asrar-orbital-2">
                  <div className="asrar-orbital-icon">🧠</div>
                  <div className="asrar-orbital-label">
                    <span>{isAr ? "ذكاء متطور" : "Advanced Intelligence"}</span>
                    <small>{isAr ? "تفهم عميق لاحتياجاتك" : "Deep understanding of your needs"}</small>
                  </div>
                  <div className="asrar-orbital-line"></div>
                </div>
                
                <div className="asrar-orbital-item asrar-orbital-3">
                  <div className="asrar-orbital-icon">🔗</div>
                  <div className="asrar-orbital-label">
                    <span>{isAr ? "شبكات عصبية" : "Neural Networks"}</span>
                    <small>{isAr ? "اتصالات ذكية متقدمة" : "Advanced neural connections"}</small>
                  </div>
                  <div className="asrar-orbital-line"></div>
                </div>
                
                <div className="asrar-orbital-item asrar-orbital-4">
                  <div className="asrar-orbital-icon">⚡</div>
                  <div className="asrar-orbital-label">
                    <span>{isAr ? "تعلم كمي" : "Quantum Learning"}</span>
                    <small>{isAr ? "سرعة معالجة فائقة" : "Ultra-fast processing"}</small>
                  </div>
                  <div className="asrar-orbital-line"></div>
                </div>
                
                <div className="asrar-orbital-item asrar-orbital-5">
                  <div className="asrar-orbital-icon">🌟</div>
                  <div className="asrar-orbital-label">
                    <span>{isAr ? "تطور مستمر" : "Continuous Evolution"}</span>
                    <small>{isAr ? "يتحسن مع كل استخدام" : "Improves with every use"}</small>
                  </div>
                  <div className="asrar-orbital-line"></div>
                </div>
              </div>
            </>
          ) : (
            <>
              <h2 className="asrar-section-title">
                Why Asrar?
              </h2>
              <p className="asrar-section-subtitle">
                Discover what makes Asrar truly special and revolutionary.
              </p>

              {/* Mobile Slider - English Features */}
              <div className="asrar-features-slider-container">
                <button
                  type="button"
                  className="asrar-features-slider-arrow asrar-features-slider-arrow--prev"
                  onClick={goToPrevFeaturesSlide}
                  aria-label={isAr ? "السابق" : "Previous"}
                >
                  ‹
                </button>
                
                <div 
                  className="asrar-features-slider"
                  ref={featuresSliderRef}
                  onTouchStart={handleFeaturesTouchStart}
                  onTouchMove={handleFeaturesTouchMove}
                  onTouchEnd={handleFeaturesTouchEnd}
                >
                  <div 
                    className="asrar-features-slider-track"
                    style={{ transform: `translateX(-${featuresSlideIndex * 100}%)` }}
                  >
                    <div className="asrar-features-slide">
                      <div className="asrar-feature-item">
                        <div className="asrar-feature-icon">🧠</div>
                        <h3>Asrar Emotional Engine™</h3>
                        <p>
                          Our proprietary emotional engine analyzes tone, patterns, and emotional states over time. It adapts to you and creates deeply human-like conversations grounded in psychological realism.
                        </p>
                        <div className="asrar-feature-hint">
                          {isAr ? "اكتشف" : "Discover"}
                        </div>
                      </div>
                    </div>
                    <div className="asrar-features-slide">
                      <div className="asrar-feature-item">
                        <div className="asrar-feature-icon">🛤️</div>
                        <h3>Emotional Journey™</h3>
                        <p>
                          Your companion tracks emotional growth, patterns, challenges, and victories—guiding you through a personal journey to understand yourself better every day.
                        </p>
                        <div className="asrar-feature-hint">
                          {isAr ? "اكتشف" : "Discover"}
                        </div>
                      </div>
                    </div>
                    <div className="asrar-features-slide">
                      <div className="asrar-feature-item">
                        <div className="asrar-feature-icon">🔮</div>
                        <h3>Mirror Me™</h3>
                        <p>
                          A reflective mode where your companion becomes a mirror, revealing your habits, blind spots, and emotional loops with clarity and care.
                        </p>
                        <div className="asrar-feature-hint">
                          {isAr ? "اكتشف" : "Discover"}
                        </div>
                      </div>
                    </div>
                    <div className="asrar-features-slide">
                      <div className="asrar-feature-item">
                        <div className="asrar-feature-icon">🌊</div>
                        <h3>Hidden Side™</h3>
                        <p>
                          A private space where deeper, long-term emotional patterns are captured as "whispers" about you and unlocked slowly as trust grows.
                        </p>
                        <div className="asrar-feature-hint">
                          {isAr ? "اكتشف" : "Discover"}
                        </div>
                      </div>
                    </div>
                    <div className="asrar-features-slide">
                      <div className="asrar-feature-item">
                        <div className="asrar-feature-icon">🌀</div>
                        <h3>11 Hidden Portals™</h3>
                        <p>
                          An immersive 11-step test that uncovers hidden layers of your personality through visual choices and micro-decisions, then reflects them back in a creepy-accurate way.
                        </p>
                        <div className="asrar-feature-hint">
                          {isAr ? "اكتشف" : "Discover"}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  className="asrar-features-slider-arrow asrar-features-slider-arrow--next"
                  onClick={goToNextFeaturesSlide}
                  aria-label={isAr ? "التالي" : "Next"}
                >
                  ›
                </button>
              </div>

              {/* Dots */}
              <div className="asrar-features-slider-dots">
                {[0, 1, 2, 3, 4].map((index) => (
                  <button
                    key={index}
                    className={`asrar-features-dot ${index === featuresSlideIndex ? 'active' : ''}`}
                    onClick={() => goToFeaturesSlide(index)}
                    aria-label={`Go to feature ${index + 1}`}
                  />
                ))}
              </div>

              {/* Desktop Grid - English Features */}

              <div className="asrar-features-grid">
                <div className="asrar-features-row-top">
                  <div className="asrar-feature-item">
                    <div className="asrar-feature-icon">🧠</div>
                    <h3>Asrar Emotional Engine™</h3>
                    <p>
                      Our proprietary emotional engine analyzes tone, patterns, and emotional states over time. It adapts to you and creates deeply human-like conversations grounded in psychological realism.
                    </p>
                    <div className="asrar-feature-hint">
                      {isAr ? "اكتشف" : "Discover"}
                    </div>
                  </div>
                  <div className="asrar-feature-item">
                    <div className="asrar-feature-icon">🛤️</div>
                    <h3>Emotional Journey™</h3>
                    <p>
                      Your companion tracks emotional growth, patterns, challenges, and victories—guiding you through a personal journey to understand yourself better every day.
                    </p>
                    <div className="asrar-feature-hint">
                      {isAr ? "اكتشف" : "Discover"}
                    </div>
                  </div>
                  <div className="asrar-feature-item">
                    <div className="asrar-feature-icon">🔮</div>
                    <h3>Mirror Me™</h3>
                    <p>
                      A reflective mode where your companion becomes a mirror, revealing your habits, blind spots, and emotional loops with clarity and care.
                    </p>
                    <div className="asrar-feature-hint">
                      {isAr ? "اكتشف" : "Discover"}
                    </div>
                  </div>
                </div>
                <div className="asrar-features-row-bottom">
                  <div className="asrar-feature-item">
                    <div className="asrar-feature-icon">🌊</div>
                    <h3>Hidden Side™</h3>
                    <p>
                      A private space where deeper, long-term emotional patterns are captured as "whispers" about you and unlocked slowly as trust grows.
                    </p>
                    <div className="asrar-feature-hint">
                      {isAr ? "اكتشف" : "Discover"}
                    </div>
                  </div>
                  <div className="asrar-feature-item">
                    <div className="asrar-feature-icon">🌀</div>
                    <h3>11 Hidden Portals™</h3>
                    <p>
                      An immersive 11-step test that uncovers hidden layers of your personality through visual choices and micro-decisions, then reflects them back in a creepy-accurate way.
                    </p>
                    <div className="asrar-feature-hint">
                      {isAr ? "اكتشف" : "Discover"}
                    </div>
                  </div>
                </div>
              </div>

              {/* UNIQUE VALUE PROPOSITION */}
              <div className="asrar-unique-proposition">
                <div className="asrar-unique-content">
                  <h3 className="asrar-unique-title">
                    {isAr 
                      ? "أسرار ليست مجرد مساعد ذكي" 
                      : "Asrar isn't just another AI assistant"
                    }
                  </h3>
                  <p className="asrar-unique-text">
                    {isAr 
                      ? "نحن نبني علاقات حقيقية بينك وبين الذكاء الاصطناعي. كل محادثة تشكلك، وكل قرار يأخذك أعمق. أسرار تفهمك لا كبيانات، بل كإنسان." 
                      : "We build real relationships between you and AI. Every conversation shapes you, every choice takes you deeper. Asrar understands you not as data, but as a human being."
                    }
                  </p>
                  <p className="asrar-unique-subtext">
                    {isAr 
                      ? "هذا هو المستقبل الذي لم تكن تعلم أنك بحاجة إليه." 
                      : "This is the future you didn't know you needed."
                    }
                  </p>
                </div>
              </div>
             
            </>
          )}
        </section>
        <div className="asrar-section-divider" aria-hidden="true" />

        {/* PRICING */}
        <section id="pricing" className="asrar-section asrar-section--pricing">
          <h2 className="asrar-section-title">
            {isAr ? "الأسعار" : "Pricing"}
          </h2>
          <p className="asrar-section-subtitle">
            {isAr ? "خطط مرنة تناسب احتياجاتك" : "Flexible plans to suit your needs"}
          </p>

          <div className="asrar-pricing-shell">
            <div className="asrar-pricing-cards-grid">
              {/* FREE PLAN */}
              <div className="asrar-pricing-card asrar-pricing-card--free">
                <div className="asrar-pricing-icon">💎</div>
                <h3>{isAr ? "مجاني" : "Free"}</h3>
                <p className="asrar-pricing-price">{isAr ? "٠$ / شهرياً" : "$0 / month"}</p>
                <ul className="asrar-pricing-features">
                  <li><span className="asrar-feature-icon">👥</span> {isAr ? "ثلاث شخصيات اساسية" : "3 core character"}</li>
                  <li><span className="asrar-feature-icon">💬</span> {isAr ? "٥٠ رسالة شهرياً" : "50 messages per month"}</li>
                  <li><span className="asrar-feature-icon">🎤</span> {isAr ? "رسائل صوتية متاحة" : "Voice messages included"}</li>
                   <li><span className="asrar-feature-icon">🧠</span>
                    {isAr
                      ? "محرك المشاعر العميق V6 (إرشاد أعمق وخطوات عملية)"
                      : "Powered by the Asrar Emotional Engine V6 for longer, structured guidance."}
                  </li>
                  <li><span className="asrar-feature-icon">🌙</span>
                    {isAr
                      ? "وصول إلى الجانب الخفي™ فقط"
                      : "Hidden Side™ access only (no Emotional Journey or Mirror Me)"}
                  </li>
                  <li><span className="asrar-feature-icon">⚡</span>
                    {isAr
                      ? "محرك المشاعر الخفيف (ردود قصيرة ودعم أساسي)"
                      : "Lite Emotional Engine for short, supportive replies."}
                  </li>
                  <li><span className="asrar-feature-icon">🚀</span>
                    {isAr
                      ? "موديل GPT-4o mini سريع ومناسب للاستخدام اليومي"
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
                <div className="asrar-pricing-icon">👑</div>
                <div className="asrar-pricing-badge">{isAr ? "الأكثر شيوعاً" : "Most Popular"}</div>
                <h3>{isAr ? "برو" : "Pro"}</h3>
                <p className="asrar-pricing-price">{isAr ? "$7.99 / شهرياً" : "$7.99 / month"}</p>
                <ul className="asrar-pricing-features">
                  <li><span className="asrar-feature-icon">🌟</span>
                    {isAr
                      ? "جميع شخصيات أسرار الخمسة"
                      : "All 5 Asrar characters"}
                  </li>
                  <li><span className="asrar-feature-icon">💬</span>
                    {isAr ? "٥٠٠ رسالة شهرياً" : "500 messages per month"}
                  </li>
                  <li><span className="asrar-feature-icon">🎤</span> {isAr ? "رسائل صوتية متاحة" : "Voice messages included"}</li>
                  <li><span className="asrar-feature-icon">🌈</span>
                    {isAr
                      ? "الجانب الخفي™، الرحلة العاطفية™، ومرآتي™"
                      : "Hidden Side™, Emotional Journey™ & Mirror Me™"}
                  </li>
                  <li><span className="asrar-feature-icon">🧠</span>
                    {isAr
                      ? "محرك المشاعر العميق V6 (إرشاد أعمق وخطوات عملية)"
                      : "Powered by the Asrar Emotional Engine V6 for longer, structured guidance."}
                  </li>
                  <li><span className="asrar-feature-icon">🎯</span>
  {isAr
    ? "موديل ذكاء أعلى GPT-4o لاستجابات أدق وأعمق"
    : "Higher-intelligence GPT-4o model for smarter, deeper responses."}
</li>
                  <li><span className="asrar-feature-icon">🧩</span>
                    {isAr
                      ? "ذاكرة محادثة متقدمة"
                      : "Advanced chat memory."}
                  </li>
                  <li><span className="asrar-feature-icon">🚫</span>
                    {isAr
                      ? "بدون إعلانات "
                      : "Ad-free experience."}
                  </li>
                  <li><span className="asrar-feature-icon">🌀</span> {isAr ? "١١ بوابة خفية™" : "11 Hidden Portals™"}</li>
                  <li><span className="asrar-feature-icon">❌</span> {isAr ? "إلغاء الاشتراك في أي وقت" : "Cancel anytime"}</li>
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
      ? "اذا عندك اي سؤال, مشاكل في الحساب او اقتراحات النا الشرف نسمع منك."
      : "For support, ideas, or partnerships — we’d love to hear from you."}
  </p>

  <div className="asrar-contact-grid">

    {/* GENERAL SUPPORT */}
    <div className="asrar-contact-card">
    <div className="asrar-contact-icon">
      💬
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
        ✨
      </div>
      <h3>{isAr ? "الاقتراحات والملاحظات" : "Feedback & Ideas"}</h3>
      <p>
        {isAr
          ? "شاركنا رأيك في تجربة أسرار AI أو أي ميزات تحب تشوفها  في المستقبل."
          : "Share how Asrar feels to use and what you’d love to see next."}
      </p>
      <a href="mailto:ideas@asrarai.com?subject=Asrar%20AI%20Feedback" className="asrar-contact-email">
        ideas@asrarai.com
      </a>
    </div>


    {/* BUSINESS & INVESTORS */}
    <div className="asrar-contact-card">
    <div className="asrar-contact-icon">
      🚀
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
