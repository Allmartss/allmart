/** Shared AllMart bag logo — purple colourway */
export function BagLogo({ size = 72 }: { size?: number }) {
  const handleW = Math.round(size * 0.22);
  const handleH = Math.round(size * 0.27);
  const gap     = Math.round(size * 0.24);
  const bodyW   = size;
  const bodyH   = Math.round(size * 0.97);
  const radius  = Math.round(size * 0.2);
  const fontSize = Math.round(size * 0.82);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
      {/* Handle */}
      <div style={{ display: "flex", gap, marginBottom: -2, position: "relative", zIndex: 1 }}>
        <div style={{
          width: handleW, height: handleH,
          borderTop: `${Math.max(3, Math.round(size * 0.05))}px solid #8B7BD8`,
          borderLeft: `${Math.max(3, Math.round(size * 0.05))}px solid #8B7BD8`,
          borderRadius: "8px 0 0 0",
        }} />
        <div style={{
          width: handleW, height: handleH,
          borderTop: `${Math.max(3, Math.round(size * 0.05))}px solid #8B7BD8`,
          borderRight: `${Math.max(3, Math.round(size * 0.05))}px solid #8B7BD8`,
          borderRadius: "0 8px 0 0",
        }} />
      </div>
      {/* Body */}
      <div style={{
        width: bodyW, height: bodyH,
        borderRadius: radius,
        background: "linear-gradient(145deg, #8B7BD8, #6C5BB5)",
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 12px 32px rgba(139,123,216,0.40)",
        position: "relative", zIndex: 2,
        overflow: "hidden",
      }}>
        <span style={{
          fontSize,
          fontWeight: 700,
          color: "#fff",
          fontFamily: '"Playfair Display", Georgia, serif',
          letterSpacing: 0,
          lineHeight: 1,
          display: "block",
        }}>A</span>
      </div>
    </div>
  );
}
