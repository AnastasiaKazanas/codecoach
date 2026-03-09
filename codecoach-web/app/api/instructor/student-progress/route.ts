import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(req: Request) {
  const url = new URL(req.url);

  const studentId = url.searchParams.get("studentId");
  const courseId = url.searchParams.get("courseId");

  if (!studentId || !courseId) {
    return NextResponse.json(
      { error: "Missing studentId or courseId" },
      { status: 400 }
    );
  }

  const supabase = supabaseAdmin();

  const { data, error } = await supabase
    .from("sessions")
    .select(`
      id,
      summary,
      assignment_id,
      assignments (
        title
      )
    `)
    .eq("user_id", studentId)
    .eq("assignments.course_id", courseId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: learning } = await supabase
    .from("learning_profiles")
    .select("mastered,developing")
    .eq("student_id", studentId)
    .eq("course_id", courseId)
    .maybeSingle();

  return NextResponse.json({
    sessions: data,
    mastered: learning?.mastered || [],
    developing: learning?.developing || []
  });
}