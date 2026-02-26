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

    const { email, password, name } = request.body;

    if (!email || !password || !name) {
        return response.status(400).json({ error: 'Missing required fields' });
    }

    try {
        // 1. Ensure Table Exists
        await sql`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT,
        google_id TEXT UNIQUE,
        name TEXT NOT NULL,
        avatar_url TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

        // 2. Hash Password
        const passwordHash = await bcrypt.hash(password, 10);

        // 3. Insert User
        const result = await sql`
      INSERT INTO users (email, password_hash, name)
      VALUES (${email}, ${passwordHash}, ${name})
      RETURNING id, email, name;
    `;

        const user = result.rows[0];

        // 4. Create JWT
        const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback-secret-change-me');
        const token = await new SignJWT({ userId: user.id })
            .setProtectedHeader({ alg: 'HS256' })
            .setIssuedAt()
            .setExpirationTime('7d')
            .sign(secret);

        // 5. Set Cookie
        const cookie = serialize('session', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 24 * 7, // 1 week
        });

        response.setHeader('Set-Cookie', cookie);
        return response.status(201).json(user);

    } catch (error: any) {
        console.error('Registration Error:', error);
        if (error.code === '23505') {
            return response.status(400).json({ error: 'Email already exists' });
        }
        return response.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
}
