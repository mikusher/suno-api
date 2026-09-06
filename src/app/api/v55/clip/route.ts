import { NextResponse, NextRequest } from "next/server";
import { cookies } from 'next/headers';
import { sunoApi } from "@/lib/SunoApi";
import { corsHeaders } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const clipId = url.searchParams.get('id');

    if (!clipId) {
      return NextResponse.json({ error: 'Missing parameter id' }, { status: 400, headers: corsHeaders });
    }

    const audioInfo = await (await sunoApi((await cookies()).toString())).getClip(clipId);
    return NextResponse.json(audioInfo, { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error('Error fetching audio:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders });
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: corsHeaders });
}
