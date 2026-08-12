import { useEffect, useState } from "react";

export default function InstallApp() {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [showPopup, setShowPopup] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();

      setInstallPrompt(event);

      // Website open hone ke 1.5 second baad popup
      setTimeout(() => {
        setShowPopup(true);
      }, 1500);
    };

    window.addEventListener(
      "beforeinstallprompt",
      handleBeforeInstallPrompt
    );

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );
    };
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;

    installPrompt.prompt();

    const { outcome } = await installPrompt.userChoice;

    if (outcome === "accepted") {
      console.log("SanjeevaniGrid installed");
    }

    setInstallPrompt(null);
    setShowPopup(false);
  };

  if (!showPopup) return null;

  return (
    <div className="install-overlay">
      <div className="install-popup">

        <img
          src="/icon-192.png"
          alt="SanjeevaniGrid"
          className="install-icon"
        />

        <h2>Install SanjeevaniGrid</h2>

        <p>
          Install our app for faster and easier access.
        </p>

        <button onClick={handleInstall}>
          Install App
        </button>

        <button
          className="not-now"
          onClick={() => setShowPopup(false)}
        >
          Not Now
        </button>

      </div>
    </div>
  );
}