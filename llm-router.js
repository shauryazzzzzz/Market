'use strict';
/**
 * IBM LLM Priority Router — llm-router.js
 * ─────────────────────────────────────────────────────────────────────────────
 * PRIORITY RULE (applies to ALL projects in this workspace):
 *   Tier 1 → IBM watsonx.ai (direct REST — 8 models confirmed live)
 *   Tier 2 → IBM ICA direct chat API (WXO_API_KEY — 7 models)
 *   Tier 3 → Google Gemini (ABSOLUTE LAST RESORT — personal paid key)
 *
 * All keys must be supplied via environment variables or a .env file.
 * See .env.example for required variable names.
 */

require('dotenv').config();

// ── Config (all keys from environment — never hardcoded) ──────────────────────
const WATSONX_KEY     = process.env.WATSONX_API_KEY    || '';
const WATSONX_PROJECT = process.env.WATSONX_PROJECT_ID || '';
const WATSONX_REGION  = process.env.WATSONX_REGION     || 'us-south';
const WATSONX_VERSION = '2024-09-16';

const ICA_BASE_URL    = process.env.WXO_BASE_URL       || 'https://nextgen-beta.ica.ibm.com';
const ICA_API_KEY     = process.env.WXO_API_KEY        || '';

const GEMINI_KEY      = process.env.GEMINI_API_KEY     || '';
const GEMINI_MODEL    = process.env.GEMINI_MODEL       || 'gemini-2.0-flash';

// ── Tier 1: IBM watsonx.ai — confirmed live models (ordered best → fastest) ────
const WATSONX_MODELS = [
  'meta-llama/llama-4-maverick-17b-128e-instruct-fp8', // Llama 4 MoE — most capable
  'openai/gpt-oss-120b',                                // 120B open-weights
  'meta-llama/llama-3-3-70b-instruct',                  // Llama 3.3 70B
  'mistral-large-2512',                                  // Mistral Large
  'mistralai/mistral-medium-2505',                       // Mistral Medium
  'mistralai/mistral-small-3-1-24b-instruct-2503',       // Mistral Small 24B
  'ibm/granite-4-h-small',                              // IBM Granite 4
  'meta-llama/llama-3-1-8b',                            // Llama 3.1 8B — fastest
];

// ── Tier 2: ICA direct API model IDs (from env.template + ComX .env.local) ────
// ICA uses numeric model IDs via POST /ica/services/apis/v1/message
const ICA_MODELS = [
  { id: process.env.ICA_LLAMA4_MAVERICK_MODEL  || '750',  name: 'ICA:llama4-maverick' },
  { id: process.env.ICA_LLAMA33_70B_MODEL      || '749',  name: 'ICA:llama3.3-70b' },
  { id: process.env.ICA_GRANITE4_SMALL_MODEL   || '1011', name: 'ICA:granite4-small' },
  { id: process.env.ICA_GRANITE33_8B_MODEL     || '1008', name: 'ICA:granite3.3-8b' },
  { id: process.env.ICA_NEMOTRON_SUPER_MODEL   || '900',  name: 'ICA:nemotron-super' },
  { id: process.env.ICA_MISTRAL_MEDIUM_MODEL   || '700',  name: 'ICA:mistral-medium' },
  { id: process.env.ICA_NEMOTRON_NANO_MODEL    || '901',  name: 'ICA:nemotron-nano' },
];

// ── IAM token cache ─────────────────────────────────────────────────────────────
let _iamCache = { token: null, expiresAt: 0 };

async function getIAMToken() {
  if (_iamCache.token && Date.now() < _iamCache.expiresAt) return _iamCache.token;
  const resp = await fetch('https://iam.cloud.ibm.com/identity/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ibm:params:oauth:grant-type:apikey&apikey=${WATSONX_KEY}`
  });
  if (!resp.ok) throw new Error(`IAM token error ${resp.status}`);
  const data = await resp.json();
  _iamCache = { token: data.access_token, expiresAt: Date.now() + 55 * 60 * 1000 };
  return _iamCache.token;
}

