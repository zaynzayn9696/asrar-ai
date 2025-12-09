// src/components/HomeSplash.jsx
import React from "react";

export default function HomeSplash() {
  return (
    <div className="asrar-home-splash" aria-label="Loading Asrar AI">
      <div className="asrar-home-splash-inner">
        <div className="asrar-home-logo">ASRAR AI</div>
        <div className="asrar-home-loader">
          <div className="asrar-home-loader-track">
            <div className="asrar-home-loader-pulse" />
          </div>
          <div className="asrar-home-loader-echo" />
        </div>
      </div>
    </div>
  );
}
