import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import { execSync } from 'child_process';
import type { ClientRequest, IncomingMessage } from 'http';

// Commits on the current branch touching `dir` (relative to the repo root, one level up).
function gitCommitCount(dir: string): number {
  try {
    const out = execSync(`git rev-list --count HEAD -- ${dir}`, { cwd: '..', stdio: ['ignore', 'pipe', 'ignore'] });
    return Number(out.toString().trim()) || 0;
  } catch {
    console.warn(`[build] git commit count for ${dir} unavailable, using 0`);
    return 0;
  }
}

const KEY_PATH = './certs/local.amfxtrading.com-key.pem';
const CERT_PATH = './certs/local.amfxtrading.com.pem';

// The local session cookie gets its own name in the browser, so a production session
// (token on .amfxtrading.com) never shadows it and both apps can stay signed in.
const SESSION_COOKIE = 'token';
const LOCAL_SESSION_COOKIE = 'token_local';

function toBackendCookies(header: string): string {
  return header
    .split(/;\s*/)
    .filter(pair => !pair.startsWith(`${SESSION_COOKIE}=`))
    .map(pair => pair.startsWith(`${LOCAL_SESSION_COOKIE}=`) ? SESSION_COOKIE + pair.slice(LOCAL_SESSION_COOKIE.length) : pair)
    .join('; ');
}

function renameSessionCookie(proxyReq: ClientRequest, req: IncomingMessage): void {
  if (req.headers.cookie) proxyReq.setHeader('cookie', toBackendCookies(req.headers.cookie));
}

const hasCerts = fs.existsSync(KEY_PATH) && fs.existsSync(CERT_PATH);

export default defineConfig(({ command }) => ({
  plugins: [react()],
  define: {
    __BUILD_FRONTEND__: JSON.stringify(gitCommitCount('frontend')),
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id: string) => {
          if (id.includes('lightweight-charts')) return 'lightweight-charts';
          if (id.includes('react-dom') || id.includes('react-router') || id.includes('node_modules/react/')) return 'react-vendor';
        },
      },
    },
  },
  server:
    command === 'serve' && hasCerts
      ? {
          host: 'local.amfxtrading.com',
          port: 5173,
          https: {
            key: fs.readFileSync(KEY_PATH),
            cert: fs.readFileSync(CERT_PATH),
          },
          // Same-origin API for local development: run the backend on localhost,
          // start Vite with VITE_API_BASE=/__api and the session cookie becomes first-party.
          proxy: {
            '/__api': {
              target: process.env.DEV_API_TARGET ?? 'http://localhost:3000',
              changeOrigin: true,   // a remote target behind Cloudflare needs its own Host header
              // The production API sets Domain=.amfxtrading.com; through the proxy the browser
              // keeps that cookie only as host-only for local.amfxtrading.com.
              cookieDomainRewrite: '',
              ws: true,
              rewrite: (path: string) => path.replace(/^\/__api/, ''),
              configure: proxy => {
                proxy.on('proxyReq', renameSessionCookie);
                proxy.on('proxyReqWs', renameSessionCookie);
                proxy.on('proxyRes', res => {
                  const cookies = res.headers['set-cookie'];
                  if (!cookies) return;
                  res.headers['set-cookie'] = cookies.map(cookie =>
                    cookie.startsWith(`${SESSION_COOKIE}=`) ? LOCAL_SESSION_COOKIE + cookie.slice(SESSION_COOKIE.length) : cookie);
                });
              },
            },
          },
        }
      : undefined,
}));
