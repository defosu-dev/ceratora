// imageProcessor.ts

export interface ImageProcessingOptions {
    format?: "webp" | "avif" | "png" | "jpeg";
    quality?: number; // 0-100 (використовується тільки якщо maxSizeKB не вказано)
    cornerRadius?: number; // в пікселях
    maxSizeKB?: number; // максимальний розмір файлу в КБ (якщо вказано, quality ігнорується)
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
    appliedQuality: number; // фактична якість, яка була застосована
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
            quality = 80, // Змінено дефолт на 80 для кращої компресії
            cornerRadius = 0,
            maxSizeKB,
            maintainAspectRatio = true,
            maxWidth,
            maxHeight,
        } = options;

        // Перевіряємо чи потрібна взагалі обробка
        const needsProcessing =
            cornerRadius > 0 || maxWidth || maxHeight || maxSizeKB;
        const originalFormat = file.type.replace("image/", "");

        // Якщо формат співпадає і обробка не потрібна, просто змінюємо якість
        if (originalFormat === format && !needsProcessing) {
            // Все одно обробляємо через canvas для зміни якості
        }

        // Перевіряємо підтримку формату
        if (format === "avif") {
            const supported = await this.checkFormatSupport("avif");
            if (!supported) {
                throw new Error(
                    "AVIF формат не підтримується вашим браузером. Спробуйте WebP або PNG.",
                );
            }
        }

        // Завантаження зображення
        const img = await this.loadImage(file);

        // Створення canvas
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", { alpha: true })!;

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

        // Очищуємо canvas з прозорим фоном
        ctx.clearRect(0, 0, width, height);

        // Застосування закруглених кутів
        if (cornerRadius > 0) {
            // Обмежуємо радіус до половини найменшої сторони для правильного круглого зображення
            const maxRadius = Math.min(width, height) / 2;
            const effectiveRadius = Math.min(cornerRadius, maxRadius);
            this.applyRoundedCorners(ctx, width, height, effectiveRadius);
            ctx.clip();
        }

        // Малювання зображення
        ctx.drawImage(img, 0, 0, width, height);

        let blob: Blob;
        let appliedQuality: number;

        // Якщо вказано максимальний розмір - шукаємо оптимальну якість
        if (maxSizeKB !== undefined) {
            const result = await this.compressToSize(
                canvas,
                format,
                maxSizeKB * 1024,
            );
            blob = result.blob;
            appliedQuality = result.quality;
        } else {
            // Використовуємо вказану якість
            appliedQuality = quality;
            blob = await this.canvasToBlob(canvas, format, quality / 100);
        }

        // Генерація імені файлу
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
            // PNG потребує спеціальної обробки
            if (format === "png" && quality < 1.0) {
                this.compressPNG(canvas, quality).then(resolve).catch(reject);
                return;
            }

            // Для інших форматів використовуємо стандартний quality
            canvas.toBlob(
                (blob) => {
                    if (blob) {
                        // Перевіряємо чи формат реально підтримується
                        // AVIF часто повертає blob, але не стискає його правильно
                        if (format === "avif" && blob.size === 0) {
                            reject(
                                new Error(
                                    "AVIF формат не підтримується вашим браузером",
                                ),
                            );
                            return;
                        }
                        resolve(blob);
                    } else {
                        reject(
                            new Error(
                                `Не вдалося створити blob для формату ${format}`,
                            ),
                        );
                    }
                },
                `image/${format}`,
                quality,
            );
        });
    }

    /**
     * Агресивна компресія PNG через зменшення кольорової палітри
     */
    private static async compressPNG(
        sourceCanvas: HTMLCanvasElement,
        quality: number,
    ): Promise<Blob> {
        const width = sourceCanvas.width;
        const height = sourceCanvas.height;

        // Отримуємо дані пікселів
        const sourceCtx = sourceCanvas.getContext("2d", {
            alpha: true,
            willReadFrequently: true,
        })!;
        const imageData = sourceCtx.getImageData(0, 0, width, height);
        const data = imageData.data;

        // Квантизація кольорів залежно від якості
        // quality 1.0 = без квантизації
        // quality 0.5 = агресивна квантизація
        // quality 0.1 = максимальна компресія

        let colorDepth: number;
        if (quality >= 0.9) {
            colorDepth = 256; // повна палітра
        } else if (quality >= 0.7) {
            colorDepth = 128; // хороша якість
        } else if (quality >= 0.5) {
            colorDepth = 64; // середня якість
        } else if (quality >= 0.3) {
            colorDepth = 32; // низька якість
        } else {
            colorDepth = 16; // мінімальна якість
        }

        const step = Math.floor(256 / colorDepth);

        // Квантизуємо кожен піксель
        for (let i = 0; i < data.length; i += 4) {
            // Квантизація RGB (залишаємо альфа-канал без змін для прозорості)
            data[i] = Math.round(data[i] / step) * step; // R
            data[i + 1] = Math.round(data[i + 1] / step) * step; // G
            data[i + 2] = Math.round(data[i + 2] / step) * step; // B
            // data[i + 3] - Alpha залишаємо як є
        }

        // Створюємо новий canvas з обробленими даними
        const resultCanvas = document.createElement("canvas");
        resultCanvas.width = width;
        resultCanvas.height = height;
        const resultCtx = resultCanvas.getContext("2d", { alpha: true })!;
        resultCtx.putImageData(imageData, 0, 0);

        // Конвертуємо в blob
        return new Promise((resolve, reject) => {
            resultCanvas.toBlob((blob) => {
                if (blob) {
                    resolve(blob);
                } else {
                    reject(new Error("Не вдалося створити PNG blob"));
                }
            }, "image/png");
        });
    }

    /**
     * Стиснення до заданого розміру з пошуком оптимальної якості
     */
    private static async compressToSize(
        canvas: HTMLCanvasElement,
        format: string,
        targetSize: number,
    ): Promise<{ blob: Blob; quality: number }> {
        // Бінарний пошук оптимальної якості
        let minQuality = 0.1;
        let maxQuality = 1.0;
        let bestBlob: Blob | null = null;
        let bestQuality = 0;
        const maxAttempts = 15;
        let attempts = 0;

        while (attempts < maxAttempts && maxQuality - minQuality > 0.01) {
            const currentQuality = (minQuality + maxQuality) / 2;
            const blob = await this.canvasToBlob(
                canvas,
                format,
                currentQuality,
            );

            if (blob.size <= targetSize) {
                // Підходить - зберігаємо як найкращий варіант
                bestBlob = blob;
                bestQuality = currentQuality;
                // Пробуємо знайти ще кращу якість
                minQuality = currentQuality;
            } else {
                // Занадто великий - зменшуємо якість
                maxQuality = currentQuality;
            }

            attempts++;
        }

        // Якщо не знайшли підходящий варіант, використовуємо мінімальну якість
        if (!bestBlob) {
            bestQuality = minQuality;
            bestBlob = await this.canvasToBlob(canvas, format, minQuality);
        }

        return {
            blob: bestBlob,
            quality: Math.round(bestQuality * 100),
        };
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
     * Завантаження всіх зображень
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

    /**
     * Перевірка підтримки формату браузером
     */
    static async checkFormatSupport(format: string): Promise<boolean> {
        return new Promise((resolve) => {
            const canvas = document.createElement("canvas");
            canvas.width = 1;
            canvas.height = 1;

            canvas.toBlob(
                (blob) => {
                    // Якщо blob створений і має розмір > 0, формат підтримується
                    resolve(blob !== null && blob.size > 0);
                },
                `image/${format}`,
                0.5,
            );
        });
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
