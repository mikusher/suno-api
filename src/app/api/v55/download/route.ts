import { NextRequest } from "next/server";
import { cookies } from 'next/headers';
import { sunoApi } from "@/lib/SunoApi";
import { corsHeaders } from "@/lib/utils";
import { createProxiedResponse, normalizeDownloadFormat } from "@/lib/v55";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const clipId = url.searchParams.get('id');
    const format = normalizeDownloadFormat(url.searchParams.get('format'));

    if (!clipId) {
      return Response.json({ error: 'Missing parameter id' }, { status: 400, headers: corsHeaders });
    }

    if (!format) {
      return Response.json(
        { error: 'Invalid or missing format. Use wav, mp3, m4a, or mp4.' },
        { status: 400, headers: corsHeaders }
      );
    }

    const download = await (await sunoApi((await cookies()).toString())).downloadClip(clipId, format);
    const response = createProxiedResponse(download);
    for (const [key, value] of Object.entries(corsHeaders)) {
      response.headers.set(key, value);
    }
    return response;
  } catch (error: any) {
    console.error('Error downloading audio:', error);
    return Response.json(
      { error: error.response?.data?.detail || error.message || 'Internal server error' },
      { status: error.response?.status || 500, headers: corsHeaders }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: corsHeaders });
}
