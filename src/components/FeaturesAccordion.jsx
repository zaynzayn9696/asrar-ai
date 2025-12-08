import React, { useState, useEffect, useRef } from 'react';
import '../HomePage.css';

// Add the animation styles
const accordionStyles = `
  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(6px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  .asrar-accordion-item {
    transition: all 0.3s cubic-bezier(0.25, 0.1, 0.25, 1);
    will-change: transform, box-shadow;
  }
  
  .asrar-accordion-item.active {
    transform: scale(1);
    box-shadow: 0 0 15px rgba(44, 246, 255, 0.2);
  }
  
  .asrar-accordion-item:not(.active) {
    transform: scale(0.99);
  }
  
  .asrar-accordion-panel {
    animation: fadeInUp 0.3s cubic-bezier(0.25, 0.1, 0.25, 1) forwards;
  }
  
  .asrar-accordion-content {
    will-change: opacity, transform;
  }
`;

const FeaturesAccordion = ({ isAr }) => {
  const [activeIndex, setActiveIndex] = useState(-1);
  const itemRefs = useRef([]);
  
  // Add the styles to the document head
  useEffect(() => {
    const styleElement = document.createElement('style');
    styleElement.textContent = accordionStyles;
    document.head.appendChild(styleElement);
    
    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);
  
  // Handle micro-interaction on active item
  useEffect(() => {
    if (activeIndex !== null && itemRefs.current[activeIndex]) {
      const item = itemRefs.current[activeIndex];
      item.style.transform = 'scale(1.015)';
      setTimeout(() => {
        item.style.transform = 'scale(1)';
      }, 80);
    }
  }, [activeIndex]);

  const features = [
    {
      id: 'emotional-engine',
      titleEn: 'Asrar Emotional Engine™',
      titleAr: 'محرك أسرار العاطفي™',
      descriptionEn: 'Asrar\'s proprietary emotional engine analyzes tone, patterns, and emotional states over time. It adapts to you, evolves with you, and creates deeply human-like conversations grounded in psychological realism.',
      descriptionAr: 'المحرّك العاطفي المتطور من أسرار يفهم نبرة حديثك، مشاعرك، وعاداتك مع الوقت. يتطور معك ويمنحك حوارات عميقة تشبه الإنسان بشكل مذهل.'
    },
    {
      id: 'emotional-journey',
      titleEn: 'Emotional Journey™',
      titleAr: 'الرحلة العاطفية™',
      descriptionEn: 'Your companion tracks emotional growth, patterns, challenges, and victories. It guides you through a personalized journey designed to help you understand yourself better every day.',
      descriptionAr: 'يرافقك رفيقك في رحلة شخصية لفهم مشاعرك، نمط حياتك، لحظات قوتك، وتحدياتك اليومية.'
    },
    {
      id: 'mirror-me',
      titleEn: 'Mirror Me™',
      titleAr: 'مرآتي™',
      descriptionEn: 'A private reflective mode that helps you see your habits, emotions, and blind spots. Your companion becomes a mirror—showing you insights about yourself with clarity and care.',
      descriptionAr: 'وضع خاص يساعدك على رؤية نفسك بوضوح أكبر. يكشف لك أنماطك العاطفية وسلوكياتك بطريقة لطيفة ودقيقة.'
    },
    {
      id: 'hidden-side',
      titleEn: 'Hidden Side™',
      titleAr: 'الجانب الخفي™',
      descriptionEn: 'A private space inside Asrar where your deeper thoughts, unfiltered emotions, and personal reflections are captured for you alone. Hidden Side analyzes your emotional patterns quietly in the background, helping you discover what\'s beneath the surface without sharing anything publicly. It\'s where your companion observes your inner world and gently reveals insights when you\'re ready.',
      descriptionAr: 'مساحة خاصة داخل أسرار تحتفظ فيها بأفكارك العميقة ومشاعرك الحقيقية دون أي قيود. يقوم الجانب الخفي بتحليل أنماطك العاطفية بهدوء، ليكشف لك ما يجري داخلك عندما تكون مستعدًا لذلك. هنا يتعرف عليك رفيقك على مستوى أعمق — دون مشاركة أي شيء مع أي طرف آخر.'
    }
  ];

  const toggleAccordion = (index) => {
    if (activeIndex === index) {
      // Closing animation
      const item = itemRefs.current[index];
      if (item) {
        item.style.transform = 'scale(0.99)';
        item.style.boxShadow = 'none';
      }
      setActiveIndex(-1);
    } else {
      // Opening animation
      if (activeIndex !== -1 && itemRefs.current[activeIndex]) {
        const prevItem = itemRefs.current[activeIndex];
        prevItem.style.transform = 'scale(0.99)';
        prevItem.style.boxShadow = 'none';
      }
      setActiveIndex(index);
    }
  };

  return (
    <section id="features" className="asrar-section asrar-section--features">
      <div className="asrar-container" style={{ maxWidth: '800px', margin: '0 auto' }}>
        <div className="asrar-section-header" style={{ textAlign: 'center', marginBottom: '40px' }}>
          <h2 className="asrar-section-title">
            {isAr ? 'لماذا أسرار؟' : 'Why Asrar?'}
          </h2>
          <p className="asrar-section-subtitle">
            {isAr 
              ? 'اكتشف القوة الكامنة وراء تجربة أسرار الفريدة' 
              : 'Discover what makes Asrar truly special'}
          </p>
        </div>
        
        <div className="asrar-accordion" style={{ maxWidth: '700px', margin: '0 auto' }}>
          {features.map((feature, index) => (
            <div 
              key={feature.id}
              ref={el => itemRefs.current[index] = el}
              className={`asrar-accordion-item ${activeIndex === index ? 'active' : ''}`}
              dir={isAr ? 'rtl' : 'ltr'}
              style={{ 
                textAlign: 'center',
                transition: 'all 0.3s cubic-bezier(0.25, 0.1, 0.25, 1)',
                transform: activeIndex === index ? 'scale(1)' : 'scale(0.99)',
                boxShadow: activeIndex === index ? '0 0 15px rgba(44, 246, 255, 0.2)' : 'none'
              }}
            >
              <button
                className="asrar-accordion-header"
                onClick={() => toggleAccordion(index)}
                aria-expanded={activeIndex === index}
                aria-controls={`${feature.id}-panel`}
                id={`${feature.id}-button`}
                style={{ 
                  margin: '0 auto',
                  display: 'block',
                  textAlign: 'center',
                  width: '100%',
                  maxWidth: '600px'
                }}
              >
                <span className="asrar-accordion-title" style={{ textAlign: 'center' }}>
                  {isAr ? feature.titleAr : feature.titleEn}
                </span>
                <span className="asrar-accordion-icon">
                  {activeIndex === index ? '−' : '+'}
                </span>
              </button>
              <div
                id={`${feature.id}-panel`}
                className="asrar-accordion-panel"
                role="region"
                aria-labelledby={`${feature.id}-button`}
                hidden={activeIndex !== index}
                style={{
                  maxHeight: activeIndex === index ? '500px' : '0',
                  opacity: activeIndex === index ? '1' : '0',
                  transform: activeIndex === index ? 'translateY(0)' : 'translateY(6px)',
                  transition: 'all 0.35s cubic-bezier(0.25, 0.1, 0.25, 1)',
                  overflow: 'hidden',
                  textAlign: 'center',
                  margin: '0 auto',
                  maxWidth: '600px',
                  willChange: 'max-height, opacity, transform',
                  transformOrigin: 'top center'
                }}
              >
                <div 
                  className="asrar-accordion-content" 
                  style={{ 
                    textAlign: 'center', 
                    padding: '0 20px 30px',
                    opacity: activeIndex === index ? 1 : 0,
                    transform: activeIndex === index ? 'translateY(0)' : 'translateY(10px)',
                    transition: 'opacity 0.3s ease, transform 0.35s cubic-bezier(0.25, 0.1, 0.25, 1)',
                    transitionDelay: activeIndex === index ? '0.1s' : '0s'
                  }}
                >
                  <p style={{ 
                    textAlign: 'center', 
                    margin: '0 auto', 
                    maxWidth: '600px',
                    paddingBottom: '20px'
                  }}>
                    {isAr ? feature.descriptionAr : feature.descriptionEn}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesAccordion;
