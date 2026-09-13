import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "../globals.css";
import { AppProvider } from "./_components/AppProvider";
import AppShell from "./_components/AppShell";
import { Locale } from "@/lib/i18n";

const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
});

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
});

export const metadata: Metadata = {
    title: "Ceratora - Image Processing Tools",
    description: "Convert, compress and edit images directly in your browser",
};

export default async function RootLayout({
    children,
    params,
}: Readonly<{
    children: React.ReactNode;
    params: Promise<{ locale: string }>;
}>) {
    const { locale } = await params;
    return (
        <html lang={locale} suppressHydrationWarning>
            <head>
                {/* Лише тема — встановлюємо до рендеру, щоб уникнути FOUC */}
                <script
                    dangerouslySetInnerHTML={{
                        __html: `
                            (function() {
                                try {
                                    const theme = localStorage.getItem('theme') ||
                                        (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
                                    if (theme === 'dark') {
                                        document.documentElement.classList.add('dark');
                                    }
                                } catch (e) {}
                            })();
                        `,
                    }}
                />
            </head>
            <body
                className={`${geistSans.variable} ${geistMono.variable} antialiased font-sans`}
                suppressHydrationWarning
            >
                <AppProvider initialLocale={locale as Locale}>
                    <AppShell>{children}</AppShell>
                </AppProvider>
            </body>
        </html>
    );
}
