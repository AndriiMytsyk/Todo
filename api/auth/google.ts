import { sql } from '@vercel/postgres';
import { VercelRequest, VercelResponse } from '@vercel/node';
import { OAuth2Client } from 'google-auth-library';
import { SignJWT } from 'jose';
import { serialize } from 'cookie';

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export default async function handler(
    request: VercelRequest,
    response: VercelResponse,
) {
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method not allowed' });
    }

    const { credential } = request.body;

    if (!credential) {
        return response.status(400).json({ error: 'Missing Google credential' });
    }

    try {
        // 1. Verify Google Token
        const ticket = await client.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();

        if (!payload || !payload.email) {
            return response.status(400).json({ error: 'Invalid Google token' });
        }

        const { email, name, picture, sub: googleId } = payload;

        // 2. Check/Create User in DB
        let result = await sql`
            SELECT id, email, name, avatar_url FROM users WHERE google_id = ${googleId} OR email = ${email};
        `;

        let user;
        if (result.rows.length === 0) {
            // Register new user
            const insertResult = await sql`
                INSERT INTO users (email, name, avatar_url, google_id)
                VALUES (${email}, ${name}, ${picture}, ${googleId})
                RETURNING id, email, name, avatar_url;
            `;
            user = insertResult.rows[0];
        } else {
            user = result.rows[0];
            // Link google_id if not already linked (handles case where user registered with email first)
            if (!user.google_id) {
                await sql`UPDATE users SET google_id = ${googleId} WHERE id = ${user.id}`;
            }
        }

        // 3. Create JWT
        const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback-secret-change-me');
        const token = await new SignJWT({ userId: user.id })
            .setProtectedHeader({ alg: 'HS256' })
            .setIssuedAt()
            .setExpirationTime('7d')
            .sign(secret);

        // 4. Set Cookie
        const cookie = serialize('session', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 24 * 7,
        });

        response.setHeader('Set-Cookie', cookie);
        return response.status(200).json(user);

    } catch (error: any) {
        console.error('Google Auth Error:', error);
        return response.status(500).json({ error: 'Authentication failed', details: error.message });
    }
}
