// lib/imageProcessor.ts

export interface ImageProcessingOptions {
    format?: "webp" | "png" | "jpeg";
    quality?: number; // 0-100
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

export class ImageProcessor {
    /**
     * Обробка одного зображення
     */
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

        // Завантаження зображення через createImageBitmap для кращої якості
        const imageBitmap = await createImageBitmap(file);

        // Розрахунок розмірів
        const { width, height } = this.calculateDimensions(
            imageBitmap.width,
            imageBitmap.height,
            maxWidth,
            maxHeight,
            maintainAspectRatio,
        );

        // Створення OffscreenCanvas для максимальної продуктивності
        const canvas = new OffscreenCanvas(width, height);
        const ctx = canvas.getContext("2d", {
            alpha: true,
        })!;

        ctx.clearRect(0, 0, width, height);

        // Застосування закруглених кутів
        if (cornerRadius > 0) {
            const maxRadius = Math.min(width, height) / 2;
            const effectiveRadius = Math.min(cornerRadius, maxRadius);
            this.applyRoundedCorners(ctx, width, height, effectiveRadius);
            ctx.clip();
        }

        // Малювання з високою якістю
        ctx.drawImage(imageBitmap, 0, 0, width, height);
        imageBitmap.close();

        let blob: Blob;
        let appliedQuality: number;

        // Обробка залежно від режиму
        if (maxSizeKB !== undefined) {
            const result = await this.compressToSize(
                canvas,
                format,
                maxSizeKB * 1024,
            );
            blob = result.blob;
            appliedQuality = result.quality;
        } else {
            appliedQuality = quality;
            blob = await this.convertToBlob(canvas, format, quality);
        }

        const fileName = this.generateFileName(file.name, format);

        return {
            blob,
            fileName,
            originalName: file.name,
            originalSize: file.size,
            size: blob.size,
            width,
            height,
            format,
            appliedQuality,
        };
    }

    /**
     * Конвертація OffscreenCanvas в blob
     */
    private static async convertToBlob(
        canvas: OffscreenCanvas,
        format: string,
        quality: number,
    ): Promise<Blob> {
        // Нормалізуємо якість до 0-1
        let normalizedQuality = quality / 100;

        // КРИТИЧНО: Для WebP обмежуємо максимум до 95%
        // При 100% браузер використовує lossless режим який збільшує розмір
        if (format === "webp" && normalizedQuality > 0.95) {
            normalizedQuality = 0.95;
        }

        // Для JPEG також обмежуємо до 98%
        if (format === "jpeg" && normalizedQuality > 0.98) {
            normalizedQuality = 0.98;
        }

        // Для PNG використовуємо кастомну компресію
        if (format === "png") {
            return this.compressPNGOffscreen(canvas, normalizedQuality);
        }

        // Для WebP та JPEG
        const blob = await canvas.convertToBlob({
            type: `image/${format}`,
            quality: normalizedQuality,
        });

        if (!blob || blob.size === 0) {
            throw new Error(`Конвертація в ${format} не вдалась`);
        }

        return blob;
    }

    /**
     * Компресія PNG для OffscreenCanvas
     */
    private static async compressPNGOffscreen(
        canvas: OffscreenCanvas,
        quality: number,
    ): Promise<Blob> {
        const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        let colorDepth: number;
        if (quality >= 0.9) colorDepth = 256;
        else if (quality >= 0.7) colorDepth = 128;
        else if (quality >= 0.5) colorDepth = 64;
        else if (quality >= 0.3) colorDepth = 32;
        else colorDepth = 16;

        const step = Math.floor(256 / colorDepth);

        for (let i = 0; i < data.length; i += 4) {
            data[i] = Math.round(data[i] / step) * step;
            data[i + 1] = Math.round(data[i + 1] / step) * step;
            data[i + 2] = Math.round(data[i + 2] / step) * step;
        }

        const tempCanvas = new OffscreenCanvas(canvas.width, canvas.height);
        const tempCtx = tempCanvas.getContext("2d")!;
        tempCtx.putImageData(imageData, 0, 0);

        return tempCanvas.convertToBlob({ type: "image/png" });
    }

    /**
     * Стиснення до заданого розміру з бінарним пошуком
     */
    private static async compressToSize(
        canvas: OffscreenCanvas,
        format: string,
        targetSize: number,
    ): Promise<{ blob: Blob; quality: number }> {
        let minQuality = 10;
        let maxQuality = format === "webp" ? 95 : 98; // Обмежуємо максимум
        let bestBlob: Blob | null = null;
        let bestQuality = 0;
        const maxAttempts = 12;
        let attempts = 0;

        while (attempts < maxAttempts && maxQuality - minQuality > 2) {
            const currentQuality = Math.round((minQuality + maxQuality) / 2);

            const blob = await this.convertToBlob(
                canvas,
                format,
                currentQuality,
            );

            if (blob.size <= targetSize) {
                bestBlob = blob;
                bestQuality = currentQuality;
                minQuality = currentQuality;
            } else {
                maxQuality = currentQuality;
            }

            attempts++;
        }

        if (!bestBlob) {
            bestQuality = minQuality;
            bestBlob = await this.convertToBlob(canvas, format, minQuality);
        }

        return { blob: bestBlob, quality: bestQuality };
    }

    /**
     * Обробка масиву зображень
     */
    static async processImages(
        files: File[],
        options: ImageProcessingOptions = {},
        onProgress?: (processed: number, total: number) => void,
    ): Promise<ProcessedImage[]> {
        const results: ProcessedImage[] = [];

        for (let i = 0; i < files.length; i++) {
            try {
                const processed = await this.processImage(files[i], options);
                results.push(processed);

                if (onProgress) {
                    onProgress(i + 1, files.length);
                }
            } catch (error) {
                console.error(`Помилка обробки ${files[i].name}:`, error);
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

        if (!maxWidth && !maxHeight) {
            return { width, height };
        }

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
            width = maxWidth || width;
            height = maxHeight || height;
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

    static downloadAll(processedImages: ProcessedImage[]): void {
        processedImages.forEach((img) => this.downloadImage(img));
    }

    static createPreviewURL(processedImage: ProcessedImage): string {
        return URL.createObjectURL(processedImage.blob);
    }

    static async checkFormatSupport(format: string): Promise<boolean> {
        // Підтримуємо тільки WebP, PNG, JPEG
        return ["webp", "png", "jpeg"].includes(format);
    }
}

export const ImageUtils = {
    formatFileSize(bytes: number): string {
        if (bytes === 0) return "0 Bytes";
        const k = 1024;
        const sizes = ["Bytes", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return (
            Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i]
        );
    },

    isFormatSupported(): boolean {
        return typeof OffscreenCanvas !== "undefined";
    },

    async getImageInfo(file: File): Promise<{
        width: number;
        height: number;
        size: number;
        type: string;
    }> {
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
