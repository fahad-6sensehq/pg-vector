import { Module } from '@nestjs/common';
import { EmbeddingsModule } from '../embeddings/embeddings.module';
import { FileParserController } from './file-parser.controller';
import { FileParserService } from './file-parser.service';

@Module({
    imports: [EmbeddingsModule],
    controllers: [FileParserController],
    providers: [FileParserService],
    exports: [FileParserService],
})
export class FileParserModule {}
