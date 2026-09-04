import http from 'node:http';
import { spawn } from 'node:child_process';
import { readFile, rename, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  completeCollectionRunFromEgoPayload,
  createShop,
  createCollectionRun,
  createInitialDataFactoryState,
  failCollectionRun,
  getShopRules,
  isUrlAllowedForShop,
  markCollectionRunStarted,
  moveShopToTrash,
  normalizeDataFactoryState,
  PLATFORM_IDENTITY_DEFAULTS,
  restoreShopFromTrash,
  writeCollectionRecord
} from './src/dataFactoryModel.js';

const port = Number(process.env.DATA_FACTORY_PORT || 5181);
const stateFile = join(process.cwd(), 'data-factory-state.json');
const egoBrowserInvocation = process.platform === 'win32'
  ? { command: process.env.ComSpec || 'cmd.exe', args: ['/d', '/s', '/c', 'ego-browser nodejs'] }
  : { command: 'ego-browser', args: ['nodejs'] };

const jsonHeaders = {
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json; charset=utf-8',
  Vary: 'Origin'
};
const allowedBrowserOrigins = new Set([
  'http://127.0.0.1:5175',
  'http://localhost:5175',
  'http://127.0.0.1:4175',
  'http://localhost:4175'
]);

const nowText = () => new Date().toLocaleTimeString('zh-CN', {
  hour12: false,
  timeZone: 'Asia/Shanghai'
});

const EGO_SCAN_MARKER = '__DATA_FACTORY_EGO_SCAN__';
const EGO_BIND_MARKER = '__DATA_FACTORY_EGO_BIND__';
const EGO_COLLECTION_MARKER = '__DATA_FACTORY_EGO_COLLECTION__';

const RUNNER_ERROR_MESSAGES = {
  shop_not_verified: '店铺尚未校正，请先校正店铺。',
  ego_window_not_bound: '尚未绑定 Ego 窗口，请先校正店铺。',
  ego_window_not_verified: 'Ego 窗口与店铺不一致，请重新校正。',
  ego_binding_verification_required: 'Ego 登录或店铺校验已失效，请重新校正。',
  no_ready_rules: '没有可采集字段，请先配置字段。',
  ego_task_space_missing: '绑定的 Ego 窗口不存在，请重新校正。',
  ego_window_in_use: 'Ego 窗口正在使用中，稍后会再次同步。',
  ego_login_required: '店铺登录已失效，请在 Ego 登录后重新校正。',
  shop_name_mismatch: '当前登录的店铺不正确，已停止采集。',
  current_url_not_allowed: '当前页面不属于该店铺，已停止采集。',
  data_updated_at_required: '页面没有显示数据更新时间，未写入旧数据。',
  no_field_values_found: '没有读取到任何字段，请检查字段位置。',
  no_matching_ready_field: '返回的数据与已配置字段不匹配。',
  runner_timeout: '采集超时，请检查 Ego 页面是否正常。'
};

const getRunnerErrorCode = (error) => {
  const message = String(error?.message || error || 'runner_failed');
  const knownCode = Object.keys(RUNNER_ERROR_MESSAGES).find(code => message.includes(code));
  if (knownCode) return knownCode;
  if (/timeout/i.test(message)) return 'runner_timeout';
  return 'runner_failed';
};

const getRunnerErrorMessage = (error) => {
  const code = typeof error === 'string' && RUNNER_ERROR_MESSAGES[error] ? error : getRunnerErrorCode(error);
  return RUNNER_ERROR_MESSAGES[code] || '本次同步没有完成，请检查 Ego 窗口后重试。';
};

const inferPlatformType = ({ url = '', title = '' } = {}) => {
  let hostname = '';
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    hostname = '';
  }
  const text = `${hostname} ${title}`.toLowerCase();
  if (/(taobao|tmall|qianniu|千牛|淘宝|天猫)/i.test(text)) return 'taobao';
  if (/(pinduoduo|拼多多)/i.test(text)) return 'pdd';
  if (/(\.jd\.|jingmai|京东|京麦)/i.test(text)) return 'jd';
  return 'other';
};

const runEgoScript = (script, timeoutMs = 15000) => new Promise((resolve, reject) => {
  const child = spawn(egoBrowserInvocation.command, egoBrowserInvocation.args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: ['pipe', 'pipe', 'pipe']
  });
  let stdout = '';
  let stderr = '';
  const timer = setTimeout(() => {
    child.kill('SIGTERM');
    reject(new Error('ego_scan_timeout'));
  }, timeoutMs);
  child.stdout.on('data', chunk => { stdout += chunk.toString(); });
  child.stderr.on('data', chunk => { stderr += chunk.toString(); });
  child.on('error', error => {
    clearTimeout(timer);
    reject(error);
  });
  child.on('close', code => {
    clearTimeout(timer);
    if (code !== 0) {
      reject(new Error(stderr.trim() || `ego_browser_exit_${code}`));
      return;
    }
    resolve(`${stdout}\n${stderr}`);
  });
  child.stdin.end(script);
});

