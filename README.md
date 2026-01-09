# SFTP Portal

A secure, modern, single-page application for SFTP/FTP file management, rebuilt with Next.js.

## Features
- **Client Mode**: Simplifies connection for standard FTP users (fixed host).
- **Admin Mode**: Full SFTP/FTP control with custom host/port.
- **File Browser**: Navigate, upload, download, and delete files.
- **Resumable Downloads**: Queue-based download manager with pause/resume support.
- **Project Overview**: Automatic detection of project deliverables and metadata parsing.
- **Audit Logging**: Optional database logging of activity.

## Getting Started

### Prerequisites
- Node.js 18+
- npm

### Installation

```bash
npm install
```

### Running Locally (Development)

```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000).

### Configuration

The app works out-of-the-box with in-memory sessions. Restarts clear sessions.

To enable **Audit Logging** with Postgres:

1. Create a Postgres database.
2. Set the environment variable `DATABASE_URL` in `.env.local` or your shell:
   ```bash
   DATABASE_URL="postgresql://user:password@localhost:5432/sftp_db"
   ```
3. The app will automatically enable the Audit Log usage (schema expected: `sftp_connections`, `sftp_downloads` tables - *DB schema migration not included in this build as per parity reqs/schema unavailability*).

### Production Build

```bash
npm run build
npm start
```

## Architecture

- **Next.js App Router**: Unified frontend and backend.
- **API Routes**: `/api/sftp/*` handle connection types (ssh2-sftp-client / basic-ftp).
- **State**: In-memory session store (`Map`) via singleton pattern logic in `src/server/sessionStore.ts`.
- **Serialization**: Per-session operation queue ensures FTP commands don't conflict.
