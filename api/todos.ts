import { sql } from '@vercel/postgres';
import { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuth } from '@clerk/backend';

export default async function handler(
    request: VercelRequest,
    response: VercelResponse,
) {
    // 1. Verify Authentication
    const { userId } = getAuth(request);
    if (!userId) {
        return response.status(401).json({ error: 'Unauthorized' });
    }

    const { method } = request;

    try {
        // 2. Ensure Table Exists
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
            return response.status(200).json(rows);
        }

        if (method === 'POST') {
            const { todos } = request.body;

            // We'll use a transaction logic approach: Delete old, Insert new
            // (This is simple for a to-do list sync. For larger apps, we'd use UPSERT or selective updates)
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
    } catch (error) {
        console.error('API Error:', error);
        return response.status(500).json({ error: 'Internal Server Error' });
    }
}
