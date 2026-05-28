export const DEFAULT_WORKSPACE_ID = 'workspace-demo-nansu';
export const DEFAULT_USER_ID = 'user-demo-nansu';

export const INITIAL_PLATFORMS = [
  {
    id: 'taobao',
    workspaceId: DEFAULT_WORKSPACE_ID,
    platformType: 'taobao',
    name: '淘宝店铺A (核心)',
    expectedShopName: '南苏科技',
    url: 'https://myseller.taobao.com/home.htm/trade-platform/tp/sold',
    authStatus: 'verified',
    detectedName: '南苏科技'
  },
  {
    id: 'pdd',
    workspaceId: DEFAULT_WORKSPACE_ID,
    platformType: 'pdd',
    name: '拼多多专卖店',
    expectedShopName: '',
    url: 'https://mms.pinduoduo.com/login/',
    authStatus: 'unauthorized',
    detectedName: ''
  },
  {
    id: 'jd',
    workspaceId: DEFAULT_WORKSPACE_ID,
    platformType: 'jd',
    name: '京东旗舰店',
    expectedShopName: '',
    url: 'https://shop.jd.com/home',
    authStatus: 'unauthorized',
    detectedName: ''
  }
];

const buildStoreMetricRule = ({ id, fieldName, value, valueType = '数字文本' }) => ({
  id,
  workspaceId: DEFAULT_WORKSPACE_ID,
  shopId: 'taobao',
  fieldName,
  value,
  prompt: `进入千牛商家工作台首页，找到「店铺数据」区域，读取「${fieldName}」卡片里的当前主数值。只返回${valueType}。`,
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
    buildStoreMetricRule({ id: 'taobao-pay-amount', fieldName: '支付金额', value: '0' }),
    buildStoreMetricRule({ id: 'taobao-visitors', fieldName: '访客数', value: '5' }),
    buildStoreMetricRule({ id: 'taobao-paid-suborders', fieldName: '支付子订单数', value: '0' }),
    buildStoreMetricRule({ id: 'taobao-pay-conversion', fieldName: '支付转化率', value: '0%', valueType: '百分比文本' }),
    buildStoreMetricRule({ id: 'taobao-pageviews', fieldName: '浏览量', value: '11' }),
    buildStoreMetricRule({ id: 'taobao-cart-users', fieldName: '加购人数', value: '0' }),
    buildStoreMetricRule({ id: 'taobao-average-order', fieldName: '客单价', value: '0' }),
    buildStoreMetricRule({ id: 'taobao-paid-buyers', fieldName: '支付买家数', value: '0' })
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
    id: 'REC-STORE-085715',
    workspaceId: DEFAULT_WORKSPACE_ID,
    shopId: 'taobao',
    time: '08:57:15',
    platform: '淘宝店铺A (核心)',
    status: 'success',
    source: 'tabbit-store-data-seed',
    evidence: '千牛商家工作台首页「店铺数据」区域，数据更新时间 2026-05-25 08:57:15。',
    data: {
      支付金额: '0',
      访客数: '5',
      支付子订单数: '0',
      支付转化率: '0%',
      浏览量: '11',
      加购人数: '0',
      客单价: '0',
      支付买家数: '0'
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
      ...platform
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
    rules,
    instruction: 'Codex 读取 rules 后调用 Tabbit Bridge MCP 执行采集，并通过 DataFactory API/MCP 写回记录。'
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

export const writeCollectionRecord = (state, { shopId, shopName, data = {}, status = 'success', source = 'server-api', evidence = '' } = {}) => {
  const normalized = normalizeDataFactoryState(state);
  const shop = findShop(normalized, shopId || shopName || normalized.activePlatform);
  if (!shop) return { ok: false, error: 'shop_not_found' };
  if (shop.authStatus !== 'verified') return { ok: false, error: 'shop_not_verified', shop };

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
    if (marked || run.status !== 'waiting_for_codex' || !isSameShop) return run;
    marked = true;
    return {
      ...run,
      status: status === 'success' ? 'done' : 'error',
      completedAt: now,
      recordId: record.id,
      evidence
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
