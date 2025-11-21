// src/ChatPage.jsx
import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./ChatPage.css";
import AsrarHeader from "./AsrarHeader";
import AsrarFooter from "./AsrarFooter";
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
    return localStorage.getItem("asrar-lang") || "en";
  }
  return "en";
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
  const [crossSuggestion, setCrossSuggestion] = useState(null);
  const [usageInfo, setUsageInfo] = useState(() => user?.usage || null);
  const [showLockedModal, setShowLockedModal] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [modalText, setModalText] = useState("");

  const [hasHydratedHistory, setHasHydratedHistory] = useState(false);

  const messagesContainerRef = useRef(null);

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

  // helper: convert recorded Blob to base64 so we can render user's own voice note as a bubble
  const blobToBase64 = (blob) =>
    new Promise((resolve, reject) => {
      try {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result;
          if (typeof result === "string") {
            const commaIndex = result.indexOf(",");
            resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
          } else {
            resolve("");
          }
        };
        reader.onerror = (e) => reject(e);
        reader.readAsDataURL(blob);
      } catch (e) {
        resolve("");
      }
    });

  useEffect(() => {
    setUsageInfo(user?.usage || null);
  }, [user]);

  // Load any existing history for this user + character on mount
  useEffect(() => {
    if (!user) return;
    if (typeof window === "undefined") return;

    try {
      const raw = localStorage.getItem(CHAT_HISTORY_KEY);
      if (!raw) return;
      const all = JSON.parse(raw);
      const userKey = String(user.id || user.email || "anon");
      const entry = all?.[userKey]?.[selectedCharacterId];
      if (entry && Array.isArray(entry.messages) && entry.messages.length) {
        const hydrated = entry.messages.map((m) => ({
          ...m,
          createdAt: m.createdAt || entry.updatedAt || new Date().toISOString(),
        }));
        setMessages(hydrated);
      }
    } catch (e) {
      console.error("Failed to load chat history", e);
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

  // Persist history whenever messages change
  useEffect(() => {
    if (!user) return;
    if (!hasHydratedHistory) return; // avoid overwriting stored history before hydration
    if (typeof window === "undefined") return;

    try {
      const raw = localStorage.getItem(CHAT_HISTORY_KEY);
      const all = raw ? JSON.parse(raw) : {};
      const userKey = String(user.id || user.email || "anon");
      const userHist = all[userKey] || {};

      userHist[selectedCharacterId] = {
        updatedAt: new Date().toISOString(),
        messages,
      };

      all[userKey] = userHist;
      localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(all));
    } catch (e) {
      console.error("Failed to persist chat history", e);
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

  const sendMessage = async () => {
    const trimmed = inputValue.trim();
    if (!trimmed || isSending) return;

    const userMessage = {
      id: messages.length ? messages[messages.length - 1].id + 1 : 1,
      from: "user",
      text: trimmed,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");

    const suggested = suggestBetterCompanion(trimmed, selectedCharacterId);
    if (suggested) {
      // Off-topic request: do not call OpenAI, only show recommendation card
      return;
    }

    setIsSending(true);

    try {
      const payloadMessages = [...messages, userMessage].map((m) => ({
        from: m.from,
        text: m.text,
      }));

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
        if (data && data.code === "PRO_CHARACTER_LOCKED") {
          setModalText(
            isArabicConversation
              ? "هذه الشخصية متاحة فقط في خطة برو. بإمكانك الترقية لفتح جميع الرفقاء."
              : "This companion is available on the Pro plan. Upgrade to unlock all characters."
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

      const aiMessage = {
        id: userMessage.id + 1,
        from: "ai",
        text: aiText,
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, aiMessage]);
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
          console.log('Mic: recorder stopped, preparing to send');
          setIsSendingVoice(true);
          const mime = recorder.mimeType || 'audio/webm';
          const blob = new Blob(audioChunksRef.current, { type: mime });
          const ext = mime.includes('ogg') ? 'ogg' : mime.includes('mpeg') ? 'mp3' : 'webm';
          const file = new File([blob], `voice.${ext}`, { type: mime });

          // prepare local base64 copy so the user's own voice input can be shown as a bubble
          const localUserAudioBase64 = await blobToBase64(blob).catch(() => null);

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

          const nextId = messages.length ? messages[messages.length - 1].id + 1 : 1;
          const nowIso = new Date().toISOString();
          const userMsg = {
            id: nextId,
            from: 'user',
            text: data.userText || '',
            audioBase64: localUserAudioBase64 || null,
            createdAt: nowIso,
          };
          const aiMsg = {
            id: nextId + 1,
            from: 'ai',
            text: data.assistantText || '',
            // attach optional base64 audio so UI can render tap-to-play bubble
            audioBase64: data.audioBase64 || null,
            createdAt: nowIso,
          };
          setMessages((prev) => [...prev, userMsg, aiMsg]);
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
      />

      {/* MAIN */}
      <main className="asrar-dash-main">
        <section
          className="asrar-dash-panel asrar-room-panel"
          dir={isAr ? "rtl" : "ltr"}
        >
          <div className="asrar-room-layout">
            {/* LEFT SIDEBAR */}
            <aside className="asrar-room-sidebar">
              <div className="asrar-room-companion-card">
                <div className="asrar-room-avatar-wrap">
                  <img
                    src={character.avatar}
                    alt={getName(character)}
                    className="asrar-room-avatar"
                  />
                </div>
                <div className="asrar-room-companion-meta">
                  <div className="asrar-room-companion-name">
                    {getName(character)}
                  </div>
                  <div className="asrar-room-companion-role">
                    {getRole(character)}
                  </div>
                </div>
                <div className="asrar-room-status-pill">
                  ● {isAr ? "متصل الآن" : "Online"}
                </div>
              </div>

              <div className="asrar-room-tone-block">
                <div className="asrar-room-dialect-label">
                  {t.toneLabel}
                </div>
                <div className="asrar-room-tone-pills">
                  {TONES_UI.map((toneDef) => {
                    const active = selectedTone === toneDef.id;
                    return (
                      <button
                        key={toneDef.id}
                        type="button"
                        className={
                          "asrar-tone-pill" +
                          (active ? " asrar-tone-pill--active" : "")
                        }
                        onClick={() => setSelectedTone(toneDef.id)}
                      >
                        {isAr ? toneDef.labelAr : toneDef.labelEn}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="asrar-room-dialect-block">
                <div className="asrar-room-dialect-label">
                  {t.dialectLabel}
                </div>
                <div className="asrar-dash-dialect-select-shell">
                  <select
                    className="asrar-dash-dialect-select asrar-room-dialect-select"
                    value={selectedDialect}
                    onChange={(e) => handleDialectChange(e.target.value)}
                  >
                    {DIALECTS.map((d) => (
                      <option key={d.id} value={d.id}>
                        {isAr ? d.labelAr : d.labelEn}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="asrar-room-note">
                {isAr
                  ? "سيتم احترام لهجتك وطريقة تعبيرك كما هي."
                  : "Your dialect and way of speaking will be respected as-is."}
              </div>

              <Link to="/dashboard" className="asrar-room-change-link">
                {t.changeCompanion}
              </Link>
            </aside>

            {/* CHAT AREA */}
            <section className="asrar-room-chat">
              <header className="asrar-room-chat-header">
                <div className="asrar-room-chat-title">
                  {getName(character)}
                </div>
                <div className="asrar-room-chat-subtitle">
                  {isArabicConversation
                    ? "كل ما تكتبه هنا يبقى بينك وبين رفيقك."
                    : "Everything you share here stays between you and your companion."}
                </div>
                {user && (
                  <div className="asrar-room-plan-usage">
                    <span className="asrar-room-plan-chip">
                      {user.plan === "pro" ? (isAr ? "برو" : "Pro") : (isAr ? "مجانية" : "Free")}
                    </span>
                    {usageInfo && (
                      <span className="asrar-room-usage-text">
                        {isAr
                          ? `اليوم: ${Math.max(0, (usageInfo.dailyLimit || 0) - (usageInfo.dailyUsed || 0))} / ${usageInfo.dailyLimit || 0}`
                          : `Today: ${Math.max(0, (usageInfo.dailyLimit || 0) - (usageInfo.dailyUsed || 0))} / ${usageInfo.dailyLimit || 0}`}
                      </span>
                    )}
                  </div>
                )}
              </header>

              <div
                className="asrar-room-messages"
                ref={messagesContainerRef}
              >
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={
                      "asrar-room-message " +
                      (msg.from === "user"
                        ? "asrar-room-message--user"
                        : msg.from === "ai"
                        ? "asrar-room-message--ai"
                        : "asrar-room-message--system")
                    }
                  >
                    {msg.from !== "system" && (
                      <div className="asrar-room-message-label">
                        {msg.from === "user" ? t.you : getName(character)}
                      </div>
                    )}
                    <div className="asrar-room-message-bubble">
                      {msg.audioBase64 ? (
                        <VoiceMessageBubble
                          audioBase64={msg.audioBase64}
                          from={msg.from}
                          isArabic={isArabicConversation}
                        />
                      ) : (
                        msg.text
                      )}
                    </div>
                    {msg.createdAt && (
                      <div className="asrar-room-message-meta">
                        <span className="asrar-room-message-time">
                          {new Date(msg.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    )}
                  </div>
                ))}

                {isSending && (
                  <div className="asrar-room-message asrar-room-message--ai asrar-room-message--typing">
                    <div className="asrar-room-message-bubble">
                      <span className="asrar-typing-dots">
                        <span></span>
                        <span></span>
                        <span></span>
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {crossSuggestion && (
                <div className="asrar-room-suggestion">
                  <div className="asrar-room-suggestion-text">
                    {isAr
                      ? `أقدر أكمل معك هنا، لكن ${
                          crossSuggestion.nameAr
                        } مركّز أكثر على هذا النوع من المواضيع. تقدر تنتقل له بضغطة زر.`
                      : `I can keep talking with you here, but ${
                          crossSuggestion.nameEn
                        } is more focused on this kind of topic. You can switch to them with one tap.`}
                  </div>
                  <button
                    type="button"
                    className="asrar-room-suggestion-btn"
                    onClick={() => {
                      if (typeof window !== "undefined") {
                        localStorage.setItem(
                          "asrar-selected-character",
                          crossSuggestion.id
                        );
                      }
                      setSelectedCharacterId(crossSuggestion.id);
                      setCrossSuggestion(null);
                    }}
                  >
                    {isAr
                      ? `الانتقال إلى ${crossSuggestion.nameAr}`
                      : `Switch to ${crossSuggestion.nameEn.split(" ")[0]}`}
                  </button>
                </div>
              )}

              <form className="asrar-room-input asrar-chat-input-row" onSubmit={handleSend}>
                <textarea
                  className="asrar-room-input-field"
                  rows={2}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder={t.typingPlaceholder}
                />

                <button
                  type="button"
                  className={isRecording ? 'asrar-mic-btn asrar-mic-btn--recording' : 'asrar-mic-btn'}
                  onClick={handleToggleRecording}
                  disabled={isSending || isSendingVoice}
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
                  disabled={isSending}
                >
                  <span className="icon" aria-hidden="true">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                      <path d="M7 17L17 7M7 7h10v10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </span>
                </button>
              </form>
              {(isRecording || isSendingVoice) && (
                <div className="asrar-recording-indicator">
                  <span className="dot" />
                  {isRecording
                    ? (isAr ? 'جارٍ التسجيل…' : 'Recording…')
                    : (isAr ? 'جارٍ معالجة الصوت…' : 'Processing voice…')}
                </div>
              )}
            </section>
          </div>
        </section>
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
      <AsrarFooter />
    </div>
  );
}
