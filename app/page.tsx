// app/page.tsx
"use client";

import { useState, useCallback } from "react";
import {
    ImageProcessor,
    ImageProcessingOptions,
    ProcessedImage,
} from "@/lib/imageProcessor";
import {
    Upload,
    Download,
    Settings,
    Image as ImageIcon,
    Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

export default function Home() {
    const [files, setFiles] = useState<File[]>([]);
    const [processedImages, setProcessedImages] = useState<ProcessedImage[]>(
        [],
    );
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);

    // Налаштування обробки
    const [options, setOptions] = useState<ImageProcessingOptions>({
        format: "webp",
        quality: 85,
        cornerRadius: 0,
        maxSizeKB: undefined,
        maxWidth: undefined,
        maxHeight: undefined,
    });

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setFiles(Array.from(e.target.files));
            setProcessedImages([]);
            setProgress(0);
        }
    };

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        if (e.dataTransfer.files) {
            setFiles(Array.from(e.dataTransfer.files));
            setProcessedImages([]);
            setProgress(0);
        }
    }, []);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const processImages = async () => {
        if (files.length === 0) return;

        setIsProcessing(true);
        setProgress(0);

        try {
            const processed = await ImageProcessor.processImages(
                files,
                options,
                (current, total) => {
                    setProgress((current / total) * 100);
                },
            );
            setProcessedImages(processed);
        } catch (error) {
            console.error("Помилка обробки:", error);
        } finally {
            setIsProcessing(false);
        }
    };

    const downloadAll = () => {
        processedImages.forEach((img) => {
            ImageProcessor.downloadImage(img);
        });
    };

    const clearAll = () => {
        setFiles([]);
        setProcessedImages([]);
        setProgress(0);
    };

    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return "0 Bytes";
        const k = 1024;
        const sizes = ["Bytes", "KB", "MB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return (
            Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i]
        );
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-zinc-950">
            <main className="flex min-h-screen w-full max-w-5xl flex-col gap-8 py-12 px-6 bg-white dark:bg-black">
                {/* Header */}
                <div className="flex flex-col gap-2">
                    <h1 className="text-4xl font-bold tracking-tight">
                        Ceratora
                    </h1>
                    <p className="text-muted-foreground">
                        Обробка зображень для iGaming контенту
                    </p>
                </div>

                <div className="grid gap-8 lg:grid-cols-2">
                    {/* Ліва колонка - Upload & Settings */}
                    <div className="flex flex-col gap-6">
                        {/* Upload Area */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Upload className="h-5 w-5" />
                                    Завантаження
                                </CardTitle>
                                <CardDescription>
                                    Перетягніть зображення або виберіть файли
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div
                                    onDrop={handleDrop}
                                    onDragOver={handleDragOver}
                                    className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary transition-colors cursor-pointer"
                                    onClick={() =>
                                        document
                                            .getElementById("fileInput")
                                            ?.click()
                                    }
                                >
                                    <ImageIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                                    <p className="text-sm text-muted-foreground mb-2">
                                        Перетягніть файли сюди або натисніть для
                                        вибору
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        PNG, JPG, WEBP до 100 файлів
                                    </p>
                                    <Input
                                        id="fileInput"
                                        type="file"
                                        multiple
                                        accept="image/*"
                                        onChange={handleFileSelect}
                                        className="hidden"
                                    />
                                </div>

                                {files.length > 0 && (
                                    <div className="mt-4">
                                        <div className="flex items-center justify-between mb-2">
                                            <p className="text-sm font-medium">
                                                Вибрано файлів: {files.length}
                                            </p>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={clearAll}
                                            >
                                                <Trash2 className="h-4 w-4 mr-2" />
                                                Очистити
                                            </Button>
                                        </div>
                                        <div className="max-h-32 overflow-y-auto space-y-1">
                                            {files.map((file, idx) => (
                                                <div
                                                    key={idx}
                                                    className="text-xs text-muted-foreground flex justify-between"
                                                >
                                                    <span className="truncate">
                                                        {file.name}
                                                    </span>
                                                    <span>
                                                        {formatFileSize(
                                                            file.size,
                                                        )}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Settings */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Settings className="h-5 w-5" />
                                    Налаштування
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Tabs defaultValue="format" className="w-full">
                                    <TabsList className="grid w-full grid-cols-3">
                                        <TabsTrigger value="format">
                                            Формат
                                        </TabsTrigger>
                                        <TabsTrigger value="size">
                                            Розмір
                                        </TabsTrigger>
                                        <TabsTrigger value="style">
                                            Стиль
                                        </TabsTrigger>
                                    </TabsList>

                                    <TabsContent
                                        value="format"
                                        className="space-y-4 mt-4"
                                    >
                                        <div className="space-y-2">
                                            <Label>
                                                Формат вихідного файлу
                                            </Label>
                                            <div className="grid grid-cols-4 gap-2">
                                                {(
                                                    [
                                                        "webp",
                                                        "avif",
                                                        "png",
                                                        "jpeg",
                                                    ] as const
                                                ).map((fmt) => (
                                                    <Button
                                                        key={fmt}
                                                        variant={
                                                            options.format ===
                                                            fmt
                                                                ? "default"
                                                                : "outline"
                                                        }
                                                        size="sm"
                                                        onClick={() =>
                                                            setOptions({
                                                                ...options,
                                                                format: fmt,
                                                            })
                                                        }
                                                    >
                                                        {fmt.toUpperCase()}
                                                    </Button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <Label>
                                                Якість ({options.quality}%)
                                            </Label>
                                            <Slider
                                                value={[options.quality || 85]}
                                                onValueChange={([value]) =>
                                                    setOptions({
                                                        ...options,
                                                        quality: value,
                                                    })
                                                }
                                                min={1}
                                                max={100}
                                                step={1}
                                            />
                                        </div>
                                    </TabsContent>

                                    <TabsContent
                                        value="size"
                                        className="space-y-4 mt-4"
                                    >
                                        <div className="space-y-2">
                                            <Label>
                                                Максимальна ширина (px)
                                            </Label>
                                            <Input
                                                type="number"
                                                placeholder="Авто"
                                                value={options.maxWidth || ""}
                                                onChange={(e) =>
                                                    setOptions({
                                                        ...options,
                                                        maxWidth: e.target.value
                                                            ? Number(
                                                                  e.target
                                                                      .value,
                                                              )
                                                            : undefined,
                                                    })
                                                }
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label>
                                                Максимальна висота (px)
                                            </Label>
                                            <Input
                                                type="number"
                                                placeholder="Авто"
                                                value={options.maxHeight || ""}
                                                onChange={(e) =>
                                                    setOptions({
                                                        ...options,
                                                        maxHeight: e.target
                                                            .value
                                                            ? Number(
                                                                  e.target
                                                                      .value,
                                                              )
                                                            : undefined,
                                                    })
                                                }
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label>
                                                Максимальний розмір файлу (KB)
                                            </Label>
                                            <Input
                                                type="number"
                                                placeholder="Без обмежень"
                                                value={options.maxSizeKB || ""}
                                                onChange={(e) =>
                                                    setOptions({
                                                        ...options,
                                                        maxSizeKB: e.target
                                                            .value
                                                            ? Number(
                                                                  e.target
                                                                      .value,
                                                              )
                                                            : undefined,
                                                    })
                                                }
                                            />
                                        </div>
                                    </TabsContent>

                                    <TabsContent
                                        value="style"
                                        className="space-y-4 mt-4"
                                    >
                                        <div className="space-y-2">
                                            <Label>
                                                Закруглення кутів (
                                                {options.cornerRadius}px)
                                            </Label>
                                            <Slider
                                                value={[
                                                    options.cornerRadius || 0,
                                                ]}
                                                onValueChange={([value]) =>
                                                    setOptions({
                                                        ...options,
                                                        cornerRadius: value,
                                                    })
                                                }
                                                min={0}
                                                max={100}
                                                step={1}
                                            />
                                        </div>
                                    </TabsContent>
                                </Tabs>
                            </CardContent>
                        </Card>

                        {/* Process Button */}
                        <Button
                            onClick={processImages}
                            disabled={files.length === 0 || isProcessing}
                            size="lg"
                            className="w-full"
                        >
                            {isProcessing
                                ? "Обробка..."
                                : "Обробити зображення"}
                        </Button>

                        {isProcessing && (
                            <Progress value={progress} className="w-full" />
                        )}
                    </div>

                    {/* Права колонка - Results */}
                    <div className="flex flex-col gap-6">
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <CardTitle>Результати</CardTitle>
                                        <CardDescription>
                                            {processedImages.length > 0
                                                ? `Оброблено ${processedImages.length} зображень`
                                                : "Зображення з'являться тут після обробки"}
                                        </CardDescription>
                                    </div>
                                    {processedImages.length > 0 && (
                                        <Button onClick={downloadAll} size="sm">
                                            <Download className="h-4 w-4 mr-2" />
                                            Завантажити всі
                                        </Button>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent>
                                {processedImages.length > 0 ? (
                                    <div className="space-y-3 max-h-[600px] overflow-y-auto">
                                        {processedImages.map((img, idx) => (
                                            <div
                                                key={idx}
                                                className="border rounded-lg p-3 flex items-center gap-3 hover:bg-accent transition-colors"
                                            >
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium text-sm truncate">
                                                        {img.fileName}
                                                    </p>
                                                    <div className="flex gap-2 mt-1">
                                                        <Badge
                                                            variant="secondary"
                                                            className="text-xs"
                                                        >
                                                            {img.format.toUpperCase()}
                                                        </Badge>
                                                        <Badge
                                                            variant="outline"
                                                            className="text-xs"
                                                        >
                                                            {formatFileSize(
                                                                img.size,
                                                            )}
                                                        </Badge>
                                                        <Badge
                                                            variant="outline"
                                                            className="text-xs"
                                                        >
                                                            {img.width}×
                                                            {img.height}
                                                        </Badge>
                                                    </div>
                                                </div>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() =>
                                                        ImageProcessor.downloadImage(
                                                            img,
                                                        )
                                                    }
                                                >
                                                    <Download className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-12 text-muted-foreground">
                                        <ImageIcon className="h-12 w-12 mx-auto mb-4 opacity-20" />
                                        <p className="text-sm">
                                            Результати з&apos;являться тут
                                        </p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </main>
        </div>
    );
}
