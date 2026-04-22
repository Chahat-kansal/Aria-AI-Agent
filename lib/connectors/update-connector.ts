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

export class SeededHomeAffairsConnector implements OfficialUpdateConnector {
  name = "home-affairs-seeded";

  async fetchUpdates(): Promise<OfficialUpdatePayload[]> {
    return [
      {
        source: "Department of Home Affairs",
        sourceUrl: "https://example.gov.au/update/skilled-occupation-list",
        title: "Skilled occupation list amendments",
        summary: "Several ANZSCO occupations have updated caveats and evidence expectations.",
        updateType: "Policy update",
        effectiveDate: "2026-04-01",
        publishedAt: "2026-03-28",
        rawContent: "Seeded snapshot v1"
      }
    ];
  }
}
