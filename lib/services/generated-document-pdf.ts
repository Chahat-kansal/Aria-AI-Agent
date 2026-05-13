import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import type { GeneratedDocument, Matter, User, Workspace, Client } from "@prisma/client";
import { getWorkspaceDraftPdfSettings } from "@/lib/services/draft-pdf-settings";

type PdfInput = {
  generatedDocument: GeneratedDocument & {
    workspace: Workspace;
    createdByUser: User;
    matter: Matter & { client: Client; assignedToUser: User };
  };
};

const PAGE = { width: 595.28, height: 841.89 };
const MARGIN_X = 48;
const TOP = 790;
const BOTTOM = 58;

function safe(value: string | null | undefined) {
  return value?.trim() || "Not configured";
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const lines: string[] = [];
  for (const rawParagraph of text.replace(/\r/g, "").split("\n")) {
    const paragraph = rawParagraph.trim();
    if (!paragraph) {
      lines.push("");
      continue;
    }
    let line = "";
    for (const word of paragraph.split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        line = candidate;
      } else {
        if (line) lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

function addFooter(page: PDFPage, footerText: string, font: PDFFont) {
  page.drawLine({
    start: { x: MARGIN_X, y: 42 },
    end: { x: PAGE.width - MARGIN_X, y: 42 },
    thickness: 0.5,
    color: rgb(0.78, 0.72, 0.9)
  });
  page.drawText(footerText.slice(0, 120), {
    x: MARGIN_X,
    y: 26,
    size: 7,
    font,
    color: rgb(0.38, 0.33, 0.5)
  });
}

function drawSectionHeading(page: PDFPage, text: string, y: number, font: PDFFont) {
  page.drawText(text, {
    x: MARGIN_X,
    y,
    size: 10,
    font,
    color: rgb(0.45, 0.19, 0.95)
  });
  page.drawLine({
    start: { x: MARGIN_X, y: y - 8 },
    end: { x: PAGE.width - MARGIN_X, y: y - 8 },
    thickness: 0.6,
    color: rgb(0.83, 0.78, 0.95)
  });
}

export async function renderGeneratedDocumentPdf({ generatedDocument }: PdfInput) {
  const settings = await getWorkspaceDraftPdfSettings(generatedDocument.workspaceId);
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const italic = await pdf.embedFont(StandardFonts.HelveticaOblique);
  const accent = generatedDocument.workspace.brandColor?.startsWith("#") ? rgb(0.45, 0.19, 0.95) : rgb(0.45, 0.19, 0.95);

  let page = pdf.addPage([PAGE.width, PAGE.height]);
  let y = TOP;

  const newPage = () => {
    addFooter(page, settings.footerText, regular);
    page = pdf.addPage([PAGE.width, PAGE.height]);
    y = TOP;
  };

  const drawLines = (lines: string[], size = 10, font: PDFFont = regular, color = rgb(0.12, 0.1, 0.18), lineHeight = 15) => {
    for (const line of lines) {
      if (y < BOTTOM) newPage();
      page.drawText(line || " ", { x: MARGIN_X, y, size, font, color });
      y -= line ? lineHeight : lineHeight * 0.7;
    }
  };

  page.drawRectangle({
    x: 0,
    y: PAGE.height - 132,
    width: PAGE.width,
    height: 132,
    color: rgb(0.965, 0.945, 0.995)
  });
  page.drawText(safe(generatedDocument.workspace.legalName || generatedDocument.workspace.name), {
    x: MARGIN_X,
    y,
    size: 18,
    font: bold,
    color: accent
  });
  y -= 24;
  drawLines([
    `Registration / ABN: ${safe(generatedDocument.workspace.registrationNumber)}`,
    `Contact: ${safe(generatedDocument.workspace.contactEmail)} | ${safe(generatedDocument.workspace.contactPhone)}`,
    `Website: ${safe(generatedDocument.workspace.website)}`
  ], 8.5, regular, rgb(0.34, 0.29, 0.45), 12);

  y -= 10;
  page.drawText(generatedDocument.title, { x: MARGIN_X, y, size: 17, font: bold, color: rgb(0.1, 0.08, 0.15) });
  y -= 22;
  page.drawText("Firm-branded PDF draft version", { x: MARGIN_X, y, size: 10, font: italic, color: rgb(0.38, 0.33, 0.5) });
  y -= 28;

  drawSectionHeading(page, "Matter and practitioner details", y, bold);
  y -= 24;
  drawLines([
    `Client: ${generatedDocument.matter.client.firstName} ${generatedDocument.matter.client.lastName}`,
    `Matter: ${generatedDocument.matter.title}`,
    `Subclass: ${generatedDocument.matter.visaSubclass}${generatedDocument.matter.visaStream ? ` (${generatedDocument.matter.visaStream})` : ""}`,
    `Assigned migration agent / staff: ${generatedDocument.matter.assignedToUser.name} (${safe(generatedDocument.matter.assignedToUser.jobTitle || generatedDocument.matter.assignedToUser.role)})`,
    `Prepared by: ${generatedDocument.createdByUser.name} on ${generatedDocument.createdAt.toLocaleString("en-AU")}`
  ]);

  y -= 8;
  drawSectionHeading(page, "Review notice", y, bold);
  y -= 24;
  drawLines(wrapText(settings.termsText, regular, 9.5, PAGE.width - MARGIN_X * 2), 9.5, regular, rgb(0.2, 0.16, 0.28), 14);

  y -= 8;
  drawSectionHeading(page, "Draft content", y, bold);
  y -= 24;
  drawLines(wrapText(generatedDocument.content, regular, 9.5, PAGE.width - MARGIN_X * 2), 9.5, regular, rgb(0.12, 0.1, 0.18), 14);

  addFooter(page, settings.footerText, regular);
  return Buffer.from(await pdf.save());
}

