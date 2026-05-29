export const DEFAULT_WORKSPACE_ID = 'workspace-demo-nansu';
export const DEFAULT_USER_ID = 'user-demo-nansu';

export const PLATFORM_IDENTITY_DEFAULTS = {
  taobao: {
    label: '淘宝 / 千牛',
    url: 'https://myseller.taobao.com/home.htm/QnworkbenchHome/',
    allowedDomains: ['myseller.taobao.com', 'sycm.taobao.com', 'qn.taobao.com']
  },
  pdd: {
    label: '拼多多',
    url: 'https://mms.pinduoduo.com/',
    allowedDomains: ['mms.pinduoduo.com']
  },
  jd: {
    label: '京东',
    url: 'https://shop.jd.com/',
    allowedDomains: ['shop.jd.com', 'passport.shop.jd.com']
  },
  other: {
    label: '其他平台',
    url: 'https://',
    allowedDomains: []
  }
};

export const normalizeAllowedDomains = (domains = []) => (
  Array.isArray(domains) ? domains : String(domains).split(/[\s,，\n]+/)
).map(domain => domain.trim().toLowerCase()).filter(Boolean);

export const extractHostname = (url) => {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
};

export const inferAllowedDomains = ({ platformType = 'other', url = '' } = {}) => {
  const defaults = PLATFORM_IDENTITY_DEFAULTS[platformType]?.allowedDomains || [];
  const hostname = extractHostname(url);
  return Array.from(new Set(normalizeAllowedDomains([...defaults, hostname])));
};

export const isUrlAllowedForShop = (shop, currentUrl = '') => {
  if (!currentUrl) return true;
  const hostname = extractHostname(currentUrl);
  if (!hostname) return false;
  const allowedDomains = normalizeAllowedDomains(shop.allowedDomains);
  if (allowedDomains.length === 0) return true;
  return allowedDomains.some(domain => hostname === domain || hostname.endsWith(`.${domain}`));
};

export const INITIAL_PLATFORMS = [
  {
    id: 'taobao',
    workspaceId: DEFAULT_WORKSPACE_ID,
    platformType: 'taobao',
    name: '淘宝店铺A (核心)',
    expectedShopName: '南苏科技',
    url: 'https://myseller.taobao.com/home.htm/QnworkbenchHome/',
    allowedDomains: PLATFORM_IDENTITY_DEFAULTS.taobao.allowedDomains,
    authStatus: 'verified',
    detectedName: '南苏科技',
    autoSyncTime: '09:00'
  },
  {
    id: 'pdd',
    workspaceId: DEFAULT_WORKSPACE_ID,
    platformType: 'pdd',
    name: '拼多多专卖店',
    expectedShopName: '',
    url: 'https://mms.pinduoduo.com/',
    allowedDomains: PLATFORM_IDENTITY_DEFAULTS.pdd.allowedDomains,
    authStatus: 'unauthorized',
    detectedName: '',
    autoSyncTime: '09:00'
  },
  {
    id: 'jd',
    workspaceId: DEFAULT_WORKSPACE_ID,
    platformType: 'jd',
    name: '京东旗舰店',
    expectedShopName: '',
    url: 'https://shop.jd.com/home',
    allowedDomains: PLATFORM_IDENTITY_DEFAULTS.jd.allowedDomains,
    authStatus: 'unauthorized',
    detectedName: '',
    autoSyncTime: '09:00'
  }
];

const buildStoreMetricRule = ({ id, fieldName, value, valueType = '数字文本' }) => ({
  id,
  workspaceId: DEFAULT_WORKSPACE_ID,
  shopId: 'taobao',
  fieldName,
  value,
  prompt: `进入千牛商家工作台首页后，必须先执行一次浏览器刷新/重新加载，等待「店铺数据」模块和「数据更新时间」更新完成，再读取「${fieldName}」卡片里的当前主数值。只返回${valueType}，不要读取昨日值或刷新前旧值。`,
  pagePath: `千牛商家工作台 > 首页 > 店铺数据 > ${fieldName}`,
  clickPath: '左侧导航：首页',
  screenshot: 'annotated',
  markerNote: `箭头指向店铺数据区域「${fieldName}」卡片里的主数值。`,
  recognizedPath: `店铺数据 > ${fieldName} > 当前主数值`,
  confidence: 98,
  status: 'ready'
});