// ── Tier 1: watsonx.ai call ─────────────────────────────────────────────────────
async function watsonxChat(messages, modelId, opts = {}) {
  const token = await getIAMToken();
  const resp = await fetch(
    `https://${WATSONX_REGION}.ml.cloud.ibm.com/ml/v1/text/chat?version=${WATSONX_VERSION}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        model: modelId,
        messages,
        max_tokens: opts.maxTokens || 1024,
        temperature: opts.temperature ?? 0.3,
        project_id: WATSONX_PROJECT
      })
    }
  );
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.errors?.[0]?.message || `watsonx HTTP ${resp.status}`);
  }
  const data = await resp.json();
  return { text: data.choices?.[0]?.message?.content ?? '', model: modelId, provider: 'watsonx', usage: data.usage };
}

// ── Tier 2: ICA direct API call ─────────────────────────────────────────────────
async function icaChat(messages, modelEntry, opts = {}) {
  // ICA chat endpoint — OpenAI-compatible via /ica/services/apis/v1/message
  const resp = await fetch(`${ICA_BASE_URL}/ica/services/apis/v1/message`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ICA_API_KEY
    },
    body: JSON.stringify({
      model: modelEntry.id,
      messages,
      max_tokens: opts.maxTokens || 1024,
      temperature: opts.temperature ?? 0.3
    })
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.message || err.error || `ICA HTTP ${resp.status}`);
  }
  const data = await resp.json();
  // ICA may return choices[] (OpenAI-compat) or a flat response field
  const text = data.choices?.[0]?.message?.content
    ?? data.response
    ?? data.message
    ?? '';
  return { text, model: modelEntry.name, provider: 'ica', usage: data.usage || null };
}

// ── Tier 3: Google Gemini ───────────────────────────────────────────────────────
async function geminiChat(messages, opts = {}) {
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(GEMINI_KEY);
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
  const history = messages.slice(0, -1).map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));
  const lastMsg = messages[messages.length - 1].content;
  const chatSession = model.startChat({ history });
  const result = await chatSession.sendMessage(lastMsg);
  return { text: result.response.text(), model: GEMINI_MODEL, provider: 'gemini', usage: null };
}

// ── Main router ─────────────────────────────────────────────────────────────────
/**
 * chat(messages, opts)
 *
 * Tries models in order:
 *   1. watsonx.ai models (8 confirmed live, best→fastest)
 *   2. ICA direct API models (7 models, IBM-provisioned)
 *   3. Google Gemini (absolute last resort)
 *
 * @param {Array<{role:string, content:string}>} messages
 * @param {object} opts
 *   preferModel   — watsonx model ID to try first
 *   maxTokens     — default 1024
 *   temperature   — default 0.3
 *   ibmOnly       — throw instead of falling back to Gemini
 *   skipWatsonx   — skip Tier 1 (debug)
 *   skipICA       — skip Tier 2 (debug)
 */
async function chat(messages, opts = {}) {
  const errors = [];

  // ── Tier 1: watsonx.ai ──────────────────────────────────────────────────────
  if (!opts.skipWatsonx) {
    const modelsToTry = opts.preferModel
      ? [opts.preferModel, ...WATSONX_MODELS.filter(m => m !== opts.preferModel)]
      : WATSONX_MODELS;

    for (const modelId of modelsToTry) {
      try {
        const result = await watsonxChat(messages, modelId, opts);
        if (errors.length > 0) {
          console.warn(`[llm-router] watsonx: skipped ${errors.length} model(s), succeeded with ${modelId}`);
        }
        return result;
      } catch (err) {
        errors.push(`wx:${modelId}: ${err.message}`);
      }
    }
    console.warn(`[llm-router] All watsonx models failed (${errors.length}). Trying ICA...`);
  }

  // ── Tier 2: ICA direct API ──────────────────────────────────────────────────
  if (!opts.skipICA) {
    for (const modelEntry of ICA_MODELS) {
      try {
        const result = await icaChat(messages, modelEntry, opts);
        console.warn(`[llm-router] Using ICA fallback: ${modelEntry.name}`);
        return result;
      } catch (err) {
        errors.push(`ica:${modelEntry.name}: ${err.message}`);
      }
    }
    console.warn(`[llm-router] All ICA models failed. Trying Gemini as last resort...`);
  }

  // ── Tier 3: Gemini (last resort) ────────────────────────────────────────────
  if (opts.ibmOnly) {
    throw new Error(`All IBM models failed. Errors:\n${errors.join('\n')}`);
  }

  console.warn('[llm-router] LAST RESORT: using Google Gemini (paid key)');
  try {
    return await geminiChat(messages, opts);
  } catch (err) {
    errors.push(`gemini: ${err.message}`);
    throw new Error(`All LLM providers failed:\n${errors.join('\n')}`);
  }
}

/**
 * textGen(prompt, opts) — simple string-in/string-out wrapper
 */
async function textGen(prompt, opts = {}) {
  return chat([{ role: 'user', content: prompt }], opts);
}

/**
 * modelStatus() — probes all providers, returns health report
 */
async function modelStatus() {
  const probe = [{ role: 'user', content: 'Reply with one word: OK' }];
  const results = [];

  for (const modelId of WATSONX_MODELS) {
    try {
      await watsonxChat(probe, modelId, { maxTokens: 5 });
      results.push({ tier: 1, provider: 'watsonx', model: modelId, status: 'ok' });
    } catch (e) {
      results.push({ tier: 1, provider: 'watsonx', model: modelId, status: 'error', error: e.message });
    }
  }

  for (const m of ICA_MODELS) {
    try {
      await icaChat(probe, m, { maxTokens: 5 });
      results.push({ tier: 2, provider: 'ica', model: m.name, status: 'ok' });
    } catch (e) {
      results.push({ tier: 2, provider: 'ica', model: m.name, status: 'error', error: e.message });
    }
  }

  try {
    await geminiChat(probe, { maxTokens: 5 });
    results.push({ tier: 3, provider: 'gemini', model: GEMINI_MODEL, status: 'ok' });
  } catch (e) {
    results.push({ tier: 3, provider: 'gemini', model: GEMINI_MODEL, status: 'error', error: e.message });
  }

  return results;
}

module.exports = {
  chat,
  textGen,
  modelStatus,
  watsonxChat,
  icaChat,
  geminiChat,
  WATSONX_MODELS,
  ICA_MODELS
};