const scanEgoTaskSpaces = async (state) => {
  const output = await runEgoScript(`
const spaces = await listTaskSpaces()
const result = []
for (const space of spaces) {
  const entry = { ...space, tabs: [], requiresConnection: space.ownership !== 'agent' }
  if (space.ownership === 'agent') {
    try {
      await useOrCreateTaskSpace(space.id)
      entry.tabs = await listTabs()
    } catch (error) {
      entry.error = error.message
    }
  } else {
    entry.tabs = (space.recentTabTitles || []).map((title, index) => ({
      targetId: '', title, url: '', active: index === 0, index
    }))
  }
  result.push(entry)
}
cliLog('${EGO_SCAN_MARKER}' + JSON.stringify(result))
`);
  const markerLine = output.split(/\r?\n/).find(line => line.startsWith(EGO_SCAN_MARKER));
  if (!markerLine) throw new Error('ego_scan_result_missing');
  const spaces = JSON.parse(markerLine.slice(EGO_SCAN_MARKER.length));
  const shops = [];

  for (const space of spaces) {
    for (const tab of space.tabs || []) {
      const platformType = inferPlatformType(tab);
      if (platformType === 'other') continue;
      const candidates = (state.platforms || []).filter(shop => shop.platformType === platformType);
      const boundShop = candidates.find(shop => (
        (
          String(shop.egoBinding?.taskSpaceId || '') === String(space.id)
          || shop.egoBinding?.taskSpaceName === space.name
          || shop.egoBinding?.taskId === space.taskId
        )
        && (!shop.egoBinding?.targetId || !tab.targetId || shop.egoBinding.targetId === tab.targetId)
      ));
      const matchedShop = boundShop || (candidates.length === 1 ? candidates[0] : null);
      const defaults = PLATFORM_IDENTITY_DEFAULTS[platformType] || PLATFORM_IDENTITY_DEFAULTS.other;
      const bindingVerified = Boolean(
        matchedShop
        && matchedShop.egoBinding?.shopNameMatched
        && tab.url
        && !space.requiresConnection
      );
      shops.push({
        scanId: `ego-${space.id}-${tab.targetId || tab.index}`,
        platformType,
        detectedName: matchedShop?.expectedShopName || matchedShop?.detectedName || '',
        displayName: matchedShop?.name || tab.title || space.name,
        url: tab.url || matchedShop?.url || defaults.url,
        allowedDomains: matchedShop?.allowedDomains || defaults.allowedDomains,
        tabTitle: tab.title || '',
        loginStatus: bindingVerified ? 'active' : 'needs_attention',
        autoSyncTime: matchedShop?.autoSyncTime || '09:00',
        mappingStatus: matchedShop ? (space.requiresConnection ? 'window_needs_connection' : 'matched') : 'ambiguous',
        egoBinding: {
          taskSpaceId: space.id,
          taskSpaceName: space.name,
          taskId: space.taskId,
          ownership: space.ownership,
          profileId: space.profileId,
          profileName: space.profileName,
          targetId: tab.targetId || '',
          tabTitle: tab.title || '',
          tabUrl: tab.url || '',
          shopNameMatched: matchedShop?.egoBinding?.shopNameMatched === true,
          needsUserLogin: matchedShop?.egoBinding?.needsUserLogin === true
        }
      });
    }
  }

  return { spaces, shops };
};

