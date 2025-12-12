// src/HiddenPortalsModal.jsx
import React, { useEffect, useState } from "react";
import "./HiddenPortalsModal.css";
import { API_BASE } from "./apiBase";
import { TOKEN_KEY } from "./hooks/useAuth";

const PORTALS_DATA = {
  en: [
    {
      id: 1,
      title: "Pick a Door",
      subtitle: "One of these doors feels like the way you enter life situations. Which one pulls you the most?",
      choices: [
        { id: "steel", label: "Heavy steel door with many locks", icon: "🔒" },
        { id: "wooden", label: "Simple wooden door half-open with warm light", icon: "🚪" },
        { id: "neon", label: "Dark hallway with a neon EXIT sign at the end", icon: "🚶" },
        { id: "glass", label: "Glass sliding door, everything visible", icon: "🪟" }
      ]
    },
    {
      id: 2,
      title: "Which chat is you?",
      subtitle: "All messages are blurred. Just the shapes are real. Which chat thread feels closest to how you text?",
      choices: [
        { id: "long_short", label: "I send long paragraphs, they reply short", icon: "📝" },
        { id: "spam_short", label: "I spam many short messages, they barely reply", icon: "💬" },
        { id: "short_long", label: "I reply short, they send long emotional texts", icon: "💭" },
        { id: "balanced", label: "We both send long messages, balanced", icon: "⚖️" }
      ]
    },
    {
      id: 3,
      title: "Storm in the Street",
      subtitle: "You're walking and a sudden storm hits. What do you do first?",
      choices: [
        { id: "run", label: "Run to the nearest building and wait", icon: "🏃" },
        { id: "keep_walking", label: "Keep walking like nothing is wrong", icon: "🚶" },
        { id: "film", label: "Take out your phone and film the storm", icon: "📱" },
        { id: "stare", label: "Stand there and just stare at the sky", icon: "👀" }
      ]
    },
    {
      id: 4,
      title: "Elevator Jolt",
      subtitle: "The elevator shakes hard for a second. Which button do you hit first?",
      choices: [
        { id: "alarm", label: "Alarm button", icon: "🚨" },
        { id: "open", label: "Open Door button", icon: "🚪" },
        { id: "floor", label: "Random floor number", icon: "🔢" },
        { id: "freeze", label: "Nothing — you freeze and do nothing", icon: "❄️" }
      ]
    },
    {
      id: 5,
      title: "How do you see yourself?",
      subtitle: "These are all blurred faces. None is 'right'. Which one feels uncomfortably familiar?",
      choices: [
        { id: "strong_blurred", label: "Strong outline, features blurred", icon: "🌫️" },
        { id: "blurred_sharp", label: "Face fully blurred, background sharp", icon: "🎭" },
        { id: "shadow_light", label: "Half in shadow, half in light", icon: "🌓" },
        { id: "fragmented", label: "Fragmented face like cracked glass", icon: "💔" }
      ]
    },
    {
      id: 6,
      title: "Weight on Your Chest",
      subtitle: "If your chest feeling was an image, which one matches?",
      choices: [
        { id: "stone", label: "Stone pressing on a chest outline", icon: "🗿" },
        { id: "balloon", label: "Balloon tied to a chest, trying to float upward", icon: "🎈" },
        { id: "cracks", label: "Chest with cracks and light leaking out", icon: "✨" },
        { id: "rope", label: "Chest wrapped in glowing rope", icon: "🪢" }
      ]
    },
    {
      id: 7,
      title: "Pick Your Ghost",
      subtitle: "One of these 'ghosts' has been following you for years. Which one feels like it already knows you?",
      choices: [
        { id: "time", label: "Ghost holding a clock (time / regret)", icon: "⏰" },
        { id: "love", label: "Ghost holding a broken heart (love / pain)", icon: "💔" },
        { id: "work", label: "Ghost holding a laptop (work / pressure)", icon: "💻" },
        { id: "mirror", label: "Ghost holding a mirror (identity / self-image)", icon: "🪞" }
      ]
    },
    {
      id: 8,
      title: "Time Glitch",
      subtitle: "You get one hour that doesn't count against your day. What do you secretly use it for?",
      choices: [
        { id: "sleep", label: "Sleep, no hesitation", icon: "😴" },
        { id: "future", label: "Work on your future / project", icon: "🚀" },
        { id: "scroll", label: "Scroll or game and disappear", icon: "🎮" },
        { id: "someone", label: "Be with someone, talk or sit together", icon: "👥" }
      ]
    },
    {
      id: 9,
      title: "The Hidden Room",
      subtitle: "You discover a locked room that belongs only to you. Who do you allow inside?",
      choices: [
        { id: "no_one", label: "Absolutely no one", icon: "🚫" },
        { id: "one_person", label: "One specific person only", icon: "👤" },
        { id: "few_close", label: "A few close people", icon: "👨‍👩‍👧‍👦" },
        { id: "anyone", label: "Anyone who needs a place", icon: "🌍" }
      ]
    },
    {
      id: 10,
      title: "Finish the Glitch",
      subtitle: "Your brain auto-completes this sentence. Which version is closest to your true internal voice?",
      choices: [
        { id: "strong_tired", label: "...strong, but they don't see how tired I am", icon: "💪" },
        { id: "complicated", label: "...complicated, and I'm not sure I disagree", icon: "🤔" },
        { id: "easygoing_mind", label: "...easygoing, but my mind never shuts up", icon: "😌" },
        { id: "quiet_notice", label: "...quiet, but I notice everything", icon: "🧘" }
      ]
    },
    {
      id: 11,
      title: "Noise Level",
      subtitle: "If your mind today was a sound, which one is it?",
      choices: [
        { id: "rain", label: "Gentle rain", icon: "🌧️" },
        { id: "street", label: "Busy street and honking", icon: "🚗" },
        { id: "static", label: "Static / TV noise", icon: "📺" },
        { id: "heartbeat", label: "Almost silent, just tiny heartbeat-like pulses", icon: "💓" }
      ]
    }
  ],
  ar: [
    {
      id: 1,
      title: "اختر باباً",
      subtitle: "واحد من هذه الأبواب يشبه طريقة دخولك لمواقف الحياة. أي واحد يجذبك أكثر؟",
      choices: [
        { id: "steel", label: "باب حديدي ثقيل بأقفال كثيرة", icon: "🔒" },
        { id: "wooden", label: "باب خشبي بسيط مفتوح جزئياً بضوء دافئ", icon: "🚪" },
        { id: "neon", label: "ممر مظلم بلوحة EXIT نيون في النهاية", icon: "🚶" },
        { id: "glass", label: "باب زجاجي انزلاقي، كل شيء مرئي", icon: "🪟" }
      ]
    },
    {
      id: 2,
      title: "أي محادثة أنت؟",
      subtitle: "كل الرسائل ضبابية. فقط الأشكال حقيقية. أي خيط محادثة يشبه طريقتك في الكتابة؟",
      choices: [
        { id: "long_short", label: "أرسل فقرات طويلة، يردون بقصيرة", icon: "📝" },
        { id: "spam_short", label: "أرسل رسائل قصيرة كثيرة، يردون نادراً", icon: "💬" },
        { id: "short_long", label: "أرد بقصير، يرسلون رسائل طويلة عاطفية", icon: "💭" },
        { id: "balanced", label: "كلاهما يرسل رسائل طويلة، متوازنة", icon: "⚖️" }
      ]
    },
    {
      id: 3,
      title: "عاصفة في الشارع",
      subtitle: "تمشي وفجأة ضربت عاصفة. ماذا تفعل أولاً؟",
      choices: [
        { id: "run", label: "أركض لأقرب مبنى وأنتظر", icon: "🏃" },
        { id: "keep_walking", label: "أستمر في المشي كأن لا شيء خطأ", icon: "🚶" },
        { id: "film", label: "أخرج هاتفي وأصور العاصفة", icon: "📱" },
        { id: "stare", label: "أقف هناك فقط وأحدق في السماء", icon: "👀" }
      ]
    },
    {
      id: 4,
      title: "اهتزاز المصعد",
      subtitle: "المصعد يهتز بقوة للحظة. أي زر تضغط أولاً؟",
      choices: [
        { id: "alarm", label: "زر الإنذار", icon: "🚨" },
        { id: "open", label: "زر فتح الباب", icon: "🚪" },
        { id: "floor", label: "رقم طابق عشوائي", icon: "🔢" },
        { id: "freeze", label: "لا شيء — أتجمد ولا أفعل شيئاً", icon: "❄️" }
      ]
    },
    {
      id: 5,
      title: "كيف ترى نفسك؟",
      subtitle: "هذه وجوه ضبابية. لا يوجد 'صحيح'. أي واحد يشبهك بشكل غير مريح؟",
      choices: [
        { id: "strong_blurred", label: "خطوط قوية، معالم ضبابية", icon: "🌫️" },
        { id: "blurred_sharp", label: "وجه ضبابي بالكامل، خلفية حادة", icon: "🎭" },
        { id: "shadow_light", label: "نصف في الظل، نصف في الضوء", icon: "🌓" },
        { id: "fragmented", label: "وجه مجزأ مثل الزجاج المكسور", icon: "💔" }
      ]
    },
    {
      id: 6,
      title: "ثقل على صدرك",
      subtitle: "إذا كان شعور صدرك صورة، أي واحدة تتطابق؟",
      choices: [
        { id: "stone", label: "حجر يضغط على شكل الصدر", icon: "🗿" },
        { id: "balloon", label: "بالون مربوط بالصدر يحاول الطيران للأعلى", icon: "🎈" },
        { id: "cracks", label: "صدر بشقوق وضوء يتسرب منها", icon: "✨" },
        { id: "rope", label: "صدر ملفوف بحبل متوهج", icon: "🪢" }
      ]
    },
    {
      id: 7,
      title: "اختر شبحك",
      subtitle: "واحد من هذه 'الأشباح' يتبعك لسنوات. أي واحد يشعر أنه يعرفك بالفعل؟",
      choices: [
        { id: "time", label: "شبح يحمل ساعة (وقت / ندم)", icon: "⏰" },
        { id: "love", label: "شبح يحمل قلباً مكسوراً (حب / ألم)", icon: "💔" },
        { id: "work", label: "شبح يحمل حاسوباً (عمل / ضغط)", icon: "💻" },
        { id: "mirror", label: "شبح يحمل مرآة (هوية / صورة الذات)", icon: "🪞" }
      ]
    },
    {
      id: 8,
      title: "خلل في الوقت",
      subtitle: "تحصل على ساعة لا تحتسب من يومك. ماذا تستخدمها سراً؟",
      choices: [
        { id: "sleep", label: "نوم، بدون تردد", icon: "😴" },
        { id: "future", label: "العمل على مستقبلك / مشروعك", icon: "🚀" },
        { id: "scroll", label: "تصفح أو لعب واختفاء", icon: "🎮" },
        { id: "someone", label: "أكون مع شخص، أتحدث أو أجلس معاً", icon: "👥" }
      ]
    },
    {
      id: 9,
      title: "الغرفة المخفية",
      subtitle: "تكتشف غرفة مغلقة تخصك وحدك. من تسمح له بالدخول؟",
      choices: [
        { id: "no_one", label: "لا أحد على الإطلاق", icon: "🚫" },
        { id: "one_person", label: "شخص محدد فقط", icon: "👤" },
        { id: "few_close", label: "عدد قليل من الأشخاص المقربين", icon: "👨‍👩‍👧‍👦" },
        { id: "anyone", label: "أي شخص يحتاج مكاناً", icon: "🌍" }
      ]
    },
    {
      id: 10,
      title: "أكمل الخلل",
      subtitle: "عقلك يكمل هذه الجملة تلقائياً. أي نسخة أقرب لصوتك الداخلي الحقيقي؟",
      choices: [
        { id: "strong_tired", label: "...قوياً، لكنهم لا يرون مدى تعبي", icon: "💪" },
        { id: "complicated", label: "...معقداً، ولست متأكداً أنني أختلف", icon: "🤔" },
        { id: "easygoing_mind", label: "...ودوداً، لكن عقلي لا يتوقف أبداً", icon: "😌" },
        { id: "quiet_notice", label: "...هادئاً، لكنني ألاحظ كل شيء", icon: "🧘" }
      ]
    },
    {
      id: 11,
      title: "مستوى الضوضاء",
      subtitle: "إذا كان عقلك اليوم صوتاً، فأي واحد هو؟",
      choices: [
        { id: "rain", label: "مطر لطيف", icon: "🌧️" },
        { id: "street", label: "شارع مزدحم وصافرات", icon: "🚗" },
        { id: "static", label: "ضوضاء ثابتة / تلفزيون", icon: "📺" },
        { id: "heartbeat", label: "شبه صامت، فقط نبضات قلب صغيرة", icon: "💓" }
      ]
    }
  ]
};

