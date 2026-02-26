import { sql } from '@vercel/postgres';
import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClerkClient } from '@clerk/backend';

export default async function handler(
    request: VercelRequest,
    response: VercelResponse,
) {
    // 1. Check for Critical Environment Variables
    if (!process.env.CLERK_SECRET_KEY) {
        return response.status(500).json({
            error: 'Missing CLERK_SECRET_KEY. Please ensure it is added to Vercel Environment Variables.'
        });
    }

    if (!process.env.POSTGRES_URL) {
        return response.status(500).json({
            error: 'Missing POSTGRES_URL. Please ensure you have connected a Vercel Postgres (Neon) database in the Storage tab.'
        });
    }

    const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

    // 2. Verify Authentication
    try {
        const requestState = await clerk.authenticateRequest(request as any);
        const userId = (requestState as any).userId || (requestState.toAuth() as any).userId;

        if (!userId) {
            return response.status(401).json({
                error: 'Unauthorized: No valid session found.',
                details: 'Please ensure you are logged in and the request includes valid Clerk credentials.'
            });
        }

        const { method } = request;

        try {
            // 3. Ensure Table Exists
            await sql`
        CREATE TABLE IF NOT EXISTS todos (
          id UUID PRIMARY KEY,
          user_id TEXT NOT NULL,
          text TEXT NOT NULL,
          completed BOOLEAN DEFAULT FALSE,
          animation_type TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `;

            if (method === 'GET') {
                // Fetch user-specific todos
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
            console.error('Database/API Error:', error);
            return response.status(500).json({
                error: 'Database error. Check your Postgres connection.',
                details: error.message
            });
        }
    } catch (authError: any) {
        console.error('Auth Verification Error:', authError);
        return response.status(401).json({
            error: 'Authentication failed. Please sign in again.',
            details: authError.message
        });
    }
}
