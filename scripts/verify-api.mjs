import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";

try { process.loadEnvFile(); } catch { /* CI supplies its own environment. */ }
const base = process.env.APP_URL ?? "http://127.0.0.1:3000";
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('Run destructive fixture tests only against a local development server.');
const checks = [];
function passed(name) { checks.push(name); console.log(`PASS ${name}`); }
async function client(persona) {
  const response = await fetch(`${base}/api/v1/auth/dev-login`, { method: 'POST', headers: { origin: base, 'content-type': 'application/json' }, body: JSON.stringify({ persona }) });
  assert.equal(response.status, 200, `Persona login ${persona}: ${await response.text()}`);
  const cookie = response.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
  assert.ok(cookie.includes('opentj_session='));
  return async (path, body, method = body === undefined ? 'GET' : 'POST', expected = 200, extras = {}) => {
    const result = await fetch(`${base}/api/v1${path}`, { method, headers: { cookie, origin: base, ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...extras }, body: body === undefined ? undefined : JSON.stringify(body) });
    const value = await result.json();
    if (expected === 200) assert.ok(result.status >= 200 && result.status < 300, `${method} ${path}: ${JSON.stringify(value)}`);
    else assert.equal(result.status, expected, `${method} ${path}: ${JSON.stringify(value)}`);
    return value.data ?? value;
  };
}

