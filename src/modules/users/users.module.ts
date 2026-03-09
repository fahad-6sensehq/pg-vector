import { Module } from '@nestjs/common';
import { EmbeddingsModule } from '../embeddings/embeddings.module';
import { EmbeddingsService } from '../embeddings/embeddings.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
    imports: [EmbeddingsModule],
    controllers: [UsersController],
    providers: [UsersService, EmbeddingsService],
    exports: [UsersService],
})
export class UsersModule {}
