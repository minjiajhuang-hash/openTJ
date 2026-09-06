import type { ReactNode } from "react";
import { CourseGate } from "@/lib/client/store";

export default function CourseLayout({ children }: { children: ReactNode }) { return <CourseGate>{children}</CourseGate>; }