export const INITIAL_TASK_RULES_BY_PLATFORM = {
  taobao: [
    buildStoreMetricRule({ id: 'taobao-pay-amount', fieldName: '支付金额', value: '4,160' }),
    buildStoreMetricRule({ id: 'taobao-visitors', fieldName: '访客数', value: '116' }),
    buildStoreMetricRule({ id: 'taobao-paid-suborders', fieldName: '支付子订单数', value: '11' }),
    buildStoreMetricRule({ id: 'taobao-pay-conversion', fieldName: '支付转化率', value: '7.76%', valueType: '百分比文本' }),
    buildStoreMetricRule({ id: 'taobao-pageviews', fieldName: '浏览量', value: '283' }),
    buildStoreMetricRule({ id: 'taobao-cart-users', fieldName: '加购人数', value: '0' }),
    buildStoreMetricRule({ id: 'taobao-average-order', fieldName: '客单价', value: '462.22' }),
    buildStoreMetricRule({ id: 'taobao-paid-buyers', fieldName: '支付买家数', value: '9' })
  ],
  pdd: [
    { id: 'pdd-1', workspaceId: DEFAULT_WORKSPACE_ID, shopId: 'pdd', fieldName: '今日支付金额', value: '￥ 12,450.00', prompt: '', pagePath: '待配置拼多多后台路径', clickPath: '', screenshot: null, markerNote: '', recognizedPath: '', confidence: null, status: 'draft' },
    { id: 'pdd-2', workspaceId: DEFAULT_WORKSPACE_ID, shopId: 'pdd', fieldName: '实时访客数', value: '1,205', prompt: '', pagePath: '待配置拼多多后台路径', clickPath: '', screenshot: null, markerNote: '', recognizedPath: '', confidence: null, status: 'draft' },
    { id: 'pdd-3', workspaceId: DEFAULT_WORKSPACE_ID, shopId: 'pdd', fieldName: '支付转化率', value: '8.2%', prompt: '', pagePath: '待配置拼多多后台路径', clickPath: '', screenshot: null, markerNote: '', recognizedPath: '', confidence: null, status: 'draft' },
    { id: 'pdd-4', workspaceId: DEFAULT_WORKSPACE_ID, shopId: 'pdd', fieldName: '客单价', value: '￥ 10.33', prompt: '', pagePath: '待配置拼多多后台路径', clickPath: '', screenshot: null, markerNote: '', recognizedPath: '', confidence: null, status: 'draft' },
    { id: 'pdd-5', workspaceId: DEFAULT_WORKSPACE_ID, shopId: 'pdd', fieldName: '退款率', value: '5.4%', prompt: '', pagePath: '待配置拼多多后台路径', clickPath: '', screenshot: null, markerNote: '', recognizedPath: '', confidence: null, status: 'draft' }
  ],
  jd: [
    { id: 'jd-1', workspaceId: DEFAULT_WORKSPACE_ID, shopId: 'jd', fieldName: '今日支付金额', value: '￥ 45,100.20', prompt: '', pagePath: '待配置京东后台路径', clickPath: '', screenshot: null, markerNote: '', recognizedPath: '', confidence: null, status: 'draft' },
    { id: 'jd-2', workspaceId: DEFAULT_WORKSPACE_ID, shopId: 'jd', fieldName: '实时访客数', value: '2,890', prompt: '', pagePath: '待配置京东后台路径', clickPath: '', screenshot: null, markerNote: '', recognizedPath: '', confidence: null, status: 'draft' },
    { id: 'jd-3', workspaceId: DEFAULT_WORKSPACE_ID, shopId: 'jd', fieldName: '支付转化率', value: '11.4%', prompt: '', pagePath: '待配置京东后台路径', clickPath: '', screenshot: null, markerNote: '', recognizedPath: '', confidence: null, status: 'draft' },
    { id: 'jd-4', workspaceId: DEFAULT_WORKSPACE_ID, shopId: 'jd', fieldName: '客单价', value: '￥ 15.60', prompt: '', pagePath: '待配置京东后台路径', clickPath: '', screenshot: null, markerNote: '', recognizedPath: '', confidence: null, status: 'draft' },
    { id: 'jd-5', workspaceId: DEFAULT_WORKSPACE_ID, shopId: 'jd', fieldName: '退款率', value: '1.2%', prompt: '', pagePath: '待配置京东后台路径', clickPath: '', screenshot: null, markerNote: '', recognizedPath: '', confidence: null, status: 'draft' }
  ]
};

