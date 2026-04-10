import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Post,
    UploadedFile,
    UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FileParserService } from './file-parser.service';

@Controller('file-parser')
export class FileParserController {
    constructor(private readonly fileParserService: FileParserService) {}

    @Post('upload')
    @UseInterceptors(FileInterceptor('file'))
    async uploadFile(@UploadedFile() file: Express.Multer.File) {
        return this.fileParserService.processFile(file);
    }

    @Post('search')
    async search(
        @Body() body: { query: string; limit?: number },
    ) {
        return this.fileParserService.searchChunks(
            body.query,
            body.limit,
        );
    }

    @Get('documents')
    async listDocuments() {
        return this.fileParserService.listDocuments();
    }

    @Get('documents/:id')
    async getDocument(@Param('id') id: string) {
        return this.fileParserService.getDocument(id);
    }

    @Delete('documents/:id')
    async deleteDocument(@Param('id') id: string) {
        return this.fileParserService.deleteDocument(id);
    }
}