const bindShopToEgo = async (shop, { resume = false } = {}) => {
  const platformLabel = PLATFORM_IDENTITY_DEFAULTS[shop.platformType]?.label || shop.platformType || '店铺';
  const expectedShopName = shop.expectedShopName || shop.detectedName || shop.name;
  const taskSpaceName = `DataFactory · ${platformLabel} · ${expectedShopName}`;
  const targetUrl = shop.url || PLATFORM_IDENTITY_DEFAULTS[shop.platformType]?.url;
  const existingTaskSpaceId = shop.egoBinding?.taskSpaceId || null;
  if (!targetUrl) throw new Error('shop_target_url_missing');

  const output = await runEgoScript(`
const existingTaskSpaceId = ${JSON.stringify(existingTaskSpaceId)}
const spaces = await listTaskSpaces()
const existingTaskSpace = spaces.find(space => String(space.id) === String(existingTaskSpaceId))
  || spaces.find(space => space.name === ${JSON.stringify(taskSpaceName)} || space.taskId === ${JSON.stringify(taskSpaceName)})
let task
if (existingTaskSpace) {
  if (${JSON.stringify(resume)} && existingTaskSpace.ownership === 'agentDelegatedToUser') {
    await takeOverTaskSpace(existingTaskSpace.id)
    task = await useOrCreateTaskSpace(existingTaskSpace.id)
  } else if (existingTaskSpace.ownership === 'agent') {
    task = await useOrCreateTaskSpace(existingTaskSpace.id)
  } else if (existingTaskSpace.ownership === 'agentDelegatedToUser' || existingTaskSpace.ownership === 'user') {
    throw new Error('user is controlling the Ego task space; wait for explicit continue')
  } else {
    task = await claimTaskSpace(existingTaskSpace.id)
  }
} else {
  task = await useOrCreateTaskSpace(${JSON.stringify(taskSpaceName)})
}
await openOrReuseTab(${JSON.stringify(targetUrl)}, { wait: true, timeout: 20 })
const tabs = await listTabs()
const current = tabs.find(tab => tab.active) || tabs[tabs.length - 1] || null
let page = null
let shopNameMatched = false
let detectedShopName = ''
let identityEvidence = null
let loginRequired = false
try {
  page = await pageInfo()
  const text = await snapshotText()
  const bodyText = await js(String.raw\`document.body?.innerText || ''\`)
  const visibleText = \`${'${text}'}\n${'${bodyText || \'\'}'}\`
  const expectedIdentity = ${JSON.stringify(expectedShopName)}
  const identityCandidates = await js(String.raw\`(() => {
    const normalize = value => String(value || '').replace(/\\s+/g, ' ').trim()
    const isVisible = element => {
      const style = getComputedStyle(element)
      const rect = element.getBoundingClientRect()
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0
    }
    const selectors = [
      '[data-testid="shop-name"]', '[data-testid*="shop"][data-testid*="name"]',
      '[class*="shopName"]', '[class*="shop-name"]', '[class*="sellerName"]',
      '[class*="seller-name"]', '[class*="nickName"]', '[class*="nickname"]',
      '[class*="account-name"]'
    ]
    const results = []
    const add = (element, source) => {
      if (!element || !isVisible(element)) return
      const value = normalize(element.getAttribute('data-shop-name') || element.getAttribute('title') || element.getAttribute('aria-label') || element.textContent)
        .replace(/^(?:当前)?店铺(?:名称)?[：:]?\\s*/, '')
      if (!value || value.length < 2 || value.length > 80) return
      results.push({ value, source, tag: element.tagName, className: String(element.className || '').slice(0, 160) })
    }
    for (const selector of selectors) {
      for (const element of document.querySelectorAll(selector)) add(element, selector)
    }
    for (const element of document.querySelectorAll('body *')) {
      if (element.children.length > 0 || !isVisible(element)) continue
      const rect = element.getBoundingClientRect()
      const value = normalize(element.textContent)
      if (rect.top >= 0 && rect.top <= 260 && value.length >= 2 && value.length <= 40) add(element, 'top-identity-region')
    }
    return results
  })()\`)
  const normalizeIdentity = value => String(value || '').replace(/\\s+/g, '').trim()
  const exactIdentity = (identityCandidates || []).find(candidate => normalizeIdentity(candidate.value) === normalizeIdentity(expectedIdentity))
  const strongIdentity = (identityCandidates || []).find(candidate => candidate.source !== 'top-identity-region')
  detectedShopName = exactIdentity?.value || strongIdentity?.value || ''
  identityEvidence = exactIdentity || strongIdentity || null
  shopNameMatched = Boolean(expectedIdentity && detectedShopName && normalizeIdentity(detectedShopName) === normalizeIdentity(expectedIdentity))
  loginRequired = /(?:login|signin|passport)/i.test(page?.url || current?.url || '')
    || (!shopNameMatched && /(?:扫码登录|密码登录|账号登录|账户登录|请先登录|登录授权)/.test(visibleText))
} catch (error) {
  page = { error: error.message }
  loginRequired = true
}
let handedOff = false
if (!shopNameMatched) {
  const handoff = await handOffTaskSpace(task.id)
  handedOff = handoff.done === true
}
cliLog('${EGO_BIND_MARKER}' + JSON.stringify({ task, current, page, detectedShopName, identityEvidence, shopNameMatched, loginRequired, handedOff }))
`, 30000);
  const markerLine = output.split(/\r?\n/).find(line => line.includes(EGO_BIND_MARKER));
  if (!markerLine) throw new Error('ego_bind_result_missing');
  return JSON.parse(markerLine.slice(markerLine.indexOf(EGO_BIND_MARKER) + EGO_BIND_MARKER.length));
};

