import { ThemeArt } from "./ThemeArt";

/** The admin-uploaded picture for a theme if there is one, otherwise its illustration. */
export function ThemePicture({ theme, images, className = "" }: { theme: string; images?: Record<string, string>; className?: string }) {
  const fileId = images?.[theme];
  if (fileId) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={`/files/${fileId}`} alt="" className={`object-cover ${className}`} />;
  }
  return <ThemeArt theme={theme} className={className} />;
}
