export const COURSE_SLUG = "concrete-math-av-p4";

export type DemoUser = {
  displayName: string;
  username: string;
  role: "student" | "staff" | "admin";
};

export type DemoAssessment = {
  id: string;
  title: string;
  kind: "Test" | "Quiz" | "Assignment";
  summary: string;
  date: string;
  topics: string[];
  templates: string[];
  major: boolean;
  author: string;
};

export type DemoEvent = {
  id: string;
  title: string;
  start: string;
  allDay?: boolean;
  kind: "assessment" | "assignment" | "reminder";
  details: string;
  author: string;
  updates: { author: string; body: string; createdAt: string }[];
};

export type DemoNote = {
  id: string;
  title: string;
  mode: "Plain text" | "Markdown + LaTeX" | "PDF";
  body: string;
  author: string;
  username: string;
  updatedAt: string;
};

export type DemoAdvice = {
  id: string;
  type: "GENERAL" | "ASSESSMENT_SPECIFIC";
  assessment?: string;
  title: string;
  body: string;
  author: string;
  username: string;
  updatedAt: string;
};

export type DemoQuestion = {
  id: string;
  assessment: string;
  type: "SINGLE_CHOICE" | "SHORT_ANSWER" | "LONG_RESPONSE";
  prompt: string;
  skills: string[];
  choices?: string[];
  correctChoice?: number;
  acceptedAnswers?: string[];
  explanations?: string[];
  solution?: string;
  author: string;
  username: string;
};

export type DemoAttempt = {
  id: string;
  assessment: string;
  prompt: string;
  response: string;
  result: "Correct" | "Incorrect" | "Compared" | "Needs review";
  when: string;
};

export const demoUser: DemoUser = {
  displayName: "Maya Chen",
  username: "mchen27",
  role: "student",
};

export const demoCourse = {
  id: "course-concrete-math",
  slug: COURSE_SLUG,
  name: "Concrete Math AV - P4",
  period: "Period 4",
  term: "2026–27",
  description:
    "A student-maintained space for dates, study notes, reflections, and original practice. Content here is not official course material.",
  members: 28,
};

export const demoAssessments: DemoAssessment[] = [
  {
    id: "assessment-unit-2",
    title: "Unit 2 Assessment",
    kind: "Test",
    summary: "Fictional preview covering sums, recurrences, and integer functions.",
    date: "2026-09-18",
    topics: ["Finite sums", "Recurrence relations", "Floors and ceilings"],
    templates: ["Derive a closed form", "Prove an identity", "Evaluate a nested sum"],
    major: true,
    author: "Maya Chen",
  },
  {
    id: "assessment-quiz-3",
    title: "Quiz 3",
    kind: "Quiz",
    summary: "Fictional preview: notation fluency and short recurrence exercises.",
    date: "2026-09-09",
    topics: ["Sigma notation", "Basic recurrences"],
    templates: ["Short response"],
    major: false,
    author: "Jon Bell",
  },
];

export const demoEvents: DemoEvent[] = [
  {
    id: "event-quiz-3",
    title: "Quiz 3",
    start: "2026-09-09",
    allDay: true,
    kind: "assessment",
    details: "Fictional demo date. Check official teacher sources before relying on it.",
    author: "Jon Bell",
    updates: [
      {
        author: "Maya Chen",
        body: "Review the recurrence examples from Monday's shared notes.",
        createdAt: "Sep 1 at 4:12 PM",
      },
    ],
  },
  {
    id: "event-problem-set",
    title: "Problem Set 2 discussion",
    start: "2026-09-14",
    allDay: true,
    kind: "assignment",
    details: "Compare approaches; do not post copied solutions.",
    author: "Ari Singh",
    updates: [],
  },
  {
    id: "event-unit-2",
    title: "Unit 2 Assessment",
    start: "2026-09-18",
    allDay: true,
    kind: "assessment",
    details: "Fictional preview event linked to the assessment page.",
    author: "Maya Chen",
    updates: [],
  },
];

export const demoNotes: DemoNote[] = [
  {
    id: "note-recurrences",
    title: "Recurrence relation patterns",
    mode: "Markdown + LaTeX",
    body:
      "A useful starting point is to expand the recurrence a few times. For $T_n = T_{n-1} + n$, the differences are easy to sum:\n\n$$T_n = T_0 + \\sum_{k=1}^{n} k.$$",
    author: "Maya Chen",
    username: "mchen27",
    updatedAt: "Sep 1 at 3:42 PM",
  },
  {
    id: "note-floor",
    title: "Floors and ceilings — quick reminders",
    mode: "Plain text",
    body:
      "To prove floor(x) = n, show n ≤ x < n + 1. Keep strict and non-strict inequalities in the correct places.",
    author: "Ari Singh",
    username: "asingh27",
    updatedAt: "Aug 31 at 8:16 PM",
  },
  {
    id: "note-pdf",
    title: "Unit 1 handwritten review",
    mode: "PDF",
    body: "4-page PDF · scanned and ready to view",
    author: "Jon Bell",
    username: "jbell27",
    updatedAt: "Aug 29 at 6:01 PM",
  },
];

