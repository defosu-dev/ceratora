// lib/i18n.ts

export const LOCALES = ["uk", "en", "ru"] as const;
export type Locale = (typeof LOCALES)[number];

export interface Translations {
    header: {
        home: string;
        imageTools: string;
        codeTools: string;
        toggleSidebar: string;
    };
    footer: {
        developedBy: string;
    };
    home: {
        title: string;
        subtitle: string;
        open: string;
        soon: string;
        imageToolsDesc: string;
        codeToolsDesc: string;
    };
    workspace: {
        sources: string;
        canvas: string;
        import: string;
        dropToStart: string;
        replace: string;
        previewSource: string;
        pickPreview: string;
    };
    imageTools: {
        title: string;
        subtitle: string;
        settings: {
            title: string;
            description: string;
            selectedFiles: string;
            noSelection: string;
            reset: string;
        };
        upload: {
            title: string;
            description: string;
            dropzone: string;
            dragActive: string;
            formats: string;
            selected: string;
            of: string;
            selectAll: string;
            deleteSelected: string;
            clearAll: string;
            useForPreview: string;
            removeFile: string;
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
            noLimit: string;
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
            preview: string;
            previewEmpty: string;
        };
        process: {
            button: string;
            processing: string;
            cancel: string;
            of: string;
            progress: string;
            addFiles: string;
            selectFiles: string;
            image: string;
            images: string;
        };
        results: {
            title: string;
            description: string;
            processed: string;
            total: string;
            downloadAll: string;
            downloadZip: string;
            zipOnlyNotice: string;
            willAppear: string;
            download: string;
            previewFile: string;
            preview: string;
            downloadFile: string;
        };
        toast: {
            success: string;
            error: string;
            cancelled: string;
            cancelledAll: string;
            downloadSuccess: string;
            downloadError: string;
            uploadedSingle: string;
            uploadedCount: string;
            unzipping: string;
            unzippedCount: string;
            noImagesInZip: string;
            zipDownloadSuccess: string;
            zipDownloadError: string;
        };
    };
}

