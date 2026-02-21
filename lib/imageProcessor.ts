export interface ImageProcessingOptions {
    format?: "webp" | "png" | "jpeg" | "avif";
    quality?: number;
    cornerRadius?: number;
    maxSizeKB?: number;
    maintainAspectRatio?: boolean;
    maxWidth?: number;
    maxHeight?: number;
}

export interface ProcessedImage {
    blob: Blob;
    fileName: string;
    originalName: string;
    originalSize: number;
    size: number;
    width: number;
    height: number;
    format: string;
    appliedQuality: number;
}

type SupportedFormat = NonNullable<ImageProcessingOptions["format"]>;

// ─── Lazy Loaders ─────────────────────────────────────────────────────────────

let _avif: Promise<typeof import("@jsquash/avif")> | null = null;
let _png: Promise<typeof import("@jsquash/png")> | null = null;
let _webp: Promise<typeof import("@jsquash/webp")> | null = null;
let _jpeg: Promise<typeof import("@jsquash/jpeg")> | null = null;

function loadAvif(): Promise<typeof import("@jsquash/avif")> {
    _avif ??= import("@jsquash/avif");
    return _avif;
}

function loadPng(): Promise<typeof import("@jsquash/png")> {
    _png ??= import("@jsquash/png");
    return _png;
}

function loadWebp(): Promise<typeof import("@jsquash/webp")> {
    _webp ??= import("@jsquash/webp");
    return _webp;
}

function loadJpeg(): Promise<typeof import("@jsquash/jpeg")> {
    _jpeg ??= import("@jsquash/jpeg");
    return _jpeg;
}

// ─── Format Encoders ──────────────────────────────────────────────────────────

async function encodeAvif(
    imageData: ImageData,
    quality: number,
): Promise<Blob> {
    const mod = await loadAvif();
    const buffer = await mod.encode(imageData, {
        quality,
        qualityAlpha: quality,
        speed: 6,
    });
    return new Blob([buffer], { type: "image/avif" });
}

async function encodePng(imageData: ImageData): Promise<Blob> {
    const mod = await loadPng();
    const buffer = await mod.encode(imageData);
    return new Blob([buffer], { type: "image/png" });
}

async function encodeWebp(
    imageData: ImageData,
    quality: number,
): Promise<Blob> {
    const mod = await loadWebp();
    const buffer = await mod.encode(imageData, {
        quality,
        method: 4,
    });
    return new Blob([buffer], { type: "image/webp" });
}

async function encodeJpeg(
    imageData: ImageData,
    quality: number,
): Promise<Blob> {
    const mod = await loadJpeg();
    const buffer = await mod.encode(imageData, {
        quality,
        progressive: true,
        optimize_coding: true,
    });
    return new Blob([buffer], { type: "image/jpeg" });
}

// ─── Warmup ───────────────────────────────────────────────────────────────────

async function warmupEncoder(format: SupportedFormat): Promise<void> {
    switch (format) {
        case "avif":
            await loadAvif();
            break;
        case "png":
            await loadPng();
            break;
        case "webp":
            await loadWebp();
            break;
        case "jpeg":
            await loadJpeg();
            break;
    }
}

// ─── Main Processor ───────────────────────────────────────────────────────────

export class ImageProcessor {
    static async processImage(
        file: File,
        options: ImageProcessingOptions = {},
    ): Promise<ProcessedImage> {
        const {
            format = "webp",
            quality = 80,
            cornerRadius = 0,
            maxSizeKB,
            maintainAspectRatio = true,
            maxWidth,
            maxHeight,
        } = options;

        const imageBitmap = await createImageBitmap(file);

        const { width, height } = this.calculateDimensions(
            imageBitmap.width,
            imageBitmap.height,
            maxWidth,
            maxHeight,
            maintainAspectRatio,
        );

        const canvas = new OffscreenCanvas(width, height);
        const ctx = canvas.getContext("2d", {
            alpha: true,
        }) as OffscreenCanvasRenderingContext2D;

        ctx.clearRect(0, 0, width, height);

        if (cornerRadius > 0) {
            const effectiveRadius = Math.min(
                cornerRadius,
                Math.min(width, height) / 2,
            );
            this.applyRoundedCorners(ctx, width, height, effectiveRadius);
            ctx.clip();
        }

        ctx.drawImage(imageBitmap, 0, 0, width, height);
        imageBitmap.close();

        const imageData = this.readImageData(canvas);

        let blob: Blob;
        let appliedQuality: number;

        if (maxSizeKB !== undefined) {
            const result = await this.compressToSize(
                imageData,
                format,
                maxSizeKB * 1024,
            );
            blob = result.blob;
            appliedQuality = result.quality;
        } else {
            blob = await this.encodeImageData(imageData, format, quality);
            appliedQuality = quality;
        }

        return {
            blob,
            fileName: this.generateFileName(file.name, format),
            originalName: file.name,
            originalSize: file.size,
            size: blob.size,
            width,
            height,
            format,
            appliedQuality,
        };
    }

    private static async encodeImageData(
        imageData: ImageData,
        format: SupportedFormat,
        quality: number,
    ): Promise<Blob> {
        switch (format) {
            case "avif":
                return encodeAvif(imageData, quality);
            case "png":
                return encodePng(imageData);
            case "webp":
                return encodeWebp(imageData, quality);
            case "jpeg":
                return encodeJpeg(imageData, quality);
        }
    }

