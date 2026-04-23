export type WebResearchResult = {
  title: string;
  url: string;
  content: string;
  sourceType: "official" | "public-web";
  publishedAt?: string;
};

export type WebResearchResponse = {
  provider: string;
  configured: boolean;
  query: string;
  results: WebResearchResult[];
  setupMessage?: string;
};

type SearchInput = {
  query: string;
  maxResults?: number;
  includeDomains?: string[];
  officialOnly?: boolean;
};

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

interface WebResearchProvider {
  name: string;
  isConfigured(): boolean;
  search(input: SearchInput): Promise<WebResearchResponse>;
}

const OFFICIAL_DOMAINS = ["homeaffairs.gov.au", "immi.homeaffairs.gov.au", "legislation.gov.au", "mara.gov.au"];

function officialSourceType(url: string): "official" | "public-web" {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    return OFFICIAL_DOMAINS.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`)) ? "official" : "public-web";
  } catch {
    return "public-web";
  }
}

function cleanText(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, 1500);
}

class DisabledResearchProvider implements WebResearchProvider {
  name = "disabled";

  isConfigured() {
    return false;
  }

  async search(input: SearchInput): Promise<WebResearchResponse> {
    return {
      provider: this.name,
      configured: false,
      query: input.query,
      results: [],
      setupMessage: "Live web research is not configured. Set WEB_RESEARCH_PROVIDER with TAVILY_API_KEY or FIRECRAWL_API_KEY to enable source-linked real-time answers."
    };
  }
}

class TavilyResearchProvider implements WebResearchProvider {
  name = "tavily";

  isConfigured() {
    return Boolean(process.env.TAVILY_API_KEY);
  }

  async search(input: SearchInput): Promise<WebResearchResponse> {
    if (!this.isConfigured()) return new DisabledResearchProvider().search(input);

    const response = await fetchWithTimeout("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.TAVILY_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        query: input.query,
        search_depth: "basic",
        topic: "general",
        max_results: input.maxResults ?? 5,
        include_raw_content: "text",
        include_domains: input.officialOnly ? OFFICIAL_DOMAINS : input.includeDomains
      })
    });

    if (!response.ok) throw new Error(`Tavily search failed: ${response.status}`);
    const payload = await response.json() as { results?: Array<{ title?: string; url?: string; content?: string; raw_content?: string; published_date?: string }> };

    return {
      provider: this.name,
      configured: true,
      query: input.query,
      results: (payload.results ?? [])
        .filter((item) => item.url)
        .map((item) => ({
          title: cleanText(item.title || item.url),
          url: String(item.url),
          content: cleanText(item.raw_content || item.content),
          publishedAt: item.published_date,
          sourceType: officialSourceType(String(item.url))
        }))
    };
  }
}

class FirecrawlResearchProvider implements WebResearchProvider {
  name = "firecrawl";

  isConfigured() {
    return Boolean(process.env.FIRECRAWL_API_KEY);
  }

  async search(input: SearchInput): Promise<WebResearchResponse> {
    if (!this.isConfigured()) return new DisabledResearchProvider().search(input);

    const response = await fetchWithTimeout("https://api.firecrawl.dev/v2/search", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        query: input.officialOnly ? `${input.query} site:homeaffairs.gov.au OR site:immi.homeaffairs.gov.au OR site:legislation.gov.au` : input.query,
        limit: input.maxResults ?? 5,
        sources: ["web"],
        country: "AU",
        scrapeOptions: { formats: ["markdown"], onlyMainContent: true }
      })
    });

    if (!response.ok) throw new Error(`Firecrawl search failed: ${response.status}`);
    const payload = await response.json() as { data?: { web?: Array<{ title?: string; description?: string; url?: string; markdown?: string }> } };

    return {
      provider: this.name,
      configured: true,
      query: input.query,
      results: (payload.data?.web ?? [])
        .filter((item) => item.url)
        .map((item) => ({
          title: cleanText(item.title || item.url),
          url: String(item.url),
          content: cleanText(item.markdown || item.description),
          sourceType: officialSourceType(String(item.url))
        }))
    };
  }
}

export function getWebResearchProvider(): WebResearchProvider {
  const provider = (process.env.WEB_RESEARCH_PROVIDER || process.env.SEARCH_PROVIDER || "").toLowerCase();
  if (provider === "tavily") return new TavilyResearchProvider();
  if (provider === "firecrawl") return new FirecrawlResearchProvider();
  if (!provider && process.env.TAVILY_API_KEY) return new TavilyResearchProvider();
  if (!provider && process.env.FIRECRAWL_API_KEY) return new FirecrawlResearchProvider();
  return new DisabledResearchProvider();
}

export async function researchMigrationQuestion(query: string) {
  const provider = getWebResearchProvider();
  return provider.search({
    query: `${query} Australian migration visa official`,
    maxResults: 5,
    officialOnly: true
  });
}
