export type OfficialUpdatePayload = {
  source: string;
  sourceUrl: string;
  title: string;
  summary: string;
  updateType: string;
  effectiveDate?: string;
  publishedAt: string;
  rawContent: string;
};

export interface OfficialUpdateConnector {
  name: string;
  fetchUpdates(): Promise<OfficialUpdatePayload[]>;
}

export function getConfiguredOfficialUpdateConnectors(): OfficialUpdateConnector[] {
  // Real official-source connectors should be registered here when credentials and source URLs are configured.
  return [];
}
