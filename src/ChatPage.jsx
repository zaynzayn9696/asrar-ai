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
    labelAr: "حيوي ومحفِّز",
  },
  {
    id: "strict",
    labelEn: "Direct & Honest",
    labelAr: "صريح ومباشر",
  },
  {
    id: "soft",
    labelEn: "Soft & Empathetic",
    labelAr: "لطيف ومتفهِّم",
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
    systemIntro: "هذه مساحتك الخاصة. لا أحد يحكم على ما تقوله هنا.",
    dialectLabel: "لهجة المحادثة",
    toneLabel: "نبرة الحديث",
    changeCompanion: "تغيير الرفيق",
    you: "أنت",
  },
};

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
        if (!cid) {
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
              setMessages(serverMsgs);
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
  }, [user, selectedCharacterId]);

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

  // Auto-scroll messages container to bottom whenever messages or character change
  useEffect(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, selectedCharacterId]);

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

  const renderSidebarContent = () => (
    <>
      <button
        className="asrar-new-chat-btn"
        onClick={handleStartNewChat}
        type="button"
      >
        {isAr ? 'بدء محادثة جديدة' : '+ Start new chat'}
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
            <div className="asrar-conv-title">{getName(character)}</div>
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
        "دراسة",
        "امتحان",
        "امتحانات",
        "جامعة",
        "مدرسة",
        "شغل",
        "وظيفة",
        "روتين",
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
        "زوجتي",
        "زوجي",
        "زواج",
        "أهلي",
        "أهل",
        "عائلة",
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
          finalText.includes('تقدر تنتقل')
        );
        if (!alreadyMentions) {
          const rec = isArabicConversation
            ? `لو حابّ توجيه عملي أكثر في هذا الموضوع، ممكن تجرب الدردشة مع ${suggestedName}.`
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
      try { voiceStopIntentRef.current = 'send'; } catch (_) {}
      stopRecording();
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
        try { voiceStopIntentRef.current = 'send'; } catch (_) {}
        stopRecording();
      }
    } catch (err) {
      console.error('Mic: toggle error', err);
    }
  };

  // --- Voice recording (MediaRecorder) ---------------------------
  const startRecording = async () => {
    if (isRecording || isSending || isSendingVoice) return;
    try {
      try { voiceStopIntentRef.current = 'send'; } catch (_) {}
      if (!navigator?.mediaDevices?.getUserMedia) {
        console.error('Mic: getUserMedia not available (secure context required or browser unsupported)');
        const errorMessage = {
          id: messages.length ? messages[messages.length - 1].id + 1 : 1,
          from: 'system',
          text: isArabicConversation
            ? 'الميكروفون غير مدعوم في المتصفح أو يجب فتح الصفحة عبر اتصال آمن.'
            : 'Microphone is not supported or a secure context is required.',
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, errorMessage]);
        return;
      }
      // Secure context hint (localhost counts as secure in modern browsers)
      if (
        typeof window !== 'undefined' &&
        !window.isSecureContext &&
        !['localhost', '127.0.0.1'].includes(window.location.hostname)
      ) {
        const errorMessage = {
          id: messages.length ? messages[messages.length - 1].id + 1 : 1,
          from: 'system',
          text: isArabicConversation
            ? 'يلزم اتصال آمن (HTTPS) لاستخدام الميكروفون. جرّب فتح الصفحة عبر https أو عبر localhost.'
            : 'A secure context (HTTPS) is required for microphone access. Open via https or localhost.',
          createdAt: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, errorMessage]);
        return;
      }
      // additional internal log
      console.log('Mic: starting recording');

      // quick pre-check: do we see any audioinput devices at all?
      try {
        if (navigator?.mediaDevices?.enumerateDevices) {
          const pre = await navigator.mediaDevices.enumerateDevices();
          const hasMicPre = Array.isArray(pre) && pre.some((d) => d && d.kind === 'audioinput');
          if (!hasMicPre) {
            const errorMessage = {
              id: messages.length ? messages[messages.length - 1].id + 1 : 1,
              from: 'system',
              text: isArabicConversation
                ? 'لم يتم العثور على ميكروفون متصل بالجهاز.'
                : 'No microphone appears to be connected to this device.',
              createdAt: new Date().toISOString(),
            };
            setMessages((prev) => [...prev, errorMessage]);
            return;
          }
        }
      } catch (_) {}

      let stream = null;
      try {
        // first try with generic constraint
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (err) {
        if (err && (err.name === 'NotFoundError' || err.name === 'OverconstrainedError')) {
          // attempt to target a specific input device
          const deviceId = await getAnyMicDeviceId();
          if (!deviceId) {
            const errorMessage = {
              id: messages.length ? messages[messages.length - 1].id + 1 : 1,
              from: 'system',
              text: isArabicConversation
                ? 'لم يتم العثور على ميكروفون في هذا الجهاز.'
                : 'No microphone was found on this device.',
              createdAt: new Date().toISOString(),
            };
            setMessages((prev) => [...prev, errorMessage]);
            return;
          }
          try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: deviceId } } });
          } catch (err2) {
            const errorMessage = {
              id: messages.length ? messages[messages.length - 1].id + 1 : 1,
              from: 'system',
              text: isArabicConversation
                ? 'تعذّر الوصول إلى الميكروفون. تحقّق من الإعدادات والأذونات.'
                : 'Could not access the microphone. Please check settings and permissions.',
              createdAt: new Date().toISOString(),
            };
            setMessages((prev) => [...prev, errorMessage]);
            return;
          }
        } else if (err && err.name === 'NotAllowedError') {
          const errorMessage = {
            id: messages.length ? messages[messages.length - 1].id + 1 : 1,
            from: 'system',
            text: isArabicConversation
              ? 'تم رفض إذن الميكروفون. الرجاء السماح للمتصفح باستخدام الميكروفون.'
              : 'Microphone permission was denied. Please allow access and try again.',
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
      console.log('Mic: media stream acquired');

      let options = {};
      try {
        if (window.MediaRecorder && MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          options = { mimeType: 'audio/webm;codecs=opus' };
        } else if (window.MediaRecorder && MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
          options = { mimeType: 'audio/ogg;codecs=opus' };
        }
      } catch (_) {}

      const recorder = new MediaRecorder(stream, options);
      recorderRef.current = recorder;
      console.log('Mic: MediaRecorder created');

      recorder.onstart = () => {
        console.log('Mic: recording started');
      };

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        try {
          const intent = voiceStopIntentRef.current || 'send';
          if (intent !== 'send') {
            console.log('Mic: recorder stopped (cancel voice send)');
            return;
          }
          console.log('Mic: recorder stopped, preparing to send');
          setIsSendingVoice(true);
          const mime = recorder.mimeType || 'audio/webm';
          const blob = new Blob(audioChunksRef.current, { type: mime });
          const ext = mime.includes('ogg') ? 'ogg' : mime.includes('mpeg') ? 'mp3' : 'webm';
          const file = new File([blob], `voice.${ext}`, { type: mime });
          const form = new FormData();
          form.append('audio', file);
          form.append('characterId', selectedCharacterId);
          form.append('lang', lang);
          form.append('dialect', selectedDialect);
          form.append('tone', selectedTone);
          const payloadMessages = messages.map((m) => ({ from: m.from, text: m.text }));
          form.append('messages', JSON.stringify(payloadMessages));

          const token =
            typeof window !== 'undefined'
              ? localStorage.getItem(TOKEN_KEY)
              : null;

          const headers = token
            ? { Authorization: `Bearer ${token}` }
            : undefined;

          console.log('Mic: sending audio to /api/chat/voice');
          const res = await fetch(`${API_BASE}/api/chat/voice`, {
            method: 'POST',
            credentials: 'include',
            headers,
            body: form,
          });
          const data = await res.json().catch(() => ({}));

          if (!res.ok) {
            console.warn('Mic: voice response not OK');
            if (data && data.code === 'VOICE_PRO_ONLY') {
              setModalText(
                isArabicConversation
                  ? 'المحادثة الصوتية متاحة فقط لمشتركي برو.'
                  : 'Voice chat is available for Pro members only.'
              );
              setShowLockedModal(true);
              return;
            }
            if (data && data.code === 'LIMIT_EXCEEDED') {
              setUsageInfo(data.usage || usageInfo);
              setModalText(
                isArabicConversation
                  ? data.limitType === 'monthly'
                    ? 'وصلت للحد الشهري للرسائل. يمكنك الترقية إلى برو لحدود أعلى.'
                    : 'وصلت للحد اليومي للرسائل. يمكنك الترقية إلى برو لحدود أعلى.'
                  : data.limitType === 'monthly'
                  ? 'You have reached your monthly message limit. Upgrade to Pro for higher limits.'
                  : 'You have reached your daily message limit. Upgrade to Pro for higher limits.'
              );
              setShowLimitModal(true);
              return;
            }
            const errorMessage = {
              id: messages.length ? messages[messages.length - 1].id + 1 : 1,
              from: 'system',
              text: isArabicConversation
                ? 'فشل إرسال الصوت. حاول مرة أخرى.'
                : 'Voice message failed. Please try again.',
              createdAt: new Date().toISOString(),
            };
            setMessages((prev) => [...prev, errorMessage]);
            return;
          }

          if (data.usage) setUsageInfo(data.usage);

          const transcript = (data.userText || '').trim();
          if (!transcript) {
            const errorMessage = {
              id: messages.length ? messages[messages.length - 1].id + 1 : 1,
              from: 'system',
              text: isArabicConversation
                ? 'لم نستطع فهم التسجيل. حاول مرة أخرى.'
                : 'We could not understand that recording. Try again.',
              createdAt: new Date().toISOString(),
            };
            setMessages((prev) => [...prev, errorMessage]);
            return;
          }

          await sendMessage(transcript);
          console.log('Mic: voice response OK');
        } catch (err) {
          console.error('Voice send error', err);
        } finally {
          setIsSendingVoice(false);
          console.log('Mic: recording stopped, voice sent');
        }
      };

      recorder.start();
      console.log('Mic: recorder.start() called');
      setIsRecording(true);
    } catch (err) {
      console.error('Failed to start recording', err);
    }
  };

  const stopRecording = () => {
    if (!isRecording) return;
    try {
      console.log('Mic: stopping recording');
      const rec = recorderRef.current;
      if (rec && rec.state !== 'inactive') {
        rec.stop();
      }
    } catch (_) {}
    try {
      const stream = mediaStreamRef.current;
      if (stream) {
        for (const track of stream.getTracks()) track.stop();
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
        <aside className="asrar-chat-sidebar">
          {renderSidebarContent()}
        </aside>
        <div className="asrar-chat-main">
          <header className="asrar-chat-header-strip">
            <div className="asrar-chat-header-main">
              <h1 className="asrar-chat-header-title">{getName(character)} — {getRole(character)}</h1>
            </div>
            {null}
          </header>

          <div className="asrar-chat-messages" ref={messagesContainerRef}>
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`asrar-chat-row asrar-chat-row--${msg.from === 'ai' ? 'assistant' : msg.from === 'user' ? 'user' : 'system'}`}
                >
                  <div className="asrar-chat-bubble">
                    {msg.audioBase64 ? (
                      <VoiceMessageBubble
                        audioBase64={msg.audioBase64}
                        from={msg.from}
                        isArabic={isArabicConversation}
                      />
                    ) : (
                      <span className="asrar-chat-text" dir={isArabicConversation ? 'rtl' : 'ltr'}>{msg.text}</span>
                    )}
                    {msg.createdAt && (
                      <div className="asrar-chat-meta">
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {isSending && (
                <div className="asrar-chat-row asrar-chat-row--assistant">
                  <div className="asrar-chat-bubble asrar-chat-bubble--typing">
                    <div className="asrar-typing-dots"><span></span><span></span><span></span></div>
                  </div>
                </div>
              )}
            </div>

            {limitExceeded && (
              <div className="asrar-limit-banner">
                <p>
                  {limitUsage && typeof limitUsage.dailyLimit === 'number'
                    ? `You’ve reached the limit for your free plan (${limitUsage.dailyLimit} messages).`
                    : 'You’ve reached the limit for your free plan.'}
                </p>
                <button
                  type="button"
                  className="asrar-upgrade-btn"
                  onClick={() => navigate('/billing')}
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
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder={t.typingPlaceholder}
              />
              <div className="asrar-chat-composer-actions">
                <button
                  type="button"
                  className={isRecording ? 'asrar-mic-btn asrar-mic-btn--recording asrar-chat-voice-btn' : 'asrar-mic-btn asrar-chat-voice-btn'}
                  onClick={handleToggleRecording}
                  disabled={isSending || isSendingVoice || isBlocked}
                  title={isRecording ? (isAr ? 'إيقاف التسجيل' : 'Stop recording') : (isAr ? 'ابدأ التسجيل' : 'Start recording')}
                >
                  <span className="icon" aria-hidden="true">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z"/>
                    </svg>
                  </span>
                </button>
                <button
                  type="submit"
                  className="asrar-send-btn"
                  disabled={isSending || isBlocked || limitExceeded}
                >
                  <span className="asrar-send-btn-label">
                    {isArabicConversation ? 'إرسال' : 'Send'}
                  </span>
                </button>
              </div>
            </form>
            <div className="asrar-chat-footer-meta">
              <p className="asrar-chat-hint">
                {isArabicConversation
                  ? 'قد يخطئ الذكاء الاصطناعي أحياناً، فلا تعتمد عليه وحده في القرارات الحساسة.'
                  : 'AI may make mistakes sometimes. Do not rely on it alone for sensitive decisions.'}
              </p>
              {(() => {
                const isPrem = !!(user?.isPremium || user?.plan === 'premium' || user?.plan === 'pro');
                const limit = isPrem ? (usageInfo?.monthlyLimit ?? 3000) : (usageInfo?.dailyLimit ?? 5);
                const usedFromUsage = isPrem ? (usageInfo?.monthlyUsed ?? null) : (usageInfo?.dailyUsed ?? null);
                const userMsgs = messages.filter((m) => m.from === 'user').length;
                const used = (usedFromUsage ?? userMsgs);
                const counterText = `${used} / ${limit}`;
                const modelText = 'gpt-4o-mini';
                return (
                  <div className="asrar-chat-header-pill">
                    {isAr ? `الخطة: ${counterText} رسائل` : `Plan: ${counterText} messages`} | {modelText}
                  </div>
                );
              })()}
            </div>
            {(isRecording || isSendingVoice) && (
              <div className="asrar-recording-indicator">
                <span className="dot" />
                {isRecording
                  ? (isAr ? 'جارٍ التسجيل…' : 'Recording…')
                  : (isAr ? 'جارٍ معالجة الصوت…' : 'Processing voice…')}
              </div>
            )}
          </footer>
        </div>
      </main>

      {/* Modals */}
      {(showLockedModal || showLimitModal) && (
        <div className="asrar-modal-backdrop">
          <div className="asrar-modal">
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
                {isAr ? "إغلاق" : "Close"}
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



