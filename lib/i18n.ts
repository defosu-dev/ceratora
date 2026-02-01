// lib/i18n.ts

export type Locale = "uk" | "en" | "ru";

export interface Translations {
    // Header
    header: {
        home: string;
        imageTools: string;
        codeTools: string;
    };
    // Footer
    footer: {
        madeWith: string;
        by: string;
    };
    // Image Tools Page
    imageTools: {
        title: string;
        subtitle: string;
        settings: {
            title: string;
            description: string;
            selectedFiles: string;
        };
        upload: {
            title: string;
            description: string;
            dropzone: string;
            formats: string;
            selected: string;
            of: string;
            deleteSelected: string;
            clearAll: string;
        };
        format: {
            tab: string;
            outputFormat: string;
            qualityMode: string;
            manual: string;
            auto: string;
            quality: string;
            recommended: string;
            maxSize: string;
            placeholder: string;
            autoDescription: string;
        };
        size: {
            tab: string;
            maxWidth: string;
            maxHeight: string;
            auto: string;
        };
        style: {
            tab: string;
            cornerRadius: string;
            description: string;
        };
        process: {
            button: string;
            processing: string;
            image: string;
            images: string;
        };
        results: {
            title: string;
            description: string;
            processed: string;
            downloadAll: string;
            willAppear: string;
        };
        toast: {
            success: string;
            error: string;
            downloadSuccess: string;
            downloadError: string;
        };
    };
}