export const INITIAL_HISTORY_RECORDS = [
  {
    id: 'REC-STORE-233828',
    workspaceId: DEFAULT_WORKSPACE_ID,
    shopId: 'taobao',
    time: '23:38:28',
    platform: '淘宝店铺A (核心)',
    status: 'success',
    source: 'tabbit-store-data-seed',
    evidence: '千牛商家工作台首页「店铺数据」区域，数据更新时间 2026-05-28 23:38:28。',
    data: {
      支付金额: '4,160',
      访客数: '116',
      支付子订单数: '11',
      支付转化率: '7.76%',
      浏览量: '283',
      加购人数: '0',
      客单价: '462.22',
      支付买家数: '9'
    }
  },
  { id: 'REC-1003', workspaceId: DEFAULT_WORKSPACE_ID, shopId: 'pdd', time: '10:00:00', platform: '拼多多专卖店', status: 'success', data: { 今日支付金额: '￥ 12,450.00', 实时访客数: '1,205', 支付转化率: '8.2%', 客单价: '￥ 10.33', 退款率: '5.4%' } },
  { id: 'REC-1002', workspaceId: DEFAULT_WORKSPACE_ID, shopId: 'jd', time: '09:30:00', platform: '京东旗舰店', status: 'success', data: { 今日支付金额: '￥ 45,100.20', 实时访客数: '2,890', 支付转化率: '11.4%', 客单价: '￥ 15.60', 退款率: '1.2%' } }
];

export const createInitialDataFactoryState = () => ({
  workspaceId: DEFAULT_WORKSPACE_ID,
  userId: DEFAULT_USER_ID,
  activePlatform: 'taobao',
  platforms: INITIAL_PLATFORMS,
  taskRulesByPlatform: INITIAL_TASK_RULES_BY_PLATFORM,
  historyRecords: INITIAL_HISTORY_RECORDS,
  collectionRequests: []
});

export const normalizeDataFactoryState = (state = {}) => {
  const initialState = createInitialDataFactoryState();
  const platforms = Array.isArray(state.platforms) && state.platforms.length > 0
    ? state.platforms
    : initialState.platforms;
  const activePlatform = state.activePlatform || platforms[0]?.id || 'taobao';
  const workspaceId = state.workspaceId || initialState.workspaceId;
  const platformLookupByName = new Map(platforms.map(platform => [platform.name, platform.id]));

  return {
    ...initialState,
    ...state,
    workspaceId,
    userId: state.userId || initialState.userId,
    activePlatform,
    platforms: platforms.map(platform => ({
      workspaceId,
      authStatus: 'unauthorized',
      detectedName: '',
      expectedShopName: '',
      ...platform,
      allowedDomains: normalizeAllowedDomains(
        platform.allowedDomains?.length
          ? platform.allowedDomains
          : inferAllowedDomains({ platformType: platform.platformType, url: platform.url })
      )
    })),
    taskRulesByPlatform: {
      ...initialState.taskRulesByPlatform,
      ...(state.taskRulesByPlatform || {})
    },
    historyRecords: (Array.isArray(state.historyRecords) ? state.historyRecords : initialState.historyRecords).map(record => ({
      workspaceId,
      shopId: record.shopId || platformLookupByName.get(record.platform) || activePlatform,
      ...record
    })),
    collectionRequests: Array.isArray(state.collectionRequests) ? state.collectionRequests : []
  };
};

