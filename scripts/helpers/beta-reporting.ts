export function estimatedHoursSavedForWorkspace(metrics: {
  documentsProcessed: number;
  draftsGenerated: number;
  confirmationsCompleted: number;
  pathwayAnalyses: number;
  remindersSent: number;
}) {
  return Number((
    metrics.documentsProcessed * 0.08
    + metrics.draftsGenerated * 0.2
    + metrics.confirmationsCompleted * 0.06
    + metrics.pathwayAnalyses * 0.15
    + metrics.remindersSent * 0.03
  ).toFixed(1));
}
