"use client";

import RequireAuth from "@/components/RequireAuth";
import AppShell from "@/components/AppShell";
import { useEffect, useState } from "react";
import { getCurrentUser, getLearningProfile, getStudentCourses } from "@/lib/db";
import Link from "next/link";

export default function StudentOverallProfilePage() {
  const [profile, setProfile] = useState<any>(null);
  const [courses, setCourses] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        setErr(null);
        setLoading(true);

        const user = await getCurrentUser();
        if (!user?.email) {
          setErr("Not signed in.");
          return;
        }

        const p = await getLearningProfile(user.email);
        setProfile(p);

        const c = await getStudentCourses(user.email);
        setCourses(c ?? []);
      } catch (e: any) {
        setErr(e?.message ?? "Failed to load profile.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  return (
    <RequireAuth>
      <AppShell title="My Profile">

        {loading && (
          <div className="text-sm text-black/60">Loading...</div>
        )}

        {err && (
          <div className="text-sm text-red-700">{err}</div>
        )}

        {!loading && !err && profile && (
          <div className="space-y-6">

            {/* AI SUMMARY */}
            <div className="card p-6">
              <h2 className="font-semibold text-lg mb-2">
                AI Learning Summary
              </h2>

              <p className="text-sm text-black/80 whitespace-pre-line">
                {profile.summary || "No summary yet."}
              </p>
            </div>

            {/* MASTERED */}
            <div className="card p-6">
              <h2 className="font-semibold text-lg mb-3">
                Mastered Concepts
              </h2>

              <ul className="list-disc ml-5 text-sm">
                {profile.mastered?.map((m: string) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>

            {/* DEVELOPING */}
            <div className="card p-6">
              <h2 className="font-semibold text-lg mb-3">
                Developing Concepts
              </h2>

              <ul className="list-disc ml-5 text-sm">
                {profile.developing?.map((d: string) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </div>

            {/* COURSES */}
            <div className="card p-6">
              <h2 className="font-semibold text-lg mb-4">
                My Courses
              </h2>

              <div className="space-y-2">

                {courses.map((course) => (
                  <Link
                    key={course.id}
                    href={`/student/profile/course/${course.id}`}
                    className="block p-3 border rounded hover:bg-gray-50"
                  >
                    {course.title}
                  </Link>
                ))}

              </div>
            </div>

          </div>
        )}
      </AppShell>
    </RequireAuth>
  );
}