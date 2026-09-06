"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ContentEditor } from "@/components/content-editor";
import { CourseTabs } from "@/components/course-tabs";
import { ContributionMeta } from "@/components/contribution-meta";
import { PageHeading } from "@/components/page-heading";
import { RichContent } from "@/components/rich-content";
import { Badge, Panel } from "@/components/ui";
import { api, type Question } from "@/lib/client/api";
import { useAppData } from "@/lib/client/store";

type Feedback = { id: string; result: string; feedback?: string | string[] | { explanations?: string[]; message?: string }; explanations?: string[] };

function PracticeQuestion({ question }: { question: Question }) {
  const { slug } = useAppData(); const [answer, setAnswer] = useState(""); const [result, setResult] = useState<Feedback | null>(null); const [solution, setSolution] = useState<string | null>(null); const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(false); const pending = useRef(false); const token = useRef<string | null>(null);
  async function check(reveal = false) {
    if (pending.current || (!answer.trim() && !reveal)) return;
    pending.current = true; setBusy(true); setError(null);
    try {
      if (!result && answer.trim()) {
        token.current ??= crypto.randomUUID();
        const response = question.type === "SINGLE_CHOICE" ? { choice: Number(answer) } : question.shortAnswerMode === "NUMERIC" ? { number: Number(answer), unit: question.unit } : { text: answer };
        if (question.shortAnswerMode === "NUMERIC" && !Number.isFinite(Number(answer))) throw new Error("Enter a finite number.");
        setResult(await api<Feedback>(`/courses/${slug}/questions/${question.id}/check`, { body: { revisionId: question.revisionId, idempotencyKey: token.current, ...response } }));
      }
      if (reveal) {
        const response = await api<{ solution: string | null }>(`/courses/${slug}/questions/${question.id}/reveal`, { body: { revisionId: question.revisionId } });
        setSolution(response.solution || "No detailed solution was provided.");
      }
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to check your answer."); }
    finally { pending.current = false; setBusy(false); }
  }
  function change(value: string) { setAnswer(value); setResult(null); setSolution(null); token.current = null; }
  const explanations = result?.explanations ?? (result?.feedback && typeof result.feedback === "object" && !Array.isArray(result.feedback) ? result.feedback.explanations : undefined);
  if (question.visibility !== "PUBLISHED" || question.parentHidden) return <div className="question-stage" id={question.id}><RichContent source={question.prompt} /><p className="notice notice-warning">This question is hidden or its assessment is unavailable. Practice resumes when it is restored.</p><ContributionMeta item={question} kind="QUESTION" /></div>;
  return <div className="question-stage" id={question.id}><div className="badge-row"><Badge>{question.type.replaceAll("_"," ").toLowerCase()}</Badge>{question.skills.map(skill => <Badge key={skill} tone="blue">{skill}</Badge>)}{!question.graded ? <Badge tone="warning">Ungraded</Badge> : null}</div><RichContent className="question-prompt" source={question.prompt} />
    <form onSubmit={event => { event.preventDefault(); void check(question.type === "LONG_RESPONSE" || !question.graded); }}>
      {question.type === "SINGLE_CHOICE" ? <fieldset className="choice-list" disabled={busy}><legend className="sr-only">Answer choices</legend>{question.choices?.map((choice,index) => <label className="choice" key={index}><input checked={answer === String(index)} name="choice" onChange={() => change(String(index))} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); void check(!question.graded); } }} type="radio" value={index} /><RichContent source={choice} /></label>)}</fieldset> : <label className="field"><span>{question.type === "LONG_RESPONSE" ? "Your response" : `Your answer${question.unit ? ` (${question.unit})` : ""}`}</span>{question.type === "LONG_RESPONSE" ? <textarea className="textarea long-editor" disabled={busy} onChange={event => change(event.target.value)} onKeyDown={event => { if ((event.ctrlKey || event.metaKey) && event.key === "Enter") { event.preventDefault(); void check(true); } }} rows={8} value={answer} /> : <input className="input answer-input" disabled={busy} inputMode={question.shortAnswerMode === "NUMERIC" ? "decimal" : "text"} onChange={event => change(event.target.value)} value={answer} />}</label>}
      <div className="question-actions"><button className="button button-primary" disabled={busy || !answer.trim() || Boolean(result)} type="submit">{busy ? "Working…" : question.type === "LONG_RESPONSE" || !question.graded ? "Save response and reveal solution" : "Check answer"}</button><button className="button" disabled={busy} onClick={() => { change(""); setError(null); }} type="button">Reset</button></div>
    </form>
    {question.type === "LONG_RESPONSE" ? <p className="muted small">Enter starts a new line. Ctrl/Cmd+Enter saves your response and reveals the rubric. Long responses are not automatically graded.</p> : null}
    {error ? <p className="notice notice-warning" role="alert">{error}</p> : null}
    {result ? <div className={`answer-feedback ${result.result === "CORRECT" ? "correct" : result.result === "INCORRECT" ? "incorrect" : "compared"}`} role="status"><strong>{result.result === "CORRECT" ? "Correct" : result.result === "INCORRECT" ? "Incorrect — try again or review the solution." : "Response saved · compare with the solution"}</strong>{typeof result.feedback === "string" ? <p>{result.feedback}</p> : null}{explanations?.map((explanation,index) => <div key={index}><strong>Choice {index + 1}</strong><RichContent source={explanation} /></div>)}</div> : null}
    {result && solution === null ? <button className="button" disabled={busy} onClick={() => void check(true)} type="button">Reveal detailed solution</button> : null}{solution !== null ? <div className="solution"><h3>Detailed solution / rubric</h3><RichContent source={solution} /></div> : null}
    <ContributionMeta item={question} kind="QUESTION" />
  </div>;
}

