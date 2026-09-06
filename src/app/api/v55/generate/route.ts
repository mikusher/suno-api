import { NextResponse, NextRequest } from "next/server";
import { cookies } from 'next/headers';
import { DEFAULT_MODEL, sunoApi } from "@/lib/SunoApi";
import { corsHeaders } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt, tags, negative_tags, title, make_instrumental, model, wait_audio } = body;

    const audioInfo = await (await sunoApi((await cookies()).toString())).custom_generate(
      prompt,
      tags || '',
      title || '',
      Boolean(make_instrumental),
      model || DEFAULT_MODEL,
      Boolean(wait_audio),
      negative_tags || ''
    );

    return NextResponse.json(audioInfo, { status: 200, headers: corsHeaders });
  } catch (error: any) {
    console.error('Error generating audio:', error);
    return NextResponse.json(
      { error: error.response?.data?.detail || error.message || 'Internal error' },
      { status: error.response?.status || 500, headers: corsHeaders }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: corsHeaders });
}
