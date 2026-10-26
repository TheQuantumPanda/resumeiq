import { afterEach, describe, expect, it, vi } from "vitest";

const fake = vi.hoisted(() => ({
  getDocument: vi.fn(),
  worker: { workerSrc: "" },
}));
vi.mock("pdfjs-dist", () => ({
  getDocument: fake.getDocument,
  GlobalWorkerOptions: fake.worker,
}));
import { convertPdfToImage } from "./pdf2img";

const pdfFile = (body = "%PDF-fake") =>
  ({
    name: "fictional.pdf",
    type: "application/pdf",
    size: body.length,
    arrayBuffer: async () => new TextEncoder().encode(body).buffer,
  }) as File;
const text =
  "Fictional Candidate built React interfaces with TypeScript and SQL for a college project.";
function documentMock(pages: string[], options = {}) {
  return {
    numPages: pages.length,
    getPage: vi.fn(async (i: number) => ({
      getTextContent: async () => ({
        items: [{ str: pages[i - 1], hasEOL: true }],
      }),
      getViewport: () => ({ width: 600, height: 800 }),
      render: () => ({ promise: Promise.resolve() }),
    })),
    destroy: vi.fn().mockResolvedValue(undefined),
    ...options,
  };
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  fake.getDocument.mockReset();
});

describe("PDF preparation", () => {
  it("rejects disguised and corrupted PDFs before returning analysis text", async () => {
    expect((await convertPdfToImage(pdfFile("not a pdf"))).error).toContain(
      "not a valid PDF",
    );
    expect(fake.getDocument).not.toHaveBeenCalled();
    fake.getDocument.mockReturnValue({
      promise: Promise.reject({ name: "InvalidPDFException" }),
      destroy: vi.fn().mockResolvedValue(undefined),
    });
    expect((await convertPdfToImage(pdfFile())).error).toContain(
      "corrupted or password-protected",
    );
  });
  it("rejects empty or scanned PDFs and frees the document", async () => {
    const doc = documentMock([" "]);
    fake.getDocument.mockReturnValue({
      promise: Promise.resolve(doc),
      destroy: doc.destroy,
    });
    expect((await convertPdfToImage(pdfFile())).error).toContain(
      "Scanned or blank",
    );
    expect(doc.destroy).toHaveBeenCalled();
  });
  it("limits PDF page count", async () => {
    fake.getDocument.mockReturnValue({
      promise: Promise.resolve(documentMock(Array(21).fill(text))),
      destroy: vi.fn().mockResolvedValue(undefined),
    });
    expect((await convertPdfToImage(pdfFile())).error).toContain("20 pages");
  });
  it("extracts later pages, warns about image-only pages and renders page one", async () => {
    const doc = documentMock([text, "", "Python and PostgreSQL on page three"]);
    fake.getDocument.mockReturnValue({
      promise: Promise.resolve(doc),
      destroy: doc.destroy,
    });
    vi.stubGlobal("document", {
      createElement: () => ({
        getContext: () => ({}),
        toBlob: (callback: (blob: Blob) => void) => callback(new Blob(["png"])),
      }),
    });
    vi.stubGlobal(
      "File",
      class {
        constructor(
          public parts: Blob[],
          public name: string,
          public options: unknown,
        ) {}
      },
    );
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:fictional");
    const result = await convertPdfToImage(pdfFile());
    expect(result.text).toContain("page three");
    expect(result.pageCount).toBe(3);
    expect(result.warnings).toHaveLength(1);
    expect(result.file).not.toBeNull();
    expect(doc.destroy).toHaveBeenCalled();
  });
});
