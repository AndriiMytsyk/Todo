import { sql } from '@vercel/postgres';
import { VercelRequest, VercelResponse } from '@vercel/node';
import { jwtVerify } from 'jose';

export default async function handler(
    request: VercelRequest,
    response: VercelResponse,
) {
    const token = request.cookies.session;

    if (!token) {
        return response.status(401).json({ error: 'Not authenticated' });
    }

    try {
        const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback-secret-change-me');
        const { payload } = await jwtVerify(token, secret);
        const userId = payload.userId as string;

        const result = await sql`
      SELECT id, email, name, avatar_url FROM users WHERE id = ${userId};
    `;

        const user = result.rows[0];

        if (!user) {
            return response.status(401).json({ error: 'User not found' });
        }

        return response.status(200).json(user);
    } catch (error) {
        return response.status(401).json({ error: 'Invalid session' });
    }
}
