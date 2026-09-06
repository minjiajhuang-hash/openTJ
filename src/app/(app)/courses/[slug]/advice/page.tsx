"use client";

import { useState } from "react";
import { ContentEditor } from "@/components/content-editor";
import { CourseTabs } from "@/components/course-tabs";
import { ContributionMeta } from "@/components/contribution-meta";
import { PageHeading } from "@/components/page-heading";
import { RichContent } from "@/components/rich-content";
import { Badge, Panel } from "@/components/ui";
import { useAppData } from "@/lib/client/store";

export default function AdvicePage() {
  const { data } = useAppData(); const [open, setOpen] = useState(false); const [assessment, setAssessment] = useState("");
  return <><PageHeading course title="Advice" description="Course reflections and practical ways to prepare for individual assignments." action={<button className="button button-primary" onClick={() => setOpen(true)} type="button">Add advice</button>} /><CourseTabs /><div className="two-column-grid">{[["GENERAL", "General Advice"], ["ASSESSMENT_SPECIFIC", "Assignment/Assessment Advice"]].map(([type,title]) => <Panel key={type} title={title}>{type === "ASSESSMENT_SPECIFIC" ? <label className="field"><span>Filter by assessment</span><select className="select" onChange={event => setAssessment(event.target.value)} value={assessment}><option value="">All assessments</option>{data?.assessments.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label> : null}<div className="stack">{data?.advice.filter(item => item.type === type && (type === "GENERAL" || !assessment || item.assessmentId === assessment)).map(item => <article className="content-card" id={item.id} key={item.id}><h3>{item.title}</h3>{item.assessment ? <Badge tone="blue">{item.assessment}</Badge> : null}<RichContent source={item.body} /><ContributionMeta item={item} kind="ADVICE" /></article>)}{!data?.advice.some(item => item.type === type && (type === "GENERAL" || !assessment || item.assessmentId === assessment)) ? <p className="empty-state">No advice here yet.</p> : null}</div></Panel>)}</div>{open ? <ContentEditor kind="ADVICE" onClose={() => setOpen(false)} /> : null}</>;
}
