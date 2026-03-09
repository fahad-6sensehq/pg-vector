import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../../generated/prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(PrismaService.name);
    private readonly connectionString: string;

    constructor(configService: ConfigService) {
        let connectionString = configService.getOrThrow<string>('DATABASE_URL');

        const adapter = new PrismaPg({
            connectionString,
        });

        super({
            adapter,
            log: [
                { emit: 'event', level: 'query' },
                { emit: 'event', level: 'error' },
                { emit: 'event', level: 'warn' },
            ],
        });
        this.connectionString = connectionString;

        // Enable query logging for slow query detection
        // (this as any).$on('query', (e: any) => {
        //   if (e.duration > this.SLOW_QUERY_THRESHOLD) {
        //     this.logger.warn(`Slow query detected: ${e.duration}ms`, {
        //       query: e.query,
        //       params: e.params,
        //       duration: e.duration,
        //     });
        //   }
        // });
    }

    async onModuleDestroy(): Promise<void> {
        this.logger.log('Disconnecting from database...');
        await this.$disconnect();
        this.logger.log('Database disconnected');
    }

    async onModuleInit(): Promise<void> {
        this.logger.log(`Connecting to database`);
        try {
            await this.$connect();
            this.logger.log('Database connected successfully');
        } catch (error) {
            this.logger.error(`Database connection failed: ${error instanceof Error ? error.message : String(error)}`);
            throw error;
        }
    }
}
