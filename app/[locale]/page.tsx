"use client";

import Link from "next/link";
import { ArrowRight, Code2, Image as ImageIcon } from "lucide-react";
import { useAppProvider } from "./_components/AppProvider";
import { useTranslation } from "@/lib/i18n";

export default function Home() {
    const { locale } = useAppProvider();
    const t = useTranslation(locale);

    const tools = [
        {
            href: `/${locale}/image-tools`,
            icon: ImageIcon,
            title: t.header.imageTools,
            description: t.home.imageToolsDesc,
            available: true,
        },
        {
            href: `/${locale}/code-tools`,
            icon: Code2,
            title: t.header.codeTools,
            description: t.home.codeToolsDesc,
            available: false,
        },
    ];

    return (
        <div className="h-full overflow-y-auto">
            <div className="mx-auto w-full max-w-5xl px-6 py-10">
                <div className="mb-8 flex flex-col gap-2">
                    <h1 className="text-3xl font-bold tracking-tight">
                        {t.home.title}
                    </h1>
                    <p className="text-muted-foreground">{t.home.subtitle}</p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                    {tools.map((tool) =>
                        tool.available ? (
                            <Link
                                key={tool.href}
                                href={tool.href}
                                className="group flex flex-col rounded-xl border bg-card p-6 transition-colors hover:border-primary/60 hover:bg-accent/40"
                            >
                                <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-accent">
                                    <tool.icon className="h-5 w-5" />
                                </span>
                                <h2 className="text-base font-semibold">
                                    {tool.title}
                                </h2>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    {tool.description}
                                </p>
                                <span className="mt-5 inline-flex items-center gap-1 text-sm font-medium">
                                    {t.home.open}
                                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                                </span>
                            </Link>
                        ) : (
                            <div
                                key={tool.href}
                                className="relative flex flex-col rounded-xl border border-dashed bg-card/50 p-6 opacity-75"
                            >
                                <span className="absolute top-5 right-5 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                    {t.home.soon}
                                </span>
                                <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                                    <tool.icon className="h-5 w-5" />
                                </span>
                                <h2 className="text-base font-semibold">
                                    {tool.title}
                                </h2>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    {tool.description}
                                </p>
                            </div>
                        ),
                    )}
                </div>
            </div>
        </div>
    );
}
