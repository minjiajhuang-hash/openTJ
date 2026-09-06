"use client";

import { useState } from "react";
import Link from "next/link";
import { ContentEditor } from "@/components/content-editor";
import { CourseTabs } from "@/components/course-tabs";
import { ContributionMeta } from "@/components/contribution-meta";
import { PageHeading } from "@/components/page-heading";
import { RichContent } from "@/components/rich-content";
import { AsyncForm, Badge, Modal, Panel } from "@/components/ui";
import { dateLabel, type Assessment } from "@/lib/client/api";
import { useAppData } from "@/lib/client/store";

export default function AssessmentsPage() {
  const { data, slug, mutate } = useAppData(); const [open, setOpen] = useState(false); const [link, setLink] = useState<Assessment | null>(null);
  return <><PageHeading course title="Assessments" description="Topics, question templates, and details for tests, quizzes, and assignments." action={<button className="button button-primary" onClick={() => setOpen(true)} type="button">Add assessment</button>} /><CourseTabs /><div className="notice notice-warning">Do not post recalled, copied, photographed, or secured assessment material.</div><div className="stack">{data?.assessments.map(item => <article id={item.id} key={item.id}><Panel title={<span>{item.title} <Badge>{item.kind}</Badge></span>} action={item.major ? <Badge tone="blue">Major assessment</Badge> : undefined}><div className="assessment-grid"><div><p>{item.summary}</p>{item.description ? <RichContent source={item.description} /> : null}<p className="muted">{dateLabel(item.date)}</p>{!item.date ? <button className="button" onClick={() => setLink(item)} type="button">Add to calendar</button> : <Link className="button" href={`/courses/${slug}/calendar${item.calendarEventId ? `#${item.calendarEventId}` : ""}`}>View on calendar</Link>}</div><div className="nested-card"><h3>Topics</h3><ul>{item.topics.map((topic,index) => <li key={index}>{topic}</li>)}</ul></div><div className="nested-card"><h3>Question templates</h3><ul>{item.templates.map((template,index) => <li key={index}>{template}</li>)}</ul></div></div>{item.major ? <p><Link href={`/courses/${slug}/questions?assessment=${item.id}`}>Open question bank</Link></p> : null}<ContributionMeta item={item} kind="ASSESSMENT" /></Panel></article>)}{!data?.assessments.length ? <Panel><p className="empty-state">No assessments yet. Add the first test, quiz, or assignment.</p></Panel> : null}</div>
    {open ? <ContentEditor kind="ASSESSMENT" onClose={() => setOpen(false)} /> : null}<Modal open={Boolean(link)} title="Add assessment to calendar" onClose={() => setLink(null)}><AsyncForm label="Add to calendar" onSubmit={async form => { if (link) await mutate(`/courses/${slug}/assessments/${link.id}/calendar`, { title: link.title, start: form.get("start"), kind: "assessment", details: link.summary, allDay: true }); setLink(null); }}><p>{link?.title}</p><label className="field"><span>Date</span><input className="input" name="start" required type="date" /></label></AsyncForm></Modal></>;
}
