// src/components/SplashScreen.jsx
import React from "react";

export default function SplashScreen() {
  return (
    <div className="asrar-splash" aria-label="Loading Asrar AI">
      <div className="asrar-splash-orbit" aria-hidden="true" />
      <div className="asrar-splash-core">
        <div className="asrar-splash-tagline">Asrar AI</div>
      </div>
    </div>
  );
}
