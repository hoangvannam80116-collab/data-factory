import React, { useState, useEffect, useRef } from 'react';
import { ButtonContractAuditor } from './buttonContractAuditor.js';
import {
  Store,
  Database,
  Settings,
  Search,
  CheckCircle2,
  Plus,
  Trash2,
  Download,
  Filter,
  ArrowDownUp,
  RefreshCw,
  Terminal,
  Copy,
  X,
  ShieldAlert,
  Check,
  ChevronDown,
  Bell,
  GripVertical,
  AlignLeft,
  TableProperties,
  PlaySquare,
  Save,
  Lock,
  AlertTriangle,
  Bot,
  ImagePlus,
  MessageSquare,
  ClipboardList,
  Gauge,
  Camera,
  BarChart3,
  Clock,
  ShieldCheck,
  ArchiveRestore
} from 'lucide-react';
import {
  DEFAULT_USER_ID,
  DEFAULT_WORKSPACE_ID,
  INITIAL_HISTORY_RECORDS,
  INITIAL_PLATFORMS,
  INITIAL_TASK_RULES_BY_PLATFORM,
  PLATFORM_IDENTITY_DEFAULTS,
  buildEgoBatchPrompt,
  extractHostname,
  inferAllowedDomains,
  isUrlAllowedForShop,
  normalizeAllowedDomains,
  normalizeDataFactoryState
} from './dataFactoryModel.js';

