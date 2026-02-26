import { VercelRequest, VercelResponse } from '@vercel/node';
import { serialize } from 'cookie';

export default async function handler(
    request: VercelRequest,
    response: VercelResponse,
) {
    const cookie = serialize('session', '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: -1,
    });

    response.setHeader('Set-Cookie', cookie);
    return response.status(200).json({ message: 'Logged out' });
}
