"use client";

import {
  BookOpen,
  ChevronDown,
  FileClock,
  GraduationCap,
  LogOut,
  Menu,
  Scale,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  UserRound,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { BrandMark } from "@/components/brand-mark";
import { ThemeToggle } from "@/components/theme-toggle";
import { api } from "@/lib/client/api";
import { useAppData } from "@/lib/client/store";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { user: currentUser, data, courses, slug, isAdmin, canModerate } = useAppData();
  const user = currentUser ?? { displayName: "Loading?", username: "", id: "" };
  const role = isAdmin ? "administrator" : canModerate ? "course staff" : "member";
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- close transient navigation UI after an external pathname change.
    setDrawerOpen(false);
    setProfileOpen(false);
    setMobileSearchOpen(false);
    setQuery("");
  }, [pathname]);

  const [results, setResults] = useState<{ id: string; title: string; type: string; href: string }[]>([]);
  const [searchError, setSearchError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      if (query.trim().length < 2 || !slug) { setResults([]); setSearchError(""); return; }
      try {
        const response = await api<{ results: { id: string; title?: string; prompt?: string; contentKind: string; assessmentId?: string }[] }>(`/courses/${slug}/search?q=${encodeURIComponent(query.trim())}`, { signal: controller.signal });
        if (controller.signal.aborted) return;
        const sections: Record<string,string> = { ASSESSMENT: "assessments", NOTE: "notes", ADVICE: "advice", QUESTION: "questions" };
        setResults(response.results.map(item => ({ id: item.id, title: item.title ?? item.prompt ?? "Contribution", type: item.contentKind.toLowerCase(), href: `/courses/${slug}/${sections[item.contentKind]}${item.contentKind === "QUESTION" && item.assessmentId ? `?assessment=${item.assessmentId}` : ""}#${item.id}` }))); setSearchError("");
      } catch (reason) { if (!controller.signal.aborted) { setResults([]); setSearchError(reason instanceof Error ? reason.message : "Search failed."); } }
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query, slug]);

  const navItems = [
    { href: "/courses", label: "Courses", icon: GraduationCap, show: true },
    { href: "/me/practice", label: "My practice", icon: FileClock, show: true },
    { href: "/policy", label: "Policy", icon: Scale, show: true },
    { href: "/moderation", label: "Moderation", icon: ShieldCheck, show: canModerate },
    { href: "/admin", label: "Admin", icon: SlidersHorizontal, show: canModerate },
  ];

  async function logout() {
    await api("/auth/logout", { method: "POST", body: {} });
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <header className="app-header">
        <button aria-expanded={drawerOpen} aria-label={drawerOpen ? "Close navigation" : "Open navigation"} className="header-button menu-button" onClick={() => setDrawerOpen((value) => !value)} type="button">
          {drawerOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>
        <Link className="brand header-brand" href="/courses">
          <BrandMark />
          <span className="brand-name">openTJ</span>
        </Link>
        <div className={`header-search${mobileSearchOpen ? " mobile-open" : ""}`}>
          <Search aria-hidden="true" />
          <input
            aria-label="Search current course"
            autoComplete="off"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search this course"
            ref={searchRef}
            maxLength={120}
            value={query}
            disabled={!data}
          />
          {query.trim().length >= 2 && results.length ? (
            <div aria-label="Search results" className="search-results" role="region">
              {results.map((item) => (
                <Link className="search-result" href={item.href} key={item.id}>
                  {item.title}<small>{item.type}</small>
                </Link>
              ))}
            </div>
          ) : query.trim().length >= 2 && data ? <div className="search-results" role="status">{searchError || "No matching contributions."}</div> : null}
        </div>
        <div className="header-actions">
          <button
            aria-label="Search"
            className="header-button menu-button"
            onClick={() => {
              setMobileSearchOpen((value) => !value);
              setTimeout(() => searchRef.current?.focus(), 0);
            }}
            type="button"
          >
            <Search aria-hidden="true" />
          </button>
          <ThemeToggle />
          <div style={{ position: "relative" }}>
            <button aria-expanded={profileOpen} aria-label={`User menu for ${user.displayName}`} className="header-button" onClick={() => setProfileOpen((value) => !value)} type="button">
              <UserRound aria-hidden="true" />
              <span className="header-action-label">{user.displayName}</span>
              <ChevronDown aria-hidden="true" className="header-action-label" />
            </button>
            {profileOpen ? (
              <div className="search-results" style={{ left: "auto", minWidth: 220, right: 0 }}>
                <div style={{ padding: 8 }}>
                  <strong>{user.displayName}</strong>
                  <div className="muted small">@{user.username} · {role}</div>
                </div>
                <button className="search-result" onClick={logout} style={{ border: 0, cursor: "pointer", textAlign: "left", width: "100%" }} type="button">
                  <LogOut aria-hidden="true" style={{ height: 14, marginRight: 6, verticalAlign: "middle", width: 14 }} /> Log out
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <nav aria-label="Main navigation" className={`app-rail${drawerOpen ? " open" : ""}`}>
        <ul className="rail-links">
          {navItems.filter((item) => item.show).map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || (item.href === "/courses" && pathname.startsWith("/courses/"));
            return (
              <li key={item.href}>
                <Link aria-current={active ? "page" : undefined} className={`rail-link${active ? " active" : ""}`} href={{ pathname: item.href }}>
                  <Icon aria-hidden="true" />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
          <li>
            <Link className="rail-link" href={`/courses/${slug || courses.find(course => course.joined)?.slug || "concrete-math-av-p4"}`}>
              <BookOpen aria-hidden="true" />
              <span>Course home</span>
            </Link>
          </li>
        </ul>
      </nav>
      {drawerOpen ? <button aria-label="Close navigation" className="drawer-overlay" onClick={() => setDrawerOpen(false)} type="button" /> : null}
      <main className="app-main" id="main-content" tabIndex={-1}>
        {children}
      </main>
    </>
  );
}