export default function HiddenPortalsModal({ isOpen, onClose, isAr, onComplete }) {
  const [currentPortal, setCurrentPortal] = useState(0);
  const [answers, setAnswers] = useState({});
  const [selectedChoice, setSelectedChoice] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [readinessRefreshKey, setReadinessRefreshKey] = useState(0);
  const [readiness, setReadiness] = useState(null);
  const [readinessLoading, setReadinessLoading] = useState(false);
  const [readinessError, setReadinessError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [resultData, setResultData] = useState(null);
  const [resultError, setResultError] = useState(null);

  const portals = PORTALS_DATA[isAr ? "ar" : "en"];
  const currentPortalData = portals[currentPortal];

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    const controller = new AbortController();

    const fetchReadiness = async () => {
      setReadinessLoading(true);
      setReadinessError(null);
      try {
        const token = localStorage.getItem(TOKEN_KEY);
        if (!token) throw new Error("No auth token");
        const res = await fetch(`${API_BASE}/api/portals/readiness`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("Failed readiness");
        const data = await res.json();
        if (!cancelled) setReadiness(data);
      } catch (err) {
        if (!cancelled) setReadinessError(isAr ? "تعذر فحص الجاهزية" : "Could not check readiness");
      } finally {
        if (!cancelled) setReadinessLoading(false);
      }
    };

    fetchReadiness();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [isOpen, isAr, readinessRefreshKey]);

  const handleChoiceSelect = (choiceId) => {
    setSelectedChoice(choiceId);
  };

  const handleNext = () => {
    if (selectedChoice === null) return;

    const newAnswers = { ...answers, [currentPortal]: selectedChoice };
    setAnswers(newAnswers);
    setSelectedChoice(null);

    if (currentPortal < portals.length - 1) {
      setCurrentPortal(currentPortal + 1);
    } else {
      setShowResult(true);
      submitResults(newAnswers);
    }
  };

  const handleBack = () => {
    if (currentPortal > 0) {
      setCurrentPortal(currentPortal - 1);
      setSelectedChoice(answers[currentPortal - 1] || null);
    }
  };

  const handleComplete = () => {
    if (onComplete) onComplete(answers);
    onClose();
  };

  const handleRestart = () => {
    setCurrentPortal(0);
    setAnswers({});
    setSelectedChoice(null);
    setShowResult(false);
    setResultData(null);
    setResultError(null);
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleReadinessRetry = () => {
    setReadinessRefreshKey((k) => k + 1);
  };

  const isReady = readiness?.ready;
  const progressValue =
    readiness && typeof readiness.readinessPercent === "number"
      ? Math.max(0, Math.min(100, readiness.readinessPercent)) / 100
      : readiness?.progress ?? 0;

  const renderProgressBar = (value) => (
    <div className="hidden-portals-progress-bar">
      <div
        className="hidden-portals-progress-fill"
        style={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }}
      />
    </div>
  );

  const renderNotReady = () => (
    <div className="portal-not-ready">
      <div className="portal-not-ready-icon-wrapper">
        <div className="portal-not-ready-icon">🌀</div>
      </div>
      <h3 className="portal-not-ready-title">
        {isAr ? "انعكاسك غير جاهز بعد" : "Your reflection isn't ready yet"}
      </h3>
      <p className="portal-not-ready-text">
        {isAr
          ? "أحتاج محادثات حقيقية أكثر معك قبل فتح البوابات الـ11."
          : "I need a few more real conversations with you before opening the 11 portals."}
      </p>
      <div className="portal-not-ready-progress-row">
        <span className="portal-not-ready-progress-label">
          {isAr
            ? `جاهزية ${Math.round(progressValue * 100)}%`
            : `Readiness ${Math.round(progressValue * 100)}%`}
        </span>
        <div className="portal-not-ready-progress-bar">
          <div
            className="portal-not-ready-progress-fill"
            style={{ width: `${Math.min(100, Math.max(0, progressValue * 100))}%` }}
          />
        </div>
      </div>
      {Array.isArray(readiness?.reasons) && readiness.reasons.length > 0 && (
        <div className="portal-not-ready-hints-container">
          <ul className="portal-not-ready-hints">
            {readiness.reasons.map((r) => (
              <li key={r}>
                {isAr
                  ? r === "NOT_ENOUGH_MESSAGES"
                    ? "تحدث أكثر معي وبإسهاب."
                    : r === "NOT_ENOUGH_DAYS"
                    ? "تحدث عبر أيام مختلفة (مش ليلة واحدة فقط)."
                    : r === "LOW_EMOTION_VARIETY"
                    ? "شارك لحظات ثقيلة ولحظات أمل حتى لا يبقى انعكاسك أحادي."
                    : r === "NOT_ENOUGH_FACTS"
                    ? "احكِ عن عملك، عائلتك، صداقاتك، وأهدافك."
                    : "شارك أكثر من تفاصيل حياتك اليومية."
                  : r === "NOT_ENOUGH_MESSAGES"
                  ? "Open up more with longer chats."
                  : r === "NOT_ENOUGH_DAYS"
                  ? "Chat across more days (not just one night)."
                  : r === "LOW_EMOTION_VARIETY"
                  ? "Share both heavy and hopeful moments so it’s not one-sided."
                  : r === "NOT_ENOUGH_FACTS"
                  ? "Talk about work, family, friendships, and goals."
                  : "Tell me more about the different sides of your life."}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="portal-not-ready-actions">
        <button
          type="button"
          className="portal-result-btn"
          onClick={onClose}
        >
          {isAr ? "العودة للمحادثة" : "Back to chat"}
        </button>
        <button
          type="button"
          className="portal-restart-btn"
          onClick={handleReadinessRetry}
        >
          {isAr ? "حاول مرة أخرى" : "Check again"}
        </button>
      </div>
    </div>
  );

  const renderResultTags = () => {
    if (!resultData?.traits) return null;
    const entries = Object.entries(resultData.traits)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
    if (!entries.length) return null;
    return (
      <div className="portal-result-tags">
        {entries.map(([trait, val]) => (
          <span key={trait} className="portal-result-tag">
            {trait.replace(/_/g, " ")} • {Math.round(val)}
          </span>
        ))}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="hidden-portals-overlay" onClick={handleBackdropClick}>
      <div 
        className="hidden-portals-modal"
        onClick={(e) => e.stopPropagation()}
        dir={isAr ? "rtl" : "ltr"}
      >
        {/* Header */}
        <div className="hidden-portals-header">
          {!isReady && !readinessLoading && !readinessError ? (
            <div className="hidden-portals-header-content centered">
              <h2 className="hidden-portals-title">
                {isAr ? "اختبار الـ 11 بوابة المخفية" : "11 Hidden Portals Test"}
              </h2>
              <div className="hidden-portals-subtitle">
                {isAr ? "فحص الانعكاس" : "Reflection Check"}
              </div>
            </div>
          ) : (
            <div className="hidden-portals-header-content">
              <h2 className="hidden-portals-title">
                {isAr ? "اختبار الـ 11 بوابة المخفية" : "11 Hidden Portals Test"}
              </h2>
              <div className="hidden-portals-progress">
                <div className="hidden-portals-progress-text">
                  {isAr 
                    ? `البوابة ${currentPortal + 1} / ${portals.length}`
                    : `Portal ${currentPortal + 1} / ${portals.length}`}
                </div>
                <div className="hidden-portals-progress-bar">
                  <div 
                    className="hidden-portals-progress-fill"
                    style={{ width: `${((currentPortal + 1) / portals.length) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          )}
          <button
            type="button"
            className="hidden-portals-close-btn"
            onClick={onClose}
            aria-label={isAr ? "إغلاق" : "Close"}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="hidden-portals-content">
          {readinessLoading ? (
            <div className="portal-loading">
              <div className="portal-loading-spinner" />
              <p className="portal-loading-text">
                {isAr ? "نفحص جاهزيتك..." : "Checking your readiness..."}
              </p>
            </div>
          ) : readinessError ? (
            <div className="portal-not-ready">
              <div className="portal-not-ready-icon">⚠️</div>
              <p className="portal-not-ready-text">{readinessError}</p>
              <div className="portal-not-ready-actions">
                <button
                  type="button"
                  className="portal-result-btn"
                  onClick={handleReadinessRetry}
                >
                  {isAr ? "حاول مرة أخرى" : "Try again"}
                </button>
                <button
                  type="button"
                  className="portal-restart-btn"
                  onClick={onClose}
                >
                  {isAr ? "إغلاق" : "Close"}
                </button>
              </div>
            </div>
          ) : !isReady ? (
            renderNotReady()
          ) : !showResult ? (
            <>
              {/* Portal Question */}
              <div className="portal-question">
                <h3 className="portal-title">{currentPortalData.title}</h3>
                <p className="portal-subtitle">{currentPortalData.subtitle}</p>
              </div>

              {/* Choice Cards */}
              <div className="portal-choices">
                {currentPortalData.choices.map((choice) => (
                  <div
                    key={choice.id}
                    className={`portal-choice-card ${
                      selectedChoice === choice.id ? "portal-choice-card--selected" : ""
                    }`}
                    onClick={() => handleChoiceSelect(choice.id)}
                  >
                    <div className="portal-choice-icon">{choice.icon}</div>
                    <div className="portal-choice-label">{choice.label}</div>
                  </div>
                ))}
              </div>

              {/* Navigation */}
              <div className="portal-navigation">
                <div className="portal-nav-left">
                  {currentPortal > 0 && (
                    <button
                      type="button"
                      className="portal-back-btn"
                      onClick={handleBack}
                    >
                      {isAr ? "السابق" : "Back"}
                    </button>
                  )}
                </div>
                <div className="portal-nav-center">
                  <p className="portal-exit-hint">
                    {isAr 
                      ? "إجاباتك تساعد في كشف جوانب خفية من شخصيتك."
                      : "Your answers help uncover hidden aspects of your personality."}
                  </p>
                </div>
                <div className="portal-nav-right">
                  <button
                    type="button"
                    className="portal-next-btn"
                    onClick={handleNext}
                    disabled={selectedChoice === null}
                  >
                    {isAr 
                      ? (currentPortal < portals.length - 1 ? "التالي" : "إنهاء")
                      : (currentPortal < portals.length - 1 ? "Next" : "Finish")
                    }
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="portal-result">
              <div className="portal-result-icon">🔮</div>
              <h3 className="portal-result-title">
                {isAr ? "انعكاسك المخفي" : "Your Hidden Reflection"}
              </h3>
              {submitting && (
                <div className="portal-loading">
                  <div className="portal-loading-spinner" />
                  <p className="portal-loading-text">
                    {isAr ? "نمزج إجاباتك مع ذكرياتك..." : "Blending your answers with your memories..."}
                  </p>
                </div>
              )}
              {resultError && (
                <p className="portal-result-error">{resultError}</p>
              )}
              {resultData && !submitting && (
                <>
                  <p className="portal-result-subtitle">
                    {isAr ? resultData.summaryAr : resultData.summaryEn}
                  </p>
                  {renderResultTags()}
                  <p className="portal-result-note">
                    {isAr ? "هذا انعكاس وليس تشخيصاً." : "This is a reflection, not a diagnosis."}
                  </p>
                </>
              )}
              <div className="portal-result-actions">
                <button
                  type="button"
                  className="portal-result-btn"
                  onClick={handleComplete}
                  disabled={submitting}
                >
                  {isAr ? "العودة إلى الجانب الخفي" : "Return to Hidden Side"}
                </button>
                <button
                  type="button"
                  className="portal-restart-btn"
                  onClick={handleRestart}
                  disabled={submitting}
                >
                  {isAr ? "إعادة الاختبار" : "Retake Test"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
