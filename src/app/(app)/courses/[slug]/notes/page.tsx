"use client";

import { useEffect, useState } from "react";
import { ContentEditor } from "@/components/content-editor";
import { CourseTabs } from "@/components/course-tabs";
import { ContributionMeta } from "@/components/contribution-meta";
import { PageHeading } from "@/components/page-heading";
import { RichContent } from "@/components/rich-content";
import { Badge, Panel } from "@/components/ui";
import { useAppData } from "@/lib/client/store";

export default function NotesPage() {
  const { data, refresh } = useAppData(); const [open, setOpen] = useState(false); const [filter, setFilter] = useState("All");
  const pending = data?.notes.some(item => item.mode === "PDF" && !["CLEAN", "REJECTED", "FAILED"].includes(item.uploadStatus ?? ""));
  useEffect(() => { if (!pending) return; const timer = window.setInterval(() => void refresh(), 10000); return () => clearInterval(timer); }, [pending, refresh]);
  const notes = data?.notes.filter(item => filter === "All" || item.mode === filter) ?? [];
  return <><PageHeading course title="Notes" description="Share plain text, Markdown with LaTeX, or a PDF. Every note is attributed." action={<button className="button button-primary" onClick={() => setOpen(true)} type="button">Add notes</button>} /><CourseTabs /><label className="field filter-field"><span>Format</span><select className="select" value={filter} onChange={event => setFilter(event.target.value)}>{["All", "Plain text", "Markdown + LaTeX", "PDF"].map(value => <option key={value}>{value}</option>)}</select></label><div className="stack">{notes.map(item => <article id={item.id} key={item.id}><Panel title={item.title} action={<Badge>{item.mode}</Badge>}>{item.mode === "PDF" ? <div className="stack"><p>File status: <Badge tone={item.uploadStatus === "CLEAN" ? "success" : "warning"}>{item.uploadStatus ?? "Pending"}</Badge></p>{item.uploadId && item.uploadStatus === "CLEAN" && item.visibility === "PUBLISHED" ? <a className="button" href={`/api/v1/uploads/${item.uploadId}/view`} target="_blank" rel="noopener noreferrer">Open PDF</a> : <p className="muted small">{["REJECTED", "FAILED"].includes(item.uploadStatus ?? "") ? "This PDF could not be approved. Edit the note to replace the file." : "This PDF is private while it is validated and scanned. Status refreshes automatically."}</p>}</div> : item.mode === "Plain text" ? <p className="plain-content">{item.body}</p> : <RichContent source={item.body} />}<ContributionMeta item={item} kind="NOTE" /></Panel></article>)}{!notes.length ? <Panel><p className="empty-state">No notes in this format yet.</p></Panel> : null}</div>{open ? <ContentEditor kind="NOTE" onClose={() => setOpen(false)} /> : null}</>;
}
