// src/ChatPage.jsx
import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./ChatPage.css";
import AsrarHeader from "./AsrarHeader";

import VoiceMessageBubble from "./VoiceMessageBubble"; // tap-to-play audio bubble for voice replies
import { API_BASE } from "./apiBase";

import abuZainAvatar from "./assets/abu_zain.png";
import hanaAvatar from "./assets/hana.png";
import rashidAvatar from "./assets/rashid.png";
import nourAvatar from "./assets/nour.png";
import farahAvatar from "./assets/farah.png";
import { useAuth, TOKEN_KEY } from "./hooks/useAuth";

// same 5 characters
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

const getInitialCharacterId = () => {
  if (typeof window !== "undefined") {
    return localStorage.getItem("asrar-selected-character") || "rashid";
  }
  return "rashid";
};

const CHARACTER_DEFAULT_TONES = {
  "abu-zain": "calm",
  hana: "soft",
  rashid: "energetic",
  nour: "strict",
  farah: "energetic",
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
  const { user, logout } = useAuth();

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

  // Free plan limit banner state
  const [limitExceeded, setLimitExceeded] = useState(false);
  const [limitUsage, setLimitUsage] = useState(null);

  const [hasHydratedHistory, setHasHydratedHistory] = useState(false);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);

  const messagesContainerRef = useRef(null);
  const inputRef = useRef(null);

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

  const [reloadConversationsToken, setReloadConversationsToken] = useState(0);

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
                  const storageKey = `asrar-chat-history-${user.id}-${selectedCharacterId}`;
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
                            audioMimeType: overlay.audioMimeType,
                          });
                        } else {
                          merged.push(m);
                        }
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
  }, [user, selectedCharacterId, reloadConversationsToken]);

  // Debug: track which companion is selected in chat
  useEffect(() => {
    console.log("[ChatPage] selectedCharacterId", selectedCharacterId);
  }, [selectedCharacterId]);

  // Load any existing history for this user + character on mount
  useEffect(() => {
    if (!user) return;
    if (typeof window === "undefined") return;

    const userId = user.id;
    if (!userId) return;

    const storageKey = `asrar-chat-history-${userId}-${selectedCharacterId}`;

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
  }, [user, selectedCharacterId]);

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

  const handleMessagesScroll = () => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const isDesktop =
      typeof window !== "undefined" && window.innerWidth > 900;

    if (isDesktop) {
      const rect = el.getBoundingClientRect();
      const distanceFromBottom = rect.bottom - window.innerHeight;
      const threshold = 200;
      const shouldShow = distanceFromBottom > threshold;
      setShowScrollToBottom((prev) =>
        prev !== shouldShow ? shouldShow : prev
      );
      return;
    }

    const distanceFromBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight;
    const threshold = 200;
    const shouldShow = distanceFromBottom > threshold;
    setShowScrollToBottom((prev) =>
      prev !== shouldShow ? shouldShow : prev
    );
  };

  const handleScrollToBottomClick = () => {
    const el = messagesContainerRef.current;
    if (!el) return;

    const isDesktop =
      typeof window !== "undefined" && window.innerWidth > 900;

    if (isDesktop) {
      try {
        const rect = el.getBoundingClientRect();
        const currentY =
          (window.scrollY || window.pageYOffset || 0);
        const targetBottom = currentY + rect.bottom - window.innerHeight;
        const docEl = document.documentElement || document.body;
        const maxScroll =
          (docEl.scrollHeight || 0) - window.innerHeight;
        const finalY = Math.max(0, Math.min(targetBottom + 8, maxScroll));
        window.scrollTo({ top: finalY, behavior: "smooth" });
      } catch (_) {
        // fallback: jump close to page bottom
        window.scrollTo(0, document.body.scrollHeight);
      }
    } else {
      try {
        el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
      } catch (_) {
        el.scrollTop = el.scrollHeight;
      }
    }

    setShowScrollToBottom(false);
  };

  // Auto-scroll to bottom on initial thread load / character switch
  useEffect(() => {
    const el = messagesContainerRef.current;
    if (!el) return;

    const isDesktop =
      typeof window !== "undefined" && window.innerWidth > 900;

    if (isDesktop) {
      try {
        const rect = el.getBoundingClientRect();
        const currentY =
          (window.scrollY || window.pageYOffset || 0);
        const targetBottom = currentY + rect.bottom - window.innerHeight;
        const docEl = document.documentElement || document.body;
        const maxScroll =
          (docEl.scrollHeight || 0) - window.innerHeight;
        const finalY = Math.max(0, Math.min(targetBottom + 8, maxScroll));
        window.scrollTo({ top: finalY, behavior: "auto" });
      } catch (_) {
        window.scrollTo(0, document.body.scrollHeight);
      }
    } else {
      try {
        el.scrollTo({ top: el.scrollHeight, behavior: "auto" });
      } catch (_) {
        el.scrollTop = el.scrollHeight;
      }
    }

    setShowScrollToBottom(false);
  }, [selectedCharacterId]);

  // Auto-scroll new messages only when user is already near the bottom
  useEffect(() => {
    const el = messagesContainerRef.current;
    if (!el) return;

    const isDesktop =
      typeof window !== "undefined" && window.innerWidth > 900;

    if (isDesktop) {
      const rect = el.getBoundingClientRect();
      const distanceFromBottom = rect.bottom - window.innerHeight;
      const threshold = 80;
      if (distanceFromBottom <= threshold) {
        try {
          const currentY =
            (window.scrollY || window.pageYOffset || 0);
          const targetBottom = currentY + rect.bottom - window.innerHeight;
          const docEl = document.documentElement || document.body;
          const maxScroll =
            (docEl.scrollHeight || 0) - window.innerHeight;
          const finalY = Math.max(0, Math.min(targetBottom + 8, maxScroll));
          window.scrollTo({ top: finalY, behavior: "auto" });
        } catch (_) {
          window.scrollTo(0, document.body.scrollHeight);
        }
        setShowScrollToBottom(false);
      }
    } else {
      const distanceFromBottom =
        el.scrollHeight - el.scrollTop - el.clientHeight;
      const threshold = 80;
      if (distanceFromBottom <= threshold) {
        try {
          el.scrollTo({ top: el.scrollHeight, behavior: "auto" });
        } catch (_) {
          el.scrollTop = el.scrollHeight;
        }
        setShowScrollToBottom(false);
      }
    }
  }, [messages]);

  // Desktop: update scroll-to-bottom visibility on window scroll
  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const onScroll = () => {
      const el = messagesContainerRef.current;
      if (!el) return;

      const isDesktop = window.innerWidth > 900;
      if (!isDesktop) return;

      const rect = el.getBoundingClientRect();
      const distanceFromBottom = rect.bottom - window.innerHeight;
      const threshold = 200;
      const shouldShow = distanceFromBottom > threshold;
      setShowScrollToBottom((prev) =>
        prev !== shouldShow ? shouldShow : prev
      );
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    // run once on mount to set initial state
    onScroll();

    return () => {
      window.removeEventListener("scroll", onScroll);
    };
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

  const handleStartNewChat = () => {
    try {
      setIsMobileSidebarOpen(false);
      // Clear UI and reset conversation pointer; backend will create on next send
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
      const el = messagesContainerRef.current;
      if (el) el.scrollTop = 0;
    } catch (e) {
      console.error('[ChatPage] start new chat failed', e);
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
        setMessages(Array.isArray(serverMsgs) && serverMsgs.length ? serverMsgs : []);
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
            const storageKey = `asrar-chat-history-${user.id}-${selectedCharacterId}`;
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
      <div className="asrar-conversation-list">
        {convLoading && <div className="asrar-conv-item">Loading...</div>}
        {convError && !convLoading && (
          <div className="asrar-conv-item">{convError}</div>
        )}
        {!convLoading && !convError && Array.isArray(conversations) && conversations.map((conv) => (
          <div
            key={conv.id}
            className={
              "asrar-conv-item" + (conv.id === conversationId ? " asrar-conv-item--active" : "")
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
            <div className="asrar-conv-preview">{(conv.firstUserMessage && conv.firstUserMessage.trim()) ? conv.firstUserMessage.slice(0, 60) : "No messages yet"}</div>
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

    const userId = user.id;
    if (!userId) return;

    const storageKey = `asrar-chat-history-${userId}-${selectedCharacterId}`;

    try {
      localStorage.setItem(storageKey, JSON.stringify(messages));
      console.log("[ChatPage] saved history", {
        storageKey,
        count: messages.length,
      });
    } catch (e) {
      console.error("[ChatPage] Failed to persist chat history", e);
    }
  }, [messages, selectedCharacterId, user, hasHydratedHistory]);

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
      suggestedId = "rashid";
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
      suggestedId = "farah";
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
      suggestedId = "abu-zain";
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
          save: !!user?.saveHistoryEnabled,
          lang,
          dialect: selectedDialect,
          tone: selectedTone,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error("Chat send error", {
          status: res.status,
          body: data,
        });
        // Free plan daily limit enforcement: show banner and disable input
        if (res.status === 403 && data && data.error === 'limit_exceeded') {
          setLimitExceeded(true);
          setLimitUsage(data.usage || null);
          setIsBlocked(true);
          return;
        }
        if (data && data.code === "PRO_CHARACTER_LOCKED") {
          setModalText(
            isArabicConversation
              ? "هذه الشخصية متاحة فقط في خطة برو. بإمكانك الترقية لفتح جميع الرفقاء."
              : "This companion is available on the Pro plan. Upgrade to unlock all characters."
          );
          setShowLockedModal(true);
          return;
        }
        if (data && (data.error === "usage_limit_reached" || data.code === "LIMIT_EXCEEDED")) {
          setUsageInfo(data.usage || usageInfo);
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

      if (data.usage) setUsageInfo(data.usage);

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

      // If no active conversation existed, fetch the latest one and set it
      if (!conversationId) {
        try {
          const token2 = typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
          const headers2 = token2
            ? { "Content-Type": "application/json", Authorization: `Bearer ${token2}` }
            : { "Content-Type": "application/json" };
          const listRes = await fetch(
            `${API_BASE}/api/chat/conversations?characterId=${selectedCharacterId}`,
            { method: 'GET', credentials: 'include', headers: headers2 }
          );
          const list = await listRes.json().catch(() => []);
          if (Array.isArray(list) && list.length) {
            setConversations(list);
            setConversationId(list[0].id || null);
          }
        } catch (_) {}
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
          form.append("lang", lang);
          form.append("dialect", selectedDialect);
          form.append("tone", selectedTone);
          if (conversationId) {
            form.append("conversationId", String(conversationId));
          }
          form.append(
            "save",
            user && user.saveHistoryEnabled ? "true" : "false"
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
            if (data && data.code === "VOICE_PRO_ONLY") {
              setModalText(
                isArabicConversation
                  ? "المحادثة الصوتية متاحة فقط لمشتركي برو."
                  : "Voice chat is available for Pro members only."
              );
              setShowLockedModal(true);
              return;
            }
            if (data && data.code === "LIMIT_EXCEEDED") {
              setUsageInfo(data.usage || usageInfo);
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

          if (data.usage) setUsageInfo(data.usage);

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

          const audioBase64 =
            data && typeof data === "object" && typeof data.audioBase64 === "string"
              ? data.audioBase64
              : null;

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
            const aiVoiceMessage = {
              id: lastId + 2,
              from: "ai",
              text: aiText,
              createdAt: nowIso,
              audioBase64,
              audioMimeType: "audio/mpeg",
            };
            return [...prev, userVoiceMessage, aiVoiceMessage];
          });
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
          <header className="asrar-chat-header-strip">
            <div className="asrar-chat-header-main">
              <h1 className="asrar-chat-header-title">
                {getName(character)} - {getRole(character)}
              </h1>
            </div>
            {null}
          </header>

          <div
            className="asrar-chat-messages"
            ref={messagesContainerRef}
            onScroll={handleMessagesScroll}
          >
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`asrar-chat-row asrar-chat-row--${
                  msg.from === "ai"
                    ? "assistant"
                    : msg.from === "user"
                    ? "user"
                    : "system"
                }`}
              >
                <div className="asrar-chat-bubble">
                  {msg.audioBase64 ? (
                    <VoiceMessageBubble
                      audioBase64={msg.audioBase64}
                      from={msg.from}
                      isArabic={isArabicConversation}
                      mimeType={msg.audioMimeType}
                    />
                  ) : (
                    <span
                      className="asrar-chat-text"
                      dir={isArabicConversation ? "rtl" : "ltr"}
                    >
                      {msg.text}
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
            ))}

            {isSending && (
              <div className="asrar-chat-row asrar-chat-row--assistant">
                <div className="asrar-chat-bubble asrar-chat-bubble--typing">
                  <div className="asrar-typing-content">
                    <div className="asrar-typing-dots">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                    <span className="asrar-typing-label">
                      {isArabicConversation ? "جارٍ التفكير…" : "Thinking…"}
                    </span>
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
              <p>
                {limitUsage && typeof limitUsage.dailyLimit === "number"
                  ? `YouΓÇÖve reached the limit for your free plan (${limitUsage.dailyLimit} messages).`
                  : "YouΓÇÖve reached the limit for your free plan."}
              </p>
              <button
                type="button"
                className="asrar-upgrade-btn"
                onClick={() => navigate("/billing")}
              >
                Upgrade to keep chatting
              </button>
            </div>
          )}

          {null}

          <footer className="asrar-chat-composer">
            <form className="asrar-chat-composer-inner" onSubmit={handleSend}>
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
                const modelText = "gpt-4o-mini";
                return (
                  <div className="asrar-chat-header-pill">
                    {isAr
                      ? `الخطة: ${counterText} رسائل`
                      : `Plan: ${counterText} messages`} | {modelText}
                  </div>
                );
              })()}
            </div>
          </footer>
        </div>
      </main>

      {/* Modals */}
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
    </div>
  );
}



