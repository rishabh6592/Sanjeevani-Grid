import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// ==========================================
// PWA INSTALL HANDLER
// ==========================================

window.deferredInstallPrompt = null;

window.addEventListener("beforeinstallprompt", (event) => {
  console.log("🔥 beforeinstallprompt FIRED");

  event.preventDefault();

  window.deferredInstallPrompt = event;

  console.log("✅ PWA install prompt saved");

  window.dispatchEvent(
    new Event("pwa-install-available")
  );
});

window.addEventListener("appinstalled", () => {
  console.log("✅ SanjeevaniGrid installed");

  window.deferredInstallPrompt = null;

  window.dispatchEvent(
    new Event("pwa-installed")
  );
});

// ==========================================
// APP
// ==========================================

ReactDOM.createRoot(
  document.getElementById("root")
).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);