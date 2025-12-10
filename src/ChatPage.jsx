// src/ChatPage.jsx
import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./ChatPage.css";
import AsrarHeader from "./AsrarHeader";
import HomeSplash from "./components/HomeSplash";

import VoiceMessageBubble from "./VoiceMessageBubble"; // tap-to-play audio bubble for voice replies
import WhispersBadge from "./WhispersBadge";
import WhisperUnlockCard from "./WhisperUnlockCard";
import WhispersPanel from "./WhispersPanel";
import EmotionalTimelineMap from "./EmotionalTimelineMap";
import { API_BASE } from "./apiBase";

import abuZainAvatar from "./assets/abu_zain.png";
import hanaAvatar from "./assets/hana.png";
import rashidAvatar from "./assets/rashid.png";
import nourAvatar from "./assets/nour.png";
import farahAvatar from "./assets/farah.png";
import { useAuth, TOKEN_KEY } from "./hooks/useAuth";

// same 5 characters (aligned with backend IDs)
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

// dialects (same as dashboard)
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
  { id: "ma", labelEn: "Moroccan Arabic", labelAr: "الدارجة المغربية" },
  { id: "tn", labelEn: "Tunisian Arabic", labelAr: "اللهجة التونسية" },
  { id: "en", labelEn: "English", labelAr: "اللغة الإنجليزية" },
];

// language helpers
const getInitialLang = () => {
  if (typeof window !== "undefined") {
    return localStorage.getItem("asrar-lang") || "ar";
  }
  return "ar";
};

const getInitialDial = () => {
  if (typeof window !== "undefined") {
    return localStorage.getItem("asrar-dialect") || "msa";
  }
  return "msa";
};

const LEGACY_CHARACTER_ID_MAP = {
  "abu-zain": "sheikh-al-hara",
  hana: "daloua",
  rashid: "abu-mukh",
  nour: "walaa",
  farah: "hiba",
};

const getInitialCharacterId = () => {
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem("asrar-selected-character");
    const migrated =
      (stored && LEGACY_CHARACTER_ID_MAP[stored]) || stored || "abu-mukh";
    if (stored && migrated !== stored) {
      try {
        localStorage.setItem("asrar-selected-character", migrated);
      } catch (_) {}
    }
    return migrated;
  }
  return "abu-mukh";
};

const CHARACTER_DEFAULT_TONES = {
  "sheikh-al-hara": "calm",
  daloua: "soft",
  "abu-mukh": "energetic",
  walaa: "strict",
  hiba: "energetic",
};

const TONES_UI = [
  {
    id: "calm",
    labelEn: "Calm & Supportive",
    labelAr: "هادئ وداعم",
  },
  {
    id: "energetic",
    labelEn: "Energetic & Motivating",
    labelAr: "متحمس ومحفز",
  },
  {
    id: "strict",
    labelEn: "Direct & Honest",
    labelAr: "مباشر وصريح",
  },
  {
    id: "soft",
    labelEn: "Soft & Empathetic",
    labelAr: "لطيف ومتفهّم",
  },
];

const CHAT_HISTORY_KEY = "asrar-chat-history";

const getInitialEngine = () => {
  if (typeof window !== "undefined") {
    return localStorage.getItem("asrar-engine-mode") || "balanced";
  }
  return "balanced";
};

const buildHistoryStorageKey = (userId, characterId, convId) => {
  const uid = userId == null ? "anon" : String(userId);
  const char = characterId || "unknown";
  const conv = convId == null ? "none" : String(convId);
  return `asrar-chat-history-${uid}-${char}-${conv}`;
};

const TEXT = {
  en: {
    typingPlaceholder: "Type how you feel right now…",
    systemIntro: "This is your private space. Nothing you say here is judged.",
    dialectLabel: "Communication dialect",
    toneLabel: "Emotional tone",
    changeCompanion: "Change companion",
    you: "You",
  },
  ar: {
    typingPlaceholder: "اكتب ما تشعر به الآن…",
    systemIntro: "هذه مساحتك الخاصة. لا حكم على ما تقوله هنا.",
    dialectLabel: "لهجة التواصل",
    toneLabel: "النبرة العاطفية",
    changeCompanion: "غيّر الرفيق",
    you: "أنت",
  },
};

function isArabic(text) {
  return /[\u0600-\u06FF]/.test(text || "");
}

function isArabicText(str) {
  return isArabic(str);
}

