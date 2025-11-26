import AsrarFooter from "./AsrarFooter";
import { Link, useNavigate, Navigate } from "react-router-dom";
import React, { useState, useRef, useEffect } from "react";
import "./Dashboard.css";
import "./HomePage.css";
import "./CharacterCarousel.css";
import asrarLogo from "./assets/asrar-logo.png";
import abuZainAvatar from "./assets/abu_zain.png";
import hanaAvatar from "./assets/hana.png";
import rashidAvatar from "./assets/rashid.png";
import nourAvatar from "./assets/nour.png";
import farahAvatar from "./assets/farah.png";
import { useAuth } from "./hooks/useAuth";
import CharacterCarousel from "./CharacterCarousel";
import AsrarHeader from "./AsrarHeader";

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
      "دافئ وحكيم ومتزن. يمنحك نصائح حياتية وتوازناً عاطفياً وتوجيهاً لطيفاً.",
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
      "لطيفة ومتفهّمة. تساعدك مع كثرة التفكير، الحزن، الوحدة، والضغط.",
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
      "منظم واستراتيجي ومحفّز. يساعدك في الدراسة والتخطيط والعادات اليومية.",
  },
  {
    id: "nour",
    avatar: nourAvatar,
    nameEn: "Nour",
    nameAr: "نور",
    roleEn: "Brutal Honesty",
    roleAr: "صراحة قاسية",
    descriptionEn:
      "Unfiltered, sarcastic. Tells you the truth with good intentions, no sugar-coating.",
    descriptionAr:
      "صريح بلا مجاملة وبنوايا طيبة. يقول لك الحقيقة دون تلطيف.",
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
      "خفيفة ظل ومرحة. نكات، ميمز، وطاقة ضحك ولعب.",
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
      "Ø­Ø²ÙŠÙ†",
      "Ø­Ø²ÙŠÙ†Ø©",
      "Ø­Ø²Ù†",
      "Ø²Ø¹Ù„Ø§Ù†",
      "Ø²Ø¹Ù„",
      "Ù…ÙƒØ³ÙˆØ±",
      "Ù…Ù‚Ù‡ÙˆØ±",
      "Ù‚Ù‡Ø±",
      "ÙˆØ­Ø¯Ø©",
      "ÙˆØ­ÙŠØ¯",
      "ÙˆØ­ÙŠØ¯Ø©",
      "Ù…Ù‡Ù…ÙˆÙ…",
      "Ø¶ÙŠÙ‚",
      "Ø¶ÙŠÙ‚Ø©",
      "Ø§ÙƒØªØ¦Ø§Ø¨",
      "Ù…ÙƒØªØ¦Ø¨",
      "Ù‚Ù„Ù‚",
      "Ù‚Ù„Ù‚Ø§Ù†",
      "ØªÙˆØªØ±",
      "Ù…ØªÙˆØªØ±",
      "Ø®ÙˆÙ",
      "Ø®Ø§ÙŠÙ",
      "Ù…Ø±Ø¹ÙˆØ¨",
      "ØªØ¹Ø¨Ø§Ù†",
      "ØªØ¹Ø¨",
      "Ù…Ø±Ù‡Ù‚",
      "Ù…Ù†Ù‡Ùƒ",
      "Ø·ÙØ´Ø§Ù†",
      "Ø·ÙØ´",
      "Ø²Ù‡Ù‚Ø§Ù†",
      "Ù…Ù„Ù„",
      "Ù…Ø¹ØµØ¨",
      "Ø¹ØµØ¨ÙŠØ©",
      "ØºØ¶Ø¨Ø§Ù†",
      "ØºØ¶Ø¨",
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
      "Ù‚Ù„Ù‚",
      "Ù‚Ù„Ù‚Ø§Ù†",
      "ØªÙˆØªØ±",
      "Ù…ØªÙˆØªØ±",
      "Ø®ÙˆÙ",
      "Ø®Ø§ÙŠÙ",
      "Ù…Ø±Ø¹ÙˆØ¨",
      "Ù…Ø¶ØºÙˆØ·",
      "Ø¶ØºØ·",
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
      "ÙƒØ³Ù„",
      "ÙƒØ³Ù„Ø§Ù†",
      "Ø¨Ø¯ÙˆÙ† Ø·Ø§Ù‚Ø©",
      "Ù…Ø§ÙÙŠ Ø·Ø§Ù‚Ø©",
      "Ù…Ø§ ÙÙŠ Ø·Ø§Ù‚Ø©",
      "Ø®Ù…ÙˆÙ„",
      "Ù…Ùˆ Ù…Ø±ÙƒØ²",
      "Ù…Ø´ Ù…Ø±ÙƒØ²",
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
      "Ø¯Ø±Ø§Ø³Ø©",
      "Ø§Ø¯Ø±Ø³",
      "Ø£Ø¯Ø±Ø³",
      "Ø§Ù…ØªØ­Ø§Ù†",
      "Ø§Ù…ØªØ­Ø§Ù†Ø§Øª",
      "Ø¬Ø§Ù…Ø¹Ø©",
      "Ù…Ø¯Ø±Ø³Ø©",
      "Ø´ØºÙ„",
      "ÙˆØ¸ÙŠÙØ©",
      "Ù…Ø´Ø±ÙˆØ¹",
      "Ø¯ÙˆØ§Ù…",
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
      "ØµØ§Ø±Ø­Ù†ÙŠ",
      "Ø¨Ø¯ÙˆÙ† Ù…Ø¬Ø§Ù…Ù„Ø©",
      "Ø¨Ø¯ÙˆÙ† Ù…Ø¬Ø§Ù…Ù„Ø§Øª",
      "Ø¬Ù„Ø¯",
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
      "Ø·ÙØ´Ø§Ù†",
      "Ø·ÙØ´",
      "Ø²Ù‡Ù‚Ø§Ù†",
      "Ù…Ù„Ù„",
      "Ù†ÙƒØª",
      "Ø¶Ø­Ùƒ",
      "Ø§Ø¶Ø­Ùƒ",
      "Ø£Ø¶Ø­Ùƒ",
      "Ù…ÙŠÙ…Ø²",
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
      "Ø£Ø¨",
      "Ø§Ø¨Ùˆ",
      "Ø£Ø¨Ùˆ",
      "Ø£Ù…",
      "Ø§Ù…ÙŠ",
      "Ø£Ù…ÙŠ",
      "Ø£Ù‡Ù„",
      "Ø¹Ø§Ø¦Ù„Ø©",
      "Ø²ÙˆØ§Ø¬",
      "Ù…ØªØ²ÙˆØ¬",
      "Ø²ÙˆØ¬ØªÙŠ",
      "Ø²ÙˆØ¬ÙŠ",
      "Ø®Ø·ÙˆØ¨Ø©",
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
      "ØªØ¹Ø¨Ø§Ù†",
      "ØªØ¹Ø¨",
      "Ù…Ø±Ù‡Ù‚",
      "Ù…Ù†Ù‡Ùƒ",
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
        ? "Ø§ÙƒØªØ¨ Ù„ÙŠ Ø¬Ù…Ù„Ø© Ø£Ùˆ Ø¬Ù…Ù„ØªÙŠÙ† Ø¹Ù† ÙŠÙˆÙ…Ùƒ Ø£Ùˆ Ø§Ù„Ø´ÙŠØ¡ Ø§Ù„Ù„ÙŠ Ù…Ø¶Ø§ÙŠÙ‚ÙƒØŒ Ø¹Ø´Ø§Ù† Ø£Ù‚Ø¯Ø± Ø£Ø³Ø§Ø¹Ø¯Ùƒ Ø£ÙƒØ«Ø±."
        : "Try writing one or two sentences about your day or whatâ€™s bothering you so I can actually help.",
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
    "Ø­Ø²ÙŠÙ†",
    "Ø­Ø²ÙŠÙ†Ø©",
    "Ø­Ø²Ù†",
    "Ø²Ø¹Ù„Ø§Ù†",
    "Ø²Ø¹Ù„",
    "Ù…ÙƒØ³ÙˆØ±",
    "Ù…Ù‚Ù‡ÙˆØ±",
    "Ù‚Ù‡Ø±",
    "ÙˆØ­Ø¯Ø©",
    "ÙˆØ­ÙŠØ¯",
    "ÙˆØ­ÙŠØ¯Ø©",
    "Ù…Ù‡Ù…ÙˆÙ…",
    "Ø¶ÙŠÙ‚",
    "Ø¶ÙŠÙ‚Ø©",
    "Ø§ÙƒØªØ¦Ø§Ø¨",
    "Ù…ÙƒØªØ¦Ø¨",
    "Ù‚Ù„Ù‚",
    "Ù‚Ù„Ù‚Ø§Ù†",
    "ØªÙˆØªØ±",
    "Ù…ØªÙˆØªØ±",
    "Ø®ÙˆÙ",
    "Ø®Ø§ÙŠÙ",
    "Ù…Ø±Ø¹ÙˆØ¨",
    "ØªØ¹Ø¨Ø§Ù†",
    "ØªØ¹Ø¨",
    "Ù…Ø±Ù‡Ù‚",
    "Ù…Ù†Ù‡Ùƒ",
    "Ø·ÙØ´Ø§Ù†",
    "Ø·ÙØ´",
    "Ø²Ù‡Ù‚Ø§Ù†",
    "Ù…Ù„Ù„",
    "Ù…Ø¹ØµØ¨",
    "Ø¹ØµØ¨ÙŠØ©",
    "ØºØ¶Ø¨Ø§Ù†",
    "ØºØ¶Ø¨",
  ];

  const hasKnownKeyword = knownKeywords.some((kw) => lower.includes(kw));

  // Very short input *without* any known emotional keyword â†’ treat as unclear / gibberish.
  if (isVeryShort && !hasKnownKeyword) {
    return {
      charId: null,
      text: isAr
        ? "Ù…Ø§ Ù‚Ø¯Ø±Øª Ø£ÙÙ‡Ù… Ø§Ù„ÙƒÙ„Ù…Ø© Ø§Ù„Ù„ÙŠ ÙƒØªØ¨ØªÙ‡Ø§. Ø¬Ø±Ù‘Ø¨ ØªÙƒØªØ¨ Ø¨Ø¬Ù…Ù„Ùƒ Ø§Ù„Ø¨Ø³ÙŠØ·Ø© Ø¹Ù† Ø´Ø¹ÙˆØ±Ùƒ Ø£Ùˆ Ø¹Ù† Ø§Ù„Ø´ÙŠØ¡ Ø§Ù„Ù„ÙŠ ØµØ§ÙŠØ± Ù…Ø¹Ùƒ Ø¹Ø´Ø§Ù† Ø£Ù‚Ø¯Ø± Ø£ÙÙ‡Ù…Ùƒ Ø£ÙƒØ«Ø±."
        : "I couldnâ€™t really understand what you wrote. Try using simple words to describe how you feel or whatâ€™s happening so I can follow you.",
    };
  }

  const recId = getCharacterRecommendation(trimmed);
  const char = recId && CHARACTERS.find((c) => c.id === recId);

  if (!char) {
    return {
      charId: null,
      text: isAr
        ? "Ø£Ø´Ø¹Ø± Ø¨Ø«Ù‚Ù„ Ø§Ù„ÙƒÙ„Ø§Ù… Ø§Ù„Ø°ÙŠ ÙƒØªØ¨ØªÙ‡ØŒ ÙˆÙ‡Ø°Ø§ Ù…ÙƒØ§Ù† Ø¢Ù…Ù† ØªÙ…Ø§Ù…Ø§Ù‹ Ù„ÙØ¶ÙØ¶ØªÙƒ. Ø­ØªÙ‰ Ù„Ùˆ Ø´Ø¹Ø±Øª Ø£Ù†Ùƒ ÙˆØ­Ø¯ÙƒØŒ Ø£Ù†Øª Ù„Ø³Øª ÙˆØ­Ø¯Ùƒ Ù‡Ù†Ø§."
        : "I can feel thereâ€™s a lot in what you wrote. This is a safe place to unload â€“ even if it feels like youâ€™re alone, youâ€™re not alone here.",
    };
  }

  if (isAr) {
    const intro = "Ø£ÙÙ‡Ù… Ø£Ù† Ù…Ø§ ÙƒØªØ¨ØªÙ‡ Ù„ÙŠØ³ Ø³Ù‡Ù„Ø§Ù‹ØŒ ÙˆØ´Ø¹ÙˆØ±Ùƒ Ù…ÙÙ‡Ù… Ù‡Ù†Ø§.";
    const body = `Ù…Ù† Ø¨ÙŠÙ† Ø±ÙÙ‚Ø§Ø¡ Ø£Ø³Ø±Ø§Ø±ØŒ Ø£Ø±Ù‰ Ø£Ù† ${char.nameAr} (${char.roleAr}) Ø£Ù†Ø³Ø¨ Ø±ÙÙŠÙ‚ Ù„Ùƒ Ø§Ù„Ø¢Ù†. ${char.descriptionAr}`;
    const ctaHint = "ØªÙ‚Ø¯Ø± ØªØ¨Ø¯Ø£ Ù…Ø­Ø§Ø¯Ø«Ø© ÙƒØ§Ù…Ù„Ø© Ù…Ø¹Ù‡/Ù…Ø¹Ù‡Ø§ Ù…Ù† Ø§Ù„Ø²Ø± Ø¨Ø§Ù„Ø£Ø³ÙÙ„.";
    return {
      charId: recId,
      text: `${intro} ${body} ${ctaHint}`,
    };
  }

  const intro = "I can tell what you shared isnâ€™t easy, and your feelings matter here.";
  const body = `Out of the Asrar companions, Iâ€™d match you with ${char.nameEn} (${char.roleEn}) right now. ${char.descriptionEn}`;
  const ctaHint = "You can start a full conversation with them using the button below.";

  return {
    charId: recId,
    text: `${intro} ${body} ${ctaHint}`,
  };
}