export const translations: Record<Locale, Translations> = {
    uk: {
        header: {
            home: "Головна",
            imageTools: "Обробка зображень",
            codeTools: "Робота з кодом",
            toggleSidebar: "Показати/сховати панель",
        },
        footer: {
            developedBy: "Розроблено",
        },
        home: {
            title: "Інструменти",
            subtitle: "Оберіть інструмент, щоб почати роботу",
            open: "Відкрити",
            soon: "Скоро",
            imageToolsDesc:
                "Конвертація, стиснення та редагування зображень",
            codeToolsDesc: "Інструменти для роботи з кодом",
        },
        workspace: {
            sources: "Джерела",
            canvas: "Полотно",
            import: "Імпорт",
            dropToStart: "Перетягніть зображення або архів сюди",
            replace: "Замінити файли",
            previewSource: "Переглянути джерело",
            pickPreview:
                "Оберіть зображення у «Джерелах», щоб побачити заокруглення",
        },
        imageTools: {
            title: "Набір інструментів для роботи з зображеннями",
            subtitle:
                "Конвертуйте, стискайте та редагуйте зображення прямо в браузері",
            settings: {
                title: "Налаштування",
                description: "Налаштування для",
                selectedFiles: "вибраних файлів",
                noSelection: "Налаштуйте параметри та натисніть «Обробити»",
                reset: "Скинути",
            },
            upload: {
                title: "Завантаження",
                description: "Перетягніть зображення або виберіть файли",
                dropzone:
                    "Перетягніть файли або архів (ZIP, 7Z) сюди, вставте через Ctrl + V або натисніть для вибору",
                dragActive: "Відпустіть, щоб додати файли",
                formats: "PNG, JPG, WEBP, ZIP, 7Z до 100 файлів",
                selected: "Вибрано:",
                of: "з",
                selectAll: "Вибрати всі",
                deleteSelected: "Видалити вибрані",
                clearAll: "Очистити все",
                useForPreview: "Використати для прев'ю",
                removeFile: "Видалити файл",
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
                noLimit: "Без ліміту",
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
                    "Для круглого зображення використайте велике значення (500+) або Full",
                preview: "Прев'ю",
                previewEmpty: "Завантажте зображення для перегляду",
            },
            process: {
                button: "Обробити",
                processing: "Обробка...",
                cancel: "Скасувати",
                of: "з",
                progress: "Опрацьовано",
                addFiles: "Додайте файли, щоб почати",
                selectFiles: "Виберіть файли для обробки",
                image: "зображення",
                images: "зображень",
            },
            results: {
                title: "Результати",
                description: "Зображення з'являться тут після обробки",
                processed: "Оброблено",
                total: "Разом",
                downloadAll: "Завантажити всі",
                downloadZip: "Завантажити архівом (ZIP)",
                zipOnlyNotice:
                    "Більше 10 зображень — завантаження доступне тільки архівом",
                willAppear: "Результати з'являться тут",
                download: "Завантажити",
                previewFile: "Переглянути результат",
                preview: "Прев'ю",
                downloadFile: "Завантажити файл",
            },
            toast: {
                success: "Зображення успішно оброблені!",
                error: "Помилка обробки зображень",
                cancelled: "Скасовано. Оброблено:",
                cancelledAll: "Обробку скасовано",
                downloadSuccess: "Файли завантажені успішно",
                downloadError: "Помилка завантаження файлів",
                uploadedSingle: "Зображення успішно додано!",
                uploadedCount: "Успішно додано зображень:",
                unzipping: "Розпакування архіву...",
                unzippedCount: "Витягнуто зображень з архіву:",
                noImagesInZip: "В архіві не знайдено підтримуваних зображень",
                zipDownloadSuccess: "Архів успішно завантажено",
                zipDownloadError: "Помилка створення архіву",
            },
        },
    },
    en: {
        header: {
            home: "Home",
            imageTools: "Image Processing",
            codeTools: "Code Tools",
            toggleSidebar: "Toggle sidebar",
        },
        footer: {
            developedBy: "Developed by",
        },
        home: {
            title: "Tools",
            subtitle: "Pick a tool to get started",
            open: "Open",
            soon: "Soon",
            imageToolsDesc: "Convert, compress and edit images",
            codeToolsDesc: "Utilities for working with code",
        },
        workspace: {
            sources: "Sources",
            canvas: "Canvas",
            import: "Import",
            dropToStart: "Drop images or an archive here",
            replace: "Replace files",
            previewSource: "Preview source",
            pickPreview: "Pick an image in Sources to preview the rounding",
        },
        imageTools: {
            title: "Image Processing Toolkit",
            subtitle:
                "Convert, compress and edit images directly in your browser",
            settings: {
                title: "Settings",
                description: "Settings for",
                selectedFiles: "selected files",
                noSelection: "Configure the options and click Process",
                reset: "Reset",
            },
            upload: {
                title: "Upload",
                description: "Drag and drop images or select files",
                dropzone:
                    "Drop files or archive (ZIP, 7Z) here, paste with Ctrl + V or click to select",
                dragActive: "Drop to add files",
                formats: "PNG, JPG, WEBP, ZIP, 7Z up to 100 files",
                selected: "Selected:",
                of: "of",
                selectAll: "Select all",
                deleteSelected: "Delete selected",
                clearAll: "Clear all",
                useForPreview: "Use for preview",
                removeFile: "Remove file",
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
                noLimit: "No limit",
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
                description:
                    "Use large value (500+) or Full for circular image",
                preview: "Preview",
                previewEmpty: "Upload an image to see preview",
            },
            process: {
                button: "Process",
                processing: "Processing...",
                cancel: "Cancel",
                of: "of",
                progress: "Processed",
                addFiles: "Add files to get started",
                selectFiles: "Select files to process",
                image: "image",
                images: "images",
            },
            results: {
                title: "Results",
                description: "Images will appear here after processing",
                processed: "Processed",
                total: "Total",
                downloadAll: "Download all",
                downloadZip: "Download as ZIP",
                zipOnlyNotice:
                    "More than 10 images — download is available only as archive",
                willAppear: "Results will appear here",
                download: "Download",
                previewFile: "Preview result",
                preview: "Preview",
                downloadFile: "Download file",
            },
            toast: {
                success: "Images processed successfully!",
                error: "Image processing error",
                cancelled: "Cancelled. Processed:",
                cancelledAll: "Processing cancelled",
                downloadSuccess: "Files downloaded successfully",
                downloadError: "File download error",
                uploadedSingle: "Image added successfully!",
                uploadedCount: "Images added successfully:",
                unzipping: "Unpacking archive...",
                unzippedCount: "Extracted images from archive:",
                noImagesInZip: "No supported images found in the archive",
                zipDownloadSuccess: "Archive downloaded successfully",
                zipDownloadError: "Error creating archive",
            },
        },
    },
    ru: {
        header: {
            home: "Главная",
            imageTools: "Обработка изображений",
            codeTools: "Работа с кодом",
            toggleSidebar: "Показать/скрыть панель",
        },
        footer: {
            developedBy: "Разработано",
        },
        home: {
            title: "Инструменты",
            subtitle: "Выберите инструмент, чтобы начать",
            open: "Открыть",
            soon: "Скоро",
            imageToolsDesc:
                "Конвертация, сжатие и редактирование изображений",
            codeToolsDesc: "Инструменты для работы с кодом",
        },
        workspace: {
            sources: "Источники",
            canvas: "Холст",
            import: "Импорт",
            dropToStart: "Перетащите изображения или архив сюда",
            replace: "Заменить файлы",
            previewSource: "Просмотреть источник",
            pickPreview:
                "Выберите изображение в «Источниках», чтобы увидеть закругление",
        },
        imageTools: {
            title: "Набор инструментов для работы с изображениями",
            subtitle:
                "Конвертируйте, сжимайте и редактируйте изображения прямо в браузере",
            settings: {
                title: "Настройки",
                description: "Настройки для",
                selectedFiles: "выбранных файлов",
                noSelection: "Настройте параметры и нажмите «Обработать»",
                reset: "Сбросить",
            },
            upload: {
                title: "Загрузка",
                description: "Перетащите изображения или выберите файлы",
                dropzone:
                    "Перетащите файлы или архив (ZIP, 7Z) сюда, вставьте через Ctrl + V или нажмите для выбора",
                dragActive: "Отпустите, чтобы добавить файлы",
                formats: "PNG, JPG, WEBP, ZIP, 7Z до 100 файлов",
                selected: "Выбрано:",
                of: "из",
                selectAll: "Выбрать все",
                deleteSelected: "Удалить выбранные",
                clearAll: "Очистить все",
                useForPreview: "Использовать для предпросмотра",
                removeFile: "Удалить файл",
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
                noLimit: "Без лимита",
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
                    "Для круглого изображения используйте большое значение (500+) или Full",
                preview: "Предпросмотр",
                previewEmpty: "Загрузите изображение для просмотра",
            },
            process: {
                button: "Обработать",
                processing: "Обработка...",
                cancel: "Отменить",
                of: "из",
                progress: "Обработано",
                addFiles: "Добавьте файлы, чтобы начать",
                selectFiles: "Выберите файлы для обработки",
                image: "изображение",
                images: "изображений",
            },
            results: {
                title: "Результаты",
                description: "Изображения появятся здесь после обработки",
                processed: "Обработано",
                total: "Всего",
                downloadAll: "Скачать все",
                downloadZip: "Скачать архивом (ZIP)",
                zipOnlyNotice:
                    "Более 10 изображений — скачивание доступно только архивом",
                willAppear: "Результаты появятся здесь",
                download: "Скачать",
                previewFile: "Просмотреть результат",
                preview: "Просмотр",
                downloadFile: "Скачать файл",
            },
            toast: {
                success: "Изображения успешно обработаны!",
                error: "Ошибка обработки изображений",
                cancelled: "Отменено. Обработано:",
                cancelledAll: "Обработка отменена",
                downloadSuccess: "Файлы загружены успешно",
                downloadError: "Ошибка загрузки файлов",
                uploadedSingle: "Изображение успешно добавлено!",
                uploadedCount: "Успешно добавлено изображений:",
                unzipping: "Распаковка архива...",
                unzippedCount: "Извлечено изображений из архива:",
                noImagesInZip: "В архиве не найдено поддерживаемых изображений",
                zipDownloadSuccess: "Архив успешно скачан",
                zipDownloadError: "Ошибка создания архива",
            },
        },
    },
};

export function useTranslation(locale: Locale): Translations {
    return translations[locale];
}
