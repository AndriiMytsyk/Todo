import { kv } from '@vercel/kv';
import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
    request: VercelRequest,
    response: VercelResponse,
) {
    const { method } = request;

    try {
        if (method === 'GET') {
            const todos = await kv.get('todos') || [];
            return response.status(200).json(todos);
        }

        if (method === 'POST') {
            const { todos } = request.body;
            await kv.set('todos', todos);
            return response.status(200).json({ message: 'Saved successfully' });
        }

        return response.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error('API Error:', error);
        return response.status(500).json({ error: 'Failed to process request' });
    }
}