const snapshotTextTokens = (snapshot = '') => snapshot.split(/\r?\n/).flatMap(line => {
  const markerIndex = line.indexOf('text ');
  if (markerIndex === -1) return [];
  const literal = line.slice(markerIndex + 5).trim();
  if (!literal.startsWith('"')) return [];
  try {
    return [JSON.parse(literal)];
  } catch {
    return [];
  }
});

const extractCollectionPayload = ({ snapshot, page, shop, rules }) => {
  const tokens = snapshotTextTokens(snapshot);
  const storeDataIndex = tokens.findIndex(token => token.trim() === '店铺数据');
  const scopedTokens = storeDataIndex >= 0 ? tokens.slice(storeDataIndex) : tokens;
  const nextSectionIndex = scopedTokens.findIndex((token, index) => index > 0 && token.trim() === '经营建议');
  const dataTokens = nextSectionIndex > 0 ? scopedTokens.slice(0, nextSectionIndex) : scopedTokens;
  const expectedShopName = shop.expectedShopName || shop.detectedName || shop.name;
  const currentUrl = page?.url || '';
  const detectedShopName = expectedShopName
    ? (tokens.find(token => token.trim() === expectedShopName)?.trim() || '')
    : '';
  const snapshotHasShop = Boolean(detectedShopName);
  if (/login|signin|passport/i.test(currentUrl)) throw new Error('ego_login_required');
  if (!snapshotHasShop) throw new Error('shop_name_mismatch');
  if (!isUrlAllowedForShop(shop, currentUrl)) throw new Error('current_url_not_allowed');

  let dataUpdatedAt = '';
  const updateLabelIndex = dataTokens.findIndex(token => /数据更新时间/.test(token));
  if (updateLabelIndex >= 0) {
    const inlineMatch = dataTokens[updateLabelIndex].match(/(20\d{2}[-/]\d{1,2}[-/]\d{1,2}\s+\d{1,2}:\d{2}(?::\d{2})?)/);
    dataUpdatedAt = inlineMatch?.[1] || dataTokens.slice(updateLabelIndex + 1, updateLabelIndex + 4).find(token => /20\d{2}[-/]\d{1,2}[-/]\d{1,2}/.test(token)) || '';
  }
  if (!dataUpdatedAt) throw new Error('data_updated_at_required');

  const fieldNames = new Set(rules.map(rule => rule.fieldName));
  const fields = rules.map(rule => {
    const labelIndex = dataTokens.findIndex(token => token.trim() === rule.fieldName);
    if (labelIndex === -1) {
      return { fieldName: rule.fieldName, value: '', status: 'error', evidence: '页面中未找到字段标题', confidence: 0 };
    }
    const candidates = [];
    for (let index = labelIndex + 1; index < Math.min(dataTokens.length, labelIndex + 10); index += 1) {
      const value = dataTokens[index].trim();
      if (!value || value === '昨日' || fieldNames.has(value)) break;
      if (/^[\uE000-\uF8FF]+$/.test(value)) continue;
      candidates.push(value);
    }
    const currentParts = candidates;
    const numericParts = [];
    for (const part of currentParts) {
      if (/^(?:[¥￥$]|%|[+-]?[\d,.]+%?)$/.test(part)) numericParts.push(part);
      else break;
    }
    const value = numericParts.join('');
    return value
      ? { fieldName: rule.fieldName, value, status: 'success', evidence: `刷新后在「店铺数据」读取，更新时间 ${dataUpdatedAt}`, confidence: 96 }
      : { fieldName: rule.fieldName, value: '', status: 'error', evidence: '字段标题存在，但未读取到当前主数值', confidence: 0 };
  });
  if (!fields.some(field => field.status === 'success')) throw new Error('no_field_values_found');

  return {
    shopCalibration: {
      expectedShopName,
      detectedShopName,
      status: 'verified'
    },
    currentUrl,
    fields,
    blockers: fields.filter(field => field.status === 'error').map(field => field.fieldName),
    dataUpdatedAt,
    evidence: `Ego lite 已在本次任务中刷新页面，校正店铺「${expectedShopName}」，读取页面数据更新时间 ${dataUpdatedAt}。`
  };
};

