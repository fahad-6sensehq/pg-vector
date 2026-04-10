import { Injectable, NotFoundException } from '@nestjs/common';
import { User } from 'generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EmbeddingsService {
    constructor(private readonly prisma: PrismaService) {}

    async getEmbedding(userId: string) {
        return this.prisma.systemEmbeddings.findFirst({
            where: { userId },
        });
    }

    async createEmbeddingData(userId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        const embeddingStructure = await this.createEmbeddingStructure(user);
        const embedding = await this.createEmbeddingRequest(embeddingStructure);

        await this.createEmbedding(userId, embedding);
        return;
    }

    async createEmbeddingStructure(user: User) {
        const userData = {
            email: user.email,
            bio: user.bio || '',
            interests: user.interests || [],
            movies: user.movies || [],
            tvShows: user.tvShows || [],
            books: user.books || [],
            music: user.music || [],
            games: user.games || [],
            other: user.other || [],
        };

        return userData;
    }

    async createEmbeddingRequest(userData: any) {
        return this.embedText(JSON.stringify(userData));
    }

    async embedText(text: string): Promise<number[]> {
        const baseUrl = 'https://api.openai.com/v1/embeddings';
        const apiKey = process.env.OPENAI_API_KEY;

        const response = await fetch(baseUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                input: text,
                model: 'text-embedding-ada-002',
                encoding_format: 'float',
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(`OpenAI API error: ${data.error?.message}`);
        }

        return data.data[0].embedding;
    }

    async generateAnswer(query: string, contextChunks: { content: string; heading?: string | null }[]): Promise<string> {
        const context = contextChunks
            .map((c, i) => {
                const header = c.heading ? `[${c.heading}]\n` : '';
                return `--- Chunk ${i + 1} ---\n${header}${c.content}`;
            })
            .join('\n\n');

        const apiKey = process.env.OPENAI_API_KEY;

        const response = await fetch('https://api.openai.com/v1/responses', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: 'gpt-4.1-nano',
                instructions: [
                    'You are a helpful assistant that answers questions based ONLY on the provided document context.',
                    'If the context does not contain enough information to answer, say so clearly.',
                    'Do not make up information. Cite specifics from the context when possible.',
                ].join(' '),
                input: [
                    {
                        role: 'user',
                        content: `Context from documents:\n\n${context}\n\n---\n\nQuestion: ${query}`,
                    },
                ],
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(`OpenAI API error: ${data.error?.message}`);
        }

        return data.output
            .filter((item: any) => item.type === 'message')
            .flatMap((item: any) => item.content)
            .filter((block: any) => block.type === 'output_text')
            .map((block: any) => block.text)
            .join('');
    }

    async createEmbedding(userId: string, embedding: number[]) {
        const vectorStr = `[${embedding.join(',')}]`;

        await this.prisma.$executeRaw`
            INSERT INTO system_embeddings (id, embedding, "userId", "createdAt", "updatedAt")
            VALUES (gen_random_uuid(), ${vectorStr}::vector, ${userId}, NOW(), NOW())
            ON CONFLICT ("userId")
            DO UPDATE SET embedding = ${vectorStr}::vector, "updatedAt" = NOW()
        `;

        return;
    }
}
