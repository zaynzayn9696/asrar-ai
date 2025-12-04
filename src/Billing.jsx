// src/Billing.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Billing.css";
import AsrarHeader from "./AsrarHeader";
import AsrarFooter from "./AsrarFooter";
import { useAuth } from "./hooks/useAuth";
import { createCheckoutSession, getSubscriptionDetails, cancelSubscriptionAtPeriodEnd } from "./api/billing";

// --- LANGUAGE ----------------------------------------------------
const getInitialLang = () => {
  if (typeof window !== "undefined") {
    return localStorage.getItem("asrar-lang") || "ar";
  }
  return "ar";
};

const BILLING_TEXT = {
  en: {
    eyebrow: "Billing",
    title: "Subscription & Billing",
    subtitle: "Manage your plan, usage, and payment details for Asrar AI.",
    planTitle: "Your plan",
    currentPlanLabel: "Current plan",
    planNameFree: "Free",
    planPrice: "$0",
    perMonth: "/ month",
    planTagline: "Perfect for trying Asrar AI with limited usage.",
    feature1: "Daily mood check-ins",
    feature2: "Access to all 5 companions",
    feature3: "Basic privacy & encryption",
    feature4: "No credit card required",
    upgradeCta: "Upgrade to Pro (soon)",
    usageTitle: "Usage & invoices",
    usageThisMonth: "Usage this month",
    usageAmount: "$0.00",
    usageNote: "Billing will be enabled once the paid plans go live.",
    paymentMethodTitle: "Payment method",
    paymentMethodNone: "No payment method on file.",
    addPaymentMethod: "Add payment method (soon)",
    invoicesTitle: "Invoices",
    invoicesEmpty: "You don’t have any invoices yet.",
  },
  ar: {
    eyebrow: "الفوترة",
    title: "الاشتراك والفوترة",
    subtitle: "إدارة خطتك، واستخدامك، وبيانات الدفع في أسرار AI.",
    planTitle: "خطتك الحالية",
    currentPlanLabel: "الخطة الحالية",
    planNameFree: "مجانية",
    planPrice: "$0",
    perMonth: "/ شهرياً",
    planTagline: "مثالية لتجربة أسرار AI مع استخدام محدود.",
    feature1: "فحص المزاج اليومي",
    feature2: "الوصول إلى جميع الرفقاء الخمسة",
    feature3: "خصوصية أساسية وتشفير",
    feature4: "لا حاجة لبطاقة بنكية",
    upgradeCta: "الترقية إلى برو (قريباً)",
    usageTitle: "الاستخدام والفواتير",
    usageThisMonth: "استخدام هذا الشهر",
    usageAmount: "$0.00",
    usageNote: "سيتم تفعيل الفوترة عند إطلاق الخطط المدفوعة.",
    paymentMethodTitle: "طريقة الدفع",
    paymentMethodNone: "لا يوجد وسيلة دفع مضافة حالياً.",
    addPaymentMethod: "إضافة وسيلة دفع (قريباً)",
    invoicesTitle: "الفواتير",
    invoicesEmpty: "لا توجد أي فواتير حتى الآن.",
  },
};