function getSupportedMimeType() {
  if (typeof window === 'undefined' || !window.MediaRecorder) return '';

  const candidates = [
    'audio/webm;codecs=opus',
    'audio/mp4;codecs=mp4a.40.2',
    'audio/ogg;codecs=opus',
    'audio/mpeg',
    // Plain mp4 container as a final Safari-friendly fallback
    'audio/mp4',
  ];

  try {
    for (const type of candidates) {
      if (typeof window.MediaRecorder.isTypeSupported === 'function' &&
          window.MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
  } catch (_) {}

  return '';
}

export default function ChatPage() {
  const navigate = useNavigate();
  const { user, logout, setUser } = useAuth();

  const [lang, setLang] = useState(getInitialLang);
  const isAr = lang === "ar";
  const t = TEXT[isAr ? "ar" : "en"];

  const [selectedDialect, setSelectedDialect] = useState(getInitialDial);
  const initialCharacterId = getInitialCharacterId();
  const [selectedCharacterId, setSelectedCharacterId] = useState(
    initialCharacterId
  );
  const [selectedTone, setSelectedTone] = useState(
    CHARACTER_DEFAULT_TONES[initialCharacterId] || "calm"
  );

  const [conversationId, setConversationId] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [convLoading, setConvLoading] = useState(false);
  const [convError, setConvError] = useState(null);

  const character =
    CHARACTERS.find((c) => c.id === selectedCharacterId) || CHARACTERS[1];

  const isArabicConversation = selectedDialect !== "en";
  const conversationLang = isArabicConversation ? "ar" : "en";
  const characterDisplayName = isAr ? character.nameAr : character.nameEn;

  const getName = (c) => (isAr ? c.nameAr : c.nameEn);
  const getRole = (c) => (isAr ? c.roleAr : c.roleEn);

  const [inputValue, setInputValue] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSendingVoice, setIsSendingVoice] = useState(false);
  const recorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const audioChunksRef = useRef([]);
  const voiceStopIntentRef = useRef('send');
  const [crossSuggestion, setCrossSuggestion] = useState(null);
  const [usageInfo, setUsageInfo] = useState(() => user?.usage || null);
  const [showLockedModal, setShowLockedModal] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [modalText, setModalText] = useState("");
  const [isBlocked, setIsBlocked] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [selectedEngine, setSelectedEngine] = useState(getInitialEngine);
  const [isEngineMenuOpen, setIsEngineMenuOpen] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(true);

  // Whispers / timeline UI state
  const [recentWhispers, setRecentWhispers] = useState([]);
  const [hasNewWhispers, setHasNewWhispers] = useState(false);
  const [isWhispersOpen, setIsWhispersOpen] = useState(false);
  const [isTimelineOpen, setIsTimelineOpen] = useState(false);

  // Free plan limit banner state
  const [limitExceeded, setLimitExceeded] = useState(false);
  const [limitUsage, setLimitUsage] = useState(null);
  const [limitResetSeconds, setLimitResetSeconds] = useState(null);

  const [hasHydratedHistory, setHasHydratedHistory] = useState(false);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);

  const [isAiTyping, setIsAiTyping] = useState(false);
  const [aiTypingBuffer, setAiTypingBuffer] = useState("");
  const [aiTypingMessageId, setAiTypingMessageId] = useState(null);

  const messagesContainerRef = useRef(null);
  const inputRef = useRef(null);
  const engineMenuRef = useRef(null);
  const aiTypingIntervalRef = useRef(null);

  // helper: pick any available mic deviceId
  const getAnyMicDeviceId = async () => {
    try {
      if (!navigator?.mediaDevices?.enumerateDevices) return null;
      const list = await navigator.mediaDevices.enumerateDevices();
      const mics = (list || []).filter((d) => d && d.kind === 'audioinput');
      return mics.length ? mics[0].deviceId : null;
    } catch (_) {
      return null;
    }
  };

  // Clear newly-unlocked whisper cards when switching persona
  useEffect(() => {
    setRecentWhispers([]);
    setHasNewWhispers(false);
  }, [selectedCharacterId]);

  const [messages, setMessages] = useState(() => {
    const now = new Date().toISOString();
    return [
      {
        id: 1,
        from: "system",
        text: isArabicConversation
         ? "هذه مساحتك الخاصة. لا أحد يحكم على ما تقوله هنا."
          : "This is your private space. Nothing you say here is judged.",
        createdAt: now,
      },
      {
        id: 2,
        from: "ai",
        text: isArabicConversation
          ? `أهلاً، أنا ${characterDisplayName}. أنا هنا بالكامل لك. خذ راحتك في الكتابة، ولا يوجد شيء تافه أو كثير.`
          : `Hi, I'm ${characterDisplayName}. I'm here just for you. Take your time and type whatever is on your mind.`,
        createdAt: now,
      },
    ];
  });

  useEffect(() => {
    setUsageInfo(user?.usage || null);
  }, [user]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem("asrar-engine-mode", selectedEngine);
    } catch (_) {}
  }, [selectedEngine]);

  // If the user has already hit their daily limit (e.g. 5/5) when the
  // page loads or after a refresh, show the same limit banner and timer
  // based on usage info from /auth/me. Only drive the timer from usageInfo
  // when a valid dailyResetInSeconds value is present, so we don't
  // overwrite the timer coming from the /api/chat/message success payload.
  useEffect(() => {
    if (!usageInfo) return;

    const dailyLimit = usageInfo.dailyLimit;
    const dailyUsed = usageInfo.dailyUsed;

    if (
      dailyLimit &&
      dailyLimit > 0 &&
      dailyUsed >= dailyLimit &&
      typeof usageInfo.dailyResetInSeconds === "number" &&
      usageInfo.dailyResetInSeconds >= 0
    ) {
      setLimitExceeded(true);
      setLimitUsage(usageInfo);
      setLimitResetSeconds(usageInfo.dailyResetInSeconds);
    }
  }, [usageInfo]);

  const [reloadConversationsToken, setReloadConversationsToken] = useState(0);

  const mergeServerMessagesWithLocalVoiceHistory = (serverMsgs, convId) => {
    let finalMsgs = serverMsgs;
    try {
      if (typeof window !== "undefined" && user && user.id) {
        const storageKey = buildHistoryStorageKey(
          user.id,
          selectedCharacterId,
          convId
        );
        const raw = localStorage.getItem(storageKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length) {
            const localMsgs = parsed;
            const merged = [];
            let localIndex = 0;

            for (const m of serverMsgs) {
              const from = m.from || "system";
              const text = (m.text || "").trim();
              let overlay = null;
              for (; localIndex < localMsgs.length; localIndex++) {
                const lm = localMsgs[localIndex];
                if (!lm) continue;
                const lFrom = lm.from || "system";
                const lText = (lm.text || "").trim();
                if (lFrom === from && lText === text) {
                  overlay = lm;
                  localIndex++;
                  break;
                }
              }
              if (overlay && overlay.audioBase64) {
                merged.push({
                  ...m,
                  audioBase64: overlay.audioBase64,
                  audioMimeType: overlay.audioMimeType || null,
                });
              } else {
                merged.push(m);
              }
            }

            for (; localIndex < localMsgs.length; localIndex++) {
              const lm = localMsgs[localIndex];
              if (!lm) continue;
              merged.push(lm);
            }

            finalMsgs = merged;
          }
        }
      }
    } catch (mergeErr) {
      console.error(
        "[ChatPage] Failed to merge server messages with local voice history",
        mergeErr
      );
    }
    return finalMsgs;
  };

  function detectMessageLanguage(text) {
    if (!text) return "en";
    const arabicRegex = /[\u0600-\u06FF]/; // Arabic characters
    const arabiziRegex = /\b(3|7|5|6|2|9)\b|kh|sh|gh|aa|oo|ee/i;

    const hasArabic = arabicRegex.test(text);
    const hasArabizi = arabiziRegex.test(text);

    if (hasArabic || hasArabizi) return "ar";
    return "en";
  }

  useEffect(() => {
    const loadConversations = async () => {
      try {
        if (!user) return;
        setConvLoading(true);
        setConvError(null);
        const token = typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
        const headers = token
          ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
          : { "Content-Type": "application/json" };

        const listRes = await fetch(
          `${API_BASE}/api/chat/conversations?characterId=${selectedCharacterId}`,
          { method: 'GET', credentials: 'include', headers }
        );
        let list = [];
        try { list = await listRes.json(); } catch (_) { list = []; }
        if (Array.isArray(list)) setConversations(list);

        let cid = (Array.isArray(list) && list.length) ? list[0].id : null;
        if (!cid && !reloadConversationsToken) {
          const createRes = await fetch(`${API_BASE}/api/chat/conversations`, {
            method: 'POST', credentials: 'include', headers,
            body: JSON.stringify({ characterId: selectedCharacterId })
          });
          const created = await createRes.json().catch(() => null);
          if (createRes.ok && created && created.id) {
            cid = created.id;
            setConversations((prev) => [created, ...(Array.isArray(prev) ? prev : [])]);
          }
        }
        setConversationId(cid || null);

        if (cid) {
          const msgRes = await fetch(`${API_BASE}/api/chat/conversations/${cid}/messages`, {
            method: 'GET', credentials: 'include', headers
          });
          if (msgRes.ok) {
            const serverMsgs = await msgRes.json().catch(() => []);
            if (Array.isArray(serverMsgs) && serverMsgs.length) {
              let finalMsgs = serverMsgs;
              try {
                if (typeof window !== "undefined" && user && user.id) {
                  const storageKey = buildHistoryStorageKey(
                    user.id,
                    selectedCharacterId,
                    cid
                  );
                  const raw = localStorage.getItem(storageKey);
                  if (raw) {
                    const parsed = JSON.parse(raw);
                    if (Array.isArray(parsed) && parsed.length) {
                      const localMsgs = parsed;
                      const merged = [];
                      let localIndex = 0;

                      // First, walk server messages and overlay any matching
                      // local entries that contain voice/audio for the same
                      // (from,text) pair.
                      for (const m of serverMsgs) {
                        const from = m.from || "system";
                        const text = (m.text || "").trim();
                        let overlay = null;
                        for (; localIndex < localMsgs.length; localIndex++) {
                          const lm = localMsgs[localIndex];
                          if (!lm) continue;
                          const lFrom = lm.from || "system";
                          const lText = (lm.text || "").trim();
                          if (lFrom === from && lText === text) {
                            overlay = lm;
                            localIndex++;
                            break;
                          }
                        }
                        if (overlay && overlay.audioBase64) {
                          merged.push({
                            ...m,
                            audioBase64: overlay.audioBase64,
                            audioMimeType: overlay.audioMimeType,
                          });
                        } else {
                          merged.push(m);
                        }
                      }

                      // Any remaining local messages (for example, pure
                      // voice messages that never hit the backend text
                      // route) should also be kept so they don't disappear
                      // on refresh.
                      for (; localIndex < localMsgs.length; localIndex++) {
                        const lm = localMsgs[localIndex];
                        if (!lm) continue;
                        merged.push(lm);
                      }

                      finalMsgs = merged;
                    }
                  }
                }
              } catch (mergeErr) {
                console.error("[ChatPage] Failed to merge server messages with local voice history", mergeErr);
              }
              setMessages(finalMsgs);
            }
          }
        }
      } catch (e) {
        console.error('[ChatPage] load conversations failed', e);
        setConvError('Failed to load conversations');
      } finally {
        setConvLoading(false);
      }
    };
    loadConversations();
  }, [user && user.id, selectedCharacterId, reloadConversationsToken]);

  // Debug: track which companion is selected in chat
  useEffect(() => {
    console.log("[ChatPage] selectedCharacterId", selectedCharacterId);
  }, [selectedCharacterId]);

  // Load any existing history for this user + character + conversation on mount.
  useEffect(() => {
    if (!user) return;
    if (typeof window === "undefined") return;
    if (!conversationId) return;

    const userId = user.id;
    if (!userId) return;

    const storageKey = buildHistoryStorageKey(
      userId,
      selectedCharacterId,
      conversationId
    );

    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) {
          console.log("[ChatPage] loaded history", {
            storageKey,
            count: parsed.length,
          });
          setMessages(
            parsed.map((m, idx) => ({
              id: m.id ?? idx + 1,
              from: m.from || "system",
              text: m.text || "",
              createdAt: m.createdAt || new Date().toISOString(),
              audioBase64: m.audioBase64 || null,
              audioMimeType: m.audioMimeType || null,
            }))
          );
        } else {
          console.log("[ChatPage] no messages in stored history", { storageKey });
        }
      } else {
        console.log("[ChatPage] no stored history", { storageKey });
      }
    } catch (e) {
      console.error("[ChatPage] Failed to load chat history", e);
    } finally {
      // Mark that we attempted to hydrate from storage (even if nothing was there)
      setHasHydratedHistory(true);
    }
  }, [user && user.id, selectedCharacterId, conversationId]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handleConversationsCleared = () => {
      setConversations([]);
      setConversationId(null);
      setMessages([]);
      setHasHydratedHistory(false);
      setIsMobileSidebarOpen(false);
      setReloadConversationsToken((prev) => prev + 1);
    };
    window.addEventListener(
      "asrar-conversations-deleted",
      handleConversationsCleared
    );
    return () => {
      window.removeEventListener(
        "asrar-conversations-deleted",
        handleConversationsCleared
      );
    };
  }, [user]);

 

  

  // Auto-scroll to bottom on initial thread load / character switch
  useEffect(() => {
    const el = messagesContainerRef.current;
    if (!el) return;

    el.scrollTo({ top: el.scrollHeight, behavior: "auto" });
  }, [selectedCharacterId]);

  // Auto-scroll new messages only when user is already near the bottom
  useEffect(() => {
    const el = messagesContainerRef.current;
    if (!el) return;

    el.scrollTo({ top: el.scrollHeight, behavior: "auto" });
  }, [messages.length]);

  const handleScrollToBottomClick = () => {
    const el = messagesContainerRef.current;
    if (!el) return;
    
    // For mobile, we need to use window.scrollTo since the page scrolls
    if (window.innerWidth <= 900) {
      window.scrollTo({
        top: document.documentElement.scrollHeight,
        behavior: 'smooth'
      });
    } else {
      // For desktop, scroll the messages container
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }
    
    setShowScrollToBottom(false);
  };

  const handleMessagesScroll = () => {
    const el = messagesContainerRef.current;
    if (!el) return;

    let distanceFromBottom, threshold = 40;
    
    if (window.innerWidth <= 900) {
      // For mobile, check window scroll position
      const { scrollY, innerHeight } = window;
      const { scrollHeight } = document.documentElement;
      distanceFromBottom = scrollHeight - (scrollY + innerHeight);
    } else {
      // For desktop, check container scroll position
      const { scrollHeight, scrollTop, clientHeight } = el;
      distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    }
    
    // Only show the button if we're scrolled up past the threshold
    setShowScrollToBottom(distanceFromBottom > threshold);
  };
  
  // Add scroll event listener for mobile
  useEffect(() => {
    if (window.innerWidth <= 900) {
      window.addEventListener('scroll', handleMessagesScroll);
      return () => window.removeEventListener('scroll', handleMessagesScroll);
    }
  }, []);

  // Auto-expand textarea up to ~3 lines, then scroll internally
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const lh = parseFloat(window.getComputedStyle(el).lineHeight || '22');
    const maxLines = 8;
    const maxPx = Math.round(lh * maxLines);
    const next = Math.min(el.scrollHeight, maxPx);
    el.style.height = next + 'px';
    el.style.overflowY = el.scrollHeight > maxPx ? 'auto' : 'hidden';
  }, [inputValue]);

  useEffect(() => {
    if (!isEngineMenuOpen) return;

    const handleClickOutside = (event) => {
      if (!engineMenuRef.current) return;
      if (!engineMenuRef.current.contains(event.target)) {
        setIsEngineMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isEngineMenuOpen]);

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

  const handleDialectChange = (value) => {
    setSelectedDialect(value);
    if (typeof window !== "undefined") {
      localStorage.setItem("asrar-dialect", value);
    }
  };

  const handleToneChange = (value) => {
    setSelectedTone(value);
    if (typeof window !== "undefined") {
      localStorage.setItem("asrar-tone", value);
    }
  };

  const handleStartNewChat = async () => {
    try {
      setIsMobileSidebarOpen(false);

      // Create a fresh conversation so the next message is always saved
      const token =
        typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
      const headers = token
        ? {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          }
        : { "Content-Type": "application/json" };

      let newConv = null;
      try {
        const createRes = await fetch(`${API_BASE}/api/chat/conversations`, {
          method: "POST",
          credentials: "include",
          headers,
          body: JSON.stringify({ characterId: selectedCharacterId }),
        });
        newConv = await createRes.json().catch(() => null);
        if (!createRes.ok || !newConv || !newConv.id) {
          newConv = null;
        }
      } catch (_) {
        newConv = null;
      }

      if (newConv && newConv.id) {
        setConversationId(newConv.id);
        setConversations((prev) => {
          const list = Array.isArray(prev) ? prev : [];
          const without = list.filter((c) => c.id !== newConv.id);
          return [newConv, ...without];
        });
      } else {
        // Fallback: clear pointer; backend will still attach, but may reuse
        setConversationId(null);
      }

      const now = new Date().toISOString();
      setMessages([
        {
          id: 1,
          from: "system",
          text: isArabicConversation
            ? "هذه مساحتك الخاصة. لا أحد يحكم على ما تقوله هنا."
            : "This is your private space. Nothing you say here is judged.",
          createdAt: now,
        },
        {
          id: 2,
          from: "ai",
          text: isArabicConversation
            ? `أهلاً، أنا ${characterDisplayName}. أنا هنا بالكامل لك. خذ راحتك في الكتابة، ولا يوجد شيء تافه أو كثير.`
            : `Hi, I'm ${characterDisplayName}. I'm here just for you. Take your time and type whatever is on your mind.`,
          createdAt: now,
        },
      ]);
      const el = messagesContainerRef.current;
      if (el) el.scrollTop = 0;
    } catch (e) {
      console.error("[ChatPage] start new chat failed", e);
    }
  };

  const handleSelectConversation = async (id) => {
    try {
      setConversationId(id);
      const token = typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
      const headers = token
        ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
        : { "Content-Type": "application/json" };
      const msgRes = await fetch(`${API_BASE}/api/chat/conversations/${id}/messages`, {
        method: 'GET', credentials: 'include', headers
      });
      if (msgRes.ok) {
        const serverMsgs = await msgRes.json().catch(() => []);
        if (Array.isArray(serverMsgs) && serverMsgs.length) {
          const finalMsgs = mergeServerMessagesWithLocalVoiceHistory(
            serverMsgs,
            id
          );
          setMessages(finalMsgs);
        } else {
          setMessages([]);
        }
      }
    } catch (e) {
      console.error('[ChatPage] select conversation failed', e);
      setConvError('Failed to load conversation');
    }
  };

  const handleConversationClick = (id) => {
    handleSelectConversation(id);
    setIsMobileSidebarOpen(false);
  };

  const handleDeleteConversation = async (id, event) => {
    if (event && typeof event.stopPropagation === 'function') {
      event.stopPropagation();
    }

    try {
      const token = typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
      const headers = token
        ? { Authorization: `Bearer ${token}` }
        : undefined;

      const res = await fetch(`${API_BASE}/api/chat/conversations/${id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers,
      });

      if (!res.ok) {
        console.error('[ChatPage] delete conversation failed', { status: res.status });
        return;
      }

      setConversations((prev) => (Array.isArray(prev) ? prev.filter((c) => c.id !== id) : []));

      if (conversationId === id) {
        setConversationId(null);
        const now = new Date().toISOString();
        setMessages([
          {
            id: 1,
            from: 'system',
            text: isArabicConversation
              ? "هذه مساحتك الخاصة. لا أحد يحكم على ما تقوله هنا."
              : "This is your private space. Nothing you say here is judged.",
            createdAt: now,
          },
          {
            id: 2,
            from: 'ai',
            text: isArabicConversation
              ? `أهلاً، أنا ${characterDisplayName}. أنا هنا بالكامل لك. خذ راحتك في الكتابة، ولا يوجد شيء تافه أو كثير.`
              : `Hi, I'm ${characterDisplayName}. I'm here just for you. Take your time and type whatever is on your mind.`,
            createdAt: now,
          },
        ]);

        if (user && typeof window !== 'undefined') {
          try {
            const storageKey = buildHistoryStorageKey(
              user.id,
              selectedCharacterId,
              id
            );
            localStorage.removeItem(storageKey);
          } catch (e) {
            console.error('[ChatPage] failed to clear deleted conversation history', e);
          }
        }
      }
    } catch (e) {
      console.error('[ChatPage] delete conversation error', e);
    }
  };

const renderSidebarContent = () => (
  <>
    <button
      className="asrar-new-chat-btn"
      onClick={handleStartNewChat}
      type="button"
    >
      {isAr ? "+ ابدأ محادثة جديدة" : "+ Start new chat"}
    </button>

    <div className="asrar-chat-tools-sidebar">
      <WhispersBadge
        isAr={isAr}
        hasNew={hasNewWhispers}
        onClick={() => {
          setIsWhispersOpen(true);
          setHasNewWhispers(false);
        }}
      />
      <button
        type="button"
        className="asrar-timeline-badge"
        onClick={() => setIsTimelineOpen(true)}
      >
        <span className="asrar-timeline-badge-icon" aria-hidden="true">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M4 16L9 11L13 13.5L20 8"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="4" cy="16" r="1.4" fill="currentColor" />
            <circle cx="9" cy="11" r="1.4" fill="currentColor" />
            <circle cx="13" cy="13.5" r="1.4" fill="currentColor" />
            <circle cx="20" cy="8" r="1.4" fill="currentColor" />
          </svg>
        </span>
        <span className="asrar-conv-title">
          {isAr ? "رحلة مشاعرك" : "Mood Journey"}
        </span>
      </button>
    </div>

    <div className="asrar-conversation-list">
      {convLoading && <div className="asrar-conv-item">Loading...</div>}
      {convError && !convLoading && (
        <div className="asrar-conv-item">{convError}</div>
      )}
      {!convLoading &&
        !convError &&
        Array.isArray(conversations) &&
        conversations.map((conv) => (
          <div
            key={conv.id}
            className={
              "asrar-conv-item" +
              (conv.id === conversationId ? " asrar-conv-item--active" : "")
            }
            onClick={() => handleConversationClick(conv.id)}
          >
            <div className="asrar-conv-title-row">
              <span className="asrar-conv-title">{getName(character)}</span>
              <button
                type="button"
                className="asrar-conv-delete-btn"
                onClick={(e) => handleDeleteConversation(conv.id, e)}
              >
                ×
              </button>
            </div>
            <div className="asrar-conv-preview">
              {conv.firstUserMessage && conv.firstUserMessage.trim()
                ? conv.firstUserMessage.slice(0, 60)
                : "No messages yet"}
            </div>
          </div>
        ))}
    </div>
  </>
);

const mobileSidebarTitle = isAr ? "المحادثات" : "Conversations";

// Persist history whenever messages change
useEffect(() => {
  if (!user) return;
  if (!hasHydratedHistory) return; // avoid overwriting stored history before hydration
  if (typeof window === "undefined") return;
  if (!conversationId) return;

  const userId = user.id;
  if (!userId) return;

  const storageKey = buildHistoryStorageKey(
    userId,
    selectedCharacterId,
    conversationId
  );

  try {
    localStorage.setItem(storageKey, JSON.stringify(messages));
    console.log("[ChatPage] saved history", {
      storageKey,
      count: messages.length,
    });
  } catch (e) {
    console.error("[ChatPage] Failed to persist chat history", e);
  }
}, [messages, selectedCharacterId, user, hasHydratedHistory, conversationId]);

  const suggestBetterCompanion = (lastUserText, currentCharacterId) => {
    if (!lastUserText) {
      setCrossSuggestion(null);
      return;
    }
    const lower = lastUserText.toLowerCase();
    const hasAny = (arr) => arr.some((w) => lower.includes(w));

    let suggestedId = null;

    if (
      hasAny([
        "study",
        "exam",
        "exams",
        "test",
        "homework",
        "assignment",
        "university",
        "college",
        "school",
        "focus",
        "concentrate",
        "productivity",
        "routine",
        "schedule",
        "plan my day",
        "مذاكرة",
        "دراسة",
        "امتحان",
        "امتحانات",
        "جامعة",
        "مدرسة",
        "شغل",
        "وظيفة",
        "روتين",
        "تركيز",
        "خطة",
        "جدول",
      ])
    ) {
      suggestedId = "abu-mukh";
    } else if (
      hasAny([
        "laugh",
        "funny",
        "joke",
        "jokes",
        "make me laugh",
        "memes",
        "meme",
        "ضحك",
        "نكت",
        "مزح",
        "فرفشة",
        "اضحكني",
        "ضحكني",
      ])
    ) {
      suggestedId = "hiba";
    } else if (
      hasAny([
        "family",
        "parents",
        "father",
        "mother",
        "dad",
        "mom",
        "marriage",
        "guidance",
        "guide me",
        "life direction",
        "purpose",
        "عائلة",
        "أهل",
        "أب",
        "أم",
        "والدي",
        "والدتي",
        "زواج",
        "خطوبة",
        "نصيحة",
        "توجيه",
        "مسار الحياة",
        "هدف",
      ])
    ) {
      suggestedId = "sheikh-al-hara";
    }

    if (suggestedId && suggestedId !== currentCharacterId) {
      const target = CHARACTERS.find((c) => c.id === suggestedId);
      setCrossSuggestion(target || null);
      return target || null;
    }

    setCrossSuggestion(null);
    return null;
  };

  const sendMessage = async (overrideText) => {
    const source = typeof overrideText === "string" ? overrideText : inputValue;
    const trimmed = source.trim();
    if (!trimmed || isSending) return;

    // Reset any in-progress AI typing animation when a new text send starts
    if (aiTypingIntervalRef.current) {
      clearInterval(aiTypingIntervalRef.current);
      aiTypingIntervalRef.current = null;
    }
    setIsAiTyping(false);
    setAiTypingBuffer("");
    setAiTypingMessageId(null);

    setIsEngineMenuOpen(false);

    const userMessage = {
      id: messages.length ? messages[messages.length - 1].id + 1 : 1,
      from: "user",
      text: trimmed,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    if (typeof overrideText !== "string") {
      setInputValue("");
    }

    const suggested = suggestBetterCompanion(trimmed, selectedCharacterId);

    setIsSending(true);

    try {
      const payloadMessages = [...messages, userMessage].map((m) => ({ from: m.from, text: m.text }));

      const detectedLang = detectMessageLanguage(trimmed);

      let payloadLang = "en";
      let payloadDialect = "en";
      if (detectedLang === "ar") {
        payloadLang = "ar";
        payloadDialect = selectedDialect || "msa";
      }

      const token =
        typeof window !== "undefined"
          ? localStorage.getItem(TOKEN_KEY)
          : null;

      const headers = token
        ? {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          }
        : {
            "Content-Type": "application/json",
          };

      const res = await fetch(`${API_BASE}/api/chat/message`, {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify({
          messages: payloadMessages,
          characterId: selectedCharacterId,
          conversationId,
          content: trimmed,
          // Dynamic per-message language routing
          lang: payloadLang,
          dialect: payloadDialect,
          save: user?.saveHistoryEnabled !== false,
          tone: selectedTone,
          engine: selectedEngine,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error("Chat send error", {
          status: res.status,
          body: data,
        });
        // Free plan daily limit enforcement: show banner and disable input
        if (res.status === 429 && data && (data.code === 'LIMIT_REACHED' || data.error === 'limit_reached')) {
          setLimitExceeded(true);
          setLimitUsage(data.usage || null);
          if (typeof data.resetInSeconds === 'number' && data.resetInSeconds >= 0) {
            setLimitResetSeconds(data.resetInSeconds);
          } else {
            setLimitResetSeconds(null);
          }
          if (data.usage) {
            setUsageInfo(data.usage);
            if (setUser) {
              setUser((prev) => (prev ? { ...prev, usage: data.usage } : prev));
            }
          }
          return;
        }
        if (res.status === 403 && data && data.error === "premium_required") {
          setModalText(
            isArabicConversation
              ? "هذه الشخصية متاحة فقط في الخطة المدفوعة. بإمكانك الترقية لفتح جميع الرفقاء."
              : "This companion is available on the Premium plan. Upgrade to unlock all characters."
          );
          setShowLockedModal(true);
          return;
        }
        if (data && data.code === "PRO_CHARACTER_LOCKED") {
          setModalText(
            isArabicConversation
              ? "هذه الشخصية متاحة فقط في الخطة المدفوعة. بإمكانك الترقية لفتح جميع الرفقاء."
              : "This companion is available on the Premium plan. Upgrade to unlock all characters."
          );
          setShowLockedModal(true);
          return;
        }
        if (data && (data.error === "usage_limit_reached" || data.code === "LIMIT_EXCEEDED")) {
          const nextUsage = data.usage || usageInfo;
          if (nextUsage) {
            setUsageInfo(nextUsage);
            if (setUser) {
              setUser((prev) => (prev ? { ...prev, usage: nextUsage } : prev));
            }
          }
          const isPrem = !!(user?.isPremium || user?.plan === 'premium' || user?.plan === 'pro');
          if (isArabicConversation) {
            setModalText(
              data.limitType === "monthly"
                ? "وصلت إلى حد ٣٠٠٠ رسالة هذا الشهر. يرجى الانتظار حتى الشهر القادم أو التواصل مع الدعم."
                : "وصلت إلى حدك اليومي في الخطة المجانية. قم بالترقية إلى بريميوم للحصول على ٣٠٠٠ رسالة شهريًا."
            );
          } else {
            setModalText(
              data.limitType === "monthly"
                ? "You reached your 3,000 messages limit for this month. Please wait until next month or contact support."
                : "You reached your free daily limit. Upgrade to Premium to unlock 3,000 messages per month."
            );
          }
          setShowLimitModal(true);
          setIsBlocked(true);
          return;
        }
        const errorMessage = {
          id: userMessage.id + 1,
          from: "system",
          text: isArabicConversation
            ? "حدث خطأ أثناء توليد الرد. حاول مرة أخرى لاحقاً."
            : "Something went wrong while generating a reply. Please try again later.",
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, errorMessage]);
        return;
      }

      // 1) Build and append assistant message, then animate it with a fast typing effect.
      const aiText = data.reply || (isArabicConversation
        ? `واجهت مشكلة بسيطة في الاتصال. حاول مرة أخرى بعد قليل.`
        : "I had a small issue connecting. Please try again in a moment.");
      let finalText = aiText;
      if (suggested) {
        const suggestedName = isArabicConversation ? (suggested.nameAr || '') : (suggested.nameEn || '');
        const lower = String(finalText).toLowerCase();
        const alreadyMentions = (
          (suggestedName && lower.includes(suggestedName.toLowerCase())) ||
          lower.includes('switch to') ||
          finalText.includes('حزين جدا')
        );
        if (!alreadyMentions) {
          const rec = isArabicConversation
            ? "حدث خطأ أثناء توليد الرد. حاول مرة أخرى لاحقاً."
            : `If you'd like more practical guidance focused on this topic, you can try chatting with ${suggestedName}.`;
          finalText = `${finalText}\n\n${rec}`;
        }
      }

      const aiMessage = {
        id: userMessage.id + 1,
        from: "ai",
        text: finalText,
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, aiMessage]);

      const fullText = String(finalText || "");
      if (fullText) {
        setAiTypingBuffer("");
        setIsAiTyping(true);
        setAiTypingMessageId(aiMessage.id);

        let i = 0;
        const typingInterval = setInterval(() => {
          i++;
          setAiTypingBuffer(fullText.slice(0, i));
          if (i >= fullText.length) {
            clearInterval(typingInterval);
            aiTypingIntervalRef.current = null;
            setIsAiTyping(false);
            setAiTypingBuffer("");
            setAiTypingMessageId(null);
          }
        }, 12);

        aiTypingIntervalRef.current = typingInterval;
      }

      // 2) Non-critical UI updates (usage, whispers, limit banner) in a follow-up tick.
      setTimeout(() => {
        if (data.usage) {
          setUsageInfo(data.usage);
          if (setUser) {
            setUser((prev) => (prev ? { ...prev, usage: data.usage } : prev));
          }
        }

        if (Array.isArray(data.whispersUnlocked) && data.whispersUnlocked.length) {
          setRecentWhispers((prev) => [...data.whispersUnlocked, ...prev]);
          setHasNewWhispers(true);
        }

        if (data && data.dailyLimitReached) {
          setLimitExceeded(true);
          setLimitUsage(data.usage || null);
          if (typeof data.resetInSeconds === "number" && data.resetInSeconds >= 0) {
            setLimitResetSeconds(data.resetInSeconds);
          } else {
            setLimitResetSeconds(null);
          }
        }
      }, 0);

      // 3) Refresh conversation list in the background if this created the first conversation.
      if (!conversationId) {
        setTimeout(() => {
          (async () => {
            try {
              const token2 =
                typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
              const headers2 = token2
                ? { "Content-Type": "application/json", Authorization: `Bearer ${token2}` }
                : { "Content-Type": "application/json" };
              const listRes = await fetch(
                `${API_BASE}/api/chat/conversations?characterId=${selectedCharacterId}`,
                { method: "GET", credentials: "include", headers: headers2 }
              );
              const list = await listRes.json().catch(() => []);
              if (Array.isArray(list) && list.length) {
                setConversations(list);
                setConversationId(list[0].id || null);
              }
            } catch (_) {}
          })();
        }, 0);
      }
    } catch (err) {
      console.error("Failed to send chat message", err);
      const errorMessage = {
        id: userMessage.id + 1,
        from: "system",
        text: isArabicConversation
            ? "حدث خطأ أثناء توليد الرد. حاول مرة أخرى لاحقاً."
          : "Something went wrong while generating a reply. Please try again later.",
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsSending(false);
    }
  };

  const handleSend = (e) => {
    e.preventDefault();
    setIsEngineMenuOpen(false);
    if (isRecording) {
      stopRecording("send");
      return;
    }
    sendMessage();
  };

  // Toggle mic recording with basic debug logs
  const handleToggleRecording = async () => {
    try {
      console.log('Mic: toggle clicked');
      if (!isRecording) {
        console.log('starting recording...');
        await startRecording();
      } else {
        console.log('stopping recording...');
        stopRecording("send");
      }
    } catch (err) {
      console.error('Mic: toggle error', err);
    }
  };

  // Voice flow:
  // 1) Mic button -> handleToggleRecording -> startRecording / stopRecording
  // 2) MediaRecorder captures audio and onstop sends it to /api/chat/voice
  // 3) Backend returns { userText, assistantText, audioBase64, usage }
  // 4) We append a user message with the transcript text
  // 5) We append an AI message with assistantText and optional audioBase64 for playback
  // 6) Text-only messages still go through sendMessage() and /api/chat/message
  // --- Voice recording (MediaRecorder) ---------------------------
  const startRecording = async () => {
    if (isRecording || isSending || isSendingVoice) return;
    try {
      const isMobile =
        typeof navigator !== "undefined" &&
        /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent || "");

      try {
        voiceStopIntentRef.current = "send";
      } catch (_) {}

      if (!navigator?.mediaDevices?.getUserMedia) {
        console.error(
          "Mic: getUserMedia not available (secure context required or browser unsupported)"
        );
        const errorMessage = {
          id: messages.length ? messages[messages.length - 1].id + 1 : 1,
          from: "system",
          text: isArabicConversation
            ? "الميكروفون غير مدعوم في المتصفح أو يجب فتح الصفحة عبر اتصال آمن."
            : "Microphone is not supported or a secure context is required.",
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, errorMessage]);
        return;
      }

      if (
        typeof window !== "undefined" &&
        !window.isSecureContext &&
        !["localhost", "127.0.0.1"].includes(window.location.hostname)
      ) {
        const errorMessage = {
          id: messages.length ? messages[messages.length - 1].id + 1 : 1,
          from: "system",
          text: isArabicConversation
            ? "يلزم اتصال آمن (HTTPS) لاستخدام الميكروفون. جرّب فتح الصفحة عبر https أو عبر localhost."
            : "A secure context (HTTPS) is required for microphone access. Open via https or localhost.",
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, errorMessage]);
        return;
      }

      console.log("Mic: starting recording");

      // quick pre-check: do we see any audioinput devices at all?
      try {
        if (navigator?.mediaDevices?.enumerateDevices) {
          const pre = await navigator.mediaDevices.enumerateDevices();
          const hasMicPre =
            Array.isArray(pre) && pre.some((d) => d && d.kind === "audioinput");
          if (!hasMicPre) {
            const errorMessage = {
              id: messages.length ? messages[messages.length - 1].id + 1 : 1,
              from: "system",
              text: isArabicConversation
                ? "لم يتم العثور على ميكروفون متصل بالجهاز."
                : "No microphone appears to be connected to this device.",
              createdAt: new Date().toISOString(),
            };
            setMessages((prev) => [...prev, errorMessage]);
            return;
          }
        }
      } catch (err) {
        console.error("Mic: enumerateDevices error", err);
      }

      let stream = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (err) {
        if (err && (err.name === "NotFoundError" || err.name === "OverconstrainedError")) {
          const deviceId = await getAnyMicDeviceId();
          if (!deviceId) {
            const errorMessage = {
              id: messages.length ? messages[messages.length - 1].id + 1 : 1,
              from: "system",
              text: isArabicConversation
                ? "لم يتم العثور على ميكروفون في هذا الجهاز."
                : "No microphone was found on this device.",
              createdAt: new Date().toISOString(),
            };
            setMessages((prev) => [...prev, errorMessage]);
            return;
          }
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              audio: { deviceId: { exact: deviceId } },
            });
          } catch (err2) {
            const errorMessage = {
              id: messages.length ? messages[messages.length - 1].id + 1 : 1,
              from: "system",
              text: isArabicConversation
                ? "تعذّر الوصول إلى الميكروفون. تحقّق من الإعدادات والأذونات."
                : "Could not access the microphone. Please check settings and permissions.",
              createdAt: new Date().toISOString(),
            };
            setMessages((prev) => [...prev, errorMessage]);
            return;
          }
        } else if (err && err.name === "NotAllowedError") {
          const errorMessage = {
            id: messages.length ? messages[messages.length - 1].id + 1 : 1,
            from: "system",
            text: isArabicConversation
              ? "تم رفض إذن الميكروفون. الرجاء السماح للمتصفح باستخدام الميكروفون."
              : "Microphone permission was denied. Please allow access and try again.",
            createdAt: new Date().toISOString(),
          };
          setMessages((prev) => [...prev, errorMessage]);
          return;
        } else {
          throw err;
        }
      }

      mediaStreamRef.current = stream;
      audioChunksRef.current = [];
      console.log("Mic: media stream acquired");

      const preferredMime = getSupportedMimeType();

      const recorder = preferredMime
        ? new MediaRecorder(stream, { mimeType: preferredMime })
        : new MediaRecorder(stream);
      recorderRef.current = recorder;
      console.log(
        "Mic: MediaRecorder created",
        recorder.mimeType || preferredMime || "default"
      );

      recorder.onstart = () => {
        console.log("Mic: recording started", {
          mimeType: recorder.mimeType || preferredMime || "default",
          isMobile,
        });
        if (isMobile) {
          console.log("Mobile recording started");
        }
      };

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
          console.log("Mic: dataavailable chunk size =", e.data.size);
        } else {
          console.log("Mic: dataavailable received empty chunk");
        }
      };

      recorder.onstop = async () => {
        try {
          const intent = voiceStopIntentRef.current || "send";
          if (intent !== "send") {
            console.log("Mic: recorder stopped (cancel voice send)");
            return;
          }
          console.log("Mic: recorder stopped, preparing to send");
          setIsSendingVoice(true);
          const mime = recorder.mimeType || preferredMime || "audio/webm";
          console.log(
            "Mic: building blob from chunks",
            audioChunksRef.current.length
          );
          const blob = new Blob(audioChunksRef.current, { type: mime });
          audioChunksRef.current = [];
          if (isMobile) {
            console.log(
              "Mobile recording stopped: blob size =",
              blob.size,
              "type =",
              mime
            );
          }
          if (!blob || !blob.size) {
            const errorMessage = {
              id: messages.length ? messages[messages.length - 1].id + 1 : 1,
              from: "system",
              text: isArabicConversation
                ? "فشل تسجيل الصوت. لم نلتقط أي بيانات من الميكروفون."
                : "Voice recording failed. No audio was captured from the microphone.",
              createdAt: new Date().toISOString(),
            };
            setMessages((prev) => [...prev, errorMessage]);
            return;
          }
          
          // Encode user's original recording so we can render a voice bubble for them
          let userAudioBase64 = "";
          try {
            userAudioBase64 = await new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => {
                const result = reader.result;
                if (typeof result === "string") {
                  const commaIndex = result.indexOf(",");
                  resolve(
                    commaIndex >= 0 ? result.slice(commaIndex + 1) : result
                  );
                } else {
                  reject(new Error("Unexpected FileReader result"));
                }
              };
              reader.onerror = (e) => reject(e);
              reader.readAsDataURL(blob);
            });
          } catch (e) {
            console.error("Mic: failed to encode user audio as base64", e);
          }

          let ext = "webm";
          const lowerMime = (mime || "").toLowerCase();
          if (lowerMime.includes("ogg")) {
            ext = "ogg";
          } else if (lowerMime.includes("mpeg") || lowerMime.includes("mp3")) {
            ext = "mp3";
          } else if (lowerMime.includes("wav")) {
            ext = "wav";
          } else if (lowerMime.includes("mp4")) {
            ext = "mp4";
          } else if (lowerMime.includes("aac")) {
            ext = "aac";
          }

          const filename = `voice-message.${ext}`;
          const file = new File([blob], filename, { type: mime });
          const form = new FormData();
          form.append("audio", file);
          form.append("characterId", selectedCharacterId);
          form.append("lang", conversationLang);
          form.append("dialect", selectedDialect || "msa");
          form.append("tone", selectedTone);
          form.append("engine", selectedEngine);
          if (conversationId) {
            form.append("conversationId", String(conversationId));
          }
          form.append(
            "save",
            user?.saveHistoryEnabled === false ? "false" : "true"
          );
          const payloadMessages = messages.map((m) => ({
            from: m.from,
            text: m.text,
          }));
          form.append("messages", JSON.stringify(payloadMessages));

          const token =
            typeof window !== "undefined"
              ? localStorage.getItem(TOKEN_KEY)
              : null;

          const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

          console.log("Mic: sending audio to /api/chat/voice");
          const res = await fetch(`${API_BASE}/api/chat/voice`, {
            method: "POST",
            credentials: "include",
            headers,
            body: form,
          });
          const data = await res.json().catch(() => ({}));

          if (!res.ok) {
            console.warn("Mic: voice response not OK");
            if (isMobile) {
              console.error("Mobile upload error:", res.status, data);
            }
            if (
              (data && (data.code === "VOICE_PRO_ONLY" || data.error === "voice_premium_only")) ||
              (res.status === 403 && data && data.error === "premium_required")
            ) {
              setModalText(
                isArabicConversation
                  ? "هذه الشخصية متاحة فقط في الخطة المدفوعة. بإمكانك الترقية لفتح جميع الرفقاء."
                  : "This companion is available on the Premium plan. Upgrade to unlock all characters."
              );
              setShowLockedModal(true);
              return;
            }
            if (data && (data.error === "usage_limit_reached" || data.code === "LIMIT_EXCEEDED")) {
              const nextUsage = data.usage || usageInfo;
              if (nextUsage) {
                setUsageInfo(nextUsage);
                if (setUser) {
                  setUser((prev) => (prev ? { ...prev, usage: nextUsage } : prev));
                }
              }
              setModalText(
                isArabicConversation
                  ? data.limitType === "monthly"
                    ? "وصلت للحد الشهري للرسائل. يمكنك الترقية إلى برو لحدود أعلى."
                    : "وصلت للحد اليومي للرسائل. يمكنك الترقية إلى برو لحدود أعلى."
                  : data.limitType === "monthly"
                  ? "You have reached your monthly message limit. Upgrade to Pro for higher limits."
                  : "You have reached your daily message limit. Upgrade to Pro for higher limits."
              );
              setShowLimitModal(true);
              return;
            }
            const errorMessage = {
              id: messages.length ? messages[messages.length - 1].id + 1 : 1,
              from: "system",
              text: isArabicConversation
                ? "فشل إرسال الصوت. حاول مرة أخرى."
                : "Voice message failed. Please try again.",
              createdAt: new Date().toISOString(),
            };
            setMessages((prev) => [...prev, errorMessage]);
            return;
          }

          console.log(
            "Mic: voice response payload keys",
            data && typeof data === "object" ? Object.keys(data) : []
          );

          const transcript = (data.userText || "").trim();
          if (!transcript) {
            const errorMessage = {
              id: messages.length ? messages[messages.length - 1].id + 1 : 1,
              from: "system",
              text: isArabicConversation
                ? "فشل إرسال الصوت. حاول مرة أخرى."
                : "We could not understand that recording. Try again.",
              createdAt: new Date().toISOString(),
            };
            setMessages((prev) => [...prev, errorMessage]);
            return;
          }

          const assistantTextRaw = (data.assistantText || "").trim();
          const aiText =
            assistantTextRaw ||
            (isArabicConversation
              ? "واجهت مشكلة بسيطة في الاتصال. حاول مرة أخرى بعد قليل."
              : "I had a small issue connecting. Please try again in a moment.");

          // Voice replies: the backend is expected to return a flat payload
          // { type: 'voice', audio: '<base64>', audioMimeType: 'audio/mpeg', ... }.
          // Be defensive and also accept older shapes so we don't lose audio.
          let aiAudioBase64 = null;
          if (data && typeof data.audio === "string") {
            aiAudioBase64 = data.audio;
          } else if (data && typeof data.audioBase64 === "string") {
            aiAudioBase64 = data.audioBase64;
          } else if (data && data.voice && typeof data.voice === "object") {
            if (typeof data.voice.base64 === "string") {
              aiAudioBase64 = data.voice.base64;
            }
          }

          const aiAudioMime =
            data && typeof data.audioMimeType === "string"
              ? data.audioMimeType
              : "audio/mpeg";

          // 1) Append user + assistant voice messages immediately.
          setMessages((prev) => {
            const lastId =
              prev.length && typeof prev[prev.length - 1].id === "number"
                ? prev[prev.length - 1].id
                : prev.length;
            const nowIso = new Date().toISOString();

            const userVoiceMessage = {
              id: lastId + 1,
              from: "user",
              text: transcript,
              createdAt: nowIso,
              audioBase64: userAudioBase64 || null,
              audioMimeType: mime,
            };

            // If we didn't get any audio back from the server, still show the
            // user's voice bubble and then a system error bubble instead of an
            // AI reply.
            if (!aiAudioBase64) {
              const errorMessage = {
                id: lastId + 2,
                from: "system",
                text: isArabicConversation
                  ? "فشل إنشاء الرد الصوتي. حاول مرة أخرى."
                  : "Failed to generate a voice reply. Please try again.",
                createdAt: nowIso,
              };
              return [...prev, userVoiceMessage, errorMessage];
            }

            const aiVoiceMessage = {
              id: lastId + 2,
              from: "ai",
              type: "voice",
              text: aiText,
              createdAt: nowIso,
              audioBase64: aiAudioBase64,
              audioMimeType: aiAudioMime,
            };

            return [...prev, userVoiceMessage, aiVoiceMessage];
          });

          // 2) Non-critical usage + whispers updates in a follow-up tick.
          setTimeout(() => {
            if (data.usage) {
              setUsageInfo(data.usage);
              if (setUser) {
                setUser((prev) => (prev ? { ...prev, usage: data.usage } : prev));
              }
            }

            if (Array.isArray(data.whispersUnlocked) && data.whispersUnlocked.length) {
              setRecentWhispers((prev) => [...data.whispersUnlocked, ...prev]);
              setHasNewWhispers(true);
            }
          }, 0);

        } catch (err) {
          console.error("Voice send error", err);
        } finally {
          setIsSendingVoice(false);
          console.log("Mic: recording stopped, voice sent");
        }
      };

      // Timeslice is critical on iOS Safari and some mobile browsers to
      // ensure that non-empty dataavailable chunks are delivered.
      if (isMobile) {
        try {
          await new Promise((resolve) => setTimeout(resolve, 50));
        } catch (_) {}
        const timesliceMs = 250;
        recorder.start(timesliceMs);
        console.log("Mic: recorder.start() called with timeslice", timesliceMs);
      } else {
        recorder.start();
        console.log("Mic: recorder.start() called without timeslice");
      }

      setIsRecording(true);
    } catch (err) {
      console.error("Failed to start recording", err);
    }
  };

  const stopRecording = (intent = "send") => {
    try {
      voiceStopIntentRef.current = intent;
    } catch (_) {}
    if (!isRecording) return;
    try {
      console.log("Mic: stopping recording");
      const rec = recorderRef.current;
      if (rec && rec.state !== "inactive") {
        rec.stop();
      }
    } catch (_) {}
    try {
      const stream = mediaStreamRef.current;
      if (stream) {
        for (const track of stream.getTracks()) {
          track.stop();
        }
      }
    } catch (_) {}
    setIsRecording(false);
  };

  useEffect(() => {
    const tId = setTimeout(() => setIsPageLoading(false), 900);
    return () => clearTimeout(tId);
  }, []);

  if (isPageLoading) {
    return <HomeSplash />;
  }

  return (
    <div
      className={`asrar-dash-page asrar-chat-page ${
        isAr ? "asrar-dash-page--ar" : ""
      }`}
    >
      {/* background glows from dashboard CSS */}
      <div className="asrar-dash-orbit asrar-dash-orbit--top" />
      <div className="asrar-dash-orbit asrar-dash-orbit--bottom" />

      {/* HEADER */}
      <AsrarHeader
        lang={lang}
        isAr={isAr}
        onLangChange={handleLangSwitch}
        onLogout={handleLogout}
        mobileLeftSlot={
          <button
            type="button"
            className={
              "asrar-chat-history-toggle" +
              (isMobileSidebarOpen ? " asrar-chat-history-toggle--active" : "")
            }
            onClick={() => setIsMobileSidebarOpen((prev) => !prev)}
            aria-label={isAr ? "تبديل سجل المحادثة" : "Toggle chat history"}
            aria-pressed={isMobileSidebarOpen}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="4" y="4" width="4" height="16" rx="1.2" fill="currentColor" />
              <rect x="11" y="6" width="9" height="2" rx="1" fill="currentColor" />
              <rect x="11" y="11" width="9" height="2" rx="1" fill="currentColor" />
              <rect x="11" y="16" width="9" height="2" rx="1" fill="currentColor" />
            </svg>
          </button>
        }
      />

      {isMobileSidebarOpen && (
        <div className="asrar-chat-mobile-layer" role="dialog" aria-modal="true">
          <div
            className="asrar-chat-mobile-overlay"
            onClick={() => setIsMobileSidebarOpen(false)}
          ></div>
          <div className="asrar-chat-mobile-drawer">
            <div className="asrar-chat-mobile-drawer-header">
              <span className="asrar-chat-mobile-drawer-title">{mobileSidebarTitle}</span>
              <button
                type="button"
                className="asrar-mobile-close"
                aria-label={isAr ? "إغلاق" : "Close"}
                onClick={() => setIsMobileSidebarOpen(false)}
              >
                &times;
              </button>
            </div>
            {renderSidebarContent()}
          </div>
        </div>
      )}

      {/* derive usage counter for header pill */}
      {(() => null)()}
      {/* MAIN */}
      <main className="asrar-chat-layout">
        <aside className="asrar-chat-sidebar">{renderSidebarContent()}</aside>
        
        <div className="asrar-chat-main">
          <div
            className="asrar-chat-messages"
            ref={messagesContainerRef}
            onScroll={handleMessagesScroll}
          >
            <header className="asrar-chat-header-strip">
              <div className={`asrar-chat-header-main asrar-chat-header-main--${selectedCharacterId}`}>
                <h1 className="asrar-chat-header-title">
                  {getName(character)} - {getRole(character)}
                </h1>
              </div>
            </header>
            {recentWhispers.length > 0 && (
              <div className="asrar-whisper-unlock-stack">
                <WhisperUnlockCard
                  whisper={recentWhispers[0]}
                  personaName={characterDisplayName}
                  isAr={isAr}
                  onViewAll={() => {
                    setIsWhispersOpen(true);
                    setHasNewWhispers(false);
                  }}
                  onDismiss={() => {
                    setRecentWhispers((prev) => prev.slice(1));
                  }}
                />
              </div>
            )}

            {messages.map((msg) => {
              const isAiVoice = msg.from === "ai" && !!msg.audioBase64;
              const isUserVoice = msg.from === "user" && !!msg.audioBase64;
              const isTextOnly = !msg.audioBase64; // any message without audio uses text bubble

              const isCurrentAiTyping =
                isAiTyping && msg.id === aiTypingMessageId;

              let rowClass = "asrar-chat-row";
              if (msg.from === "ai") {
                rowClass += " asrar-chat-row--assistant";
              } else if (msg.from === "user") {
                rowClass += " asrar-chat-row--user";
              } else {
                rowClass += " asrar-chat-row--system";
              }

              const isAiTextMessage =
                msg.from === "ai" && isTextOnly && !isAiVoice;
              const currentRenderedText =
                isCurrentAiTyping ? aiTypingBuffer : msg.text;
              const textDir =
                isAiTextMessage
                  ? isArabic(currentRenderedText)
                    ? "rtl"
                    : "ltr"
                  : isArabicConversation
                  ? "rtl"
                  : "ltr";

              return (
                <div key={msg.id} className={rowClass}>
                  <div className="asrar-chat-bubble">
                    {/* AI voice replies: voice bubble only */}
                    {isAiVoice && (
                      <VoiceMessageBubble
                        audioBase64={msg.audioBase64}
                        from={msg.from}
                        isArabic={isArabicConversation}
                        mimeType={msg.audioMimeType}
                      />
                    )}

                    {/* User voice messages: voice bubble only (no transcript text) */}
                    {isUserVoice && !isAiVoice && (
                      <VoiceMessageBubble
                        audioBase64={msg.audioBase64}
                        from={msg.from}
                        isArabic={isArabicConversation}
                        mimeType={msg.audioMimeType}
                      />
                    )}

                    {/* Any message without audio (user or AI or system): normal text bubble */}
                    {isTextOnly && (
                      <span
                        className="asrar-chat-text"
                        dir={textDir}
                      >
                        {currentRenderedText}
                      </span>
                    )}

                    {msg.createdAt && (
                      <div className="asrar-chat-meta">
                        {new Date(msg.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            className={
              "asrar-scroll-bottom" +
              (showScrollToBottom ? " asrar-scroll-bottom--visible" : "")
            }
            aria-label={
              isArabicConversation ? "الانتقال إلى آخر الرسائل" : "Scroll to bottom"
            }
            onClick={handleScrollToBottomClick}
          >
            ↓
          </button>

          {limitExceeded && (
            <div className="asrar-limit-banner">
              <div className="asrar-limit-banner-text">
                <p>
                  {isAr
                    ? "وصلت إلى حد ٥ رسائل اليوم في الخطة المجانية."
                    : "You’ve reached your daily 5-message limit on the free plan."}
                </p>
                {typeof limitResetSeconds === "number" &&
                  limitResetSeconds > 0 &&
                  (() => {
                    const total = limitResetSeconds;
                    const hours = Math.floor(total / 3600);
                    const minutes = Math.floor((total % 3600) / 60);
                    let text;
                    if (hours > 0 && minutes > 0) {
                      text = isAr
                        ? `يمكنك إرسال رسائل جديدة بعد ${hours} ساعة و ${minutes} دقيقة، أو الترقية للمتابعة في الدردشة.`
                        : `You can send new messages in ${hours} hours ${minutes} minutes, or upgrade to keep chatting.`;
                    } else if (hours > 0) {
                      text = isAr
                        ? `يمكنك إرسال رسائل جديدة بعد ${hours} ساعة، أو الترقية للمتابعة في الدردشة.`
                        : `You can send new messages in ${hours} hours, or upgrade to keep chatting.`;
                    } else if (minutes > 0) {
                      text = isAr
                        ? `يمكنك إرسال رسائل جديدة بعد ${minutes} دقيقة، أو الترقية للمتابعة في الدردشة.`
                        : `You can send new messages in ${minutes} minutes, or upgrade to keep chatting.`;
                    } else {
                      text = isAr
                        ? "يمكنك إرسال رسائل جديدة قريباً جداً، أو الترقية للمتابعة في الدردشة."
                        : "You’ll be able to send new messages very soon, or upgrade to keep chatting.";
                    }
                    return <p>{text}</p>;
                  })()}
              </div>
              <button
                type="button"
                className="asrar-upgrade-btn"
                onClick={() => navigate("/billing")}
              >
                {isAr ? "الترقية للمتابعة" : "Upgrade to keep chatting"}
              </button>
            </div>
          )}

          {null}

          <footer className="asrar-chat-composer">
            <div className="asrar-chat-dock">
              <div className="asrar-chat-status-row">
              {isSending && (
                <div className="asrar-chat-row asrar-chat-row--assistant">
                  <div className="asrar-chat-bubble asrar-chat-bubble--typing">
                    <div className="asrar-typing-content">
                      <div className="asrar-typing-dots">
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {(isRecording || isSendingVoice) && (
                <div className="asrar-chat-row asrar-chat-row--assistant">
                  <div className="asrar-chat-bubble asrar-chat-bubble--typing">
                    <div className="asrar-typing-content">
                      <div className="asrar-typing-dots">
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                      <span className="asrar-typing-label">
                        {isRecording
                          ? isArabicConversation
                            ? "جارٍ التسجيل…"
                            : "Recording…"
                          : isArabicConversation
                          ? "جارٍ معالجة الصوت…"
                          : "Processing voice…"}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <form className="asrar-chat-composer-inner" onSubmit={handleSend}>
              <div
                className="asrar-engine-toggle-wrapper"
                ref={engineMenuRef}
              >
                <button
                  type="button"
                  className={
                    "asrar-engine-toggle-btn" +
                    (isEngineMenuOpen ? " asrar-engine-toggle-btn--open" : "")
                  }
                  onClick={() => setIsEngineMenuOpen((prev) => !prev)}
                  disabled={isSending || isBlocked || limitExceeded}
                  aria-haspopup="menu"
                  aria-expanded={isEngineMenuOpen}
                  aria-label={
                    isAr ? "تغيير وضع المحرك" : "Change engine mode"
                  }
                >
                  <span className="asrar-engine-toggle-glyph" aria-hidden="true">
                    ✨
                  </span>
                </button>
                {isEngineMenuOpen && (
                  <div
                    className="asrar-engine-menu"
                    role="menu"
                  >
                    <div className="asrar-engine-menu-header">
                      <span className="asrar-engine-menu-title">
                        {isAr ? "وضع المحرك" : "Engine Mode"}
                      </span>
                    </div>
                    <button
                      type="button"
                      className={
                        "asrar-engine-option" +
                        (selectedEngine === "lite"
                          ? " asrar-engine-option--active"
                          : "")
                      }
                      onClick={() => {
                        setSelectedEngine("lite");
                        setIsEngineMenuOpen(false);
                      }}
                      role="menuitemradio"
                      aria-checked={selectedEngine === "lite"}
                    >
                      <span className="asrar-engine-option-icon" aria-hidden="true">
                        ⚡
                      </span>
                      <span className="asrar-engine-option-label">
                        {isAr ? "خفيف – سريع" : "Lite – Fast"}
                      </span>
                    </button>
                    <button
                      type="button"
                      className={
                        "asrar-engine-option" +
                        (selectedEngine === "balanced"
                          ? " asrar-engine-option--active"
                          : "")
                      }
                      onClick={() => {
                        setSelectedEngine("balanced");
                        setIsEngineMenuOpen(false);
                      }}
                      role="menuitemradio"
                      aria-checked={selectedEngine === "balanced"}
                    >
                      <span className="asrar-engine-option-icon" aria-hidden="true">
                        🧠
                      </span>
                      <span className="asrar-engine-option-label">
                        {isAr ? "عميق – تفاعلي" : "Deep – Emotional"}
                      </span>
                    </button>
                  </div>
                )}
              </div>
              <textarea
                ref={inputRef}
                className="asrar-chat-input asrar-room-input-field"
                rows={1}
                value={inputValue}
                disabled={isSending || isBlocked || limitExceeded}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder={t.typingPlaceholder}
              />
              <div className="asrar-chat-composer-actions">
                <button
                  type="button"
                  className={
                    isRecording
                      ? "asrar-mic-btn asrar-mic-btn--recording asrar-chat-voice-btn"
                      : "asrar-mic-btn asrar-chat-voice-btn"
                  }
                  onClick={handleToggleRecording}
                  disabled={isSending || isSendingVoice || isBlocked}
                  title={
                    isRecording
                      ? isAr
                        ? "إيقاف التسجيل"
                        : "Stop recording"
                      : isAr
                      ? "ابدأ التسجيل"
                      : "Start recording"
                  }
                >
                  <span className="icon" aria-hidden="true">
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z" />
                    </svg>
                  </span>
                </button>
                <button
                  type="submit"
                  className="asrar-send-btn"
                  disabled={isSending || isBlocked || limitExceeded}
                >
                  <span className="asrar-send-btn-label">
                    {isArabicConversation ? "إرسال" : "Send"}
                  </span>
                </button>
              </div>
            </form>
            <div className="asrar-chat-footer-meta">
              <p className="asrar-chat-hint">
                {isArabicConversation
                  ? "قد يخطئ الذكاء الاصطناعي أحياناً، فلا تعتمد عليه وحده في القرارات الحساسة."
                  : "AI may make mistakes sometimes. Do not rely on it alone for sensitive decisions."}
              </p>
              {(() => {
                const isPrem = !!(
                  user?.isPremium || user?.plan === "premium" || user?.plan === "pro"
                );
                const limit = isPrem
                  ? usageInfo?.monthlyLimit ?? 3000
                  : usageInfo?.dailyLimit ?? 5;
                const usedFromUsage = isPrem
                  ? usageInfo?.monthlyUsed ?? null
                  : usageInfo?.dailyUsed ?? null;
                const userMsgs = messages.filter((m) => m.from === "user").length;
                const used = usedFromUsage ?? userMsgs;
                const counterText = `${used} / ${limit}`;
                const modelText = isPrem ? "gpt-4o" : "gpt-4o-mini";
                return (
                  <div className="asrar-chat-header-pill">
                    {isAr
                      ? `الخطة: ${counterText} رسائل`
                      : `Plan: ${counterText} messages`} | {modelText}
                  </div>
                );
              })()}
            </div>
            </div>
          </footer>
        </div>
      </main>

      {/* Existing plan/character modals */}
      {(showLockedModal || showLimitModal) && (
        <div
          className="asrar-modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowLockedModal(false);
              setShowLimitModal(false);
            }
          }}
        >
          <div className="asrar-modal" onClick={(e) => e.stopPropagation()}>
            <div className="asrar-modal-body">{modalText}</div>
            <div className="asrar-modal-actions">
              <button
                type="button"
                className="asrar-btn ghost"
                onClick={() => {
                  setShowLockedModal(false);
                  setShowLimitModal(false);
                }}
              >
                {isAr ? "╪Ñ╪║┘ä╪º┘é" : "Close"}
              </button>
              <button
                type="button"
                className="asrar-btn primary"
                onClick={() => {
                  setShowLockedModal(false);
                  setShowLimitModal(false);
                  navigate("/billing");
                }}
              >
                {isAr ? "الترقية إلى برو" : "Upgrade to Pro"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Whispers Mode full panel */}
      <WhispersPanel
        isOpen={isWhispersOpen}
        onClose={() => setIsWhispersOpen(false)}
        personaId={selectedCharacterId}
        personaName={characterDisplayName}
        isAr={isAr}
      />

      {/* Emotional Timeline Map + Mirror Mode */}
      <EmotionalTimelineMap
        isOpen={isTimelineOpen}
        onClose={() => setIsTimelineOpen(false)}
        personaId={selectedCharacterId}
        personaName={characterDisplayName}
        isAr={isAr}
      />
    </div>
  );
}

