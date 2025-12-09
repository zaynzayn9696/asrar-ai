// src/components/SplashScreen.jsx
import React from "react";
import asrarLogo from "../assets/asrar-logo.png";

export default function SplashScreen() {
  return (
    <div className="asrar-splash" aria-label="Loading Asrar AI">
      <div className="asrar-splash-orbit" aria-hidden="true" />
      <div className="asrar-splash-core">
        <img
          src={asrarLogo}
          alt="Asrar AI logo"
          className="asrar-splash-logo"
        />
        <div className="asrar-splash-tagline">Asrar AI</div>
      </div>
    </div>
  );
}
