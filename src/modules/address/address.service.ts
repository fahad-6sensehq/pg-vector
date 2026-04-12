import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface AddressDto {
    street: string;
    zip: string;
    city: string;
    country: string;
    latitude: number;
    longitude: number;
}

interface AddressRow {
    id: string;
    street: string;
    zip: string;
    city: string;
    country: string;
    latitude: number;
    longitude: number;
    userId: string;
    createdAt: Date;
    updatedAt: Date;
}

interface NearbyUserRow {
    id: string;
    email: string;
    bio: string | null;
    street: string;
    city: string;
    country: string;
    latitude: number;
    longitude: number;
    distance_km: number;
}

@Injectable()
export class AddressService {
    constructor(private readonly prisma: PrismaService) {}

    async createAddress(userId: string, dto: AddressDto): Promise<AddressRow> {
        const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
        if (!user) throw new NotFoundException('User not found');

        const existing = await this.prisma.$queryRaw<AddressRow[]>`
            SELECT id FROM addresses WHERE "userId" = ${userId}
        `;
        if (existing.length > 0) {
            throw new BadRequestException('User already has an address. Use update instead.');
        }

        const rows = await this.prisma.$queryRaw<AddressRow[]>`
            INSERT INTO addresses (id, street, zip, city, country, location, "userId", "createdAt", "updatedAt")
            VALUES (
                gen_random_uuid(),
                ${dto.street},
                ${dto.zip},
                ${dto.city},
                ${dto.country},
                ST_SetSRID(ST_MakePoint(${dto.longitude}, ${dto.latitude}), 4326)::geography,
                ${userId},
                NOW(),
                NOW()
            )
            RETURNING
                id, street, zip, city, country,
                ST_Y(location::geometry) AS latitude,
                ST_X(location::geometry) AS longitude,
                "userId", "createdAt", "updatedAt"
        `;

        return rows[0];
    }

    async getAddress(userId: string): Promise<AddressRow> {
        const rows = await this.prisma.$queryRaw<AddressRow[]>`
            SELECT
                id, street, zip, city, country,
                ST_Y(location::geometry) AS latitude,
                ST_X(location::geometry) AS longitude,
                "userId", "createdAt", "updatedAt"
            FROM addresses
            WHERE "userId" = ${userId}
        `;

        if (rows.length === 0) throw new NotFoundException('Address not found for this user');
        return rows[0];
    }

    async updateAddress(userId: string, dto: Partial<AddressDto>): Promise<AddressRow> {
        const existing = await this.prisma.$queryRaw<{ id: string }[]>`
            SELECT id FROM addresses WHERE "userId" = ${userId}
        `;
        if (existing.length === 0) throw new NotFoundException('Address not found for this user');

        const rows = await this.prisma.$queryRaw<AddressRow[]>`
            UPDATE addresses
            SET
                street    = COALESCE(${dto.street ?? null}, street),
                zip       = COALESCE(${dto.zip ?? null}, zip),
                city      = COALESCE(${dto.city ?? null}, city),
                country   = COALESCE(${dto.country ?? null}, country),
                location  = CASE
                    WHEN ${dto.latitude ?? null}::double precision IS NOT NULL
                     AND ${dto.longitude ?? null}::double precision IS NOT NULL
                    THEN ST_SetSRID(ST_MakePoint(
                        ${dto.longitude ?? 0}::double precision,
                        ${dto.latitude ?? 0}::double precision
                    ), 4326)::geography
                    ELSE location
                END,
                "updatedAt" = NOW()
            WHERE "userId" = ${userId}
            RETURNING
                id, street, zip, city, country,
                ST_Y(location::geometry) AS latitude,
                ST_X(location::geometry) AS longitude,
                "userId", "createdAt", "updatedAt"
        `;

        return rows[0];
    }

    async deleteAddress(userId: string): Promise<{ message: string }> {
        const existing = await this.prisma.$queryRaw<{ id: string }[]>`
            SELECT id FROM addresses WHERE "userId" = ${userId}
        `;
        if (existing.length === 0) throw new NotFoundException('Address not found for this user');

        await this.prisma.$queryRaw`
            DELETE FROM addresses WHERE "userId" = ${userId}
        `;

        return { message: 'Address deleted successfully' };
    }

    async findNearbyFriends(userId: string, radiusKm: number): Promise<NearbyUserRow[]> {
        const radiusMeters = radiusKm * 1000;

        const rows = await this.prisma.$queryRaw<NearbyUserRow[]>`
            WITH origin AS (
                SELECT location FROM addresses WHERE "userId" = ${userId}
            )
            SELECT
                u.id,
                u.email,
                u.bio,
                a.street,
                a.city,
                a.country,
                ST_Y(a.location::geometry) AS latitude,
                ST_X(a.location::geometry) AS longitude,
                ROUND(
                    (ST_Distance(a.location, origin.location) / 1000.0)::numeric, 2
                ) AS distance_km
            FROM users u
            JOIN addresses a ON a."userId" = u.id
            CROSS JOIN origin
            WHERE u.id != ${userId}
              AND ST_DWithin(a.location, origin.location, ${radiusMeters}::double precision)
            ORDER BY distance_km ASC
        `;

        return rows;
    }
}
