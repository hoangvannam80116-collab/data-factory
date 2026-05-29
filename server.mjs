import http from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  completeCollectionRunFromTabbitPayload,
  createCollectionRun,
  createInitialDataFactoryState,
  failCollectionRun,
  getShopRules,
  markCollectionRunStarted,
  normalizeDataFactoryState,
  PLATFORM_IDENTITY_DEFAULTS,
  writeCollectionRecord
} from './src/dataFactoryModel.js';

const port = Number(process.env.DATA_FACTORY_PORT || 5180);
const stateFile = join(process.cwd(), 'data-factory-state.json');

const jsonHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json; charset=utf-8'
};

const nowText = () => new Date().toLocaleTimeString('zh-CN', {
  hour12: false,
  timeZone: 'Asia/Shanghai'
});

const demoTabbitShops = [
  {
    scanId: 'tabbit-taobao-nansu',
    platformType: 'taobao',
    detectedName: '南苏科技',
    displayName: '南苏科技',
    url: PLATFORM_IDENTITY_DEFAULTS.taobao.url,
    allowedDomains: PLATFORM_IDENTITY_DEFAULTS.taobao.allowedDomains,
    tabTitle: '千牛商家工作台',
    loginStatus: 'active'
  },
  {
    scanId: 'tabbit-pdd-demo',
    platformType: 'pdd',
    detectedName: '拼多多专卖店',
    displayName: '拼多多专卖店',
    url: PLATFORM_IDENTITY_DEFAULTS.pdd.url,
    allowedDomains: PLATFORM_IDENTITY_DEFAULTS.pdd.allowedDomains,
    tabTitle: '拼多多商家后台',
    loginStatus: 'active'
  },
  {
    scanId: 'tabbit-jd-demo',
    platformType: 'jd',
    detectedName: '京东旗舰店',
    displayName: '京东旗舰店',
    url: PLATFORM_IDENTITY_DEFAULTS.jd.url,
    allowedDomains: PLATFORM_IDENTITY_DEFAULTS.jd.allowedDomains,
    tabTitle: '京麦工作台',
    loginStatus: 'needs_attention'
  }
];

const readJsonBody = async (request) => {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
};

const readStateEnvelope = async () => {
  if (!existsSync(stateFile)) return { ok: true, state: createInitialDataFactoryState(), updatedAt: 0 };
  const envelope = JSON.parse(await readFile(stateFile, 'utf8'));
  return {
    ok: true,
    state: normalizeDataFactoryState(envelope.state || envelope),
    updatedAt: envelope.updatedAt || 0
  };
};

const writeStateEnvelope = async (state) => {
  const envelope = { ok: true, state: normalizeDataFactoryState(state), updatedAt: Date.now() };
  await writeFile(stateFile, `${JSON.stringify(envelope, null, 2)}\n`);
  return envelope;
};

const send = (response, statusCode, payload) => {
  response.writeHead(statusCode, jsonHeaders);
  response.end(JSON.stringify(payload));
};

const writeRecord = async (payload) => {
  const envelope = await readStateEnvelope();
  const result = writeCollectionRecord(envelope.state, payload);
  if (!result.ok) return result;
  const nextEnvelope = await writeStateEnvelope(result.state);
  return { ok: true, record: result.record, updatedAt: nextEnvelope.updatedAt };
};

const updateRunState = async (updater) => {
  const envelope = await readStateEnvelope();
  const result = updater(envelope.state);
  if (!result.ok) return result;
  const nextEnvelope = await writeStateEnvelope(result.state);
  return { ...result, updatedAt: nextEnvelope.updatedAt };
};

