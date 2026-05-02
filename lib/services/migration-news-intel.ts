type MigrationNewsFeedItem = {
  title: string;
  articleUrl: string;
  sourceName: string;
  sourceSiteUrl?: string | null;
  publishedAt?: string | null;
  summary: string;
  feedUrl: string;
  fetchedAt: string;
};

const GOOGLE_NEWS_FEEDS = [
  "https://news.google.com/rss/search?q=Australia+visa+OR+immigration+policy&hl=en-AU&gl=AU&ceid=AU:en",
  "https://news.google.com/rss/search?q=Department+of+Home+Affairs+visa&hl=en-AU&gl=AU&ceid=AU:en",
  "https://news.google.com/rss/search?q=Australian+migration+update+482+OR+485+OR+189&hl=en-AU&gl=AU&ceid=AU:en",
  "https://news.google.com/rss/search?q=Australian+student+visa+update+subclass+500&hl=en-AU&gl=AU&ceid=AU:en",
  "https://news.google.com/rss/search?q=Australian+skilled+visa+update+189+190+491&hl=en-AU&gl=AU&ceid=AU:en",
  "https://news.google.com/rss/search?q=Australian+employer+sponsored+visa+update+482+186&hl=en-AU&gl=AU&ceid=AU:en",
  "https://news.google.com/rss/search?q=Australian+partner+visa+update+820+801&hl=en-AU&gl=AU&ceid=AU:en"
];

function decodeXml(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'");
}

function stripHtml(value: string) {
  return decodeXml(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getTagValue(xml: string, tag: string) {
  const match = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? decodeXml(match[1]).trim() : "";
}

function getSource(xml: string) {
  const match = xml.match(/<source(?:\s+url="([^"]+)")?>([\s\S]*?)<\/source>/i);
  if (!match) {
    return {
      sourceName: "Unknown source",
      sourceSiteUrl: null
    };
  }

  return {
    sourceName: stripHtml(match[2]) || "Unknown source",
    sourceSiteUrl: match[1] ? decodeXml(match[1]).trim() : null
  };
}

function parseRssItems(xml: string, feedUrl: string) {
  const fetchedAt = new Date().toISOString();
  return Array.from(xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)).map((match) => {
    const itemXml = match[1];
    const { sourceName, sourceSiteUrl } = getSource(itemXml);
    const title = stripHtml(getTagValue(itemXml, "title"));
    const articleUrl = getTagValue(itemXml, "link");
    const description = getTagValue(itemXml, "description");
    const summary = stripHtml(description).slice(0, 1200);
    const publishedAt = getTagValue(itemXml, "pubDate") || null;

    return {
      title,
      articleUrl,
      sourceName,
      sourceSiteUrl,
      publishedAt,
      summary,
      feedUrl,
      fetchedAt
    } satisfies MigrationNewsFeedItem;
  });
}

async function fetchFeed(feedUrl: string) {
  const response = await fetch(feedUrl, {
    headers: {
      "User-Agent": "AriaMigrationIntel/1.0 (+https://aria.local)"
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Google News RSS request failed (${response.status}) for ${feedUrl}`);
  }

  const xml = await response.text();
  return parseRssItems(xml, feedUrl);
}

export async function fetchMigrationNewsIntel() {
  const results = await Promise.allSettled(GOOGLE_NEWS_FEEDS.map((feedUrl) => fetchFeed(feedUrl)));
  const items: MigrationNewsFeedItem[] = [];
  const errors: string[] = [];

  for (const result of results) {
    if (result.status === "fulfilled") {
      items.push(...result.value);
    } else {
      errors.push(result.reason instanceof Error ? result.reason.message : String(result.reason));
    }
  }

  const deduped = items.filter((item, index, array) => {
    const key = `${item.articleUrl}::${item.title}`.toLowerCase();
    return array.findIndex((candidate) => `${candidate.articleUrl}::${candidate.title}`.toLowerCase() === key) === index;
  });

  return {
    provider: "google-news-rss",
    feedUrls: GOOGLE_NEWS_FEEDS,
    items: deduped,
    errors
  };
}
