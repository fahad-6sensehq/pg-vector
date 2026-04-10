import * as mammoth from 'mammoth';
import { ExtractedText } from './pdf.extractor';

/**
 * Converts basic HTML tags to a lightweight markdown-like format so
 * that downstream section splitting can detect headings.
 */
function htmlToStructuredText(html: string): string {
    let text = html;

    // Convert heading tags to markdown-style headings
    text = text.replace(/<h([1-6])[^>]*>(.*?)<\/h\1>/gi, (_match, level, content) => {
        const prefix = '#'.repeat(Number(level));
        return `\n\n${prefix} ${content.replace(/<[^>]+>/g, '').trim()}\n\n`;
    });

    // Convert paragraphs to double-newlines
    text = text.replace(/<\/p>/gi, '\n\n');
    text = text.replace(/<p[^>]*>/gi, '');

    // Convert list items
    text = text.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n');

    // Convert line breaks
    text = text.replace(/<br\s*\/?>/gi, '\n');

    // Strip remaining HTML tags
    text = text.replace(/<[^>]+>/g, '');

    // Decode common HTML entities
    text = text.replace(/&amp;/g, '&');
    text = text.replace(/&lt;/g, '<');
    text = text.replace(/&gt;/g, '>');
    text = text.replace(/&quot;/g, '"');
    text = text.replace(/&#39;/g, "'");
    text = text.replace(/&nbsp;/g, ' ');

    return text.trim();
}

export async function extractDocx(buffer: Buffer): Promise<ExtractedText> {
    const result = await mammoth.convertToHtml({ buffer });
    const structured = htmlToStructuredText(result.value);

    return {
        raw: structured,
        pages: [structured],
    };
}
