import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EmbeddingsModule } from './modules/embeddings/embeddings.module';
import { FileParserModule } from './modules/file-parser/file-parser.module';
import { PrismaModule } from './modules/prisma/prisma.module';
import { UsersModule } from './modules/users/users.module';

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        UsersModule,
        EmbeddingsModule,
        FileParserModule,
        PrismaModule,
    ],
})
export class AppModule {}
