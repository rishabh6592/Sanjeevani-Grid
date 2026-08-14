import React, { useEffect, useState } from "react";

export default function InstallApp() {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [showPopup, setShowPopup] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    console.log("🔥 InstallApp mounted");

    // Check if already installed
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;

    if (isStandalone) {
      console.log("✅ App already installed");
      setInstalled(true);
      return;
    }

    // Check existing prompt
    if (window.deferredInstallPrompt) {
      console.log("✅ Existing install prompt found");

      setInstallPrompt(window.deferredInstallPrompt);
      setShowPopup(true);
    } else {
      console.log("⚠️ No install prompt yet");

      // IMPORTANT:
      // Show OUR popup anyway.
      setTimeout(() => {
        console.log("🔥 Showing install popup");

        setShowPopup(true);
      }, 1000);
    }

    // Native Chrome install event
    const handleInstallAvailable = (event) => {
      console.log("🔥 beforeinstallprompt FIRED");

      event.preventDefault();

      window.deferredInstallPrompt = event;

      setInstallPrompt(event);
      setShowPopup(true);
    };

    // App installed
    const handleAppInstalled = () => {
      console.log("✅ SanjeevaniGrid installed");

      window.deferredInstallPrompt = null;

      setInstallPrompt(null);
      setShowPopup(false);
      setInstalled(true);
    };

    window.addEventListener(
      "beforeinstallprompt",
      handleInstallAvailable
    );

    window.addEventListener(
      "appinstalled",
      handleAppInstalled
    );

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleInstallAvailable
      );

      window.removeEventListener(
        "appinstalled",
        handleAppInstalled
      );
    };
  }, []);

  const handleInstall = async () => {
    console.log("🔥 Install App clicked");

    const promptEvent =
      installPrompt ||
      window.deferredInstallPrompt;

    // Native Chrome prompt available
    if (promptEvent) {
      try {
        console.log("🔥 Opening native install prompt");

        await promptEvent.prompt();

        const result =
          await promptEvent.userChoice;

        console.log(
          "🔥 Install choice:",
          result.outcome
        );

        window.deferredInstallPrompt = null;

        setInstallPrompt(null);
        setShowPopup(false);

        return;
      } catch (error) {
        console.error(
          "❌ Native install error:",
          error
        );
      }
    }

    // Native prompt unavailable
    console.log(
      "⚠️ Native install prompt unavailable"
    );

    alert(
      "The Chrome install option is not currently available. Install the app by clicking the install icon on the right side of the address bar.."
    );
  };

  const handleNotNow = () => {
    console.log("Install popup dismissed");

    setShowPopup(false);
  };

  if (installed || !showPopup) {
    return null;
  }

  return (
    <div className="install-overlay">
      <div className="install-popup">

        <img
          src="/icon-192.png"
          alt="SanjeevaniGrid"
          className="install-icon"
/>

        <h2>
          Install SanjeevaniGrid
        </h2>

        <p>
          Install our app for faster and easier access.
        </p>

        <button onClick={handleInstall}>
          Install App
        </button>

        <button
          className="not-now"
          onClick={handleNotNow}
        >
          Not Now
        </button>

      </div>
    </div>
  );
}