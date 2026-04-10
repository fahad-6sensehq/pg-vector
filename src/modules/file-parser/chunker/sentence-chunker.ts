import { encoding_for_model } from 'tiktoken';
import { Section } from './section-splitter';

const MIN_TOKENS = 250;
const MAX_TOKENS = 600;

export interface Chunk {
    content: string;
    heading: string | null;
    tokenCount: number;
}

let encoder: ReturnType<typeof encoding_for_model> | null = null;

function getEncoder() {
    if (!encoder) {
        encoder = encoding_for_model('text-embedding-ada-002');
    }
    return encoder;
}

export function countTokens(text: string): number {
    return getEncoder().encode(text).length;
}

/**
 * Split text into sentences using regex that respects common abbreviations,
 * decimal numbers, and ellipses.
 */
function splitSentences(text: string): string[] {
    // Common abbreviations that shouldn't trigger a sentence break
    const abbrevs = new Set([
        'mr',
        'mrs',
        'ms',
        'dr',
        'prof',
        'sr',
        'jr',
        'st',
        'inc',
        'ltd',
        'corp',
        'vs',
        'etc',
        'approx',
        'dept',
        'est',
        'vol',
        'ref',
        'fig',
        'eq',
        'no',
    ]);

    const sentences: string[] = [];
    // Match sentence-ending punctuation followed by space + uppercase, or end of string
    const regex = /([.!?]+)(\s+)/g;

    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
        const beforePunctuation = text.substring(lastIndex, match.index);
        const punctuation = match[1];
        const whitespace = match[2];

        const afterIndex = match.index + match[0].length;
        const nextChar = text[afterIndex] || '';

        // Check if this is actually a sentence boundary
        const lastWord = beforePunctuation.split(/\s+/).pop()?.toLowerCase() || '';

        // Skip abbreviations
        if (punctuation === '.' && abbrevs.has(lastWord)) {
            continue;
        }

        // Skip decimal numbers (e.g. "3.14")
        if (punctuation === '.' && /\d$/.test(beforePunctuation) && /^\d/.test(nextChar)) {
            continue;
        }

        // Skip ellipsis in middle of sentence
        if (punctuation === '...' && /^[a-z]/.test(nextChar)) {
            continue;
        }

        // Only break if next char is uppercase or end of string
        if (/^[A-Z\u00C0-\u024F"'\u2018\u201C([]/.test(nextChar) || afterIndex >= text.length) {
            const sentence = text.substring(lastIndex, match.index) + punctuation;
            sentences.push(sentence.trim());
            lastIndex = afterIndex;
        }
    }

    // Push any remaining text
    const remaining = text.substring(lastIndex).trim();
    if (remaining) {
        sentences.push(remaining);
    }

    return sentences.filter((s) => s.length > 0);
}

/**
 * Fallback: split a long sentence at clause boundaries (; or , + conjunction).
 */
function splitAtClauseBoundaries(sentence: string): string[] {
    const parts = sentence.split(/(?<=[;])\s+|(?<=,)\s+(?=and |but |or |yet |so |while |although |because )/i);
    return parts.filter((p) => p.trim().length > 0).map((p) => p.trim());
}

/**
 * Chunk sections into pieces of 250-600 tokens without breaking sentences.
 * Chunks never cross section boundaries.
 */
export function chunkSections(sections: Section[]): Chunk[] {
    const chunks: Chunk[] = [];

    for (const section of sections) {
        const sentences = splitSentences(section.content);
        if (sentences.length === 0) continue;

        let currentSentences: string[] = [];
        let currentTokens = 0;
        // Account for heading tokens if present (prepended for embedding context)
        const headingPrefix = section.heading ? `${section.heading}\n` : '';
        const headingTokens = headingPrefix ? countTokens(headingPrefix) : 0;

        for (const sentence of sentences) {
            const sentenceTokens = countTokens(sentence);

            // If a single sentence exceeds MAX_TOKENS, split at clause boundaries
            if (sentenceTokens > MAX_TOKENS) {
                // Flush current buffer first
                if (currentSentences.length > 0) {
                    const content = headingPrefix + currentSentences.join(' ');
                    chunks.push({
                        content,
                        heading: section.heading,
                        tokenCount: countTokens(content),
                    });
                    currentSentences = [];
                    currentTokens = 0;
                }

                const clauses = splitAtClauseBoundaries(sentence);
                let clauseBuffer: string[] = [];
                let clauseTokens = 0;

                for (const clause of clauses) {
                    const ct = countTokens(clause);
                    if (clauseTokens + ct + headingTokens > MAX_TOKENS && clauseBuffer.length > 0) {
                        const content = headingPrefix + clauseBuffer.join(' ');
                        chunks.push({
                            content,
                            heading: section.heading,
                            tokenCount: countTokens(content),
                        });
                        clauseBuffer = [];
                        clauseTokens = 0;
                    }
                    clauseBuffer.push(clause);
                    clauseTokens += ct;
                }
                if (clauseBuffer.length > 0) {
                    const content = headingPrefix + clauseBuffer.join(' ');
                    currentSentences = [];
                    currentTokens = 0;
                    // Try to merge with next sentences if under MIN_TOKENS
                    const contentTokens = countTokens(content);
                    if (contentTokens < MIN_TOKENS) {
                        currentSentences = [clauseBuffer.join(' ')];
                        currentTokens = contentTokens - headingTokens;
                    } else {
                        chunks.push({
                            content,
                            heading: section.heading,
                            tokenCount: contentTokens,
                        });
                    }
                }
                continue;
            }

            // Would adding this sentence exceed MAX_TOKENS?
            if (currentTokens + sentenceTokens + headingTokens > MAX_TOKENS && currentSentences.length > 0) {
                const content = headingPrefix + currentSentences.join(' ');
                chunks.push({
                    content,
                    heading: section.heading,
                    tokenCount: countTokens(content),
                });
                currentSentences = [];
                currentTokens = 0;
            }

            currentSentences.push(sentence);
            currentTokens += sentenceTokens;
        }

        // Flush remaining sentences in the section
        if (currentSentences.length > 0) {
            const content = headingPrefix + currentSentences.join(' ');
            chunks.push({
                content,
                heading: section.heading,
                tokenCount: countTokens(content),
            });
        }
    }

    return chunks;
}