export const translations: Record<Locale, Translations> = {
    uk: {
        header: {
            home: "Головна",
            imageTools: "Обробка зображень",
            codeTools: "Робота з кодом",
        },
        footer: {
            madeWith: "Зроблено з",
            by: "",
        },
        imageTools: {
            title: "Набір інструментів для роботи з зображеннями",
            subtitle:
                "Конвертуйте, стискайте та редагуйте зображення прямо в браузері",
            settings: {
                title: "Налаштування",
                description: "Налаштування для",
                selectedFiles: "вибраних файлів",
            },
            upload: {
                title: "Завантаження",
                description: "Перетягніть зображення або виберіть файли",
                dropzone: "Перетягніть файли сюди або натисніть для вибору",
                formats: "PNG, JPG, WEBP до 100 файлів",
                selected: "Вибрано:",
                of: "з",
                deleteSelected: "Видалити вибрані",
                clearAll: "Очистити все",
            },
            format: {
                tab: "Формат",
                outputFormat: "Формат вихідного файлу",
                qualityMode: "Режим якості",
                manual: "Ручне керування якістю",
                auto: "Автоматичний підбір якості",
                quality: "Якість",
                recommended: "Рекомендовано: 60-80% для оптимального балансу",
                maxSize: "Максимальний розмір файлу (KB)",
                placeholder: "Наприклад: 200",
                autoDescription: "Буде автоматично підібрана найкраща якість",
            },
            size: {
                tab: "Розмір",
                maxWidth: "Максимальна ширина (px)",
                maxHeight: "Максимальна висота (px)",
                auto: "Авто",
            },
            style: {
                tab: "Стиль",
                cornerRadius: "Закруглення кутів (px)",
                description:
                    "Для круглого зображення використайте велике значення (500+)",
            },
            process: {
                button: "Обробити",
                processing: "Обробка...",
                image: "зображення",
                images: "зображень",
            },
            results: {
                title: "Результати",
                description: "Зображення з'являться тут після обробки",
                processed: "Оброблено",
                downloadAll: "Завантажити всі",
                willAppear: "Результати з'являться тут",
            },
            toast: {
                success: "Зображення успішно оброблені!",
                error: "Помилка обробки зображень",
                downloadSuccess: "Файли завантажені успішно",
                downloadError: "Помилка завантаження файлів",
            },
        },
    },
    en: {
        header: {
            home: "Home",
            imageTools: "Image Processing",
            codeTools: "Code Tools",
        },
        footer: {
            madeWith: "Made with",
            by: "by",
        },
        imageTools: {
            title: "Image Processing Toolkit",
            subtitle:
                "Convert, compress and edit images directly in your browser",
            settings: {
                title: "Settings",
                description: "Settings for",
                selectedFiles: "selected files",
            },
            upload: {
                title: "Upload",
                description: "Drag and drop images or select files",
                dropzone: "Drop files here or click to select",
                formats: "PNG, JPG, WEBP up to 100 files",
                selected: "Selected:",
                of: "of",
                deleteSelected: "Delete selected",
                clearAll: "Clear all",
            },
            format: {
                tab: "Format",
                outputFormat: "Output file format",
                qualityMode: "Quality mode",
                manual: "Manual quality control",
                auto: "Automatic quality selection",
                quality: "Quality",
                recommended: "Recommended: 60-80% for optimal balance",
                maxSize: "Maximum file size (KB)",
                placeholder: "Example: 200",
                autoDescription: "Best quality will be automatically selected",
            },
            size: {
                tab: "Size",
                maxWidth: "Maximum width (px)",
                maxHeight: "Maximum height (px)",
                auto: "Auto",
            },
            style: {
                tab: "Style",
                cornerRadius: "Corner radius (px)",
                description: "Use large value (500+) for circular image",
            },
            process: {
                button: "Process",
                processing: "Processing...",
                image: "image",
                images: "images",
            },
            results: {
                title: "Results",
                description: "Images will appear here after processing",
                processed: "Processed",
                downloadAll: "Download all",
                willAppear: "Results will appear here",
            },
            toast: {
                success: "Images processed successfully!",
                error: "Image processing error",
                downloadSuccess: "Files downloaded successfully",
                downloadError: "File download error",
            },
        },
    },
    ru: {
        header: {
            home: "Главная",
            imageTools: "Обработка изображений",
            codeTools: "Работа с кодом",
        },
        footer: {
            madeWith: "Сделано с",
            by: "",
        },
        imageTools: {
            title: "Набор инструментов для работы с изображениями",
            subtitle:
                "Конвертируйте, сжимайте и редактируйте изображения прямо в браузере",
            settings: {
                title: "Настройки",
                description: "Настройки для",
                selectedFiles: "выбранных файлов",
            },
            upload: {
                title: "Загрузка",
                description: "Перетащите изображения или выберите файлы",
                dropzone: "Перетащите файлы сюда или нажмите для выбора",
                formats: "PNG, JPG, WEBP до 100 файлов",
                selected: "Выбрано:",
                of: "из",
                deleteSelected: "Удалить выбранные",
                clearAll: "Очистить все",
            },
            format: {
                tab: "Формат",
                outputFormat: "Формат выходного файла",
                qualityMode: "Режим качества",
                manual: "Ручное управление качеством",
                auto: "Автоматический подбор качества",
                quality: "Качество",
                recommended: "Рекомендуется: 60-80% для оптимального баланса",
                maxSize: "Максимальный размер файла (KB)",
                placeholder: "Например: 200",
                autoDescription:
                    "Будет автоматически подобрано лучшее качество",
            },
            size: {
                tab: "Размер",
                maxWidth: "Максимальная ширина (px)",
                maxHeight: "Максимальная высота (px)",
                auto: "Авто",
            },
            style: {
                tab: "Стиль",
                cornerRadius: "Закругление углов (px)",
                description:
                    "Для круглого изображения используйте большое значение (500+)",
            },
            process: {
                button: "Обработать",
                processing: "Обработка...",
                image: "изображение",
                images: "изображений",
            },
            results: {
                title: "Результаты",
                description: "Изображения появятся здесь после обработки",
                processed: "Обработано",
                downloadAll: "Скачать все",
                willAppear: "Результаты появятся здесь",
            },
            toast: {
                success: "Изображения успешно обработаны!",
                error: "Ошибка обработки изображений",
                downloadSuccess: "Файлы загружены успешно",
                downloadError: "Ошибка загрузки файлов",
            },
        },
    },
};

export function useTranslation(locale: Locale): Translations {
    return translations[locale];
}