const collectRunWithEgo = async ({ run, shop }) => {
  const taskSpaceId = shop.egoBinding?.taskSpaceId;
  if (!taskSpaceId) throw new Error('ego_window_not_bound');
  const taskSpaceName = shop.egoBinding?.taskSpaceName || shop.egoBinding?.taskId;
  const targetUrl = shop.url;
  const targetId = shop.egoBinding?.targetId || '';
  const output = await runEgoScript(`
const spaces = await listTaskSpaces()
const taskInfo = spaces.find(space => (
  String(space.id) === String(${JSON.stringify(taskSpaceId)})
  && (!${JSON.stringify(taskSpaceName)} || space.name === ${JSON.stringify(taskSpaceName)} || space.taskId === ${JSON.stringify(taskSpaceName)})
)) || spaces.find(space => (
  ${JSON.stringify(taskSpaceName)}
  && (space.name === ${JSON.stringify(taskSpaceName)} || space.taskId === ${JSON.stringify(taskSpaceName)})
))
if (!taskInfo) throw new Error('ego_task_space_missing')
if (taskInfo.ownership !== 'agent') throw new Error('ego_window_in_use')
await useOrCreateTaskSpace(taskInfo.id)
const tabs = await listTabs()
const preferredTab = tabs.find(tab => tab.targetId === ${JSON.stringify(targetId)}) || tabs.find(tab => (tab.url || '').startsWith(${JSON.stringify(targetUrl)})) || tabs[0]
if (preferredTab) await switchTab(preferredTab.targetId)
await openOrReuseTab(${JSON.stringify(targetUrl)}, { wait: true, timeout: 25 })
await gotoAndWait(${JSON.stringify(targetUrl)}, { timeout: 25, settle: 2 })
await wait(2)
const page = await pageInfo()
const snapshot = await snapshotText()
cliLog('${EGO_COLLECTION_MARKER}' + JSON.stringify({ page, snapshot }))
`, 45000);
  const markerLine = output.split(/\r?\n/).find(line => line.includes(EGO_COLLECTION_MARKER));
  if (!markerLine) throw new Error('ego_collection_result_missing');
  const rawResult = JSON.parse(markerLine.slice(markerLine.indexOf(EGO_COLLECTION_MARKER) + EGO_COLLECTION_MARKER.length));
  return extractCollectionPayload({
    ...rawResult,
    shop,
    rules: run.rules || []
  });
};

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

let stateWriteChain = Promise.resolve();
const writeStateEnvelope = async (state) => {
  const envelope = { ok: true, state: normalizeDataFactoryState(state), updatedAt: Date.now() };
  const persist = async () => {
    const temporaryStateFile = `${stateFile}.${process.pid}.tmp`;
    await writeFile(temporaryStateFile, `${JSON.stringify(envelope, null, 2)}\n`);
    await rename(temporaryStateFile, stateFile);
    return envelope;
  };
  const result = stateWriteChain.then(persist, persist);
  stateWriteChain = result.then(() => undefined, () => undefined);
  return result;
};

const protectShopLifecycle = (currentState, incomingState) => {
  const current = normalizeDataFactoryState(currentState);
  const incoming = normalizeDataFactoryState(incomingState);
  const activeIds = new Set(incoming.platforms.map(shop => shop.id));
  const trashIds = new Set(incoming.trashedShops.map(shop => shop.id));
  const now = Date.now();
  const implicitlyTrashed = current.platforms
    .filter(shop => !activeIds.has(shop.id) && !trashIds.has(shop.id))
    .map(shop => ({
      ...shop,
      authStatusBeforeTrash: shop.authStatus,
      autoSyncEnabledBeforeTrash: shop.autoSyncEnabled,
      authStatus: 'unauthorized',
      autoSyncEnabled: false,
      deletedAt: now
    }));
  const preservedTrash = current.trashedShops.filter(shop => !activeIds.has(shop.id) && !trashIds.has(shop.id));
  return {
    ...incoming,
    trashedShops: [...incoming.trashedShops, ...preservedTrash, ...implicitlyTrashed]
  };
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

const getShanghaiClock = (date = new Date()) => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date).filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
  return {
    dateKey: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute)
  };
};

const scheduledMinutes = (time = '09:00') => {
  const match = String(time).match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return 9 * 60;
  return Math.min(23, Number(match[1])) * 60 + Math.min(59, Number(match[2]));
};

const updateShopSyncState = (state, shopId, patch) => ({
  ...state,
  platforms: (state.platforms || []).map(shop => shop.id === shopId ? { ...shop, ...patch } : shop)
});

const createScheduleFailure = (state, shop, errorCode, dateKey) => {
  const now = Date.now();
  const evidence = getRunnerErrorMessage(errorCode);
  const run = {
    id: `RUN-${now.toString().slice(-6)}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`,
    workspaceId: state.workspaceId,
    shopId: shop.id,
    platformId: shop.id,
    platformName: shop.name,
    expectedShopName: shop.expectedShopName,
    trigger: 'schedule',
    createdAt: now,
    completedAt: now,
    time: nowText(),
    status: 'error',
    error: errorCode,
    evidence,
    statusText: evidence
  };
  return updateShopSyncState({
    ...state,
    collectionRequests: [run, ...(state.collectionRequests || [])]
  }, shop.id, {
    lastAutoSyncDate: dateKey,
    lastAutoSyncAt: now,
    lastAutoSyncStatus: 'error',
    lastAutoSyncError: errorCode
  });
};

