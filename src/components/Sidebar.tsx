'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSftp } from '@/context/SftpContext';
import { LayoutDashboard, FolderOpen, Download, ShieldAlert, LogOut } from 'lucide-react';
import { clsx } from 'clsx';

export default function Sidebar() {
    const pathname = usePathname();
    const { session, disconnect } = useSftp();

    const navItems = [
        { name: 'Overview', href: '/dashboard/overview', icon: LayoutDashboard },
        { name: 'Files', href: '/dashboard/files', icon: FolderOpen },
        { name: 'Downloads', href: '/dashboard/downloads', icon: Download },
    ];

    if (session?.isAdmin) {
        navItems.push({ name: 'Audit', href: '/dashboard/audit', icon: ShieldAlert });
    }

    return (
        <div className="w-64 bg-card border-r border-border flex flex-col h-screen text-foreground shadow-sm z-20">
            {/* Header */}
            <div className="p-6 border-b border-border">
                <div className="mb-8 flex justify-center">
                    <Image
                        src="/unigenome.png"
                        alt="UNIGENOME - Leading Genomics Innovations"
                        width={240}
                        height={80}
                        priority
                        className="object-contain h-auto w-full"
                    />
                </div>

                <nav className="space-y-1">
                    {navItems.map((item) => {
                        const isActive = pathname.startsWith(item.href);
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={clsx(
                                    "sidebar-nav-item",
                                    isActive
                                        ? "bg-accent text-primary font-semibold"
                                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                )}
                            >
                                <item.icon className="w-5 h-5 flex-shrink-0" />
                                <span>{item.name}</span>
                            </Link>
                        )
                    })}
                </nav>
            </div>

            {/* Footer */}
            <div className="mt-auto p-6 border-t border-border space-y-4">
                <div className="space-y-1.5 px-1">
                    <p className="text-xs-tight">Connected As</p>
                    <p className="text-sm font-semibold text-foreground truncate" title={session?.username}>{session?.username}</p>
                    <p className="text-xs text-muted-foreground truncate" title={session?.server}>{session?.server}</p>
                </div>
                <button
                    onClick={disconnect}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 rounded-[--radius-md] transition-colors"
                >
                    <LogOut className="w-4 h-4" />
                    Disconnect
                </button>
            </div>
        </div>
    );
}
