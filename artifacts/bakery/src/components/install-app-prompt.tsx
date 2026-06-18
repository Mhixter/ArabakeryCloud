import { useState, useEffect } from "react";
import { usePwaInstall } from "@/hooks/use-pwa-install";
import { Download, X, Share, MoreHorizontal, Plus } from "lucide-react";

const DISMISSED_KEY = "nmb_install_dismissed";

function isDismissed(): boolean {
  try { return localStorage.getItem(DISMISSED_KEY) === "1"; } catch { return false; }
}
function setDismissed() {
  try { localStorage.setItem(DISMISSED_KEY, "1"); } catch {}
}

export default function InstallAppPrompt() {
  const { canInstall, install, isIos, isStandalone } = usePwaInstall();
  const [visible, setVisible] = useState(false);
  const [showIosSteps, setShowIosSteps] = useState(false);

  useEffect(() => {
    if (isStandalone || isDismissed()) return;
    const isMobile = window.matchMedia("(max-width: 1023px)").matches;
    if (!isMobile) return;

    if (isIos || canInstall) {
      const timer = setTimeout(() => setVisible(true), 3500);
      return () => clearTimeout(timer);
    }
  }, [canInstall, isIos, isStandalone]);

  const dismiss = () => {
    setVisible(false);
    setDismissed();
  };

  const handleInstall = async () => {
    if (isIos) {
      setShowIosSteps(true);
      return;
    }
    const ok = await install();
    if (ok) setVisible(false);
  };

  if (!visible) return null;

  return (
    <>
      {/* Backdrop for iOS steps */}
      {showIosSteps && (
        <div
          className="fixed inset-0 z-[9998] bg-black/50"
          onClick={() => setShowIosSteps(false)}
        />
      )}

      {/* iOS step-by-step instructions */}
      {showIosSteps && (
        <div className="fixed bottom-[72px] left-3 right-3 z-[9999] bg-white rounded-2xl shadow-2xl p-5 border border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-800 text-base">Add to Home Screen</h3>
            <button onClick={() => setShowIosSteps(false)} className="p-1 text-slate-400">
              <X size={18} />
            </button>
          </div>
          <p className="text-slate-500 text-sm mb-4">Follow these steps in Safari to install the app:</p>
          <ol className="space-y-3">
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-100 text-amber-700 text-xs font-bold flex items-center justify-center mt-0.5">1</span>
              <div className="text-sm text-slate-700">
                Tap the <strong>Share</strong> button{" "}
                <span className="inline-flex items-center gap-0.5 bg-slate-100 rounded px-1.5 py-0.5 text-xs font-medium">
                  <Share size={12} />
                </span>{" "}
                at the bottom of your Safari browser
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-100 text-amber-700 text-xs font-bold flex items-center justify-center mt-0.5">2</span>
              <div className="text-sm text-slate-700">
                Scroll down and tap{" "}
                <strong className="inline-flex items-center gap-1">
                  <Plus size={12} /> Add to Home Screen
                </strong>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-100 text-amber-700 text-xs font-bold flex items-center justify-center mt-0.5">3</span>
              <div className="text-sm text-slate-700">
                Tap <strong>Add</strong> in the top-right corner
              </div>
            </li>
          </ol>
          <p className="mt-4 text-xs text-slate-400">
            The app will appear on your home screen and work offline.
          </p>
          <button
            onClick={() => { setShowIosSteps(false); dismiss(); }}
            className="mt-4 w-full py-2.5 rounded-xl bg-amber-500 text-white text-sm font-semibold"
          >
            Got it
          </button>
        </div>
      )}

      {/* Main install banner */}
      {!showIosSteps && (
        <div className="fixed bottom-[72px] left-3 right-3 z-[9997] bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden">
          <div className="flex items-center gap-3 p-4">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
              <Download size={20} className="text-amber-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-800 text-sm leading-tight">Install Bakery App</p>
              <p className="text-slate-500 text-xs mt-0.5">Works offline · Fast · No app store needed</p>
            </div>
            <button onClick={dismiss} className="p-1.5 text-slate-300 hover:text-slate-500 flex-shrink-0">
              <X size={16} />
            </button>
          </div>
          <div className="px-4 pb-4 flex gap-2">
            <button
              onClick={handleInstall}
              className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition-colors"
            >
              {isIos ? "How to install" : "Install now"}
            </button>
            <button
              onClick={dismiss}
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-medium transition-colors"
            >
              Not now
            </button>
          </div>
        </div>
      )}
    </>
  );
}
