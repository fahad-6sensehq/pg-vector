import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EmbeddingsService } from '../embeddings/embeddings.service';
import { PrismaService } from '../prisma/prisma.service';
import { cleanText } from './chunker/text-cleaner';
import { splitSections } from './chunker/section-splitter';
import { chunkSections, Chunk } from './chunker/sentence-chunker';
import { extractPdf } from './extractors/pdf.extractor';
import { extractDocx } from './extractors/docx.extractor';

const SUPPORTED_MIME_TYPES = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

@Injectable()
export class FileParserService {
    private readonly logger = new Logger(FileParserService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly embeddingsService: EmbeddingsService,
    ) {}

    async processFile(file: Express.Multer.File) {
        if (!SUPPORTED_MIME_TYPES.includes(file.mimetype)) {
            throw new BadRequestException(
                `Unsupported file type: ${file.mimetype}. Supported: PDF, DOCX`,
            );
        }

        // Step 1: Extract raw text
        this.logger.log(`Extracting text from ${file.originalname}`);
        const extracted = file.mimetype === 'application/pdf'
            ? await extractPdf(file.buffer)
            : await extractDocx(file.buffer);

        // Step 2: Clean & normalize
        this.logger.log('Cleaning extracted text');
        const cleaned = cleanText(extracted.raw);

        if (!cleaned) {
            throw new BadRequestException('No extractable text found in the file');
        }

        // Step 3: Split by sections/headings
        this.logger.log('Splitting into sections');
        const sections = splitSections(cleaned);

        // Step 4: Sentence-aware chunking
        this.logger.log('Chunking sections');
        const chunks = chunkSections(sections);

        this.logger.log(`Generated ${chunks.length} chunks`);

        // Create the document record
        const document = await this.prisma.document.create({
            data: {
                filename: file.originalname,
                mimeType: file.mimetype,
            },
        });

        // Step 5 & 6: Embed each chunk and store
        this.logger.log('Embedding and storing chunks');
        await this.embedAndStoreChunks(document.id, chunks);

        return this.prisma.document.findUnique({
            where: { id: document.id },
            include: { chunks: { select: { id: true, heading: true, chunkIndex: true, tokenCount: true } } },
        });
    }

    async embedAndStoreChunks(documentId: string, chunks: Chunk[]) {
        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            this.logger.log(`Embedding chunk ${i + 1}/${chunks.length} (${chunk.tokenCount} tokens)`);

            const embedding = await this.embeddingsService.embedText(chunk.content);
            const vectorStr = `[${embedding.join(',')}]`;

            await this.prisma.$executeRaw`
                INSERT INTO document_chunks (id, content, heading, "chunkIndex", "tokenCount", embedding, "documentId", "createdAt", "updatedAt")
                VALUES (gen_random_uuid(), ${chunk.content}, ${chunk.heading}, ${i}, ${chunk.tokenCount}, ${vectorStr}::vector, ${documentId}, NOW(), NOW())
            `;
        }
    }

    async searchChunks(query: string, limit = 5) {
        const queryEmbedding = await this.embeddingsService.embedText(query);
        const vectorStr = `[${queryEmbedding.join(',')}]`;

        const chunks: any[] = await this.prisma.$queryRaw`
            SELECT id, content, heading, "chunkIndex", "tokenCount", "documentId",
                   (embedding <=> ${vectorStr}::vector) AS distance
            FROM document_chunks
            ORDER BY distance ASC
            LIMIT ${limit}
        `;

        if (chunks.length === 0) {
            return { answer: 'No relevant documents found.', sources: [] };
        }

        const answer = await this.embeddingsService.generateAnswer(query, chunks);

        return {
            answer,
            sources: chunks.map((c) => ({
                id: c.id,
                content: c.content,
                heading: c.heading,
                chunkIndex: c.chunkIndex,
                documentId: c.documentId,
                distance: c.distance,
            })),
        };
    }

    async listDocuments() {
        return this.prisma.document.findMany({
            include: {
                _count: { select: { chunks: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async getDocument(id: string) {
        const document = await this.prisma.document.findUnique({
            where: { id },
            include: {
                chunks: {
                    select: { id: true, content: true, heading: true, chunkIndex: true, tokenCount: true },
                    orderBy: { chunkIndex: 'asc' },
                },
            },
        });

        if (!document) {
            throw new NotFoundException('Document not found');
        }

        return document;
    }

    async deleteDocument(id: string) {
        const document = await this.prisma.document.findUnique({ where: { id } });

        if (!document) {
            throw new NotFoundException('Document not found');
        }

        await this.prisma.document.delete({ where: { id } });
        return { message: 'Document deleted successfully' };
    }
}
