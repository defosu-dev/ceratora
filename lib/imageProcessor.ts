// imageProcessor.ts

export interface ImageProcessingOptions {
    format?: "webp" | "avif" | "png" | "jpeg";
    quality?: number; // 0-100
    cornerRadius?: number; // в пікселях
    maxSizeKB?: number; // максимальний розмір файлу в КБ
    compressionPercent?: number; // відсоток стиснення (0-100)
    maintainAspectRatio?: boolean;
    maxWidth?: number;
    maxHeight?: number;
}

export interface ProcessedImage {
    blob: Blob;
    fileName: string;
    originalName: string;
    size: number;
    width: number;
    height: number;
    format: string;
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
            quality = 85,
            cornerRadius = 0,
            maxSizeKB,
            compressionPercent,
            maintainAspectRatio = true,
            maxWidth,
            maxHeight,
        } = options;

        // Завантаження зображення
        const img = await this.loadImage(file);

        // Створення canvas
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d")!;

        // Розрахунок розмірів
        const { width, height } = this.calculateDimensions(
            img.width,
            img.height,
            maxWidth,
            maxHeight,
            maintainAspectRatio,
        );

        canvas.width = width;
        canvas.height = height;

        // Застосування закруглених кутів
        if (cornerRadius > 0) {
            this.applyRoundedCorners(ctx, width, height, cornerRadius);
            ctx.clip();
        }

        // Малювання зображення
        ctx.drawImage(img, 0, 0, width, height);

        // Конвертація в потрібний формат
        let finalQuality = quality / 100;

        // Якщо вказано відсоток стиснення
        if (compressionPercent !== undefined) {
            finalQuality = 1 - compressionPercent / 100;
        }

        let blob = await this.canvasToBlob(canvas, format, finalQuality);

        // Якщо вказано максимальний розмір - стискаємо до досягнення
        if (maxSizeKB && blob.size > maxSizeKB * 1024) {
            blob = await this.compressToSize(
                canvas,
                format,
                maxSizeKB * 1024,
                finalQuality,
            );
        }

        // Генерація імені файлу
        const fileName = this.generateFileName(file.name, format);

        return {
            blob,
            fileName,
            originalName: file.name,
            size: blob.size,
            width,
            height,
            format,
        };
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
                // Можна додати обробку помилок за потребою
            }
        }

        return results;
    }

    /**
     * Завантаження зображення
     */
    private static loadImage(file: File): Promise<HTMLImageElement> {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const url = URL.createObjectURL(file);

            img.onload = () => {
                URL.revokeObjectURL(url);
                resolve(img);
            };

            img.onerror = () => {
                URL.revokeObjectURL(url);
                reject(
                    new Error(
                        `Не вдалося завантажити зображення: ${file.name}`,
                    ),
                );
            };

            img.src = url;
        });
    }

    /**
     * Розрахунок розмірів зображення
     */
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

    /**
     * Застосування закруглених кутів
     */
    private static applyRoundedCorners(
        ctx: CanvasRenderingContext2D,
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

    /**
     * Конвертація canvas в blob
     */
    private static canvasToBlob(
        canvas: HTMLCanvasElement,
        format: string,
        quality: number,
    ): Promise<Blob> {
        return new Promise((resolve, reject) => {
            canvas.toBlob(
                (blob) => {
                    if (blob) {
                        resolve(blob);
                    } else {
                        reject(new Error("Не вдалося створити blob"));
                    }
                },
                `image/${format}`,
                quality,
            );
        });
    }

    /**
     * Стиснення до заданого розміру
     */
    private static async compressToSize(
        canvas: HTMLCanvasElement,
        format: string,
        targetSize: number,
        initialQuality: number,
    ): Promise<Blob> {
        let quality = initialQuality;
        let blob: Blob;
        let attempts = 0;
        const maxAttempts = 10;

        do {
            blob = await this.canvasToBlob(canvas, format, quality);

            if (blob.size <= targetSize || attempts >= maxAttempts) {
                break;
            }

            // Зменшуємо якість
            quality *= 0.9;
            attempts++;
        } while (blob.size > targetSize);

        return blob;
    }

    /**
     * Генерація імені файлу
     */
    private static generateFileName(
        originalName: string,
        format: string,
    ): string {
        const nameWithoutExt = originalName.replace(/\.[^/.]+$/, "");
        return `${nameWithoutExt}.${format}`;
    }

    /**
     * Завантаження оброблених зображень
     */
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

    /**
     * Завантаження всіх зображень як ZIP (опціонально)
     */
    static downloadAll(processedImages: ProcessedImage[]): void {
        processedImages.forEach((img) => {
            this.downloadImage(img);
        });
    }

    /**
     * Створення preview URL для відображення
     */
    static createPreviewURL(processedImage: ProcessedImage): string {
        return URL.createObjectURL(processedImage.blob);
    }
}

// Допоміжні утиліти
export const ImageUtils = {
    /**
     * Форматування розміру файлу
     */
    formatFileSize(bytes: number): string {
        if (bytes === 0) return "0 Bytes";
        const k = 1024;
        const sizes = ["Bytes", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return (
            Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i]
        );
    },

    /**
     * Перевірка підтримки формату
     */
    isFormatSupported(format: string): boolean {
        const canvas = document.createElement("canvas");
        return (
            canvas
                .toDataURL(`image/${format}`)
                .indexOf(`data:image/${format}`) === 0
        );
    },

    /**
     * Отримання інформації про зображення
     */
    async getImageInfo(file: File): Promise<{
        width: number;
        height: number;
        size: number;
        type: string;
    }> {
        const img = await ImageProcessor["loadImage"](file);
        return {
            width: img.width,
            height: img.height,
            size: file.size,
            type: file.type,
        };
    },
};
