import { sql } from '@vercel/postgres';
import { VercelRequest, VercelResponse } from '@vercel/node';
import { jwtVerify } from 'jose';

export default async function handler(
    request: VercelRequest,
    response: VercelResponse,
) {
    // 1. Check for Session Cookie
    const token = request.cookies.session;
    if (!token) {
        return response.status(401).json({ error: 'Unauthorized: Please sign in.' });
    }

    let userId: string;
    try {
        const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback-secret-change-me');
        const { payload } = await jwtVerify(token, secret);
        userId = payload.userId as string;
    } catch (e) {
        return response.status(401).json({ error: 'Session expired. Please sign in again.' });
    }

    const { method } = request;

    try {
        // 2. Ensure Table Exists
        await sql`
            CREATE TABLE IF NOT EXISTS todos (
                id UUID PRIMARY KEY,
                user_id UUID NOT NULL,
                text TEXT NOT NULL,
                completed BOOLEAN DEFAULT FALSE,
                animation_type TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `;

        if (method === 'GET') {
            const { rows } = await sql`
                SELECT id, text, completed, animation_type as "animationType"
                FROM todos 
                WHERE user_id = ${userId}
                ORDER BY created_at DESC;
            `;
            return response.status(200).json(rows || []);
        }

        if (method === 'POST') {
            const { todos } = request.body;

            if (!Array.isArray(todos)) {
                return response.status(400).json({ error: 'Expected "todos" to be an array.' });
            }

            await sql`BEGIN`;
            try {
                await sql`DELETE FROM todos WHERE user_id = ${userId};`;

                for (const todo of todos) {
                    await sql`
                        INSERT INTO todos (id, user_id, text, completed, animation_type)
                        VALUES (${todo.id}, ${userId}, ${todo.text}, ${todo.completed}, ${todo.animationType});
                    `;
                }
                await sql`COMMIT`;
                return response.status(200).json({ message: 'Synced successfully' });
            } catch (err) {
                await sql`ROLLBACK`;
                throw err;
            }
        }

        return response.status(405).json({ error: 'Method not allowed' });
    } catch (error: any) {
        console.error('API Error:', error);
        return response.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
}
