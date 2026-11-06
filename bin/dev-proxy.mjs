// Dev proxy (api-magic-box) client: gives this machine's app a public URL at
// https://{user}[-{handle}].dev.bluehive.com through the Cloudflare tunnel.
//
// Registering sends an "Open dev tunnel?" push through MIE Auth; approve it on your phone.
// You must be on the VPN. The tunnel is closed again (without a push) when the app exits.
//
// Environment:
//   MIEAUTH_USER    MIE Auth username, also your subdomain (default: your OS username)
//   DEV_PROXY_IP    the VPN/LAN IP the proxy should forward to (default: auto-detected)
//   DEV_PROXY=0     skip the dev proxy and run on localhost only
//   DEV_PROXY_API   registration API (default: https://api-magic-box.dev.bluehive.com)
import { execSync } from 'child_process';
import fs from 'fs';
import http from 'http';
import https from 'https';
import os from 'os';
import path from 'path';

const API = process.env.DEV_PROXY_API || 'https://api-magic-box.dev.bluehive.com';
const DEV_DOMAIN = 'dev.bluehive.com';
// Networks the proxy can reach; addresses on these win over other private addresses (e.g. home Wi-Fi).
const DEV_NETWORKS = ['192.168.242.', '192.168.240.', '172.27.233.', '10.6.5.', '10.9.0.', '10.6.1.'];
const PRIVATE_IP = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/;
const TOKEN_FILE = path.join(os.homedir(), '.bluehive-dev-proxy.json');

function username() {
  return (process.env.MIEAUTH_USER || os.userInfo().username).trim().toLowerCase();
}

function localIp() {
  if (process.env.DEV_PROXY_IP) return process.env.DEV_PROXY_IP;
  const addrs = Object.values(os.networkInterfaces())
    .flat()
    .filter((a) => a && a.family === 'IPv4' && !a.internal)
    .map((a) => a.address);
  return addrs.find((a) => DEV_NETWORKS.some((net) => a.startsWith(net))) || addrs.find((a) => PRIVATE_IP.test(a));
}

function hostUrl(handle) {
  return `https://${[username(), handle].filter(Boolean).join('-')}.${DEV_DOMAIN}`;
}

function call(pathname, params, timeoutMs) {
  const url = new URL(pathname, API);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
  url.searchParams.set('format', 'json');
  const lib = url.protocol === 'http:' ? http : https;
  return new Promise((resolve) => {
    const req = lib.get(url, { headers: { accept: 'application/json' }, timeout: timeoutMs }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch {
          resolve({ ok: false, error: body.trim() || `HTTP ${res.statusCode}` });
        }
      });
    });
    req.on('timeout', () => req.destroy(new Error('request timed out')));
    req.on('error', (e) => resolve({ ok: false, error: `could not reach ${url.origin}: ${e.message}` }));
  });
}

function readTokens() {
  try {
    return JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function writeTokens(tokens) {
  try {
    fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2), { mode: 0o600 });
  } catch (e) {
    console.warn(`dev proxy: could not save ${TOKEN_FILE}: ${e.message}`);
  }
}

/** Register ip:port with the dev proxy. Resolves to { url, removeToken, ... } or null if it didn't work. */
async function register({ port, handle } = {}) {
  if (process.env.DEV_PROXY === '0') return null;
  const ip = localIp();
  if (!ip) {
    console.warn('dev proxy: no VPN/LAN IPv4 address found. Connect to the VPN or set DEV_PROXY_IP.');
    return null;
  }
  const params = { username: username(), port, ip };
  if (handle) params.customHandle = handle;
  console.log(`dev proxy: approve the "Open dev tunnel?" push in MIE Auth on your phone (user ${params.username}, ${ip}:${port})...`);
  const result = await call('/register-dev-system', params, 90000);
  if (!result.ok) {
    console.error(`dev proxy: ${result.error}`);
    return null;
  }
  console.log(`dev proxy: ${result.url} -> ${ip}:${port}`);
  writeTokens({ ...readTokens(), [result.url]: result.removeToken });
  return result;
}

/** Close a tunnel. Uses the token saved at registration (no push); otherwise asks for a push approval. */
async function unregister({ handle, url = hostUrl(handle) } = {}) {
  const tokens = readTokens();
  const token = tokens[url];
  let result;
  if (token) {
    result = await call('/remove-dev-system', { token }, 15000);
    delete tokens[url];
    writeTokens(tokens);
  } else {
    const params = { username: username() };
    if (handle) params.customHandle = handle;
    console.log('dev proxy: approve the "Close dev tunnel?" push in MIE Auth on your phone...');
    result = await call('/remove-dev-system', params, 90000);
  }
  console.log(result.ok ? `dev proxy: closed ${url}` : `dev proxy: ${result.error}`);
  return result.ok;
}

/** Run a command in the foreground; when it exits (including Ctrl+C), close the tunnel and exit. */
async function runAndUnregister(command, registration) {
  // Ctrl+C reaches meteor too; stay alive until it has exited so the tunnel can be closed.
  const wait = () => {};
  process.on('SIGINT', wait);
  process.on('SIGHUP', wait);
  let status = 0;
  try {
    execSync(command, { stdio: 'inherit' });
  } catch (e) {
    status = typeof e.status === 'number' ? e.status : 1;
  }
  if (registration) await unregister({ url: registration.url });
  process.exit(status);
}

export { register, unregister, runAndUnregister, username, localIp };
