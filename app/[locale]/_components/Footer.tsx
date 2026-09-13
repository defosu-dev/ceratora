"use client";

import { useAppProvider } from "./AppProvider";
import { useTranslation } from "@/lib/i18n";

export default function Footer() {
    const { locale } = useAppProvider();
    const t = useTranslation(locale);

    return (
        <footer className="w-full border-t bg-white dark:bg-black py-6 mt-auto">
            <div className="max-w-5xl mx-auto px-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <span>{t.footer.developedBy}</span>
                <span className="font-semibold">defosu-dev</span>
            </div>
        </footer>
    );
}
