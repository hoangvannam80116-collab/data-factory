export const DEFAULT_WORKSPACE_ID = 'workspace-local-default';
export const DEFAULT_USER_ID = 'user-local-default';

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

export const INITIAL_PLATFORMS = [];
export const INITIAL_TASK_RULES_BY_PLATFORM = {};
export const INITIAL_HISTORY_RECORDS = [];

export const createInitialDataFactoryState = () => ({
  workspaceId: DEFAULT_WORKSPACE_ID,
  userId: DEFAULT_USER_ID,
  activePlatform: '',
  platforms: INITIAL_PLATFORMS,
  trashedShops: [],
  taskRulesByPlatform: INITIAL_TASK_RULES_BY_PLATFORM,
  historyRecords: INITIAL_HISTORY_RECORDS,
  collectionRequests: []
});

export const normalizeDataFactoryState = (state = {}) => {
  const initialState = createInitialDataFactoryState();
  const platforms = Array.isArray(state.platforms)
    ? state.platforms
    : initialState.platforms;
  const requestedActivePlatform = state.activePlatform || platforms[0]?.id || '';
  const activePlatform = platforms.some(platform => platform.id === requestedActivePlatform)
    ? requestedActivePlatform
    : (platforms[0]?.id || '');
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
      browserProvider: 'ego-lite',
      egoBinding: platform.egoBinding || null,
      autoSyncEnabled: true,
      autoSyncTime: '09:00',
      ...platform,
      allowedDomains: normalizeAllowedDomains(
        platform.allowedDomains?.length
          ? platform.allowedDomains
          : inferAllowedDomains({ platformType: platform.platformType, url: platform.url })
      )
    })),
    trashedShops: (Array.isArray(state.trashedShops) ? state.trashedShops : []).map(shop => ({
      workspaceId,
      authStatus: 'unauthorized',
      detectedName: '',
      expectedShopName: '',
      browserProvider: 'ego-lite',
      egoBinding: null,
      autoSyncEnabled: false,
      autoSyncTime: '09:00',
      ...shop,
      allowedDomains: normalizeAllowedDomains(
        shop.allowedDomains?.length
          ? shop.allowedDomains
          : inferAllowedDomains({ platformType: shop.platformType, url: shop.url })
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

export const createShop = (state, input = {}) => {
  const normalized = normalizeDataFactoryState(state);
  const name = input.name?.trim() || '';
  const expectedShopName = input.expectedShopName?.trim() || '';
  const platformType = input.platformType || 'other';
  const url = input.url?.trim() || '';
  if (!name || !expectedShopName || !extractHostname(url)) {
    return { ok: false, error: 'shop_fields_required' };
  }

  const duplicate = [...normalized.platforms, ...normalized.trashedShops].find(shop => (
    shop.platformType === platformType
    && shop.expectedShopName?.trim() === expectedShopName
  ));
  if (duplicate) {
    return {
      ok: false,
      error: normalized.trashedShops.some(shop => shop.id === duplicate.id) ? 'shop_in_trash' : 'shop_already_exists',
      shop: duplicate
    };
  }

  const now = Date.now();
  const shop = {
    id: input.id || `shop_${now}_${Math.random().toString(36).slice(2, 6)}`,
    workspaceId: normalized.workspaceId,
    platformType,
    name,
    url,
    expectedShopName,
    allowedDomains: normalizeAllowedDomains(input.allowedDomains).length
      ? normalizeAllowedDomains(input.allowedDomains)
      : inferAllowedDomains({ platformType, url }),
    authStatus: 'unauthorized',
    detectedName: '',
    browserProvider: 'ego-lite',
    egoBinding: null,
    autoSyncEnabled: input.autoSyncEnabled !== false,
    autoSyncTime: input.autoSyncTime || '09:00',
    createdAt: now
  };

  return {
    ok: true,
    shop,
    state: {
      ...normalized,
      platforms: [...normalized.platforms, shop],
      activePlatform: shop.id,
      taskRulesByPlatform: {
        ...normalized.taskRulesByPlatform,
        [shop.id]: normalized.taskRulesByPlatform[shop.id] || []
      }
    }
  };
};

export const moveShopToTrash = (state, { shopId } = {}) => {
  const normalized = normalizeDataFactoryState(state);
  const shop = normalized.platforms.find(item => item.id === shopId);
  if (!shop) return { ok: false, error: 'shop_not_found' };

  const platforms = normalized.platforms.filter(item => item.id !== shopId);
  const trashedShop = {
    ...shop,
    authStatusBeforeTrash: shop.authStatus,
    autoSyncEnabledBeforeTrash: shop.autoSyncEnabled,
    authStatus: 'unauthorized',
    autoSyncEnabled: false,
    deletedAt: Date.now()
  };
  const collectionRequests = (normalized.collectionRequests || []).map(run => (
    (run.shopId === shopId || run.platformId === shopId)
    && ['waiting_for_runner', 'waiting_for_codex', 'running'].includes(run.status)
      ? {
          ...run,
          status: 'cancelled',
          completedAt: Date.now(),
          error: 'shop_moved_to_trash',
          statusText: '店铺已移入回收站，采集任务已取消。'
        }
      : run
  ));
  return {
    ok: true,
    shop: trashedShop,
    state: {
      ...normalized,
      platforms,
      trashedShops: [trashedShop, ...normalized.trashedShops.filter(item => item.id !== shopId)],
      collectionRequests,
      activePlatform: normalized.activePlatform === shopId
        ? (platforms[0]?.id || '')
        : normalized.activePlatform
    }
  };
};

export const restoreShopFromTrash = (state, { shopId } = {}) => {
  const normalized = normalizeDataFactoryState(state);
  const shop = normalized.trashedShops.find(item => item.id === shopId);
  if (!shop) return { ok: false, error: 'shop_not_found' };
  const conflict = normalized.platforms.some(item => (
    item.platformType === shop.platformType
    && item.expectedShopName?.trim() === shop.expectedShopName?.trim()
  ));
  if (conflict) return { ok: false, error: 'shop_already_exists' };

  const { authStatusBeforeTrash, autoSyncEnabledBeforeTrash, deletedAt, ...storedShop } = shop;
  const restoredShop = {
    ...storedShop,
    authStatus: 'unauthorized',
    autoSyncEnabled: autoSyncEnabledBeforeTrash !== false,
    egoBinding: storedShop.egoBinding ? {
      ...storedShop.egoBinding,
      shopNameMatched: false,
      verifiedAt: null,
      verification: storedShop.egoBinding.verification ? {
        ...storedShop.egoBinding.verification,
        platformMatched: false,
        urlAllowed: false,
        checkedAt: null
      } : null
    } : null,
    restoredAt: Date.now()
  };
  return {
    ok: true,
    shop: restoredShop,
    state: {
      ...normalized,
      platforms: [...normalized.platforms, restoredShop],
      trashedShops: normalized.trashedShops.filter(item => item.id !== shopId),
      activePlatform: normalized.activePlatform || restoredShop.id
    }
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

export const buildEgoBatchPrompt = ({ shop, rules }) => {
  const fieldLines = rules.map((rule, index) => (
    `${index + 1}. ${rule.fieldName} | 页面位置: ${rule.pagePath || '未填写'} | 操作路径: ${rule.clickPath || '未填写'} | 目标定位: ${rule.recognizedPath || rule.markerNote || '读取当前主数值'}`
  )).join('\n');

  const expectedShopName = shop.expectedShopName || shop.detectedName || shop.name;
  const targetUrl = shop.url || 'https://myseller.taobao.com/home.htm/QnworkbenchHome/';
  const platformLabel = PLATFORM_IDENTITY_DEFAULTS[shop.platformType]?.label || shop.platformType || '未知平台';
  const allowedDomains = normalizeAllowedDomains(shop.allowedDomains);
  const egoBinding = shop.egoBinding || {};
  const boundWindow = egoBinding.taskSpaceId
    ? `${egoBinding.taskSpaceName || 'Ego lite 窗口'} (Task Space ${egoBinding.taskSpaceId})`
    : '未绑定，先按目标平台与店铺名定位或创建专属 Task Space';
  const boundTab = egoBinding.targetId
    ? `${egoBinding.tabTitle || targetUrl} (Tab ${egoBinding.targetId})`
    : (egoBinding.tabTitle || targetUrl);

  return [
    '你是 DataFactory 的 Ego lite 本地采集执行器。请在指定 Ego Task Space 中完成一次批量采集，只做读取，不做提交、删除、付款、发布、改价、授权等写操作。',
    '',
    `目标平台: ${platformLabel}`,
    `目标店铺: ${expectedShopName}`,
    `目标页面: ${targetUrl}`,
    `允许域名: ${allowedDomains.length ? allowedDomains.join(', ') : '未限制'}`,
    `Ego 窗口: ${boundWindow}`,
    `Ego 标签页: ${boundTab}`,
    '',
    '执行步骤:',
    `1. 优先进入已绑定的 Ego Task Space 和标签页；绑定不可用时，只能在同一 Ego 用户配置中按目标平台与店铺名重新定位。打开目标页面。如果当前页面不在允许域名内，必须先进入 ${targetUrl}；如果被带到其他平台或登录页，停止并返回 blocked。`,
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

export const createCollectionRun = (state, { shopId, fieldNames, trigger = 'manual' } = {}) => {
  const normalized = normalizeDataFactoryState(state);
  const shop = findShop(normalized, shopId || normalized.activePlatform);
  if (!shop) return { ok: false, error: 'shop_not_found' };
  if (shop.authStatus !== 'verified') return { ok: false, error: 'shop_not_verified', shop };
  if (!shop.egoBinding?.taskSpaceId) return { ok: false, error: 'ego_window_not_bound', shop };
  if (shop.egoBinding.shopNameMatched !== true) return { ok: false, error: 'ego_window_not_verified', shop };
  if (
    shop.egoBinding.verification?.platformMatched !== true
    || shop.egoBinding.verification?.urlAllowed !== true
    || shop.egoBinding.verification?.loginRequired !== false
  ) return { ok: false, error: 'ego_binding_verification_required', shop };

  const rules = getReadyRules(normalized, shop.id, fieldNames);
  if (rules.length === 0) return { ok: false, error: 'no_ready_rules', shop };

  const now = Date.now();
  const run = {
    id: `RUN-${now.toString().slice(-6)}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`,
    workspaceId: normalized.workspaceId,
    shopId: shop.id,
    createdAt: now,
    time: new Date(now).toLocaleTimeString('zh-CN', { hour12: false, timeZone: 'Asia/Shanghai' }),
    platformId: shop.id,
    platformName: shop.name,
    expectedShopName: shop.expectedShopName,
    detectedName: shop.detectedName,
    trigger,
    status: 'waiting_for_runner',
    statusText: '等待本地执行器连接 Ego lite。',
    rules,
    instruction: '本地执行器读取 egoPrompt，进入店铺绑定的 Ego Task Space 执行采集，再通过 DataFactory API 写回记录。',
    egoBinding: shop.egoBinding || null,
    egoPrompt: buildEgoBatchPrompt({ shop, rules })
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
      statusText: note || '本地执行器已接收任务，正在连接 Ego lite。'
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
      statusText: note || '本地执行器已接收任务，正在连接 Ego lite。'
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

export const normalizeEgoResultPayload = (payload = {}) => {
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
  const fieldErrors = Array.isArray(payload.fields)
    ? payload.fields.filter(field => field?.fieldName && field.status === 'error')
    : [];
  const directData = payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)
    ? payload.data
    : {};

  return {
    ok: true,
    data: { ...directData, ...fieldData },
    status: fieldErrors.length > 0 ? 'error' : 'success',
    fieldErrors,
    shopCalibration: payload.shopCalibration,
    currentUrl: payload.currentUrl,
    dataUpdatedAt: payload.dataUpdatedAt,
    evidence: payload.evidence || `Ego lite 批量采集结果，数据更新时间 ${payload.dataUpdatedAt}`
  };
};

export const writeCollectionRecord = (state, { shopId, shopName, runId, data = {}, status = 'success', source = 'server-api', evidence = '', shopCalibration, currentUrl, dataUpdatedAt = '' } = {}) => {
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
    id: `REC-${now.toString().slice(-6)}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`,
    workspaceId: normalized.workspaceId,
    shopId: shop.id,
    time: new Date(now).toLocaleTimeString('zh-CN', { hour12: false, timeZone: 'Asia/Shanghai' }),
    createdAt: now,
    platform: shop.name,
    status,
    source,
    evidence,
    dataUpdatedAt,
    data: matchedFields.reduce((nextData, fieldName) => {
      nextData[fieldName] = data[fieldName];
      return nextData;
    }, {})
  };

  let marked = false;
  const collectionRequests = (normalized.collectionRequests || []).map(run => {
    const isSameShop = run.shopId === shop.id || run.platformId === shop.id || run.platformName === shop.name;
    const isTargetRun = runId && run.id === runId;
    const canCompleteRun = ['waiting_for_runner', 'waiting_for_codex', 'running'].includes(run.status);
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

export const completeCollectionRunFromEgoPayload = (state, { runId, payload, source = 'ego-lite-runner' } = {}) => {
  const normalized = normalizeDataFactoryState(state);
  const run = (normalized.collectionRequests || []).find(item => item.id === runId);
  if (!run) return { ok: false, error: 'run_not_found', runId };

  const normalizedPayload = normalizeEgoResultPayload(payload);
  if (!normalizedPayload.ok) return normalizedPayload;

  return writeCollectionRecord(normalized, {
    runId,
    shopId: run.shopId || run.platformId,
    data: normalizedPayload.data,
    status: normalizedPayload.status,
    source,
    evidence: normalizedPayload.evidence,
    shopCalibration: normalizedPayload.shopCalibration,
    currentUrl: normalizedPayload.currentUrl,
    dataUpdatedAt: normalizedPayload.dataUpdatedAt
  });
};
