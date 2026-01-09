'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Loader2, Server, Shield, User, Lock, Globe } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';
import { clsx } from 'clsx';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'client' | 'admin'>('client');
  const [loading, setLoading] = useState(false);

  // Form State
  const [server, setServer] = useState('120.72.93.162');
  const [port, setPort] = useState('9091');
  const [protocol, setProtocol] = useState<'ftp' | 'sftp'>('ftp');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [path, setPath] = useState('/');

  // Reset fields when switching modes
  useEffect(() => {
    if (mode === 'client') {
      setServer('120.72.93.162');
      setPort('9091');
      setProtocol('ftp');
    } else {
      // Admin defaults
      setProtocol('sftp');
      setPath('/');
      if (server === '120.72.93.162' && port === '9091') {
        // Clear fixed values if they were client defaults
        setServer('');
        setPort('');
      }
    }
  }, [mode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Sanitize Server
    let cleanServer = server;
    if (cleanServer.startsWith('ftp://')) cleanServer = cleanServer.replace('ftp://', '');
    if (cleanServer.startsWith('sftp://')) cleanServer = cleanServer.replace('sftp://', '');

    try {
      const res = await fetch('/api/sftp/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          server: cleanServer,
          port,
          protocol: mode === 'client' ? 'ftp' : 'sftp', // Force protocol based on mode per requirements
          username,
          password,
          path,
          isAdmin: mode === 'admin'
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Connection failed');
      }

      // Success
      const { sessionId, type, isAdmin } = data;
      // Store in localStorage for persistence across reloads
      localStorage.setItem('sftp_session', JSON.stringify({ sessionId, server: cleanServer, username, isAdmin, type }));
      localStorage.setItem('sftp_current_path', path || '/');

      toast.success('Connected successfully');
      router.push('/dashboard/files');

    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Background Decorative Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute top-[-10%] right-[-5%] w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[600px] h-[600px] bg-secondary/5 rounded-full blur-3xl" />
      </div>

      <Toaster position="bottom-right" toastOptions={{
        style: {
          background: 'hsl(224 64% 33%)',
          color: '#fff',
          borderRadius: '0.5rem',
        },
      }} />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-5xl bg-card rounded-[--radius-lg] shadow-lg overflow-hidden flex flex-col md:flex-row z-10 min-h-[600px] border border-border"
      >
        {/* Left Side: Brand & Visuals */}
        <div className="md:w-5/12 bg-primary p-10 flex flex-col justify-between text-primary-foreground relative overflow-hidden">
          <div className="bg-white/95 backdrop-blur shadow-sm p-4 rounded-[--radius-lg] w-fit mb-6">
            <Image
              src="/unigenome.png"
              alt="UNIGENOME - Leading Genomics Innovations"
              width={280}
              height={100}
              priority
              className="object-contain h-20 w-auto"
            />
          </div>


          <div className="z-10 space-y-6">
            <h2 className="text-3xl font-bold leading-tight">Secure Access to Your Data.</h2>
            <p className="text-primary-foreground/90 text-sm leading-relaxed">
              Securely access, manage, and transfer your research data with enterprise-grade encryption.
            </p>
          </div>

          <div className="z-10 text-xs text-primary-foreground/70 font-medium">
            © {new Date().getFullYear()} Unigenome. All rights reserved.
          </div>

          {/* Abstract Pattern */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] border-[40px] border-primary-foreground/5 rounded-full" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] border-[20px] border-secondary/10 rounded-full" />
        </div>

        {/* Right Side: Login Form */}
        <div className="md:w-7/12 p-10 lg:p-14 flex flex-col justify-center bg-card">
          <div className="mb-10">
            <h1 className="text-2xl font-bold text-foreground mb-2">Login</h1>
            <p className="text-muted-foreground text-sm">Enter your credentials to continue.</p>
          </div>

          <div className="flex p-1 bg-muted rounded-[--radius-md] mb-8 w-fit border border-border mx-auto md:mx-0">
            <button
              onClick={() => setMode('client')}
              className={clsx(
                "px-6 py-2 text-sm font-semibold rounded-[--radius-sm] transition-all",
                mode === 'client' ? "bg-card text-primary shadow-sm border border-border" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Client
            </button>
            <button
              onClick={() => setMode('admin')}
              className={clsx(
                "px-6 py-2 text-sm font-semibold rounded-[--radius-sm] transition-all",
                mode === 'admin' ? "bg-card text-primary shadow-sm border border-border" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Admin
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Server & Port Row */}
            <div className="grid grid-cols-3 gap-5">
              <div className="col-span-2 space-y-2">
                <label className="text-xs-tight ml-1">Server Host</label>
                <div className="relative group">
                  <Globe className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <input
                    type="text"
                    value={server}
                    onChange={(e) => setServer(e.target.value)}
                    disabled={mode === 'client'}
                    className="input pl-9 disabled:opacity-50"
                    placeholder="sftp.example.com"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs-tight ml-1">Port</label>
                <div className="relative group">
                  <Server className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <input
                    type="text"
                    value={port}
                    onChange={(e) => setPort(e.target.value)}
                    disabled={mode === 'client'}
                    className="input pl-9 disabled:opacity-50"
                    placeholder="22"
                  />
                </div>
              </div>
            </div>

            {/* Username */}
            <div className="space-y-2">
              <label className="text-xs-tight ml-1">Username</label>
              <div className="relative group">
                <User className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="input pl-9"
                  placeholder="Enter username"
                  autoComplete="username"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-2">
              <label className="text-xs-tight ml-1">Password</label>
              <div className="relative group">
                <Lock className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input pl-9"
                  placeholder="Enter password"
                  autoComplete="current-password"
                  required
                />
              </div>
            </div>

            {/* Initial Path */}
            <div className="space-y-2">
              <label className="text-xs-tight ml-1">Initial Path</label>
              <input
                type="text"
                value={path}
                onChange={(e) => setPath(e.target.value)}
                className="input"
                placeholder="/"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-secondary w-full flex items-center justify-center gap-2 mt-6"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Shield className="w-5 h-5" />}
              {loading ? 'Connecting...' : 'Connect'}
            </button>

            <div className="text-center text-xs text-muted-foreground mt-6 font-medium">
              {mode === 'client' ? 'FTP Mode' : 'Admin Mode (SFTP)'}
            </div>
          </form>
        </div>
      </motion.div >
    </div >
  );
}
