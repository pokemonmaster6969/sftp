'use client';

import React from 'react';
import { SftpProvider } from '@/context/SftpContext';
import Sidebar from '@/components/Sidebar';
import { Toaster } from 'react-hot-toast';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    return (
        <SftpProvider>
            <div className="flex h-screen bg-background text-foreground overflow-hidden">
                <Sidebar />
                <main className="page-container scrollbar-thin">
                    <div className="min-h-full p-6 md:p-8">
                        {children}
                    </div>
                    <Toaster position="bottom-right" toastOptions={{
                        style: {
                            background: 'hsl(224 64% 33%)',
                            color: '#fff',
                            border: '1px solid hsl(214.3 31.8% 91.4%)',
                            borderRadius: '0.5rem',
                        }
                    }} />
                </main>
            </div>
        </SftpProvider>
    );
}