    private static readImageData(canvas: OffscreenCanvas): ImageData {
        const ctx = canvas.getContext("2d", {
            willReadFrequently: true,
        }) as OffscreenCanvasRenderingContext2D;
        return ctx.getImageData(0, 0, canvas.width, canvas.height);
    }

    private static async compressToSize(
        imageData: ImageData,
        format: SupportedFormat,
        targetSize: number,
    ): Promise<{ blob: Blob; quality: number }> {
        if (format === "png") {
            const blob = await encodePng(imageData);
            return { blob, quality: 100 };
        }

        const maxQuality = format === "avif" ? 90 : 95;
        let minQuality = 10;
        let maxQ = maxQuality;
        let bestBlob: Blob | null = null;
        let bestQuality = 0;

        for (
            let attempts = 0;
            attempts < 12 && maxQ - minQuality > 2;
            attempts++
        ) {
            const currentQuality = Math.round((minQuality + maxQ) / 2);
            const blob = await this.encodeImageData(
                imageData,
                format,
                currentQuality,
            );

            if (blob.size <= targetSize) {
                bestBlob = blob;
                bestQuality = currentQuality;
                minQuality = currentQuality;
            } else {
                maxQ = currentQuality;
            }
        }

        if (!bestBlob) {
            bestBlob = await this.encodeImageData(
                imageData,
                format,
                minQuality,
            );
            bestQuality = minQuality;
        }

        return { blob: bestBlob, quality: bestQuality };
    }

    static async processImages(
        files: File[],
        options: ImageProcessingOptions = {},
        onProgress?: (processed: number, total: number) => void,
        signal?: AbortSignal,
    ): Promise<ProcessedImage[]> {
        if (options.format) {
            await warmupEncoder(options.format);
        }

        const results: ProcessedImage[] = [];

        for (let i = 0; i < files.length; i++) {
            if (signal?.aborted) break;

            try {
                const processed = await this.processImage(files[i], options);
                results.push(processed);
                onProgress?.(i + 1, files.length);
            } catch (error) {
                console.error(`Error processing ${files[i].name}:`, error);
            }
        }

        return results;
    }

    private static calculateDimensions(
        originalWidth: number,
        originalHeight: number,
        maxWidth?: number,
        maxHeight?: number,
        maintainAspectRatio: boolean = true,
    ): { width: number; height: number } {
        let width = originalWidth;
        let height = originalHeight;

        if (!maxWidth && !maxHeight) return { width, height };

        if (maintainAspectRatio) {
            const ratio = originalWidth / originalHeight;

            if (maxWidth && maxHeight) {
                if (width > maxWidth) {
                    width = maxWidth;
                    height = width / ratio;
                }
                if (height > maxHeight) {
                    height = maxHeight;
                    width = height * ratio;
                }
            } else if (maxWidth) {
                if (width > maxWidth) {
                    width = maxWidth;
                    height = width / ratio;
                }
            } else if (maxHeight) {
                if (height > maxHeight) {
                    height = maxHeight;
                    width = height * ratio;
                }
            }
        } else {
            width = maxWidth ?? width;
            height = maxHeight ?? height;
        }

        return { width: Math.round(width), height: Math.round(height) };
    }

    private static applyRoundedCorners(
        ctx: OffscreenCanvasRenderingContext2D,
        width: number,
        height: number,
        radius: number,
    ): void {
        ctx.beginPath();
        ctx.moveTo(radius, 0);
        ctx.lineTo(width - radius, 0);
        ctx.quadraticCurveTo(width, 0, width, radius);
        ctx.lineTo(width, height - radius);
        ctx.quadraticCurveTo(width, height, width - radius, height);
        ctx.lineTo(radius, height);
        ctx.quadraticCurveTo(0, height, 0, height - radius);
        ctx.lineTo(0, radius);
        ctx.quadraticCurveTo(0, 0, radius, 0);
        ctx.closePath();
    }

    private static generateFileName(
        originalName: string,
        format: string,
    ): string {
        const nameWithoutExt = originalName.replace(/\.[^/.]+$/, "");
        return `${nameWithoutExt}.${format}`;
    }

    static downloadImage(processedImage: ProcessedImage): void {
        const url = URL.createObjectURL(processedImage.blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = processedImage.fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    static async downloadAsZip(images: ProcessedImage[]): Promise<void> {
        if (images.length === 0) return;
        const JSZip = (await import("jszip")).default;
        const zip = new JSZip();
        images.forEach((img) => zip.file(img.fileName, img.blob));
        const blob = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "images.zip";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

export const ImageUtils = {
    formatFileSize(bytes: number): string {
        if (bytes === 0) return "0 Bytes";
        const k = 1024;
        const sizes = ["Bytes", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`;
    },

    isFormatSupported(): boolean {
        return typeof OffscreenCanvas !== "undefined";
    },

    isAvifSupported(): boolean {
        return true;
    },

    async getImageInfo(
        file: File,
    ): Promise<{ width: number; height: number; size: number; type: string }> {
        const bitmap = await createImageBitmap(file);
        const info = {
            width: bitmap.width,
            height: bitmap.height,
            size: file.size,
            type: file.type,
        };
        bitmap.close();
        return info;
    },
};
