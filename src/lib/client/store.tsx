"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, ApiError, type ContentKind, type ContentMeta, type Course, type CourseData, type User } from "./api";

type PagedKind = Exclude<ContentKind, "CALENDAR_UPDATE">;
const collection = { ASSESSMENT: "assessments", CALENDAR_EVENT: "events", NOTE: "notes", ADVICE: "advice", QUESTION: "questions" } as const;
const sectionKind: Record<string, PagedKind> = { assessments: "ASSESSMENT", calendar: "CALENDAR_EVENT", notes: "NOTE", advice: "ADVICE", questions: "QUESTION" };
type Store = { user: User | null; courses: Course[]; isAdmin: boolean; canModerate: boolean; data: CourseData | null; slug: string; loading: boolean; error: string | null; linkedError: string | null; linkedLoading: boolean; refresh(): Promise<void>; loadMore(kind: PagedKind): Promise<void>; mutate(path: string, body?: unknown, method?: string): Promise<unknown> };
const Context = createContext<Store | null>(null);

export function ApiDataProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const router = useRouter();
  const slug = /^\/courses\/([^/]+)/.exec(pathname)?.[1] ?? "";
  const [user, setUser] = useState<User | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [data, setData] = useState<CourseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [linkedUrl, setLinkedUrl] = useState("");
  const [linkedError, setLinkedError] = useState<string | null>(null);
  const [linkedLoading, setLinkedLoading] = useState(false);
  const processedLink = useRef("");
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    const requestGeneration = ++generation.current;
    try {
      const [session, listing, course] = await Promise.all([
        api<User | { user: User }>("/auth/session"),
        api<{ courses: Course[]; isAdmin: boolean }>("/courses"),
        slug ? api<CourseData>(`/courses/${encodeURIComponent(slug)}`) : Promise.resolve(null),
      ]);
      if (requestGeneration !== generation.current) return;
      setUser("user" in session ? session.user : session); setCourses(listing.courses); setIsAdmin(listing.isAdmin); setData(course); setError(null);
    } catch (err) {
      if (requestGeneration !== generation.current) return;
      if (err instanceof ApiError && err.status === 401) router.replace("/login");
      setError(err instanceof Error ? err.message : "Unable to load the workspace."); setData(null);
    } finally { if (requestGeneration === generation.current) setLoading(false); }
  }, [slug, router]);
  useEffect(() => { let active = true; queueMicrotask(() => { if (active) { setLoading(true); void refresh(); } }); return () => { active = false; }; }, [refresh]);
  useEffect(() => {
    const update = () => setLinkedUrl(window.location.href);
    // Same-page Next Link navigation can use pushState without hashchange.
    const clicked = (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href);
      if (url.origin === window.location.origin && url.pathname === window.location.pathname && url.hash) setLinkedUrl(url.href);
    };
    queueMicrotask(update);
    window.addEventListener("hashchange", update);
    window.addEventListener("popstate", update);
    document.addEventListener("click", clicked);
    return () => { window.removeEventListener("hashchange", update); window.removeEventListener("popstate", update); document.removeEventListener("click", clicked); };
  }, [pathname, search]);
  useEffect(() => {
    if (!linkedUrl || !data || data.course.slug !== slug) return;
    const url = new URL(linkedUrl);
    const parts = url.pathname.split("/");
    const kind = sectionKind[parts[3] ?? ""];
    const id = url.hash.slice(1);
    if (parts[2] !== slug || !kind || !/^[a-zA-Z0-9_-]{1,150}$/.test(id)) {
      queueMicrotask(() => { setLinkedError(null); setLinkedLoading(false); });
      return;
    }
    const key = collection[kind];
    const existing = data[key].find(item => item.id === id) as (ContentMeta & { assessmentId?: string }) | undefined;
    const parentMissing = kind === "QUESTION" && existing?.assessmentId && !data.assessments.some(item => item.id === existing.assessmentId);
    if (processedLink.current === linkedUrl && existing && !parentMissing) return;
    const controller = new AbortController();
    let frame = 0;
    queueMicrotask(async () => {
      if (controller.signal.aborted) return;
      setLinkedError(null);
      setLinkedLoading(!existing || Boolean(parentMissing));
      try {
        if (!existing || parentMissing) {
          const item = existing ?? await api<ContentMeta & { assessmentId?: string }>(`/courses/${encodeURIComponent(slug)}/content/${encodeURIComponent(id)}`, { signal: controller.signal });
          const expectedField = { ASSESSMENT: "topics", CALENDAR_EVENT: "start", NOTE: "mode", ADVICE: "body", QUESTION: "revisionId" }[kind];
          if (!(expectedField in item)) throw new Error("This contribution belongs to a different course section.");
          const assessment = kind === "QUESTION" && item.assessmentId && !data.assessments.some(value => value.id === item.assessmentId)
            ? await api<CourseData["assessments"][number]>(`/courses/${encodeURIComponent(slug)}/content/${encodeURIComponent(item.assessmentId)}`, { signal: controller.signal }) : null;
          if (controller.signal.aborted) return;
          setData(current => {
            if (!current || current.course.slug !== slug) return current;
            return { ...current, [key]: current[key].some(value => value.id === item.id) ? current[key] : [...current[key], item],
              ...(assessment ? { assessments: current.assessments.some(value => value.id === assessment.id) ? current.assessments : [...current.assessments, assessment] } : {}) };
          });
          setLinkedLoading(false);
          return;
        }
        setLinkedLoading(false);
        // The question selector listens for hashes. Allow it to render before
        // scrolling to a contribution that was absent from the initial page.
        frame = requestAnimationFrame(() => {
          if (window.location.hash.slice(1) !== id) return;
          window.dispatchEvent(new Event("hashchange"));
          frame = requestAnimationFrame(() => { document.getElementById(id)?.scrollIntoView({ block: "center" }); processedLink.current = linkedUrl; });
        });
      } catch (reason) {
        if (!controller.signal.aborted) { setLinkedError(reason instanceof Error ? reason.message : "This linked contribution is unavailable."); setLinkedLoading(false); }
      }
    });
    return () => { controller.abort(); cancelAnimationFrame(frame); };
  }, [data, linkedUrl, slug]);
  const mutate = async (path: string, body?: unknown, method?: string) => { const result = await api(path, { body, method }); await refresh(); return result; };
  const loadMore = async (kind: PagedKind) => {
    const cursor = data?.nextCursors?.[kind]; if (!cursor) return;
    const page = await api<{ items: ContentMeta[]; nextCursor: string | null }>(`/courses/${encodeURIComponent(slug)}/content?kind=${kind}&limit=100&cursor=${encodeURIComponent(cursor)}`);
    setData(current => {
      if (!current || current.course.slug !== slug) return current;
      const key = collection[kind]; const existing = new Set(current[key].map(item => item.id));
      return { ...current, [key]: [...current[key], ...page.items.filter(item => !existing.has(item.id))], nextCursors: { ...current.nextCursors, [kind]: page.nextCursor } };
    });
  };
  const canModerate = isAdmin || Boolean(data?.permissions.canModerate) || courses.some((course) => course.role === "STAFF");
  return <Context.Provider value={{ user, courses, isAdmin, canModerate, data, slug, loading, error, linkedError, linkedLoading, refresh, loadMore, mutate }}>{children}</Context.Provider>;
}

