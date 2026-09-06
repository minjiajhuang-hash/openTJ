"use client";

import Link from "next/link";
import { CourseTabs } from "@/components/course-tabs";
import { PageHeading } from "@/components/page-heading";
import { Badge, Panel } from "@/components/ui";
import { dateLabel, visible } from "@/lib/client/api";
import { useAppData } from "@/lib/client/store";

export default function CourseDashboardPage() {
  const { data, slug } = useAppData(); if (!data) return null;
  const activity = [...data.notes.map(item => ({ ...item, section: "notes" })), ...data.advice.map(item => ({ ...item, section: "advice" })), ...data.assessments.map(item => ({ ...item, section: "assessments" }))].filter(visible).sort((a,b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 8);
  const upcoming = data.events.filter(visible).filter(item => item.start.slice(0, 10) >= new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" })).sort((a,b) => a.start.localeCompare(b.start)).slice(0, 6);
  return <><PageHeading course title={data.course.name} description="Student-maintained course workspace" /><CourseTabs /><div className="notice notice-warning">Confirm dates and assessment details with your teacher’s official sources.</div><div className="dashboard-grid"><div className="stack"><Panel title="About this course"><p>{data.course.description}</p><span className="muted">{data.course.memberCount ?? 0} members</span></Panel><Panel title="Recent contributions"><ul className="item-list">{activity.map(item => <li key={item.id}><Link href={`/courses/${slug}/${item.section}#${item.id}`}><strong>{item.title}</strong></Link><div className="meta">{item.author} · {dateLabel(item.updatedAt)}</div></li>)}</ul>{!activity.length ? <p className="empty-state">Be the first to share notes or advice.</p> : null}</Panel></div><aside className="stack"><Panel title="Upcoming"><ul className="item-list">{upcoming.map(item => <li key={item.id}><Link href={`/courses/${slug}/calendar#${item.id}`}>{item.title}</Link><div className="meta">{dateLabel(item.start)}</div></li>)}</ul>{!upcoming.length ? <p className="empty-state">No upcoming events.</p> : null}</Panel><Panel title="Major assessments">{data.assessments.filter(item => visible(item) && item.major).map(item => <p key={item.id}><Link href={`/courses/${slug}/questions?assessment=${item.id}`}>{item.title}</Link> <Badge tone="blue">Practice bank</Badge></p>)}</Panel></aside></div></>;
}
