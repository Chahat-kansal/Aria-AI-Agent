export type OfficialUpdatePayload = {
  sourceName: string;
  sourceType: string;
  sourceUrl: string;
  title: string;
  summary: string;
  updateType?: string;
  effectiveDate?: string;
  publishedAt?: string;
  rawContent: string;
  metadata?: Record<string, string | number | boolean | null>;
};

export type OfficialSourceConfig = {
  id?: string;
  name: string;
  sourceType: string;
  url: string;
  metadata?: Record<string, unknown>;
};

export interface OfficialUpdateConnector {
  source: OfficialSourceConfig;
  fetchUpdates(): Promise<OfficialUpdatePayload[]>;
}

const DEFAULT_TIMEOUT_MS = 15000;

function toAbsoluteUrl(href: string, baseUrl: string) {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return null;
  }
}

function stripTags(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function inferDateFromText(value: string) {
  const match = value.match(/\b(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+\d{4})\b/i);
  if (!match) return undefined;
  const parsed = new Date(match[1]);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

async function fetchText(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "user-agent": "AriaMigrationAgents/1.0 official-update-monitoring"
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.status}`);
    }

    return response.text();
  } finally {
    clearTimeout(timeout);
  }
}

export class HomeAffairsNewsConnector implements OfficialUpdateConnector {
  source: OfficialSourceConfig;

  constructor(source: OfficialSourceConfig) {
    this.source = source;
  }

  async fetchUpdates(): Promise<OfficialUpdatePayload[]> {
    const html = await fetchText(this.source.url);
    const links = Array.from(html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi));
    const seen = new Set<string>();
    const updates: OfficialUpdatePayload[] = [];

    for (const [, href, labelHtml] of links) {
      const title = stripTags(labelHtml);
      const sourceUrl = toAbsoluteUrl(href, this.source.url);
      if (!sourceUrl || seen.has(sourceUrl)) continue;
      if (!sourceUrl.includes("/news-media")) continue;
      if (title.length < 8) continue;

      seen.add(sourceUrl);
      updates.push({
        sourceName: this.source.name,
        sourceType: this.source.sourceType,
        sourceUrl,
        title,
        summary: title,
        publishedAt: inferDateFromText(title) ?? new Date().toISOString(),
        rawContent: `${title}\n${sourceUrl}`,
        metadata: { connector: "home-affairs-news", sourceId: this.source.id ?? null }
      });

      if (updates.length >= 20) break;
    }

    return updates;
  }
}

export function createOfficialUpdateConnector(source: OfficialSourceConfig): OfficialUpdateConnector | null {
  if (source.sourceType === "HOME_AFFAIRS_NEWS") return new HomeAffairsNewsConnector(source);
  return null;
}
