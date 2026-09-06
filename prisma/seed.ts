import { createHash } from "node:crypto";
import {
  AccountStatus,
  AdviceType,
  AssessmentType,
  CalendarEventType,
  ContentKind,
  CourseRole,
  NoteMode,
  PlatformRole,
  PrismaClient,
  QuestionType,
  Visibility,
} from "@prisma/client";

const prisma = new PrismaClient();

const ids = {
  course: "course_concrete_math_av_p4",
  assessmentItem: "demo_assessment_fictional_review",
  calendarItem: "demo_calendar_fictional_review",
  noteItem: "demo_note_fictional_induction",
  adviceItem: "demo_advice_fictional_study",
  questionBank: "demo_bank_fictional_review",
  questionItem: "demo_question_fictional_sequence",
  questionRevision: "demo_question_revision_1",
} as const;

function hash(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function isLocalSeed(): boolean {
  const appEnv = process.env.APP_ENV ??
    (process.env.NODE_ENV === "production" ? "production" : "local");
  return appEnv === "local";
}

async function seedUsers() {
  const definitions = [
    {
      username: "demo.student",
      displayName: "Demo Student",
      ionId: "demo:student-member",
      isStudent: true,
      isTeacher: false,
      accountStatus: AccountStatus.ACTIVE,
    },
    {
      username: "demo.nonmember",
      displayName: "Demo Nonmember",
      ionId: "demo:student-nonmember",
      isStudent: true,
      isTeacher: false,
      accountStatus: AccountStatus.ACTIVE,
    },
    {
      username: "demo.teacher",
      displayName: "Demo Assigned Teacher",
      ionId: "demo:teacher-assigned",
      isStudent: false,
      isTeacher: true,
      accountStatus: AccountStatus.ACTIVE,
    },
    {
      username: "demo.unassigned",
      displayName: "Demo Unassigned Teacher",
      ionId: "demo:teacher-unassigned",
      isStudent: false,
      isTeacher: true,
      accountStatus: AccountStatus.ACTIVE,
    },
    {
      username: "demo.admin",
      displayName: "Demo Platform Administrator",
      ionId: "demo:platform-admin",
      isStudent: false,
      isTeacher: true,
      accountStatus: AccountStatus.ACTIVE,
    },
    {
      username: "demo.suspended",
      displayName: "Demo Suspended User",
      ionId: "demo:suspended",
      isStudent: true,
      isTeacher: false,
      accountStatus: AccountStatus.SUSPENDED,
    },
  ] as const;

  const users = new Map<string, Awaited<ReturnType<typeof prisma.user.upsert>>>();
  for (const definition of definitions) {
    const user = await prisma.user.upsert({
      where: { username: definition.username },
      create: definition,
      update: {},
    });
    users.set(definition.username, user);
  }
  return users;
}

async function seedCourse(adminId: string) {
  const course = await prisma.course.upsert({
    where: { slug: "concrete-math-av-p4" },
    create: {
      id: ids.course,
      slug: "concrete-math-av-p4",
      name: "Concrete Math AV - P4",
      description: "Student-contributed resources for Concrete Math, period 4.",
    },
    update: {},
  });

  const rawJoinCode = process.env.COURSE_JOIN_CODE?.trim() || "concrete-p4-demo";
  await prisma.courseJoinCode.upsert({
    where: { codeHash: hash(rawJoinCode) },
    create: {
      courseId: course.id,
      codeHash: hash(rawJoinCode),
      createdById: adminId,
    },
    update: {},
  });
  return course;
}

async function seedDemoContent(courseId: string, studentId: string, teacherId: string) {
  const now = new Date();

  await prisma.contentItem.upsert({
    where: { id: ids.assessmentItem },
    create: {
      id: ids.assessmentItem,
      courseId,
      authorId: teacherId,
      kind: ContentKind.ASSESSMENT,
      visibility: Visibility.PUBLISHED,
      publishedAt: now,
      assessment: {
        create: {
          type: AssessmentType.QUIZ,
          title: "Fictional Sequences Review",
          summary: "Demo-only assessment used to exercise openTJ features.",
          description: "This is fictional sample content, not an actual course assessment.",
          isMajor: true,
          topics: {
            create: [
              { position: 0, label: "Finite differences" },
              { position: 1, label: "Recurrence relations" },
            ],
          },
          templates: {
            create: [
              { position: 0, description: "Identify the next term of a sample sequence." },
            ],
          },
        },
      },
    },
    update: {},
  });

  await prisma.questionBank.upsert({
    where: { assessmentId: ids.assessmentItem },
    create: {
      id: ids.questionBank,
      courseId,
      assessmentId: ids.assessmentItem,
      title: "Fictional Sequences Review practice",
    },
    update: {},
  });

  await prisma.contentItem.upsert({
    where: { id: ids.calendarItem },
    create: {
      id: ids.calendarItem,
      courseId,
      authorId: teacherId,
      kind: ContentKind.CALENDAR_EVENT,
      visibility: Visibility.PUBLISHED,
      publishedAt: now,
      calendarEvent: {
        create: {
          type: CalendarEventType.ASSESSMENT,
          title: "Fictional Sequences Review",
          details: "Demo date only; this is not an actual assignment.",
          allDay: true,
          startDate: new Date("2026-09-18T00:00:00.000Z"),
          endDate: new Date("2026-09-19T00:00:00.000Z"),
          assessmentId: ids.assessmentItem,
        },
      },
    },
    update: {},
  });

  await prisma.contentItem.upsert({
    where: { id: ids.noteItem },
    create: {
      id: ids.noteItem,
      courseId,
      authorId: studentId,
      kind: ContentKind.NOTE,
      visibility: Visibility.PUBLISHED,
      publishedAt: now,
      note: {
        create: {
          title: "Fictional induction outline",
          mode: NoteMode.MARKDOWN_LATEX,
          body: "Demo notes: verify the base case, state the induction hypothesis, and prove the next case. Example notation: $P(n)$. This is fictional sample material.",
        },
      },
    },
    update: {},
  });

  await prisma.contentItem.upsert({
    where: { id: ids.adviceItem },
    create: {
      id: ids.adviceItem,
      courseId,
      authorId: studentId,
      kind: ContentKind.ADVICE,
      visibility: Visibility.PUBLISHED,
      publishedAt: now,
      advice: {
        create: {
          type: AdviceType.GENERAL,
          title: "Fictional demo study advice",
          body: "Practice explaining why each step works, not only computing the result. This is fictional sample advice.",
        },
      },
    },
    update: {},
  });

  await prisma.contentItem.upsert({
    where: { id: ids.questionItem },
    create: {
      id: ids.questionItem,
      courseId,
      authorId: studentId,
      kind: ContentKind.QUESTION,
      visibility: Visibility.PUBLISHED,
      publishedAt: now,
      question: {
        create: {
          bankId: ids.questionBank,
          revisions: {
            create: {
              id: ids.questionRevision,
              revision: 1,
              createdById: studentId,
              type: QuestionType.SINGLE_CHOICE,
              prompt: "Fictional practice: what is the next term in $2, 4, 6, 8, \\ldots$?",
              detailedSolution: "The common difference is 2, so add 2 to 8.",
              choices: {
                create: [
                  { position: 0, text: "9", isCorrect: false, explanation: "This adds 1 rather than 2." },
                  { position: 1, text: "10", isCorrect: true, explanation: "Each term increases by 2." },
                  { position: 2, text: "12", isCorrect: false, explanation: "This skips the next term." },
                ],
              },
            },
          },
        },
      },
    },
    update: {},
  });
}

async function main() {
  if (!isLocalSeed()) {
    await prisma.course.upsert({
      where: { slug: "concrete-math-av-p4" },
      create: { id: ids.course, slug: "concrete-math-av-p4", name: "Concrete Math AV - P4", description: "Student-contributed resources for Concrete Math, period 4." },
      update: {},
    });
    return;
  }

  const users = await seedUsers();
  const admin = users.get("demo.admin");
  const student = users.get("demo.student");
  const teacher = users.get("demo.teacher");
  const suspended = users.get("demo.suspended");
  if (!admin || !student || !teacher || !suspended) {
    throw new Error("Failed to seed required demo personas");
  }

  const course = await seedCourse(admin.id);
  for (const [userId, role] of [
    [student.id, CourseRole.MEMBER],
    [teacher.id, CourseRole.STAFF],
    [admin.id, CourseRole.STAFF],
    [suspended.id, CourseRole.MEMBER],
  ] as const) {
    await prisma.courseMembership.upsert({
      where: { courseId_userId: { courseId: course.id, userId } },
      create: { courseId: course.id, userId, role },
      update: {},
    });
  }

  await prisma.roleGrant.upsert({
    where: { userId_role: { userId: admin.id, role: PlatformRole.PLATFORM_ADMIN } },
    create: {
      userId: admin.id,
      role: PlatformRole.PLATFORM_ADMIN,
      grantedById: admin.id,
    },
    update: {},
  });
  for (const user of [student, teacher, admin]) {
    await prisma.policyAcceptance.upsert({
      where: { userId_version: { userId: user.id, version: "2026-09-v1" } },
      create: { userId: user.id, version: "2026-09-v1" },
      update: {},
    });
  }
  await seedDemoContent(course.id, student.id, teacher.id);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exitCode = 1;
  });