export default function QuestionsPage() {
  const { data } = useAppData(); const params = useSearchParams(); const queryBank = params.get("assessment") ?? ""; const [assessment, setAssessment] = useState(queryBank); const [selectedId, setSelectedId] = useState(""); const [create, setCreate] = useState(false);
  useEffect(() => { const update = () => setSelectedId(window.location.hash.slice(1)); queueMicrotask(() => { setAssessment(queryBank); update(); }); window.addEventListener("hashchange", update); return () => window.removeEventListener("hashchange", update); }, [queryBank]);
  const banks = data?.assessments.filter(item => item.major) ?? []; const bank = assessment || banks[0]?.id || ""; const questions = data?.questions.filter(item => item.assessmentId === bank) ?? []; const selected = questions.find(item => item.id === selectedId) ?? questions[0];
  return <><PageHeading course title="Sample Questions" description="Original practice, grouped by major assessment. Answers are checked privately." action={<button className="button button-primary" disabled={!banks.length} onClick={() => setCreate(true)} type="button">Add question</button>} /><CourseTabs /><div className="notice notice-warning">Original or authorized material only. Do not reconstruct protected tests or quizzes.</div><label className="field filter-field"><span>Assessment question bank</span><select className="select" onChange={event => { setAssessment(event.target.value); setSelectedId(""); }} value={bank}>{banks.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label><Panel title={`${banks.find(item => item.id === bank)?.title ?? "Practice"} question bank`} action={<Badge>{questions.length} questions</Badge>}><div className="question-layout"><nav className="question-index" aria-label="Questions">{questions.map((item,index) => <button aria-current={selected?.id === item.id ? "true" : undefined} className={selected?.id === item.id ? "active" : ""} key={item.id} onClick={() => setSelectedId(item.id)} type="button"><span>Question {index+1}</span><small>{item.skills.join(" · ")}</small></button>)}</nav>{selected ? <PracticeQuestion key={`${selected.id}-${selected.revisionId}`} question={selected} /> : <p className="empty-state">{banks.length ? "No questions yet. Add original practice for this assessment." : "Create a major assessment to start its question bank."}</p>}</div></Panel>{create ? <ContentEditor kind="QUESTION" onClose={() => setCreate(false)} /> : null}</>;
}
