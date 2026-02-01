// app/page.tsx
"use client";

import { useAppProvider } from "@/app/_components/AppProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTranslation } from "@/lib/i18n";
import {
    ImageProcessingOptions,
    ImageProcessor,
    ProcessedImage,
} from "@/lib/imageProcessor";
import {
    Download,
    Image as ImageIcon,
    Settings,
    Trash2,
    Upload,
} from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

interface FileWithSelection {
    file: File;
    id: string;
    selected: boolean;
}

export default function Home() {
    const { locale, isHydrated } = useAppProvider();
    const t = useTranslation(locale);

    // ---------------------------------------------------------------------------
    // Image processing state
    // ---------------------------------------------------------------------------
    const [files, setFiles] = useState<FileWithSelection[]>([]);
    const [processedImages, setProcessedImages] = useState<ProcessedImage[]>(
        [],
    );
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [qualityMode, setQualityMode] = useState<"manual" | "auto">("manual");

    const [options, setOptions] = useState<ImageProcessingOptions>({
        format: "webp",
        quality: 80,
        cornerRadius: 0,
        maxSizeKB: undefined,
        maxWidth: undefined,
        maxHeight: undefined,
    });

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

        try {
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
            toast.success(t.imageTools.toast.success);
        } catch {
            toast.error(t.imageTools.toast.error);
        } finally {
            setIsProcessing(false);
        }
    };

    const downloadAll = () => {
        try {
            processedImages.forEach((img) => {
                ImageProcessor.downloadImage(img);
            });
            toast.success(t.imageTools.toast.downloadSuccess);
        } catch {
            toast.error(t.imageTools.toast.downloadError);
        }
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

    // ---------------------------------------------------------------------------
    // RENDER
    // ---------------------------------------------------------------------------

    if (!isHydrated) {
        return null;
    }

    return (
        <main className="flex-1 w-full max-w-5xl flex-col gap-8 p-6">
            {/* Page Title */}
            <div className="flex flex-col gap-2 mb-8">
                <h1 className="text-3xl font-bold tracking-tight">
                    {t.imageTools.title}
                </h1>
                <p className="text-muted-foreground">{t.imageTools.subtitle}</p>
            </div>

            <div className="grid gap-8 lg:grid-cols-2">
                {/* Settings */}
                <div className="flex flex-col gap-6">
                    {/* Settings */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Settings className="h-5 w-5" />
                                {t.imageTools.settings.title}
                            </CardTitle>
                            <CardDescription>
                                {t.imageTools.settings.description}{" "}
                                {selectedCount}{" "}
                                {t.imageTools.settings.selectedFiles}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Tabs defaultValue="format" className="w-full">
                                <TabsList className="grid w-full grid-cols-3">
                                    <TabsTrigger value="format">
                                        {t.imageTools.format.tab}
                                    </TabsTrigger>
                                    <TabsTrigger value="size">
                                        {t.imageTools.size.tab}
                                    </TabsTrigger>
                                    <TabsTrigger value="style">
                                        {t.imageTools.style.tab}
                                    </TabsTrigger>
                                </TabsList>

                                <TabsContent
                                    value="format"
                                    className="space-y-4 mt-4"
                                >
                                    <div className="space-y-2">
                                        <Label>
                                            {t.imageTools.format.outputFormat}
                                        </Label>
                                        <div className="grid grid-cols-3 gap-2">
                                            {(
                                                ["webp", "png", "jpeg"] as const
                                            ).map((fmt) => (
                                                <Button
                                                    key={fmt}
                                                    variant={
                                                        options.format === fmt
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

                                    <div className="space-y-3">
                                        <Label>
                                            {t.imageTools.format.qualityMode}
                                        </Label>
                                        <RadioGroup
                                            value={qualityMode}
                                            onValueChange={(value) =>
                                                setQualityMode(
                                                    value as "manual" | "auto",
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
                                                    {t.imageTools.format.manual}
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
                                                    {t.imageTools.format.auto}
                                                </Label>
                                            </div>
                                        </RadioGroup>
                                    </div>

                                    {qualityMode === "manual" ? (
                                        <div className="space-y-2">
                                            <Label>
                                                {t.imageTools.format.quality} (
                                                {options.quality}%)
                                            </Label>
                                            <Slider
                                                value={[options.quality || 80]}
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
                                                {
                                                    t.imageTools.format
                                                        .recommended
                                                }
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            <Label>
                                                {t.imageTools.format.maxSize}
                                            </Label>
                                            <Input
                                                type="number"
                                                placeholder={
                                                    t.imageTools.format
                                                        .placeholder
                                                }
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
                                            <p className="text-xs text-muted-foreground">
                                                {
                                                    t.imageTools.format
                                                        .autoDescription
                                                }
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
                                            {t.imageTools.size.maxWidth}
                                        </Label>
                                        <Input
                                            type="number"
                                            placeholder={t.imageTools.size.auto}
                                            value={options.maxWidth || ""}
                                            onChange={(e) =>
                                                setOptions({
                                                    ...options,
                                                    maxWidth: e.target.value
                                                        ? Number(e.target.value)
                                                        : undefined,
                                                })
                                            }
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label>
                                            {t.imageTools.size.maxHeight}
                                        </Label>
                                        <Input
                                            type="number"
                                            placeholder={t.imageTools.size.auto}
                                            value={options.maxHeight || ""}
                                            onChange={(e) =>
                                                setOptions({
                                                    ...options,
                                                    maxHeight: e.target.value
                                                        ? Number(e.target.value)
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
                                            {t.imageTools.style.cornerRadius}
                                        </Label>
                                        <div className="flex gap-2">
                                            <Input
                                                type="number"
                                                min="0"
                                                value={
                                                    options.cornerRadius || 0
                                                }
                                                onChange={(e) =>
                                                    setOptions({
                                                        ...options,
                                                        cornerRadius:
                                                            Number(
                                                                e.target.value,
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
                                                    onValueChange={([value]) =>
                                                        setOptions({
                                                            ...options,
                                                            cornerRadius: value,
                                                        })
                                                    }
                                                    min={0}
                                                    max={500}
                                                    step={1}
                                                />
                                            </div>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            {t.imageTools.style.description}
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
                            ? `${t.imageTools.process.processing} ${Math.round(progress)}%`
                            : `${t.imageTools.process.button} ${selectedCount} ${
                                  selectedCount === 1
                                      ? t.imageTools.process.image
                                      : t.imageTools.process.images
                              }`}
                    </Button>

                    {isProcessing && (
                        <Progress value={progress} className="w-full" />
                    )}
                </div>

                {/* Upload & Results */}
                <div className="flex flex-col gap-6">
                    {/* Upload Area */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Upload className="h-5 w-5" />
                                {t.imageTools.upload.title}
                            </CardTitle>
                            <CardDescription>
                                {t.imageTools.upload.description}
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
                                    {t.imageTools.upload.dropzone}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    {t.imageTools.upload.formats}
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
                                                {t.imageTools.upload.selected}{" "}
                                                {selectedCount}{" "}
                                                {t.imageTools.upload.of}{" "}
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
                                                        onClick={clearSelected}
                                                    >
                                                        <Trash2 className="h-4 w-4 mr-2" />
                                                        {
                                                            t.imageTools.upload
                                                                .deleteSelected
                                                        }
                                                    </Button>
                                                )}
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={clearAll}
                                            >
                                                <Trash2 className="h-4 w-4 mr-2" />
                                                {t.imageTools.upload.clearAll}
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="max-h-48 overflow-y-auto space-y-1 border rounded-md p-2">
                                        {files.map((file) => (
                                            <div
                                                key={file.id}
                                                className={`flex items-center gap-2 p-2 rounded hover:bg-accent transition-colors cursor-pointer ${
                                                    file.selected
                                                        ? "bg-accent/50"
                                                        : ""
                                                }`}
                                                onClick={() =>
                                                    toggleFileSelection(file.id)
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

                    {/* Results */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>
                                        {t.imageTools.results.title}
                                    </CardTitle>
                                    <CardDescription>
                                        {processedImages.length > 0
                                            ? `${t.imageTools.results.processed} ${processedImages.length} ${t.imageTools.process.images}`
                                            : t.imageTools.results.description}
                                    </CardDescription>
                                </div>
                                {processedImages.length > 0 && (
                                    <Button onClick={downloadAll} size="sm">
                                        <Download className="h-4 w-4 mr-2" />
                                        {t.imageTools.results.downloadAll}
                                    </Button>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent>
                            {processedImages.length > 0 ? (
                                <div className="space-y-3 max-h-150 overflow-y-auto">
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
                                                            {img.appliedQuality}
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
                                        {t.imageTools.results.willAppear}
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </main>
    );
}
