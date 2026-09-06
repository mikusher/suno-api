import { NextResponse, NextRequest } from "next/server";
import { cookies } from 'next/headers';
import { sunoApi } from "@/lib/SunoApi";
import { corsHeaders } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: 'Missing parameter id' }, { status: 400, headers: corsHeaders });
    }

    const data = await (await sunoApi((await cookies()).toString())).authorizeDownload(id);
    return NextResponse.json(data, { status: 200, headers: corsHeaders });
  } catch (error: any) {
    console.error('Error authorizing download:', error);
    return NextResponse.json(
      { error: error.response?.data?.detail || error.message || 'Internal server error' },
      { status: error.response?.status || 500, headers: corsHeaders }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: corsHeaders });
}
