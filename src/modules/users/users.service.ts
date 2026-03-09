import { Injectable } from '@nestjs/common';
import { User } from 'generated/prisma/client';
import { EmbeddingsService } from '../embeddings/embeddings.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly embeddingsService: EmbeddingsService,
    ) {}

    async createUser(body: any): Promise<User> {
        const { email, password, bio, interests, movies, tvShows, books, music, games, other } = body;
        const user = await this.prisma.user.create({
            data: {
                email,
                password,
                bio,
                interests,
                movies,
                tvShows,
                books,
                music,
                games,
                other,
            },
        });

        await this.embeddingsService.createEmbeddingData(user.id);

        return user as User;
    }

    async getUser(id: string): Promise<User> {
        const user = await this.prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                email: true,
                bio: true,
                interests: true,
                movies: true,
                tvShows: true,
                books: true,
                music: true,
                games: true,
                other: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        return user as User;
    }

    async updateUser(id: string, body: any): Promise<User> {
        const { bio, interests, movies, tvShows, books, music, games, other } = body;
        const user = await this.prisma.user.update({
            where: { id },
            data: {
                bio,
                interests,
                movies,
                tvShows,
                books,
                music,
                games,
                other,
            },
        });

        await this.embeddingsService.createEmbeddingData(id);

        return user as User;
    }

    async matchUsers(userId: string): Promise<User[]> {
        let users = [];
        try {
            users = await this.prisma.$queryRaw`
                SELECT u.id, u.email, u.bio, u.interests, u.movies,
                       u."tvShows", u.books, u.music, u.games, u.other,
                       u."createdAt", u."updatedAt",
                       (se.embedding <=> target.embedding) AS distance
            FROM users u
            JOIN system_embeddings se ON se."userId" = u.id
            CROSS JOIN (
                SELECT embedding FROM system_embeddings WHERE "userId" = ${userId}
            ) target
            WHERE u.id != ${userId}
            ORDER BY distance ASC
            LIMIT 5
        `;
        } catch (error) {
            console.error(error);
            throw new Error('Failed to match users');
        }

        return users as User[];
    }
}