export default function HomePage() {
  // language + mood gate
  const { user, isAuthLoading, logout } = useAuth();
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
    CHARACTERS[2].id // Start with Rashid (index 2) selected by default
  );

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

  // Show loading state while checking auth
  if (isAuthLoading) {
    return (
      <div className="asrar-fullpage-loading">
        <div className="asrar-loading-spinner"></div>
        <p>{isAr ? "Ø¬Ø§Ø±ÙŠ Ø§Ù„ØªØ­Ù…ÙŠÙ„..." : "Loading your experience..."}</p>
      </div>
    );
  }

  // If user is logged in, we now allow access to the public Home page as well.
  // No redirect to /dashboard here.

  // Only show public homepage if not loading and not logged in
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
        { href: "#hero", label: "Ø§Ù„Ø±Ø¦ÙŠØ³ÙŠØ©" },
        { href: "#emotional-engine", label: "Ù…Ø­Ø±Ùƒ Ø§Ù„Ù…Ø´Ø§Ø¹Ø±" },
        { href: "#about", label: "Ù…Ù† Ù†Ø­Ù†" },
        { href: "#characters", label: "Ø§Ù„Ø´Ø®ØµÙŠØ§Øª" },
        { href: "#security-privacy", label: "Ø§Ù„Ø£Ù…Ø§Ù† ÙˆØ§Ù„Ø®ØµÙˆØµÙŠØ©" },
        { href: "#how-it-works", label: "ÙƒÙŠÙ ÙŠØ¹Ù…Ù„ØŸ" },
        { href: "#pricing", label: "Ø§Ù„Ø£Ø³Ø¹Ø§Ø±" },
      ]
    : [
        { href: "#hero", label: "Home" },
        { href: "#emotional-engine", label: "Emotional Engine" },
        { href: "#about", label: "About" },
        { href: "#characters", label: "Characters" },
        { href: "#security-privacy", label: "Security & Privacy" },
      
        { href: "#pricing", label: "Pricing" },
      ];

  const brandLabel = "ASRAR AI";

  const authLabels = isAr
    ? { login: "ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø¯Ø®ÙˆÙ„", signup: "Ø£Ù†Ø´Ø¦ Ø­Ø³Ø§Ø¨Ù‹Ø§" }
    : { login: "Login", signup: "Create Account" };

  const homeDashboardLabel = isAr ? "Ù„ÙˆØ­Ø© Ø§Ù„ØªØ­ÙƒÙ…" : "Dashboard";

  const chatInputTitle = isAr ? "Ø§ÙƒØªØ¨ Ø±Ø³Ø§Ù„ØªÙƒ" : "Compose your message";
  const chatInputSubtitle = isAr
    ? "Ù‡Ø°Ø§ Ø³ÙŠØµÙ„ Ù…Ø¨Ø§Ø´Ø±Ø© Ø¥Ù„Ù‰ Ø±ÙÙŠÙ‚Ùƒ"
    : "Goes straight to your companion";
  const chatInputFootnote = isAr
    ? "Ø§Ø¶ØºØ· Enter Ù„Ù„Ø¥Ø±Ø³Ø§Ù„ â€¢ Ø§Ø³ØªØ®Ø¯Ù… Shift+Enter Ù„Ø³Ø·Ø± Ø¬Ø¯ÙŠØ¯"
    : "Press Enter to send â€¢ Shift+Enter for a new line";

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
    if (typeof document === "undefined" || typeof window === "undefined") return;
    const id = href.slice(1);
    const el = document.getElementById(id);
    if (el) {
      try {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      } catch (_) {}
    } else {
      // Set hash so that the mount effect can handle scrolling when the element exists
      try { window.location.hash = href; } catch (_) {}
    }
  };

  

  const handleLanguageSwitch = (lang) => {
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
        <div className="asrar-home-header-left">
          <Link to="/" className="asrar-dash-logo-wrap">
            <span className="asrar-dash-brand">ASRAR AI</span>
          </Link>
        </div>

        {/* CENTER NAV LINKS */}
        <nav className={`asrar-home-header-center ${isAr ? "asrar-home-header-center--ar" : ""}`}>
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

        <div className="asrar-home-header-right">
          {/* language toggle */}
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
              ????
            </button>
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

          {/* Mobile menu toggle */}
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

      {/* MOBILE NAV DRAWER */}
      {isMobileNavOpen && (
        <div className="asrar-home-mobile-layer" role="dialog" aria-modal="true">
          <div
            className="asrar-home-mobile-overlay"
            onClick={() => setIsMobileNavOpen(false)}
          ></div>
          <nav className="asrar-home-mobile-nav asrar-home-mobile-nav--open">
            <div className="asrar-home-mobile-nav-header">
              <span className="asrar-home-mobile-nav-title">ASRAR AI</span>
              <button
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
                ????Š
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
          <div className="asrar-logo-frame">
            <div className="asrar-logo-inner">
              <img src={asrarLogo} alt="Asrar logo" />
            </div>
          </div>
 <div className="asrar-hero-copy">
  <p className="asrar-hero-eyebrow">
    {isAr
      ? "Ø£ÙˆÙ‘Ù„ Ø±ÙÙÙ‚Ø§Ø¡ Ø°ÙƒØ§Ø¡ Ø§ØµØ·Ù†Ø§Ø¹ÙŠ Ø®Ø§ØµÙ‘ÙˆÙ†â€¦ Ù…ÙØµÙ…Ù‘Ù…ÙˆÙ† Ø®ØµÙŠØµØ§Ù‹ Ù„Ù„Ø´Ø±Ù‚ Ø§Ù„Ø£ÙˆØ³Ø·."
      : "The First Private AI Companions Built for the Middle East."}
  </p>

  <h1 className="asrar-hero-title">
    {isAr
      ? "Ø­ÙŠØ« ØªÙ„ØªÙ‚ÙŠ Ø§Ù„Ø«Ù‚Ø§ÙØ© Ø¨Ø§Ù„Ù…Ø´Ø§Ø¹Ø± ÙˆØ§Ù„ØªÙ‚Ù†ÙŠØ©."
      : "Where culture, emotion, and technology meet."}
  </h1>

 
</div>

          {/* HERO COLUMNS */}
          <div className="asrar-hero-columns">
            <div className="asrar-hero-left">
              <div className="asrar-chat-wrapper">
                <div className="asrar-chat-phone">
                  <div className="asrar-chat-header">
                    <div className="asrar-chat-avatar"></div>
                   
                  </div>

                  <div className="asrar-chat-body">
                    <div className="bubble bubble-ai">
                      <div className="bubble-ai-label">
                        {isAr
                          ? " Ø¯Ø¹Ù… Ø¹Ù…ÙŠÙ‚"
                          : " Deep Support"}
                      </div>
                      <p className="bubble-ai-text">
                        {isAr
                          ? "Ø£Ù†Ø§ Ù…Ø¹Ùƒ. Ø®Ø° Ù†ÙØ³ Ø¹Ù…ÙŠÙ‚ØŒ ÙˆØ§ÙƒØªØ¨ Ù„ÙŠ Ø¨ØµØ±Ø§Ø­Ø©â€¦ Ù…Ø§ Ø§Ù„Ø´ÙŠØ¡ Ø§Ù„Ù„ÙŠ Ø­Ø§Ø³Ø³ Ø¥Ù†Ù‡ Ø¬Ø§Ù„Ø³ Ø¹Ù„Ù‰ ØµØ¯Ø±Ùƒ Ø§Ù„ÙŠÙˆÙ…ØŸ"
                          : "Iâ€™m here. Take a slow breath. Tell me honestly â€” whatâ€™s been sitting on your chest lately?"}
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
                              ? `Ø§Ø¨Ø¯Ø£ Ø§Ù„Ù…Ø­Ø§Ø¯Ø«Ø© Ù…Ø¹ ${miniChatCharacter.nameAr}`
                              : `Chat with ${miniChatCharacter.nameEn.split(" ")[0]}`}
                          </Link>
                        )}
                      </div>
                    )}
                  </div>

         <form
  className="asrar-mood-form"
  onSubmit={handleMiniChatSubmit}
