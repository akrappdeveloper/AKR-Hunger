'use client';

/**
 * Hunger Admin AI Control Panel
 * ================================
 * Configure AI settings without paying for any API.
 * All AI is local (Ollama / llama.cpp).
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Brain, Power, Settings, Sliders, Shield,
  CheckCircle2, AlertTriangle, Save, RefreshCw,
  Eye, EyeOff, Zap, BarChart3
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';

interface AIConfig {
  enabled: boolean;
  provider: 'ollama' | 'llamacpp' | 'disabled';
  baseUrl: string;
  model: string;
  maxTokens: number;
  temperature: number;
  timeoutMs: number;
  fallbackMode: 'rule' | 'normal';
  dailyRequestLimit: number;
  allowedFeatures: {
    smart_meal: boolean;
    semantic_search: boolean;
    menu_description: boolean;
    support: boolean;
    recommendation: boolean;
    restaurant_assistant: boolean;
  };
}

const DEFAULT_CONFIG: AIConfig = {
  enabled: true,
  provider: 'ollama',
  baseUrl: 'http://localhost:11434',
  model: 'qwen',
  maxTokens: 512,
  temperature: 0.3,
  timeoutMs: 8000,
  fallbackMode: 'rule',
  dailyRequestLimit: 10000,
  allowedFeatures: {
    smart_meal: true,
    semantic_search: true,
    menu_description: true,
    support: true,
    recommendation: false,
    restaurant_assistant: true,
  },
};

const MODELS = [
  { value: 'qwen', label: 'Qwen (Recommended)', size: '~4GB', speed: 'Fast' },
  { value: 'gemma', label: 'Gemma 2B', size: '~2GB', speed: 'Very Fast' },
  { value: 'llama3', label: 'Llama 3.1 8B', size: '~8GB', speed: 'Moderate' },
  { value: 'mistral', label: 'Mistral 7B', size: '~7GB', speed: 'Moderate' },
  { value: 'phi3', label: 'Phi-3 Mini', size: '~2GB', speed: 'Very Fast' },
];

const FEATURE_LABELS: Record<string, string> = {
  smart_meal: '🔍 Smart Meal AI',
  semantic_search: '🧠 Semantic Food Search',
  menu_description: '✍️ Menu Description Generator',
  support: '💬 AI Customer Support',
  recommendation: '⭐ Personal Recommendations',
  restaurant_assistant: '📊 Restaurant AI Assistant',
};

export default function AIControlPanel() {
  const { toast } = useToast();
  const [config, setConfig] = useState<AIConfig>(DEFAULT_CONFIG);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<'ok' | 'error' | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const testConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/admin/ai-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseUrl: config.baseUrl, model: config.model }),
      });
      setTestResult(res.ok ? 'ok' : 'error');
    } catch {
      setTestResult('error');
    } finally {
      setIsTesting(false);
    }
  };

  const saveConfig = async () => {
    setIsSaving(true);
    try {
      await fetch('/api/admin/ai-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      toast({ title: 'AI Configuration Saved', description: 'Settings will take effect immediately.' });
    } catch {
      toast({ title: 'Error', description: 'Failed to save configuration.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="w-6 h-6 text-violet-400" />
            AI Control Panel
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure local AI (Ollama). No paid APIs required.
          </p>
        </div>
        <Button
          onClick={saveConfig}
          disabled={isSaving}
          className="bg-gradient-to-r from-violet-500 to-purple-600 text-white"
        >
          {isSaving ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Save
        </Button>
      </div>

      {/* Master Switch */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className={`p-5 rounded-2xl border ${
          config.enabled
            ? 'bg-violet-500/10 border-violet-500/30'
            : 'bg-muted/30 border-border'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${config.enabled ? 'bg-violet-500/20' : 'bg-muted'}`}>
              <Power className={`w-5 h-5 ${config.enabled ? 'text-violet-400' : 'text-muted-foreground'}`} />
            </div>
            <div>
              <div className="font-bold">AI Features</div>
              <div className="text-sm text-muted-foreground">
                {config.enabled ? 'AI is enabled — using local model' : 'AI disabled — pure rule-based mode'}
              </div>
            </div>
          </div>
          <Switch
            checked={config.enabled}
            onCheckedChange={v => setConfig(c => ({ ...c, enabled: v }))}
          />
        </div>

        {!config.enabled && (
          <div className="mt-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400">
            ⚠️ With AI disabled, all features fall back to rule-based mode. App continues working normally.
          </div>
        )}
      </motion.div>

      {/* Provider & Model */}
      <div className="p-5 rounded-2xl border border-border bg-card space-y-4">
        <h2 className="font-bold flex items-center gap-2">
          <Settings className="w-4 h-4 text-muted-foreground" /> Model Configuration
        </h2>

        <div>
          <label className="text-sm font-medium mb-2 block">Provider</label>
          <div className="grid grid-cols-3 gap-2">
            {(['ollama', 'llamacpp', 'disabled'] as const).map(p => (
              <button
                key={p}
                onClick={() => setConfig(c => ({ ...c, provider: p }))}
                className={`py-2 px-3 rounded-xl border text-sm font-medium transition-all ${
                  config.provider === p
                    ? 'bg-violet-500/20 border-violet-500/40 text-violet-400'
                    : 'border-border text-muted-foreground hover:border-border/80'
                }`}
              >
                {p === 'ollama' ? '🦙 Ollama' : p === 'llamacpp' ? '⚡ llama.cpp' : '🚫 Disabled'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">Base URL</label>
          <Input
            value={config.baseUrl}
            onChange={e => setConfig(c => ({ ...c, baseUrl: e.target.value }))}
            placeholder="http://localhost:11434"
            className="font-mono text-sm"
          />
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">Model</label>
          <div className="space-y-2">
            {MODELS.map(m => (
              <button
                key={m.value}
                onClick={() => setConfig(c => ({ ...c, model: m.value }))}
                className={`w-full p-3 rounded-xl border text-left transition-all ${
                  config.model === m.value
                    ? 'bg-violet-500/15 border-violet-500/35'
                    : 'border-border hover:border-border/70'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{m.label}</span>
                  <div className="flex gap-1.5">
                    <Badge className="text-xs bg-muted text-muted-foreground">{m.size}</Badge>
                    <Badge className={`text-xs ${
                      m.speed === 'Very Fast' ? 'bg-emerald-500/20 text-emerald-400'
                      : m.speed === 'Fast' ? 'bg-blue-500/20 text-blue-400'
                      : 'bg-amber-500/20 text-amber-400'
                    }`}>{m.speed}</Badge>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Test Connection */}
        <div className="flex items-center gap-3">
          <Button
            onClick={testConnection}
            disabled={isTesting}
            variant="outline"
            size="sm"
            className="flex-1"
          >
            {isTesting ? <RefreshCw className="w-3.5 h-3.5 mr-2 animate-spin" /> : <Zap className="w-3.5 h-3.5 mr-2" />}
            Test Connection
          </Button>

          {testResult === 'ok' && (
            <div className="flex items-center gap-1 text-emerald-400 text-sm">
              <CheckCircle2 className="w-4 h-4" /> Connected
            </div>
          )}
          {testResult === 'error' && (
            <div className="flex items-center gap-1 text-red-400 text-sm">
              <AlertTriangle className="w-4 h-4" /> Not reachable
            </div>
          )}
        </div>
      </div>

      {/* Parameters */}
      <div className="p-5 rounded-2xl border border-border bg-card space-y-4">
        <h2 className="font-bold flex items-center gap-2">
          <Sliders className="w-4 h-4 text-muted-foreground" /> Parameters
        </h2>

        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'Max Tokens', key: 'maxTokens' as const, min: 64, max: 2048 },
            { label: 'Timeout (ms)', key: 'timeoutMs' as const, min: 1000, max: 30000 },
            { label: 'Daily Limit', key: 'dailyRequestLimit' as const, min: 100, max: 100000 },
          ].map(field => (
            <div key={field.key}>
              <label className="text-sm font-medium mb-1.5 block">{field.label}</label>
              <Input
                type="number"
                value={config[field.key]}
                onChange={e => setConfig(c => ({ ...c, [field.key]: parseInt(e.target.value) || field.min }))}
                min={field.min}
                max={field.max}
                className="text-sm"
              />
            </div>
          ))}

          <div>
            <label className="text-sm font-medium mb-1.5 block">Temperature (0–1)</label>
            <Input
              type="number"
              value={config.temperature}
              onChange={e => setConfig(c => ({ ...c, temperature: parseFloat(e.target.value) || 0.3 }))}
              min={0}
              max={1}
              step={0.1}
              className="text-sm"
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block">Fallback Mode</label>
          <div className="grid grid-cols-2 gap-2">
            {(['rule', 'normal'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setConfig(c => ({ ...c, fallbackMode: mode }))}
                className={`py-2.5 px-4 rounded-xl border text-sm font-medium transition-all ${
                  config.fallbackMode === mode
                    ? 'bg-blue-500/20 border-blue-500/40 text-blue-400'
                    : 'border-border text-muted-foreground'
                }`}
              >
                {mode === 'rule' ? '⚡ Rule-Based' : '🔇 Silent Normal'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Feature Toggles */}
      <div className="p-5 rounded-2xl border border-border bg-card space-y-3">
        <h2 className="font-bold flex items-center gap-2">
          <Shield className="w-4 h-4 text-muted-foreground" /> Allowed AI Features
        </h2>

        {Object.entries(config.allowedFeatures).map(([key, enabled]) => (
          <div key={key} className="flex items-center justify-between py-1">
            <span className="text-sm">{FEATURE_LABELS[key] || key}</span>
            <Switch
              checked={enabled}
              onCheckedChange={v => setConfig(c => ({
                ...c,
                allowedFeatures: { ...c.allowedFeatures, [key]: v },
              }))}
            />
          </div>
        ))}
      </div>

      {/* Security Notice */}
      <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-sm text-amber-400">Security Reminders</div>
            <ul className="text-xs text-muted-foreground mt-2 space-y-1">
              <li>• AI model is never exposed directly to users</li>
              <li>• All requests pass through authenticated backend</li>
              <li>• Passwords, cards, OTPs are never sent to AI</li>
              <li>• AI cannot modify prices, payments, or refunds</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
