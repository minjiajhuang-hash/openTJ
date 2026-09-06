"use client";

import { useState } from "react";
import { DateTime } from "luxon";
import { api, type ContentKind } from "@/lib/client/api";
import { useAppData } from "@/lib/client/store";
import { AsyncForm, Modal } from "./ui";
import { RichContent } from "./rich-content";

export function ContentEditor({ kind, item, initial, onClose, eventId }: { kind: ContentKind; item?: object; initial?: Record<string, unknown>; onClose(): void; eventId?: string }) {
  const { slug, data, user, mutate } = useAppData();
  const value = (item ?? initial ?? {}) as Record<string, unknown>;
  const str = (key: string, fallback = "") => String(value[key] ?? fallback);
  const list = (key: string, separator = "\n") => ((value[key] as string[] | undefined) ?? []).join(separator);
  const [mode, setMode] = useState(str("mode", "Plain text"));
  const [type, setType] = useState(str("type", kind === "ADVICE" ? "GENERAL" : "SINGLE_CHOICE"));
  const [gradingMode, setGradingMode] = useState(str("shortAnswerMode", "TEXT"));
  const [allDay, setAllDay] = useState(value.allDay !== false);
  const [preview, setPreview] = useState(false);
  const [body, setBody] = useState(str(kind === "QUESTION" ? "prompt" : "body"));
  const [upload, setUpload] = useState<{ id: string } | null>(value.uploadId ? { id: str("uploadId") } : null);
  const banks = data?.assessments.filter(assessment => assessment.major && assessment.visibility === "PUBLISHED") ?? [];
  const title = `${item ? "Edit" : "Add"} ${kind.toLowerCase().replaceAll("_", " ")}`;
  const text = (name: string, label: string, required = false, rows?: number, fallback = "") => <label className="field"><span>{label}</span>{rows ? <textarea className="textarea" defaultValue={str(name, fallback)} maxLength={30000} name={name} required={required} rows={rows} /> : <input className="input" defaultValue={str(name, fallback)} maxLength={200} name={name} required={required} />}</label>;
  const timeValue = (key: string) => allDay ? str(key).slice(0,10) : value[key] ? DateTime.fromISO(str(key), { zone: "America/New_York" }).toFormat("yyyy-MM-dd'T'HH:mm") : "";
  return <Modal onClose={onClose} open title={title}><AsyncForm label={item ? "Save changes" : "Publish"} onCancel={onClose} onSubmit={async form => {
    const get = (key: string) => String(form.get(key) ?? "").trim();
    const lines = (key: string, separator = "\n") => get(key).split(separator).map(part => part.trim()).filter(Boolean);
    if (!user?.policyAccepted) await api("/policy/accept", { body: {} });
    let payload: Record<string, unknown> = { kind, ...(item ? { version: value.version } : {}) };
    if (kind === "ASSESSMENT") payload = { ...payload, title: get("title"), assessmentType: get("assessmentType"), summary: get("summary"), description: get("description"), topics: lines("topics", ","), templates: lines("templates"), major: form.has("major"), ...(get("date") ? { date: get("date") } : {}), addToCalendar: form.has("calendar") && Boolean(get("date")) };
    if (kind === "CALENDAR_EVENT") {
      const instant = (key: string) => { const parsed = DateTime.fromISO(get(key), { zone: "America/New_York" }); if (!parsed.isValid || parsed.toFormat("yyyy-MM-dd'T'HH:mm") !== get(key)) throw new Error("Enter a valid Eastern time; this time may fall in the daylight-saving gap."); return parsed.toISO(); };
      payload = { ...payload, title: get("title"), eventType: get("eventType"), start: allDay ? get("start") : instant("start"), end: get("end") ? allDay ? get("end") : instant("end") : null, allDay, details: get("details") };
    }
    if (kind === "CALENDAR_UPDATE") payload = { ...payload, calendarEventId: eventId ?? value.eventId, body: get("body") };
    if (kind === "NOTE") {
      let uploadId = upload?.id;
      if (mode === "PDF") {
        const file = form.get("file");
        if (file instanceof File && file.size) {
          if (file.size > 20 * 1024 * 1024) throw new Error("PDFs must be 20 MiB or smaller.");
          const uploadForm = new FormData(); uploadForm.set("file", file); uploadForm.set("courseSlug", slug);
          const result = await api<{ id: string }>("/uploads", { body: uploadForm, headers: { "idempotency-key": crypto.randomUUID() } });
          uploadId = result.id; setUpload(result);
        }
        if (!uploadId) throw new Error("Choose a PDF to upload.");
      }
      payload = { ...payload, title: get("title"), mode, body: mode === "PDF" ? "" : get("body"), uploadId: mode === "PDF" ? uploadId : null };
    }
    if (kind === "ADVICE") payload = { ...payload, title: get("title"), type, body: get("body"), assessmentId: type === "ASSESSMENT_SPECIFIC" ? get("assessmentId") : null };
    if (kind === "QUESTION") {
      const assessmentId = get("assessmentId") || str("assessmentId"); const bankId = data?.banks.find(bank => bank.assessmentId === assessmentId)?.id;
      if (!bankId) throw new Error("Choose a major assessment with a question bank.");
      payload = { ...payload, bankId, type, prompt: get("prompt"), skills: lines("skills", ","), authorized: form.has("authorized"), solution: get("solution"), shortAnswerMode: gradingMode, choices: [], correctChoice: null, acceptedAnswers: [], numericAnswer: null, unit: null, explanations: [] };
      if (type === "SINGLE_CHOICE") payload = { ...payload, choices: lines("choices"), explanations: get("explanations").split("\n"), correctChoice: get("correctChoice") ? Number(get("correctChoice")) - 1 : null };
      if (type === "SHORT_ANSWER") payload = { ...payload, acceptedAnswers: lines("acceptedAnswers", "|"), caseSensitive: form.has("caseSensitive"), numericAnswer: get("numericAnswer") ? Number(get("numericAnswer")) : null, absoluteTolerance: Number(get("absoluteTolerance") || 0), relativeTolerance: Number(get("relativeTolerance") || 0), unit: get("unit") };
    }
    await mutate(`/courses/${slug}/content${item ? `/${value.id}` : ""}`, payload, item ? "PATCH" : "POST"); onClose();
  }}>
    {["ASSESSMENT", "CALENDAR_EVENT", "NOTE", "ADVICE"].includes(kind) ? text("title", "Title", true) : null}
    {kind === "ASSESSMENT" ? <>
      <label className="field"><span>Type</span><select className="select" defaultValue={str("kind", "Test")} name="assessmentType">{["Test", "Quiz", "Assignment", "Other"].map(option => <option key={option}>{option}</option>)}</select></label>
      {text("summary", "Summary", true, 3)}{text("description", "Detailed description (Markdown + LaTeX)", false, 4)}
      <label className="field"><span>Topics (comma separated)</span><input className="input" defaultValue={list("topics", ", ")} name="topics" /></label>
      <label className="field"><span>Question templates (one per line)</span><textarea className="textarea" defaultValue={list("templates")} name="templates" rows={3} /></label>
      <label className="check-row"><input defaultChecked={Boolean(value.major)} name="major" type="checkbox" /> Major assessment with a question bank</label>
      {!value.date ? <><label className="field"><span>Calendar date (optional)</span><input className="input" name="date" type="date" /></label><label className="check-row"><input defaultChecked name="calendar" type="checkbox" /> Add to course calendar when a date is supplied</label></> : <p className="muted small">Edit the linked calendar event to change the assessment date.</p>}
    </> : null}
    {kind === "CALENDAR_EVENT" ? <>
      <label className="field"><span>Type</span><select className="select" defaultValue={str("kind", "assignment")} name="eventType">{["assignment", "assessment", "reminder", "other"].map(option => <option key={option}>{option}</option>)}</select></label>
      <label className="check-row"><input checked={allDay} onChange={event => setAllDay(event.target.checked)} type="checkbox" /> All-day event</label>
      <div className="form-grid"><label className="field"><span>Start {allDay ? "date" : "(Eastern time)"}</span><input className="input" defaultValue={timeValue("start")} key={`start-${allDay}`} name="start" required type={allDay ? "date" : "datetime-local"} /></label><label className="field"><span>End (optional{allDay ? ", exclusive date" : ", Eastern time"})</span><input className="input" defaultValue={timeValue("end")} key={`end-${allDay}`} name="end" type={allDay ? "date" : "datetime-local"} /></label></div>
      {text("details", "Details", false, 4)}
    </> : null}
    {kind === "NOTE" ? <label className="field"><span>Format</span><select className="select" onChange={event => setMode(event.target.value)} value={mode}>{["Plain text", "Markdown + LaTeX", "PDF"].map(option => <option key={option}>{option}</option>)}</select></label> : null}
    {kind === "ADVICE" ? <><label className="field"><span>Section</span><select className="select" onChange={event => setType(event.target.value)} value={type}><option value="GENERAL">General Advice</option><option value="ASSESSMENT_SPECIFIC">Assignment/Assessment Advice</option></select></label>{type === "ASSESSMENT_SPECIFIC" ? <label className="field"><span>Assignment or assessment</span><select className="select" defaultValue={str("assessmentId")} name="assessmentId" required><option value="">Choose an assessment</option>{data?.assessments.filter(item => item.visibility === "PUBLISHED").map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label> : null}</> : null}
    {kind === "NOTE" && mode === "PDF" ? <><label className="field"><span>{upload ? "Replace PDF (optional)" : "PDF file"}</span><input accept="application/pdf,.pdf" className="input" name="file" required={!upload} type="file" /></label><p className="muted small">Maximum 20 MiB and 200 pages. Your note appears after the file passes validation and malware scanning.</p></> : ["NOTE", "ADVICE", "CALENDAR_UPDATE"].includes(kind) ? <><label className="field"><span>Content{mode === "Markdown + LaTeX" || kind === "ADVICE" ? " (Markdown + LaTeX)" : ""}</span><textarea className="textarea long-editor" maxLength={30000} name="body" onChange={event => setBody(event.target.value)} required rows={8} value={body} /></label>{mode === "Markdown + LaTeX" || kind === "ADVICE" ? <><button className="button" onClick={() => setPreview(!preview)} type="button">{preview ? "Hide" : "Show"} preview</button>{preview ? <RichContent source={body} /> : null}</> : null}</> : null}
    {kind === "QUESTION" ? <>
      <label className="field"><span>Major assessment</span><select className="select" defaultValue={str("assessmentId", banks[0]?.id)} disabled={Boolean(item)} name="assessmentId" required>{banks.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
      <label className="field"><span>Question type</span><select className="select" onChange={event => setType(event.target.value)} value={type}><option value="SINGLE_CHOICE">Single choice</option><option value="SHORT_ANSWER">Short answer</option><option value="LONG_RESPONSE">Long response</option></select></label>
      {text("prompt", "Prompt (Markdown + LaTeX)", true, 5)}
      <label className="field"><span>Skills (comma separated)</span><input className="input" defaultValue={list("skills", ", ")} name="skills" required /></label>
      {type === "SINGLE_CHOICE" ? <><label className="field"><span>Choices (one per line; at least two)</span><textarea className="textarea" defaultValue={list("choices")} name="choices" required rows={4} /></label><label className="field"><span>Correct choice number (optional)</span><input className="input" defaultValue={value.correctChoice === undefined || value.correctChoice === null ? "" : Number(value.correctChoice) + 1} min={1} name="correctChoice" type="number" /></label><label className="field"><span>Choice explanations (one per line, matching choice order)</span><textarea className="textarea" defaultValue={list("explanations")} name="explanations" rows={4} /></label></> : null}
      {type === "SHORT_ANSWER" ? <><label className="field"><span>Answer checking</span><select className="select" onChange={event => setGradingMode(event.target.value)} value={gradingMode}><option value="TEXT">Exact text with aliases</option><option value="NUMERIC">Numeric with tolerance</option></select></label>{gradingMode === "TEXT" ? <><label className="field"><span>Accepted answers (optional; separate aliases with |)</span><input className="input" defaultValue={list("acceptedAnswers", "|")} name="acceptedAnswers" /></label><label className="check-row"><input defaultChecked={Boolean(value.caseSensitive)} name="caseSensitive" type="checkbox" /> Case sensitive</label></> : <><label className="field"><span>Numeric answer (optional)</span><input className="input" defaultValue={str("numericAnswer")} name="numericAnswer" step="any" type="number" /></label><div className="form-grid">{["absoluteTolerance", "relativeTolerance"].map(key => <label className="field" key={key}><span>{key === "absoluteTolerance" ? "Absolute tolerance" : "Relative tolerance (fraction)"}</span><input className="input" defaultValue={str(key, "0")} min={0} name={key} step="any" type="number" /></label>)}</div>{text("unit", "Unit (optional)")}</>}</> : null}
      {text("solution", "Detailed solution or rubric (optional, Markdown + LaTeX)", false, 5)}
      {item ? <p className="muted small">Saving creates a new question revision. Earlier attempts retain the original question.</p> : null}
      <label className="check-row"><input name="authorized" required type="checkbox" /> I affirm this question is original or authorized and does not reproduce secured assessment material.</label>
    </> : null}
    {!user?.policyAccepted ? <label className="check-row"><input required type="checkbox" /> I have read and accept the <a href="/policy" rel="noreferrer" target="_blank">contribution policy</a>.</label> : null}
  </AsyncForm></Modal>;
}