>
  <div className="asrar-mood-shell">
    <div className="asrar-mood-bar">
      <textarea
        ref={miniChatInputRef}
        className="asrar-mood-input"
        value={miniChatInput}
        onChange={handleMiniChatChange}
        onKeyDown={handleMiniChatKeyDown}
        placeholder={
          isAr
            ? "Ø§ÙƒØªØ¨ ÙƒÙŠÙ ÙƒØ§Ù† ÙŠÙˆÙ…Ùƒ ÙØ¹Ù„Ø§Ù‹ Ø§Ù„Ø¢Ù†..."
            : "Type how you feel today..."
        }
      />
    <button className="asrar-mood-send" type="submit" aria-label="Send">
  <svg
    className="asrar-mood-send-icon"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path
      d="M4 11.5L19 4l-7.5 15-1.6-5.4L4 11.5z"
      fill="currentColor"
    />
  </svg>
</button>

    </div>
    <div className="asrar-mood-foot">
      {chatInputFootnote}
    </div>
  </div>
</form>



                </div>
              </div>
            </div>
          </div>
        </section>

        {/* EMOTIONAL ENGINE */}
        <section id="emotional-engine" className="asrar-section asrar-engine">
          <div className="asrar-engine-inner">
            <p className="asrar-eyebrow">
              {isAr ? "Ù…ÙØ­Ø±Ùƒ Ø§Ù„Ù…Ø´Ø§Ø¹Ø± Ù…Ù† Ø£Ø³Ø±Ø§Ø±" : "ASRAR EMOTIONAL ENGINEâ„¢"}
            </p>
            <h2 className="asrar-engine-title">
              {isAr
                ? "Ø°ÙƒØ§Ø¡ Ø¹Ø§Ø·ÙÙŠ Ø­Ù‚ÙŠÙ‚ÙŠ â€” ÙˆÙ„ÙŠØ³ Ø±Ø¯ÙˆØ¯ Ø°ÙƒØ§Ø¡ Ø§ØµØ·Ù†Ø§Ø¹ÙŠ Ø¹Ø´ÙˆØ§Ø¦ÙŠØ©."
                : "Real emotional intelligence â€” not generic AI replies."}
            </h2>
            <p className="asrar-engine-body">
              {isAr
                ? "ÙƒÙ„ Ù…Ø­Ø§Ø¯Ø«Ø© ÙÙŠ Ø£Ø³Ø±Ø§Ø± ØªØ¹Ù…Ù„ Ø¹Ø¨Ø± Ø·Ø¨Ù‚Ø© Ø°ÙƒØ§Ø¡ Ø¹Ø§Ø·ÙÙŠ Ø®Ø§ØµØ© Ø¨Ù†Ø§ Ù…Ø¨Ù†ÙŠØ© ÙÙˆÙ‚ Ù†Ù…Ø§Ø°Ø¬ Ø°ÙƒØ§Ø¡ Ø§ØµØ·Ù†Ø§Ø¹ÙŠ Ù…ØªÙ‚Ø¯Ù…Ø©. Ù‡Ø°Ù‡ Ø§Ù„Ø·Ø¨Ù‚Ø© ØªÙ„ØªÙ‚Ø· Ù…Ø²Ø§Ø¬ÙƒØŒ ÙˆØªÙÙ‡Ù… Ù†Ø¨Ø±Ø© ÙƒÙ„Ø§Ù…Ùƒ ÙˆØ³ÙŠØ§Ù‚Ùƒ Ø§Ù„Ø«Ù‚Ø§ÙÙŠØŒ Ø«Ù… ØªØ´ÙƒÙ‘Ù„ Ø§Ù„Ø±Ø¯ Ù…Ù† Ø®Ù„Ø§Ù„ Ø´Ø®ØµÙŠØ© ÙƒÙ„ ÙˆØ§Ø­Ø¯ Ù…Ù† Ø±ÙÙ‚Ø§Ø¡ Ø£Ø³Ø±Ø§Ø± â€” Ù„ØªØ´Ø¹Ø± Ø£Ù† Ø§Ù„Ø­Ø¯ÙŠØ« Ø¥Ù†Ø³Ø§Ù†ÙŠ Ø£ÙƒØ«Ø±ØŒ Ø«Ø§Ø¨ØªØŒ ÙˆÙØ¹Ù„Ø§Ù‹ Ø¯Ø§Ø¹Ù…."
                : "Every conversation in Asrar is powered by our own emotional intelligence layer built on top of advanced AI models. It detects your mood, understands your tone and cultural context, and shapes the reply through the personality of each character â€” so it feels more human, grounded, and truly supportive."}
            </p>

            <div className="asrar-engine-grid">
              <article className="asrar-engine-card">
                <h3>{isAr ? "Ø§Ø³ØªØ¬Ø§Ø¨Ø§Øª ÙˆØ§Ø¹ÙŠØ© Ø¨Ø§Ù„Ù…Ø´Ø§Ø¹Ø±" : "Emotion-Aware Responses"}</h3>
                <p>
                  {isAr
                    ? "ÙŠÙ‚ÙˆÙ… Ø§Ù„Ù…Ø­Ø±Ùƒ Ø¨ØªØµÙ†ÙŠÙ Ù…Ø§ ØªØ´Ø¹Ø± Ø¨Ù‡ â€” Ù…Ø«Ù„ Ø§Ù„Ø­Ø²Ù†ØŒ Ø§Ù„Ù‚Ù„Ù‚ØŒ Ø§Ù„ÙˆØ­Ø¯Ø©ØŒ Ø§Ù„ØºØ¶Ø¨ ÙˆØºÙŠØ±Ù‡Ø§ â€” ÙˆÙŠØ¶Ø¨Ø· Ù†Ø¨Ø±Ø© ÙˆØ¹Ù…Ù‚ Ø§Ù„Ø±Ø¯ Ù„ÙŠØªÙ†Ø§Ø³Ø¨ Ù…Ø¹ Ø­Ø§Ù„ØªÙƒ Ø§Ù„Ø¹Ø§Ø·ÙÙŠØ©."
                    : "The engine classifies how you feel â€” sadness, anxiety, loneliness, anger, and more â€” and adapts the tone and depth of the reply to match your emotional state."}
                </p>
              </article>

              <article className="asrar-engine-card">
                <h3>{isAr ? "Ø¯Ø¹Ù… Ù…Ø®ØµØµ Ù„ÙƒÙ„ Ø´Ø®ØµÙŠØ©" : "Persona-Driven Support"}</h3>
                <p>
                  {isAr
                    ? "Ù‡ÙŽÙ†Ø§ØŒ Ø£Ø¨Ùˆ Ø²ÙŠÙ†ØŒ Ø±Ø´ÙŠØ¯ØŒ Ù†ÙˆØ±ØŒ ÙˆÙÙŽØ±ÙŽØ­ ÙŠØ´ØªØ±ÙƒÙˆÙ† ÙÙŠ Ù†ÙØ³ Ù…Ø­Ø±Ùƒ Ø§Ù„Ù…Ø´Ø§Ø¹Ø±ØŒ Ù„ÙƒÙ† ÙƒÙ„ ÙˆØ§Ø­Ø¯ Ù…Ù†Ù‡Ù… ÙŠØ±Ø¯ Ø¨Ø£Ø³Ù„ÙˆØ¨ ÙˆØµÙˆØª ÙˆÙ…Ø³ØªÙˆÙ‰ ØªÙˆØ¬ÙŠÙ‡ Ù…Ø®ØªÙ„Ù."
                    : "Hana, Abu Zain, Rashid, Nour, and Farah all share the same emotional engine, but each one responds with a different style, voice, and level of guidance."}
                </p>
              </article>

              <article className="asrar-engine-card">
                <h3>{isAr ? "Ù…ØµÙ…Ù… Ø®ØµÙŠØµØ§Ù‹ Ù„Ù„Ù…Ù†Ø·Ù‚Ø© Ø§Ù„????ŠØ©" : "Built for the Middle East"}</h3>
                <p>
                  {isAr
                    ? "ØªÙ… ØªØµÙ…ÙŠÙ… Ø£Ø³Ø±Ø§Ø± ÙÙŠ Ø§Ù„Ø£Ø±Ø¯Ù† Ù…Ø¹ Ø£Ø®Ø° Ø§Ù„Ø«Ù‚Ø§ÙØ© Ø§Ù„????ŠØ© ÙÙŠ Ø§Ù„Ø­Ø³Ø¨Ø§Ù†ØŒ Ù„ØªØ¬Ù…Ø¹ Ø¨ÙŠÙ† Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ Ø§Ù„Ø­Ø¯ÙŠØ« ÙˆØ§Ù„Ø­Ø³ Ø§Ù„Ù…Ø­Ù„ÙŠ ÙˆØ§Ù„Ø§Ø­ØªØ±Ø§Ù… ÙˆØ§Ù„Ø¯ÙØ¡ â€” ÙˆÙ„ÙŠØ³ Ù…Ø¬Ø±Ø¯ Ù†Ø³Ø®Ø© Ù…Ù† Ù‚Ø§Ù„Ø¨ ØºØ±Ø¨ÙŠ."
                    : "Designed in Jordan with Arab culture in mind, Asrar blends modern AI with local nuance, respect, and warmth â€” not a copy-paste of a Western template."}
                </p>
              </article>
            </div>
          </div>
        </section>

        {/* ABOUT */}
        <section id="about" className="asrar-section asrar-section--about">
          <h2 className="asrar-section-title">
            {isAr ? "Ù…Ù† Ù†Ø­Ù†" : "We Are Asrar AI"}
          </h2>
          <p className="asrar-section-body">
            {isAr
              ? 'Ø£Ø³Ø±Ø§Ø± ØªØ¹Ù†ÙŠ "Ø§Ù„Ø£Ø³Ø±Ø§Ø±". ÙˆÙÙ„Ø¯ Ù‡Ø°Ø§ Ø§Ù„Ù…Ø´Ø±ÙˆØ¹ Ù…Ù† ÙÙƒØ±Ø© Ø£Ù† Ø§Ù„Ù†Ø§Ø³ ÙÙŠ Ø§Ù„Ø¹Ø§Ù„Ù… Ø§Ù„????Š ÙŠØ³ØªØ­Ù‚ÙˆÙ† Ù…Ø³Ø§Ø­Ø© Ø®Ø§ØµØ© ÙˆØ¢Ù…Ù†Ø© Ù„ÙŠÙØ¶ÙØ¶ÙˆØ§ ÙˆÙŠÙƒØªØ¨ÙˆØ§ ÙˆÙŠÙØ³Ù…ÙØ¹ÙˆØ§ Ù…Ø´Ø§Ø¹Ø±Ù‡Ù… ÙÙŠ Ø£ÙŠ ÙˆÙ‚Øª. Ø§Ù„Ø´Ø¹Ø§Ø± Ø§Ù„Ø°ÙŠ ØªØ±Ø§Ù‡ Ù‡Ùˆ Ø¨Ø®Ø· ÙŠØ¯ÙŠ ÙˆØ§Ù„Ø¯ÙŠØŒ ÙˆØªØ°ÙƒÙŠØ± Ø£Ù† Ø®Ù„Ù ÙƒÙ„ Ù‡Ø°Ù‡ Ø§Ù„ØªÙ‚Ù†ÙŠØ© Ù‚Ù„ÙˆØ¨ ÙˆÙ‚ØµØµ Ø­Ù‚ÙŠÙ‚ÙŠØ©.'
              : 'Asrar means â€œsecretsâ€ in Arabic. This project was born from the idea that people in the Arab world deserve a private, culturally aware place to vent, think, and feel supported â€” any time of day. The logo you see is handwritten by my father, and it reminds us that behind all the tech there are real hearts and real stories.'}
          </p>
        </section>

        {/* CHARACTERS */}
        <section id="characters" className="asrar-section asrar-characters-section">
          <div className="asrar-section-header">
            <h2 className="asrar-section-title">
              {isAr ? "Ù‚Ù„Ø¨ Ø¹Ø§Ø¦Ù„Ø© Ø£Ø³Ø±Ø§Ø±" : "The Asrar Core Family"}
            </h2>
            <p className="asrar-section-subtitle">
              {isAr
                ? "Ø®Ù…Ø³Ø© Ø±ÙÙ‚Ø§Ø¡ØŒ ÙƒÙ„ ÙˆØ§Ø­Ø¯ Ù…Ù†Ù‡Ù… ÙŠÙ…Ø«Ù„ Ø¬Ø§Ù†Ø¨Ø§Ù‹ Ù…Ø®ØªÙ„ÙØ§Ù‹ Ù…Ù† Ø§Ø­ØªÙŠØ§Ø¬Ùƒ Ø§Ù„Ø¹Ø§Ø·ÙÙŠ."
                : "Five companions, each reflecting a different side of your emotional needs."}
            </p>
          </div>

          <div className="asrar-character-grid-wrapper">
            <div className="asrar-character-grid">
              {CHARACTERS.map((character) => {
                const isLocked = ((!user || user.plan !== "pro") && character.id !== "hana");
                const cardClasses =
                  "asrar-character-card" + (isLocked ? " asrar-character-card--locked" : "");
                return (
                  <div key={character.id} className={cardClasses} id={`character-${character.id}`}>
                    {isLocked && (
                      <span className="asrar-character-pro-pill">
                        {isAr ? "Ø®Ø·Ø© Ø¨Ø±Ùˆ ÙÙ‚Ø·" : "Pro only"}
                      </span>
                    )}

                    <div className="asrar-character-card-inner">
                      <div className="asrar-character-card-top asrar-character-card-top--stack">
                        <img
                          className="asrar-character-avatar"
                          src={character.avatar}
                          alt={`${character.nameEn} avatar`}
                        />
                        <h3 className="asrar-character-name">
                          {isAr ? character.nameAr : character.nameEn}
                        </h3>
                        <p className="asrar-character-role">
                          {isAr ? character.roleAr : character.roleEn}
                        </p>
                      </div>

                      <p className="asrar-character-desc">
                        {isAr ? character.descriptionAr : character.descriptionEn}
                      </p>

                      <div className="asrar-character-footer">
                        <button
                          type="button"
                          className="asrar-btn primary asrar-character-cta"
                          onClick={() => {
                            if (typeof window !== "undefined") {
                              try {
                                window.localStorage.setItem(
                                  "asrar-selected-character",
                                  character.id
                                );
                              } catch (_) {}
                            }
                            navigate(user ? "/dashboard" : "/create-account");
                          }}
                        >
                          {isAr
                            ? `Ø§Ø¨Ø¯Ø£ Ø§Ù„Ù…Ø­Ø§Ø¯Ø«Ø© Ù…Ø¹ ${character.nameAr}`
                            : `Talk to ${character.nameEn}`}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="asrar-character-carousel-wrapper">
            <CharacterCarousel
              characters={CHARACTERS}
              selectedCharacterId={selectedCharacterId}
              onChange={(char) => setSelectedCharacterId(char.id)}
              isAr={isAr}
              variant="home"
              isFreePlan={!user || user.plan !== "pro"}
            />
          </div>
        </section>

        {/* SECURITY & PRIVACY / WHY */}
        <section
          id="security-privacy"
          className="asrar-section asrar-section--features"
        >
          <h2 className="asrar-section-title">
            {isAr ? "Ù„Ù…Ø§Ø°Ø§ Ù…ÙƒØ§Ù† Ø£Ø³Ø±Ø§Ø±Ùƒ Ù‡Ù†Ø§ØŸ" : "Why Your Secrets Belong Here"}
          </h2>
          <p className="asrar-section-subtitle">
            {isAr ? "Ø§Ù„Ø£Ù…Ø§Ù† ÙˆØ§Ù„Ø®ØµÙˆØµÙŠØ©" : "Security & Privacy"}
          </p>

          <div className="asrar-section-body">
            <p>
              {isAr
                ? "Ø®ØµÙˆØµÙŠØªÙƒ Ø£ÙˆÙ„Ø§Ù‹ Ø¯Ø§Ø¦Ù…Ø§Ù‹. Ø£Ø³Ø±Ø§Ø± AI Ù…Ø¨Ù†ÙŠ Ù„ÙŠÙƒÙˆÙ† Ù…Ø³Ø§Ø­Ø© Ø¢Ù…Ù†Ø©ØŒ ÙˆÙ„ÙŠØ³ Ù…ØµÙ†Ø¹ Ø¨ÙŠØ§Ù†Ø§Øª. Ù…Ø­Ø§Ø¯Ø«Ø§ØªÙƒ Ù„Ø§ ØªÙØ®Ø²Ù‘ÙŽÙ† Ø£Ø¨Ø¯Ø§Ù‹ ÙƒÙ†Øµ ÙˆØ§Ø¶Ø­Ø› Ø¨Ù„ ØªÙØ´ÙÙ‘ÙŽØ± Ø¹Ù„Ù‰ Ù…Ø³ØªÙˆÙ‰ Ø§Ù„ØªØ·Ø¨ÙŠÙ‚ Ù‚Ø¨Ù„ Ø£Ù† ØªÙ„Ù…Ø³ Ù‚Ø§Ø¹Ø¯Ø© Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª."
                : "Your privacy comes first. Asrar AI is built as a safe space, not a data farm. Your conversations are never stored in plain text â€” theyâ€™re encrypted at the application level before they ever touch our database."}
            </p>
            <p>
              {isAr
                ? "Ø£Ù†Øª Ø§Ù„Ù…ØªØ­ÙƒÙ‘Ù… Ø¯Ø§Ø¦Ù…Ø§Ù‹: ÙŠÙ…ÙƒÙ†Ùƒ Ø¥ÙŠÙ‚Ø§Ù Ø­ÙØ¸ Ø³Ø¬Ù„ Ø§Ù„Ù…Ø­Ø§Ø¯Ø«Ø§Øª ÙÙŠ Ø£ÙŠ ÙˆÙ‚ØªØŒ ØªÙ†Ø²ÙŠÙ„ Ø¨ÙŠØ§Ù†Ø§ØªÙƒØŒ Ø£Ùˆ Ø­Ø°Ù Ø­Ø³Ø§Ø¨Ùƒ ÙˆÙƒÙ„ Ø§Ù„Ø±Ø³Ø§Ø¦Ù„ ÙÙŠ Ø®Ø·ÙˆØ§Øª Ø¨Ø³ÙŠØ·Ø©. ÙƒÙ…Ø§ Ù†Ø·Ø¨Ù‘Ù‚ Ø­Ø¯ÙˆØ¯Ø§Ù‹ Ø¹Ù„Ù‰ Ø¹Ø¯Ø¯ Ø§Ù„Ø·Ù„Ø¨Ø§Øª Ù…Ù† Ø§Ù„Ø­Ø³Ø§Ø¨Ø§Øª ÙˆØ§Ù„Ø£Ø¬Ù‡Ø²Ø© Ù„Ù„Ø­Ø¯ Ù…Ù† Ø§Ù„Ø¥Ø³Ø§Ø¡Ø© ÙˆØ­Ù…Ø§ÙŠØ© Ø§Ù„Ù…Ù†ØµÙ‘Ø© Ù„Ù„Ø¬Ù…ÙŠØ¹."
                : "Youâ€™re always in control: you can turn chat history off at any time, download your data, or delete your account and all messages in a few clicks. We also strictly limit how often accounts and devices can hit our servers to reduce abuse and protect the platform for everyone."}
            </p>
            <p>
              {isAr
                ? "Ù„Ø§ Ù†Ø¨ÙŠØ¹ Ø¨ÙŠØ§Ù†Ø§ØªÙƒØŒ ÙˆÙ„Ø§ Ù†Ø¯Ø±Ù‘Ø¨ Ù†Ù…Ø§Ø°Ø¬Ù†Ø§ Ø¹Ù„Ù‰ Ù…Ø­Ø§Ø¯Ø«Ø§ØªÙƒ Ø§Ù„Ø®Ø§ØµØ©."
                : "We donâ€™t sell your data, and we donâ€™t train our models on your private conversations."}
            </p>
          </div>

          <div className="asrar-features-grid">
            <div className="feature">
              <div className="feature-icon">ðŸ”</div>
              <h3>{isAr ? "Ù…Ø­Ø§Ø¯Ø«Ø§Øª Ù…Ø´ÙÙ‘Ø±Ø©" : "Encrypted Conversations"}</h3>
              <p>
                {isAr
                  ? "Ø±Ø³Ø§Ø¦Ù„Ùƒ ØªÙØ´ÙÙ‘ÙŽØ± Ø¹Ù„Ù‰ Ù…Ø³ØªÙˆÙ‰ Ø§Ù„ØªØ·Ø¨ÙŠÙ‚ Ù‚Ø¨Ù„ Ø£Ù† ØªÙØ®Ø²Ù‘ÙŽÙ† ÙÙŠ Ù‚Ø§Ø¹Ø¯Ø© Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª. Ù„Ø§ ØªÙˆØ¬Ø¯ Ø³Ø¬Ù„Ø§Øª Ù…Ø­Ø§Ø¯Ø«Ø© ÙƒÙ†Øµ ÙˆØ§Ø¶Ø­."
                  : "Your messages are encrypted at the application level before theyâ€™re stored in our database. There are no plain-text chat logs."}
              </p>
            </div>
            <div className="feature">
              <div className="feature-icon">ðŸ—‚ï¸</div>
              <h3>{isAr ? "ØªØ­ÙƒÙ‘Ù… ÙƒØ§Ù…Ù„ ÙÙŠ Ø§Ù„Ø³Ø¬Ù„" : "You Control History"}</h3>
              <p>
                {isAr
                  ? "ÙŠÙ…ÙƒÙ†Ùƒ ØªØ´ØºÙŠÙ„ Ø£Ùˆ Ø¥ÙŠÙ‚Ø§Ù Ø­ÙØ¸ Ø³Ø¬Ù„ Ø§Ù„Ù…Ø­Ø§Ø¯Ø«Ø§ØªØŒ ØªÙ†Ø²ÙŠÙ„ Ø¨ÙŠØ§Ù†Ø§ØªÙƒØŒ Ø£Ùˆ Ø­Ø°Ù Ø­Ø³Ø§Ø¨Ùƒ ÙˆØ¬Ù…ÙŠØ¹ Ø§Ù„Ø±Ø³Ø§Ø¦Ù„ ÙÙŠ Ø£ÙŠ ÙˆÙ‚Øª."
                  : "You can turn chat history on or off, download your data, or delete your account and all messages at any time."}
              </p>
            </div>
            <div className="feature">
              <div className="feature-icon">ðŸš«</div>
              <h3>{isAr ? "Ø¨Ø¯ÙˆÙ† Ø¨ÙŠØ¹ Ø¨ÙŠØ§Ù†Ø§Øª" : "No Data Selling or Training"}</h3>
              <p>
                {isAr
                  ? "Ù…Ø´Ø§Ø¹Ø±Ùƒ Ù„ÙŠØ³Øª Ù…Ù†ØªØ¬Ø§Ù‹ Ø¥Ø¹Ù„Ø§Ù†ÙŠØ§Ù‹. Ù„Ø§ Ù†Ø¨ÙŠØ¹ Ø¨ÙŠØ§Ù†Ø§ØªÙƒØŒ ÙˆÙ„Ø§ Ù†Ø¯Ø±Ù‘Ø¨ Ù†Ù…Ø§Ø°Ø¬Ù†Ø§ Ø¹Ù„Ù‰ Ù…Ø­Ø§Ø¯Ø«Ø§ØªÙƒ Ø§Ù„Ø®Ø§ØµØ©."
                  : "Your feelings are not an ad product. We donâ€™t sell your data, and we donâ€™t train our models on your private conversations."}
              </p>
            </div>
            <div className="feature">
              <div className="feature-icon">Ø§</div>
              <h3>{isAr ? "ØªØ¬Ø±Ø¨Ø© Ø¨Ø£ÙˆÙ„ÙˆÙŠØ© ????ŠØ©" : "Arabic-First Experience"}</h3>
              <p>
                {isAr
                  ? "Ù…Ù† Ø§Ù„Ø¨Ø¯Ø§ÙŠØ© Ù…ØµÙ…Ù‘ÙŽÙ… Ù„Ø·Ø±ÙŠÙ‚Ø© Ø§Ù„ØªØ¹Ø¨ÙŠØ± Ø§Ù„????ŠØ© ÙˆØ§Ù„Ø«Ù‚Ø§ÙØ© Ø§Ù„Ù…Ø­Ù„ÙŠØ©ØŒ ÙˆÙ„ÙŠØ³ Ù…Ø¬Ø±Ø¯ ØªØ±Ø¬Ù…Ø© Ù„Ù…Ù†ØªØ¬ ØºØ±Ø¨ÙŠ."
                  : "Built around Arabic expression and culture from day one, not just translated from a Western template."}
              </p>
            </div>
          </div>
        </section>

       

        {/* PRICING */}
        <section id="pricing" className="asrar-section asrar-section--pricing">
          <h2 className="asrar-section-title">
            {isAr ? "Ø§Ù„Ø£Ø³Ø¹Ø§Ø±" : "Pricing"}
          </h2>

          <div className="asrar-pricing-grid">
            <div className="pricing-card">
              <h3>{isAr ? "Ù…Ø¬Ø§Ù†ÙŠ" : "Free"}</h3>
              <p className="price">{isAr ? "Ù $ / Ø´Ù‡Ø±ÙŠØ§Ù‹" : "$0 / month"}</p>
              <ul>
                <li>{isAr ? "Ø´Ø®ØµÙŠØ© Ø£Ø³Ø§Ø³ÙŠØ© ÙˆØ§Ø­Ø¯Ø©" : "1 core character"}</li>
                <li>{isAr ? "Ù¥ Ø±Ø³Ø§Ø¦Ù„ ÙŠÙˆÙ…ÙŠØ§Ù‹" : "5 messages per day"}</li>
                <li>{isAr ? "Ø¯Ø¹Ù… Ø£Ø³Ø§Ø³ÙŠ" : "Basic support"}</li>
              </ul>
              <button className="asrar-btn ghost" onClick={() => navigate('/dashboard')}>
                {isAr ? "Ø§Ø¨Ø¯Ø£ Ù…Ø¬Ø§Ù†Ø§Ù‹" : "Start for free"}
              </button>
            </div>

            <div className="pricing-card pricing-card--accent">
              
              <h3>{isAr ? "Ø¨Ø±Ùˆ" : "Pro"}</h3>
              <p className="price">{isAr ? "$4.99 / Ø´Ù‡Ø±ÙŠØ§Ù‹" : "$4.99 / month"}</p>
              <ul>
                <li>{isAr ? "ÙƒÙ„ Ø±ÙØ§Ù‚ Ø£Ø³Ø±Ø§Ø± Ø§Ù„Ø®Ù…Ø³Ø©" : "All 5 Asrar characters"}</li>
                <li>{isAr ? "Ù£Ù Ù Ù  Ø±Ø³Ø§Ù„Ø© Ø´Ù‡Ø±ÙŠØ§Ù‹" : "3,000 messages per month"}</li>
                <li>{isAr ? "Ø°Ø§ÙƒØ±Ø© Ù…Ø­Ø§Ø¯Ø«Ø© ÙˆØ¯Ø¹Ù… Ø°Ùˆ Ø£ÙˆÙ„ÙˆÙŠØ©" : "Chat memory & priority support"}</li>
                <li>{isAr ? "Ø¨Ø¯ÙˆÙ† Ø¥Ø¹Ù„Ø§Ù†Ø§Øª ÙˆÙˆØµÙˆÙ„ Ù…Ø¨ÙƒØ±" : "Adâ€‘free, priority access"}</li>
                <li>{isAr ? "Ø¥Ù„ØºØ§Ø¡ Ø§Ù„Ø§Ø´ØªØ±Ø§Ùƒ ÙÙŠ Ø£ÙŠ ÙˆÙ‚Øª" : "Cancel anytime"}</li>
              </ul>
              <button className="asrar-btn primary" onClick={() => {
                if (user) {
                  window.location.href = "/dashboard";
                } else {
                  window.location.href = "/create-account";
                }
              }}>
                {isAr ? "Ø¬Ø±Ù‘Ø¨ Ø¨Ø±Ùˆ" : "Try Pro"}
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
        â†‘
      </button>
    </div>
  );
}




