import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import type { Client, Matter, MatterApplicationDraft, MatterDraftField, MatterReviewRequest, User, VisaTemplateField, Workspace } from "@prisma/client";
import { decryptString } from "@/lib/security/encryption";
import { getWorkspaceDraftPdfSettings } from "@/lib/services/draft-pdf-settings";

type ReviewPdfInput = {
  request: MatterReviewRequest & {
    matter: Matter & { client: Client; workspace: Workspace; assignedToUser: User };
    draft: MatterApplicationDraft & { fields: Array<MatterDraftField & { templateField: VisaTemplateField }> };
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

function footer(page: PDFPage, text: string, font: PDFFont) {
  page.drawLine({
    start: { x: MARGIN_X, y: 42 },
    end: { x: PAGE.width - MARGIN_X, y: 42 },
    thickness: 0.5,
    color: rgb(0.78, 0.72, 0.9)
  });
  page.drawText(text.slice(0, 120), { x: MARGIN_X, y: 26, size: 7, font, color: rgb(0.38, 0.33, 0.5) });
}

export async function renderClientReviewDraftPdf({ request }: ReviewPdfInput) {
  const settings = await getWorkspaceDraftPdfSettings(request.matter.workspaceId);
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const italic = await pdf.embedFont(StandardFonts.HelveticaOblique);
  const workspace = request.matter.workspace;
  let page = pdf.addPage([PAGE.width, PAGE.height]);
  let y = TOP;

  const newPage = () => {
    footer(page, settings.footerText, regular);
    page = pdf.addPage([PAGE.width, PAGE.height]);
    y = TOP;
  };

  const draw = (lines: string[], size = 9.5, font: PDFFont = regular, color = rgb(0.12, 0.1, 0.18), lineHeight = 14) => {
    for (const line of lines) {
      if (y < BOTTOM) newPage();
      page.drawText(line || " ", { x: MARGIN_X, y, size, font, color });
      y -= line ? lineHeight : lineHeight * 0.7;
    }
  };

  page.drawRectangle({ x: 0, y: PAGE.height - 128, width: PAGE.width, height: 128, color: rgb(0.965, 0.945, 0.995) });
  page.drawText(safe(workspace.legalName || workspace.name), { x: MARGIN_X, y, size: 18, font: bold, color: rgb(0.45, 0.19, 0.95) });
  y -= 24;
  draw([
    `Registration / ABN: ${safe(workspace.registrationNumber)}`,
    `Contact: ${safe(workspace.contactEmail)} | ${safe(workspace.contactPhone)}`,
    `Website: ${safe(workspace.website)}`
  ], 8.5, regular, rgb(0.34, 0.29, 0.45), 12);

  y -= 10;
  page.drawText("Client review draft PDF", { x: MARGIN_X, y, size: 17, font: bold, color: rgb(0.1, 0.08, 0.15) });
  y -= 20;
  page.drawText("PDF version of the current Aria review request", { x: MARGIN_X, y, size: 10, font: italic, color: rgb(0.38, 0.33, 0.5) });
  y -= 28;

  draw([
    `Client: ${request.matter.client.firstName} ${request.matter.client.lastName}`,
    `Matter: ${request.matter.title}`,
    `Subclass: ${request.matter.visaSubclass}${request.matter.visaStream ? ` (${request.matter.visaStream})` : ""}`,
    `Migration agent / staff: ${request.matter.assignedToUser.name} (${safe(request.matter.assignedToUser.jobTitle || request.matter.assignedToUser.role)})`,
    `Review request status: ${request.status.replaceAll("_", " ").toLowerCase()}`
  ]);

  y -= 8;
  page.drawText("Review terms", { x: MARGIN_X, y, size: 10, font: bold, color: rgb(0.45, 0.19, 0.95) });
  y -= 18;
  draw(wrapText(settings.termsText, regular, 9.5, PAGE.width - MARGIN_X * 2));

  y -= 8;
  page.drawText("Draft fields for client confirmation", { x: MARGIN_X, y, size: 10, font: bold, color: rgb(0.45, 0.19, 0.95) });
  y -= 18;

  for (const field of request.draft.fields.slice(0, 80)) {
    const value = decryptString(field.manualOverride || field.value || "") || "Missing / requires agent follow-up";
    draw([field.templateField.label], 9.5, bold, rgb(0.12, 0.1, 0.18), 13);
    draw(wrapText(value, regular, 9, PAGE.width - MARGIN_X * 2), 9, regular, rgb(0.34, 0.29, 0.45), 13);
    draw([`Status: ${field.status.replaceAll("_", " ").toLowerCase()}`], 8, regular, rgb(0.48, 0.42, 0.58), 12);
    y -= 4;
  }

  footer(page, settings.footerText, regular);
  return Buffer.from(await pdf.save());
}