const scheduleDueCollections = async () => {
  const envelope = await readStateEnvelope();
  const clock = getShanghaiClock();
  let nextState = envelope.state;
  let changed = false;

  for (const originalShop of envelope.state.platforms || []) {
    const shop = nextState.platforms.find(item => item.id === originalShop.id);
    if (!shop || shop.autoSyncEnabled === false) continue;
    if (shop.authStatus !== 'verified') continue;
    if (!shop.egoBinding?.taskSpaceId || shop.egoBinding?.shopNameMatched !== true) continue;
    if (shop.egoBinding?.verification?.platformMatched !== true || shop.egoBinding?.verification?.urlAllowed !== true) continue;
    if (clock.minutes < scheduledMinutes(shop.autoSyncTime)) continue;
    if (shop.lastAutoSyncDate === clock.dateKey) continue;

    const hasPendingRun = (nextState.collectionRequests || []).some(run => (
      run.shopId === shop.id && ['waiting_for_runner', 'waiting_for_codex', 'running'].includes(run.status)
    ));
    if (hasPendingRun) {
      nextState = updateShopSyncState(nextState, shop.id, {
        lastAutoSyncDate: clock.dateKey,
        lastAutoSyncAt: Date.now(),
        lastAutoSyncStatus: 'running',
        lastAutoSyncError: ''
      });
      changed = true;
      continue;
    }

    const result = createCollectionRun(nextState, { shopId: shop.id, trigger: 'schedule' });
    if (!result.ok) {
      nextState = createScheduleFailure(nextState, shop, result.error, clock.dateKey);
    } else {
      nextState = updateShopSyncState(result.state, shop.id, {
        lastAutoSyncDate: clock.dateKey,
        lastAutoSyncAt: Date.now(),
        lastAutoSyncStatus: 'waiting',
        lastAutoSyncError: ''
      });
    }
    changed = true;
  }

  if (changed) await writeStateEnvelope(nextState);
};

const executeNextCollectionRun = async () => {
  let envelope = await readStateEnvelope();
  const run = (envelope.state.collectionRequests || []).find(item => ['waiting_for_runner', 'waiting_for_codex'].includes(item.status));
  if (!run) return;
  const shop = envelope.state.platforms.find(item => item.id === run.shopId || item.id === run.platformId);
  if (!shop) return;

  const started = markCollectionRunStarted(envelope.state, {
    runId: run.id,
    note: '正在刷新并校正店铺。'
  });
  if (!started.ok) return;
  await writeStateEnvelope(updateShopSyncState(started.state, shop.id, {
    lastAutoSyncStatus: 'running',
    lastAutoSyncError: ''
  }));

  try {
    const payload = await collectRunWithEgo({ run, shop });
    envelope = await readStateEnvelope();
    const completed = completeCollectionRunFromEgoPayload(envelope.state, {
      runId: run.id,
      payload,
      source: 'ego-lite-auto-runner'
    });
    if (!completed.ok) throw new Error(completed.error || 'runner_complete_failed');
    await writeStateEnvelope(updateShopSyncState(completed.state, shop.id, {
      lastAutoSyncStatus: completed.record?.status === 'error' ? 'error' : 'success',
      lastAutoSyncError: completed.record?.status === 'error' ? 'partial_field_error' : '',
      lastAutoSyncCompletedAt: Date.now()
    }));
  } catch (error) {
    const errorCode = getRunnerErrorCode(error);
    envelope = await readStateEnvelope();
    const failed = failCollectionRun(envelope.state, {
      runId: run.id,
      error: errorCode,
      evidence: getRunnerErrorMessage(errorCode)
    });
    if (failed.ok) {
      await writeStateEnvelope(updateShopSyncState(failed.state, shop.id, {
        lastAutoSyncStatus: 'error',
        lastAutoSyncError: errorCode,
        lastAutoSyncCompletedAt: Date.now()
      }));
    }
  }
};

const recoverStaleCollectionRuns = async () => {
  const envelope = await readStateEnvelope();
  const staleRuns = (envelope.state.collectionRequests || []).filter(run => (
    run.status === 'running'
    && run.startedAt
    && Date.now() - Number(run.startedAt) > 90_000
  ));
  if (staleRuns.length === 0) return;

  let nextState = envelope.state;
  for (const run of staleRuns) {
    const failed = failCollectionRun(nextState, {
      runId: run.id,
      error: 'runner_timeout',
      evidence: getRunnerErrorMessage('runner_timeout')
    });
    if (!failed.ok) continue;
    nextState = updateShopSyncState(failed.state, run.shopId || run.platformId, {
      lastAutoSyncStatus: 'error',
      lastAutoSyncError: 'runner_timeout',
      lastAutoSyncCompletedAt: Date.now()
    });
  }
  await writeStateEnvelope(nextState);
};