const server = http.createServer(async (request, response) => {
  if (request.method === 'OPTIONS') {
    response.writeHead(204, jsonHeaders);
    response.end();
    return;
  }

  try {
    const url = new URL(request.url, `http://${request.headers.host}`);

    if (request.method === 'GET' && url.pathname === '/health') {
      send(response, 200, { ok: true, service: 'data-factory-api' });
      return;
    }

    if (request.method === 'GET' && url.pathname === '/state') {
      send(response, 200, await readStateEnvelope());
      return;
    }

    if (request.method === 'GET' && url.pathname === '/shops') {
      const envelope = await readStateEnvelope();
      send(response, 200, { ok: true, shops: envelope.state.platforms });
      return;
    }

    const rulesMatch = url.pathname.match(/^\/shops\/([^/]+)\/rules$/);
    if (request.method === 'GET' && rulesMatch) {
      const envelope = await readStateEnvelope();
      const shopId = decodeURIComponent(rulesMatch[1]);
      send(response, 200, { ok: true, shopId, rules: getShopRules(envelope.state, shopId) });
      return;
    }

    if (request.method === 'GET' && url.pathname === '/records') {
      const envelope = await readStateEnvelope();
      const shopId = url.searchParams.get('shopId');
      const shopName = url.searchParams.get('shopName');
      const records = envelope.state.historyRecords.filter(record => (
        (!shopId || record.shopId === shopId) && (!shopName || record.platform === shopName)
      ));
      send(response, 200, { ok: true, records });
      return;
    }

    if (request.method === 'GET' && url.pathname === '/collection-runs') {
      const envelope = await readStateEnvelope();
      send(response, 200, { ok: true, runs: envelope.state.collectionRequests || [] });
      return;
    }

    if (request.method === 'GET' && url.pathname === '/runner/next') {
      const envelope = await readStateEnvelope();
      const shopId = url.searchParams.get('shopId');
      const runnableStatuses = new Set(['waiting_for_codex']);
      const run = (envelope.state.collectionRequests || []).find(item => (
        runnableStatuses.has(item.status) && (!shopId || item.shopId === shopId || item.platformId === shopId)
      ));
      send(response, 200, { ok: true, run: run || null });
      return;
    }

    if (request.method === 'GET' && url.pathname === '/runner/tabbit-shops') {
      send(response, 200, {
        ok: true,
        source: 'demo',
        scannedAt: nowText(),
        shops: demoTabbitShops
      });
      return;
    }

    if (request.method === 'PUT' && url.pathname === '/state') {
      const body = await readJsonBody(request);
      send(response, 200, await writeStateEnvelope(body.state || body));
      return;
    }

    if (request.method === 'POST' && url.pathname === '/collection-runs') {
      const body = await readJsonBody(request);
      const envelope = await readStateEnvelope();
      const result = createCollectionRun(envelope.state, body);
      if (!result.ok) {
        send(response, 400, result);
        return;
      }
      const nextEnvelope = await writeStateEnvelope(result.state);
      send(response, 200, { ok: true, run: result.run, updatedAt: nextEnvelope.updatedAt });
      return;
    }

    const runnerStartMatch = url.pathname.match(/^\/runner\/runs\/([^/]+)\/start$/);
    if (request.method === 'POST' && runnerStartMatch) {
      const body = await readJsonBody(request);
      const runId = decodeURIComponent(runnerStartMatch[1]);
      const result = await updateRunState(state => markCollectionRunStarted(state, {
        runId,
        note: body.note
      }));
      send(response, result.ok ? 200 : 400, result);
      return;
    }

    const runnerCompleteMatch = url.pathname.match(/^\/runner\/runs\/([^/]+)\/complete$/);
    if (request.method === 'POST' && runnerCompleteMatch) {
      const body = await readJsonBody(request);
      const runId = decodeURIComponent(runnerCompleteMatch[1]);
      const result = await updateRunState(state => completeCollectionRunFromTabbitPayload(state, {
        runId,
        payload: body.payload || body,
        source: body.source || 'tabbit-bridge-runner'
      }));
      send(response, result.ok ? 200 : 400, result);
      return;
    }

    const runnerFailMatch = url.pathname.match(/^\/runner\/runs\/([^/]+)\/fail$/);
    if (request.method === 'POST' && runnerFailMatch) {
      const body = await readJsonBody(request);
      const runId = decodeURIComponent(runnerFailMatch[1]);
      const result = await updateRunState(state => failCollectionRun(state, {
        runId,
        error: body.error,
        evidence: body.evidence
      }));
      send(response, result.ok ? 200 : 400, result);
      return;
    }

    if (request.method === 'POST' && url.pathname === '/write-record') {
      const result = await writeRecord(await readJsonBody(request));
      send(response, result.ok ? 200 : 400, result);
      return;
    }

    if (request.method === 'POST' && url.pathname === '/collection-records') {
      const result = await writeRecord(await readJsonBody(request));
      send(response, result.ok ? 200 : 400, result);
      return;
    }

    send(response, 404, { ok: false, error: 'not_found' });
  } catch (error) {
    send(response, 500, { ok: false, error: error.message });
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`DataFactory API listening on http://127.0.0.1:${port}`);
});