export function useAppData() { const value = useContext(Context); if (!value) throw new Error("ApiDataProvider is required."); return value; }

export function CourseGate({ children }: { children: ReactNode }) {
  const { loading, error, data, slug, refresh, linkedError, linkedLoading } = useAppData();
  if (loading) return <p role="status" className="empty-state">Loading course…</p>;
  if (error || !data || data.course.slug !== slug) return <div className="notice notice-warning" role="alert"><p>{error ?? "Course unavailable."}</p><Link className="button" href="/courses">Back to courses</Link> <button className="button" onClick={() => void refresh()} type="button">Retry</button></div>;
  return <><CourseNotices notices={data.notices ?? []} />{linkedLoading ? <p role="status">Loading linked contribution…</p> : null}{linkedError ? <p className="notice notice-warning" role="alert">{linkedError}</p> : null}{children}<CoursePagination /></>;
}

function CourseNotices({ notices }: { notices: NonNullable<CourseData["notices"]> }) {
  const [dismissed, setDismissed] = useState<string[]>([]);
  // A new appeal decision makes a dismissed notice visible again.
  const noticeKey = (notice: typeof notices[number]) => `${notice.id}:${notice.appeals.map(appeal => `${appeal.status}:${appeal.resolution ?? ""}`).join("|")}`;
  const shown = notices.filter(notice => !dismissed.includes(noticeKey(notice)));
  if (!shown.length) return null;
  const labels: Record<string, string> = { HIDE: "Contribution hidden", RESTORE: "Contribution restored", LOCK: "Contribution locked", UNLOCK: "Contribution unlocked" };
  const appealLabels: Record<string, string> = { OPEN: "Appeal awaiting review", UPHELD: "Takedown upheld", OVERTURNED: "Takedown overturned" };
  return <aside className="notice" aria-label="Updates to your contributions"><details open><summary><strong>Updates to your contributions ({shown.length})</strong></summary><ul className="stack" style={{ marginTop: 8, maxHeight: 280, overflowY: "auto", paddingLeft: 20 }}>{shown.map(notice => <li key={noticeKey(notice)}>
    <strong>{labels[notice.type] ?? notice.type}</strong><span className="muted small"> · {new Date(notice.createdAt).toLocaleDateString("en-US", { timeZone: "America/New_York" })}</span>
    <p>{notice.reason}</p>{notice.appeals.map((appeal, index) => <p key={index}><strong>{appealLabels[appeal.status] ?? appeal.status}.</strong>{appeal.resolution ? ` ${appeal.resolution}` : ""}</p>)}
    <button className="button" type="button" aria-label={`Dismiss notice: ${notice.reason.slice(0, 80)}`} onClick={() => setDismissed(current => [...current, noticeKey(notice)])}>Dismiss</button>
  </li>)}</ul></details></aside>;
}

function CoursePagination() {
  const { data, loadMore } = useAppData(); const pathname = usePathname();
  const [pending, setPending] = useState(false); const [error, setError] = useState("");
  const section = pathname.split("/")[3];
  const kind = ({ assessments: "ASSESSMENT", calendar: "CALENDAR_EVENT", notes: "NOTE", advice: "ADVICE", questions: "QUESTION" } as Record<string, PagedKind>)[section ?? ""];
  if (!kind || !data?.nextCursors?.[kind]) return null;
  return <div style={{ marginTop: 16 }}><button className="button" type="button" disabled={pending} onClick={async () => {
    setPending(true); setError(""); try { await loadMore(kind); } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to load more contributions."); } finally { setPending(false); }
  }}>{pending ? "Loading…" : "Load older contributions"}</button>{error && <p role="alert">{error}</p>}</div>;
}
