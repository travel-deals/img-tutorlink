/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Upload, 
  Settings as SettingsIcon, 
  Image as ImageIcon, 
  Copy, 
  Check, 
  Trash2, 
  ExternalLink,
  Github,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface GithubConfig {
  token: string;
  owner: string;
  repo: string;
  path: string;
}

interface RepoFile {
  name: string;
  path: string;
  sha: string;
  download_url: string;
  type: string;
}

export default function App() {
  const [config, setConfig] = useState<GithubConfig>(() => {
    const saved = localStorage.getItem('gitsnap_config');
    return saved ? JSON.parse(saved) : { token: '', owner: '', repo: '', path: 'images' };
  });

  const [isConfigOpen, setIsConfigOpen] = useState(!config.token);
  const [files, setFiles] = useState<RepoFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  const saveConfig = (newConfig: GithubConfig) => {
    setConfig(newConfig);
    localStorage.setItem('gitsnap_config', JSON.stringify(newConfig));
    setIsConfigOpen(false);
    fetchFiles(newConfig);
  };

  const fetchFiles = useCallback(async (currentConfig: GithubConfig) => {
    if (!currentConfig.token || !currentConfig.owner || !currentConfig.repo) return;
    
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `https://api.github.com/repos/${currentConfig.owner}/${currentConfig.repo}/contents/${currentConfig.path}`,
        {
          headers: {
            Authorization: `token ${currentConfig.token}`,
            Accept: 'application/vnd.github.v3+json',
          },
        }
      );

      if (response.status === 404) {
        setFiles([]); // Path doesn't exist yet, which is fine
      } else if (!response.ok) {
        throw new Error('Failed to fetch repository contents. Check your settings.');
      } else {
        const data = await response.json();
        const imageFiles = Array.isArray(data) 
          ? data.filter(f => f.type === 'file' && /\.(jpg|jpeg|png|gif|svg|webp)$/i.test(f.name))
          : [];
        setFiles(imageFiles.reverse());
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFiles(config);
  }, [fetchFiles]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!config.token) {
      setIsConfigOpen(true);
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
      });
      reader.readAsDataURL(file);
      const content = await base64Promise;

      const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
      const filePath = config.path ? `${config.path}/${fileName}` : fileName;

      const response = await fetch(
        `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${filePath}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `token ${config.token}`,
            Accept: 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: `Upload image: ${fileName}`,
            content: content,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to upload image');
      }

      fetchFiles(config);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const deleteFile = async (file: RepoFile) => {
    if (!window.confirm(`Delete ${file.name}?`)) return;

    try {
      const response = await fetch(
        `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${file.path}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `token ${config.token}`,
            Accept: 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: `Delete image: ${file.name}`,
            sha: file.sha,
          }),
        }
      );

      if (!response.ok) throw new Error('Failed to delete file');
      fetchFiles(config);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const copyToClipboard = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedPath(url);
    setTimeout(() => setCopiedPath(null), 2000);
  };

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 font-sans">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-zinc-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center text-white">
            <ImageIcon size={24} />
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-tight">GitSnap</h1>
            <p className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Static Image Host</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsConfigOpen(!isConfigOpen)}
            className="p-2 hover:bg-zinc-100 rounded-full transition-colors relative group"
            title="Settings"
          >
            <SettingsIcon size={20} className="text-zinc-600" />
            {!config.token && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 border-2 border-white rounded-full animate-pulse" />
            )}
          </button>
          <a 
            href="https://github.com/settings/tokens" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white rounded-full text-sm font-medium hover:bg-zinc-800 transition-all shadow-sm"
          >
            <Github size={16} />
            <span className="hidden sm:inline">Get Token</span>
          </a>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6 space-y-8">
        {/* Config Modal Overlay */}
        <AnimatePresence>
          {isConfigOpen && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-zinc-900/40 backdrop-blur-sm"
            >
              <motion.div 
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
              >
                <div className="p-8 space-y-6">
                  <div className="space-y-2">
                    <h2 className="text-2xl font-bold tracking-tight">Setup Backend</h2>
                    <p className="text-zinc-500 text-sm">Connect your GitHub repository to store images.</p>
                  </div>

                  <form 
                    onSubmit={(e) => {
                      e.preventDefault();
                      const formData = new FormData(e.currentTarget);
                      saveConfig({
                        token: formData.get('token') as string,
                        owner: formData.get('owner') as string,
                        repo: formData.get('repo') as string,
                        path: formData.get('path') as string,
                      });
                    }}
                    className="space-y-4"
                  >
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest px-1">Personal Access Token</label>
                      <input 
                        name="token" 
                        type="password"
                        required
                        defaultValue={config.token}
                        placeholder="ghp_xxxxxxxxxxxx"
                        className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900 focus:border-transparent outline-none transition-all font-mono text-sm"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest px-1">Owner</label>
                        <input 
                          name="owner" 
                          required
                          defaultValue={config.owner}
                          placeholder="username"
                          className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900 focus:border-transparent outline-none transition-all text-sm"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest px-1">Repo</label>
                        <input 
                          name="repo" 
                          required
                          defaultValue={config.repo}
                          placeholder="my-images"
                          className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900 focus:border-transparent outline-none transition-all text-sm"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest px-1">Storage Path</label>
                      <input 
                        name="path" 
                        defaultValue={config.path}
                        placeholder="images"
                        className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900 focus:border-transparent outline-none transition-all text-sm"
                      />
                    </div>
                    <div className="pt-4 flex gap-3">
                      <button 
                        type="submit"
                        className="flex-1 bg-zinc-900 text-white py-3 rounded-xl font-bold hover:bg-zinc-800 transition-all shadow-lg shadow-zinc-200"
                      >
                        Save Configuration
                      </button>
                      {config.token && (
                        <button 
                          type="button"
                          onClick={() => setIsConfigOpen(false)}
                          className="px-6 py-3 border border-zinc-200 rounded-xl font-bold hover:bg-zinc-50 transition-all"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </form>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Upload Section */}
        <section className="relative">
          <label className={`
            relative flex flex-col items-center justify-center w-full h-64 
            border-2 border-dashed rounded-3xl cursor-pointer transition-all
            ${isUploading ? 'bg-zinc-100 border-zinc-300' : 'bg-white border-zinc-200 hover:border-zinc-400 hover:bg-zinc-50'}
          `}>
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              {isUploading ? (
                <Loader2 className="w-12 h-12 mb-4 text-zinc-400 animate-spin" />
              ) : (
                <Upload className="w-12 h-12 mb-4 text-zinc-400" />
              )}
              <p className="mb-2 text-sm text-zinc-500 font-medium">
                <span className="font-bold text-zinc-900">Click to upload</span> or drag and drop
              </p>
              <p className="text-xs text-zinc-400 uppercase tracking-widest font-bold">SVG, PNG, JPG or GIF</p>
            </div>
            <input 
              type="file" 
              className="hidden" 
              accept="image/*" 
              onChange={handleFileUpload}
              disabled={isUploading}
            />
          </label>
          
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-sm font-medium"
            >
              <AlertCircle size={18} />
              {error}
            </motion.div>
          )}
        </section>

        {/* Gallery Section */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
              Recent Uploads
              {isLoading && <Loader2 size={16} className="animate-spin text-zinc-400" />}
            </h2>
            <p className="text-sm text-zinc-500 font-medium">{files.length} images stored</p>
          </div>

          {!config.token ? (
            <div className="text-center py-20 bg-white rounded-3xl border border-zinc-200">
              <ImageIcon className="mx-auto w-12 h-12 text-zinc-200 mb-4" />
              <p className="text-zinc-500 font-medium">Configure your GitHub repo to see images</p>
              <button 
                onClick={() => setIsConfigOpen(true)}
                className="mt-4 text-zinc-900 font-bold underline underline-offset-4"
              >
                Open Settings
              </button>
            </div>
          ) : files.length === 0 && !isLoading ? (
            <div className="text-center py-20 bg-white rounded-3xl border border-zinc-200">
              <ImageIcon className="mx-auto w-12 h-12 text-zinc-200 mb-4" />
              <p className="text-zinc-500 font-medium">No images found in {config.path || 'root'}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <AnimatePresence mode="popLayout">
                {files.map((file) => (
                  <motion.div
                    key={file.sha}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="group bg-white rounded-3xl border border-zinc-200 overflow-hidden shadow-sm hover:shadow-xl hover:shadow-zinc-200/50 transition-all"
                  >
                    <div className="aspect-video relative bg-zinc-100 overflow-hidden">
                      <img 
                        src={file.download_url} 
                        alt={file.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <button 
                          onClick={() => copyToClipboard(file.download_url)}
                          className="p-3 bg-white rounded-2xl hover:bg-zinc-100 transition-colors shadow-lg"
                          title="Copy URL"
                        >
                          {copiedPath === file.download_url ? <Check size={20} className="text-emerald-600" /> : <Copy size={20} />}
                        </button>
                        <a 
                          href={file.download_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="p-3 bg-white rounded-2xl hover:bg-zinc-100 transition-colors shadow-lg"
                          title="Open Original"
                        >
                          <ExternalLink size={20} />
                        </a>
                        <button 
                          onClick={() => deleteFile(file)}
                          className="p-3 bg-white rounded-2xl hover:bg-red-50 hover:text-red-600 transition-colors shadow-lg"
                          title="Delete"
                        >
                          <Trash2 size={20} />
                        </button>
                      </div>
                    </div>
                    <div className="p-4 space-y-2">
                      <p className="text-sm font-bold truncate text-zinc-900" title={file.name}>
                        {file.name}
                      </p>
                      <div className="flex items-center justify-between gap-2">
                        <code className="text-[10px] font-mono bg-zinc-100 px-2 py-1 rounded-lg text-zinc-500 truncate flex-1">
                          {file.download_url}
                        </code>
                        <button 
                          onClick={() => copyToClipboard(file.download_url)}
                          className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 hover:text-zinc-900 transition-colors shrink-0"
                        >
                          {copiedPath === file.download_url ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </section>
      </main>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto p-6 border-t border-zinc-200 mt-12 flex flex-col sm:flex-row items-center justify-between gap-4 text-zinc-400 text-xs font-medium uppercase tracking-widest">
        <p>© {new Date().getFullYear()} GitSnap • Powered by GitHub API</p>
        <div className="flex gap-6">
          <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-900 transition-colors">Generate Token</a>
          <a href="#" className="hover:text-zinc-900 transition-colors">Documentation</a>
        </div>
      </footer>
    </div>
  );
}