export default function App() {
  const storageKey = 'data-factory-mvp-state-v2';
  const apiBase = 'http://127.0.0.1:5181';
  const [workspaceId] = useState(DEFAULT_WORKSPACE_ID);
  const [userId] = useState(DEFAULT_USER_ID);
  const [mainView, setMainView] = useState('dashboard');
  const [globalSearch, setGlobalSearch] = useState('');
  const [globalSearchMessage, setGlobalSearchMessage] = useState('');
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  const [platforms, setPlatforms] = useState(INITIAL_PLATFORMS);
  const [trashedShops, setTrashedShops] = useState([]);
  const [activePlatform, setActivePlatform] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(storageKey) || 'null')?.activePlatform || '';
    } catch {
      return '';
    }
  });

  const [isAddShopModalOpen, setIsAddShopModalOpen] = useState(false);
  const [isEgoBindingModalOpen, setIsEgoBindingModalOpen] = useState(false);
  const [isBindingEgo, setIsBindingEgo] = useState(false);
  const [scanError, setScanError] = useState('');
  const [egoResumeRequired, setEgoResumeRequired] = useState(false);
  const [addShopError, setAddShopError] = useState('');
  const [isSavingShop, setIsSavingShop] = useState(false);
  const [shopPendingTrash, setShopPendingTrash] = useState(null);
  const [shopContextMenu, setShopContextMenu] = useState(null);
  const [shopMutationError, setShopMutationError] = useState('');
  const [shopMutationSuccess, setShopMutationSuccess] = useState('');
  const [restoringShopId, setRestoringShopId] = useState('');
  const [newShopForm, setNewShopForm] = useState({
    name: '',
    platformType: 'taobao',
    url: PLATFORM_IDENTITY_DEFAULTS.taobao.url,
    expectedShopName: '',
    allowedDomains: PLATFORM_IDENTITY_DEFAULTS.taobao.allowedDomains.join(', '),
    autoSyncTime: '09:00'
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [collectionError, setCollectionError] = useState('');
  const [localApiStatus, setLocalApiStatus] = useState('checking');
  const [copiedApiPath, setCopiedApiPath] = useState('');

  const [taskRulesByPlatform, setTaskRulesByPlatform] = useState(INITIAL_TASK_RULES_BY_PLATFORM);
  const extractionTasks = taskRulesByPlatform[activePlatform] || [];
  const setExtractionTasks = (updater) => {
    setTaskRulesByPlatform(prev => {
      const currentTasks = prev[activePlatform] || [];
      const nextTasks = typeof updater === 'function' ? updater(currentTasks) : updater;
      return { ...prev, [activePlatform]: nextTasks };
    });
  };

  const [historyRecords, setHistoryRecords] = useState(INITIAL_HISTORY_RECORDS);

  const [activeTaskId, setActiveTaskId] = useState(null);
  const [draggedColIdx, setDraggedColIdx] = useState(null);
  const [selectedRecordIds, setSelectedRecordIds] = useState([]);
  const [tableFilter, setTableFilter] = useState('all');
  const [sortDirection, setSortDirection] = useState('desc');
  const [collectionRequests, setCollectionRequests] = useState([]);
  const [storageReady, setStorageReady] = useState(false);
  const [columnWidths, setColumnWidths] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('data-factory-column-widths') || '{}');
    } catch {
      return {};
    }
  });
  const [resizingColumnId, setResizingColumnId] = useState(null);
  const screenshotInputRef = useRef(null);
  const columnResizeRef = useRef(null);
  const lastServerUpdatedAtRef = useRef(0);
  const applyingRemoteStateRef = useRef(false);
  const emptyFieldForm = {
    fieldName: '',
    prompt: '',
    recognizedPath: '',
    defaultValue: '',
    pagePath: '',
    clickPath: '',
    markerNote: '',
    screenshotUrl: ''
  };
  const [fieldModal, setFieldModal] = useState({
    open: false,
    mode: 'create',
    taskId: null,
    insertIndex: -1,
    error: '',
    form: emptyFieldForm
  });
  const [manualRecordModal, setManualRecordModal] = useState({ open: false, data: {}, error: '' });
  const [pendingDeleteAction, setPendingDeleteAction] = useState(null);

  useEffect(() => {
    const auditor = new ButtonContractAuditor(document);
    window.__DATA_FACTORY_BUTTON_AUDIT__ = auditor;
    return () => {
      delete window.__DATA_FACTORY_BUTTON_AUDIT__;
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('[data-shop-context-menu]')) setShopContextMenu(null);
      if (!event.target.closest('[data-account-menu]')) setIsAccountMenuOpen(false);
      if (!event.target.closest('[data-notifications-menu]')) setIsNotificationsOpen(false);
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('data-factory-column-widths', JSON.stringify(columnWidths));
    } catch (error) {
      console.warn('Failed to persist DataFactory column widths', error);
    }
  }, [columnWidths]);

  useEffect(() => {
    if (!resizingColumnId) return undefined;

    const handlePointerMove = (event) => {
      const resize = columnResizeRef.current;
      if (!resize) return;
      const nextWidth = Math.min(520, Math.max(100, resize.startWidth + event.clientX - resize.startX));
      setColumnWidths(widths => ({ ...widths, [resize.columnId]: nextWidth }));
    };
    const handlePointerUp = () => {
      columnResizeRef.current = null;
      setResizingColumnId(null);
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [resizingColumnId]);

  const getColumnWidth = (columnId) => columnWidths[columnId] || 180;
  const startColumnResize = (event, columnId) => {
    event.preventDefault();
    event.stopPropagation();
    const currentHeader = event.currentTarget.parentElement;
    columnResizeRef.current = {
      columnId,
      startX: event.clientX,
      startWidth: currentHeader.getBoundingClientRect().width
    };
    setResizingColumnId(columnId);
  };
  const renderColumnResizeHandle = (columnId) => (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="拖动调整列宽"
      onPointerDown={(event) => startColumnResize(event, columnId)}
      className="absolute -right-1 top-0 z-50 h-full w-2 cursor-col-resize touch-none group/resize"
    >
      <div className={`mx-auto h-full w-px transition-colors ${resizingColumnId === columnId ? 'bg-[#2954FF]' : 'bg-transparent group-hover/resize:bg-[#2954FF]'}`} />
    </div>
  );

  const activePlatformData = platforms.find(p => p.id === activePlatform);
  const activePlatformName = activePlatformData?.name;
  const getRecordSortValue = (record) => {
    if (record.createdAt) return record.createdAt;
    const idNumber = Number(String(record.id).replace(/\D/g, ''));
    return Number.isNaN(idNumber) ? 0 : idNumber;
  };
  const rawCurrentPlatformRecords = historyRecords.filter(record => (
    record.shopId ? record.shopId === activePlatform : record.platform === activePlatformName
  ));
  const currentPlatformRecords = rawCurrentPlatformRecords
    .filter(record => tableFilter === 'all' || record.status === tableFilter)
    .sort((a, b) => {
      const comparison = getRecordSortValue(a) - getRecordSortValue(b);
      return sortDirection === 'desc' ? -comparison : comparison;
    });
  const latestRecord = [...rawCurrentPlatformRecords].sort((a, b) => getRecordSortValue(b) - getRecordSortValue(a))[0];
  const latestSuccessfulRecord = [...rawCurrentPlatformRecords]
    .filter(record => record.status === 'success')
    .sort((a, b) => getRecordSortValue(b) - getRecordSortValue(a))[0];
  const selectedTask = extractionTasks.find(task => task.id === activeTaskId) || extractionTasks[0];
  const fieldModalTask = extractionTasks.find(task => task.id === fieldModal.taskId);
  const readyRuleCount = extractionTasks.filter(task => task.status === 'ready').length;
  const activeCollectionRequests = collectionRequests.filter(request => (
    request.shopId === activePlatform
    || request.platformId === activePlatform
    || request.platformName === activePlatformName
  ));
  const latestCollectionRequest = activeCollectionRequests[0];
  const pendingCollectionRequest = activeCollectionRequests.find(request => ['waiting_for_runner', 'waiting_for_codex', 'running'].includes(request.status));
  const hasReadyRules = readyRuleCount > 0;
  const hasExecutableRules = activePlatformData?.authStatus === 'verified' && hasReadyRules;
  const hasEgoTaskSpace = Boolean(activePlatformData?.egoBinding?.taskSpaceId);
  const egoVerification = activePlatformData?.egoBinding?.verification;
  const hasEgoBinding = Boolean(
    hasEgoTaskSpace
    && activePlatformData.egoBinding.shopNameMatched === true
    && egoVerification?.platformMatched === true
    && egoVerification?.urlAllowed === true
    && egoVerification?.loginRequired === false
  );
  const isLocalWritebackOnline = localApiStatus === 'online';
  const canRunCollection = hasExecutableRules && hasEgoBinding && isLocalWritebackOnline && !pendingCollectionRequest;
  const canRunFieldModalCollection = fieldModal.open && fieldModal.mode === 'edit' && fieldModalTask?.status === 'ready' && activePlatformData?.authStatus === 'verified' && hasEgoBinding && isLocalWritebackOnline && !pendingCollectionRequest;
  const collectionActionLabel = isRefreshing
    ? '正在校验并创建...'
    : pendingCollectionRequest
      ? pendingCollectionRequest.status === 'running' ? '正在采集' : '等待执行'
      : !hasReadyRules
        ? '请先配置字段'
        : activePlatformData?.authStatus !== 'verified' || !hasEgoBinding
          ? '请先校正店铺'
          : !isLocalWritebackOnline
            ? '服务未连接'
            : '立即采集';
  const platformLabels = { taobao: '淘宝', pdd: '拼多多', jd: '京东', other: '其他' };
  const syncErrorMessages = {
    shop_not_verified: '店铺尚未校正',
    ego_window_not_bound: '尚未绑定 Ego 窗口',
    ego_window_not_verified: 'Ego 窗口与店铺不一致',
    ego_binding_verification_required: '登录或店铺校验已失效',
    no_ready_rules: '没有可采集字段',
    ego_task_space_missing: '绑定的 Ego 窗口不存在',
    ego_window_in_use: 'Ego 窗口正在使用中',
    ego_login_required: '店铺登录已失效',
    shop_name_mismatch: '当前登录的店铺不正确',
    current_url_not_allowed: '当前页面不属于该店铺',
    data_updated_at_required: '页面没有数据更新时间',
    no_field_values_found: '没有读取到字段数据',
    no_matching_ready_field: '返回数据与字段不匹配',
    runner_timeout: '采集超时',
    partial_field_error: '部分字段读取失败'
  };
  const shopNeedsCalibration = activePlatformData?.authStatus !== 'verified' || !hasEgoBinding;
  const latestSyncFailed = !shopNeedsCalibration && latestCollectionRequest?.status === 'error';
  const latestSyncSucceeded = latestCollectionRequest?.status === 'done';
  const shopAttentionText = activePlatformData?.egoBinding?.needsUserLogin
    ? 'Ego 登录已失效，请登录后重新校正'
    : activePlatformData?.authStatus === 'mismatch'
      ? '店铺校验未通过，请重新校正'
      : !hasEgoTaskSpace
        ? '尚未绑定 Ego 店铺窗口'
        : '店铺尚未完成校正';
  const latestSyncErrorText = latestSyncFailed
    ? syncErrorMessages[latestCollectionRequest.error] || latestCollectionRequest.evidence || '本次同步没有完成'
    : '';
  const visibleRecordIds = currentPlatformRecords.map(record => record.id);
  const selectedVisibleRecordIds = selectedRecordIds.filter(id => visibleRecordIds.includes(id));
  const isAllVisibleRecordsSelected = visibleRecordIds.length > 0 && selectedVisibleRecordIds.length === visibleRecordIds.length;

  const resolveCalibration = (platform, detectedName) => {
    const normalizedDetected = detectedName?.trim() || '';
    const normalizedExpected = platform.expectedShopName?.trim() || '';
    if (!normalizedDetected) {
      return { authStatus: 'unauthorized', detectedName: '' };
    }
    if (normalizedExpected && normalizedExpected !== normalizedDetected) {
      return { authStatus: 'mismatch', detectedName: normalizedDetected };
    }
    return {
      authStatus: 'verified',
      detectedName: normalizedDetected,
      expectedShopName: normalizedExpected || normalizedDetected
    };
  };

  const calibratePlatform = (platformId, payload = {}) => {
    setPlatforms(prev => prev.map(platform => {
      if (platform.id !== platformId) return platform;
      const inferredName = payload.detectedName ?? '';
      const calibration = resolveCalibration(platform, inferredName);
      return {
        ...platform,
        ...calibration,
        url: payload.url || platform.url,
        lastCalibratedAt: calibration.authStatus === 'verified' ? new Date().toLocaleTimeString('zh-CN', { hour12: false }) : platform.lastCalibratedAt
      };
    }));
  };

  const handleCalibrateActivePlatform = () => {
    setScanError('');
    setEgoResumeRequired(false);
    setIsEgoBindingModalOpen(true);
  };

  const applyPersistedState = (savedState) => {
    if (!savedState) return;
    const normalizedState = normalizeDataFactoryState(savedState);
    setPlatforms(normalizedState.platforms);
    setTrashedShops(normalizedState.trashedShops);
    setActivePlatform(current => (
      normalizedState.platforms.some(platform => platform.id === current)
        ? current
        : normalizedState.activePlatform
    ));
    setTaskRulesByPlatform(normalizedState.taskRulesByPlatform);
    setHistoryRecords(normalizedState.historyRecords);
    setCollectionRequests(normalizedState.collectionRequests);
  };

  const buildPersistedState = () => ({
    workspaceId,
    userId,
    platforms,
    trashedShops,
    activePlatform,
    taskRulesByPlatform,
    historyRecords,
    collectionRequests
  });

  const persistStateSnapshot = async (state) => {
    const response = await fetch(`${apiBase}/state`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state, expectedUpdatedAt: lastServerUpdatedAtRef.current })
    });
    const payload = await response.json();
    if (response.status === 409 && payload?.state) {
      applyingRemoteStateRef.current = true;
      applyPersistedState(payload.state);
      lastServerUpdatedAtRef.current = payload.updatedAt || 0;
      setTimeout(() => {
        applyingRemoteStateRef.current = false;
      }, 0);
      return { ...payload, conflict: true };
    }
    if (!response.ok || !payload?.ok) throw new Error(payload?.error || 'state_persist_failed');
    setLocalApiStatus('online');
    if (payload.updatedAt) lastServerUpdatedAtRef.current = payload.updatedAt;
    return payload;
  };

  useEffect(() => {
    let mounted = true;

    const restoreState = async () => {
      try {
        const response = await fetch(`${apiBase}/state`);
        const payload = await response.json();
        if (mounted && payload?.state) {
          setLocalApiStatus('online');
          applyingRemoteStateRef.current = true;
          applyPersistedState(payload.state);
          lastServerUpdatedAtRef.current = payload.updatedAt || 0;
          setTimeout(() => {
            applyingRemoteStateRef.current = false;
          }, 0);
        }
      } catch (error) {
        setLocalApiStatus('offline');
        console.warn('Failed to restore DataFactory server state', error);
        try {
          applyPersistedState(JSON.parse(localStorage.getItem(storageKey) || 'null'));
        } catch (storageError) {
          console.warn('Failed to restore local DataFactory state', storageError);
        }
      }

      if (mounted) setStorageReady(true);
    };

    restoreState();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    const checkLocalApi = async () => {
      try {
        const response = await fetch(`${apiBase}/health`, { cache: 'no-store' });
        if (mounted) setLocalApiStatus(response.ok ? 'online' : 'offline');
      } catch {
        if (mounted) setLocalApiStatus('offline');
      }
    };

    checkLocalApi();
    const intervalId = setInterval(checkLocalApi, 5000);
    return () => {
      mounted = false;
      clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    if (applyingRemoteStateRef.current) return;

    const persistedState = buildPersistedState();
    try {
      localStorage.setItem(storageKey, JSON.stringify(persistedState));
    } catch (error) {
      console.warn('Failed to persist DataFactory state', error);
    }

    const { activePlatform: _localActivePlatform, ...sharedState } = persistedState;
    persistStateSnapshot(sharedState)
      .then(payload => {
        if (payload?.updatedAt) lastServerUpdatedAtRef.current = payload.updatedAt;
      })
      .catch(error => {
        setLocalApiStatus('offline');
        console.warn('Failed to persist DataFactory server state', error);
      });
  }, [storageReady, workspaceId, userId, platforms, trashedShops, taskRulesByPlatform, historyRecords, collectionRequests]);

  useEffect(() => {
    if (!storageReady) return;
    try {
      const localState = JSON.parse(localStorage.getItem(storageKey) || '{}');
      localStorage.setItem(storageKey, JSON.stringify({ ...localState, activePlatform }));
    } catch (error) {
      console.warn('Failed to persist selected shop locally', error);
    }
  }, [storageReady, activePlatform]);

  useEffect(() => {
    if (!storageReady) return undefined;

    const intervalId = setInterval(async () => {
      try {
        const response = await fetch(`${apiBase}/state`);
        const payload = await response.json();
        setLocalApiStatus('online');
        if (!payload?.state || !payload.updatedAt || payload.updatedAt <= lastServerUpdatedAtRef.current) return;

        applyingRemoteStateRef.current = true;
        applyPersistedState(payload.state);
        lastServerUpdatedAtRef.current = payload.updatedAt;
        setTimeout(() => {
          applyingRemoteStateRef.current = false;
        }, 0);
      } catch (error) {
        setLocalApiStatus('offline');
        console.warn('Failed to poll DataFactory server state', error);
      }
    }, 1000);

    return () => clearInterval(intervalId);
  }, [storageReady]);

  const markPendingCollectionRequest = ({ nextStatus = 'done', recordId = '', evidence = '' } = {}) => {
    setCollectionRequests(requests => {
      let marked = false;
      return requests.map(request => {
        if (marked || !['waiting_for_runner', 'waiting_for_codex', 'running', 'error'].includes(request.status)) return request;
        marked = true;
        return {
          ...request,
          status: nextStatus,
          completedAt: Date.now(),
          recordId,
          evidence: evidence || request.evidence || ''
        };
      });
    });
  };

  const buildPromptForCollectionRequest = (request) => {
    if (!request) return '';
    if (request.egoPrompt?.trim()) return request.egoPrompt;

    const requestShop = platforms.find(platform => (
      platform.id === request.shopId
      || platform.id === request.platformId
      || platform.name === request.platformName
    )) || activePlatformData;
    const requestRules = Array.isArray(request.rules) && request.rules.length > 0
      ? request.rules
      : extractionTasks.filter(task => task.status === 'ready');

    if (!requestShop || requestRules.length === 0) return '';
    return buildEgoBatchPrompt({ shop: requestShop, rules: requestRules });
  };

  const createCollectionRequest = ({ fieldNames } = {}) => {
    if (activePlatformData?.authStatus !== 'verified') {
      return { ok: false, error: 'platform_not_verified', activePlatformName };
    }
    if (!activePlatformData?.egoBinding?.taskSpaceId) {
      return { ok: false, error: 'ego_window_not_bound', activePlatformName };
    }
    if (activePlatformData.egoBinding.shopNameMatched !== true) {
      return { ok: false, error: 'ego_window_not_verified', activePlatformName };
    }
    if (pendingCollectionRequest) {
      return { ok: false, error: 'pending_collection_request', request: pendingCollectionRequest };
    }
    const targetFieldNames = Array.isArray(fieldNames) && fieldNames.length > 0 ? new Set(fieldNames) : null;
    const rules = extractionTasks.filter(task => (
      task.status === 'ready' && (!targetFieldNames || targetFieldNames.has(task.fieldName))
    ));
    if (rules.length === 0) {
      return { ok: false, error: 'no_ready_rules', activePlatformName };
    }

    const request = {
      id: `RUN-${Date.now().toString().slice(-6)}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`,
      workspaceId,
      shopId: activePlatform,
      createdAt: Date.now(),
      time: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
      platformId: activePlatform,
      platformName: activePlatformName,
      expectedShopName: activePlatformData.expectedShopName,
      detectedName: activePlatformData.detectedName,
      status: 'waiting_for_runner',
      rules,
      instruction: '本地执行器读取 egoPrompt，进入店铺绑定的 Ego Task Space 执行采集，再通过 DataFactory API 写回记录。',
      egoBinding: activePlatformData.egoBinding || null,
      egoPrompt: buildEgoBatchPrompt({ shop: activePlatformData, rules })
    };

    setCollectionRequests(requests => [request, ...requests]);
    setMainView('table');
    return { ok: true, request };
  };

  const writeCollectionResult = ({ data = {}, status = 'success', source = 'ego-lite', evidence = '', shopCalibration, currentUrl } = {}) => {
    if (activePlatformData?.authStatus !== 'verified') {
      return { ok: false, error: 'platform_not_verified', activePlatformName };
    }
    if (shopCalibration) {
      const detectedName = shopCalibration.detectedShopName?.trim() || '';
      const expectedName = activePlatformData.expectedShopName?.trim() || activePlatformData.detectedName?.trim() || '';
      if (shopCalibration.status !== 'verified') {
        return { ok: false, error: 'shop_calibration_not_verified', activePlatformName, shopCalibration };
      }
      if (expectedName && !detectedName) {
        return { ok: false, error: 'shop_name_missing', activePlatformName, shopCalibration };
      }
      if (expectedName && detectedName && detectedName !== expectedName) {
        return { ok: false, error: 'shop_name_mismatch', activePlatformName, shopCalibration };
      }
    }
    if (currentUrl && !isUrlAllowedForShop(activePlatformData, currentUrl)) {
      return { ok: false, error: 'current_url_not_allowed', activePlatformName, currentUrl };
    }
    if (!hasExecutableRules) {
      return { ok: false, error: 'no_executable_rules', activePlatformName };
    }
    const readyFieldNames = new Set(extractionTasks.filter(task => task.status === 'ready').map(task => task.fieldName));
    const matchedFields = Object.keys(data).filter(fieldName => readyFieldNames.has(fieldName));
    if (matchedFields.length === 0) {
      return { ok: false, error: 'no_matching_ready_field', activePlatformName };
    }
    const record = {
      id: `REC-${Date.now().toString().slice(-6)}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`,
      workspaceId,
      shopId: activePlatform,
      time: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
      createdAt: Date.now(),
      platform: activePlatformName,
      status,
      source,
      evidence,
      data: matchedFields.reduce((matchedData, fieldName) => {
        matchedData[fieldName] = data[fieldName];
        return matchedData;
      }, {})
    };
    setHistoryRecords(records => [record, ...records]);
    markPendingCollectionRequest({
      nextStatus: status === 'success' ? 'done' : 'error',
      recordId: record.id,
      evidence
    });
    setExtractionTasks(tasks => tasks.map(task => {
      if (!readyFieldNames.has(task.fieldName) || data[task.fieldName] === undefined) return task;
      return {
        ...task,
        value: data[task.fieldName],
        lastRun: '刚刚',
        confidence: Math.max(task.confidence || 90, 92),
        status: 'ready'
      };
    }));
    setMainView('table');
    return { ok: true, record };
  };

  useEffect(() => {
    window.__DATA_FACTORY_MVP__ = {
      readState: () => ({
        workspaceId,
        userId,
        activePlatform,
        activePlatformName,
        activePlatformData,
        rules: extractionTasks,
        readyRules: extractionTasks.filter(task => task.status === 'ready'),
        hasExecutableRules,
        canRunCollection,
        collectionRequests,
        pendingCollectionRequest,
        records: historyRecords.filter(record => (
          record.shopId ? record.shopId === activePlatform : record.platform === activePlatformName
        ))
      }),
      requestCollection: createCollectionRequest,
      readRule: ({ fieldName, ruleId } = {}) => {
        const rule = extractionTasks.find(task => (
          ruleId !== undefined ? task.id === ruleId : task.fieldName === fieldName
        ));
        return rule ? { ok: true, rule, activePlatformName, activePlatformData } : { ok: false, error: 'rule_not_found' };
      },
      calibrateShop: ({ platformId = activePlatform, detectedName, url } = {}) => {
        const platform = platforms.find(item => item.id === platformId);
        if (!platform) return { ok: false, error: 'platform_not_found' };
        const calibration = resolveCalibration(platform, detectedName);
        calibratePlatform(platformId, { detectedName, url });
        return { ok: true, platformId, ...calibration };
      },
      writeRecord: writeCollectionResult,
      writeFieldResult: ({ fieldName, ruleId, value, status = 'success', source = 'ego-lite', evidence = '' } = {}) => {
        const rule = extractionTasks.find(task => (
          ruleId !== undefined ? task.id === ruleId : task.fieldName === fieldName
        ));
        if (!rule) return { ok: false, error: 'rule_not_found' };
        return window.__DATA_FACTORY_MVP__.writeRecord({
          data: { [rule.fieldName]: value },
          status,
          source,
          evidence
        });
      }
    };

    return () => {
      delete window.__DATA_FACTORY_MVP__;
    };
  }, [workspaceId, userId, activePlatform, activePlatformName, activePlatformData, canRunCollection, collectionRequests, extractionTasks, hasExecutableRules, historyRecords, pendingCollectionRequest, platforms]);

  useEffect(() => {
    if (activePlatformData) {
      setActiveTaskId(null);
      setSelectedRecordIds([]);
    }
  }, [activePlatformData]);

  const openAddShopModal = () => {
    setAddShopError('');
    setIsAddShopModalOpen(true);
  };

  const handleNewShopPlatformChange = (platformType) => {
    const defaults = PLATFORM_IDENTITY_DEFAULTS[platformType] || PLATFORM_IDENTITY_DEFAULTS.other;
    setNewShopForm(form => ({
      ...form,
      platformType,
      url: defaults.url,
      allowedDomains: defaults.allowedDomains.join(', ')
    }));
  };

  const handleAddShopSubmit = async () => {
    if (isSavingShop) return;
    const displayName = newShopForm.name.trim();
    const expectedShopName = newShopForm.expectedShopName.trim();
    const url = newShopForm.url.trim();
    if (!displayName || !expectedShopName || !extractHostname(url)) {
      setAddShopError('请填写店铺名称、后台入口和用于校验的实际店铺名。');
      return;
    }
    const isDuplicate = [...platforms, ...trashedShops].some(platform => (
      platform.platformType === newShopForm.platformType
      && platform.expectedShopName?.trim() === expectedShopName
    ));
    if (isDuplicate) {
      const isInTrash = trashedShops.some(shop => shop.platformType === newShopForm.platformType && shop.expectedShopName?.trim() === expectedShopName);
      setAddShopError(isInTrash ? '这个店铺已在回收站，请先到回收站恢复。' : '这个平台和店铺名已经存在，请直接进入已有店铺绑定 Ego 窗口。');
      return;
    }
    const allowedDomains = normalizeAllowedDomains(newShopForm.allowedDomains);
    const input = {
      platformType: newShopForm.platformType || 'other',
      name: displayName,
      url,
      expectedShopName,
      allowedDomains: allowedDomains.length ? allowedDomains : inferAllowedDomains({ platformType: newShopForm.platformType, url }),
      autoSyncEnabled: true,
      autoSyncTime: newShopForm.autoSyncTime || '09:00'
    };
    setIsSavingShop(true);
    setAddShopError('');
    try {
      const response = await fetch(`${apiBase}/shops`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input)
      });
      const payload = await response.json();
      if (!response.ok || !payload?.ok || !payload.state) throw new Error(payload?.error || 'shop_create_failed');
      applyingRemoteStateRef.current = true;
      applyPersistedState(payload.state);
      lastServerUpdatedAtRef.current = payload.updatedAt || 0;
      setTimeout(() => { applyingRemoteStateRef.current = false; }, 0);
      setNewShopForm({
        name: '',
        platformType: 'taobao',
        url: PLATFORM_IDENTITY_DEFAULTS.taobao.url,
        expectedShopName: '',
        allowedDomains: PLATFORM_IDENTITY_DEFAULTS.taobao.allowedDomains.join(', '),
        autoSyncTime: '09:00'
      });
      setIsAddShopModalOpen(false);
      setMainView('dashboard');
      setIsEgoBindingModalOpen(true);
      setLocalApiStatus('online');
    } catch (error) {
      const message = error.message === 'shop_in_trash'
        ? '这个店铺已在回收站，请先恢复。'
        : error.message === 'shop_already_exists'
          ? '这个店铺已存在。'
          : '店铺没有保存成功，请确认本地接口已连接后重试。';
      setAddShopError(message);
    } finally {
      setIsSavingShop(false);
    }
  };

  const applyShopMutationResponse = (payload) => {
    applyingRemoteStateRef.current = true;
    applyPersistedState(payload.state);
    lastServerUpdatedAtRef.current = payload.updatedAt || 0;
    setTimeout(() => { applyingRemoteStateRef.current = false; }, 0);
  };

  const handleMoveShopToTrash = async () => {
    if (!shopPendingTrash) return;
    setShopMutationError('');
    try {
      const response = await fetch(`${apiBase}/shops/${encodeURIComponent(shopPendingTrash.id)}`, { method: 'DELETE' });
      const payload = await response.json();
      if (!response.ok || !payload?.ok || !payload.state) throw new Error(payload?.error || 'shop_trash_failed');
      applyShopMutationResponse(payload);
      setShopPendingTrash(null);
      setMainView(payload.state.platforms.length > 0 ? 'dashboard' : 'trash');
    } catch {
      setShopMutationError('移入回收站失败，请确认本地接口已连接。');
    }
  };

  const handleRestoreShop = async (shopId) => {
    setShopMutationError('');
    setShopMutationSuccess('');
    setRestoringShopId(shopId);
    try {
      const response = await fetch(`${apiBase}/trash/${encodeURIComponent(shopId)}/restore`, { method: 'POST' });
      const payload = await response.json();
      if (!response.ok || !payload?.ok || !payload.state) throw new Error(payload?.error || 'shop_restore_failed');
      applyShopMutationResponse(payload);
      setShopMutationSuccess('店铺已恢复。为确保不会采集错店，请重新校正 Ego Lite 店铺窗口。');
    } catch {
      setShopMutationError('恢复店铺失败，请稍后重试。');
    } finally {
      setRestoringShopId('');
    }
  };

  const openEgoBindingModal = () => {
    setScanError('');
    setEgoResumeRequired(false);
    setIsEgoBindingModalOpen(true);
  };

  const bindActiveShopToEgo = async ({ resume = false } = {}) => {
    if (!activePlatformData || isBindingEgo) return;
    setIsBindingEgo(true);
    setScanError('');
    try {
      const response = await fetch(`${apiBase}/runner/ego-bind`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shopId: activePlatformData.id, resume })
      });
      const payload = await response.json();
      if (response.status === 409 && payload?.error === 'ego_user_control') {
        setEgoResumeRequired(true);
        setScanError(payload.message || '请先在 Ego lite 完成登录，再继续校准。');
        return;
      }
      if (!response.ok || !payload?.ok || !payload.shop) {
        throw new Error(payload?.error || 'ego_bind_failed');
      }
      setPlatforms(items => items.map(item => item.id === payload.shop.id ? payload.shop : item));
      if (payload.requiresUserAction) {
        setEgoResumeRequired(true);
        setScanError(payload.message || '请在专属 Ego 窗口完成登录或切换到正确店铺，然后重新校验。');
      } else {
        setEgoResumeRequired(false);
        setScanError('');
      }
    } catch (error) {
      setScanError(error.message || '无法创建 Ego lite 店铺窗口');
    } finally {
      setIsBindingEgo(false);
    }
  };

  const buildFieldFormFromTask = (task = {}) => ({
    fieldName: task.fieldName || '',
    prompt: task.prompt || '',
    recognizedPath: task.recognizedPath || '',
    defaultValue: task.value || '',
    pagePath: task.pagePath || '',
    clickPath: task.clickPath || '',
    markerNote: task.markerNote || '',
    screenshotUrl: task.screenshotUrl || ''
  });

  const openCreateFieldModal = (insertIndex = -1) => {
    setMainView('table');
    setFieldModal({
      open: true,
      mode: 'create',
      taskId: null,
      insertIndex,
      error: '',
      form: {
        ...emptyFieldForm,
        pagePath: activePlatformData?.url || '',
        clickPath: activePlatformData?.platformType ? `${platformLabels[activePlatformData.platformType]}后台入口` : ''
      }
    });
  };

  const openEditFieldModal = (task) => {
    setMainView('table');
    setActiveTaskId(task.id);
    setFieldModal({
      open: true,
      mode: 'edit',
      taskId: task.id,
      insertIndex: -1,
      error: '',
      form: buildFieldFormFromTask(task)
    });
  };

  const closeFieldModal = () => {
    setFieldModal(prev => ({ ...prev, open: false }));
  };

  const updateFieldModalForm = (patch) => {
    setFieldModal(prev => ({ ...prev, error: '', form: { ...prev.form, ...patch } }));
  };

  const applyScreenshotFile = (file) => {
    if (!file?.type?.startsWith('image/')) return false;
    const reader = new FileReader();
    reader.onload = () => {
      const fieldName = fieldModal.form.fieldName.trim() || '目标字段';
      updateFieldModalForm({
        screenshotUrl: reader.result,
        markerNote: fieldModal.form.markerNote || `已上传带标记截图，请识别「${fieldName}」对应的目标数值区域。`,
        recognizedPath: fieldModal.form.recognizedPath || `标记截图中「${fieldName}」附近的主数值`
      });
    };
    reader.readAsDataURL(file);
    return true;
  };

  const handleScreenshotUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    applyScreenshotFile(file);
    event.target.value = '';
  };

  useEffect(() => {
    if (!fieldModal.open) return undefined;

    const handleScreenshotPaste = (event) => {
      const clipboardItems = Array.from(event.clipboardData?.items || []);
      const imageItem = clipboardItems.find(item => item.kind === 'file' && item.type.startsWith('image/'));
      const imageFile = imageItem?.getAsFile();
      if (!imageFile) return;

      event.preventDefault();
      applyScreenshotFile(imageFile);
    };

    document.addEventListener('paste', handleScreenshotPaste);
    return () => document.removeEventListener('paste', handleScreenshotPaste);
  }, [fieldModal.open, fieldModal.form.fieldName, fieldModal.form.markerNote, fieldModal.form.recognizedPath]);

  const applyFieldPreset = (fieldName) => {
    const buildStoreMetricPreset = (name, valueType = '数字文本') => ({
      fieldName: name,
      prompt: `进入千牛商家工作台首页后，必须先执行一次浏览器刷新/重新加载，等待「店铺数据」模块和「数据更新时间」更新完成，再读取「${name}」卡片里的当前主数值。只返回${valueType}，不要读取昨日值或刷新前旧值。`,
      pagePath: `千牛商家工作台 > 首页 > 店铺数据 > ${name}`,
      clickPath: '左侧导航：首页',
      recognizedPath: `店铺数据 > ${name} > 当前主数值`,
      markerNote: `箭头指向店铺数据区域「${name}」卡片里的主数值。`
    });
    const presetMap = {
      支付金额: buildStoreMetricPreset('支付金额'),
      访客数: buildStoreMetricPreset('访客数'),
      支付子订单数: buildStoreMetricPreset('支付子订单数'),
      支付转化率: buildStoreMetricPreset('支付转化率', '百分比文本'),
      浏览量: buildStoreMetricPreset('浏览量'),
      加购人数: buildStoreMetricPreset('加购人数'),
      客单价: buildStoreMetricPreset('客单价'),
      支付买家数: buildStoreMetricPreset('支付买家数')
    };
    updateFieldModalForm(presetMap[fieldName] || { fieldName });
  };

  const handleFieldModalConfirm = () => {
    const form = fieldModal.form;
    const fieldName = form.fieldName.trim();
    if (!fieldName) return;
    const duplicateField = extractionTasks.some(task => (
      task.id !== fieldModal.taskId && task.fieldName.trim().toLowerCase() === fieldName.toLowerCase()
    ));
    if (duplicateField) {
      setFieldModal(prev => ({ ...prev, error: `字段「${fieldName}」已经存在，请换一个名称。` }));
      return;
    }

    const recognizedPath = form.recognizedPath.trim() || `标题「${fieldName}」附近的主数值`;
    const isReady = Boolean(form.prompt.trim());
    const markerNote = form.markerNote.trim().replaceAll('目标字段', fieldName);
    const taskPayload = {
      fieldName,
      value: fieldModal.mode === 'edit' ? (form.defaultValue.trim() || null) : null,
      prompt: form.prompt.trim(),
      pagePath: form.pagePath.trim() || activePlatformData?.url || '店铺后台首页',
      clickPath: form.clickPath.trim(),
      screenshot: form.screenshotUrl || markerNote ? 'annotated' : null,
      screenshotUrl: form.screenshotUrl || '',
      markerNote,
      recognizedPath,
      confidence: form.screenshotUrl ? 88 : 80,
      status: isReady ? 'ready' : 'draft'
    };

    if (fieldModal.mode === 'edit') {
      setExtractionTasks(tasks => tasks.map(task => task.id === fieldModal.taskId ? { ...task, ...taskPayload } : task));
      setActiveTaskId(fieldModal.taskId);
    } else {
      const newTask = { id: `field_${Date.now()}`, ...taskPayload };
      setExtractionTasks(tasks => {
        const nextTasks = [...tasks];
        if (fieldModal.insertIndex === -1) nextTasks.push(newTask);
        else nextTasks.splice(fieldModal.insertIndex, 0, newTask);
        return nextTasks;
      });
      setActiveTaskId(newTask.id);
    }

    setMainView('table');
    closeFieldModal();
  };

  const handleAddColumn = (insertIndex = -1) => {
    openCreateFieldModal(insertIndex);
  };

  const removeTask = (id) => {
    setExtractionTasks(tasks => tasks.filter(t => t.id !== id));
    if (activeTaskId === id) setActiveTaskId(null);
  };

  const requestRemoveTask = (task) => {
    setPendingDeleteAction({ type: 'field', id: task.id, label: task.fieldName });
  };

  const toggleSelectAllRows = () => {
    setSelectedRecordIds(prev => {
      if (isAllVisibleRecordsSelected) {
        return prev.filter(id => !visibleRecordIds.includes(id));
      }
      return [...new Set([...prev, ...visibleRecordIds])];
    });
  };

  const toggleSelectRow = (recordId) => {
    setSelectedRecordIds(prev => (
      prev.includes(recordId) ? prev.filter(id => id !== recordId) : [...prev, recordId]
    ));
  };

  const deleteRecords = (recordIds) => {
    if (recordIds.length === 0) return;
    setHistoryRecords(records => records.filter(record => !recordIds.includes(record.id)));
    setSelectedRecordIds(prev => prev.filter(id => !recordIds.includes(id)));
  };


  const requestDeleteRecords = (recordIds) => {
    if (recordIds.length === 0) return;
    setPendingDeleteAction({ type: 'records', ids: recordIds });
  };

  const confirmDeleteAction = () => {
    if (pendingDeleteAction?.type === 'records') {
      deleteRecords(pendingDeleteAction.ids);
    }
    if (pendingDeleteAction?.type === 'field') {
      removeTask(pendingDeleteAction.id);
      if (fieldModal.open && fieldModal.taskId === pendingDeleteAction.id) closeFieldModal();
    }
    setPendingDeleteAction(null);
  };

  const handleAddManualRecord = () => {
    const emptyData = extractionTasks.reduce((data, task) => {
      data[task.fieldName] = '';
      return data;
    }, {});
    setManualRecordModal({ open: true, data: emptyData, error: '' });
  };

  const saveManualRecord = () => {
    const data = Object.fromEntries(Object.entries(manualRecordModal.data).filter(([, value]) => String(value).trim() !== ''));
    if (Object.keys(data).length === 0) {
      setManualRecordModal(modal => ({ ...modal, error: '请至少填写一个字段后再保存。' }));
      return;
    }
    setHistoryRecords(records => [
      {
        id: `REC-${Date.now().toString().slice(-6)}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`,
        workspaceId,
        shopId: activePlatform,
        time: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
        createdAt: Date.now(),
        platform: activePlatformName,
        status: 'success',
        source: 'manual-entry',
        evidence: '运营人员在 DataFactory 手动录入。',
        data
      },
      ...records
    ]);
    setManualRecordModal({ open: false, data: {}, error: '' });
  };

  const handleExportRecords = () => {
    const headers = ['记录 ID', '提取时间', '状态', '来源', '页面数据时间', '采集证据', ...extractionTasks.map(task => task.fieldName)];
    const rows = currentPlatformRecords.map(record => [
      record.id,
      record.time,
      record.status === 'success' ? '成功' : '异常',
      record.source || '',
      record.dataUpdatedAt || '',
      record.evidence || '',
      ...extractionTasks.map(task => record.data[task.fieldName] ?? '')
    ]);
    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replaceAll('"', '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${activePlatformName || 'datafactory'}-records.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const copyApiEndpoint = async (path, copiedKey = path) => {
    const value = `${apiBase}${path}`;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedApiPath(copiedKey);
      setTimeout(() => setCopiedApiPath(''), 1600);
    } catch (error) {
      console.warn('Failed to copy API endpoint', error);
    }
  };

  const updateActiveShopPreference = (patch) => {
    setPlatforms(items => items.map(item => item.id === activePlatform ? { ...item, ...patch } : item));
  };

  const persistNewCollectionRequest = async ({ fieldNames } = {}) => {
    const response = await fetch(`${apiBase}/collection-runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shopId: activePlatform,
        fieldNames,
        trigger: 'manual'
      })
    });
    const payload = await response.json();
    if (!response.ok || !payload?.ok || !payload.run) throw new Error(payload?.error || 'collection_run_create_failed');
    if (payload.updatedAt) lastServerUpdatedAtRef.current = payload.updatedAt;
    setCollectionRequests(requests => [payload.run, ...requests.filter(item => item.id !== payload.run.id)]);
    return payload.run;
  };

  const preflightActiveShopEgo = async () => {
    const response = await fetch(`${apiBase}/runner/ego-bind`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shopId: activePlatform, resume: false })
    });
    const payload = await response.json();
    if (payload?.shop) setPlatforms(items => items.map(item => item.id === payload.shop.id ? payload.shop : item));
    if (!response.ok || !payload?.ok) throw new Error(payload?.message || payload?.error || 'ego_preflight_failed');
    if (payload.requiresUserAction || !payload.shopNameMatched) {
      throw new Error(payload.message || 'Ego Lite 登录或店铺身份校验未通过，请重新校正。');
    }
  };

  const handleRunEgoCollection = async () => {
    if (isRefreshing) return;
    if (!canRunCollection) {
      setCollectionError(collectionActionLabel);
      return;
    }
    setIsRefreshing(true);
    setCollectionError('');
    try {
      await preflightActiveShopEgo();
      await persistNewCollectionRequest();
    } catch (error) {
      setCollectionError(syncErrorMessages[error.message] || error.message || '采集任务未创建，请检查本地接口和 Ego Lite。');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleRunFieldModalCollection = async () => {
    if (isRefreshing || !canRunFieldModalCollection) return;
    setIsRefreshing(true);
    setCollectionError('');
    try {
      await preflightActiveShopEgo();
      await persistNewCollectionRequest({ fieldNames: [fieldModalTask.fieldName] });
    } catch (error) {
      setCollectionError(syncErrorMessages[error.message] || error.message || '这一列没有开始采集，请检查本地接口和 Ego Lite。');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleDragStart = (e, index) => {
    setDraggedColIdx(index);
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };
  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    if (draggedColIdx === null || draggedColIdx === dropIndex) return;
    const newTasks = [...extractionTasks];
    const [draggedItem] = newTasks.splice(draggedColIdx, 1);
    newTasks.splice(dropIndex, 0, draggedItem);
    setExtractionTasks(newTasks);
    setDraggedColIdx(null);
  };

  const handleGlobalSearch = (event) => {
    if (event.key !== 'Enter') return;
    const keyword = globalSearch.trim().toLowerCase();
    if (!keyword) return;
    const matchedShop = platforms.find(shop => [shop.name, shop.expectedShopName, platformLabels[shop.platformType]].some(value => String(value || '').toLowerCase().includes(keyword)));
    if (matchedShop) {
      setActivePlatform(matchedShop.id);
      setMainView('dashboard');
      setGlobalSearchMessage(`已打开店铺：${matchedShop.name}`);
      return;
    }
    for (const [shopId, rules] of Object.entries(taskRulesByPlatform)) {
      const matchedRule = (rules || []).find(rule => rule.fieldName?.toLowerCase().includes(keyword));
      const shop = platforms.find(item => item.id === shopId);
      if (matchedRule && shop) {
        setActivePlatform(shop.id);
        setActiveTaskId(matchedRule.id);
        setMainView('table');
        setFieldModal({
          open: true,
          mode: 'edit',
          taskId: matchedRule.id,
          insertIndex: -1,
          error: '',
          form: buildFieldFormFromTask(matchedRule)
        });
        setGlobalSearchMessage(`已找到「${shop.name}」的字段：${matchedRule.fieldName}`);
        return;
      }
    }
    setGlobalSearchMessage(`未找到与「${globalSearch.trim()}」相关的店铺或字段`);
  };

  const attentionShops = platforms.filter(shop => shop.authStatus !== 'verified');
  const recentFailedRuns = collectionRequests.filter(run => run.status === 'error').slice(0, 3);

  const pendingCollectionPrompt = buildPromptForCollectionRequest(pendingCollectionRequest);
  const agentBridgePayload = {
    workspaceId,
    userId,
    activePlatform,
    activePlatformName,
    shop: activePlatformData ? {
      id: activePlatformData.id,
      name: activePlatformData.name,
      platformType: activePlatformData.platformType,
      expectedShopName: activePlatformData.expectedShopName,
      detectedName: activePlatformData.detectedName,
      authStatus: activePlatformData.authStatus,
      url: activePlatformData.url,
      allowedDomains: activePlatformData.allowedDomains
    } : null,
    readyRules: extractionTasks
      .filter(task => task.status === 'ready')
      .map(task => ({
        id: task.id,
        fieldName: task.fieldName,
        prompt: task.prompt,
        pagePath: task.pagePath,
        clickPath: task.clickPath,
        recognizedPath: task.recognizedPath,
        markerNote: task.markerNote,
        value: task.value,
        status: task.status
      })),
    pendingCollectionRequest: pendingCollectionRequest ? {
      id: pendingCollectionRequest.id,
      status: pendingCollectionRequest.status,
      createdAt: pendingCollectionRequest.createdAt,
      platformName: pendingCollectionRequest.platformName,
      expectedShopName: pendingCollectionRequest.expectedShopName,
      detectedName: pendingCollectionRequest.detectedName,
      egoPrompt: pendingCollectionPrompt
    } : null,
    latestRecord: latestRecord ? {
      id: latestRecord.id,
      time: latestRecord.time,
      status: latestRecord.status,
      data: latestRecord.data
    } : null
  };

  const tableDataWidth = 48
    + getColumnWidth('record-id')
    + getColumnWidth('extracted-at')
    + extractionTasks.reduce((total, task) => total + getColumnWidth(task.id), 0);

  return (
    <div className="flex flex-col h-screen bg-[#F2F3F5] font-sans text-[#1D2129] overflow-hidden relative">
      <textarea
        id="data-factory-agent-state"
        readOnly
        aria-hidden="true"
        tabIndex={-1}
        value={JSON.stringify(agentBridgePayload)}
        className="fixed left-[-9999px] top-0 h-px w-px opacity-0 pointer-events-none"
      />
      <style>{`
        .customized-scrollbar::-webkit-scrollbar { width: 12px; height: 12px; }
        .customized-scrollbar::-webkit-scrollbar-track { background: #FAFAFA; border-top: 1px solid #E5E6EB; border-left: 1px solid #E5E6EB; }
        .customized-scrollbar::-webkit-scrollbar-thumb { background-color: #C9CDD4; border-radius: 6px; border: 3px solid #FAFAFA; background-clip: padding-box; }
        .customized-scrollbar::-webkit-scrollbar-thumb:hover { background-color: #86909C; }
        .customized-scrollbar::-webkit-scrollbar-corner { background: #FAFAFA; }
      `}</style>

      {collectionError && (
        <div role="alert" className="absolute right-5 top-16 z-[70] max-w-sm bg-red-50 border border-red-200 text-red-700 rounded shadow-lg px-4 py-3 text-[12px] flex items-start gap-3">
          <span className="flex-1">{collectionError}</span>
          <button onClick={() => setCollectionError('')} aria-label="关闭错误提示"><X size={14} /></button>
        </div>
      )}

      <div className="h-[52px] bg-[#2954FF] flex items-center justify-between px-5 text-white shrink-0 z-30 shadow-sm">
        <div className="flex items-center gap-8 h-full">
          <button onClick={() => setMainView('dashboard')} aria-label="返回 DataFactory 仪表盘" className="flex items-center gap-2 font-bold text-lg cursor-pointer">
            <Database size={20} /> DataFactory <span className="text-[13px] font-normal opacity-80 ml-1">数据工厂</span>
          </button>
        </div>
        <div className="flex items-center gap-5">
          <div className="relative flex items-center bg-white/10 hover:bg-white/20 border border-white/10 transition-colors rounded px-3 py-1.5 w-64">
            <Search size={14} className="opacity-70 mr-2" />
            <input value={globalSearch} onChange={(event) => { setGlobalSearch(event.target.value); setGlobalSearchMessage(''); }} onKeyDown={handleGlobalSearch} type="text" placeholder="搜店铺或字段，回车打开" className="bg-transparent border-none outline-none text-xs text-white placeholder:text-white/60 w-full" />
            {globalSearchMessage && <div className="absolute left-0 top-[38px] z-50 w-72 bg-white border border-[#E5E6EB] rounded shadow-lg px-3 py-2 text-[12px] text-[#4E5969]">{globalSearchMessage}</div>}
          </div>
          <div className="h-4 w-px bg-white/20" />
          <div data-notifications-menu className="relative">
            <button onClick={(event) => { event.stopPropagation(); setIsNotificationsOpen(open => !open); setIsAccountMenuOpen(false); }} aria-label="打开运营提醒" className="relative flex items-center justify-center w-8 h-8 rounded hover:bg-white/10">
              <Bell size={16} className="opacity-80" />
              {(attentionShops.length + recentFailedRuns.length) > 0 && <span className="absolute right-0.5 top-0.5 w-2 h-2 rounded-full bg-amber-400 border border-[#2954FF]" />}
            </button>
            {isNotificationsOpen && (
              <div onClick={(event) => event.stopPropagation()} className="absolute right-0 top-10 z-50 w-72 bg-white border border-[#E5E6EB] rounded shadow-lg p-3 text-[#1D2129]">
                <div className="text-[13px] font-bold">运营提醒</div>
                <div className="mt-2 text-[12px] text-[#4E5969]">待校正店铺 {attentionShops.length} 家，近期失败任务 {recentFailedRuns.length} 条。</div>
                {attentionShops.slice(0, 3).map(shop => <button key={shop.id} onClick={() => { setActivePlatform(shop.id); setMainView('dashboard'); setIsNotificationsOpen(false); }} className="mt-2 block w-full text-left px-2 py-1.5 rounded bg-amber-50 hover:bg-amber-100 text-[12px] text-amber-800">{shop.name}：需要校正</button>)}
              </div>
            )}
          </div>
          <div data-account-menu className="relative">
            <button onClick={(event) => { event.stopPropagation(); setIsAccountMenuOpen(open => !open); setIsNotificationsOpen(false); }} aria-label="打开本机工作区信息" className="flex items-center gap-2 cursor-pointer hover:bg-white/10 py-1 px-2 rounded transition-colors">
              <div className="w-6 h-6 rounded-full bg-blue-400 border border-white/20 flex items-center justify-center text-xs font-bold shadow-sm">本</div>
              <span className="text-[13px]">本机</span>
              <ChevronDown size={14} className="opacity-70" />
            </button>
            {isAccountMenuOpen && (
              <div onClick={(event) => event.stopPropagation()} className="absolute right-0 top-10 z-50 w-72 bg-white border border-[#E5E6EB] rounded shadow-lg p-4 text-[#1D2129]">
                <div className="text-[13px] font-bold">当前为本机工作区</div>
                <div className="mt-1 text-[12px] text-[#86909C]">{workspaceId}</div>
                <div className="mt-3 bg-blue-50 border border-blue-100 rounded px-3 py-2 text-[12px] text-[#4E5969]">单机模式：店铺、规则和记录只保存在这台电脑，不连接云端账号。</div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-60 bg-white border-r border-[#E5E6EB] flex flex-col shrink-0 z-20">
          <div className="flex-1 overflow-y-auto py-5">
            <div className="px-5 text-xs font-medium text-[#86909C] mb-3">店铺</div>
            <div className="space-y-1 px-3">
              {platforms.map(p => {
                const latestShopRun = collectionRequests.find(request => (
                  request.shopId === p.id || request.platformId === p.id || request.platformName === p.name
                ));
                const shopSyncFailed = p.authStatus === 'verified' && latestShopRun?.status === 'error';
                const displayedShopMismatch = p.authStatus === 'mismatch'
                  && p.detectedName
                  && p.expectedShopName
                  && p.detectedName !== p.expectedShopName;
                return (
                <div
                  key={p.id}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    setShopContextMenu({ shop: p, x: event.clientX, y: event.clientY });
                  }}
                  className={`flex items-center rounded transition-colors ${
                    activePlatform === p.id && !['api', 'settings', 'trash'].includes(mainView)
                      ? 'bg-[#F2F3F5] text-[#2954FF]'
                      : 'text-[#4E5969] hover:bg-[#F2F3F5]'
                  }`}
                >
                  <button
                    onClick={() => {
                      setActivePlatform(p.id);
                      if (['api', 'settings', 'trash'].includes(mainView)) setMainView('table');
                    }}
                    aria-label={`打开店铺：${p.name}；右键管理店铺`}
                    title="左键打开，右键管理店铺"
                    className={`min-w-0 flex-1 flex items-center gap-3 px-3 py-2.5 text-[13px] ${activePlatform === p.id ? 'font-medium' : ''}`}
                  >
                    <Store size={15} className="shrink-0" />
                    <span className="min-w-0 flex-1 text-left">
                      <span className="block truncate">{p.name}</span>
                      <span className={`block truncate text-[11px] font-normal ${
                        p.authStatus === 'mismatch' || shopSyncFailed ? 'text-red-500' : p.authStatus === 'verified' ? 'text-green-600' : 'text-[#86909C]'
                      }`}>
                        {displayedShopMismatch
                          ? `店铺不匹配: ${p.detectedName}`
                          : p.authStatus === 'mismatch'
                            ? '校验未完成，请重新校正'
                          : shopSyncFailed
                            ? '同步失败，请校正'
                            : p.authStatus === 'verified'
                              ? `${p.detectedName} · 每天 ${p.autoSyncTime || '09:00'}`
                              : `${platformLabels[p.platformType] || '平台'} 待校正`}
                      </span>
                    </span>
                    {p.authStatus === 'verified' && !shopSyncFailed && <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_4px_rgba(34,197,94,0.6)] shrink-0" />}
                    {(p.authStatus === 'mismatch' || shopSyncFailed) && <div className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_4px_rgba(239,68,68,0.6)] shrink-0" />}
                  </button>
                </div>
              )})}
              <button
                onClick={openAddShopModal}
                className="w-full flex items-center gap-2 px-3 py-2 mt-3 rounded border border-dashed border-[#E5E6EB] text-[#86909C] hover:text-[#2954FF] hover:border-[#2954FF] hover:bg-blue-50 transition-colors text-[13px]"
              >
                <Plus size={14} /> 添加店铺
              </button>
              <button
                onClick={openEgoBindingModal}
                className="w-full flex items-center gap-2 px-3 py-2 rounded text-[#4E5969] hover:text-[#2954FF] hover:bg-blue-50 transition-colors text-[13px]"
              >
                <RefreshCw size={14} /> 校正当前店铺
              </button>
            </div>

            <div className="mt-8 px-5 text-xs font-medium text-[#86909C] mb-3">系统开放</div>
            <div className="space-y-1 px-3">
              <button
                onClick={() => setMainView('api')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded text-[13px] transition-colors ${mainView === 'api' ? 'bg-[#F2F3F5] text-[#2954FF] font-medium' : 'text-[#4E5969] hover:bg-[#F2F3F5]'}`}
              >
                <Terminal size={15} className="shrink-0" />
                <span className="flex-1 text-left">API 接口对接</span>
              </button>
              <button
                onClick={() => setMainView('trash')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded text-[13px] transition-colors ${mainView === 'trash' ? 'bg-[#F2F3F5] text-[#2954FF] font-medium' : 'text-[#4E5969] hover:bg-[#F2F3F5]'}`}
              >
                <Trash2 size={15} className="shrink-0" />
                <span className="flex-1 text-left">回收站</span>
                {trashedShops.length > 0 && <span className="min-w-5 h-5 px-1 rounded-full bg-[#F2F3F5] text-[11px] flex items-center justify-center">{trashedShops.length}</span>}
              </button>
              <button
                onClick={() => setMainView('settings')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded text-[13px] transition-colors ${mainView === 'settings' ? 'bg-[#F2F3F5] text-[#2954FF] font-medium' : 'text-[#4E5969] hover:bg-[#F2F3F5]'}`}
              >
                <Settings size={15} className="shrink-0" />
                <span className="flex-1 text-left">偏好设置</span>
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col min-w-0 relative">
          <div className="h-[48px] bg-white border-b border-[#E5E6EB] flex items-center justify-between px-6 z-10 shrink-0 shadow-sm">
            <div className="flex items-center h-full min-w-0">
              {['api', 'settings', 'trash'].includes(mainView) ? (
                <div className="text-[14px] font-bold text-[#1D2129]">
                  {mainView === 'api' ? 'API 接口对接' : mainView === 'trash' ? '回收站' : '偏好设置'}
                </div>
              ) : (
                <div className="flex items-center h-full gap-8 shrink-0">
                  <button
                    onClick={() => setMainView('table')}
                    className={`h-full flex items-center gap-2 text-[14px] transition-colors relative border-b-[3px] px-1 ${
                      mainView === 'table' ? 'border-[#2954FF] text-[#2954FF] font-bold' : 'border-transparent text-[#4E5969] hover:text-[#1D2129]'
                    }`}
                  >
                    数据明细表格
                  </button>
                  <button
                    onClick={() => setMainView('dashboard')}
                    className={`h-full flex items-center gap-2 text-[14px] transition-colors relative border-b-[3px] px-1 ${
                      mainView === 'dashboard' ? 'border-[#2954FF] text-[#2954FF] font-bold' : 'border-transparent text-[#4E5969] hover:text-[#1D2129]'
                    }`}
                  >
                    数据采集仪表盘
                  </button>
                </div>
              )}
            </div>
          </div>

          {!activePlatformData && ['table', 'dashboard', 'settings'].includes(mainView) && (
            <div className="flex-1 flex items-center justify-center bg-[#F7F8FA] p-8">
              <div className="w-full max-w-md bg-white border border-[#E5E6EB] rounded-lg p-8 text-center shadow-sm">
                <Store size={32} className="mx-auto text-[#C9CDD4]" />
                <h2 className="mt-4 text-[16px] font-bold text-[#1D2129]">还没有可用店铺</h2>
                <p className="mt-2 text-[13px] leading-6 text-[#86909C]">添加一家店铺开始配置，或者去回收站恢复以前的店铺。</p>
                <div className="mt-5 flex items-center justify-center gap-3">
                  <button onClick={openAddShopModal} className="px-4 py-2 rounded bg-[#2954FF] text-white text-[13px] hover:bg-blue-700">添加店铺</button>
                  {trashedShops.length > 0 && <button onClick={() => setMainView('trash')} className="px-4 py-2 rounded border border-[#E5E6EB] text-[#4E5969] text-[13px] hover:bg-[#F2F3F5]">打开回收站</button>}
                </div>
              </div>
            </div>
          )}

          {mainView === 'table' && activePlatformData && (
            <div className="flex-1 flex min-h-0 bg-white">
              <div className="flex-1 flex flex-col bg-white min-h-0 min-w-0">
              <div className="px-5 py-3 border-b border-[#E5E6EB] shrink-0 overflow-x-auto overflow-y-hidden customized-scrollbar">
                <div className="w-max min-w-full flex items-center justify-between gap-6">
                  <div className="flex items-center gap-4 min-w-max shrink-0">
                  <div className="flex items-center gap-2 text-[#1D2129] font-bold text-[15px] whitespace-nowrap shrink-0">{activePlatformName}</div>
                  <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[12px] border ${
                    activePlatformData?.authStatus === 'verified'
                      ? 'bg-green-50 text-green-600 border-green-100'
                      : activePlatformData?.authStatus === 'mismatch'
                        ? 'bg-red-50 text-red-600 border-red-100'
                        : 'bg-gray-100 text-[#86909C] border-gray-200'
                  } whitespace-nowrap shrink-0`}>
                    {activePlatformData?.authStatus === 'verified' ? <CheckCircle2 size={12} /> : <Lock size={12} />}
                    {activePlatformData?.authStatus === 'verified' ? `店铺: ${activePlatformData.detectedName}` : '待校准'}
                  </div>
                  <button
                    onClick={openEgoBindingModal}
                    title={activePlatformData?.egoBinding?.tabUrl || '尚未绑定 Ego lite 窗口'}
                    className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[12px] border whitespace-nowrap shrink-0 ${
                      hasEgoBinding
                        ? 'bg-green-50 text-green-600 border-green-100 hover:bg-green-100'
                        : 'bg-gray-100 text-[#86909C] border-gray-200 hover:bg-[#F2F3F5]'
                    }`}
                  >
                    {hasEgoBinding ? <CheckCircle2 size={12} /> : <Bot size={12} />}
                    {hasEgoBinding ? 'Ego 已绑定' : hasEgoTaskSpace ? '重新校验 Ego' : '绑定 Ego'}
                  </button>
                  {localApiStatus !== 'online' && (
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[12px] bg-amber-50 text-amber-600 border border-amber-100 whitespace-nowrap shrink-0">
                      <AlertTriangle size={12} /> 服务未连接
                    </div>
                  )}
                  {pendingCollectionRequest && (
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[12px] bg-blue-50 text-[#2954FF] border border-blue-100 whitespace-nowrap shrink-0">
                      <RefreshCw size={12} className="animate-spin" /> {pendingCollectionRequest.status === 'running' ? '正在采集' : '等待执行'}
                    </div>
                  )}
                  <div className="h-4 w-px bg-[#E5E6EB] shrink-0" />
                  <div className="flex items-center gap-4 border-r border-[#E5E6EB] pr-4 min-w-max shrink-0">
                    <div className="flex items-center gap-1.5 text-[#4E5969] text-[13px] whitespace-nowrap shrink-0" title="当前仅提供网格视图">
                      <TableProperties size={14} className="text-[#2954FF]" /> 网格视图
                    </div>
                    <button
                      onClick={() => setTableFilter(tableFilter === 'all' ? 'error' : 'all')}
                      className={`flex items-center gap-1.5 text-[13px] transition-colors whitespace-nowrap shrink-0 ${tableFilter === 'error' ? 'text-red-500 font-medium' : 'text-[#4E5969] hover:text-[#2954FF]'}`}
                    >
                      <Filter size={14} /> {tableFilter === 'error' ? '仅看异常' : '筛选'}
                    </button>
                    <button
                      onClick={() => setSortDirection(sortDirection === 'desc' ? 'asc' : 'desc')}
                      className="flex items-center gap-1.5 text-[#4E5969] hover:text-[#2954FF] text-[13px] transition-colors whitespace-nowrap shrink-0"
                    >
                      <ArrowDownUp size={14} /> {sortDirection === 'desc' ? '最新优先' : '最早优先'}
                    </button>
                  </div>
                  </div>
                <div className="flex items-center gap-3 min-w-max shrink-0">
                  <button
                    onClick={() => requestDeleteRecords(selectedVisibleRecordIds)}
                    disabled={selectedVisibleRecordIds.length === 0}
                    className={`flex items-center gap-1.5 text-[13px] transition-colors px-3 py-1.5 rounded whitespace-nowrap shrink-0 ${
                      selectedVisibleRecordIds.length > 0 ? 'text-red-500 hover:bg-red-50' : 'text-[#C9CDD4] cursor-not-allowed'
                    }`}
                  >
                    <Trash2 size={14} /> 删除{selectedVisibleRecordIds.length > 0 ? ` ${selectedVisibleRecordIds.length}` : ''}
                  </button>
                  <button onClick={handleExportRecords} className="flex items-center gap-1.5 text-[#4E5969] hover:bg-[#F2F3F5] text-[13px] transition-colors px-3 py-1.5 rounded whitespace-nowrap shrink-0">
                    <Download size={14} /> 导出当前结果
                  </button>
                  <button
                    onClick={handleRunEgoCollection}
                    disabled={!canRunCollection}
                    className={`flex items-center gap-1.5 text-[13px] transition-colors px-4 py-1.5 rounded font-medium shadow-sm whitespace-nowrap shrink-0 ${
                      canRunCollection ? 'bg-[#2954FF] text-white hover:bg-blue-700' : 'bg-[#C9CDD4] text-white cursor-not-allowed'
                    }`}
                  >
                    <Bot size={13} className={isRefreshing ? 'animate-pulse' : ''} />
                    {collectionActionLabel}
                  </button>
                </div>
                </div>
              </div>

              <div className="flex-1 overflow-x-auto overflow-y-auto relative bg-white customized-scrollbar">
                <div
                  className="relative min-h-full"
                  style={{ width: tableDataWidth + 56, minWidth: '100%' }}
                >
                <table
                  style={{ width: tableDataWidth }}
                  className="text-left border-collapse table-fixed bg-white"
                >
                  <colgroup>
                    <col style={{ width: 48 }} />
                    <col style={{ width: getColumnWidth('record-id') }} />
                    <col style={{ width: getColumnWidth('extracted-at') }} />
                    {extractionTasks.map(task => <col key={`width-${task.id}`} style={{ width: getColumnWidth(task.id) }} />)}
                  </colgroup>
                  <thead className="sticky top-0 z-30 shadow-[0_1px_0_#E5E6EB]">
                    <tr>
                      <th className="w-12 border-b border-r border-[#E5E6EB] px-2 py-2 text-center bg-[#F7F8FA] sticky left-0 z-40 shadow-[1px_0_0_#E5E6EB]">
                        <input
                          type="checkbox"
                          checked={isAllVisibleRecordsSelected}
                          onChange={toggleSelectAllRows}
                          className="rounded border-gray-300 text-[#2954FF] focus:ring-[#2954FF] w-3.5 h-3.5 cursor-pointer"
                        />
                      </th>
                      <th
                        style={{ width: getColumnWidth('record-id'), minWidth: getColumnWidth('record-id') }}
                        className="border-b border-r border-[#E5E6EB] px-4 py-2 text-[#4E5969] font-medium text-[13px] bg-[#F7F8FA] sticky left-[48px] z-40 shadow-[1px_0_0_#E5E6EB] hover:bg-[#F2F3F5] transition-colors relative"
                      >
                        <div className="flex items-center gap-1.5"><AlignLeft size={13} className="text-[#86909C]" /> 记录 ID</div>
                        {renderColumnResizeHandle('record-id')}
                      </th>
                      <th
                        style={{ width: getColumnWidth('extracted-at'), minWidth: getColumnWidth('extracted-at') }}
                        className="border-b border-r border-[#E5E6EB] px-4 py-2 text-[#4E5969] font-medium text-[13px] bg-[#F7F8FA] hover:bg-[#F2F3F5] transition-colors relative"
                      >
                        提取时间
                        {renderColumnResizeHandle('extracted-at')}
                      </th>

                      {extractionTasks.map((task, index) => (
                        <th
                          key={task.id}
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, index)}
                          style={{ width: getColumnWidth(task.id), minWidth: getColumnWidth(task.id) }}
                          className={`border-b border-r border-[#E5E6EB] px-3 py-2 text-[#1D2129] font-medium text-[13px] bg-[#F7F8FA] group relative transition-colors ${draggedColIdx === index ? 'opacity-30 bg-blue-50' : 'hover:bg-[#E8F3FF]'}`}
                        >
                          <div className="flex items-center justify-between h-full">
                            <div className="flex items-center gap-1.5 flex-1 min-w-0">
                              <div draggable onDragStart={(e) => handleDragStart(e, index)} className="cursor-grab active:cursor-grabbing p-0.5 -ml-1 rounded hover:bg-[#DBE4FF] opacity-0 group-hover:opacity-100 transition-opacity text-[#86909C]">
                                <GripVertical size={13} />
                              </div>
                              <span className="truncate cursor-pointer hover:underline decoration-dashed" onClick={(e) => { e.stopPropagation(); openEditFieldModal(task); }}>
                                {task.fieldName}
                              </span>
                            </div>
                            <button aria-label={`编辑${task.fieldName}字段`} onClick={(e) => { e.stopPropagation(); openEditFieldModal(task); }} className="opacity-60 group-hover:opacity-100 p-0.5 rounded hover:bg-[#DBE4FF] text-[#4E5969] transition-opacity shrink-0">
                              <ChevronDown size={14} />
                            </button>
                          </div>
                          {renderColumnResizeHandle(task.id)}
                        </th>
                      ))}

                    </tr>
                  </thead>

                  <tbody className="text-[#1D2129]">
                    {currentPlatformRecords.map((record, rowIndex) => (
                      <tr key={record.id} className={`transition-colors group h-[42px] ${record.status === 'error' ? 'bg-red-50/50 hover:bg-red-50' : 'hover:bg-[#F2F3F5]'}`}>
                        <td className={`border-b border-r border-[#E5E6EB] px-2 py-0 text-center sticky left-0 z-20 shadow-[1px_0_0_#E5E6EB] transition-colors relative ${record.status === 'error' ? 'bg-[#FFF2F2] group-hover:bg-[#FFF2F2]' : 'bg-white group-hover:bg-[#F2F3F5]'}`}>
                          <div className="flex items-center justify-center gap-1 absolute inset-0">
                            <span className={`text-[12px] ${selectedRecordIds.includes(record.id) ? 'hidden' : 'group-hover:hidden'} w-4 text-center ${record.status === 'error' ? 'text-red-500 font-bold' : 'text-[#86909C]'}`}>
                              {record.status === 'error' ? '!' : rowIndex + 1}
                            </span>
                            <input
                              type="checkbox"
                              checked={selectedRecordIds.includes(record.id)}
                              onChange={() => toggleSelectRow(record.id)}
                              onClick={(e) => e.stopPropagation()}
                              className={`${selectedRecordIds.includes(record.id) ? 'block' : 'hidden group-hover:block'} rounded border-gray-300 text-[#2954FF] focus:ring-[#2954FF] w-3.5 h-3.5 cursor-pointer`}
                            />
                          </div>
                        </td>
                        <td className={`border-b border-r border-[#E5E6EB] px-4 py-0 text-[13px] font-mono sticky left-[48px] z-20 shadow-[1px_0_0_#E5E6EB] transition-colors ${record.status === 'error' ? 'text-red-500 bg-[#FFF2F2] group-hover:bg-[#FFF2F2] font-semibold' : 'text-[#4E5969] bg-white group-hover:bg-[#F2F3F5]'}`}>
                          {record.id}
                        </td>
                        <td className={`border-b border-r border-[#E5E6EB] px-4 py-0 text-[13px] ${record.status === 'error' ? 'text-red-500/80' : 'text-[#86909C]'}`}>{record.time}</td>
                        {extractionTasks.map(task => {
                          const val = record.data[task.fieldName];
                          const isErrorVal = typeof val === 'string' && val.includes('失败');
                          return (
                            <td key={task.id} className={`border-b border-r border-[#E5E6EB] px-4 py-0 text-[13px] transition-colors ${record.status === 'error' ? 'bg-transparent' : 'bg-white group-hover:bg-[#F2F3F5]'}`}>
                              <div className={`truncate w-full flex items-center ${isErrorVal ? 'text-red-500 font-medium' : ''}`}>
                                {isErrorVal && <ShieldAlert size={12} className="mr-1.5 inline text-red-500" />}
                                {val !== undefined ? val : <span className="text-[#C9CDD4]">-</span>}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}

                    <tr className="h-[42px] hover:bg-[#F2F3F5] transition-colors cursor-pointer group">
                      <td className="border-b border-r border-[#E5E6EB] text-center bg-white group-hover:bg-[#F2F3F5] sticky left-0 z-20 shadow-[1px_0_0_#E5E6EB]">
                        <span className="text-[12px] text-[#86909C] group-hover:hidden">{currentPlatformRecords.length + 1}</span>
                        <Plus size={14} className="hidden group-hover:inline-block text-[#2954FF] mx-auto" />
                      </td>
                      <td onClick={handleAddManualRecord} className="border-b border-r border-[#E5E6EB] px-4 py-0 text-[13px] text-[#2954FF] bg-white group-hover:bg-[#F2F3F5] sticky left-[48px] z-20 shadow-[1px_0_0_#E5E6EB]">
                        <div className="flex items-center gap-1.5"><Plus size={14} /> 增加一行</div>
                      </td>
                      <td className="border-b border-r border-[#E5E6EB] bg-white group-hover:bg-[#F2F3F5]" />
                      {extractionTasks.map(task => <td key={`add-${task.id}`} className="border-b border-r border-[#E5E6EB] bg-white group-hover:bg-[#F2F3F5]" />)}
                    </tr>

                  </tbody>
                </table>
                <button
                  onClick={() => handleAddColumn()}
                  title="添加一列"
                  aria-label="添加一列"
                  style={{ left: tableDataWidth }}
                  className="absolute top-0 w-14 h-[40px] flex items-center justify-center text-[#86909C] hover:text-[#2954FF] transition-colors"
                >
                  <Plus size={18} strokeWidth={1.6} />
                </button>
                </div>
              </div>

              <div className="h-10 bg-white border-t border-[#E5E6EB] flex items-center justify-between px-4 shrink-0 text-xs text-[#4E5969]">
                <div className="flex items-center gap-1.5 px-2 py-1">
                  {currentPlatformRecords.length} 条记录{selectedVisibleRecordIds.length > 0 ? `，已选 ${selectedVisibleRecordIds.length} 条` : ''}
                </div>
                {tableFilter !== 'all' && (
                  <button onClick={() => setTableFilter('all')} className="text-[#2954FF] hover:bg-blue-50 px-2 py-1 rounded">
                    清除筛选
                  </button>
                )}
              </div>
              </div>

              {fieldModal.open && (
                <div className="w-[390px] bg-white border-l border-[#E5E6EB] flex flex-col shrink-0 shadow-xl z-20">
                  <div className="h-12 border-b border-[#E5E6EB] flex items-center justify-between px-5 bg-[#FAFAFA] shrink-0">
                    <span className="font-bold text-[#1D2129] text-[13px]">
                      {fieldModal.mode === 'create' ? '添加表格列' : '编辑表格列'}
                    </span>
                    <div className="flex items-center gap-1">
                      {fieldModal.mode === 'edit' && (
                        <button
                          aria-label={`删除字段${fieldModal.form.fieldName ? `：${fieldModal.form.fieldName}` : ''}`}
                          onClick={() => requestRemoveTask(fieldModalTask)}
                          className="text-[#86909C] hover:text-red-500 p-1 hover:bg-red-50 rounded transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                      <button aria-label="关闭字段编辑" onClick={closeFieldModal} className="text-[#86909C] hover:text-[#1D2129] p-1 hover:bg-[#F2F3F5] rounded transition-colors">
                        <X size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#F7F8FA] customized-scrollbar">
                    <div className="bg-white border border-[#E5E6EB] rounded p-4">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <label className="text-[12px] font-bold text-[#4E5969]">表格列名称</label>
                        <span className="text-[11px] text-[#86909C]">保存后显示在表头</span>
                      </div>
                      <input
                        type="text"
                        autoFocus
                        value={fieldModal.form.fieldName}
                        onChange={(e) => updateFieldModalForm({ fieldName: e.target.value })}
                        placeholder="例如：服务保障"
                        className="w-full border border-[#E5E6EB] bg-white rounded px-3 py-2 text-[13px] focus:border-[#2954FF] focus:outline-none transition-colors"
                      />
                      <div className="mt-3 flex flex-wrap gap-2">
                        {['支付金额', '访客数', '支付子订单数', '支付转化率', '浏览量', '加购人数', '客单价', '支付买家数'].map(item => (
                          <button
                            key={item}
                            onClick={() => applyFieldPreset(item)}
                            className="px-2 py-1 rounded bg-[#F2F3F5] hover:bg-[#E8F3FF] text-[#4E5969] hover:text-[#2954FF] text-[12px] transition-colors"
                          >
                            {item}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="bg-white border border-[#E5E6EB] rounded p-4">
                      <label className="text-[12px] font-bold text-[#4E5969] mb-2 flex items-center gap-1.5"><MessageSquare size={13} /> 采集说明</label>
                      <textarea
                        value={fieldModal.form.prompt}
                        onChange={(e) => updateFieldModalForm({ prompt: e.target.value })}
                        placeholder="告诉 Ego lite 执行器到哪个页面、找哪个按钮或指标、最后只返回什么格式的数据。"
                        className="w-full min-h-[112px] border border-[#E5E6EB] bg-white rounded px-3 py-2 text-[13px] leading-relaxed focus:border-[#2954FF] focus:outline-none transition-colors resize-none"
                      />
                    </div>

	                    <div className="bg-white border border-[#E5E6EB] rounded overflow-hidden">
	                      <div className="px-4 py-3 border-b border-[#E5E6EB] bg-[#FAFAFA] flex items-center justify-between">
	                        <div className="text-[12px] font-bold text-[#4E5969] flex items-center gap-1.5"><ImagePlus size={13} /> 截图标记</div>
	                      </div>
	                      <div className="p-4">
	                        <input
	                          ref={screenshotInputRef}
	                          type="file"
	                          accept="image/*"
	                          onChange={handleScreenshotUpload}
	                          className="hidden"
	                        />
	                        <button
	                          type="button"
	                          onClick={() => screenshotInputRef.current?.click()}
	                          title="点击上传图片，或直接粘贴剪贴板中的截图"
	                          className={`w-full h-[142px] border border-dashed rounded relative overflow-hidden transition-colors focus:outline-none focus:ring-2 focus:ring-[#2954FF]/20 ${fieldModal.form.screenshotUrl || fieldModal.form.markerNote ? 'border-[#2954FF] bg-[#F0F5FF]' : 'border-[#C9CDD4] hover:border-[#2954FF] bg-white'}`}
	                        >
	                          {fieldModal.form.screenshotUrl ? (
	                            <div className="absolute inset-0 bg-[#F7F8FA]">
	                              <img src={fieldModal.form.screenshotUrl} alt="字段标记截图" className="w-full h-full object-contain" />
	                            </div>
	                          ) : fieldModal.form.markerNote ? (
	                            <div className="absolute inset-0 bg-[#F7F8FA] p-3 text-left">
	                              <div className="h-full rounded border border-[#E5E6EB] bg-white relative overflow-hidden">
	                                <div className="h-7 bg-[#1D2129] text-white text-[11px] flex items-center px-3">商家后台数据页</div>
                                <div className="grid grid-cols-3 gap-2 p-3">
                                  <div className="h-16 border border-[#E5E6EB] rounded bg-[#FAFAFA] p-2">
                                    <div className="text-[10px] text-[#86909C]">{fieldModal.form.fieldName || '字段标题'}</div>
                                    <div className="text-[15px] font-bold mt-2">{fieldModal.form.defaultValue || '目标数值'}</div>
                                  </div>
                                  <div className="h-16 border border-[#E5E6EB] rounded bg-[#FAFAFA]" />
                                  <div className="h-16 border border-[#E5E6EB] rounded bg-[#FAFAFA]" />
                                </div>
                                <div className="absolute left-[74px] top-[70px] w-24 h-[2px] bg-red-500 rotate-[-24deg]" />
                                <div className="absolute left-[62px] top-[80px] w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-r-[12px] border-r-red-500 rotate-[-24deg]" />
                              </div>
                            </div>
                          ) : (
	                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-[#86909C]">
	                              <ImagePlus size={22} />
	                              <span className="text-[12px] font-medium">点击上传，或直接粘贴截图</span>
	                              <span className="text-[11px] text-[#C9CDD4]">截图后按 Ctrl+V，Mac 按 ⌘V</span>
	                            </div>
	                          )}
	                        </button>
	                        {fieldModal.form.screenshotUrl && (
	                          <div className="mt-2 flex items-center justify-between text-[12px]">
	                            <span className="text-green-600">已添加截图标记</span>
	                            <button onClick={() => updateFieldModalForm({ screenshotUrl: '', markerNote: '', recognizedPath: '' })} className="text-[#86909C] hover:text-red-500">
	                              移除截图
	                            </button>
	                          </div>
	                        )}
                        <textarea
                          value={fieldModal.form.markerNote}
                          onChange={(e) => updateFieldModalForm({ markerNote: e.target.value })}
                          placeholder="补充说明（可选）：例如箭头指向「支付金额」的当前值"
                          className="mt-3 w-full min-h-[64px] border border-[#E5E6EB] bg-white rounded px-3 py-2 text-[12px] leading-relaxed focus:border-[#2954FF] focus:outline-none transition-colors resize-none"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="p-4 border-t border-[#E5E6EB] bg-white shrink-0 space-y-2">
                    {fieldModal.error && <div className="bg-red-50 border border-red-100 text-red-600 px-3 py-2 rounded text-[12px]">{fieldModal.error}</div>}
                    {fieldModal.mode === 'edit' && (
                      <button
                        onClick={handleRunFieldModalCollection}
                        disabled={!canRunFieldModalCollection || isRefreshing}
                        className={`w-full py-2.5 rounded text-[13px] font-bold shadow-sm transition-colors flex items-center justify-center gap-2 ${
                          canRunFieldModalCollection ? 'bg-[#2954FF] hover:bg-blue-700 text-white' : 'bg-[#C9CDD4] text-white cursor-not-allowed'
                        }`}
                      >
                        <PlaySquare size={15} /> {pendingCollectionRequest ? '已有采集任务' : (!hasExecutableRules ? '校准店铺后可测试' : !isLocalWritebackOnline ? '服务连接后可测试' : '测试这一列')}
                      </button>
                    )}
                    <button
                      onClick={handleFieldModalConfirm}
                      disabled={!fieldModal.form.fieldName.trim()}
                      className="w-full bg-[#1D2129] hover:bg-black text-white py-2.5 rounded text-[13px] font-bold shadow-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Save size={15} /> {fieldModal.mode === 'create' ? '添加到表格' : '保存修改'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {mainView === 'dashboard' && activePlatformData && (
            <div className="flex-1 flex overflow-hidden">
              <div className="flex-1 flex flex-col min-w-0 bg-[#F2F3F5] p-5">
                <div className="bg-white border border-[#E5E6EB] rounded shadow-sm flex flex-col h-full min-h-0 overflow-hidden">
                  <div className="h-[58px] border-b border-[#E5E6EB] flex items-center justify-between px-5 bg-[#FAFAFA] shrink-0">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded bg-[#F0F5FF] text-[#2954FF] flex items-center justify-center shrink-0">
                        <Gauge size={18} />
                      </div>
                      <div className="text-[15px] font-bold text-[#1D2129] truncate">{activePlatformName} 采集仪表盘</div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={openEgoBindingModal}
                        className={`flex items-center gap-1.5 text-[13px] transition-colors px-3 py-1.5 rounded border ${
                          hasEgoBinding
                            ? 'bg-green-50 text-green-600 border-green-200 hover:bg-green-100'
                            : 'text-[#4E5969] hover:text-[#2954FF] hover:bg-blue-50 border-[#E5E6EB]'
                        }`}
                      >
                        {hasEgoBinding ? <CheckCircle2 size={13} /> : <Bot size={13} />}
                        {hasEgoBinding ? `Ego 已绑定 · ${activePlatformData.detectedName}` : hasEgoTaskSpace ? '重新校验 Ego' : '绑定 Ego'}
                      </button>
                      {pendingCollectionRequest && (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-[#2954FF] border border-blue-100 rounded text-[12px] font-medium">
                          <RefreshCw size={12} className="animate-spin" /> {pendingCollectionRequest.status === 'running' ? '正在采集' : '等待执行'}
                        </div>
                      )}
                      <button
                        onClick={handleRunEgoCollection}
                        disabled={!canRunCollection}
                        className={`flex items-center gap-1.5 text-[13px] transition-colors px-4 py-1.5 rounded font-medium shadow-sm ${
                          canRunCollection ? 'bg-[#2954FF] text-white hover:bg-blue-700' : 'bg-[#C9CDD4] text-white cursor-not-allowed'
                        }`}
                      >
                        <Bot size={14} />
                        {collectionActionLabel}
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-5 customized-scrollbar bg-[#F7F8FA]">
                    <div className={`mb-5 px-4 py-3 border rounded flex items-center justify-between gap-4 ${
                      latestSyncFailed
                        ? 'bg-red-50 border-red-100'
                        : shopNeedsCalibration
                          ? 'bg-amber-50 border-amber-200'
                        : pendingCollectionRequest
                          ? 'bg-blue-50 border-blue-100'
                          : 'bg-white border-[#E5E6EB]'
                    }`}>
                      <div className="flex items-center gap-3 min-w-0">
                        <RefreshCw size={15} className={pendingCollectionRequest ? 'text-[#2954FF] animate-spin shrink-0' : latestSyncFailed ? 'text-red-500 shrink-0' : shopNeedsCalibration ? 'text-amber-600 shrink-0' : 'text-green-600 shrink-0'} />
                        <div className="min-w-0">
                          <div className={`text-[13px] font-medium ${latestSyncFailed ? 'text-red-600' : shopNeedsCalibration ? 'text-amber-700' : 'text-[#1D2129]'}`}>
                            {pendingCollectionRequest
                              ? pendingCollectionRequest.status === 'running' ? '正在同步数据' : '等待开始同步'
                              : shopNeedsCalibration
                                ? shopAttentionText
                              : latestSyncFailed
                                ? `同步失败：${latestSyncErrorText}`
                                : latestSyncSucceeded
                                  ? '最近一次同步成功'
                                  : '等待首次自动同步'}
                          </div>
                          <div className="text-[12px] text-[#86909C] mt-0.5">每天 {activePlatformData?.autoSyncTime || '09:00'} 自动同步</div>
                        </div>
                      </div>
                      {(latestSyncFailed || shopNeedsCalibration) && (
                        <button onClick={openEgoBindingModal} className={`shrink-0 px-3 py-1.5 text-[12px] bg-white rounded ${latestSyncFailed ? 'text-red-600 border border-red-200 hover:bg-red-50' : 'text-amber-700 border border-amber-300 hover:bg-amber-50'}`}>
                          校正店铺
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-4 mb-5">
                      <div className="bg-white border border-[#E5E6EB] rounded p-4">
                        <div className="text-[12px] text-[#86909C] mb-2 flex items-center gap-1.5"><RefreshCw size={14} /> 每日同步</div>
                        <div className="text-[24px] font-bold text-[#1D2129]">{activePlatformData?.autoSyncTime || '09:00'}</div>
                      </div>
                      <div className="bg-white border border-[#E5E6EB] rounded p-4">
                        <div className="text-[12px] text-[#86909C] mb-2 flex items-center gap-1.5"><CheckCircle2 size={14} /> 最近成功</div>
                        <div className="text-[24px] font-bold text-[#1D2129]">{latestSuccessfulRecord?.time || '-'}</div>
                      </div>
                      <div className="bg-white border border-[#E5E6EB] rounded p-4">
                        <div className="text-[12px] text-[#86909C] mb-2 flex items-center gap-1.5"><ClipboardList size={14} /> 页面数据时间</div>
                        <div className="text-[16px] font-bold text-[#1D2129] truncate">{latestSuccessfulRecord?.dataUpdatedAt || '-'}</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 mb-5">
                      {extractionTasks.slice(0, 3).map(task => (
                        <button
                          key={task.id}
                          onClick={() => setActiveTaskId(task.id)}
                          className={`bg-white border rounded p-4 text-left transition-colors ${selectedTask?.id === task.id ? 'border-[#2954FF] ring-[2px] ring-[#2954FF]/10' : 'border-[#E5E6EB] hover:border-[#C9CDD4]'}`}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-[13px] text-[#4E5969]">{task.fieldName}</span>
                            <span className={`text-[11px] px-1.5 py-0.5 rounded ${task.status === 'ready' ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-gray-100 text-[#86909C] border border-gray-200'}`}>
                              {task.status === 'ready' ? '已配置' : '草稿'}
                            </span>
                          </div>
                          <div className="text-[24px] font-bold text-[#1D2129] truncate">{task.value || '-'}</div>
                        </button>
                      ))}
                    </div>

                    <div className="bg-white border border-[#E5E6EB] rounded overflow-hidden">
                      <div className="h-12 px-4 border-b border-[#E5E6EB] flex items-center justify-between bg-[#FAFAFA]">
                        <div className="text-[13px] font-bold text-[#1D2129] flex items-center gap-1.5"><BarChart3 size={14} className="text-[#2954FF]" /> 最近采集结果</div>
                        <button onClick={() => setMainView('table')} className="text-[#2954FF] hover:bg-blue-50 px-2 py-1 rounded text-[12px] font-medium">
                          查看明细表
                        </button>
                      </div>

                      <table className="w-full text-left text-[13px]">
                        <thead className="bg-white border-b border-[#E5E6EB] text-[#4E5969]">
                          <tr>
                            <th className="px-4 py-2.5 font-medium w-[160px]">记录</th>
                            <th className="px-4 py-2.5 font-medium w-[120px]">时间</th>
                            {extractionTasks.slice(0, 3).map(task => (
                              <th key={task.id} className="px-4 py-2.5 font-medium">{task.fieldName}</th>
                            ))}
                            <th className="px-4 py-2.5 font-medium w-[120px]">状态</th>
                          </tr>
                        </thead>
                        <tbody>
                          {currentPlatformRecords.slice(0, 5).map(record => (
                            <tr key={record.id} className="border-b border-[#E5E6EB] hover:bg-[#F7F8FA]">
                              <td className="px-4 py-3 font-mono text-[#4E5969]">{record.id}</td>
                              <td className="px-4 py-3 text-[#86909C]">{record.time}</td>
                              {extractionTasks.slice(0, 3).map(task => (
                                <td key={task.id} className="px-4 py-3 text-[#1D2129]">
                                  <div className="truncate max-w-[220px]">{record.data[task.fieldName] || <span className="text-[#C9CDD4]">-</span>}</div>
                                </td>
                              ))}
                              <td className="px-4 py-3">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[12px] border ${record.status === 'success' ? 'bg-green-50 text-green-600 border-green-100' : 'bg-red-50 text-red-500 border-red-100'}`}>
                                  {record.status === 'success' ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                                  {record.status === 'success' ? '成功' : '异常'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {mainView === 'api' && (
            <div className="flex-1 overflow-y-auto bg-[#F2F3F5] p-6 customized-scrollbar">
              <div className="max-w-4xl mx-auto bg-white border border-[#E5E6EB] rounded shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-[#E5E6EB] bg-[#FAFAFA] flex items-start justify-between gap-6">
                  <div>
                    <h2 className="text-[17px] font-bold flex items-center gap-2"><Terminal size={18} className="text-[#2954FF]" /> DataFactory API</h2>
                    <p className="text-[12px] text-[#86909C] mt-1">Codex 可通过这组本地 JSON 接口读取店铺、校正状态、创建采集任务并查询写回结果。</p>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded border text-[12px] ${localApiStatus === 'online' ? 'bg-green-50 text-green-600 border-green-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${localApiStatus === 'online' ? 'bg-green-500' : 'bg-amber-500'}`} />
                    {localApiStatus === 'online' ? '本地接口已连接' : '本地接口未连接'}
                  </span>
                </div>

                <div className="p-6">
                  <div className="text-[12px] font-medium text-[#4E5969] mb-2">基础地址</div>
                  <div className="flex items-center gap-2 mb-6">
                    <code className="flex-1 bg-[#F7F8FA] border border-[#E5E6EB] rounded px-3 py-2.5 text-[13px] text-[#1D2129]">{apiBase}</code>
                    <button onClick={() => copyApiEndpoint('', '__base__')} aria-label="复制基础地址" title="复制基础地址" className="w-9 h-9 flex items-center justify-center border border-[#E5E6EB] rounded text-[#4E5969] hover:text-[#2954FF] hover:bg-blue-50">
                      {copiedApiPath === '__base__' ? <Check size={15} className="text-green-600" /> : <Copy size={15} />}
                    </button>
                  </div>

                  <div className="border border-[#E5E6EB] rounded overflow-hidden">
                    {[
                      { method: 'GET', path: '/health', description: '检查本地服务是否可用' },
                      { method: 'GET', path: '/shops', description: '读取全部店铺和绑定状态' },
                      { method: 'POST', path: '/shops', description: '添加一家待校正店铺' },
                      { method: 'DELETE', path: `/shops/${activePlatform}`, description: '将店铺移入回收站（非永久删除）' },
                      { method: 'GET', path: '/trash', description: '读取回收站店铺' },
                      { method: 'POST', path: '/trash/{shopId}/restore', description: '从回收站恢复店铺并重新校正' },
                      { method: 'GET', path: `/shops/${activePlatform}/rules`, description: '读取当前店铺的字段规则' },
                      { method: 'POST', path: '/runner/ego-bind', description: '用 Ego Lite 校正店铺身份与窗口' },
                      { method: 'GET', path: `/records?shopId=${activePlatform}`, description: '读取当前店铺的历史数据' },
                      { method: 'GET', path: '/collection-runs', description: '读取采集任务和执行状态' },
                      { method: 'GET', path: '/collection-runs/{runId}', description: '查询单次任务状态和写回记录' },
                      { method: 'POST', path: '/collection-runs', description: '为当前店铺创建一次采集任务' }
                    ].map((endpoint, index, endpoints) => (
                      <div key={`${endpoint.method}-${endpoint.path}`} className={`grid grid-cols-[70px_minmax(220px,1fr)_minmax(220px,1.2fr)_40px] items-center gap-3 px-4 py-3 ${index < endpoints.length - 1 ? 'border-b border-[#E5E6EB]' : ''}`}>
                        <span className={`w-fit px-2 py-0.5 rounded text-[11px] font-bold font-mono ${endpoint.method === 'GET' ? 'bg-green-50 text-green-700' : endpoint.method === 'DELETE' ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'}`}>{endpoint.method}</span>
                        <code className="text-[12px] text-[#1D2129] truncate">{endpoint.path}</code>
                        <span className="text-[12px] text-[#86909C] truncate">{endpoint.description}</span>
                        <button onClick={() => copyApiEndpoint(endpoint.path, `${endpoint.method}:${endpoint.path}`)} aria-label={`复制 ${endpoint.method} ${endpoint.path}`} title={`复制 ${endpoint.method} ${endpoint.path}`} className="w-8 h-8 flex items-center justify-center rounded text-[#86909C] hover:text-[#2954FF] hover:bg-blue-50">
                          {copiedApiPath === `${endpoint.method}:${endpoint.path}` ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 bg-blue-50 border border-blue-100 rounded px-4 py-3 text-[12px] text-[#4E5969] leading-relaxed">
                    <div className="font-medium text-[#1D2129] mb-1">Codex 接入流程</div>
                    先请求 <code className="text-[#2954FF]">GET /health</code> 和 <code className="text-[#2954FF]">GET /shops</code>，再用 <code className="text-[#2954FF]">{`POST /collection-runs  {"shopId":"${activePlatform}"}`}</code> 创建任务。任务会进入已校正的 Ego Lite 窗口，采集后通过本接口写回。
                  </div>
                </div>
              </div>
            </div>
          )}

          {mainView === 'trash' && (
            <div className="flex-1 overflow-y-auto bg-[#F2F3F5] p-6 customized-scrollbar">
              <div className="max-w-4xl mx-auto bg-white border border-[#E5E6EB] rounded shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-[#E5E6EB] bg-[#FAFAFA]">
                  <h2 className="text-[17px] font-bold flex items-center gap-2"><Trash2 size={18} className="text-[#2954FF]" /> 回收站</h2>
                  <p className="text-[12px] text-[#86909C] mt-1">店铺在这里只能恢复，不提供彻底删除。历史数据和字段规则始终保留。</p>
                </div>
                {shopMutationError && <div className="mx-6 mt-5 bg-red-50 border border-red-100 text-red-600 px-3 py-2 rounded text-[12px]">{shopMutationError}</div>}
                {shopMutationSuccess && <div className="mx-6 mt-5 bg-green-50 border border-green-100 text-green-700 px-3 py-2 rounded text-[12px]">{shopMutationSuccess}</div>}
                {trashedShops.length === 0 ? (
                  <div className="px-6 py-16 text-center">
                    <div className="mx-auto w-11 h-11 rounded-full bg-[#F2F3F5] flex items-center justify-center text-[#86909C]"><Trash2 size={20} /></div>
                    <div className="mt-3 text-[14px] font-medium">回收站是空的</div>
                    <div className="mt-1 text-[12px] text-[#86909C]">从店铺列表移除的店铺会出现在这里。</div>
                  </div>
                ) : (
                  <div className="divide-y divide-[#E5E6EB]">
                    {trashedShops.map(shop => (
                      <div key={shop.id} className="px-6 py-4 flex items-center gap-4">
                        <div className="w-9 h-9 rounded bg-[#F2F3F5] flex items-center justify-center text-[#86909C]"><Store size={17} /></div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[14px] font-medium truncate">{shop.name}</div>
                          <div className="text-[12px] text-[#86909C] mt-0.5 truncate">{platformLabels[shop.platformType] || '其他平台'}{shop.expectedShopName ? ` · ${shop.expectedShopName}` : ''} · 移入后已暂停自动同步</div>
                        </div>
                        <button disabled={restoringShopId === shop.id} onClick={() => handleRestoreShop(shop.id)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] text-[#2954FF] border border-blue-200 hover:bg-blue-50 rounded disabled:opacity-50 disabled:cursor-wait">
                          <ArchiveRestore size={14} /> {restoringShopId === shop.id ? '正在恢复...' : '恢复店铺'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {mainView === 'settings' && activePlatformData && (
            <div className="flex-1 overflow-y-auto bg-[#F2F3F5] p-6 customized-scrollbar">
              <div className="max-w-3xl mx-auto bg-white border border-[#E5E6EB] rounded shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-[#E5E6EB] bg-[#FAFAFA]">
                  <h2 className="text-[17px] font-bold flex items-center gap-2"><Settings size={18} className="text-[#2954FF]" /> {activePlatformName}</h2>
                  <p className="text-[12px] text-[#86909C] mt-1">设置当前店铺的自动同步方式，修改后自动保存。</p>
                </div>

                <div className="px-6">
                  <div className="py-5 flex items-center justify-between gap-6 border-b border-[#E5E6EB]">
                    <div>
                      <div className="text-[14px] font-medium">每日自动同步</div>
                      <div className="text-[12px] text-[#86909C] mt-1">到达设定时间后自动刷新页面、校验店铺并写入数据。</div>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-label="每日自动同步"
                      aria-checked={activePlatformData.autoSyncEnabled !== false}
                      onClick={() => updateActiveShopPreference({ autoSyncEnabled: activePlatformData.autoSyncEnabled === false })}
                      className={`relative w-10 h-6 rounded-full shrink-0 transition-colors ${activePlatformData.autoSyncEnabled !== false ? 'bg-[#2954FF]' : 'bg-[#C9CDD4]'}`}
                    >
                      <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${activePlatformData.autoSyncEnabled !== false ? 'left-5' : 'left-1'}`} />
                    </button>
                  </div>

                  <div className="py-5 flex items-center justify-between gap-6 border-b border-[#E5E6EB]">
                    <div>
                      <div className="text-[14px] font-medium flex items-center gap-1.5"><Clock size={15} className="text-[#86909C]" /> 同步时间</div>
                      <div className="text-[12px] text-[#86909C] mt-1">使用本机时区 Asia/Shanghai。</div>
                    </div>
                    <input
                      type="time"
                      disabled={activePlatformData.autoSyncEnabled === false}
                      value={activePlatformData.autoSyncTime || '09:00'}
                      onChange={(event) => updateActiveShopPreference({ autoSyncTime: event.target.value })}
                      className="w-32 border border-[#E5E6EB] rounded px-3 py-2 text-[13px] focus:border-[#2954FF] focus:outline-none disabled:bg-[#F2F3F5] disabled:text-[#86909C]"
                    />
                  </div>

                  <div className="py-5 flex items-start justify-between gap-6 border-b border-[#E5E6EB]">
                    <div>
                      <div className="text-[14px] font-medium flex items-center gap-1.5"><RefreshCw size={15} className="text-[#86909C]" /> 采集前刷新</div>
                      <div className="text-[12px] text-[#86909C] mt-1">每次都重新加载后台页面，避免读取上一次的数据。</div>
                    </div>
                    <span className="text-[12px] text-green-600 bg-green-50 border border-green-100 rounded px-2 py-1">始终开启</span>
                  </div>

                  <div className="py-5 flex items-start justify-between gap-6">
                    <div>
                      <div className="text-[14px] font-medium flex items-center gap-1.5"><ShieldCheck size={15} className="text-[#86909C]" /> 店铺身份校验</div>
                      <div className="text-[12px] text-[#86909C] mt-1">平台、域名、登录状态或店铺名不一致时禁止写入。</div>
                    </div>
                    <span className="text-[12px] text-green-600 bg-green-50 border border-green-100 rounded px-2 py-1">始终开启</span>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {isAddShopModalOpen && (
        <div className="absolute inset-0 z-50 bg-[#1D2129]/40 flex items-center justify-center p-4">
          <div className="bg-white rounded shadow-lg w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-[#E5E6EB] flex justify-between items-center bg-[#FAFAFA]">
              <h3 className="font-bold text-[#1D2129] text-[15px] flex items-center gap-2"><Store size={16} className="text-[#2954FF]" /> 添加店铺</h3>
              <button onClick={() => setIsAddShopModalOpen(false)} aria-label="关闭添加店铺弹窗" className="text-[#86909C] hover:text-[#1D2129]"><X size={16} /></button>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-[13px] font-bold mb-2">平台</label>
                <select value={newShopForm.platformType} onChange={(e) => handleNewShopPlatformChange(e.target.value)} className="w-full border border-[#E5E6EB] rounded px-3 py-2 text-[13px] focus:border-[#2954FF] focus:outline-none">
                  <option value="taobao">淘宝 / 千牛</option><option value="pdd">拼多多</option><option value="jd">京东</option><option value="other">其他平台</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[13px] font-bold mb-2">店铺显示名称</label>
                  <input autoFocus value={newShopForm.name} onChange={(e) => setNewShopForm(form => ({ ...form, name: e.target.value }))} placeholder="例如：淘宝店铺 A" className="w-full border border-[#E5E6EB] rounded px-3 py-2 text-[13px] focus:border-[#2954FF] focus:outline-none" />
                </div>
                <div>
                  <label className="block text-[13px] font-bold mb-2">实际店铺名</label>
                  <input value={newShopForm.expectedShopName} onChange={(e) => setNewShopForm(form => ({ ...form, expectedShopName: e.target.value }))} placeholder="必须与后台显示一致" className="w-full border border-[#E5E6EB] rounded px-3 py-2 text-[13px] focus:border-[#2954FF] focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-[13px] font-bold mb-2">后台入口</label>
                <input value={newShopForm.url} onChange={(e) => setNewShopForm(form => ({ ...form, url: e.target.value }))} className="w-full border border-[#E5E6EB] rounded px-3 py-2 text-[13px] font-mono focus:border-[#2954FF] focus:outline-none" />
              </div>
              <div>
                <label className="block text-[13px] font-bold mb-2">允许域名</label>
                <input value={newShopForm.allowedDomains} onChange={(e) => setNewShopForm(form => ({ ...form, allowedDomains: e.target.value }))} placeholder="多个域名用逗号分隔" className="w-full border border-[#E5E6EB] rounded px-3 py-2 text-[13px] font-mono focus:border-[#2954FF] focus:outline-none" />
                <div className="text-[11px] text-[#86909C] mt-1">采集页面不在这些域名内时会自动阻断。</div>
              </div>
              <div>
                <label className="block text-[13px] font-bold mb-2">每日同步时间</label>
                <input type="time" value={newShopForm.autoSyncTime} onChange={(e) => setNewShopForm(form => ({ ...form, autoSyncTime: e.target.value }))} className="w-36 border border-[#E5E6EB] rounded px-3 py-2 text-[13px] focus:border-[#2954FF] focus:outline-none" />
              </div>
              <div className="bg-blue-50 border border-blue-100 px-3 py-2.5 rounded text-[12px] text-[#4E5969]">添加后店铺会固定保存在 DataFactory。Ego lite 登录失效或窗口离线不会删除店铺、字段和历史数据。</div>
              {addShopError && <div className="bg-red-50 border border-red-100 text-red-600 px-3 py-2 rounded text-[12px]">{addShopError}</div>}
            </div>
            <div className="px-6 py-4 bg-[#FAFAFA] border-t border-[#E5E6EB] flex justify-end gap-3">
              <button onClick={() => setIsAddShopModalOpen(false)} className="px-4 py-1.5 text-[13px] text-[#4E5969] border border-[#E5E6EB] bg-white hover:bg-[#F2F3F5] rounded">取消</button>
              <button onClick={handleAddShopSubmit} disabled={isSavingShop} className="px-4 py-1.5 text-[13px] text-white bg-[#2954FF] hover:bg-blue-700 rounded disabled:opacity-50">{isSavingShop ? '正在保存...' : '添加店铺'}</button>
            </div>
          </div>
        </div>
      )}

      {manualRecordModal.open && (
        <div className="absolute inset-0 z-50 bg-[#1D2129]/40 flex items-center justify-center p-4">
          <div className="bg-white rounded shadow-lg w-full max-w-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[#E5E6EB] flex justify-between items-center bg-[#FAFAFA]">
              <h3 className="font-bold text-[15px] flex items-center gap-2"><Plus size={16} className="text-[#2954FF]" /> 手动增加记录</h3>
              <button onClick={() => setManualRecordModal({ open: false, data: {}, error: '' })} aria-label="关闭手动记录弹窗" className="text-[#86909C] hover:text-[#1D2129]"><X size={16} /></button>
            </div>
            <div className="p-6 max-h-[60vh] overflow-y-auto customized-scrollbar">
              <div className="text-[12px] text-[#86909C] mb-4">这条记录会标记为「手动录入」，不会冒充 Ego Lite 自动采集结果。</div>
              <div className="grid grid-cols-2 gap-4">
                {extractionTasks.map(task => (
                  <label key={task.id} className="block">
                    <span className="block text-[12px] font-medium mb-1.5">{task.fieldName}</span>
                    <input
                      value={manualRecordModal.data[task.fieldName] ?? ''}
                      onChange={(event) => setManualRecordModal(modal => ({ ...modal, error: '', data: { ...modal.data, [task.fieldName]: event.target.value } }))}
                      placeholder={`输入${task.fieldName}`}
                      className="w-full border border-[#E5E6EB] rounded px-3 py-2 text-[13px] focus:border-[#2954FF] focus:outline-none"
                    />
                  </label>
                ))}
              </div>
              {manualRecordModal.error && <div className="mt-4 bg-red-50 border border-red-100 text-red-600 px-3 py-2 rounded text-[12px]">{manualRecordModal.error}</div>}
            </div>
            <div className="px-6 py-4 bg-[#FAFAFA] border-t border-[#E5E6EB] flex justify-end gap-3">
              <button onClick={() => setManualRecordModal({ open: false, data: {}, error: '' })} className="px-4 py-1.5 text-[13px] text-[#4E5969] border border-[#E5E6EB] bg-white hover:bg-[#F2F3F5] rounded">取消</button>
              <button onClick={saveManualRecord} className="px-4 py-1.5 text-[13px] text-white bg-[#2954FF] hover:bg-blue-700 rounded">保存记录</button>
            </div>
          </div>
        </div>
      )}

      {pendingDeleteAction && (
        <div className="absolute inset-0 z-[70] bg-[#1D2129]/40 flex items-center justify-center p-4">
          <div className="bg-white rounded shadow-lg w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-[#E5E6EB] flex justify-between items-center bg-[#FAFAFA]">
              <h3 className="font-bold text-[15px] flex items-center gap-2"><AlertTriangle size={16} className="text-red-500" /> 确认删除</h3>
              <button onClick={() => setPendingDeleteAction(null)} aria-label="关闭删除确认" className="text-[#86909C] hover:text-[#1D2129]"><X size={16} /></button>
            </div>
            <div className="px-6 py-6 text-[13px] text-[#4E5969] leading-6">
              {pendingDeleteAction.type === 'records'
                ? `确定删除选中的 ${pendingDeleteAction.ids.length} 条数据记录吗？此操作不会删除店铺，但记录删除后无法恢复。`
                : `确定删除字段「${pendingDeleteAction.label}」吗？已有历史记录中的原始数据仍会保留，但表格不再显示该字段。`}
            </div>
            <div className="px-6 py-4 bg-[#FAFAFA] border-t border-[#E5E6EB] flex justify-end gap-3">
              <button onClick={() => setPendingDeleteAction(null)} className="px-4 py-1.5 text-[13px] text-[#4E5969] border border-[#E5E6EB] bg-white hover:bg-[#F2F3F5] rounded">取消</button>
              <button onClick={confirmDeleteAction} className="px-4 py-1.5 text-[13px] text-white bg-red-500 hover:bg-red-600 rounded">确认删除</button>
            </div>
          </div>
        </div>
      )}

      {shopContextMenu && (
        <div
          data-shop-context-menu
          role="menu"
          aria-label={`${shopContextMenu.shop.name}店铺管理`}
          onClick={(event) => event.stopPropagation()}
          className="fixed z-[60] w-44 bg-white border border-[#E5E6EB] rounded shadow-lg py-1"
          style={{ left: Math.min(shopContextMenu.x, window.innerWidth - 190), top: Math.min(shopContextMenu.y, window.innerHeight - 90) }}
        >
          <button
            role="menuitem"
            onClick={() => {
              setShopMutationError('');
              setShopPendingTrash(shopContextMenu.shop);
              setShopContextMenu(null);
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-left text-[13px] text-red-600 hover:bg-red-50"
          >
            <Trash2 size={14} /> 移入回收站
          </button>
        </div>
      )}

      {isEgoBindingModalOpen && activePlatformData && (
        <div className="absolute inset-0 z-50 bg-[#1D2129]/40 flex items-center justify-center p-4">
          <div className="bg-white rounded shadow-lg w-full max-w-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[#E5E6EB] flex justify-between items-center bg-[#FAFAFA]">
              <h3 className="font-bold text-[15px] flex items-center gap-2"><Bot size={16} className="text-[#2954FF]" /> 校正当前店铺</h3>
              <button onClick={() => setIsEgoBindingModalOpen(false)} aria-label="关闭 Ego 绑定弹窗" className="text-[#86909C] hover:text-[#1D2129]"><X size={16} /></button>
            </div>
            <div className="p-6 space-y-5">
              <div className="border border-[#E5E6EB] rounded overflow-hidden">
                <div className="px-4 py-3 bg-[#F7F8FA] border-b border-[#E5E6EB] flex items-center justify-between">
                  <div><div className="font-bold text-[14px]">{activePlatformData.name}</div><div className="text-[12px] text-[#86909C] mt-0.5">绑定固定 Ego 窗口，防止采集到其他店铺</div></div>
                  <span className={`px-2 py-0.5 rounded border text-[11px] ${hasEgoBinding ? 'bg-green-50 text-green-600 border-green-100' : hasEgoTaskSpace ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-gray-100 text-[#86909C] border-gray-200'}`}>{hasEgoBinding ? '已绑定并校验' : hasEgoTaskSpace ? '待登录/重新校验' : '未绑定'}</span>
                </div>
                <div className="grid grid-cols-[120px_1fr] text-[13px]">
                  <div className="px-4 py-3 bg-[#FAFAFA] text-[#86909C] border-b border-r border-[#E5E6EB]">平台</div><div className="px-4 py-3 border-b border-[#E5E6EB]">{platformLabels[activePlatformData.platformType] || '其他'}</div>
                  <div className="px-4 py-3 bg-[#FAFAFA] text-[#86909C] border-b border-r border-[#E5E6EB]">预期店铺名</div><div className="px-4 py-3 border-b border-[#E5E6EB] font-medium">{activePlatformData.expectedShopName}</div>
                  <div className="px-4 py-3 bg-[#FAFAFA] text-[#86909C] border-b border-r border-[#E5E6EB]">Ego 识别店铺</div><div className="px-4 py-3 border-b border-[#E5E6EB] font-medium">{activePlatformData.detectedName || '尚未识别'}</div>
                  <div className="px-4 py-3 bg-[#FAFAFA] text-[#86909C] border-b border-r border-[#E5E6EB]">最近校正</div><div className="px-4 py-3 border-b border-[#E5E6EB]">{activePlatformData.egoBinding?.verifiedAt ? new Date(activePlatformData.egoBinding.verifiedAt).toLocaleString('zh-CN', { hour12: false }) : '尚未完成'}</div>
                  <div className="px-4 py-3 bg-[#FAFAFA] text-[#86909C] border-r border-[#E5E6EB]">每日同步</div>
                  <div className="px-4 py-2">
                    <input
                      type="time"
                      value={activePlatformData.autoSyncTime || '09:00'}
                      onChange={(event) => setPlatforms(items => items.map(item => item.id === activePlatformData.id ? { ...item, autoSyncEnabled: true, autoSyncTime: event.target.value } : item))}
                      className="w-32 border border-[#E5E6EB] rounded px-2 py-1 text-[12px] focus:border-[#2954FF] focus:outline-none"
                    />
                  </div>
                </div>
              </div>
              <div className="bg-blue-50 border border-blue-100 px-4 py-3 rounded text-[12px] text-[#4E5969] leading-relaxed">系统会检查平台、登录状态和店铺名。发现登录失效或店铺不一致时会停止采集，不会写入错误数据。</div>
              {hasEgoBinding && !scanError && (
                <div className="bg-green-50 border border-green-100 px-4 py-3 rounded text-[12px] text-green-700 leading-relaxed flex items-start gap-2">
                  <CheckCircle2 size={15} className="mt-0.5 shrink-0" />
                  <span>校正通过：DataFactory 的「{activePlatformData.expectedShopName}」与 Ego Lite 当前店铺一致，平台和域名校验已通过。</span>
                </div>
              )}
              {scanError && <div className="bg-amber-50 border border-amber-100 text-amber-700 px-3 py-2 rounded text-[12px] flex items-center justify-between gap-4"><span>{scanError}</span>{egoResumeRequired && <button onClick={() => bindActiveShopToEgo({ resume: true })} disabled={isBindingEgo} className="shrink-0 px-3 py-1.5 bg-[#2954FF] text-white rounded disabled:opacity-50">{isBindingEgo ? '正在校验...' : '我已登录，重新校验'}</button>}</div>}
            </div>
            <div className="px-6 py-4 bg-[#FAFAFA] border-t border-[#E5E6EB] flex justify-end gap-3">
              <button onClick={() => setIsEgoBindingModalOpen(false)} className="px-4 py-1.5 text-[13px] text-[#4E5969] border border-[#E5E6EB] bg-white hover:bg-[#F2F3F5] rounded">关闭</button>
              <button onClick={() => bindActiveShopToEgo()} disabled={isBindingEgo} className="px-4 py-1.5 text-[13px] text-white bg-[#2954FF] hover:bg-blue-700 rounded disabled:opacity-50">{isBindingEgo ? '正在校正...' : hasEgoTaskSpace ? '重新校正' : '绑定并校正'}</button>
            </div>
          </div>
        </div>
      )}

      {shopPendingTrash && (
        <div className="absolute inset-0 z-50 bg-[#1D2129]/40 flex items-center justify-center p-4">
          <div className="bg-white rounded shadow-lg w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-[#E5E6EB] flex justify-between items-center bg-[#FAFAFA]">
              <h3 className="font-bold text-[15px] flex items-center gap-2"><Trash2 size={16} className="text-amber-600" /> 移入回收站</h3>
              <button onClick={() => setShopPendingTrash(null)} aria-label="关闭弹窗" className="text-[#86909C] hover:text-[#1D2129]"><X size={16} /></button>
            </div>
            <div className="p-6">
              <div className="text-[14px] text-[#1D2129]">确定将「{shopPendingTrash.name}」移入回收站吗？</div>
              <div className="mt-3 bg-amber-50 border border-amber-100 px-3 py-2.5 rounded text-[12px] text-amber-800 leading-relaxed">自动同步会立即暂停，未完成的采集任务会取消。字段规则和历史数据不会删除，以后可以从回收站恢复。</div>
              {shopMutationError && <div className="mt-3 bg-red-50 border border-red-100 text-red-600 px-3 py-2 rounded text-[12px]">{shopMutationError}</div>}
            </div>
            <div className="px-6 py-4 bg-[#FAFAFA] border-t border-[#E5E6EB] flex justify-end gap-3">
              <button onClick={() => setShopPendingTrash(null)} className="px-4 py-1.5 text-[13px] text-[#4E5969] border border-[#E5E6EB] bg-white hover:bg-[#F2F3F5] rounded">取消</button>
              <button onClick={handleMoveShopToTrash} className="px-4 py-1.5 text-[13px] text-white bg-amber-600 hover:bg-amber-700 rounded">移入回收站</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
