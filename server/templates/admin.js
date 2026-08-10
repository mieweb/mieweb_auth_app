/**
 * Admin UI HTML template - self-contained single-page admin dashboard
 * Served at ROOT_URL/admin, uses React via CDN (no bundler dependency)
 * Authenticates via LDAP credentials against /api/admin/auth
 */
export const adminPageTemplate = () => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin Dashboard - MIEWeb Auth</title>
  <script src="https://unpkg.com/react@18.3.1/umd/react.production.min.js" crossorigin></script>
  <script src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js" crossorigin></script>
  <!-- Pin Babel to v7: v8 (unpkg "latest") defaults JSX to the automatic runtime,
       emitting \`import { jsx } from "react/jsx-runtime"\` which breaks this classic
       (non-module) UMD setup with "Cannot use import statement outside a module". -->
  <script src="https://unpkg.com/@babel/standalone@7.26.4/babel.min.js"></script>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .fade-in { animation: fadeIn 0.3s ease-in; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
    .spinner { border: 3px solid #e5e7eb; border-top-color: #3b82f6; border-radius: 50%; width: 20px; height: 20px; animation: spin 0.6s linear infinite; display: inline-block; }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body class="bg-gray-50 min-h-screen">
<div id="admin-root"></div>
<script type="text/babel">
const { useState, useEffect, useCallback } = React;

// ─── API helper ──────────────────────────────────────────────────
const api = async (path, opts = {}) => {
  try {
    const token = sessionStorage.getItem('adminToken');
    const response = await fetch(path, {
      ...opts,
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (token || ''), ...opts.headers }
    });

    let body;
    try {
      body = await response.json();
    } catch {
      const text = await response.text();
      body = { error: text || response.statusText };
    }

    if (!response.ok) {
      const err = new Error(body.error || \`HTTP \${response.status}: \${response.statusText}\`);
      err.status = response.status;
      err.statusText = response.statusText;
      err.body = body;
      err.errorCode = body.errorCode || null;
      throw err;
    }

    return body;
  } catch (err) {
    if (err.status) throw err;
    const wrapped = new Error(err.message || 'Network request failed');
    wrapped.status = 0;
    wrapped.statusText = 'Network Error';
    wrapped.body = null;
    wrapped.errorCode = 'network-error';
    throw wrapped;
  }
};

// ─── Toast ───────────────────────────────────────────────────────
const Toast = ({ msg, type, onClose }) => {
  useEffect(() => { const t = setTimeout(onClose, type === 'error' ? 5000 : 3500); return () => clearTimeout(t); }, [onClose, type]);
  const bg = type === 'error' ? 'bg-red-500' : type === 'warning' ? 'bg-yellow-500' : 'bg-green-500';
  return <div className={\`fixed top-4 right-4 z-50 \${bg} text-white px-4 py-2 rounded-lg shadow-lg fade-in text-sm max-w-sm\`}>{msg}</div>;
};

// ─── Login Page ──────────────────────────────────────────────────
const LoginPage = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Encrypt password with server's RSA public key so it never appears in plaintext in the network tab
  const encryptPassword = async (plaintext) => {
    const res = await fetch('/api/admin/pubkey');
    const { publicKey: pem } = await res.json();
    // Convert PEM to binary DER for Web Crypto
    const pemBody = pem.replace(/-----[A-Z ]+-----/g, '').replace(/\\s/g, '');
    const der = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0));
    const key = await crypto.subtle.importKey('spki', der, { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['encrypt']);
    const encoded = new TextEncoder().encode(plaintext);
    const encrypted = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, key, encoded);
    return btoa(String.fromCharCode(...new Uint8Array(encrypted)));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setLoading(true);
    setError('');
    try {
      const encryptedPassword = await encryptPassword(password);

      const response = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), encryptedPassword })
      });

      let res;
      try { res = await response.json(); }
      catch { res = { error: 'Unexpected server response' }; }

      if (response.ok && res.success) {
        sessionStorage.setItem('adminToken', res.token);
        onLogin(res.username);
      } else {
        setError(res.error || 'Authentication failed');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Unable to connect to the server. Check your network and try again.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm space-y-5 fade-in">
        <div className="text-center">
          <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-7 h-7 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900">Admin Login</h1>
          <p className="text-sm text-gray-500 mt-1">Sign in with your LDAP credentials</p>
        </div>
        <input
          type="text"
          value={username}
          onChange={e => setUsername(e.target.value)}
          placeholder="Username"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
          autoFocus
          autoComplete="username"
        />
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="Password"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
          autoComplete="current-password"
        />
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <p className="text-red-600 text-sm text-center">{error}</p>
          </div>
        )}
        <button
          type="submit"
          disabled={loading || !username.trim() || !password}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-lg font-medium transition-colors text-sm"
        >
          {loading ? <span className="spinner" /> : 'Sign In'}
        </button>
      </form>
    </div>
  );
};

// ─── Confirm Dialog ──────────────────────────────────────────────
const ConfirmDialog = ({ title, message, onConfirm, onCancel, danger }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
    <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4 fade-in">
      <h3 className="font-bold text-lg text-gray-900">{title}</h3>
      <p className="text-sm text-gray-600 mt-2">{message}</p>
      <div className="flex gap-3 mt-6 justify-end">
        <button onClick={onCancel} className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
        <button onClick={onConfirm} className={\`px-4 py-2 text-sm text-white rounded-lg \${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}\`}>
          Confirm
        </button>
      </div>
    </div>
  </div>
);

// ─── Tab: API Keys ───────────────────────────────────────────────
const ApiKeysTab = ({ toast, toastErr }) => {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newClientId, setNewClientId] = useState('');
  const [newKey, setNewKey] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await api('/api/admin/api-keys/list');
    if (res.success) setKeys(res.keys);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!newClientId.trim()) return;
    try {
      const res = await api('/api/admin/api-keys/create', { method: 'POST', body: JSON.stringify({ clientId: newClientId.trim() }) });
      if (res.success) {
        setNewKey(res.apiKey);
        setNewClientId('');
        toast('API key created', 'success');
        load();
      } else {
        toast(res.error || 'Failed to create API key', 'error');
      }
    } catch (err) {
      toastErr(err.message || 'An unexpected error occurred', 'error', err);
    }
  };

  const handleDelete = async (clientId) => {
    setConfirm({
      title: 'Delete API Key',
      message: \`Permanently delete the API key for "\${clientId}"? This cannot be undone.\`,
      danger: true,
      onConfirm: async () => {
        try {
          setConfirm(null);
          const res = await api('/api/admin/api-keys/delete', { method: 'DELETE', body: JSON.stringify({ clientId }) });
          if (res.success) { toast('Key deleted', 'success'); load(); }
          else toast(res.error || 'Failed to delete key', 'error');
        } catch (err) {
          toastErr(err.message || 'An unexpected error occurred', 'error', err);
        }
      }
    });
  };

  return (
    <div className="space-y-6 fade-in">
      {confirm && <ConfirmDialog {...confirm} onCancel={() => setConfirm(null)} />}
      {/* Create */}
      <div className="bg-white rounded-xl shadow-sm border p-5">
        <h3 className="font-semibold text-gray-900 mb-3">Create New Client API Key</h3>
        <div className="flex gap-3">
          <input value={newClientId} onChange={e => setNewClientId(e.target.value)} placeholder="Client ID (e.g. ldap.example.com)" className="flex-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          <button onClick={handleCreate} disabled={!newClientId.trim()} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white text-sm rounded-lg">Create</button>
        </div>
        {newKey && (
          <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-xs font-medium text-green-800 mb-1">⚠️ Copy this key now — it won't be shown again:</p>
            <div className="flex items-center gap-2">
              <code className="text-xs break-all select-all bg-green-100 p-2 rounded block flex-1">{newKey}</code>
              <button onClick={() => { navigator.clipboard.writeText(newKey); toast('Copied to clipboard', 'success'); }} className="shrink-0 px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg">📋 Copy</button>
            </div>
          </div>
        )}
      </div>
      {/* List */}
      <div className="bg-white rounded-xl shadow-sm border">
        <div className="px-5 py-4 border-b"><h3 className="font-semibold text-gray-900">Client API Keys</h3></div>
        {loading ? <div className="p-8 text-center"><span className="spinner" /></div> : keys.length === 0 ? (
          <p className="p-8 text-center text-gray-400 text-sm">No API keys found</p>
        ) : (
          <div className="divide-y">
            {keys.map(k => (
              <div key={k.clientId} className="px-5 py-3 flex items-center justify-between hover:bg-gray-50">
                <div>
                  <p className="font-medium text-sm text-gray-900">{k.clientId}</p>
                  <p className="text-xs text-gray-500">Key: <code className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">{k.keyPrefix}••••••••••••••</code> · Created: {new Date(k.createdAt).toLocaleDateString()} · Last used: {k.lastUsed ? new Date(k.lastUsed).toLocaleDateString() : 'Never'}</p>
                </div>
                <button onClick={() => handleDelete(k.clientId)} className="text-red-500 hover:text-red-700 text-xs font-medium px-3 py-1 rounded hover:bg-red-50">Delete</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Tab: Duo Integrations ───────────────────────────────────────
const DuoTab = ({ toast, toastErr }) => {
  const [integrations, setIntegrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('auth');
  const [newCred, setNewCred] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api('/api/admin/duo/list');
      if (res.success) setIntegrations(res.integrations);
    } catch (err) {
      toastErr(err.message || 'Failed to load integrations', 'error', err);
    }
    setLoading(false);
  }, [toastErr]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      const res = await api('/api/admin/duo/create', { method: 'POST', body: JSON.stringify({ name: newName.trim(), type: newType }) });
      if (res.success) {
        setNewCred({ name: res.name, ikey: res.ikey, skey: res.skey });
        setNewName('');
        toast('Duo integration created', 'success');
        load();
      } else {
        toast(res.error || 'Failed to create integration', 'error');
      }
    } catch (err) {
      toastErr(err.message || 'An unexpected error occurred', 'error', err);
    }
  };

  const handleToggle = async (name, enabled) => {
    try {
      const res = await api('/api/admin/duo/set-enabled', { method: 'POST', body: JSON.stringify({ name, enabled }) });
      if (res.success) { toast(enabled ? 'Integration enabled' : 'Integration disabled', 'success'); load(); }
      else toast(res.error || 'Failed to update integration', 'error');
    } catch (err) {
      toastErr(err.message || 'An unexpected error occurred', 'error', err);
    }
  };

  const handleRegenerate = (name) => {
    setConfirm({
      title: 'Regenerate Credentials',
      message: \`Rotate the ikey/skey for "\${name}"? The old credentials will stop working immediately.\`,
      danger: true,
      onConfirm: async () => {
        try {
          setConfirm(null);
          const res = await api('/api/admin/duo/regenerate', { method: 'POST', body: JSON.stringify({ name }) });
          if (res.success) { setNewCred({ name: res.name, ikey: res.ikey, skey: res.skey }); toast('Credentials rotated', 'success'); load(); }
          else toast(res.error || 'Failed to rotate credentials', 'error');
        } catch (err) {
          toastErr(err.message || 'An unexpected error occurred', 'error', err);
        }
      }
    });
  };

  const handleDelete = (name) => {
    setConfirm({
      title: 'Delete Duo Integration',
      message: \`Permanently delete the Duo integration "\${name}"? This cannot be undone.\`,
      danger: true,
      onConfirm: async () => {
        try {
          setConfirm(null);
          const res = await api('/api/admin/duo/delete', { method: 'DELETE', body: JSON.stringify({ name }) });
          if (res.success) { toast('Integration deleted', 'success'); load(); }
          else toast(res.error || 'Failed to delete integration', 'error');
        } catch (err) {
          toastErr(err.message || 'An unexpected error occurred', 'error', err);
        }
      }
    });
  };

  return (
    <div className="space-y-6 fade-in">
      {confirm && <ConfirmDialog {...confirm} onCancel={() => setConfirm(null)} />}
      {/* Create */}
      <div className="bg-white rounded-xl shadow-sm border p-5">
        <h3 className="font-semibold text-gray-900 mb-3">Create New Duo Integration</h3>
        <div className="flex flex-wrap gap-3">
          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Name (e.g. authentik-prod)" className="flex-1 min-w-[200px] px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          <select value={newType} onChange={e => setNewType(e.target.value)} className="px-3 py-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none">
            <option value="auth">Auth API</option>
            <option value="admin">Admin API</option>
          </select>
          <button onClick={handleCreate} disabled={!newName.trim()} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white text-sm rounded-lg">Create</button>
        </div>
        {newCred && (
          <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-xs font-medium text-green-800 mb-2">⚠️ Copy the secret key now — it won't be shown again:</p>
            <div className="space-y-1 text-xs">
              <div><span className="text-gray-500">Name:</span> <code className="bg-green-100 px-1.5 py-0.5 rounded">{newCred.name}</code></div>
              <div><span className="text-gray-500">Integration key (ikey):</span> <code className="bg-green-100 px-1.5 py-0.5 rounded select-all">{newCred.ikey}</code></div>
              <div className="flex items-center gap-2">
                <span className="text-gray-500 shrink-0">Secret key (skey):</span>
                <code className="bg-green-100 px-1.5 py-0.5 rounded break-all select-all flex-1">{newCred.skey}</code>
                <button onClick={() => { navigator.clipboard.writeText(newCred.skey); toast('Secret key copied', 'success'); }} className="shrink-0 px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded">📋 Copy</button>
              </div>
            </div>
          </div>
        )}
      </div>
      {/* List */}
      <div className="bg-white rounded-xl shadow-sm border">
        <div className="px-5 py-4 border-b"><h3 className="font-semibold text-gray-900">Duo Integrations</h3></div>
        {loading ? <div className="p-8 text-center"><span className="spinner" /></div> : integrations.length === 0 ? (
          <p className="p-8 text-center text-gray-400 text-sm">No Duo integrations found</p>
        ) : (
          <div className="divide-y">
            {integrations.map(d => (
              <div key={d.name} className="px-5 py-3 flex items-center justify-between hover:bg-gray-50">
                <div>
                  <p className="font-medium text-sm text-gray-900">
                    {d.name}
                    <span className={\`ml-2 text-[10px] uppercase px-1.5 py-0.5 rounded-full \${d.type === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}\`}>{d.type || 'auth'}</span>
                    {!d.enabled && <span className="ml-2 text-[10px] uppercase px-1.5 py-0.5 rounded-full bg-gray-200 text-gray-600">disabled</span>}
                  </p>
                  <p className="text-xs text-gray-500">ikey: <code className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">{d.ikey}</code> · Created: {new Date(d.createdAt).toLocaleDateString()} · Last used: {d.lastUsed ? new Date(d.lastUsed).toLocaleString() : 'Never'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleToggle(d.name, !d.enabled)} className={\`text-xs font-medium px-3 py-1 rounded \${d.enabled ? 'text-amber-600 hover:bg-amber-50' : 'text-green-600 hover:bg-green-50'}\`}>{d.enabled ? 'Disable' : 'Enable'}</button>
                  <button onClick={() => handleRegenerate(d.name)} className="text-blue-600 hover:text-blue-800 text-xs font-medium px-3 py-1 rounded hover:bg-blue-50">Rotate</button>
                  <button onClick={() => handleDelete(d.name)} className="text-red-500 hover:text-red-700 text-xs font-medium px-3 py-1 rounded hover:bg-red-50">Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Tab: Users ──────────────────────────────────────────────────
const UsersTab = ({ toast, toastErr }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await api('/api/admin/users/list');
    if (res.success) setUsers(res.users);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleApprove = async (userId, username) => {
    setConfirm({
      title: 'Approve User',
      message: \`Approve user "\${username}"? Their devices will also be approved.\`,
      onConfirm: async () => {
        try {
          setConfirm(null);
          const res = await api('/api/admin/users/approve', { method: 'POST', body: JSON.stringify({ userId }) });
          if (res.success) { toast('User approved', 'success'); load(); }
          else toast(res.error || 'Failed to approve user', 'error');
        } catch (err) {
          toastErr(err.message || 'An unexpected error occurred', 'error', err);
        }
      }
    });
  };

  const handleDelete = async (userId, username) => {
    setConfirm({
      title: 'Delete User',
      message: \`Permanently delete user "\${username}" and all associated data? This cannot be undone.\`,
      danger: true,
      onConfirm: async () => {
        try {
          setConfirm(null);
          const res = await api('/api/admin/users/delete', { method: 'POST', body: JSON.stringify({ userId }) });
          if (res.success) { toast('User deleted', 'success'); load(); }
          else toast(res.error || 'Failed to delete user', 'error');
        } catch (err) {
          toastErr(err.message || 'An unexpected error occurred', 'error', err);
        }
      }
    });
  };

  const statusBadge = (status) => {
    const colors = { approved: 'bg-green-100 text-green-700', pending: 'bg-yellow-100 text-yellow-700', rejected: 'bg-red-100 text-red-700' };
    return <span className={\`text-xs px-2 py-0.5 rounded-full font-medium \${colors[status] || 'bg-gray-100 text-gray-600'}\`}>{status}</span>;
  };

  return (
    <div className="fade-in">
      {confirm && <ConfirmDialog {...confirm} onCancel={() => setConfirm(null)} />}
      <div className="bg-white rounded-xl shadow-sm border">
        <div className="px-5 py-4 border-b"><h3 className="font-semibold text-gray-900">Registered Users</h3></div>
        {loading ? <div className="p-8 text-center"><span className="spinner" /></div> : users.length === 0 ? (
          <p className="p-8 text-center text-gray-400 text-sm">No users found</p>
        ) : (
          <div className="divide-y">
            {users.map(u => (
              <div key={u._id} className="px-5 py-3 flex items-center justify-between hover:bg-gray-50">
                <div>
                  <p className="font-medium text-sm text-gray-900">{u.username} {statusBadge(u.registrationStatus)}</p>
                  <p className="text-xs text-gray-500">{u.email} · {u.firstName} {u.lastName}</p>
                </div>
                <div className="flex gap-2">
                  {u.registrationStatus === 'pending' && (
                    <button onClick={() => handleApprove(u._id, u.username)} className="text-green-600 hover:text-green-800 text-xs font-medium px-3 py-1 rounded hover:bg-green-50">Approve</button>
                  )}
                  <button onClick={() => handleDelete(u._id, u.username)} className="text-red-500 hover:text-red-700 text-xs font-medium px-3 py-1 rounded hover:bg-red-50">Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Tab: Devices ────────────────────────────────────────────────
const DevicesTab = ({ toast, toastErr }) => {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await api('/api/admin/devices/list');
    if (res.success) setDevices(res.devices);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleApprove = async (userId, deviceUUID) => {
    setConfirm({
      title: 'Approve Device',
      message: 'Approve this device?',
      onConfirm: async () => {
        try {
          setConfirm(null);
          const res = await api('/api/admin/devices/approve', { method: 'POST', body: JSON.stringify({ userId, deviceUUID }) });
          if (res.success) { toast('Device approved', 'success'); load(); }
          else toast(res.error || 'Failed to approve device', 'error');
        } catch (err) {
          toastErr(err.message || 'An unexpected error occurred', 'error', err);
        }
      }
    });
  };

  const handleRevoke = async (userId, deviceUUID) => {
    setConfirm({
      title: 'Revoke Device',
      message: 'Revoke and remove this device? The user will need to re-register it.',
      danger: true,
      onConfirm: async () => {
        try {
          setConfirm(null);
          const res = await api('/api/admin/devices/revoke', { method: 'POST', body: JSON.stringify({ userId, deviceUUID }) });
          if (res.success) { toast('Device revoked', 'success'); load(); }
          else toast(res.error || 'Failed to revoke device', 'error');
        } catch (err) {
          toastErr(err.message || 'An unexpected error occurred', 'error', err);
        }
      }
    });
  };

  const statusBadge = (status) => {
    const colors = { approved: 'bg-green-100 text-green-700', pending: 'bg-yellow-100 text-yellow-700', revoked: 'bg-red-100 text-red-700' };
    return <span className={\`text-xs px-2 py-0.5 rounded-full font-medium \${colors[status] || 'bg-gray-100 text-gray-600'}\`}>{status}</span>;
  };

  // Group devices by user
  const grouped = devices.reduce((acc, d) => {
    if (!acc[d.userId]) acc[d.userId] = { userId: d.userId, username: d.username, email: d.email, devices: [] };
    acc[d.userId].devices.push(d);
    return acc;
  }, {});
  const users = Object.values(grouped);

  return (
    <div className="fade-in">
      {confirm && <ConfirmDialog {...confirm} onCancel={() => setConfirm(null)} />}
      <div className="bg-white rounded-xl shadow-sm border">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Registered Devices</h3>
          <span className="text-xs text-gray-400">{users.length} user{users.length !== 1 ? 's' : ''} · {devices.length} device{devices.length !== 1 ? 's' : ''}</span>
        </div>
        {loading ? <div className="p-8 text-center"><span className="spinner" /></div> : users.length === 0 ? (
          <p className="p-8 text-center text-gray-400 text-sm">No devices found</p>
        ) : (
          <div className="divide-y">
            {users.map((u) => (
              <div key={u.userId} className="px-5 py-4">
                {/* User header */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold shrink-0">{(u.username || '?')[0].toUpperCase()}</span>
                  <div>
                    <p className="font-semibold text-sm text-gray-900">{u.username}</p>
                    <p className="text-xs text-gray-500">{u.email}</p>
                  </div>
                  <span className="text-xs text-gray-400 ml-auto">{u.devices.length} device{u.devices.length !== 1 ? 's' : ''}</span>
                </div>
                {/* Device list */}
                <div className="ml-10 space-y-2">
                  {u.devices.map((d, i) => (
                    <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-2">
                      <div>
                        <p className="text-sm text-gray-800 font-medium">
                          {d.deviceModel || 'Unknown'} ({d.devicePlatform || '?'})
                          {' '}{statusBadge(d.status)}
                          {d.isPrimary && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full ml-1">Primary</span>}
                        </p>
                        <p className="text-xs text-gray-500 truncate max-w-sm">UUID: {d.deviceUUID}</p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        {d.status === 'pending' && (
                          <button onClick={() => handleApprove(d.userId, d.deviceUUID)} className="text-green-600 hover:text-green-800 text-xs font-medium px-3 py-1 rounded hover:bg-green-100">Approve</button>
                        )}
                        <button onClick={() => handleRevoke(d.userId, d.deviceUUID)} className="text-red-500 hover:text-red-700 text-xs font-medium px-3 py-1 rounded hover:bg-red-100">Revoke</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Tab: Emails ─────────────────────────────────────────────────
const EmailsTab = ({ toast, toastErr }) => {
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState(null);
  const [filter, setFilter] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    const res = await api('/api/admin/emails/list');
    if (res.success) setEmails(res.emails);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleApprove = (userId, username) => {
    setConfirm({
      title: 'Approve User',
      message: \`Approve user "\${username}"? Their devices will also be approved.\`,
      onConfirm: async () => {
        try {
          setConfirm(null);
          const res = await api('/api/admin/users/approve', { method: 'POST', body: JSON.stringify({ userId }) });
          if (res.success) { toast('User approved', 'success'); load(); }
          else toast(res.error || 'Failed to approve user', 'error');
        } catch (err) {
          toastErr(err.message || 'An unexpected error occurred', 'error', err);
        }
      }
    });
  };

  const handleReject = (userId, username) => {
    setConfirm({
      title: 'Reject User',
      message: \`Reject and delete user "\${username}"? This cannot be undone.\`,
      danger: true,
      onConfirm: async () => {
        try {
          setConfirm(null);
          const res = await api('/api/admin/users/delete', { method: 'POST', body: JSON.stringify({ userId }) });
          if (res.success) { toast('User rejected and removed', 'success'); load(); }
          else toast(res.error || 'Failed to reject user', 'error');
        } catch (err) {
          toastErr(err.message || 'An unexpected error occurred', 'error', err);
        }
      }
    });
  };

  const typeBadge = (type) => {
    const map = {
      registration_approval: { label: 'Registration', color: 'bg-blue-100 text-blue-700' },
      support_request: { label: 'Support', color: 'bg-purple-100 text-purple-700' },
      account_deletion_admin: { label: 'Deletion (Admin)', color: 'bg-red-100 text-red-700' },
      account_deletion_user: { label: 'Deletion (User)', color: 'bg-orange-100 text-orange-700' }
    };
    const info = map[type] || { label: type, color: 'bg-gray-100 text-gray-600' };
    return <span className={\`text-xs px-2 py-0.5 rounded-full font-medium \${info.color}\`}>{info.label}</span>;
  };

  const statusBadge = (status) => {
    const colors = { sent: 'bg-green-100 text-green-700', failed: 'bg-red-100 text-red-700' };
    return <span className={\`text-xs px-2 py-0.5 rounded-full font-medium \${colors[status] || 'bg-gray-100 text-gray-600'}\`}>{status}</span>;
  };

  const regStatusBadge = (status) => {
    const colors = { approved: 'bg-green-100 text-green-700', pending: 'bg-yellow-100 text-yellow-700', rejected: 'bg-red-100 text-red-700', deleted: 'bg-gray-100 text-gray-500' };
    return <span className={\`text-xs px-2 py-0.5 rounded-full font-medium \${colors[status] || 'bg-gray-100 text-gray-600'}\`}>{status}</span>;
  };

  const FILTERS = [
    { id: 'all', label: 'All' },
    { id: 'registration_approval', label: 'Registration' },
    { id: 'support_request', label: 'Support' },
    { id: 'account_deletion_admin', label: 'Deletion' }
  ];

  const filtered = filter === 'all'
    ? emails
    : filter === 'account_deletion_admin'
      ? emails.filter(e => e.type === 'account_deletion_admin' || e.type === 'account_deletion_user')
      : emails.filter(e => e.type === filter);

  return (
    <div className="fade-in">
      {confirm && <ConfirmDialog {...confirm} onCancel={() => setConfirm(null)} />}
      {/* Filter bar */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {FILTERS.map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className={\`px-3 py-1.5 text-xs rounded-full font-medium border transition-colors \${filter === f.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'}\`}>
            {f.label}
          </button>
        ))}
        <button onClick={load} className="ml-auto px-3 py-1.5 text-xs rounded-full font-medium border bg-white text-gray-600 border-gray-300 hover:border-blue-400">↻ Refresh</button>
      </div>
      <div className="bg-white rounded-xl shadow-sm border">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Email Log</h3>
          <span className="text-xs text-gray-400">{filtered.length} email{filtered.length !== 1 ? 's' : ''}</span>
        </div>
        {loading ? <div className="p-8 text-center"><span className="spinner" /></div> : filtered.length === 0 ? (
          <p className="p-8 text-center text-gray-400 text-sm">No emails found</p>
        ) : (
          <div className="divide-y">
            {filtered.map((e) => (
              <div key={e._id} className="px-5 py-3 hover:bg-gray-50">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {typeBadge(e.type)}
                      {statusBadge(e.status)}
                      {e.registrationStatus && regStatusBadge(e.registrationStatus)}
                    </div>
                    <p className="font-medium text-sm text-gray-900 mt-1 truncate">{e.subject}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      To: {e.to}{e.username ? \` · User: \${e.username}\` : ''}{e.email ? \` · \${e.email}\` : ''}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{new Date(e.createdAt).toLocaleString()}</p>
                    {e.error && <p className="text-xs text-red-500 mt-0.5">Error: {e.error}</p>}
                  </div>
                  {/* Show approve/reject actions for pending registration emails */}
                  {e.type === 'registration_approval' && e.registrationStatus === 'pending' && e.userId && (
                    <div className="flex gap-2 shrink-0 pt-1">
                      <button onClick={() => handleApprove(e.userId, e.username)} className="text-green-600 hover:text-green-800 text-xs font-medium px-3 py-1 rounded hover:bg-green-50 border border-green-200">Approve</button>
                      <button onClick={() => handleReject(e.userId, e.username)} className="text-red-500 hover:text-red-700 text-xs font-medium px-3 py-1 rounded hover:bg-red-50 border border-red-200">Reject</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Tab: Diagnostics ────────────────────────────────────────
const DiagnosticsTab = ({ toast, toastErr }) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [pushResults, setPushResults] = useState({});
  const [pushing, setPushing] = useState(null);

  const lookup = async (e) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setData(null);
    setNotFound(false);
    setPushResults({});
    try {
      const res = await api('/api/admin/diagnostics/user?q=' + encodeURIComponent(query.trim()));
      if (res.success) setData(res);
    } catch (err) {
      if (err.status === 404) setNotFound(true);
      else toastErr(err.message || 'Lookup failed', 'error', err);
    }
    setLoading(false);
  };

  const testPush = async (userId, deviceUUID) => {
    setPushing(deviceUUID);
    try {
      const res = await api('/api/admin/diagnostics/test-push', { method: 'POST', body: JSON.stringify({ userId, deviceUUID }) });
      setPushResults(prev => ({ ...prev, [deviceUUID]: res }));
      toast(res.success ? 'Test push accepted by FCM' : 'Test push failed — see result below', res.success ? 'success' : 'warning');
    } catch (err) {
      toastErr(err.message || 'Test push failed', 'error', err);
    }
    setPushing(null);
  };

  const statusBadge = (status) => {
    const colors = { approved: 'bg-green-100 text-green-700', pending: 'bg-yellow-100 text-yellow-700', approve: 'bg-green-100 text-green-700', reject: 'bg-red-100 text-red-700', rejected: 'bg-red-100 text-red-700', dismissed: 'bg-gray-100 text-gray-600' };
    return <span className={\`text-xs px-2 py-0.5 rounded-full font-medium \${colors[status] || 'bg-gray-100 text-gray-600'}\`}>{status}</span>;
  };

  return (
    <div className="space-y-6 fade-in">
      {/* Search */}
      <div className="bg-white rounded-xl shadow-sm border p-5">
        <h3 className="font-semibold text-gray-900 mb-1">User Diagnostics</h3>
        <p className="text-xs text-gray-500 mb-3">Inspect a user's account, devices, FCM token state, and recent notifications — e.g. to troubleshoot pushes that are not being delivered.</p>
        <form onSubmit={lookup} className="flex gap-3">
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Username, email, or userId" className="flex-1 px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          <button type="submit" disabled={loading || !query.trim()} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white text-sm rounded-lg">{loading ? <span className="spinner" /> : 'Look up'}</button>
        </form>
        {notFound && <p className="text-sm text-red-500 mt-3">No user or device record matched that query.</p>}
      </div>

      {data && (
        <React.Fragment>
          {/* Warnings */}
          {data.warnings.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-yellow-800 mb-1">⚠️ Potential issues</p>
              <ul className="list-disc ml-5 space-y-0.5">
                {data.warnings.map((w, i) => <li key={i} className="text-xs text-yellow-800">{w}</li>)}
              </ul>
            </div>
          )}

          {/* Account */}
          <div className="bg-white rounded-xl shadow-sm border">
            <div className="px-5 py-4 border-b"><h3 className="font-semibold text-gray-900">Account</h3></div>
            {data.account ? (
              <div className="px-5 py-4 grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2 text-sm">
                <div><p className="text-xs text-gray-400">Username</p><p className="text-gray-900">{data.account.username}</p></div>
                <div><p className="text-xs text-gray-400">Email</p><p className="text-gray-900 truncate">{data.account.email || '—'}</p></div>
                <div><p className="text-xs text-gray-400">Status</p>{statusBadge(data.account.registrationStatus)}</div>
                <div><p className="text-xs text-gray-400">User ID</p><code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{data.account.userId}</code></div>
                <div><p className="text-xs text-gray-400">Active sessions</p><p className="text-gray-900">{data.account.activeSessionCount}</p></div>
                <div><p className="text-xs text-gray-400">Created</p><p className="text-gray-900">{data.account.createdAt ? new Date(data.account.createdAt).toLocaleString() : '—'}</p></div>
              </div>
            ) : <p className="p-5 text-sm text-red-500">No user account found (device record is orphaned).</p>}
          </div>

          {/* Devices */}
          <div className="bg-white rounded-xl shadow-sm border">
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Devices &amp; Push Tokens</h3>
              {data.deviceRecord && <span className="text-xs text-gray-400">Record updated: {data.deviceRecord.lastUpdated ? new Date(data.deviceRecord.lastUpdated).toLocaleString() : '—'}</span>}
            </div>
            {!data.deviceRecord || data.deviceRecord.devices.length === 0 ? (
              <p className="p-8 text-center text-gray-400 text-sm">No devices registered</p>
            ) : (
              <div className="divide-y">
                {data.deviceRecord.devices.map((d) => {
                  const pr = pushResults[d.deviceUUID];
                  return (
                    <div key={d.deviceUUID} className="px-5 py-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-gray-900 font-medium">
                            {d.customName || d.deviceModel || 'Unknown'} ({d.devicePlatform || '?'})
                            {' '}{statusBadge(d.status)}
                            {d.isPrimary && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full ml-1">Primary</span>}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">UUID: <code className="bg-gray-100 px-1 py-0.5 rounded">{d.deviceUUID}</code></p>
                          <p className="text-xs text-gray-500 mt-1">
                            FCM token: {d.fcmToken.present
                              ? <React.Fragment><code className="bg-gray-100 px-1 py-0.5 rounded">{d.fcmToken.preview}</code> · {d.fcmToken.length} chars · sha256 <code className="bg-gray-100 px-1 py-0.5 rounded">{d.fcmToken.sha256}</code></React.Fragment>
                              : <span className="text-red-500 font-medium">missing</span>}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            Biometric secret: {d.hasBiometricSecret ? 'stored' : 'missing'} · Last used: {d.lastUsed ? new Date(d.lastUsed).toLocaleString() : 'never'} · Updated: {d.lastUpdated ? new Date(d.lastUpdated).toLocaleString() : '—'}
                          </p>
                          {pr && (
                            <div className={\`mt-2 text-xs rounded-lg px-3 py-2 border \${pr.success ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-700'}\`}>
                              <span className="font-semibold">{pr.success ? '✓ Sent' : '✗ ' + (pr.fcmErrorCode || pr.result)}</span> — {pr.message}
                            </div>
                          )}
                        </div>
                        <button onClick={() => testPush(data.deviceRecord.userId, d.deviceUUID)} disabled={pushing === d.deviceUUID || !d.fcmToken.present}
                          className="shrink-0 text-blue-600 hover:text-blue-800 disabled:text-gray-300 text-xs font-medium px-3 py-1 rounded border border-blue-200 hover:bg-blue-50">
                          {pushing === d.deviceUUID ? <span className="spinner" /> : 'Send test push'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recent notifications */}
          <div className="bg-white rounded-xl shadow-sm border">
            <div className="px-5 py-4 border-b"><h3 className="font-semibold text-gray-900">Recent Notifications</h3></div>
            {data.notifications.length === 0 ? (
              <p className="p-8 text-center text-gray-400 text-sm">No notification history</p>
            ) : (
              <div className="divide-y">
                {data.notifications.map((n) => (
                  <div key={n.notificationId} className="px-5 py-2.5 flex items-center justify-between gap-4 hover:bg-gray-50">
                    <div className="min-w-0">
                      <p className="text-sm text-gray-900 truncate">{n.title}</p>
                      <p className="text-xs text-gray-400">{new Date(n.createdAt).toLocaleString()}{n.clientId ? \` · \${n.clientId}\` : ''}</p>
                    </div>
                    {statusBadge(n.status)}
                  </div>
                ))}
              </div>
            )}
          </div>
        </React.Fragment>
      )}
    </div>
  );
};

// ─── Dashboard ─────────────────────────────────────────────────
const TABS = [
  { id: 'keys', label: 'API Keys', icon: '🔑' },
  { id: 'duo', label: 'Duo', icon: '🔐' },
  { id: 'users', label: 'Users', icon: '👤' },
  { id: 'devices', label: 'Devices', icon: '📱' },
  { id: 'emails', label: 'Emails', icon: '📧' },
  { id: 'diagnostics', label: 'Diagnostics', icon: '🩺' }
];

const Dashboard = ({ adminId, onLogout }) => {
  const [tab, setTab] = useState('keys');
  const [toastData, setToastData] = useState(null);
  const toast = (msg, type) => setToastData({ msg, type });

  // Wrap toast to auto-logout on session expiry
  const toastWithSessionCheck = (msg, type, err) => {
    if (err && (err.status === 401 || err.status === 403)) {
      toast('Session expired. Please sign in again.', 'warning');
      setTimeout(() => onLogout(), 1500);
      return;
    }
    toast(msg, type);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {toastData && <Toast {...toastData} onClose={() => setToastData(null)} />}
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold text-gray-900">Admin</span>
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{adminId}</span>
          </div>
          <button onClick={onLogout} className="text-sm text-gray-500 hover:text-red-600">Sign out</button>
        </div>
      </header>
      {/* Tabs */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-6">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg mb-6 w-fit">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={\`px-4 py-2 text-sm rounded-md font-medium transition-colors \${tab === t.id ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}\`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
        {tab === 'keys' && <ApiKeysTab toast={toast} toastErr={toastWithSessionCheck} />}
        {tab === 'duo' && <DuoTab toast={toast} toastErr={toastWithSessionCheck} />}
        {tab === 'users' && <UsersTab toast={toast} toastErr={toastWithSessionCheck} />}
        {tab === 'devices' && <DevicesTab toast={toast} toastErr={toastWithSessionCheck} />}
        {tab === 'emails' && <EmailsTab toast={toast} toastErr={toastWithSessionCheck} />}
        {tab === 'diagnostics' && <DiagnosticsTab toast={toast} toastErr={toastWithSessionCheck} />}
      </div>
    </div>
  );
};

// ─── App Root ────────────────────────────────────────────────────
const AdminApp = () => {
  const [adminId, setAdminId] = useState(null);

  // Check existing session on mount
  useEffect(() => {
    const token = sessionStorage.getItem('adminToken');
    if (token) {
      fetch('/api/admin/verify', { headers: { 'Authorization': 'Bearer ' + token } })
        .then(r => r.json())
        .then(res => { if (res.success) setAdminId(res.username); else sessionStorage.removeItem('adminToken'); })
        .catch(() => sessionStorage.removeItem('adminToken'));
    }
  }, []);

  const handleLogout = () => {
    const token = sessionStorage.getItem('adminToken');
    if (token) fetch('/api/admin/logout', { method: 'POST', headers: { 'Authorization': 'Bearer ' + token } });
    sessionStorage.removeItem('adminToken');
    setAdminId(null);
  };

  return adminId
    ? <Dashboard adminId={adminId} onLogout={handleLogout} />
    : <LoginPage onLogin={setAdminId} />;
};

ReactDOM.createRoot(document.getElementById('admin-root')).render(<AdminApp />);
</script>
</body>
</html>`;