let maintenanceBusy = false;
const runMaintenance = async () => {
  if (maintenanceBusy) return;
  maintenanceBusy = true;
  try {
    await recoverStaleCollectionRuns();
    await scheduleDueCollections();
    await executeNextCollectionRun();
  } catch (error) {
    console.error('DataFactory maintenance failed:', error.message);
  } finally {
    maintenanceBusy = false;
  }
};

const server = http.createServer(async (request, response) => {
  const requestOrigin = request.headers.origin;
  if (requestOrigin && allowedBrowserOrigins.has(requestOrigin)) {
    response.setHeader('Access-Control-Allow-Origin', requestOrigin);
  }
  if (request.method === 'OPTIONS') {
    if (requestOrigin && !allowedBrowserOrigins.has(requestOrigin)) {
      response.writeHead(403, jsonHeaders);
      response.end();
      return;
    }
    response.writeHead(204, jsonHeaders);
    response.end();
    return;
  }

  try {
    const url = new URL(request.url, `http://${request.headers.host}`);

    if (request.method === 'GET' && url.pathname === '/health') {
      send(response, 200, {
        ok: true,
        service: 'data-factory-api',
        version: '0.2.0',
        codexReady: true,
        egoProvider: 'ego-lite',
        baseUrl: `http://127.0.0.1:${port}`
      });
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

    if (request.method === 'POST' && url.pathname === '/shops') {
      const envelope = await readStateEnvelope();
      const result = createShop(envelope.state, await readJsonBody(request));
      if (!result.ok) {
        send(response, result.error === 'shop_fields_required' ? 400 : 409, result);
        return;
      }
      const nextEnvelope = await writeStateEnvelope(result.state);
      send(response, 201, { ok: true, shop: result.shop, state: nextEnvelope.state, updatedAt: nextEnvelope.updatedAt });
      return;
    }

    if (request.method === 'GET' && url.pathname === '/trash') {
      const envelope = await readStateEnvelope();
      send(response, 200, { ok: true, shops: envelope.state.trashedShops || [] });
      return;
    }

    const shopMatch = url.pathname.match(/^\/shops\/([^/]+)$/);
    if (request.method === 'DELETE' && shopMatch) {
      const envelope = await readStateEnvelope();
      const shopId = decodeURIComponent(shopMatch[1]);
      const result = moveShopToTrash(envelope.state, { shopId });
      if (!result.ok) {
        send(response, 404, result);
        return;
      }
      const nextEnvelope = await writeStateEnvelope(result.state);
      send(response, 200, { ok: true, shop: result.shop, state: nextEnvelope.state, updatedAt: nextEnvelope.updatedAt });
      return;
    }

    const restoreMatch = url.pathname.match(/^\/trash\/([^/]+)\/restore$/);
    if (request.method === 'POST' && restoreMatch) {
      const envelope = await readStateEnvelope();
      const shopId = decodeURIComponent(restoreMatch[1]);
      const result = restoreShopFromTrash(envelope.state, { shopId });
      if (!result.ok) {
        send(response, result.error === 'shop_already_exists' ? 409 : 404, result);
        return;
      }
      const nextEnvelope = await writeStateEnvelope(result.state);
      send(response, 200, { ok: true, shop: result.shop, state: nextEnvelope.state, updatedAt: nextEnvelope.updatedAt });
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

    const collectionRunMatch = url.pathname.match(/^\/collection-runs\/([^/]+)$/);
    if (request.method === 'GET' && collectionRunMatch) {
      const envelope = await readStateEnvelope();
      const runId = decodeURIComponent(collectionRunMatch[1]);
      const run = (envelope.state.collectionRequests || []).find(item => item.id === runId);
      if (!run) {
        send(response, 404, { ok: false, error: 'run_not_found', runId });
        return;
      }
      send(response, 200, { ok: true, run });
      return;
    }

    if (request.method === 'GET' && url.pathname === '/runner/next') {
      const envelope = await readStateEnvelope();
      const shopId = url.searchParams.get('shopId');
      const runnableStatuses = new Set(['waiting_for_runner', 'waiting_for_codex']);
      const run = (envelope.state.collectionRequests || []).find(item => (
        runnableStatuses.has(item.status) && (!shopId || item.shopId === shopId || item.platformId === shopId)
      ));
      send(response, 200, { ok: true, run: run || null });
      return;
    }

    if (request.method === 'GET' && ['/runner/ego-shops', '/runner/ego-targets'].includes(url.pathname)) {
      const envelope = await readStateEnvelope();
      const scan = await scanEgoTaskSpaces(envelope.state);
      send(response, 200, {
        ok: true,
        source: 'ego-lite',
        scannedAt: nowText(),
        shops: scan.shops,
        taskSpaces: scan.spaces
      });
      return;
    }

    if (request.method === 'POST' && url.pathname === '/runner/ego-bind') {
      const body = await readJsonBody(request);
      const envelope = await readStateEnvelope();
      const shop = envelope.state.platforms.find(item => item.id === body.shopId);
      if (!shop) {
        send(response, 404, { ok: false, error: 'shop_not_found' });
        return;
      }
      let result;
      try {
        result = await bindShopToEgo(shop, { resume: body.resume === true });
      } catch (error) {
        if (/user has taken control|user is controlling|browser commands are paused/i.test(error.message)) {
          send(response, 409, {
            ok: false,
            error: 'ego_user_control',
            message: 'Ego 窗口正在由用户操作。登录完成后点击“我已登录，继续校准”。'
          });
          return;
        }
        throw error;
      }
      const currentUrl = result.current?.url || result.page?.url || shop.url;
      const detectedPlatformType = inferPlatformType({
        url: currentUrl,
        title: result.current?.title || result.page?.title || ''
      });
      const platformMatched = detectedPlatformType === shop.platformType;
      const urlAllowed = isUrlAllowedForShop(shop, currentUrl);
      const loginRequired = result.loginRequired === true;
      const bindingVerified = Boolean(
        result.shopNameMatched
        && platformMatched
        && urlAllowed
        && !loginRequired
      );
      const binding = {
        taskSpaceId: result.task.id,
        taskSpaceName: result.task.name,
        taskId: result.task.taskId,
        ownership: result.task.ownership,
        profileId: result.task.profileId,
        profileName: result.task.profileName,
        targetId: result.current?.targetId || '',
        tabTitle: result.current?.title || '',
        tabUrl: currentUrl,
        shopNameMatched: bindingVerified,
        verifiedAt: bindingVerified ? Date.now() : null,
        needsUserLogin: loginRequired,
        handedOffToUser: result.handedOff === true,
        verification: {
          platformMatched,
          urlAllowed,
          loginRequired,
          expectedShopName: shop.expectedShopName || shop.detectedName || shop.name,
          detectedShopName: result.detectedShopName || '',
          identityEvidence: result.identityEvidence || null,
          detectedPlatformType,
          checkedAt: Date.now()
        }
      };
      const nextState = {
        ...envelope.state,
        platforms: envelope.state.platforms.map(item => item.id === shop.id ? {
          ...item,
          browserProvider: 'ego-lite',
          egoBinding: binding,
          lastScannedAt: nowText(),
          authStatus: bindingVerified ? 'verified' : loginRequired ? 'unauthorized' : 'mismatch',
          detectedName: bindingVerified ? result.detectedShopName : (loginRequired ? '' : (result.detectedShopName || ''))
        } : item)
      };
      const nextEnvelope = await writeStateEnvelope(nextState);
      send(response, 200, {
        ok: true,
        binding,
        shopNameMatched: bindingVerified,
        needsUserLogin: loginRequired,
        requiresUserAction: !bindingVerified,
        verification: binding.verification,
        message: bindingVerified
          ? 'Ego 窗口、平台、域名和店铺名校验通过。'
          : loginRequired
            ? 'Ego 登录已失效，请在专属窗口完成登录后重新校验。'
            : !platformMatched || !urlAllowed
              ? '当前 Ego 页面不是这个店铺允许的平台或域名，已阻止绑定。'
              : '当前页面的店铺名与 DataFactory 中保存的店铺不一致，已阻止绑定。',
        shop: nextEnvelope.state.platforms.find(item => item.id === shop.id),
        updatedAt: nextEnvelope.updatedAt
      });
      return;
    }

    if (request.method === 'PUT' && url.pathname === '/state') {
      const body = await readJsonBody(request);
      const currentEnvelope = await readStateEnvelope();
      if (
        body.expectedUpdatedAt !== undefined
        && Number(body.expectedUpdatedAt) !== Number(currentEnvelope.updatedAt)
      ) {
        send(response, 409, {
          ok: false,
          error: 'state_conflict',
          state: currentEnvelope.state,
          updatedAt: currentEnvelope.updatedAt
        });
        return;
      }
      send(response, 200, await writeStateEnvelope(protectShopLifecycle(currentEnvelope.state, body.state || body)));
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
      const result = await updateRunState(state => completeCollectionRunFromEgoPayload(state, {
        runId,
        payload: body.payload || body,
        source: body.source || 'ego-lite-runner'
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
  setTimeout(runMaintenance, 1000);
  setInterval(runMaintenance, 5000);
});
