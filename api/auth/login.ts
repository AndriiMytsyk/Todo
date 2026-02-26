import { sql } from '@vercel/postgres';
import { VercelRequest, VercelResponse } from '@vercel/node';
import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';
import { serialize } from 'cookie';

export default async function handler(
    request: VercelRequest,
    response: VercelResponse,
) {
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method not allowed' });
    }

    const { email, password } = request.body;

    try {
        const result = await sql`
      SELECT * FROM users WHERE email = ${email};
    `;

        const user = result.rows[0];

        if (!user || !user.password_hash) {
            return response.status(401).json({ error: 'Invalid email or password' });
        }

        const passwordMatch = await bcrypt.compare(password, user.password_hash);

        if (!passwordMatch) {
            return response.status(401).json({ error: 'Invalid email or password' });
        }

        // Create JWT
        const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback-secret-change-me');
        const token = await new SignJWT({ userId: user.id })
            .setProtectedHeader({ alg: 'HS256' })
            .setIssuedAt()
            .setExpirationTime('7d')
            .sign(secret);

        // Set Cookie
        const cookie = serialize('session', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 24 * 7,
        });

        response.setHeader('Set-Cookie', cookie);
        return response.status(200).json({
            id: user.id,
            email: user.email,
            name: user.name,
            avatar_url: user.avatar_url
        });

    } catch (error: any) {
        console.error('Login Error:', error);
        return response.status(500).json({ error: 'Internal Server Error' });
    }
}
