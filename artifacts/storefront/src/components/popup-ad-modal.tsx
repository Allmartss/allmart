import { useState, useEffect, useRef } from "react";
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
  popType: "pop" | "slide";
  slideDirection: "left" | "right" | "bottom";
  displayDelay: number;
  autoClose: number;
};

type PopupData = { popup1: PopupAd | null; popup2: PopupAd | null };

const SESSION_KEY = "popup_ad_dismissed";

// ─── Single popup renderer ────────────────────────────────────────────────────

function SinglePopup({ popup, slot, onDismiss }: {
  popup: PopupAd;
  slot: 1 | 2;
  onDismiss: () => void;
}) {
  const [visible, setVisible] = useState(false);
  const [entered, setEntered] = useState(false);
  const autoCloseRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isSlide = slot === 1 && popup.popType === "slide";
  const dir = popup.slideDirection ?? "bottom";

  useEffect(() => {
    const delay = (popup.displayDelay ?? 1.2) * 1000;
    const t = setTimeout(() => {
      setVisible(true);
      // trigger CSS enter transition on the next frame
      requestAnimationFrame(() => requestAnimationFrame(() => setEntered(true)));

      if (popup.autoClose && popup.autoClose > 0) {
        autoCloseRef.current = setTimeout(() => dismiss(), popup.autoClose * 1000);
      }
    }, delay);

    return () => { clearTimeout(t); if (autoCloseRef.current) clearTimeout(autoCloseRef.current); };
  }, []);

  function dismiss() {
    setEntered(false);
    setTimeout(() => { setVisible(false); onDismiss(); }, 300);
  }

  if (!visible) return null;

  const isExternal = popup.ctaUrl?.startsWith("http");

  // ── Slide panel ──────────────────────────────────────────────────────────────
  if (isSlide) {
    const positions: Record<string, string> = {
      left:   "fixed left-0 top-0 h-full w-full max-w-xs sm:max-w-sm",
      right:  "fixed right-0 top-0 h-full w-full max-w-xs sm:max-w-sm",
      bottom: "fixed bottom-0 left-0 right-0 w-full",
    };
    const transforms: Record<string, { out: string; in: string }> = {
      left:   { out: "-translate-x-full", in: "translate-x-0" },
      right:  { out: "translate-x-full",  in: "translate-x-0" },
      bottom: { out: "translate-y-full",  in: "translate-y-0" },
    };
    const t = transforms[dir];

    return (
      <>
        {/* Dim overlay (click to close) */}
        <div
          className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-300 ${entered ? "opacity-100" : "opacity-0"}`}
          onClick={dismiss}
        />
        {/* Panel */}
        <div
          className={`${positions[dir]} z-50 shadow-2xl overflow-y-auto transition-transform duration-300 ease-out ${entered ? t.in : t.out}`}
          style={{ background: popup.bgColor }}
          onClick={e => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={dismiss}
            className="absolute top-3 right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors text-white"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>

          {popup.imageUrl && (
            <img src={popup.imageUrl} alt="promo" className="w-full object-cover max-h-52"
              onError={e => (e.currentTarget.style.display = "none")} />
          )}

          <div className="p-6 text-white space-y-3">
            {popup.title && <h2 className="text-xl font-bold leading-tight">{popup.title}</h2>}
            {popup.body && <p className="text-white/90 text-sm leading-relaxed">{popup.body}</p>}
            {popup.ctaText && popup.ctaUrl && (
              <div className="pt-2 flex flex-wrap items-center gap-3">
                {isExternal ? (
                  <a href={popup.ctaUrl} target="_blank" rel="noopener noreferrer" onClick={dismiss}
                    className="inline-block rounded-lg bg-white px-6 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90"
                    style={{ color: popup.bgColor }}>
                    {popup.ctaText}
                  </a>
                ) : (
                  <Link href={popup.ctaUrl} onClick={dismiss}>
                    <span className="inline-block rounded-lg bg-white px-6 py-2.5 text-sm font-semibold cursor-pointer transition-opacity hover:opacity-90"
                      style={{ color: popup.bgColor }}>
                      {popup.ctaText}
                    </span>
                  </Link>
                )}
                <button type="button" onClick={dismiss} className="text-white/70 text-xs hover:text-white transition-colors">
                  No thanks
                </button>
              </div>
            )}
          </div>
        </div>
      </>
    );
  }

  // ── Center modal (pop) ────────────────────────────────────────────────────────
  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 transition-opacity duration-300 ${entered ? "opacity-100" : "opacity-0"}`}
      onClick={dismiss}
    >
      <div
        className={`relative w-full max-w-md rounded-2xl overflow-hidden shadow-2xl transition-transform duration-300 ease-out ${entered ? "scale-100" : "scale-95"}`}
        style={{ background: popup.bgColor }}
        onClick={e => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={dismiss}
          className="absolute top-3 right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors text-white"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        {popup.imageUrl && (
          <img src={popup.imageUrl} alt="promo" className="w-full object-cover max-h-56"
            onError={e => (e.currentTarget.style.display = "none")} />
        )}

        <div className="p-6 text-white space-y-3">
          {popup.title && <h2 className="text-2xl font-bold leading-tight">{popup.title}</h2>}
          {popup.body && <p className="text-white/90 text-sm leading-relaxed">{popup.body}</p>}
          {popup.ctaText && popup.ctaUrl && (
            <div className="pt-2 flex flex-wrap items-center gap-3">
              {isExternal ? (
                <a href={popup.ctaUrl} target="_blank" rel="noopener noreferrer" onClick={dismiss}
                  className="inline-block rounded-lg bg-white px-6 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90"
                  style={{ color: popup.bgColor }}>
                  {popup.ctaText}
                </a>
              ) : (
                <Link href={popup.ctaUrl} onClick={dismiss}>
                  <span className="inline-block rounded-lg bg-white px-6 py-2.5 text-sm font-semibold cursor-pointer transition-opacity hover:opacity-90"
                    style={{ color: popup.bgColor }}>
                    {popup.ctaText}
                  </span>
                </Link>
              )}
              <button type="button" onClick={dismiss} className="text-white/70 text-xs hover:text-white transition-colors">
                No thanks
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export function PopupAdModal() {
  const [data, setData] = useState<PopupData | null>(null);
  const [p1dismissed, setP1Dismissed] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY)) return;
    fetch("/api/popup-ad")
      .then(r => r.json())
      .then((d: PopupData) => { if (d.popup1 || d.popup2) setData(d); })
      .catch(() => {});
  }, []);

  function dismissAll() {
    sessionStorage.setItem(SESSION_KEY, "1");
    setData(null);
  }

  if (!data) return null;

  // Show popup1 first; once dismissed, show popup2 (if any)
  if (data.popup1 && !p1dismissed) {
    return (
      <SinglePopup
        popup={data.popup1}
        slot={1}
        onDismiss={() => {
          setP1Dismissed(true);
          if (!data.popup2) sessionStorage.setItem(SESSION_KEY, "1");
        }}
      />
    );
  }

  if (data.popup2 && (p1dismissed || !data.popup1)) {
    return (
      <SinglePopup
        popup={data.popup2}
        slot={2}
        onDismiss={dismissAll}
      />
    );
  }

  return null;
}
