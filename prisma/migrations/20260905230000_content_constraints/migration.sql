-- Defense in depth for relationships that otherwise depend on API validation.
ALTER TABLE "Note" ADD CONSTRAINT "Note_representation_check" CHECK (
  ("mode" = 'PDF' AND "uploadId" IS NOT NULL AND "body" IS NULL) OR
  ("mode" <> 'PDF' AND "uploadId" IS NULL AND "body" IS NOT NULL)
);
ALTER TABLE "AdvicePost" ADD CONSTRAINT "AdvicePost_assessment_check" CHECK (
  ("type" = 'GENERAL' AND "assessmentId" IS NULL) OR
  ("type" = 'ASSESSMENT_SPECIFIC' AND "assessmentId" IS NOT NULL)
);
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_dates_check" CHECK (
  ("allDay" AND "startDate" IS NOT NULL AND "startsAt" IS NULL AND "endsAt" IS NULL AND ("endDate" IS NULL OR "endDate" > "startDate")) OR
  (NOT "allDay" AND "startsAt" IS NOT NULL AND "startDate" IS NULL AND "endDate" IS NULL AND ("endsAt" IS NULL OR "endsAt" > "startsAt"))
);
ALTER TABLE "QuestionRevision" ADD CONSTRAINT "QuestionRevision_tolerance_check" CHECK (
  ("absoluteTolerance" IS NULL OR "absoluteTolerance" >= 0) AND
  ("relativeTolerance" IS NULL OR ("relativeTolerance" >= 0 AND "relativeTolerance" <= 1)) AND
  ("acceptedAnswers" IS NULL OR jsonb_typeof("acceptedAnswers") = 'array')
);
CREATE UNIQUE INDEX "QuestionChoice_one_correct" ON "QuestionChoice" ("revisionId") WHERE "isCorrect";
ALTER TABLE "ContentItem" ADD CONSTRAINT "ContentItem_version_check" CHECK ("version" > 0);
ALTER TABLE "Upload" ADD CONSTRAINT "Upload_size_check" CHECK ("bytes" >= 0 AND "bytes" <= 20971520 AND ("pages" IS NULL OR ("pages" > 0 AND "pages" <= 200)));

ALTER TABLE "Report" ADD CONSTRAINT "Report_content_course_fkey"
  FOREIGN KEY ("contentItemId", "courseId") REFERENCES "ContentItem" ("id", "courseId") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX "Report_id_courseId_key" ON "Report" ("id", "courseId");
-- Existing single-column FKs set the nullable target ID to NULL on deletion;
-- deferred composite checks preserve that behavior without nulling course IDs.
ALTER TABLE "ModerationAction" ADD CONSTRAINT "ModerationAction_content_course_fkey"
  FOREIGN KEY ("contentItemId", "courseId") REFERENCES "ContentItem" ("id", "courseId") DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "ModerationAction" ADD CONSTRAINT "ModerationAction_report_course_fkey"
  FOREIGN KEY ("reportId", "courseId") REFERENCES "Report" ("id", "courseId") DEFERRABLE INITIALLY DEFERRED;

CREATE FUNCTION enforce_content_kind() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "ContentItem" WHERE "id" = NEW."contentItemId" AND "kind"::text = TG_ARGV[0]) THEN
    RAISE EXCEPTION 'Content subtype must match its envelope kind' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "Assessment_kind_check" BEFORE INSERT OR UPDATE ON "Assessment" FOR EACH ROW EXECUTE FUNCTION enforce_content_kind('ASSESSMENT');
CREATE TRIGGER "CalendarEvent_kind_check" BEFORE INSERT OR UPDATE ON "CalendarEvent" FOR EACH ROW EXECUTE FUNCTION enforce_content_kind('CALENDAR_EVENT');
CREATE TRIGGER "CalendarUpdate_kind_check" BEFORE INSERT OR UPDATE ON "CalendarUpdate" FOR EACH ROW EXECUTE FUNCTION enforce_content_kind('CALENDAR_UPDATE');
CREATE TRIGGER "Note_kind_check" BEFORE INSERT OR UPDATE ON "Note" FOR EACH ROW EXECUTE FUNCTION enforce_content_kind('NOTE');
CREATE TRIGGER "AdvicePost_kind_check" BEFORE INSERT OR UPDATE ON "AdvicePost" FOR EACH ROW EXECUTE FUNCTION enforce_content_kind('ADVICE');
CREATE TRIGGER "Question_kind_check" BEFORE INSERT OR UPDATE ON "Question" FOR EACH ROW EXECUTE FUNCTION enforce_content_kind('QUESTION');

CREATE FUNCTION enforce_question_skill_course() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "QuestionRevision" r JOIN "Question" q ON q."contentItemId" = r."questionId"
    JOIN "Skill" s ON s."courseId" = q."courseId" WHERE r."id" = NEW."revisionId" AND s."id" = NEW."skillId"
  ) THEN RAISE EXCEPTION 'Question skills must belong to the same course' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "QuestionRevisionSkill_course_check" BEFORE INSERT OR UPDATE ON "QuestionRevisionSkill" FOR EACH ROW EXECUTE FUNCTION enforce_question_skill_course();
