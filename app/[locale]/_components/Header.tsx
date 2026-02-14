"use client";

import Link from "next/link";
import { Globe, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAppProvider } from "./AppProvider";
import { useTranslation, Locale, LOCALES } from "@/lib/i18n";
import { useSyncExternalStore } from "react";

export default function Header() {
    const { locale, theme, toggleTheme, setLocale } = useAppProvider();
    const t = useTranslation(locale);

    const mounted = useSyncExternalStore(
        () => () => {},
        () => true,
        () => false,
    );

    return (
        <header className="w-full border-b bg-white dark:bg-black sticky top-0 z-50 backdrop-blur-sm bg-opacity-90 dark:bg-opacity-90">
            <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
                <Link
                    href={`/${locale}`}
                    className="text-2xl font-bold tracking-tight hover:opacity-80 transition-opacity"
                >
                    Ceratora
                </Link>

                <nav className="flex items-center gap-6">
                    <Link
                        href={`/${locale}`}
                        className="text-sm font-medium hover:underline underline-offset-4"
                    >
                        {t.header.home}
                    </Link>
                    <Link
                        href={`/${locale}/image-tools`}
                        className="text-sm font-medium hover:underline underline-offset-4"
                    >
                        {t.header.imageTools}
                    </Link>
                    <Link
                        href={`/${locale}/code-tools`}
                        className="text-sm font-medium hover:underline underline-offset-4"
                    >
                        {t.header.codeTools}
                    </Link>
                </nav>

                <div className="flex items-center gap-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                                <Globe className="h-5 w-5" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            {LOCALES.map((loc: Locale) => (
                                <DropdownMenuItem
                                    key={loc}
                                    onClick={() => setLocale(loc)}
                                >
                                    {loc === "uk" && "🇺🇦 Українська"}
                                    {loc === "en" && "🇬🇧 English"}
                                    {loc === "ru" && "🇷🇺 Русский"}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <Button variant="ghost" size="icon" onClick={toggleTheme}>
                        {mounted ? (
                            theme === "light" ? (
                                <Moon className="h-5 w-5" />
                            ) : (
                                <Sun className="h-5 w-5" />
                            )
                        ) : (
                            <span className="h-5 w-5" />
                        )}
                    </Button>
                </div>
            </div>
        </header>
    );
}
