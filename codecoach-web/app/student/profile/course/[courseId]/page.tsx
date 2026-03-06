"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import RequireAuth from "@/components/RequireAuth";
import AppShell from "@/components/AppShell";
import { getAssignmentsForCourse } from "@/lib/db";
import Link from "next/link";

export default function CourseProfilePage() {
  const params = useParams();
  const courseId = params.courseId as string;

  const [assignments, setAssignments] = useState<any[]>([]);

  useEffect(() => {
    async function load() {
      const a = await getAssignmentsForCourse(courseId);
      setAssignments(a ?? []);
    }

    load();
  }, [courseId]);

  return (
    <RequireAuth>
      <AppShell title="Course Progress">

        <div className="card p-6 space-y-3">

          {assignments.map((a) => (
            <Link
              key={a.id}
              href={`/student/profile/course/${courseId}/assignment/${a.id}`}
              className="block p-3 border rounded hover:bg-gray-50"
            >
              {a.title}
            </Link>
          ))}

        </div>

      </AppShell>
    </RequireAuth>
  );
}