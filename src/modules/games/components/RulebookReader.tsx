"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, Download, ExternalLink, LoaderCircle, ZoomIn, ZoomOut } from "lucide-react";
import type { PDFDocumentProxy } from "pdfjs-dist";

// Reads a rulebook PDF inside the site with pdf.js, so it works in every browser (some
// download PDFs instead of showing them) and opens straight on the cited page.
// Pages are drawn only when they come near the screen. `embedded`: shown in the overlay —
// the reader then scrolls inside itself and leaves the page URL alone.

const ZOOMS = [0.75, 1, 1.25, 1.5, 2];

export function RulebookReader({ fileId, initialPage, embedded = false }: { fileId: string; initialPage: number; embedded?: boolean }) {
  const t = useTranslations("games.reader");
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [ratio, setRatio] = useState(1.294); // height / width of the first page
  const [error, setError] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [width, setWidth] = useState(800);
  const [current, setCurrent] = useState(initialPage);
  const [pageInput, setPageInput] = useState(String(initialPage));
  const wrap = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const jumped = useRef(false);
  // Scroll container: the overlay's own area when embedded, the page otherwise.
  const scroller = useRef<HTMLDivElement>(null);
  const root = () => (embedded ? scroller.current : null);

  // Load pdf.js (browser only) and the document.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
        const loaded = await pdfjs.getDocument({ url: `/files/${fileId}`, withCredentials: true }).promise;
        const first = await loaded.getPage(1);
        const vp = first.getViewport({ scale: 1 });
        if (cancelled) return;
        setRatio(vp.height / vp.width);
        setDoc(loaded);
      } catch (e) {
        console.error("[reader]", e);
        if (!cancelled) setError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fileId]);

  // Page width follows the reading area.
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(Math.min(el.clientWidth, 1100)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const goTo = useCallback((n: number, smooth = true) => {
    pageRefs.current[n - 1]?.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
  }, []);

  // Open on the requested page once the pages exist.
  useEffect(() => {
    if (!doc || jumped.current) return;
    jumped.current = true;
    requestAnimationFrame(() => goTo(Math.min(Math.max(initialPage, 1), doc.numPages), false));
  }, [doc, initialPage, goTo]);

  // Track the page in view (toolbar + URL, so the link can be shared).
  useEffect(() => {
    if (!doc) return;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        const n = Number((visible.target as HTMLElement).dataset.page);
        setCurrent(n);
        setPageInput(String(n));
        if (embedded) return;
        const url = new URL(window.location.href);
        url.searchParams.set("page", String(n));
        window.history.replaceState(null, "", url);
      },
      { threshold: [0.3, 0.6], root: root() },
    );
    pageRefs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, width, zoom, embedded]);

  const pageWidth = Math.round(width * zoom);
  const total = doc?.numPages ?? 0;

  return (
    <div className={embedded ? "flex h-full min-h-0 flex-col gap-3" : "space-y-3"}>
      <div className={`glass z-30 flex flex-wrap items-center gap-2 rounded-2xl px-3 py-2 text-sm ${embedded ? "shrink-0" : "sticky top-20"}`}>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => goTo(current - 1)} disabled={current <= 1} title={t("previous")}>
          <ChevronLeft className="size-4" />
        </button>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const n = Number(pageInput);
            if (n >= 1 && n <= total) goTo(n);
          }}
          className="flex items-center gap-1.5"
        >
          <span className="text-muted">{t("page")}</span>
          <input value={pageInput} onChange={(e) => setPageInput(e.target.value)} inputMode="numeric" className="input w-14 px-2 py-1 text-center" aria-label={t("page")} />
          <span className="text-muted">/ {total || "…"}</span>
        </form>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => goTo(current + 1)} disabled={!total || current >= total} title={t("next")}>
          <ChevronRight className="size-4" />
        </button>
        <span className="mx-1 h-5 w-px bg-line" />
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setZoom((z) => ZOOMS[Math.max(0, ZOOMS.indexOf(z) - 1)])} disabled={zoom === ZOOMS[0]} title={t("zoomOut")}>
          <ZoomOut className="size-4" />
        </button>
        <span className="w-12 text-center text-xs text-muted">{Math.round(zoom * 100)} %</span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setZoom((z) => ZOOMS[Math.min(ZOOMS.length - 1, ZOOMS.indexOf(z) + 1)])} disabled={zoom === ZOOMS.at(-1)} title={t("zoomIn")}>
          <ZoomIn className="size-4" />
        </button>
        <span className="ml-auto flex gap-1">
          <a href={`/files/${fileId}#page=${current}`} target="_blank" rel="noopener" className="btn btn-ghost btn-sm" title={t("original")}>
            <ExternalLink className="size-4" /> <span className="hidden sm:inline">{t("original")}</span>
          </a>
          <a href={`/files/${fileId}?download=1`} className="btn btn-ghost btn-sm" title={t("download")}>
            <Download className="size-4" /> <span className="hidden sm:inline">{t("download")}</span>
          </a>
        </span>
      </div>

      <div ref={scroller} className={embedded ? "min-h-0 flex-1 overflow-y-auto overscroll-contain" : ""}>
      <div ref={wrap} className="overflow-x-auto">
        {error ? (
          <p className="card card-pad text-center text-danger">{t("error")}</p>
        ) : !doc ? (
          <p className="flex items-center justify-center gap-2 py-24 text-muted">
            <LoaderCircle className="size-5 animate-spin" /> {t("loading")}
          </p>
        ) : (
          <div className="mx-auto flex flex-col items-center gap-4 pb-10" style={{ width: pageWidth }}>
            {Array.from({ length: total }, (_, i) => (
              <div
                key={i}
                ref={(el) => {
                  pageRefs.current[i] = el;
                }}
                data-page={i + 1}
                className="scroll-mt-36"
              >
                <PdfPage doc={doc} number={i + 1} width={pageWidth} height={Math.round(pageWidth * ratio)} root={root()} />
                <p className="mt-1 text-center text-xs text-muted">{i + 1}</p>
              </div>
            ))}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}

/** One page, drawn on a canvas when it comes near the screen (and again when the size changes). */
function PdfPage({ doc, number, width, height, root }: { doc: PDFDocumentProxy; number: number; width: number; height: number; root: Element | null }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setNear(true), { rootMargin: "1200px 0px", root });
    io.observe(el);
    return () => io.disconnect();
  }, [root]);

  useEffect(() => {
    if (!near) return;
    let task: { cancel: () => void; promise: Promise<void> } | null = null;
    let cancelled = false;
    (async () => {
      const page = await doc.getPage(number);
      if (cancelled || !canvas.current) return;
      const base = page.getViewport({ scale: 1 });
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const viewport = page.getViewport({ scale: (width / base.width) * dpr });
      const c = canvas.current;
      c.width = Math.floor(viewport.width);
      c.height = Math.floor(viewport.height);
      task = page.render({ canvas: c, canvasContext: c.getContext("2d")!, viewport });
      await task.promise.catch(() => {});
    })();
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [near, doc, number, width]);

  return <canvas ref={canvas} style={{ width, height }} className="rounded-lg bg-white shadow-lg" />;
}
