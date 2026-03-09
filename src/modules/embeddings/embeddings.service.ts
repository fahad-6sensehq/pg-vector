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
        const baseUrl = 'https://api.openai.com/v1/embeddings';
        const apiKey = process.env.OPENAI_API_KEY;
        const input = JSON.stringify(userData);

        const response = await fetch(baseUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                input,
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
