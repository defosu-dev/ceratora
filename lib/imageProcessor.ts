// lib/imageProcessor.ts

import JSZip from "jszip";

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
        const ctx = canvas.getContext("2d", { alpha: true })!;

        ctx.clearRect(0, 0, width, height);

        if (cornerRadius > 0) {
            const maxRadius = Math.min(width, height) / 2;
            const effectiveRadius = Math.min(cornerRadius, maxRadius);
            this.applyRoundedCorners(ctx, width, height, effectiveRadius);
            ctx.clip();
        }

        ctx.drawImage(imageBitmap, 0, 0, width, height);
        imageBitmap.close();

        let blob: Blob;
        let appliedQuality: number;

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

    private static async convertToBlob(
        canvas: OffscreenCanvas,
        format: string,
        quality: number,
    ): Promise<Blob> {
        let normalizedQuality = quality / 100;

        if (format === "webp" && normalizedQuality > 0.95)
            normalizedQuality = 0.95;
        if (format === "jpeg" && normalizedQuality > 0.98)
            normalizedQuality = 0.98;

        if (format === "png") {
            return this.compressPNGOffscreen(canvas, normalizedQuality);
        }

        const blob = await canvas.convertToBlob({
            type: `image/${format}`,
            quality: normalizedQuality,
        });

        if (!blob || blob.size === 0) {
            throw new Error(`Конвертація в ${format} не вдалась`);
        }

        return blob;
    }

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

    private static async compressToSize(
        canvas: OffscreenCanvas,
        format: string,
        targetSize: number,
    ): Promise<{ blob: Blob; quality: number }> {
        let minQuality = 10;
        let maxQuality = format === "webp" ? 95 : 98;
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

    static async processImages(
        files: File[],
        options: ImageProcessingOptions = {},
        onProgress?: (processed: number, total: number) => void,
        signal?: AbortSignal,
    ): Promise<ProcessedImage[]> {
        const results: ProcessedImage[] = [];

        for (let i = 0; i < files.length; i++) {
            if (signal?.aborted) break;

            try {
                const processed = await this.processImage(files[i], options);
                results.push(processed);
                onProgress?.(i + 1, files.length);
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
        const r = Math.max(0, Math.min(radius, width / 2, height / 2));
        ctx.beginPath();
        ctx.moveTo(r, 0);
        ctx.lineTo(width - r, 0);
        ctx.arcTo(width, 0, width, r, r);
        ctx.lineTo(width, height - r);
        ctx.arcTo(width, height, width - r, height, r);
        ctx.lineTo(r, height);
        ctx.arcTo(0, height, 0, height - r, r);
        ctx.lineTo(0, r);
        ctx.arcTo(0, 0, r, 0, r);
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
}

export const ArchiveUtils = {
    isArchive(file: File): boolean {
        const name = file.name.toLowerCase();
        return (
            name.endsWith(".zip") ||
            name.endsWith(".7z") ||
            name.endsWith(".rar") ||
            name.endsWith(".tar") ||
            name.endsWith(".tar.gz") ||
            name.endsWith(".tgz") ||
            name.endsWith(".tar.bz2") ||
            name.endsWith(".tbz2") ||
            name.endsWith(".tar.xz") ||
            name.endsWith(".txz") ||
            name.endsWith(".cbz") ||
            name.endsWith(".cbr") ||
            name.endsWith(".gz") ||
            name.endsWith(".bz2") ||
            name.endsWith(".xz") ||
            file.type === "application/zip" ||
            file.type === "application/x-zip-compressed" ||
            file.type === "application/x-7z-compressed" ||
            file.type === "application/x-rar-compressed" ||
            file.type === "application/x-tar"
        );
    },

    isImageFile(filename: string, mimeType?: string): boolean {
        if (mimeType && mimeType.startsWith("image/")) return true;
        return /\.(png|jpe?g|webp|gif|bmp|svg|avif|tiff?|ico|heic|heif)$/i.test(
            filename,
        );
    },

    getMimeType(filename: string): string {
        const ext = filename.split(".").pop()?.toLowerCase();
        switch (ext) {
            case "jpg":
            case "jpeg":
                return "image/jpeg";
            case "png":
                return "image/png";
            case "webp":
                return "image/webp";
            case "gif":
                return "image/gif";
            case "svg":
                return "image/svg+xml";
            case "bmp":
                return "image/bmp";
            case "avif":
                return "image/avif";
            case "tif":
            case "tiff":
                return "image/tiff";
            case "ico":
                return "image/x-icon";
            case "heic":
            case "heif":
                return "image/heic";
            default:
                return "image/png";
        }
    },

    async extractImagesFromArchive(file: File): Promise<File[]> {
        const extractedFiles: File[] = [];

        // 1. Спробуємо через libarchive.js (підтримує 7z, rar, tar, zip, iso тощо у WebWorker)
        if (typeof window !== "undefined") {
            try {
                const { Archive } = await import("libarchive.js");
                Archive.init({
                    workerUrl: "/libarchive/worker-bundle.js",
                });
                const archive = await Archive.open(file);
                const entries = await archive.getFilesArray();

                for (const item of entries) {
                    const fileName = item.file.name;
                    const fullPath = item.path
                        ? `${item.path}${fileName}`
                        : fileName;
                    if (
                        !fullPath.startsWith("__MACOSX/") &&
                        !fullPath.includes("/.DS_Store") &&
                        !fullPath.endsWith(".DS_Store") &&
                        ArchiveUtils.isImageFile(fileName)
                    ) {
                        const extractedFile = await item.file.extract();
                        const mimeType =
                            ArchiveUtils.getMimeType(fileName) ||
                            extractedFile.type ||
                            "image/png";
                        const imageFile = new File(
                            [extractedFile],
                            fileName,
                            { type: mimeType },
                        );
                        extractedFiles.push(imageFile);
                    }
                }
                await archive.close();

                if (extractedFiles.length > 0) {
                    return extractedFiles;
                }
            } catch (archiveError) {
                console.warn(
                    "libarchive.js extraction failed, attempting fallback:",
                    archiveError,
                );
            }
        }

        // 2. Fallback до JSZip якщо це zip/cbz
        const lowerName = file.name.toLowerCase();
        if (
            lowerName.endsWith(".zip") ||
            lowerName.endsWith(".cbz") ||
            file.type.includes("zip")
        ) {
            try {
                const zip = await JSZip.loadAsync(file);
                const entries: { path: string; entry: JSZip.JSZipObject }[] =
                    [];
                zip.forEach((relativePath, entry) => {
                    if (
                        !entry.dir &&
                        !relativePath.startsWith("__MACOSX/") &&
                        !relativePath.includes("/.DS_Store") &&
                        !relativePath.endsWith(".DS_Store") &&
                        ArchiveUtils.isImageFile(relativePath)
                    ) {
                        entries.push({ path: relativePath, entry });
                    }
                });

                for (const item of entries) {
                    const blob = await item.entry.async("blob");
                    const baseName =
                        item.path.split("/").pop() || item.path;
                    const mimeType =
                        ArchiveUtils.getMimeType(baseName) ||
                        blob.type ||
                        "image/png";
                    const imageFile = new File([blob], baseName, {
                        type: mimeType,
                    });
                    extractedFiles.push(imageFile);
                }
            } catch (zipError) {
                console.error("JSZip fallback failed:", zipError);
            }
        }

        return extractedFiles;
    },

    // Backward-compatible alias
    async extractImagesFromZip(file: File): Promise<File[]> {
        return this.extractImagesFromArchive(file);
    },

    async downloadZip(
        images: ProcessedImage[],
        zipFileName = "ceratora_images.zip",
    ): Promise<void> {
        const zip = new JSZip();
        const usedNames = new Set<string>();

        for (const img of images) {
            let name = img.fileName;
            if (usedNames.has(name)) {
                const ext = name.split(".").pop() || "";
                const base = name.replace(/\.[^/.]+$/, "");
                let counter = 1;
                while (usedNames.has(`${base}_${counter}.${ext}`)) {
                    counter++;
                }
                name = `${base}_${counter}.${ext}`;
            }
            usedNames.add(name);
            zip.file(name, img.blob);
        }

        const content = await zip.generateAsync({
            type: "blob",
            compression: "DEFLATE",
            compressionOptions: { level: 6 },
        });

        const url = URL.createObjectURL(content);
        const a = document.createElement("a");
        a.href = url;
        a.download = zipFileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },
};

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