export const findShop = (state, shopIdOrName) => {
  const normalized = normalizeDataFactoryState(state);
  return normalized.platforms.find(shop => shop.id === shopIdOrName || shop.name === shopIdOrName);
};

export const getShopRules = (state, shopId) => {
  const normalized = normalizeDataFactoryState(state);
  return normalized.taskRulesByPlatform?.[shopId] || [];
};

export const getReadyRules = (state, shopId, fieldNames) => {
  const targetFieldNames = Array.isArray(fieldNames) && fieldNames.length > 0 ? new Set(fieldNames) : null;
  return getShopRules(state, shopId).filter(rule => (
    rule.status === 'ready' && (!targetFieldNames || targetFieldNames.has(rule.fieldName))
  ));
};

export const buildTabbitBatchPrompt = ({ shop, rules }) => {
  const fieldLines = rules.map((rule, index) => (
    `${index + 1}. ${rule.fieldName} | 页面位置: ${rule.pagePath || '未填写'} | 操作路径: ${rule.clickPath || '未填写'} | 目标定位: ${rule.recognizedPath || rule.markerNote || '读取当前主数值'}`
  )).join('\n');

  const expectedShopName = shop.expectedShopName || shop.detectedName || shop.name;
  const targetUrl = shop.url || 'https://myseller.taobao.com/home.htm/QnworkbenchHome/';
  const platformLabel = PLATFORM_IDENTITY_DEFAULTS[shop.platformType]?.label || shop.platformType || '未知平台';
  const allowedDomains = normalizeAllowedDomains(shop.allowedDomains);

  return [
    '你是 DataFactory 的本地采集执行器。请使用当前 Tabbit 浏览器完成一次批量采集，只做读取，不做提交、删除、付款、发布、改价、授权等写操作。',
    '',
    `目标平台: ${platformLabel}`,
    `目标店铺: ${expectedShopName}`,
    `目标页面: ${targetUrl}`,
    `允许域名: ${allowedDomains.length ? allowedDomains.join(', ') : '未限制'}`,
    '',
    '执行步骤:',
    `1. 打开目标页面。如果当前页面不在允许域名内，必须先进入 ${targetUrl}；如果被带到其他平台或登录页，停止并返回 blocked。`,
    '2. 到达目标页面后，必须执行一次浏览器刷新/重新加载动作（刷新按钮、Cmd+R、Ctrl+R 或等价 reload 均可）。刷新动作必须发生在本次采集任务内。',
    `3. 刷新完成后再校准店铺名: 页面右上角/店铺信息处必须是「${expectedShopName}」。如果当前店铺不是它，先尝试在当前平台内切换/寻找「${expectedShopName}」；找不到就停止并返回 blocked，不要采集。`,
    '4. 校准通过后，等待「店铺数据」区域重新渲染，并读取页面显示的「数据更新时间」。不要使用刷新前 DOM、旧截图、聊天记录或历史结果。',
    '5. 然后一次性读取下面所有字段，只读取当前主数值，不读取昨日值；不要猜测，不确定就标 error。',
    fieldLines,
    '',
    '数据 freshness 要求:',
    '- evidence 必须说明本次任务内已经执行过浏览器刷新/重新加载，并写明读取到的「数据更新时间」。',
    '- dataUpdatedAt 必须填写页面显示的「数据更新时间」。如果找不到数据更新时间，返回 blocked，不要写字段值。',
    '- 如果刷新后字段值和昨日值并列显示，只取标题下方/卡片中的大号当前值。',
    '',
    '只返回 JSON，不要解释，不要 Markdown:',
    '{"shopCalibration":{"expectedShopName":"' + expectedShopName + '","detectedShopName":"","status":"verified|mismatch|blocked"},"currentUrl":"","fields":[{"fieldName":"","value":"","status":"success|error","evidence":"","confidence":0}],"blockers":[],"dataUpdatedAt":""}'
  ].join('\n');
};