export const generalAdvice: DemoAdvice[] = [
  {
    id: "advice-general-1",
    type: "GENERAL",
    title: "Write down the meaning of each symbol",
    body: "Before manipulating a sum, say what the index and bounds represent. It catches more mistakes than redoing arithmetic later.",
    author: "Ari Singh",
    username: "asingh27",
    updatedAt: "Aug 30 at 7:24 PM",
  },
  {
    id: "advice-general-2",
    type: "GENERAL",
    title: "Keep an error log",
    body: "After each problem set, record one conceptual mistake and one notation mistake. Revisit the list before a quiz.",
    author: "Maya Chen",
    username: "mchen27",
    updatedAt: "Aug 28 at 5:03 PM",
  },
];

export const assessmentAdvice: DemoAdvice[] = [
  {
    id: "advice-assessment-1",
    type: "ASSESSMENT_SPECIFIC",
    assessment: "Unit 2 Assessment",
    title: "Practice changing summation order",
    body: "Draw the integer-coordinate region first. It makes the new bounds much easier to verify.",
    author: "Jon Bell",
    username: "jbell27",
    updatedAt: "Sep 1 at 6:09 PM",
  },
];

export const demoQuestions: DemoQuestion[] = [
  {
    id: "q-1",
    assessment: "Unit 2 Assessment",
    type: "SINGLE_CHOICE" as const,
    prompt: "Which expression equals $\\sum_{k=1}^{n} (2k-1)$?",
    skills: ["Finite sums", "Pattern recognition"],
    choices: ["$n$", "$n^2$", "$n(n+1)$", "$2^n$"],
    correctChoice: 1,
    explanations: [
      "This is only the number of terms.",
      "Correct. The odd numbers form successive square borders.",
      "This is twice the triangular-number sum.",
      "The partial sums grow quadratically, not exponentially.",
    ],
    solution: "Pair the visual square-border argument with the identity $1+3+\\cdots+(2n-1)=n^2$.",
    author: "Maya Chen",
    username: "mchen27",
  },
  {
    id: "q-2",
    assessment: "Unit 2 Assessment",
    type: "SHORT_ANSWER" as const,
    prompt: "How many integers $x$ satisfy $2.2 \\le x < 7$?",
    skills: ["Floors and ceilings"],
    acceptedAnswers: ["4"],
    solution: "The integers are $3,4,5,6$, so there are four.",
    author: "Ari Singh",
    username: "asingh27",
  },
  {
    id: "q-3",
    assessment: "Unit 2 Assessment",
    type: "LONG_RESPONSE" as const,
    prompt: "Explain why the sum of the first $n$ odd positive integers is a square.",
    skills: ["Proof", "Finite sums"],
    solution: "Start with a $1\\times1$ square. The next odd number of unit cells wraps around two sides to make the next larger square. Repeating this builds an $n\\times n$ square from the first $n$ odd numbers.",
    author: "Jon Bell",
    username: "jbell27",
  },
];

export const demoAttempts: DemoAttempt[] = [
  {
    id: "attempt-1",
    assessment: "Unit 2 Assessment",
    prompt: "Which expression equals the sum of the first n odd integers?",
    response: "$n^2$",
    result: "Correct",
    when: "Today at 4:36 PM",
  },
  {
    id: "attempt-2",
    assessment: "Unit 2 Assessment",
    prompt: "How many integers x satisfy 2.2 ≤ x < 7?",
    response: "4",
    result: "Needs review",
    when: "Yesterday at 8:11 PM",
  },
];

export const recentActivity = [
  { verb: "shared notes", title: "Recurrence relation patterns", author: "Maya Chen", when: "18 minutes ago" },
  { verb: "added an update", title: "Quiz 3", author: "Maya Chen", when: "1 hour ago" },
  { verb: "posted advice", title: "Practice changing summation order", author: "Jon Bell", when: "3 hours ago" },
  { verb: "added a question", title: "Unit 2 Assessment", author: "Ari Singh", when: "Yesterday" },
];

export const demoReports = [
  {
    id: "report-1",
    reason: "Academic integrity concern",
    target: "Sample question: Nested sum practice",
    author: "student27",
    reported: "Today at 10:12 AM",
    status: "Open",
  },
  {
    id: "report-2",
    reason: "Personal information",
    target: "Calendar update on Quiz 3",
    author: "student28",
    reported: "Yesterday at 6:42 PM",
    status: "Reviewing",
  },
];

export const demoMembers = [
  { name: "Maya Chen", username: "mchen27", role: "Member", status: "Active" },
  { name: "Ari Singh", username: "asingh27", role: "Member", status: "Active" },
  { name: "Dr. Taylor", username: "rtaylor", role: "Course staff", status: "Active" },
  { name: "Jordan Lee", username: "jlee27", role: "Member", status: "Suspended" },
];
