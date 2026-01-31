// app/page.tsx
"use client";

import { useState, useCallback, useEffect } from "react";
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
    Check,
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
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface FileWithSelection {
    file: File;
    id: string;
    selected: boolean;
}

export default function Home() {
    const [files, setFiles] = useState<FileWithSelection[]>([]);
    const [processedImages, setProcessedImages] = useState<ProcessedImage[]>(
        [],
    );
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [errorMessage, setErrorMessage] = useState<string>("");
    const [avifSupported, setAvifSupported] = useState<boolean | null>(null);

    // Режим якості: 'manual' або 'auto'
    const [qualityMode, setQualityMode] = useState<"manual" | "auto">("manual");

    // Налаштування обробки
    const [options, setOptions] = useState<ImageProcessingOptions>({
        format: "webp",
        quality: 80,
        cornerRadius: 0,
        maxSizeKB: undefined,
        maxWidth: undefined,
        maxHeight: undefined,
    });

    // Перевіряємо підтримку AVIF при завантаженні
    useEffect(() => {
        ImageProcessor.checkFormatSupport("avif").then(setAvifSupported);
    }, []);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files).map((file) => ({
                file,
                id: crypto.randomUUID(),
                selected: true,
            }));
            setFiles(newFiles);
            setProcessedImages([]);
            setProgress(0);
        }
    };

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        if (e.dataTransfer.files) {
            const newFiles = Array.from(e.dataTransfer.files).map((file) => ({
                file,
                id: crypto.randomUUID(),
                selected: true,
            }));
            setFiles(newFiles);
            setProcessedImages([]);
            setProgress(0);
        }
    }, []);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const toggleFileSelection = (id: string) => {
        setFiles(
            files.map((f) =>
                f.id === id ? { ...f, selected: !f.selected } : f,
            ),
        );
    };

    const toggleAllSelection = () => {
        const allSelected = files.every((f) => f.selected);
        setFiles(files.map((f) => ({ ...f, selected: !allSelected })));
    };

    const processImages = async () => {
        const selectedFiles = files
            .filter((f) => f.selected)
            .map((f) => f.file);
        if (selectedFiles.length === 0) return;

        setIsProcessing(true);
        setProgress(0);
        setErrorMessage("");

        try {
            // Підготовка опцій залежно від режиму
            const processingOptions: ImageProcessingOptions = {
                ...options,
                quality: qualityMode === "manual" ? options.quality : undefined,
                maxSizeKB:
                    qualityMode === "auto" ? options.maxSizeKB : undefined,
            };

            const processed = await ImageProcessor.processImages(
                selectedFiles,
                processingOptions,
                (current, total) => {
                    setProgress((current / total) * 100);
                },
            );
            setProcessedImages(processed);
        } catch (error) {
            console.error("Помилка обробки:", error);
            setErrorMessage(
                error instanceof Error
                    ? error.message
                    : "Помилка обробки зображень",
            );
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

    const clearSelected = () => {
        setFiles(files.filter((f) => !f.selected));
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

    const selectedCount = files.filter((f) => f.selected).length;

    return (
        <div className="flex flex-col min-h-screen items-center justify-center font-sans bg-white dark:bg-black p-4">
            <header className="w-full h-full flex items-center gap-8  p-4 rounded-xl shadow-sm max-w-5xl">
                <h1 className="text-3xl font-bold tracking-tight">Ceratora</h1>
            </header>
            <main className="flex min-h-screen w-full max-w-5xl flex-col gap-8 p-6">
                {/* Header */}
                <div className="flex flex-col gap-2">
                    <h2 className="text-2xl font-bold tracking-tight">
                        Набір інструментів для роботи з зображеннями
                    </h2>
                </div>

                <div className="grid gap-8 lg:grid-cols-2">
                    {/* Ліва колонка - Upload & Settings */}
                    <div className="flex flex-col gap-6">
                        {/* Settings */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Settings className="h-5 w-5" />
                                    Налаштування
                                </CardTitle>
                                <CardDescription>
                                    Налаштування для {selectedCount} вибраних
                                    файлів
                                </CardDescription>
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
                                                        disabled={
                                                            fmt === "avif" &&
                                                            avifSupported ===
                                                                false
                                                        }
                                                    >
                                                        {fmt.toUpperCase()}
                                                        {fmt === "avif" &&
                                                            avifSupported ===
                                                                false &&
                                                            " ✗"}
                                                    </Button>
                                                ))}
                                            </div>
                                            {options.format === "avif" &&
                                                avifSupported === false && (
                                                    <p className="text-xs text-red-600 dark:text-red-500">
                                                        ⚠️ AVIF не підтримується
                                                        вашим браузером
                                                    </p>
                                                )}
                                        </div>

                                        <div className="space-y-3">
                                            <Label>Режим якості</Label>
                                            <RadioGroup
                                                value={qualityMode}
                                                onValueChange={(value) =>
                                                    setQualityMode(
                                                        value as
                                                            | "manual"
                                                            | "auto",
                                                    )
                                                }
                                            >
                                                <div className="flex items-center space-x-2">
                                                    <RadioGroupItem
                                                        value="manual"
                                                        id="manual"
                                                    />
                                                    <Label
                                                        htmlFor="manual"
                                                        className="font-normal"
                                                    >
                                                        Ручне керування якістю
                                                    </Label>
                                                </div>
                                                <div className="flex items-center space-x-2">
                                                    <RadioGroupItem
                                                        value="auto"
                                                        id="auto"
                                                    />
                                                    <Label
                                                        htmlFor="auto"
                                                        className="font-normal"
                                                    >
                                                        Автоматичний підбір
                                                        якості
                                                    </Label>
                                                </div>
                                            </RadioGroup>
                                        </div>

                                        {qualityMode === "manual" ? (
                                            <div className="space-y-2">
                                                <Label>
                                                    Якість ({options.quality}%)
                                                </Label>
                                                <Slider
                                                    value={[
                                                        options.quality || 80,
                                                    ]}
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
                                                <p className="text-xs text-muted-foreground">
                                                    Рекомендовано: 60-80% для
                                                    оптимального балансу
                                                </p>
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                <Label>
                                                    Максимальний розмір файлу
                                                    (KB)
                                                </Label>
                                                <Input
                                                    type="number"
                                                    placeholder="Наприклад: 200"
                                                    value={
                                                        options.maxSizeKB || ""
                                                    }
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
                                                <p className="text-xs text-muted-foreground">
                                                    Буде автоматично підібрана
                                                    найкраща якість
                                                </p>
                                            </div>
                                        )}
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
                                    </TabsContent>

                                    <TabsContent
                                        value="style"
                                        className="space-y-4 mt-4"
                                    >
                                        <div className="space-y-2">
                                            <Label>
                                                Закруглення кутів (px)
                                            </Label>
                                            <div className="flex gap-2">
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    value={
                                                        options.cornerRadius ||
                                                        0
                                                    }
                                                    onChange={(e) =>
                                                        setOptions({
                                                            ...options,
                                                            cornerRadius:
                                                                Number(
                                                                    e.target
                                                                        .value,
                                                                ) || 0,
                                                        })
                                                    }
                                                    className="w-24"
                                                />
                                                <div className="flex-1">
                                                    <Slider
                                                        value={[
                                                            options.cornerRadius ||
                                                                0,
                                                        ]}
                                                        onValueChange={([
                                                            value,
                                                        ]) =>
                                                            setOptions({
                                                                ...options,
                                                                cornerRadius:
                                                                    value,
                                                            })
                                                        }
                                                        min={0}
                                                        max={500}
                                                        step={1}
                                                    />
                                                </div>
                                            </div>
                                            <p className="text-xs text-muted-foreground">
                                                Для круглого зображення
                                                використайте велике значення
                                                (500+)
                                            </p>
                                        </div>
                                    </TabsContent>
                                </Tabs>
                            </CardContent>
                        </Card>

                        {/* Process Button */}
                        <Button
                            onClick={processImages}
                            disabled={selectedCount === 0 || isProcessing}
                            size="lg"
                            className="w-full"
                        >
                            {isProcessing
                                ? `Обробка... ${Math.round(progress)}%`
                                : `Обробити ${selectedCount} ${
                                      selectedCount === 1
                                          ? "зображення"
                                          : "зображень"
                                  }`}
                        </Button>

                        {errorMessage && (
                            <div className="p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
                                <p className="text-sm text-red-600 dark:text-red-400">
                                    {errorMessage}
                                </p>
                            </div>
                        )}

                        {isProcessing && (
                            <Progress value={progress} className="w-full" />
                        )}
                    </div>

                    {/* Права колонка - Results */}
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
                                            <div className="flex items-center gap-3">
                                                <Checkbox
                                                    checked={files.every(
                                                        (f) => f.selected,
                                                    )}
                                                    onCheckedChange={
                                                        toggleAllSelection
                                                    }
                                                />
                                                <p className="text-sm font-medium">
                                                    Вибрано: {selectedCount} з{" "}
                                                    {files.length}
                                                </p>
                                            </div>
                                            <div className="flex gap-2">
                                                {selectedCount > 0 &&
                                                    selectedCount <
                                                        files.length && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={
                                                                clearSelected
                                                            }
                                                        >
                                                            <Trash2 className="h-4 w-4 mr-2" />
                                                            Видалити вибрані
                                                        </Button>
                                                    )}
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={clearAll}
                                                >
                                                    <Trash2 className="h-4 w-4 mr-2" />
                                                    Очистити все
                                                </Button>
                                            </div>
                                        </div>
                                        <div className="max-h-48 overflow-y-auto space-y-1 border rounded-md p-2">
                                            {files.map((file) => (
                                                <div
                                                    key={file.id}
                                                    className={`flex items-center gap-2 p-2 rounded hover:bg-accent transition-colors ${
                                                        file.selected
                                                            ? "bg-accent/50"
                                                            : ""
                                                    }`}
                                                    onClick={() =>
                                                        toggleFileSelection(
                                                            file.id,
                                                        )
                                                    }
                                                >
                                                    <Checkbox
                                                        checked={file.selected}
                                                        onCheckedChange={() =>
                                                            toggleFileSelection(
                                                                file.id,
                                                            )
                                                        }
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs truncate">
                                                            {file.file.name}
                                                        </p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {formatFileSize(
                                                                file.file.size,
                                                            )}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
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
                                        {processedImages.map((img, idx) => {
                                            const percentChange = (
                                                ((img.size - img.originalSize) /
                                                    img.originalSize) *
                                                100
                                            ).toFixed(1);
                                            const isSmaller =
                                                img.size < img.originalSize;

                                            return (
                                                <div
                                                    key={idx}
                                                    className="border rounded-lg p-3 flex items-center gap-3 hover:bg-accent transition-colors"
                                                >
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-medium text-sm truncate">
                                                            {img.fileName}
                                                        </p>
                                                        <div className="flex flex-wrap gap-2 mt-1">
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
                                                                    img.originalSize,
                                                                )}{" "}
                                                                →{" "}
                                                                {formatFileSize(
                                                                    img.size,
                                                                )}
                                                            </Badge>
                                                            <Badge
                                                                variant={
                                                                    isSmaller
                                                                        ? "default"
                                                                        : "destructive"
                                                                }
                                                                className="text-xs"
                                                            >
                                                                {isSmaller
                                                                    ? "-"
                                                                    : "+"}
                                                                {Math.abs(
                                                                    Number(
                                                                        percentChange,
                                                                    ),
                                                                )}
                                                                %
                                                            </Badge>
                                                            <Badge
                                                                variant="outline"
                                                                className="text-xs"
                                                            >
                                                                {img.width}×
                                                                {img.height}
                                                            </Badge>
                                                            <Badge
                                                                variant="outline"
                                                                className="text-xs"
                                                            >
                                                                Q:{" "}
                                                                {
                                                                    img.appliedQuality
                                                                }
                                                                %
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
                                            );
                                        })}
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