export const createCollectionRun = (state, { shopId, fieldNames } = {}) => {
  const normalized = normalizeDataFactoryState(state);
  const shop = findShop(normalized, shopId || normalized.activePlatform);
  if (!shop) return { ok: false, error: 'shop_not_found' };
  if (shop.authStatus !== 'verified') return { ok: false, error: 'shop_not_verified', shop };

  const rules = getReadyRules(normalized, shop.id, fieldNames);
  if (rules.length === 0) return { ok: false, error: 'no_ready_rules', shop };

  const now = Date.now();
  const run = {
    id: `RUN-${now.toString().slice(-6)}`,
    workspaceId: normalized.workspaceId,
    shopId: shop.id,
    createdAt: now,
    time: new Date(now).toLocaleTimeString('zh-CN', { hour12: false, timeZone: 'Asia/Shanghai' }),
    platformId: shop.id,
    platformName: shop.name,
    expectedShopName: shop.expectedShopName,
    detectedName: shop.detectedName,
    status: 'waiting_for_codex',
    statusText: '等待本地执行器读取任务并调用 Tabbit。',
    rules,
    instruction: 'Codex 读取 tabbitPrompt 后调用 Tabbit Bridge MCP 执行采集，并通过 DataFactory API/MCP 写回记录。',
    tabbitPrompt: buildTabbitBatchPrompt({ shop, rules })
  };

  return {
    ok: true,
    state: {
      ...normalized,
      collectionRequests: [run, ...(normalized.collectionRequests || [])]
    },
    run
  };
};

export const markCollectionRunStarted = (state, { runId, note = '' } = {}) => {
  const normalized = normalizeDataFactoryState(state);
  if (!runId) return { ok: false, error: 'run_id_required' };

  let foundRun;
  const now = Date.now();
  const collectionRequests = (normalized.collectionRequests || []).map(run => {
    if (run.id !== runId) return run;
    foundRun = run;
    return {
      ...run,
      status: 'running',
      startedAt: now,
      statusText: note || '本地执行器已接收任务，正在调用 Tabbit。'
    };
  });

  if (!foundRun) return { ok: false, error: 'run_not_found', runId };
  return {
    ok: true,
    state: {
      ...normalized,
      collectionRequests
    },
    run: {
      ...foundRun,
      status: 'running',
      startedAt: now,
      statusText: note || '本地执行器已接收任务，正在调用 Tabbit。'
    }
  };
};

export const failCollectionRun = (state, { runId, error = 'runner_failed', evidence = '' } = {}) => {
  const normalized = normalizeDataFactoryState(state);
  if (!runId) return { ok: false, error: 'run_id_required' };

  let foundRun;
  const now = Date.now();
  const collectionRequests = (normalized.collectionRequests || []).map(run => {
    if (run.id !== runId) return run;
    foundRun = run;
    return {
      ...run,
      status: 'error',
      completedAt: now,
      error,
      evidence: evidence || run.evidence || error,
      statusText: '本地执行器返回失败。'
    };
  });

  if (!foundRun) return { ok: false, error: 'run_not_found', runId };
  return { ok: true, state: { ...normalized, collectionRequests } };
};

export const normalizeTabbitResultPayload = (payload = {}) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { ok: false, error: 'payload_must_be_object' };
  }
  if (!payload.dataUpdatedAt?.trim()) {
    return { ok: false, error: 'data_updated_at_required' };
  }

  const fieldData = Array.isArray(payload.fields)
    ? payload.fields.reduce((data, field) => {
      if (field?.fieldName && field.value !== undefined && field.status !== 'error') {
        data[field.fieldName] = field.value;
      }
      return data;
    }, {})
    : {};
  const directData = payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)
    ? payload.data
    : {};

  return {
    ok: true,
    data: { ...directData, ...fieldData },
    shopCalibration: payload.shopCalibration,
    currentUrl: payload.currentUrl,
    dataUpdatedAt: payload.dataUpdatedAt,
    evidence: payload.evidence || `Tabbit Bridge 批量采集结果，数据更新时间 ${payload.dataUpdatedAt}`
  };
};

