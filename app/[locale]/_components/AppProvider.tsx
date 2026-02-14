"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Locale, LOCALES } from "@/lib/i18n";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

interface AppContextType {
    locale: Locale;
    theme: "light" | "dark";
    setLocale: (newLocale: Locale) => void;
    toggleTheme: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

function getInitialTheme(): "light" | "dark" {
    if (typeof window === "undefined") return "light";
    try {
        const saved = localStorage.getItem("theme") as "light" | "dark" | null;
        if (saved) return saved;
    } catch {
        // ignore
    }
    return window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
}

export const AppProvider = ({ children }: { children: ReactNode }) => {
    const pathname = usePathname();
    const router = useRouter();

    const segment = pathname.split("/")[1];
    const locale: Locale =
        segment && LOCALES.includes(segment as Locale)
            ? (segment as Locale)
            : "en";

    const [theme, setThemeState] = useState<"light" | "dark">(getInitialTheme);

    const setLocale = (newLocale: Locale) => {
        const rest = pathname.replace(/^\/[a-z]{2}/, "") || "/";
        document.cookie = `locale=${newLocale}; path=/; max-age=31536000`;
        router.push(`/${newLocale}${rest}`);
    };

    const toggleTheme = () => {
        const next = theme === "light" ? "dark" : "light";
        setThemeState(next);
        localStorage.setItem("theme", next);
        document.documentElement.classList.toggle("dark", next === "dark");
    };

    return (
        <AppContext.Provider value={{ locale, theme, setLocale, toggleTheme }}>
            <ToastContainer
                position="top-right"
                autoClose={3000}
                newestOnTop
                closeOnClick
                pauseOnFocusLoss
                draggable
                pauseOnHover
                theme={theme}
            />
            {children}
        </AppContext.Provider>
    );
};

export const useAppProvider = () => {
    const context = useContext(AppContext);
    if (!context) {
        throw new Error("useAppProvider must be used within an AppProvider");
    }
    return context;
};
