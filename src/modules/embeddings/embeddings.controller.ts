import { Controller, Get, Query } from '@nestjs/common';
import { EmbeddingsService } from './embeddings.service';

@Controller('embeddings')
export class EmbeddingsController {
    constructor(private readonly embeddingsService: EmbeddingsService) {}

    @Get('get')
    getEmbedding(@Query('userId') userId: string) {
        return this.embeddingsService.getEmbedding(userId);
    }
}
