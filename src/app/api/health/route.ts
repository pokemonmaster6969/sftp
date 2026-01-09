import { NextResponse } from 'next/server';
import { sessions } from '@/server/sessionStore';

export async function GET() {
    return NextResponse.json({
        status: 'ok',
        activeSessions: sessions.size
    });
}
