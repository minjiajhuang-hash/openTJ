"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { useAppData } from "@/lib/client/store";

export function PageHeading({
  title,
  description,
  action,
  course = false,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  course?: boolean;
}) {
  const { data, slug } = useAppData();
  return (
    <header className="page-header">
      {course ? (
        <div className="breadcrumbs">
          <Link href="/courses">Courses</Link>
          <ChevronRight aria-hidden="true" size={12} />
          <Link href={`/courses/${slug}`}>{data?.course.name ?? "Course"}</Link>
        </div>
      ) : null}
      <div className="page-title-row">
        <div>
          <h1 className="page-title">{title}</h1>
          {description ? <p className="page-description">{description}</p> : null}
        </div>
        {action}
      </div>
    </header>
  );
}
