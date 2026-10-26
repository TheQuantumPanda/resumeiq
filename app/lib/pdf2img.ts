import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { validateResumeFile } from "./validation";

export interface PdfConversionResult {
  imageUrl: string;
  file: File | null;
  text?: string;
  pageCount?: number;
  warnings?: string[];
  error?: string;
}

export async function convertPdfToImage(
  file: File,
): Promise<PdfConversionResult> {
  let task: import("pdfjs-dist").PDFDocumentLoadingTask | undefined;
  try {
    const validation = validateResumeFile(file);
    if (validation) throw new Error(validation);
    const data = new Uint8Array(await file.arrayBuffer());
    if (new TextDecoder().decode(data.slice(0, 5)) !== "%PDF-") {
      throw new Error(
        "This file is not a valid PDF. Export your resume as a PDF again.",
      );
    }
    const lib = await import("pdfjs-dist");
    lib.GlobalWorkerOptions.workerSrc = workerUrl;
    task = lib.getDocument({ data, verbosity: 0 });
    const pdf = await task.promise;
    if (pdf.numPages > 20)
      throw new Error("Use a resume with 20 pages or fewer.");
    const pages: string[] = [];
    const warnings: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const text = content.items
        .map((item) =>
          "str" in item ? `${item.str}${item.hasEOL ? "\n" : " "}` : "",
        )
        .join("");
      pages.push(text);
      if (text.replace(/\s/g, "").length < 20)
        warnings.push(
          `Page ${i} has little readable text; image-only content is excluded from matching.`,
        );
    }
    const text = pages.join("\n\n");
    if (text.replace(/[^\p{L}\p{N}]/gu, "").length < 40) {
      throw new Error(
        "No usable text found. Scanned or blank PDFs cannot be matched. Export a text-based PDF; OCR is outside this MVP.",
      );
    }
    if (text.length > 200000)
      throw new Error("This PDF contains too much text. Use a shorter resume.");
    const page = await pdf.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({
      scale: Math.min(2, 1600 / Math.max(base.width, base.height)),
    });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext("2d");
    if (!context)
      throw new Error("Your browser could not create a PDF preview.");
    await page.render({ canvasContext: context, canvas, viewport }).promise;
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png"),
    );
    if (!blob) throw new Error("Your browser could not create a PDF preview.");
    return {
      imageUrl: URL.createObjectURL(blob),
      file: new File([blob], "preview.png", { type: "image/png" }),
      text,
      pageCount: pdf.numPages,
      warnings,
    };
  } catch (error) {
    const known = error instanceof Error && error.name === "Error";
    return {
      imageUrl: "",
      file: null,
      error: known
        ? error.message
        : "Cannot read this PDF. It may be corrupted or password-protected. Export an unlocked text-based PDF and try again.",
    };
  } finally {
    await task?.destroy().catch(() => undefined);
  }
}
