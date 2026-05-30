interface Props {
  size?: number;
  showText?: boolean;
  textColor?: string;
}

export default function SyncLogo({ size = 80, showText = true, textColor = "white" }: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="50" fill="#1b3456" />
        {/* S-shaped sync cable icon: upper-right terminal → lower-left terminal */}
        <path
          d="M 66 32 C 80 32, 80 52, 50 52 C 20 52, 20 68, 34 68"
          stroke="white"
          strokeWidth="7"
          strokeLinecap="round"
          fill="none"
        />
        <circle cx="66" cy="32" r="5.5" fill="white" />
        <circle cx="34" cy="68" r="5.5" fill="white" />
      </svg>
      {showText && (
        <div style={{ textAlign: "center", lineHeight: 1.1 }}>
          <span style={{ color: textColor, fontSize: size * 0.25, fontWeight: 700, letterSpacing: "0.05em" }}>
            Sync MSC
          </span>
          <span style={{ color: textColor, fontSize: size * 0.14, fontWeight: 500, opacity: 0.75, marginLeft: 3 }}>
            MP
          </span>
        </div>
      )}
    </div>
  );
}
