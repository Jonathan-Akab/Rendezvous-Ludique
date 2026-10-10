import { ImageResponse } from "next/og";

// App icons (home screen, taskbar, splash screen): the orange meeple on a warm dark tile.
// /app-icon/192, /app-icon/512, /app-icon/180 (iPhone) and /app-icon/maskable-512 (Android
// cuts icons into circles or squircles: the meeple stays inside the safe zone).

const MEEPLE =
  "M50 5c-9.4 0-17 7.4-17 16.6 0 5.6 2.7 10.3 7 13.3C28.7 37 10.5 41 6.6 49.2c-2.3 5 1.4 9.6 7.4 9.6 5.2 0 12.6-1.7 17.7-3.1-4.3 9.6-12.8 24.7-15 33.8-.9 4 2 7.5 6 7.5h15.5c2.8 0 5.2-1.6 6.3-4.1L50 79l5.5 13.9c1.1 2.5 3.5 4.1 6.3 4.1h15.5c4 0 6.9-3.5 6-7.5-2.2-9.1-10.7-24.2-15-33.8 5.1 1.4 12.5 3.1 17.7 3.1 6 0 9.7-4.6 7.4-9.6C89.5 41 71.3 37 60 34.9c4.3-3 7-7.7 7-13.3C67 12.4 59.4 5 50 5z";
const SIZES = new Set([180, 192, 512]);

export async function GET(_req: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size: raw } = await params;
  const maskable = raw.startsWith("maskable-");
  const size = Number(maskable ? raw.slice("maskable-".length) : raw);
  if (!SIZES.has(size)) return new Response("Not found", { status: 404 });
  // the meeple fills ~62% of a plain icon, ~48% of a maskable one (safe zone)
  const meeple = Math.round(size * (maskable ? 0.48 : 0.62));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="${MEEPLE}" fill="#f76707" stroke="#7a2a08" stroke-width="3"/></svg>`;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "radial-gradient(circle at 30% 25%, #3b2a1f, #1b1410 70%)",
          borderRadius: maskable || size === 180 ? 0 : size * 0.22,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
        <img src={`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`} width={meeple} height={meeple} />
      </div>
    ),
    { width: size, height: size, headers: { "Cache-Control": "public, max-age=604800, immutable" } },
  );
}
