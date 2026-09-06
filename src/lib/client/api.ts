export class ApiError extends Error {
  constructor(message: string, public code: string, public status: number) { super(message); }
}

export async function api<T = Record<string, unknown>>(path: string, options: { method?: string; body?: unknown; signal?: AbortSignal; headers?: Record<string, string> } = {}): Promise<T> {
  const form = options.body instanceof FormData;
  const response = await fetch(`/api/v1${path}`, {
    method: options.method ?? (options.body ? "POST" : "GET"),
    credentials: "same-origin", cache: "no-store", signal: options.signal,
    headers: { ...(options.body && !form ? { "Content-Type": "application/json" } : {}), ...options.headers },
    body: options.body ? form ? options.body as FormData : JSON.stringify(options.body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = payload.error ?? payload;
    const details = error.fieldErrors ? Object.entries(error.fieldErrors).map(([key, value]) => `${key}: ${(value as string[]).join(", ")}`).join("; ") : "";
    throw new ApiError(`${error.message ?? "The request failed. Please try again."}${details ? ` ${details}` : ""}`, error.code ?? "REQUEST_FAILED", response.status);
  }
  return (payload.data ?? payload) as T;
}

export type User = { id: string; displayName: string; username: string; isAdmin?: boolean; isCourseStaff?: boolean; isTeacher?: boolean; policyAccepted?: boolean };
export type Course = { id: string; slug: string; name: string; description: string; joined?: boolean; role?: string; memberCount?: number; archivedAt?: string | null };
export type ContentMeta = { id: string; author: string; authorId: string; username: string; version: number; visibility: string; locked: boolean; createdAt: string; updatedAt: string; moderationReason?: string; parentHidden?: boolean };
export type Assessment = ContentMeta & { title: string; kind: string; summary: string; description: string; date: string; topics: string[]; templates: string[]; major: boolean; calendarEventId?: string };
export type CalendarUpdate = ContentMeta & { body: string; eventId?: string };
export type CalendarEvent = ContentMeta & { title: string; start: string; end?: string; allDay: boolean; kind: string; details: string; assessmentId?: string; updates: CalendarUpdate[] };
export type Note = ContentMeta & { title: string; mode: "Plain text" | "Markdown + LaTeX" | "PDF"; body: string; uploadId?: string; uploadStatus?: string };
export type Advice = ContentMeta & { type: "GENERAL" | "ASSESSMENT_SPECIFIC"; assessment?: string; assessmentId?: string; title: string; body: string };
export type Question = ContentMeta & { assessment: string; assessmentId: string; bankId: string; type: "SINGLE_CHOICE" | "SHORT_ANSWER" | "LONG_RESPONSE"; prompt: string; skills: string[]; choices?: string[]; revisionId: string; graded: boolean; shortAnswerMode?: string; unit?: string };
export type Attempt = { id: string; assessment: string; prompt: string; response: string; result: string; when: string; createdAt?: string; revisionId?: string };
export type CourseData = { course: Course; user: User; permissions: { canModerate: boolean; isAdmin: boolean }; assessments: Assessment[]; events: CalendarEvent[]; notes: Note[]; advice: Advice[]; questions: Question[]; banks: { id: string; assessmentId: string; title?: string }[]; nextCursors?: Partial<Record<ContentKind, string | null>>; notices?: { id: string; contentItemId: string; type: string; reason: string; createdAt: string; appeals: { status: string; resolution?: string }[] }[] };
export type ContentKind = "ASSESSMENT" | "CALENDAR_EVENT" | "CALENDAR_UPDATE" | "NOTE" | "ADVICE" | "QUESTION";
export const visible = (item: ContentMeta) => item.visibility === "PUBLISHED" && !item.parentHidden;
export function dateLabel(value?: string) { if (!value) return "Not scheduled"; const date = new Date(value.length === 10 ? `${value}T12:00:00` : value); return Number.isNaN(date.getTime()) ? value : date.toLocaleString("en-US", value.length === 10 ? { month: "short", day: "numeric", year: "numeric" } : { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" }); }
