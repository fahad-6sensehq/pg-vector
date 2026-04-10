import { PDFParse } from 'pdf-parse';

export interface ExtractedText {
    raw: string;
    pages: string[];
}

export async function extractPdf(buffer: Buffer): Promise<ExtractedText> {
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    const result = await parser.getText({ pageJoiner: '\n\n' });

    const pages = result.pages.map((p) => p.text);

    await parser.destroy();

    return {
        raw: result.text,
        pages,
    };
}
