declare module 'csv-parser' {
    import { Transform } from 'stream';

    interface CsvParserOptions {
        separator?: string;
        newline?: string;
        quote?: string;
        escape?: string;
        headers?: string[] | boolean;
        maxRowBytes?: number;
        strict?: boolean;
        skipLines?: number;
    }

    function csv(options?: CsvParserOptions): Transform;
    export = csv;
}
