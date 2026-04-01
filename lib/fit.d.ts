export interface FitOptions {
    /** Markdown content string */
    markdown: string;
    /** Theme name: classic | warm | academic | editorial | smartisan | noir | mint | ink | tech | kraft */
    theme?: string;
    /** Font family name */
    fontFamily?: string;
    /** Margin in millimeters */
    marginMm?: number;
    /** Line height ratio */
    lineHeightRatio?: number;
    /** Paragraph spacing in em */
    paragraphSpacing?: number;
    /** First line indent in em */
    firstLineIndent?: number;
    /** Output directory (default: current working directory) */
    outputDir?: string;
    /** Output filename without extension (default: "output") */
    outputName?: string;
    /** Vite dev server base URL (default: auto-start via vite preview) */
    baseUrl?: string;
}
export interface FitResult {
    /** Path to generated PDF */
    pdf: string;
    /** Path to generated PNG */
    png: string;
    /** Path to saved Markdown file */
    md: string;
    /** Final font size in px */
    fontSize: number;
    /** Whether content still overflows at minimum font size */
    overflow: boolean;
}
/**
 * Fit Markdown content to a single A4 page.
 * Returns paths to generated PDF and PNG files.
 */
export declare function fitToPage(options: FitOptions): Promise<FitResult>;
/**
 * Start Vite dev server from the package directory and return its URL.
 */
export declare function startPreviewServer(): Promise<string>;
//# sourceMappingURL=fit.d.ts.map