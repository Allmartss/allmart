import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { Link } from "wouter";

type PopupAd = {
  enabled: boolean;
  title: string;
  body: string;
  ctaText: string;
  ctaUrl: string;
  imageUrl: string;
  bgColor: string;
};

const SESSION_KEY = "popup_ad_dismissed";

export function PopupAdModal() {
  const [popup, setPopup] = useState<PopupAd | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Only show once per session
    if (sessionStorage.getItem(SESSION_KEY)) return;

    fetch("/api/popup-ad")
      .then(r => r.json())
      .then((data: PopupAd) => {
        if (data.enabled && data.title) {
          setPopup(data);
          // Slight delay so the page loads first
          setTimeout(() => setVisible(true), 1200);
        }
      })
      .catch(() => {});
  }, []);

  function dismiss() {
    setVisible(false);
    sessionStorage.setItem(SESSION_KEY, "1");
  }

  if (!visible || !popup) return null;

  const isExternal = popup.ctaUrl?.startsWith("http");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-300"
      onClick={dismiss}
    >
      <div
        className="relative w-full max-w-md rounded-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300"
        style={{ background: popup.bgColor }}
        onClick={e => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={dismiss}
          className="absolute top-3 right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors text-white"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Banner image */}
        {popup.imageUrl && (
          <img
            src={popup.imageUrl}
            alt="promo"
            className="w-full object-cover max-h-56"
            onError={e => (e.currentTarget.style.display = "none")}
          />
        )}

        {/* Content */}
        <div className="p-6 text-white space-y-3">
          {popup.title && (
            <h2 className="text-2xl font-bold leading-tight">{popup.title}</h2>
          )}
          {popup.body && (
            <p className="text-white/90 text-sm leading-relaxed">{popup.body}</p>
          )}
          {popup.ctaText && popup.ctaUrl && (
            <div className="pt-2 flex items-center gap-3">
              {isExternal ? (
                <a
                  href={popup.ctaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={dismiss}
                  className="inline-block rounded-lg bg-white px-6 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90"
                  style={{ color: popup.bgColor }}
                >
                  {popup.ctaText}
                </a>
              ) : (
                <Link href={popup.ctaUrl} onClick={dismiss}>
                  <span
                    className="inline-block rounded-lg bg-white px-6 py-2.5 text-sm font-semibold cursor-pointer transition-opacity hover:opacity-90"
                    style={{ color: popup.bgColor }}
                  >
                    {popup.ctaText}
                  </span>
                </Link>
              )}
              <button
                type="button"
                onClick={dismiss}
                className="text-white/70 text-xs hover:text-white transition-colors"
              >
                No thanks
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
