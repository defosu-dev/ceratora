"use client";

import React, {
    createContext,
    useContext,
    useState,
    useSyncExternalStore,
    ReactNode,
} from "react";
import { Locale } from "@/lib/i18n";
import { ToastContainer } from "react-toastify";

interface AppContextType {
    locale: Locale;
    theme: "light" | "dark";
    isHydrated: boolean;
    setLocale: (newLocale: Locale) => void;
    toggleTheme: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

function getInitialLocale(): Locale {
    if (typeof window === "undefined") return "en";

    try {
        const saved = localStorage.getItem("locale") as Locale | null;
        if (saved && ["uk", "en", "ru"].includes(saved)) {
            return saved;
        }
        const browserLang = navigator.language.split("-")[0];
        if (["uk", "en", "ru"].includes(browserLang)) {
            return browserLang as Locale;
        }
    } catch (e) {
        console.error(e);
    }

    return "en";
}

function getInitialTheme(): "light" | "dark" {
    if (typeof window === "undefined") return "light";

    try {
        const saved = localStorage.getItem("theme") as "light" | "dark" | null;
        if (saved) {
            return saved;
        }
    } catch (e) {
        console.error(e);
    }

    if (
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
    ) {
        return "dark";
    }

    return "light";
}

function useHydrated() {
    return useSyncExternalStore(
        () => () => {},
        () => true,
        () => false,
    );
}

export const AppProvider = ({ children }: { children: ReactNode }) => {
    const [locale, setLocaleState] = useState<Locale>(getInitialLocale);
    const [theme, setThemeState] = useState<"light" | "dark">(getInitialTheme);
    const isHydrated = useHydrated();

    const setLocale = (newLocale: Locale) => {
        setLocaleState(newLocale);
        localStorage.setItem("locale", newLocale);
        document.documentElement.setAttribute("lang", newLocale);
    };

    const toggleTheme = () => {
        const newTheme = theme === "light" ? "dark" : "light";
        setThemeState(newTheme);
        localStorage.setItem("theme", newTheme);
        document.documentElement.classList.toggle("dark", newTheme === "dark");
    };

    return (
        <AppContext.Provider
            value={{ locale, theme, isHydrated, setLocale, toggleTheme }}
        >
            <ToastContainer
                position="top-right"
                autoClose={3000}
                hideProgressBar={false}
                newestOnTop
                closeOnClick
                rtl={false}
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
    if (context === undefined) {
        throw new Error("useAppProvider must be used within an AppProvider");
    }
    return context;
};
