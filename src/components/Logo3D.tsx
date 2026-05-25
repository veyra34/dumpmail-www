"use client";

const LOGOS = [
  { name: "Cube" },
  { name: "Stacked" },
  { name: "Prism" },
  { name: "Open Cube" },
  { name: "Planes" },
];

export { LOGOS };

export function Logo3D({
  variant = 0,
  size = 28,
  bgHex = "#0e0e10",
  lineHex = "#58585e",
}: {
  variant?: number;
  size?: number;
  zoom?: number;
  bgHex?: string;
  lineHex?: string;
}) {
  const label = LOGOS[variant]?.name ?? LOGOS[0].name;

  return (
    <div
      className="inline-flex shrink-0 items-center justify-center rounded-md border shadow-sm"
      style={{ width: size, height: size, backgroundColor: bgHex, borderColor: lineHex }}
      aria-label={label}
      title={label}
    >
      <div
        className="rounded-[4px]"
        style={{
          width: Math.max(10, Math.round(size * 0.45)),
          height: Math.max(10, Math.round(size * 0.45)),
          background: `linear-gradient(135deg, ${lineHex}, ${bgHex})`,
          border: `1px solid ${lineHex}`,
        }}
      />
    </div>
  );
}
