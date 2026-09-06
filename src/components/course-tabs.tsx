"use client";

import { CalendarDays, ClipboardList, FileText, Lightbulb, MessageSquareText } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppData } from "@/lib/client/store";

const tabs = [
  { label: "Calendar", href: "calendar", icon: CalendarDays },
  { label: "Assessments", href: "assessments", icon: ClipboardList },
  { label: "Notes", href: "notes", icon: FileText },
  { label: "Advice", href: "advice", icon: Lightbulb },
  { label: "Sample Questions", href: "questions", icon: MessageSquareText },
];

export function CourseTabs() {
  const pathname = usePathname();
  const { slug } = useAppData();
  return (
    <nav aria-label="Course sections" className="course-tabs">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const href = `/courses/${slug}/${tab.href}`;
        const active = pathname === href;
        return (
          <Link aria-current={active ? "page" : undefined} className={`course-tab${active ? " active" : ""}`} href={{ pathname: href }} key={tab.href} title={tab.label}>
            <Icon aria-hidden="true" />
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
