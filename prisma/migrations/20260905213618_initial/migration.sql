-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DEACTIVATED');

-- CreateEnum
CREATE TYPE "CourseRole" AS ENUM ('MEMBER', 'STAFF');

-- CreateEnum
CREATE TYPE "PlatformRole" AS ENUM ('PLATFORM_ADMIN');

-- CreateEnum
CREATE TYPE "ContentKind" AS ENUM ('ASSESSMENT', 'CALENDAR_EVENT', 'CALENDAR_UPDATE', 'NOTE', 'ADVICE', 'QUESTION');

-- CreateEnum
CREATE TYPE "Visibility" AS ENUM ('DRAFT', 'QUARANTINED', 'PUBLISHED', 'HIDDEN_BY_AUTHOR', 'HIDDEN_BY_MODERATOR', 'DELETED');

-- CreateEnum
CREATE TYPE "AssessmentType" AS ENUM ('TEST', 'QUIZ', 'ASSIGNMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "CalendarEventType" AS ENUM ('ASSIGNMENT', 'ASSESSMENT', 'REMINDER', 'OTHER');

-- CreateEnum
CREATE TYPE "NoteMode" AS ENUM ('PLAIN_TEXT', 'MARKDOWN_LATEX', 'PDF');

-- CreateEnum
CREATE TYPE "AdviceType" AS ENUM ('GENERAL', 'ASSESSMENT_SPECIFIC');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('SINGLE_CHOICE', 'SHORT_ANSWER', 'LONG_RESPONSE');

-- CreateEnum
CREATE TYPE "ShortAnswerMode" AS ENUM ('TEXT', 'NUMERIC');

-- CreateEnum
CREATE TYPE "AttemptResult" AS ENUM ('CORRECT', 'INCORRECT', 'UNGRADED');

-- CreateEnum
CREATE TYPE "UploadStatus" AS ENUM ('PENDING', 'QUARANTINED', 'SCANNING', 'CLEAN', 'REJECTED', 'FAILED');

-- CreateEnum
CREATE TYPE "ReportReason" AS ENUM ('ACADEMIC_INTEGRITY', 'HARASSMENT_HATE', 'PRIVACY', 'COPYRIGHT', 'UNSAFE_FILE', 'SPAM', 'OTHER');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'ACTIONED', 'DISMISSED', 'APPEALED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ModerationActionType" AS ENUM ('HIDE', 'RESTORE', 'LOCK', 'UNLOCK', 'DISMISS_REPORT', 'SUSPEND_USER', 'REINSTATE_USER');

-- CreateEnum
CREATE TYPE "AppealStatus" AS ENUM ('OPEN', 'UPHELD', 'OVERTURNED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "ionId" TEXT,
    "username" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "isStudent" BOOLEAN NOT NULL DEFAULT false,
    "isTeacher" BOOLEAN NOT NULL DEFAULT false,
    "accountStatus" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userAgentHash" TEXT,
    "ipHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OAuthTransaction" (
    "id" TEXT NOT NULL,
    "stateHash" TEXT NOT NULL,
    "browserHash" TEXT NOT NULL,
    "codeVerifier" TEXT NOT NULL,
    "returnTo" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OAuthTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseMembership" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "CourseRole" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoleGrant" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "PlatformRole" NOT NULL,
    "grantedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoleGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseJoinCode" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseJoinCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentItem" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "kind" "ContentKind" NOT NULL,
    "visibility" "Visibility" NOT NULL DEFAULT 'PUBLISHED',
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "publishedAt" TIMESTAMP(3),
    "hiddenAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentRevision" (
    "id" TEXT NOT NULL,
    "contentItemId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "editorId" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assessment" (
    "contentItemId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "type" "AssessmentType" NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "isMajor" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Assessment_pkey" PRIMARY KEY ("contentItemId")
);

-- CreateTable
CREATE TABLE "AssessmentTopic" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "AssessmentTopic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentQuestionTemplate" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "AssessmentQuestionTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarEvent" (
    "contentItemId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "type" "CalendarEventType" NOT NULL,
    "title" TEXT NOT NULL,
    "details" TEXT NOT NULL DEFAULT '',
    "allDay" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "startDate" DATE,
    "endDate" DATE,
    "assessmentId" TEXT,

    CONSTRAINT "CalendarEvent_pkey" PRIMARY KEY ("contentItemId")
);

-- CreateTable
CREATE TABLE "CalendarUpdate" (
    "contentItemId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "calendarEventId" TEXT NOT NULL,
    "body" TEXT NOT NULL,

    CONSTRAINT "CalendarUpdate_pkey" PRIMARY KEY ("contentItemId")
);

-- CreateTable
CREATE TABLE "Note" (
    "contentItemId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "mode" "NoteMode" NOT NULL,
    "body" TEXT,
    "uploadId" TEXT,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("contentItemId")
);

-- CreateTable
CREATE TABLE "AdvicePost" (
    "contentItemId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "type" "AdviceType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "assessmentId" TEXT,

    CONSTRAINT "AdvicePost_pkey" PRIMARY KEY ("contentItemId")
);

-- CreateTable
CREATE TABLE "QuestionBank" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestionBank_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Skill" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Skill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "contentItemId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "bankId" TEXT NOT NULL,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("contentItemId")
);

-- CreateTable
CREATE TABLE "QuestionRevision" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "createdById" TEXT NOT NULL,
    "type" "QuestionType" NOT NULL,
    "prompt" TEXT NOT NULL,
    "shortAnswerMode" "ShortAnswerMode",
    "canonicalAnswer" TEXT,
    "acceptedAnswers" JSONB,
    "caseSensitive" BOOLEAN NOT NULL DEFAULT false,
    "numericAnswer" DECIMAL(30,12),
    "unit" TEXT,
    "absoluteTolerance" DECIMAL(30,12),
    "relativeTolerance" DECIMAL(30,12),
    "detailedSolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestionRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionChoice" (
    "id" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,
    "explanation" TEXT,

    CONSTRAINT "QuestionChoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionRevisionSkill" (
    "revisionId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,

    CONSTRAINT "QuestionRevisionSkill_pkey" PRIMARY KEY ("revisionId","skillId")
);

-- CreateTable
CREATE TABLE "PracticeAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "submitted" JSONB NOT NULL,
    "result" "AttemptResult" NOT NULL,
    "feedback" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PracticeAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Upload" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" "UploadStatus" NOT NULL DEFAULT 'PENDING',
    "originalName" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "detectedMime" TEXT,
    "bytes" INTEGER NOT NULL,
    "pages" INTEGER,
    "sha256" TEXT,
    "failureReason" TEXT,
    "scanAttempts" INTEGER NOT NULL DEFAULT 0,
    "nextScanAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Upload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "contentItemId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reason" "ReportReason" NOT NULL,
    "details" TEXT NOT NULL DEFAULT '',
    "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModerationAction" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "contentItemId" TEXT,
    "reportId" TEXT,
    "actorId" TEXT NOT NULL,
    "type" "ModerationActionType" NOT NULL,
    "reason" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "requestId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModerationAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appeal" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "moderationActionId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "AppealStatus" NOT NULL DEFAULT 'OPEN',
    "resolvedById" TEXT,
    "resolution" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Appeal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "courseId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolicyAcceptance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PolicyAcceptance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_ionId_key" ON "User"("ionId");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_expiresAt_idx" ON "Session"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthTransaction_stateHash_key" ON "OAuthTransaction"("stateHash");

-- CreateIndex
CREATE INDEX "OAuthTransaction_expiresAt_idx" ON "OAuthTransaction"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Course_slug_key" ON "Course"("slug");

-- CreateIndex
CREATE INDEX "CourseMembership_userId_role_idx" ON "CourseMembership"("userId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "CourseMembership_courseId_userId_key" ON "CourseMembership"("courseId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "RoleGrant_userId_role_key" ON "RoleGrant"("userId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "CourseJoinCode_codeHash_key" ON "CourseJoinCode"("codeHash");

-- CreateIndex
CREATE INDEX "CourseJoinCode_courseId_revokedAt_expiresAt_idx" ON "CourseJoinCode"("courseId", "revokedAt", "expiresAt");

-- CreateIndex
CREATE INDEX "ContentItem_courseId_kind_visibility_createdAt_idx" ON "ContentItem"("courseId", "kind", "visibility", "createdAt");

-- CreateIndex
CREATE INDEX "ContentItem_authorId_visibility_idx" ON "ContentItem"("authorId", "visibility");

-- CreateIndex
CREATE UNIQUE INDEX "ContentItem_id_courseId_key" ON "ContentItem"("id", "courseId");

-- CreateIndex
CREATE INDEX "ContentRevision_editorId_createdAt_idx" ON "ContentRevision"("editorId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ContentRevision_contentItemId_revision_key" ON "ContentRevision"("contentItemId", "revision");

-- CreateIndex
CREATE INDEX "Assessment_courseId_title_idx" ON "Assessment"("courseId", "title");

-- CreateIndex
CREATE UNIQUE INDEX "Assessment_contentItemId_courseId_key" ON "Assessment"("contentItemId", "courseId");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentTopic_assessmentId_position_key" ON "AssessmentTopic"("assessmentId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentQuestionTemplate_assessmentId_position_key" ON "AssessmentQuestionTemplate"("assessmentId", "position");

-- CreateIndex
CREATE INDEX "CalendarEvent_courseId_startDate_idx" ON "CalendarEvent"("courseId", "startDate");

-- CreateIndex
CREATE INDEX "CalendarEvent_courseId_startsAt_idx" ON "CalendarEvent"("courseId", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarEvent_contentItemId_courseId_key" ON "CalendarEvent"("contentItemId", "courseId");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarEvent_assessmentId_courseId_key" ON "CalendarEvent"("assessmentId", "courseId");

-- CreateIndex
CREATE INDEX "CalendarUpdate_calendarEventId_idx" ON "CalendarUpdate"("calendarEventId");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarUpdate_contentItemId_courseId_key" ON "CalendarUpdate"("contentItemId", "courseId");

-- CreateIndex
CREATE UNIQUE INDEX "Note_uploadId_key" ON "Note"("uploadId");

-- CreateIndex
CREATE INDEX "Note_courseId_title_idx" ON "Note"("courseId", "title");

-- CreateIndex
CREATE UNIQUE INDEX "Note_contentItemId_courseId_key" ON "Note"("contentItemId", "courseId");

-- CreateIndex
CREATE UNIQUE INDEX "Note_uploadId_courseId_key" ON "Note"("uploadId", "courseId");

-- CreateIndex
CREATE INDEX "AdvicePost_courseId_type_assessmentId_idx" ON "AdvicePost"("courseId", "type", "assessmentId");

-- CreateIndex
CREATE UNIQUE INDEX "AdvicePost_contentItemId_courseId_key" ON "AdvicePost"("contentItemId", "courseId");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionBank_assessmentId_key" ON "QuestionBank"("assessmentId");

-- CreateIndex
CREATE INDEX "QuestionBank_courseId_active_idx" ON "QuestionBank"("courseId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionBank_assessmentId_courseId_key" ON "QuestionBank"("assessmentId", "courseId");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionBank_id_courseId_key" ON "QuestionBank"("id", "courseId");

-- CreateIndex
CREATE UNIQUE INDEX "Skill_courseId_name_key" ON "Skill"("courseId", "name");

-- CreateIndex
CREATE INDEX "Question_bankId_idx" ON "Question"("bankId");

-- CreateIndex
CREATE UNIQUE INDEX "Question_contentItemId_courseId_key" ON "Question"("contentItemId", "courseId");

-- CreateIndex
CREATE INDEX "QuestionRevision_questionId_createdAt_idx" ON "QuestionRevision"("questionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionRevision_questionId_revision_key" ON "QuestionRevision"("questionId", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionChoice_revisionId_position_key" ON "QuestionChoice"("revisionId", "position");

-- CreateIndex
CREATE INDEX "PracticeAttempt_userId_createdAt_idx" ON "PracticeAttempt"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "PracticeAttempt_revisionId_idx" ON "PracticeAttempt"("revisionId");

-- CreateIndex
CREATE UNIQUE INDEX "PracticeAttempt_userId_idempotencyKey_key" ON "PracticeAttempt"("userId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "Upload_objectKey_key" ON "Upload"("objectKey");

-- CreateIndex
CREATE INDEX "Upload_status_nextScanAt_idx" ON "Upload"("status", "nextScanAt");

-- CreateIndex
CREATE INDEX "Upload_courseId_ownerId_idx" ON "Upload"("courseId", "ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "Upload_id_courseId_key" ON "Upload"("id", "courseId");

-- CreateIndex
CREATE UNIQUE INDEX "Upload_ownerId_idempotencyKey_key" ON "Upload"("ownerId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "Report_courseId_status_createdAt_idx" ON "Report"("courseId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Report_contentItemId_idx" ON "Report"("contentItemId");

-- CreateIndex
CREATE INDEX "ModerationAction_courseId_createdAt_idx" ON "ModerationAction"("courseId", "createdAt");

-- CreateIndex
CREATE INDEX "ModerationAction_contentItemId_idx" ON "ModerationAction"("contentItemId");

-- CreateIndex
CREATE UNIQUE INDEX "Appeal_moderationActionId_key" ON "Appeal"("moderationActionId");

-- CreateIndex
CREATE INDEX "Appeal_reportId_status_idx" ON "Appeal"("reportId", "status");

-- CreateIndex
CREATE INDEX "AuditEvent_courseId_createdAt_idx" ON "AuditEvent"("courseId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_targetType_targetId_idx" ON "AuditEvent"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "AuditEvent_createdAt_idx" ON "AuditEvent"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PolicyAcceptance_userId_version_key" ON "PolicyAcceptance"("userId", "version");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseMembership" ADD CONSTRAINT "CourseMembership_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseMembership" ADD CONSTRAINT "CourseMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleGrant" ADD CONSTRAINT "RoleGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleGrant" ADD CONSTRAINT "RoleGrant_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseJoinCode" ADD CONSTRAINT "CourseJoinCode_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseJoinCode" ADD CONSTRAINT "CourseJoinCode_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentItem" ADD CONSTRAINT "ContentItem_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentItem" ADD CONSTRAINT "ContentItem_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentRevision" ADD CONSTRAINT "ContentRevision_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "ContentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentRevision" ADD CONSTRAINT "ContentRevision_editorId_fkey" FOREIGN KEY ("editorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_contentItemId_courseId_fkey" FOREIGN KEY ("contentItemId", "courseId") REFERENCES "ContentItem"("id", "courseId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentTopic" ADD CONSTRAINT "AssessmentTopic_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("contentItemId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentQuestionTemplate" ADD CONSTRAINT "AssessmentQuestionTemplate_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("contentItemId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_contentItemId_courseId_fkey" FOREIGN KEY ("contentItemId", "courseId") REFERENCES "ContentItem"("id", "courseId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_assessmentId_courseId_fkey" FOREIGN KEY ("assessmentId", "courseId") REFERENCES "Assessment"("contentItemId", "courseId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarUpdate" ADD CONSTRAINT "CalendarUpdate_contentItemId_courseId_fkey" FOREIGN KEY ("contentItemId", "courseId") REFERENCES "ContentItem"("id", "courseId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarUpdate" ADD CONSTRAINT "CalendarUpdate_calendarEventId_courseId_fkey" FOREIGN KEY ("calendarEventId", "courseId") REFERENCES "CalendarEvent"("contentItemId", "courseId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_contentItemId_courseId_fkey" FOREIGN KEY ("contentItemId", "courseId") REFERENCES "ContentItem"("id", "courseId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_uploadId_courseId_fkey" FOREIGN KEY ("uploadId", "courseId") REFERENCES "Upload"("id", "courseId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvicePost" ADD CONSTRAINT "AdvicePost_contentItemId_courseId_fkey" FOREIGN KEY ("contentItemId", "courseId") REFERENCES "ContentItem"("id", "courseId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdvicePost" ADD CONSTRAINT "AdvicePost_assessmentId_courseId_fkey" FOREIGN KEY ("assessmentId", "courseId") REFERENCES "Assessment"("contentItemId", "courseId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionBank" ADD CONSTRAINT "QuestionBank_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionBank" ADD CONSTRAINT "QuestionBank_assessmentId_courseId_fkey" FOREIGN KEY ("assessmentId", "courseId") REFERENCES "Assessment"("contentItemId", "courseId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Skill" ADD CONSTRAINT "Skill_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_contentItemId_courseId_fkey" FOREIGN KEY ("contentItemId", "courseId") REFERENCES "ContentItem"("id", "courseId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_bankId_courseId_fkey" FOREIGN KEY ("bankId", "courseId") REFERENCES "QuestionBank"("id", "courseId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionRevision" ADD CONSTRAINT "QuestionRevision_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("contentItemId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionRevision" ADD CONSTRAINT "QuestionRevision_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionChoice" ADD CONSTRAINT "QuestionChoice_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "QuestionRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionRevisionSkill" ADD CONSTRAINT "QuestionRevisionSkill_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "QuestionRevision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionRevisionSkill" ADD CONSTRAINT "QuestionRevisionSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeAttempt" ADD CONSTRAINT "PracticeAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeAttempt" ADD CONSTRAINT "PracticeAttempt_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "QuestionRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Upload" ADD CONSTRAINT "Upload_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Upload" ADD CONSTRAINT "Upload_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "ContentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationAction" ADD CONSTRAINT "ModerationAction_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "ContentItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationAction" ADD CONSTRAINT "ModerationAction_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationAction" ADD CONSTRAINT "ModerationAction_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appeal" ADD CONSTRAINT "Appeal_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appeal" ADD CONSTRAINT "Appeal_moderationActionId_fkey" FOREIGN KEY ("moderationActionId") REFERENCES "ModerationAction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appeal" ADD CONSTRAINT "Appeal_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appeal" ADD CONSTRAINT "Appeal_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PolicyAcceptance" ADD CONSTRAINT "PolicyAcceptance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
