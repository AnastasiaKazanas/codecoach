import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ assignmentId: string }> }
) {
  const { assignmentId } = await ctx.params;

  const { data, error } = await supabase
    .from("assignments")
    .select(
      "id, course_id, title, instructions, instructions_html, fundamentals, objectives, tutorial_url, starter_bundle"
    )
    .eq("id", assignmentId)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ assignment: data });
}