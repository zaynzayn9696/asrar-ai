import React, { useState, useEffect, useRef } from "react";

export default function CharacterCarousel({
  characters,
  selectedCharacterId,
  onChange,
  isAr = false,
  variant = "home",
  isFreePlan = false,
}) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!characters || characters.length === 0) return;
    const newIndex = characters.findIndex((c) => c.id === selectedCharacterId);
    if (newIndex >= 0) {
      setIndex(newIndex);
    }
  }, [characters, selectedCharacterId]);

  if (!characters || characters.length === 0) {
    return null;
  }

  const length = characters.length;

  // Touch swipe support for mobile (thumb slide)
  const touchStartXRef = useRef(null);
  const touchDeltaXRef = useRef(0);

  const goToIndex = (nextIndex) => {
    const wrapped = (nextIndex + length) % length;
    setIndex(wrapped);
    if (onChange) {
      onChange(characters[wrapped]);
    }
  };

  const handleNext = () => {
    goToIndex(index + 1);
  };

  const handlePrev = () => {
    goToIndex(index - 1);
  };

  const handleTouchStart = (event) => {
    if (!event.touches || event.touches.length !== 1) return;
    const touch = event.touches[0];
    touchStartXRef.current = touch.clientX;
    touchDeltaXRef.current = 0;
  };

  const handleTouchMove = (event) => {
    if (touchStartXRef.current == null || !event.touches) return;
    const touch = event.touches[0];
    touchDeltaXRef.current = touch.clientX - touchStartXRef.current;
  };

  const handleTouchEnd = () => {
    const deltaX = touchDeltaXRef.current;
    touchStartXRef.current = null;
    touchDeltaXRef.current = 0;

    const threshold = 40;
    if (Math.abs(deltaX) < threshold) return;

    if (deltaX < 0) {
      handleNext();
    } else {
      handlePrev();
    }
  };

  const renderHomeCard = (character, isActive, i) => (
    <div
      className={
        "asrar-character-card" +
        (isActive ? " asrar-character-card--active" : "")
      }
      onClick={() => goToIndex(i)}
    >
      <img
        className="asrar-character-portrait"
        src={character.avatar}
        alt={`${character.nameEn} avatar`}
      />
      <h3>{isAr ? character.nameAr : character.nameEn}</h3>
      <p className="role">{isAr ? character.roleAr : character.roleEn}</p>
      {character.descriptionEn && character.descriptionAr && (
        <p className="desc">
          {isAr ? character.descriptionAr : character.descriptionEn}
        </p>
      )}
    </div>
  );

  const renderDashboardCard = (character, isActive) => {
    const isLocked = isFreePlan && character.id !== "hana";
    const cardClasses =
      "asrar-dash-char-card" +
      (isActive ? " asrar-dash-char-card--selected" : "") +
      (isLocked ? " asrar-dash-char-card--locked" : "");

    return (
      <button
        type="button"
        className={cardClasses}
        onClick={() => onChange && onChange(character)}
      >
        <div className="asrar-dash-char-avatar-wrap">
          <img
            src={character.avatar}
            alt={isAr ? character.nameAr : character.nameEn}
            className="asrar-dash-char-avatar"
          />
        </div>
        <div className="asrar-dash-char-text">
          <div className="asrar-dash-char-name">
            {isAr ? character.nameAr : character.nameEn}
          </div>
          <div className="asrar-dash-char-role">
            {isAr ? character.roleAr : character.roleEn}
          </div>
        </div>
        {isLocked && (
          <div className="asrar-pro-badge" aria-hidden>
            Pro
          </div>
        )}
      </button>
    );
  };

  const renderCard = (character, i) => {
    const isActive = character.id === selectedCharacterId;
    if (variant === "dashboard") {
      return renderDashboardCard(character, isActive);
    }
    return renderHomeCard(character, isActive, i);
  };

  return (
    <div className="asrar-character-slider">
      <button
        type="button"
        className="asrar-character-arrow asrar-character-arrow--left"
        aria-label={isAr ? "الشخصية السابقة" : "Previous character"}
        onClick={handlePrev}
      >
        {"<"}
      </button>
      <div className="asrar-character-slider-viewport">
        <div
          className="asrar-character-track"
          style={{ transform: `translateX(-${index * 100}%)` }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {characters.map((character, i) => (
            <div className="asrar-character-slide" key={character.id}>
              {renderCard(character, i)}
            </div>
          ))}
        </div>
      </div>
      <button
        type="button"
        className="asrar-character-arrow asrar-character-arrow--right"
        aria-label={isAr ? "الشخصية التالية" : "Next character"}
        onClick={handleNext}
      >
        {">"}
      </button>
      <div className="asrar-character-dots">
        {characters.map((character, i) => {
          const isActive = i === index;
          return (
            <button
              key={character.id}
              type="button"
              className={
                "asrar-character-dot" +
                (isActive ? " asrar-character-dot--active" : "")
              }
              aria-label={
                isAr
                  ? `اختر ${character.nameAr}`
                  : `Select ${character.nameEn}`
              }
              onClick={() => goToIndex(i)}
            />
          );
        })}
      </div>
    </div>
  );
}
