import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['ssh2', 'ssh2-sftp-client', 'basic-ftp'],
};

export default nextConfig;