export default function Billing() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [lang, setLang] = useState(getInitialLang);
  const isAr = lang === "ar";
  const t = BILLING_TEXT[isAr ? "ar" : "en"];

  const plan = user?.plan || "free";
  const usage = user?.usage || null;
  const isPremium = !!(user && (user.isPremium || plan === "premium" || plan === "pro"));
  const planName = isAr ? (isPremium ? "بريميوم" : "مجانية") : (isPremium ? "Premium" : "Free");
  const planPrice = isPremium ? "$9.85" : "$0";
  const planTagline = isAr
    ? isPremium
      ? "كل شيء في أسرار بحدود سخية."
      : "جرّب أسرار بإمكانيات أساسية."
    : isPremium
    ? "Everything in Asrar with generous limits."
    : "Try Asrar with core features.";
  const planFeatures = isAr
    ? isPremium
      ? [
          "كل رفاق أسرار الخمسة",
          "٣٠٠٠ رسالة شهرياً",
          "ذاكرة محادثة ودعم ذو أولوية",
          "بدون إعلانات ووصول مبكر",
          "إلغاء الاشتراك في أي وقت",
        ]
      : ["شخصية أساسية واحدة", "٥ رسائل يومياً", "دعم أساسي"]
    : isPremium
    ? [
        "All 5 Asrar characters",
        "3,000 messages per month",
        "Chat memory & priority support",
        "Ad‑free, priority access",
        "Cancel anytime",
      ]
    : ["1 core character", "5 messages/day", "Basic support"];
  const upgradeCtaText = isPremium
    ? (isAr ? "أنت على بريميوم" : "You’re on Premium")
    : (isAr ? "الترقية إلى بريميوم — $9.85 شهرياً" : "Upgrade to Premium — $4.99/month");

  const handleLangSwitch = (newLang) => {
    setLang(newLang);
    if (typeof window !== "undefined") {
      localStorage.setItem("asrar-lang", newLang);
    }
  };

  // --- SUBSCRIPTION DETAILS (renewal date) ---
  const [subscription, setSubscription] = useState(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const sub = await getSubscriptionDetails();
        if (mounted) setSubscription(sub);
      } catch (_) {}
    })();
    return () => { mounted = false; };
  }, [user]);

  const nextRenewalText = React.useMemo(() => {
    if (!subscription || !subscription.nextRenewal) return null;
    const d = new Date(subscription.nextRenewal);
    const opts = { year: 'numeric', month: 'long', day: 'numeric' };
    const dateStr = d.toLocaleDateString(isAr ? 'ar' : undefined, opts);
    if (subscription.cancelled) {
      return isAr ? `سينتهي اشتراكك في ${dateStr}` : `Your subscription will end on ${dateStr}`;
    }
    return isAr ? `التجديد القادم: ${dateStr}` : `Next renewal: ${dateStr}`;
  }, [subscription, isAr]);

  const openCancelModal = () => { setCancelError(""); setShowCancelModal(true); };
  const closeCancelModal = () => { if (!isCancelling) setShowCancelModal(false); };
  const confirmCancel = async () => {
    try {
      setCancelError("");
      setIsCancelling(true);
      const res = await cancelSubscriptionAtPeriodEnd();
      setSubscription(res);
      setShowCancelModal(false);
    } catch (err) {
      setCancelError(err?.message || (isAr ? "تعذّر إلغاء الاشتراك" : "Failed to cancel subscription"));
    } finally {
      setIsCancelling(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const handleUpgradeClick = async () => {
    if (!user) {
      navigate("/login?next=/billing");
      return;
    }

    // Detect if mobile device
    const isMobile = /iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    if (isMobile) {
      // Mobile: redirect in same tab to avoid popup blockers
      try {
        const { url } = await createCheckoutSession();
        if (url) {
          window.location.href = url;
        } else {
          alert(isAr ? "حدث خطأ عند بدء عملية الدفع." : "Could not start checkout. Please try again.");
        }
      } catch (err) {
        console.error("[Billing] Upgrade error", err);
        const status = err?.status || err?.response?.status;
        if (status === 401) {
          navigate("/login?next=/billing");
        } else {
          alert(isAr ? "تعذر إنشاء عملية الدفع حالياً." : "Payment could not be started. Please try again.");
        }
      }
    } else {
      // Desktop: open in new tab
      const newTab = window.open("about:blank", "_blank");

      if (!newTab) {
        // Popup was blocked - show message, do NOT redirect
        alert(
          isAr
            ? "يرجى السماح بالنوافذ المنبثقة لموقع Asrar AI لفتح صفحة الدفع."
            : "Please allow pop-ups for Asrar AI to open the payment page."
        );
        return;
      }

      // Show loading message in new tab
      try {
        newTab.document.write('<html><body style="margin:0;padding:40px;font-family:system-ui,-apple-system,sans-serif;background:#0a0f1a;color:#eaf6ff;text-align:center;"><h2>Loading checkout...</h2><p>Please wait while we prepare your payment page.</p></body></html>');
      } catch (e) {
        // Ignore if we can't write to the tab
      }

      try {
        const { url } = await createCheckoutSession();
        if (url) {
          newTab.location.href = url;
        } else {
          newTab.close();
          alert(isAr ? "حدث خطأ عند بدء عملية الدفع." : "Could not start checkout. Please try again.");
        }
      } catch (err) {
        console.error("[Billing] Upgrade error", err);
        newTab.close();

        const status = err?.status || err?.response?.status;
        if (status === 401) {
          navigate("/login?next=/billing");
        } else {
          alert(isAr ? "تعذر إنشاء عملية الدفع حالياً." : "Payment could not be started. Please try again.");
        }
      }
    }
  };

  const handleAddPaymentMethod = () => {
    alert(
      isAr
        ? "إضافة وسيلة الدفع سيتم تفعيلها لاحقاً."
        : "Adding a payment method will be enabled later."
    );
  };

  return (
    <div
      className={`asrar-dash-page asrar-dashboard-page asrar-billing-page ${
        isAr ? "asrar-dash-page--ar" : ""
      }`}
    >
      {/* background glows */}
      <div className="asrar-dash-orbit asrar-dash-orbit--top" />
      <div className="asrar-dash-orbit asrar-dash-orbit--bottom" />

      {/* HEADER */}
      <AsrarHeader
        lang={lang}
        isAr={isAr}
        onLangChange={handleLangSwitch}
        onLogout={handleLogout}
      />

      {/* MAIN BILLING CONTENT */
      }
      <main className="asrar-dash-main asrar-billing-main">
        <section
          className="asrar-dash-panel asrar-billing-panel"
          dir={isAr ? "rtl" : "ltr"}
        >
          <p className="asrar-dash-eyebrow">{t.eyebrow}</p>
          <h1 className="asrar-dash-title">{t.title}</h1>
          <p className="asrar-dash-subtitle">{t.subtitle}</p>

          <div className="asrar-billing-grid">
            {/* PLAN CARD */}
            <div className="asrar-billing-card asrar-billing-card--plan">
              <h2 className="asrar-billing-card-title">
                {t.planTitle}
              </h2>

              <div className="asrar-billing-plan-chip-row">
                <span className="asrar-billing-plan-chip-label">
                  {t.currentPlanLabel}
                </span>
                <span className="asrar-billing-plan-chip-name">{planName}</span>
              </div>

              <div className="asrar-billing-price-row">
                <span className="asrar-billing-price">{planPrice}</span>
                <span className="asrar-billing-price-suffix">
                  {t.perMonth}
                </span>
              </div>

              <p className="asrar-billing-plan-tagline">{planTagline}</p>

              <ul className="asrar-billing-feature-list">
                {planFeatures.map((f, idx) => (
                  <li key={idx}>{f}</li>
                ))}
              </ul>

              <button
                type="button"
                className="asrar-billing-upgrade-btn"
                onClick={handleUpgradeClick}
                disabled={isPremium}
              >
                {upgradeCtaText}
              </button>

              {isPremium && !subscription?.cancelled && (
                <div style={{ marginTop: '0.6rem' }}>
                  <button
                    type="button"
                    className="asrar-billing-add-card-btn"
                    onClick={openCancelModal}
                  >
                    {isAr ? "إلغاء الاشتراك" : "Cancel subscription"}
                  </button>
                </div>
              )}

              {isPremium && subscription?.cancelled && nextRenewalText && (
                <p className="asrar-billing-usage-note" style={{ marginTop: '0.6rem' }}>{nextRenewalText}</p>
              )}
            </div>

            {/* USAGE / PAYMENT CARD */}
            <div className="asrar-billing-card asrar-billing-card--usage">
              <h2 className="asrar-billing-card-title">
                {t.usageTitle}
              </h2>

              <div className="asrar-billing-usage-block">
                <div className="asrar-billing-usage-label">
                  {t.usageThisMonth}
                </div>
                <div className="asrar-billing-usage-amount">
                  {t.usageAmount}
                </div>
                <div className="asrar-billing-usage-lines">
                  <div>
                    {isAr
                      ? `هذا الشهر: ${usage && usage.monthlyLimit ? `${usage.monthlyUsed} / ${usage.monthlyLimit}` : "—"}`
                      : `This month: ${usage && usage.monthlyLimit ? `${usage.monthlyUsed} / ${usage.monthlyLimit}` : "—"}`}
                  </div>
                  {isPremium && nextRenewalText && (
                    <div>{nextRenewalText}</div>
                  )}
              </div>
                <p className="asrar-billing-usage-note">
                  {t.usageNote}
                </p>
              </div>

              <div className="asrar-billing-divider" />

              <div className="asrar-billing-payment-block">
                <div className="asrar-billing-payment-header">
                  <span className="asrar-billing-payment-title">
                    {t.paymentMethodTitle}
                  </span>
                </div>
                <p className="asrar-billing-payment-empty">
                  {t.paymentMethodNone}
                </p>
                <button
                  type="button"
                  className="asrar-billing-add-card-btn"
                  onClick={handleAddPaymentMethod}
                >
                  {t.addPaymentMethod}
                </button>
              </div>

              <div className="asrar-billing-divider" />

              <div className="asrar-billing-invoices-block">
                <div className="asrar-billing-invoices-title">
                  {t.invoicesTitle}
                </div>
                <p className="asrar-billing-invoices-empty">
                  {t.invoicesEmpty}
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {showCancelModal && (
        <div className="asrar-modal-backdrop">
          <div className="asrar-modal">
            <div className="asrar-modal-body">
              <h3 style={{ marginTop: 0, marginBottom: '0.5rem' }}>
                {isAr ? 'إلغاء الاشتراك؟' : 'Cancel subscription?'}
              </h3>
              <p style={{ margin: 0 }}>
                {isAr
                  ? 'إذا ألغيت، ستستمر بالوصول حتى نهاية الفترة الحالية. بعدها ستعود خطتك إلى المجانية.'
                  : 'If you cancel, you’ll keep access until the end of the current billing period. After that, your account will revert to the free plan.'}
              </p>
              {cancelError && (
                <p className="asrar-billing-usage-note" style={{ color: '#ff9aa2', marginTop: '0.6rem' }}>{cancelError}</p>
              )}
            </div>
            <div className="asrar-modal-actions">
              <button className="asrar-btn ghost" onClick={closeCancelModal} disabled={isCancelling}>
                {isAr ? 'الرجوع' : 'Keep my subscription'}
              </button>
              <button className="asrar-btn primary" onClick={confirmCancel} disabled={isCancelling}>
                {isCancelling ? (isAr ? 'جارٍ الإلغاء…' : 'Cancelling…') : (isAr ? 'نعم، الإلغاء عند التجديد' : 'Yes, cancel at renewal')}
              </button>
            </div>
          </div>
        </div>
      )}

      <AsrarFooter />
    </div>
  );
}