const admin = await client('platform-admin');
const student = await client('student-member');
const teacher = await client('course-staff');
const outsider = await client('student-nonmember');
const unassigned = await client('unassigned-teacher');
const slug = `verification-${Date.now()}`;
const path = `/courses/${slug}`;
const created = await admin('/admin', { action: 'createCourse', slug, name: 'Fictional verification course', description: 'Created by the local API verification script.' });
const courseId = created.id;
try {
  await student(path, undefined, 'GET', 403);
  await unassigned(path, undefined, 'GET', 403);
  await admin(`${path}/members`, { username: 'demo.student', role: 'MEMBER' });
  await admin(`${path}/members`, { username: 'demo.teacher', role: 'STAFF' });
  await teacher(`${path}/members`, { username: 'demo.unassigned', role: 'STAFF' }, 'POST', 403);
  await student('/admin', undefined, 'GET', 403);
  passed('Course membership and explicit staff/admin boundaries');

  const join = await teacher(`${path}/join-code`, {});
  await outsider('/courses/join', { code: join.code });
  await outsider(path);
  await teacher(`${path}/join-code`, {});
  await unassigned('/courses/join', { code: join.code }, 'POST', 400);
  await student('/policy/accept', {});
  await outsider('/policy/accept', {});
  passed('Hashed rotating join codes and policy acceptance');

  const assessment = await student(`${path}/content`, { kind: 'ASSESSMENT', assessmentType: 'Test', title: 'Verification assessment', summary: 'Original fictional assessment', description: 'Detailed description', topics: ['Sums', 'Induction'], templates: ['Derive a formula'], major: true });
  assert.equal(assessment.author, 'Demo Student');
  assert.equal(assessment.username, 'demo.student');
  assert.equal(assessment.description, 'Detailed description');
  const calendarLink = `${path}/assessments/${assessment.id}/calendar`;
  await Promise.all([student(calendarLink, { title: assessment.title, start: '2026-09-18' }), student(calendarLink, { title: assessment.title, start: '2026-09-18' })]);
  let snapshot = await student(path);
  assert.equal(snapshot.events.filter(e => e.assessmentId === assessment.id).length, 1);
  assert.equal(snapshot.banks.length, 1);
  const event = snapshot.events.find(e => e.assessmentId === assessment.id);
  assert.equal(event.start, '2026-09-18');
  await outsider(`${path}/content/${event.id}`, { version: event.version, title: 'Unauthorized edit' }, 'PATCH', 403);
  const update = await outsider(`${path}/content`, { kind: 'CALENDAR_UPDATE', calendarEventId: event.id, body: 'An attributed study reminder.' });
  assert.equal(update.username, 'demo.nonmember');
  await outsider(`${path}/content/${update.id}`, { version: update.version, body: 'A revised study reminder.' }, 'PATCH');
  const standalone = await student(`${path}/content`, { kind: 'CALENDAR_EVENT', eventType: 'assignment', title: 'Standalone assignment', start: '2026-09-19', details: 'No assessment is attached.' });
  assert.equal((await outsider(`${path}/content/${standalone.id}`)).id, standalone.id);
  assert.ok((await outsider(path)).events.some(item => item.id === standalone.id), 'Other members must see standalone events.');
  const standaloneUpdate = await outsider(`${path}/content`, { kind: 'CALENDAR_UPDATE', calendarEventId: standalone.id, body: 'A standalone assignment update.' });
  assert.equal((await student(`${path}/content/${standaloneUpdate.id}`)).body, 'A standalone assignment update.');
  passed('Assessment details, automatic bank, concurrent idempotent calendar linking and attributed updates');

  const note = await student(`${path}/content`, { kind: 'NOTE', title: 'Verification notes', mode: 'Markdown + LaTeX', body: 'A sum: $1+2=3$. <script>bad()</script>', authorId: 'forged', author: 'Forged user' });
  assert.equal(note.authorId, assessment.authorId);
  const edited = await student(`${path}/content/${note.id}`, { version: note.version, title: 'Edited verification notes' }, 'PATCH');
  assert.equal(edited.version, note.version + 1);
  await student(`${path}/content/${note.id}`, { version: note.version, title: 'Stale edit' }, 'PATCH', 409);
  await outsider(`${path}/content/${note.id}/edit`, undefined, 'GET', 403);
  await student(`${path}/content`, { kind: 'NOTE', title: 'Plain notes', mode: 'Plain text', body: 'Keep line one.\nKeep line two.' });
  await student(`${path}/content`, { kind: 'ADVICE', type: 'GENERAL', title: 'Course advice', body: 'Practice regularly.' });
  await student(`${path}/content`, { kind: 'ADVICE', type: 'ASSESSMENT_SPECIFIC', assessmentId: assessment.id, title: 'Assessment advice', body: 'Review induction.' });
  await student(`${path}/content`, { kind: 'ADVICE', type: 'ASSESSMENT_SPECIFIC', title: 'Missing assessment', body: 'Invalid.' }, 'POST', 400);
  passed('Persistent attributed text/LaTeX notes, advice validation and stale-edit conflicts');

  const bankId = snapshot.banks[0].id;
  const questionInput = { kind: 'QUESTION', bankId, type: 'SINGLE_CHOICE', prompt: 'Original verification: what is 2 + 3?', skills: ['Addition'], choices: ['4', '5'], correctChoice: 1, explanations: ['One too small.', 'Two plus three is five.'], solution: 'SECRET_SOLUTION_MARKER: count five.', authorized: true };
  const question = await student(`${path}/content`, questionInput);
  snapshot = await outsider(path);
  const publicQuestion = snapshot.questions.find(q => q.id === question.id);
  assert.equal(publicQuestion.graded, true);
  assert.ok(!JSON.stringify(snapshot).includes('SECRET_SOLUTION_MARKER'));
  for (const key of ['correctChoice', 'acceptedAnswers', 'numericAnswer', 'solution', 'explanations']) assert.equal(key in publicQuestion, false, key);
  const checkPath = `${path}/questions/${question.id}/check`;
  const submission = { revisionId: publicQuestion.revisionId, idempotencyKey: randomUUID(), choice: 1 };
  const results = await Promise.all([outsider(checkPath, submission), outsider(checkPath, submission)]);
  assert.equal(results[0].id, results[1].id);
  assert.equal(results[0].result, 'CORRECT');
  await outsider(checkPath, { ...submission, choice: 0 }, 'POST', 409);
  const wrong = await outsider(checkPath, { ...submission, idempotencyKey: randomUUID(), choice: 0 });
  assert.equal(wrong.result, 'INCORRECT');
  assert.ok(!JSON.stringify(wrong).includes('SECRET_SOLUTION_MARKER'));
  const revealed = await outsider(`${path}/questions/${question.id}/reveal`, { revisionId: publicQuestion.revisionId });
  assert.match(revealed.solution, /SECRET_SOLUTION_MARKER/);
  await student(`${path}/content/${question.id}`, { ...questionInput, version: question.version, correctChoice: 0 }, 'PATCH');
  const oldRevision = await outsider(checkPath, { ...submission, idempotencyKey: randomUUID() });
  assert.equal(oldRevision.result, 'CORRECT');
  const ownHistory = await outsider('/me/practice');
  assert.equal(ownHistory.attempts.filter(a => a.revisionId === publicQuestion.revisionId).length, 3);
  const teacherHistory = await teacher('/me/practice');
  assert.equal(teacherHistory.attempts.some(a => a.revisionId === publicQuestion.revisionId), false);
  passed('Server-only answers, explicit solutions, immutable revisions, duplicate checks and private history');

  for (const [typeFields, answer, expected] of [
    [{ type: 'SHORT_ANSWER', acceptedAnswers: ['café au lait', 'coffee'] }, { text: '  CAFE\u0301   au lait  ' }, 'CORRECT'],
    [{ type: 'SHORT_ANSWER', shortAnswerMode: 'NUMERIC', numericAnswer: 2.5, absoluteTolerance: 0.01, unit: 'm' }, { text: '2.505', unit: 'm' }, 'CORRECT'],
    [{ type: 'LONG_RESPONSE', solution: 'Compare the reasoning.' }, { text: 'My detailed reasoning.' }, 'UNGRADED'],
    [{ type: 'SHORT_ANSWER' }, { text: 'An ungraded response.' }, 'UNGRADED'],
  ]) {
    const q = await student(`${path}/content`, { kind: 'QUESTION', bankId, prompt: 'Original verification practice', skills: [], authorized: true, ...typeFields });
    const result = await outsider(`${path}/questions/${q.id}/check`, { revisionId: q.revisionId, idempotencyKey: randomUUID(), ...answer });
    assert.equal(result.result, expected);
  }
  passed('Text aliases/Unicode, finite numeric tolerance/units, long response and ungraded practice');

  const report = await outsider(`${path}/reports`, { contentId: note.id, reason: 'OTHER', details: 'Fictional moderation verification.' });
  await student(`${path}/moderation`, { contentId: note.id, version: edited.version, action: 'HIDE', reason: 'Unauthorized moderation.' }, 'POST', 403);
  await teacher(`${path}/moderation`, { contentId: note.id, version: edited.version, action: 'HIDE', reason: 'Fictional takedown reason.', reportId: report.id });
  assert.equal((await outsider(path)).notes.some(n => n.id === note.id), false);
  const searchHidden = await outsider(`${path}/search?q=Edited`);
  assert.equal(searchHidden.results.some(n => n.id === note.id), false);
  await student(`${path}/appeals`, { contentId: note.id, message: 'Please review this fictional takedown.' });
  const queue = await teacher('/moderation');
  const appeal = queue.appeals.find(a => a.contentId === note.id);
  assert.ok(appeal, 'Appeal must be visible to assigned staff');
  await teacher(`${path}/appeals/${appeal.id}`, { status: 'OVERTURNED', resolution: 'Fictional appeal accepted.' });
  assert.equal((await outsider(path)).notes.some(n => n.id === note.id), true);
  const fresh = (await student(path)).assessments.find(a => a.id === assessment.id);
  await student(`${path}/content/${assessment.id}/visibility`, { version: fresh.version, action: 'hide' });
  snapshot = await outsider(path);
  assert.equal(snapshot.events.some(e => e.assessmentId === assessment.id), false);
  assert.equal(snapshot.questions.some(q => q.bankId === bankId), false);
  await outsider(checkPath, { ...submission, idempotencyKey: randomUUID() }, 'POST', 404);
  await student(`${path}/content/${assessment.id}/visibility`, { version: fresh.version + 1, action: 'restore' });
  assert.equal((await outsider(path)).events.some(e => e.assessmentId === assessment.id), true);
  passed('Reports, scoped takedown, search visibility, appeal and assessment-dependent visibility');

  await admin(`${path}/members`, { username: 'demo.teacher', role: 'MEMBER' });
  await teacher(`${path}/join-code`, {}, 'POST', 403);
  await admin(`${path}/members`, { username: 'demo.nonmember', remove: true });
  await outsider(path, undefined, 'GET', 403);
  await outsider(checkPath, { ...submission, idempotencyKey: randomUUID() }, 'POST', 403);
  passed('Immediate staff/membership revocation on existing sessions');
  await outsider('/me/practice', undefined, 'DELETE');
  assert.equal((await outsider('/me/practice')).attempts.length, 0);
  passed('Student can clear private practice history');
} finally {
  await admin('/admin', { action: 'course', courseId, archived: true });
  await mkdir('test-results', { recursive: true });
  await writeFile('test-results/api-verification.json', JSON.stringify({ at: new Date().toISOString(), base, checks }, null, 2));
}
console.log(`Verified ${checks.length} API workflow groups.`);
