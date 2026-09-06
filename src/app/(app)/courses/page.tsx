"use client";

import Link from "next/link";
import { PageHeading } from "@/components/page-heading";
import { AsyncForm, Badge, Panel } from "@/components/ui";
import { useAppData } from "@/lib/client/store";

export default function CoursesPage() {
  const { courses, isAdmin, loading, error, mutate } = useAppData();
  return <><PageHeading title="Courses" description="Your shared space for dates, study notes, advice, and original practice." />
    <div className="notice notice-warning">Student-contributed information. Always verify dates and requirements with your teacher’s official sources.</div>
    {loading ? <p role="status">Loading courses…</p> : null}{error ? <p className="notice notice-warning" role="alert">{error}</p> : null}
    <div className="dashboard-grid"><div className="stack">{courses.map(course => <Panel key={course.id} title={course.name} action={<Badge>{course.joined || isAdmin ? course.role === "STAFF" ? "Course staff" : "Member" : "Membership required"}</Badge>}><p>{course.description}</p><div className="split wrap"><span className="muted">{course.memberCount ?? 0} members</span>{course.joined || isAdmin ? <Link className="button button-primary" href={`/courses/${course.slug}`}>Open course</Link> : <span className="muted small">Use a join code to access this course.</span>}</div></Panel>)}{!loading && !courses.length ? <p className="empty-state">No courses are available yet.</p> : null}</div>
    <aside className="stack"><Panel title="Join a course"><AsyncForm label="Join course" onSubmit={async form => { await mutate("/courses/join", { code: form.get("code") }); }}><label className="field"><span>Course join code</span><input autoComplete="off" className="input" name="code" required maxLength={100} /></label></AsyncForm></Panel><Panel title="Your contributions"><p>Your name and username appear beside everything you share.</p><p className="muted small">Only course members can view course material. Your practice history is private.</p></Panel>{isAdmin ? <Link className="button" href="/admin">Create or manage courses</Link> : null}</aside></div>
  </>;
}