export const writeCollectionRecord = (state, { shopId, shopName, runId, data = {}, status = 'success', source = 'server-api', evidence = '', shopCalibration, currentUrl } = {}) => {
  const normalized = normalizeDataFactoryState(state);
  const shop = findShop(normalized, shopId || shopName || normalized.activePlatform);
  if (!shop) return { ok: false, error: 'shop_not_found' };
  if (shop.authStatus !== 'verified') return { ok: false, error: 'shop_not_verified', shop };

  if (shopCalibration) {
    const detectedName = shopCalibration.detectedShopName?.trim() || '';
    const expectedName = shop.expectedShopName?.trim() || shop.detectedName?.trim() || '';
    if (shopCalibration.status !== 'verified') return { ok: false, error: 'shop_calibration_not_verified', shop, shopCalibration };
    if (expectedName && !detectedName) return { ok: false, error: 'shop_name_missing', shop, shopCalibration };
    if (expectedName && detectedName && detectedName !== expectedName) {
      return { ok: false, error: 'shop_name_mismatch', shop, shopCalibration };
    }
  }

  if (currentUrl && !isUrlAllowedForShop(shop, currentUrl)) {
    return { ok: false, error: 'current_url_not_allowed', shop, currentUrl };
  }

  const readyFieldNames = new Set(getReadyRules(normalized, shop.id).map(rule => rule.fieldName));
  const matchedFields = Object.keys(data).filter(fieldName => readyFieldNames.has(fieldName));
  if (matchedFields.length === 0) return { ok: false, error: 'no_matching_ready_field', shop };

  const now = Date.now();
  const record = {
    id: `REC-${now.toString().slice(-6)}`,
    workspaceId: normalized.workspaceId,
    shopId: shop.id,
    time: new Date(now).toLocaleTimeString('zh-CN', { hour12: false, timeZone: 'Asia/Shanghai' }),
    createdAt: now,
    platform: shop.name,
    status,
    source,
    evidence,
    data: matchedFields.reduce((nextData, fieldName) => {
      nextData[fieldName] = data[fieldName];
      return nextData;
    }, {})
  };

  let marked = false;
  const collectionRequests = (normalized.collectionRequests || []).map(run => {
    const isSameShop = run.shopId === shop.id || run.platformId === shop.id || run.platformName === shop.name;
    const isTargetRun = runId && run.id === runId;
    const canCompleteRun = ['waiting_for_codex', 'running'].includes(run.status);
    if (marked || !canCompleteRun || (!isTargetRun && !isSameShop)) return run;
    marked = true;
    return {
      ...run,
      status: status === 'success' ? 'done' : 'error',
      completedAt: now,
      recordId: record.id,
      evidence,
      statusText: status === 'success' ? '采集完成，结果已写入表格。' : '采集完成但包含错误结果。'
    };
  });

  const rules = getShopRules(normalized, shop.id);
  return {
    ok: true,
    state: {
      ...normalized,
      historyRecords: [record, ...(normalized.historyRecords || [])],
      collectionRequests,
      taskRulesByPlatform: {
        ...(normalized.taskRulesByPlatform || {}),
        [shop.id]: rules.map(rule => {
          if (!readyFieldNames.has(rule.fieldName) || data[rule.fieldName] === undefined) return rule;
          return {
            ...rule,
            value: data[rule.fieldName],
            lastRun: '刚刚',
            confidence: Math.max(rule.confidence || 90, 92),
            status: 'ready'
          };
        })
      }
    },
    record
  };
};

export const completeCollectionRunFromTabbitPayload = (state, { runId, payload, source = 'tabbit-bridge-runner' } = {}) => {
  const normalized = normalizeDataFactoryState(state);
  const run = (normalized.collectionRequests || []).find(item => item.id === runId);
  if (!run) return { ok: false, error: 'run_not_found', runId };

  const normalizedPayload = normalizeTabbitResultPayload(payload);
  if (!normalizedPayload.ok) return normalizedPayload;

  return writeCollectionRecord(normalized, {
    runId,
    shopId: run.shopId || run.platformId,
    data: normalizedPayload.data,
    status: 'success',
    source,
    evidence: normalizedPayload.evidence,
    shopCalibration: normalizedPayload.shopCalibration,
    currentUrl: normalizedPayload.currentUrl
  });
};
