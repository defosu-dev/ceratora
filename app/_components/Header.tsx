// app/_components/Header.tsx
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
import { useTranslation } from "@/lib/i18n";

export default function Header() {
    const { locale, theme, isHydrated, setLocale, toggleTheme } =
        useAppProvider();
    const t = useTranslation(locale);

    if (!isHydrated) {
        return (
            <header className="w-full border-b bg-white dark:bg-black sticky top-0 z-50 backdrop-blur-sm bg-opacity-90 dark:bg-opacity-90">
                <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="h-8 w-32 bg-transparent" />
                    <div className="flex gap-6">
                        <div className="h-4 w-16 bg-transparent" />
                        <div className="h-4 w-24 bg-transparent" />
                        <div className="h-4 w-20 bg-transparent" />
                    </div>
                    <div className="flex gap-2">
                        <div className="h-10 w-10 bg-transparent" />
                        <div className="h-10 w-10 bg-transparent" />
                    </div>
                </div>
            </header>
        );
    }

    return (
        <header className="w-full border-b bg-white dark:bg-black sticky top-0 z-50 backdrop-blur-sm bg-opacity-90 dark:bg-opacity-90">
            <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
                <Link
                    href="/"
                    className="text-2xl font-bold tracking-tight hover:opacity-80 transition-opacity"
                >
                    Ceratora
                </Link>

                <nav className="flex items-center gap-6">
                    <Link
                        href="/"
                        className="text-sm font-medium hover:underline underline-offset-4"
                    >
                        {t.header.home}
                    </Link>
                    <Link
                        href="/image-tools"
                        className="text-sm font-medium hover:underline underline-offset-4"
                    >
                        {t.header.imageTools}
                    </Link>
                    <Link
                        href="/code-tools"
                        className="text-sm font-medium hover:underline underline-offset-4"
                    >
                        {t.header.codeTools}
                    </Link>
                </nav>

                <div className="flex items-center gap-2">
                    {/* Language Switcher */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                                <Globe className="h-5 w-5" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setLocale("uk")}>
                                🇺🇦 Українська
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setLocale("en")}>
                                🇬🇧 English
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setLocale("ru")}>
                                🇷🇺 Русский
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Theme Switcher */}
                    <Button variant="ghost" size="icon" onClick={toggleTheme}>
                        {theme === "light" ? (
                            <Moon className="h-5 w-5" />
                        ) : (
                            <Sun className="h-5 w-5" />
                        )}
                    </Button>
                </div>
            </div>
        </header>
    );
}
