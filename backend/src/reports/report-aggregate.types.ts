export type ReportAggregate = {
  attendance: {
    sessions: number;
    presentCount: number;
    absentCount: number;
    ratePct: number;
  };
  evaluations: {
    count: number;
    avgByDimension: Record<string, number | null>;
  };
  mediaCount: number;
  events: Array<{
    id: string;
    title: string;
    startsAt: string;
    endsAt: string;
    type: string;
    status: string;
  }>;
};
