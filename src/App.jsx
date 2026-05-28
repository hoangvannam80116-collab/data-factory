import React, { useState, useEffect, useRef } from 'react';
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
  ToggleRight,
  PlaySquare,
  Save,
  Lock,
  AlertTriangle,
  Bot,
  Layers,
  ImagePlus,
  Wand2,
  Route,
  MessageSquare,
  ClipboardList,
  Gauge,
  Camera,
  BarChart3
} from 'lucide-react';
import {
  DEFAULT_USER_ID,
  DEFAULT_WORKSPACE_ID,
  INITIAL_HISTORY_RECORDS,
  INITIAL_PLATFORMS,
  INITIAL_TASK_RULES_BY_PLATFORM,
  PLATFORM_IDENTITY_DEFAULTS,
  buildTabbitBatchPrompt,
  inferAllowedDomains,
  isUrlAllowedForShop,
  normalizeAllowedDomains,
  normalizeDataFactoryState
} from './dataFactoryModel.js';

export default function App() {
  const storageKey = 'data-factory-mvp-state-v2';
  const apiBase = 'http://127.0.0.1:5180';
  const [workspaceId] = useState(DEFAULT_WORKSPACE_ID);
  const [userId] = useState(DEFAULT_USER_ID);
  const [mainView, setMainView] = useState('dashboard');

  const [platforms, setPlatforms] = useState(INITIAL_PLATFORMS);
  const [activePlatform, setActivePlatform] = useState('taobao');

  const [isAddShopModalOpen, setIsAddShopModalOpen] = useState(false);
  const [newShopForm, setNewShopForm] = useState({
    name: '',
    platformType: 'taobao',
    url: PLATFORM_IDENTITY_DEFAULTS.taobao.url,
    expectedShopName: '',
    allowedDomains: PLATFORM_IDENTITY_DEFAULTS.taobao.allowedDomains.join(', ')
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copiedStates, setCopiedStates] = useState({ key: false, cli: false, mcp: false, task: false });

  const [apiTab, setApiTab] = useState('mcp');

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
  const [openColMenuId, setOpenColMenuId] = useState(null);
  const [selectedRecordIds, setSelectedRecordIds] = useState([]);
  const [tableFilter, setTableFilter] = useState('all');
  const [sortDirection, setSortDirection] = useState('desc');
  const [collectionRequests, setCollectionRequests] = useState([]);
  const [storageReady, setStorageReady] = useState(false);
  const screenshotInputRef = useRef(null);
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
    form: emptyFieldForm
  });

  useEffect(() => {
    const handleClickOutside = () => setOpenColMenuId(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const activePlatformData = platforms.find(p => p.id === activePlatform);
  const activePlatformName = activePlatformData?.name;
  const getRecordSortValue = (record) => {
    if (record.createdAt) return record.createdAt;
    const idNumber = Number(String(record.id).replace(/\D/g, ''));
    return Number.isNaN(idNumber) ? 0 : idNumber;
  };
  const rawCurrentPlatformRecords = historyRecords.filter(record => record.platform === activePlatformName);
  const currentPlatformRecords = rawCurrentPlatformRecords
    .filter(record => tableFilter === 'all' || record.status === tableFilter)
    .sort((a, b) => {
      const comparison = getRecordSortValue(a) - getRecordSortValue(b);
      return sortDirection === 'desc' ? -comparison : comparison;
    });
  const latestRecord = currentPlatformRecords[0];
  const selectedTask = extractionTasks.find(task => task.id === activeTaskId) || extractionTasks[0];
  const fieldModalTask = extractionTasks.find(task => task.id === fieldModal.taskId);
  const readyRuleCount = extractionTasks.filter(task => task.status === 'ready').length;
  const latestCollectionRequest = collectionRequests[0];
  const pendingCollectionRequest = collectionRequests.find(request => request.status === 'waiting_for_codex');
  const hasExecutableRules = activePlatformData?.authStatus === 'verified' && readyRuleCount > 0;
  const canRunCollection = hasExecutableRules && !pendingCollectionRequest;
  const canRunFieldModalCollection = fieldModal.open && fieldModal.mode === 'edit' && fieldModalTask?.status === 'ready' && activePlatformData?.authStatus === 'verified' && !pendingCollectionRequest;
  const platformLabels = { taobao: '淘宝', pdd: '拼多多', jd: '京东', other: '其他' };
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
      const inferredName = payload.detectedName ?? platform.expectedShopName ?? (platform.platformType === 'taobao' ? '南苏科技' : '');
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
    calibratePlatform(activePlatform);
  };

  const applyPersistedState = (savedState) => {
    if (!savedState) return;
    const normalizedState = normalizeDataFactoryState(savedState);
    setPlatforms(normalizedState.platforms);
    setActivePlatform(normalizedState.activePlatform);
    setTaskRulesByPlatform(normalizedState.taskRulesByPlatform);
    setHistoryRecords(normalizedState.historyRecords);
    setCollectionRequests(normalizedState.collectionRequests);
  };

  const buildPersistedState = () => ({
    workspaceId,
    userId,
    platforms,
    activePlatform,
    taskRulesByPlatform,
    historyRecords,
    collectionRequests
  });

  useEffect(() => {
    let mounted = true;

    const restoreState = async () => {
      try {
        applyPersistedState(JSON.parse(localStorage.getItem(storageKey) || 'null'));
      } catch (error) {
        console.warn('Failed to restore DataFactory state', error);
      }

      try {
        const response = await fetch(`${apiBase}/state`);
        const payload = await response.json();
        if (mounted && payload?.state) {
          applyingRemoteStateRef.current = true;
          applyPersistedState(payload.state);
          lastServerUpdatedAtRef.current = payload.updatedAt || 0;
          setTimeout(() => {
            applyingRemoteStateRef.current = false;
          }, 0);
        }
      } catch (error) {
        console.warn('Failed to restore DataFactory server state', error);
      }

      if (mounted) setStorageReady(true);
    };

    restoreState();
    return () => {
      mounted = false;
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

    fetch(`${apiBase}/state`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: persistedState })
    })
      .then(response => response.json())
      .then(payload => {
        if (payload?.updatedAt) lastServerUpdatedAtRef.current = payload.updatedAt;
      })
      .catch(error => console.warn('Failed to persist DataFactory server state', error));
  }, [storageReady, workspaceId, userId, platforms, activePlatform, taskRulesByPlatform, historyRecords, collectionRequests]);

  useEffect(() => {
    if (!storageReady) return undefined;

    const intervalId = setInterval(async () => {
      try {
        const response = await fetch(`${apiBase}/state`);
        const payload = await response.json();
        if (!payload?.state || !payload.updatedAt || payload.updatedAt <= lastServerUpdatedAtRef.current) return;

        applyingRemoteStateRef.current = true;
        applyPersistedState(payload.state);
        lastServerUpdatedAtRef.current = payload.updatedAt;
        setTimeout(() => {
          applyingRemoteStateRef.current = false;
        }, 0);
      } catch (error) {
        console.warn('Failed to poll DataFactory server state', error);
      }
    }, 1000);

    return () => clearInterval(intervalId);
  }, [storageReady]);

  const markPendingCollectionRequest = ({ nextStatus = 'done', recordId = '', evidence = '' } = {}) => {
    setCollectionRequests(requests => {
      let marked = false;
      return requests.map(request => {
        if (marked || request.status !== 'waiting_for_codex') return request;
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

  const cancelPendingCollectionRequest = () => {
    if (!pendingCollectionRequest) return;
    setCollectionRequests(requests => requests.map(request => (
      request.id === pendingCollectionRequest.id
        ? {
          ...request,
          status: 'cancelled',
          completedAt: Date.now(),
          evidence: request.evidence || '用户取消等待中的采集任务。'
        }
        : request
    )));
  };

  const buildPromptForCollectionRequest = (request) => {
    if (!request) return '';
    if (request.tabbitPrompt?.trim()) return request.tabbitPrompt;

    const requestShop = platforms.find(platform => (
      platform.id === request.shopId
      || platform.id === request.platformId
      || platform.name === request.platformName
    )) || activePlatformData;
    const requestRules = Array.isArray(request.rules) && request.rules.length > 0
      ? request.rules
      : extractionTasks.filter(task => task.status === 'ready');

    if (!requestShop || requestRules.length === 0) return '';
    return buildTabbitBatchPrompt({ shop: requestShop, rules: requestRules });
  };

  const copyPendingCollectionPrompt = () => {
    const prompt = buildPromptForCollectionRequest(pendingCollectionRequest);
    if (!prompt) return;
    handleCopy('task', prompt);
  };

  const createCollectionRequest = ({ fieldNames } = {}) => {
    if (activePlatformData?.authStatus !== 'verified') {
      return { ok: false, error: 'platform_not_verified', activePlatformName };
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
      id: `RUN-${Date.now().toString().slice(-6)}`,
      workspaceId,
      shopId: activePlatform,
      createdAt: Date.now(),
      time: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
      platformId: activePlatform,
      platformName: activePlatformName,
      expectedShopName: activePlatformData.expectedShopName,
      detectedName: activePlatformData.detectedName,
      status: 'waiting_for_codex',
      rules,
      instruction: 'Codex 读取 tabbitPrompt 后调用 Tabbit MCP 执行采集，并通过 writeRecord 或 writeFieldResult 写回 DataFactory。',
      tabbitPrompt: buildTabbitBatchPrompt({ shop: activePlatformData, rules })
    };

    setCollectionRequests(requests => [request, ...requests]);
    setMainView('table');
    return { ok: true, request };
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
        records: historyRecords.filter(record => record.platform === activePlatformName)
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
      writeRecord: ({ data = {}, status = 'success', source = 'tabbit', evidence = '', shopCalibration, currentUrl } = {}) => {
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
          id: `REC-${Date.now().toString().slice(-6)}`,
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
      },
      writeFieldResult: ({ fieldName, ruleId, value, status = 'success', source = 'tabbit', evidence = '' } = {}) => {
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
      setOpenColMenuId(null);
    }
  }, [activePlatformData]);

  const handleAddShopSubmit = () => {
    if (!newShopForm.name.trim() || !newShopForm.expectedShopName.trim()) return;
    const newShop = {
      id: `shop_${Date.now()}`,
      workspaceId,
      platformType: newShopForm.platformType || 'other',
      name: newShopForm.name,
      url: newShopForm.url || 'https://',
      expectedShopName: newShopForm.expectedShopName.trim(),
      allowedDomains: normalizeAllowedDomains(newShopForm.allowedDomains),
      authStatus: 'unauthorized',
      detectedName: ''
    };
    setPlatforms([...platforms, newShop]);
    setTaskRulesByPlatform(prev => ({ ...prev, [newShop.id]: [] }));
    setActivePlatform(newShop.id);
    setMainView('dashboard');
    setNewShopForm({
      name: '',
      platformType: 'taobao',
      url: PLATFORM_IDENTITY_DEFAULTS.taobao.url,
      expectedShopName: '',
      allowedDomains: PLATFORM_IDENTITY_DEFAULTS.taobao.allowedDomains.join(', ')
    });
    setIsAddShopModalOpen(false);
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
      form: buildFieldFormFromTask(task)
    });
  };

  const closeFieldModal = () => {
    setFieldModal(prev => ({ ...prev, open: false }));
  };

  const updateFieldModalForm = (patch) => {
    setFieldModal(prev => ({ ...prev, form: { ...prev.form, ...patch } }));
  };

  const autoRecognizeFieldPath = () => {
    const fieldName = fieldModal.form.fieldName.trim() || '目标字段';
    updateFieldModalForm({
      screenshot: 'annotated',
      recognizedPath: `标题「${fieldName}」附近的主数值`,
      markerNote: fieldModal.form.markerNote || `箭头指向「${fieldName}」标题下方的目标数值`
    });
  };

  const handleScreenshotUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

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
    event.target.value = '';
  };

  const applyFieldPreset = (fieldName) => {
    const buildStoreMetricPreset = (name, valueType = '数字文本') => ({
      fieldName: name,
      prompt: `进入千牛商家工作台首页，找到「店铺数据」区域，读取「${name}」卡片里的当前主数值。只返回${valueType}。`,
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

    const isReady = Boolean(form.prompt.trim() && form.recognizedPath.trim());
    const markerNote = form.markerNote.trim().replaceAll('目标字段', fieldName);
    const taskPayload = {
      fieldName,
      value: form.defaultValue.trim() || null,
      prompt: form.prompt.trim(),
      pagePath: form.pagePath.trim() || '待上传标记截图后识别',
      clickPath: form.clickPath.trim(),
      screenshot: form.screenshotUrl || markerNote ? 'annotated' : null,
      screenshotUrl: form.screenshotUrl || '',
      markerNote,
      recognizedPath: form.recognizedPath.trim(),
      confidence: form.recognizedPath.trim() ? 88 : null,
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
    setOpenColMenuId(null);
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

  const handleAddManualRecord = () => {
    const emptyData = extractionTasks.reduce((data, task) => {
      data[task.fieldName] = '';
      return data;
    }, {});
    setHistoryRecords(records => [
      {
        id: `REC-${Date.now().toString().slice(-6)}`,
        workspaceId,
        shopId: activePlatform,
        time: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
        createdAt: Date.now(),
        platform: activePlatformName,
        status: 'success',
        source: 'manual',
        data: emptyData
      },
      ...records
    ]);
  };

  const handleExportRecords = () => {
    const headers = ['记录 ID', '提取时间', ...extractionTasks.map(task => task.fieldName)];
    const rows = currentPlatformRecords.map(record => [
      record.id,
      record.time,
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

  const apiKey = 'sk-factory-8f92a-xxxxxxxx-xxxx';
  const mcpConfigSnippet = `{
  "mcpServers": {
    "data-factory-server": {
      "command": "npx",
      "args": ["-y", "@data-factory/mcp-server"],
      "env": {
        "DATA_FACTORY_API_KEY": "${apiKey}"
      }
    }
  }
}`;
  const cliSnippet = `# 将此指令投喂给 CodeX 等终端 Agent，它将自动解析返回的 JSON
export DATA_FACTORY_API_KEY="sk-factory-xxxxxxxx"
data-factory get-records --shop "${activePlatformName}" --format json`;
  const restSnippet = `curl -X GET "https://api.datafactory.ai/v1/sandbox/${activePlatform}/records/latest" \\
  -H "Authorization: Bearer sk-factory-8f92a-..." \\
  -H "Content-Type: application/json"`;

  const handleCopy = async (type, text) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
    } catch (error) {
      console.warn('Failed to copy DataFactory snippet', error);
    }
    setCopiedStates(prev => ({ ...prev, [type]: true }));
    setTimeout(() => setCopiedStates(prev => ({ ...prev, [type]: false })), 2000);
  };

  const handleRunTabbitCollection = () => {
    if (isRefreshing) return;
    if (!canRunCollection) return;
    const result = createCollectionRequest();
    if (!result.ok) return;
    if (result.request?.tabbitPrompt) {
      handleCopy('task', result.request.tabbitPrompt);
    }
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleRunFieldModalCollection = () => {
    if (isRefreshing || !canRunFieldModalCollection) return;
    const result = createCollectionRequest({ fieldNames: [fieldModalTask.fieldName] });
    if (!result.ok) return;
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 500);
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
      tabbitPrompt: pendingCollectionPrompt
    } : null,
    latestRecord: latestRecord ? {
      id: latestRecord.id,
      time: latestRecord.time,
      status: latestRecord.status,
      data: latestRecord.data
    } : null
  };

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

      <div className="h-[52px] bg-[#2954FF] flex items-center justify-between px-5 text-white shrink-0 z-30 shadow-sm">
        <div className="flex items-center gap-8 h-full">
          <div className="flex items-center gap-2 font-bold text-lg cursor-pointer">
            <Database size={20} /> DataFactory <span className="text-[13px] font-normal opacity-80 ml-1">数据工厂</span>
          </div>
        </div>
        <div className="flex items-center gap-5">
          <div className="relative flex items-center bg-white/10 hover:bg-white/20 border border-white/10 transition-colors rounded px-3 py-1.5 w-64">
            <Search size={14} className="opacity-70 mr-2" />
            <input type="text" placeholder="全局检索..." className="bg-transparent border-none outline-none text-xs text-white placeholder:text-white/60 w-full" />
          </div>
          <div className="h-4 w-px bg-white/20" />
          <Bell size={16} className="cursor-pointer opacity-80 hover:opacity-100" />
          <div className="flex items-center gap-2 cursor-pointer hover:bg-white/10 py-1 px-2 rounded transition-colors">
            <div className="w-6 h-6 rounded-full bg-blue-400 border border-white/20 flex items-center justify-center text-xs font-bold shadow-sm">南</div>
            <span className="text-[13px]">南苏</span>
            <ChevronDown size={14} className="opacity-70" />
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-60 bg-white border-r border-[#E5E6EB] flex flex-col shrink-0 z-20">
          <div className="flex-1 overflow-y-auto py-5">
            <div className="px-5 text-xs font-medium text-[#86909C] mb-3">店铺</div>
            <div className="space-y-1 px-3">
              {platforms.map(p => (
                <button
                  key={p.id}
                  onClick={() => {
                    setActivePlatform(p.id);
                    if (mainView === 'api' || mainView === 'settings') setMainView('table');
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded transition-colors text-[13px] ${
                    activePlatform === p.id && mainView !== 'api' && mainView !== 'settings'
                      ? 'bg-[#F2F3F5] text-[#2954FF] font-medium'
                      : 'text-[#4E5969] hover:bg-[#F2F3F5]'
                  }`}
                >
                  <Store size={15} className="shrink-0" />
                  <span className="min-w-0 flex-1 text-left">
                    <span className="block truncate">{p.name}</span>
                    <span className={`block truncate text-[11px] font-normal ${
                      p.authStatus === 'verified' ? 'text-green-600' : p.authStatus === 'mismatch' ? 'text-red-500' : 'text-[#86909C]'
                    }`}>
                      {p.authStatus === 'verified' ? `已校准: ${p.detectedName}` : p.authStatus === 'mismatch' ? `不匹配: ${p.detectedName || '未知店铺'}` : `${platformLabels[p.platformType] || '平台'} 待校准`}
                    </span>
                  </span>
                  {p.authStatus === 'verified' && <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_4px_rgba(34,197,94,0.6)] shrink-0" />}
                  {p.authStatus === 'mismatch' && <div className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_4px_rgba(239,68,68,0.6)] shrink-0 animate-pulse" />}
                </button>
              ))}
              <button
                onClick={() => setIsAddShopModalOpen(true)}
                className="w-full flex items-center gap-2 px-3 py-2 mt-3 rounded border border-dashed border-[#E5E6EB] text-[#86909C] hover:text-[#2954FF] hover:border-[#2954FF] hover:bg-blue-50 transition-colors text-[13px]"
              >
                <Plus size={14} /> 添加店铺
              </button>
            </div>

            <div className="mt-8 px-5 text-xs font-medium text-[#86909C] mb-3">系统开放</div>
            <div className="space-y-1 px-3">
              <button
                onClick={() => setMainView('api')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded transition-colors text-[13px] ${
                  mainView === 'api' ? 'bg-[#F2F3F5] text-[#2954FF] font-medium' : 'text-[#4E5969] hover:bg-[#F2F3F5]'
                }`}
              >
                <Terminal size={15} className="shrink-0" />
                <span className="truncate flex-1 text-left">API 接口对接</span>
              </button>
              <button
                onClick={() => setMainView('settings')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded transition-colors text-[13px] ${
                  mainView === 'settings' ? 'bg-[#F2F3F5] text-[#2954FF] font-medium' : 'text-[#4E5969] hover:bg-[#F2F3F5]'
                }`}
              >
                <Settings size={15} className="shrink-0" />
                <span className="truncate flex-1 text-left">引擎偏好设置</span>
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col min-w-0 relative">
          <div className="h-[48px] bg-white border-b border-[#E5E6EB] flex items-center justify-between px-6 z-10 shrink-0 shadow-sm">
            <div className="flex items-center h-full min-w-0">
              {mainView !== 'api' && mainView !== 'settings' ? (
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
              ) : (
                <span className="text-[14px] font-bold text-[#1D2129]">
                  {mainView === 'api' ? '外部 AI 助手与接口开放' : '全局系统偏好设置'}
                </span>
              )}
            </div>
          </div>

          {mainView === 'table' && (
            <div className="flex-1 flex min-h-0 bg-white">
              <div className="flex-1 flex flex-col bg-white min-h-0 min-w-0">
              <div className="px-5 py-3 flex items-center justify-between border-b border-[#E5E6EB] shrink-0">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 text-[#1D2129] font-bold text-[15px]">{activePlatformName}</div>
                  <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[12px] border ${
                    activePlatformData?.authStatus === 'verified'
                      ? 'bg-green-50 text-green-600 border-green-100'
                      : activePlatformData?.authStatus === 'mismatch'
                        ? 'bg-red-50 text-red-600 border-red-100'
                        : 'bg-gray-100 text-[#86909C] border-gray-200'
                  }`}>
                    {activePlatformData?.authStatus === 'verified' ? <CheckCircle2 size={12} /> : <Lock size={12} />}
                    {activePlatformData?.authStatus === 'verified' ? `店铺: ${activePlatformData.detectedName}` : '待校准'}
                  </div>
                  <button onClick={handleCalibrateActivePlatform} className="text-[12px] text-[#4E5969] hover:text-[#2954FF] px-2 py-0.5 rounded hover:bg-blue-50 border border-[#E5E6EB]">
                    校准
                  </button>
                  {pendingCollectionRequest && (
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[12px] bg-blue-50 text-[#2954FF] border border-blue-100">
                      <RefreshCw size={12} className="animate-spin" /> 待本地执行器处理: {pendingCollectionRequest.id}
                      <button
                        onClick={copyPendingCollectionPrompt}
                        className="ml-1 text-[#2954FF] hover:underline"
                      >
                        {copiedStates.task ? '已复制' : '复制指令'}
                      </button>
                      <button onClick={cancelPendingCollectionRequest} className="text-[#86909C] hover:text-red-500">
                        取消
                      </button>
                    </div>
                  )}
                  <div className="h-4 w-px bg-[#E5E6EB]" />
                  <div className="flex items-center gap-4 border-r border-[#E5E6EB] pr-4">
                    <button className="flex items-center gap-1.5 text-[#4E5969] hover:text-[#2954FF] text-[13px] transition-colors">
                      <TableProperties size={14} className="text-[#2954FF]" /> 网格视图
                    </button>
                    <button
                      onClick={() => setTableFilter(tableFilter === 'all' ? 'error' : 'all')}
                      className={`flex items-center gap-1.5 text-[13px] transition-colors ${tableFilter === 'error' ? 'text-red-500 font-medium' : 'text-[#4E5969] hover:text-[#2954FF]'}`}
                    >
                      <Filter size={14} /> {tableFilter === 'error' ? '仅看异常' : '筛选'}
                    </button>
                    <button
                      onClick={() => setSortDirection(sortDirection === 'desc' ? 'asc' : 'desc')}
                      className="flex items-center gap-1.5 text-[#4E5969] hover:text-[#2954FF] text-[13px] transition-colors"
                    >
                      <ArrowDownUp size={14} /> {sortDirection === 'desc' ? '最新优先' : '最早优先'}
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => deleteRecords(selectedVisibleRecordIds)}
                    disabled={selectedVisibleRecordIds.length === 0}
                    className={`flex items-center gap-1.5 text-[13px] transition-colors px-3 py-1.5 rounded ${
                      selectedVisibleRecordIds.length > 0 ? 'text-red-500 hover:bg-red-50' : 'text-[#C9CDD4] cursor-not-allowed'
                    }`}
                  >
                    <Trash2 size={14} /> 删除{selectedVisibleRecordIds.length > 0 ? ` ${selectedVisibleRecordIds.length}` : ''}
                  </button>
                  <button onClick={handleExportRecords} className="flex items-center gap-1.5 text-[#4E5969] hover:bg-[#F2F3F5] text-[13px] transition-colors px-3 py-1.5 rounded">
                    <Download size={14} /> 导出
                  </button>
                  <button
                    onClick={handleRunTabbitCollection}
                    disabled={!canRunCollection}
                    className={`flex items-center gap-1.5 text-[13px] transition-colors px-4 py-1.5 rounded font-medium shadow-sm ${
                      canRunCollection ? 'bg-[#2954FF] text-white hover:bg-blue-700' : 'bg-[#C9CDD4] text-white cursor-not-allowed'
                    }`}
                  >
                    <Bot size={13} className={isRefreshing ? 'animate-pulse' : ''} />
                    {isRefreshing ? '已生成并复制指令' : (pendingCollectionRequest ? '任务已生成' : (canRunCollection ? '生成采集指令' : '待授权/配置'))}
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-x-auto overflow-y-auto relative bg-[#FAFAFA] customized-scrollbar">
                <table className="min-w-max w-full text-left border-collapse table-fixed bg-white">
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
                      <th className="w-[180px] border-b border-r border-[#E5E6EB] px-4 py-2 text-[#4E5969] font-medium text-[13px] bg-[#F7F8FA] sticky left-[48px] z-40 shadow-[1px_0_0_#E5E6EB] hover:bg-[#F2F3F5] transition-colors">
                        <div className="flex items-center gap-1.5"><AlignLeft size={13} className="text-[#86909C]" /> 记录 ID</div>
                      </th>
                      <th className="w-[180px] border-b border-r border-[#E5E6EB] px-4 py-2 text-[#4E5969] font-medium text-[13px] bg-[#F7F8FA] hover:bg-[#F2F3F5] transition-colors">
                        提取时间
                      </th>

                      {extractionTasks.map((task, index) => (
                        <th
                          key={task.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, index)}
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, index)}
                          className={`w-[180px] border-b border-r border-[#E5E6EB] px-3 py-2 text-[#1D2129] font-medium text-[13px] bg-[#F7F8FA] group relative transition-colors ${draggedColIdx === index ? 'opacity-30 bg-blue-50' : 'hover:bg-[#E8F3FF]'}`}
                        >
                          <div className="flex items-center justify-between h-full">
                            <div className="flex items-center gap-1.5 flex-1 min-w-0">
                              <div className="cursor-grab active:cursor-grabbing p-0.5 -ml-1 rounded hover:bg-[#DBE4FF] opacity-0 group-hover:opacity-100 transition-opacity text-[#86909C]">
                                <GripVertical size={13} />
                              </div>
                              <Bot size={13} className="text-[#2954FF] shrink-0" />
                              <span className="truncate cursor-pointer hover:underline decoration-dashed" onClick={(e) => { e.stopPropagation(); openEditFieldModal(task); }}>
                                {task.fieldName}
                              </span>
                            </div>
                            <button onClick={(e) => { e.stopPropagation(); setOpenColMenuId(openColMenuId === task.id ? null : task.id); }} className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-[#DBE4FF] text-[#4E5969] transition-opacity shrink-0">
                              <ChevronDown size={14} />
                            </button>
                          </div>
                          {openColMenuId === task.id && (
                            <div onClick={(e) => e.stopPropagation()} className="absolute top-[34px] right-2 z-50 w-40 bg-white border border-[#E5E6EB] rounded shadow-lg py-1 text-[12px] text-[#4E5969]">
                              <button onClick={() => { openEditFieldModal(task); setOpenColMenuId(null); }} className="w-full text-left px-3 py-2 hover:bg-[#F2F3F5]">编辑字段配置</button>
                              <button onClick={() => { handleAddColumn(index); setOpenColMenuId(null); }} className="w-full text-left px-3 py-2 hover:bg-[#F2F3F5]">左侧插入字段</button>
                              <button onClick={() => { handleAddColumn(index + 1); setOpenColMenuId(null); }} className="w-full text-left px-3 py-2 hover:bg-[#F2F3F5]">右侧插入字段</button>
                              <div className="h-px bg-[#E5E6EB] my-1" />
                              <button onClick={() => removeTask(task.id)} className="w-full text-left px-3 py-2 hover:bg-red-50 text-red-500 flex items-center gap-1.5">
                                <Trash2 size={12} /> 删除字段
                              </button>
                            </div>
                          )}
                        </th>
                      ))}

                      <th className="w-14 border-b border-l border-[#E5E6EB] px-2 py-2 bg-[#F7F8FA] sticky right-0 z-40 shadow-[-1px_0_0_#E5E6EB]">
                        <button
                          onClick={() => handleAddColumn()}
                          title="添加字段"
                          className="w-8 h-7 mx-auto flex items-center justify-center text-[#2954FF] rounded hover:bg-[#E8F3FF] transition-colors"
                        >
                          <Plus size={16} />
                        </button>
                      </th>
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
                        <td className={`border-b border-l border-[#E5E6EB] px-2 py-0 sticky right-0 z-20 shadow-[-1px_0_0_#E5E6EB] ${record.status === 'error' ? 'bg-[#FFF2F2]' : 'bg-[#FAFAFA] group-hover:bg-[#FAFAFA]'}`}>
                          <button
                            onClick={() => deleteRecords([record.id])}
                            className="opacity-0 group-hover:opacity-100 text-[#86909C] hover:text-red-500 hover:bg-red-50 rounded px-2 py-1 transition-all flex items-center gap-1 text-[12px]"
                          >
                            <Trash2 size={12} /> 删除
                          </button>
                        </td>
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
                      <td className="border-b border-l border-[#E5E6EB] bg-[#FAFAFA] sticky right-0 z-20 shadow-[-1px_0_0_#E5E6EB]" />
                    </tr>

                    {[...Array(15)].map((_, i) => (
                      <tr key={`empty-${i}`} className="h-[42px]">
                        <td className="border-b border-r border-[#E5E6EB] bg-[#FAFAFA] sticky left-0 z-20 shadow-[1px_0_0_#E5E6EB]" />
                        <td className="border-b border-r border-[#E5E6EB] bg-white sticky left-[48px] z-20 shadow-[1px_0_0_#E5E6EB]" />
                        <td className="border-b border-r border-[#E5E6EB] bg-white" />
                        {extractionTasks.map(task => <td key={`empty-td-${task.id}`} className="border-b border-r border-[#E5E6EB] bg-white" />)}
                        <td className="border-b border-l border-[#E5E6EB] bg-[#FAFAFA] sticky right-0 z-20 shadow-[-1px_0_0_#E5E6EB]" />
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="h-10 bg-white border-t border-[#E5E6EB] flex items-center justify-between px-4 shrink-0 text-xs text-[#4E5969]">
                <div className="flex items-center gap-1.5 cursor-pointer hover:bg-gray-100 px-2 py-1 rounded">
                  {currentPlatformRecords.length} 条记录{selectedVisibleRecordIds.length > 0 ? `，已选 ${selectedVisibleRecordIds.length} 条` : ''} <ChevronDown size={14} />
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
                      {fieldModal.mode === 'create' ? '添加字段' : '字段编辑'}
                    </span>
                    <div className="flex items-center gap-1">
                      {fieldModal.mode === 'edit' && (
                        <button
                          onClick={() => { removeTask(fieldModal.taskId); closeFieldModal(); }}
                          className="text-[#86909C] hover:text-red-500 p-1 hover:bg-red-50 rounded transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                      <button onClick={closeFieldModal} className="text-[#86909C] hover:text-[#1D2129] p-1 hover:bg-[#F2F3F5] rounded transition-colors">
                        <X size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#F7F8FA] customized-scrollbar">
                    <div className="bg-white border border-[#E5E6EB] rounded p-4">
                      <label className="block text-[12px] font-bold text-[#4E5969] mb-2">字段名称</label>
                      <input
                        type="text"
                        autoFocus
                        value={fieldModal.form.fieldName}
                        onChange={(e) => updateFieldModalForm({ fieldName: e.target.value })}
                        placeholder="请输入字段标题"
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
                      <label className="text-[12px] font-bold text-[#4E5969] mb-2 flex items-center gap-1.5"><MessageSquare size={13} /> 采集 Prompt</label>
                      <textarea
                        value={fieldModal.form.prompt}
                        onChange={(e) => updateFieldModalForm({ prompt: e.target.value })}
                        placeholder="告诉 Codex/Tabbit 到哪个页面、找哪个按钮或指标、最后只返回什么格式的数据。"
                        className="w-full min-h-[112px] border border-[#E5E6EB] bg-white rounded px-3 py-2 text-[13px] leading-relaxed focus:border-[#2954FF] focus:outline-none transition-colors resize-none"
                      />
                    </div>

	                    <div className="bg-white border border-[#E5E6EB] rounded overflow-hidden">
	                      <div className="px-4 py-3 border-b border-[#E5E6EB] bg-[#FAFAFA] flex items-center justify-between">
	                        <div className="text-[12px] font-bold text-[#4E5969] flex items-center gap-1.5"><ImagePlus size={13} /> 截图标记</div>
	                        <div className="flex items-center gap-1">
	                          <button onClick={() => screenshotInputRef.current?.click()} className="text-[#4E5969] hover:text-[#2954FF] hover:bg-blue-50 px-2 py-1 rounded text-[12px] font-medium flex items-center gap-1">
	                            <ImagePlus size={13} /> 上传
	                          </button>
	                          <button onClick={autoRecognizeFieldPath} className="text-[#2954FF] hover:bg-blue-50 px-2 py-1 rounded text-[12px] font-medium flex items-center gap-1">
	                            <Wand2 size={13} /> 自动识别路径
	                          </button>
	                        </div>
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
	                          onClick={() => screenshotInputRef.current?.click()}
	                          className={`w-full h-[142px] border border-dashed rounded relative overflow-hidden transition-colors ${fieldModal.form.screenshotUrl || fieldModal.form.markerNote ? 'border-[#2954FF] bg-[#F0F5FF]' : 'border-[#C9CDD4] hover:border-[#2954FF] bg-white'}`}
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
	                              <span className="text-[12px] font-medium">上传带箭头标记的截图</span>
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
                          placeholder="例如：箭头指向「支付金额」卡片里的当前主数值"
                          className="mt-3 w-full min-h-[64px] border border-[#E5E6EB] bg-white rounded px-3 py-2 text-[12px] leading-relaxed focus:border-[#2954FF] focus:outline-none transition-colors resize-none"
                        />
                      </div>
                    </div>

                    <div className="bg-white border border-[#E5E6EB] rounded p-4 space-y-3">
                      <label className="text-[12px] font-bold text-[#4E5969] flex items-center gap-1.5"><Route size={13} /> 页面、按钮与识别路径</label>
                      <input
                        type="text"
                        value={fieldModal.form.pagePath}
                        onChange={(e) => updateFieldModalForm({ pagePath: e.target.value })}
                        className="w-full border border-[#E5E6EB] bg-white rounded px-3 py-2 text-[12px] focus:border-[#2954FF] focus:outline-none transition-colors"
                        placeholder="页面路径"
                      />
                      <input
                        type="text"
                        value={fieldModal.form.clickPath}
                        onChange={(e) => updateFieldModalForm({ clickPath: e.target.value })}
                        className="w-full border border-[#E5E6EB] bg-white rounded px-3 py-2 text-[12px] focus:border-[#2954FF] focus:outline-none transition-colors"
                        placeholder="按钮路径 / 点击步骤"
                      />
                      <input
                        type="text"
                        value={fieldModal.form.recognizedPath}
                        onChange={(e) => updateFieldModalForm({ recognizedPath: e.target.value })}
                        className="w-full border border-[#E5E6EB] bg-white rounded px-3 py-2 text-[12px] focus:border-[#2954FF] focus:outline-none transition-colors"
                        placeholder="自动识别出的目标路径"
                      />
                      <input
                        type="text"
                        value={fieldModal.form.defaultValue}
                        onChange={(e) => updateFieldModalForm({ defaultValue: e.target.value })}
                        className="w-full border border-[#E5E6EB] bg-white rounded px-3 py-2 text-[12px] focus:border-[#2954FF] focus:outline-none transition-colors"
                        placeholder="默认值 / 测试值"
                      />
                    </div>
                  </div>

                  <div className="p-4 border-t border-[#E5E6EB] bg-white shrink-0 space-y-2">
                    <button
                      onClick={handleRunFieldModalCollection}
                      disabled={!canRunFieldModalCollection || isRefreshing}
                      className={`w-full py-2.5 rounded text-[13px] font-bold shadow-sm transition-colors flex items-center justify-center gap-2 ${
                        canRunFieldModalCollection ? 'bg-[#2954FF] hover:bg-blue-700 text-white' : 'bg-[#C9CDD4] text-white cursor-not-allowed'
                      }`}
                    >
                      <PlaySquare size={15} /> {pendingCollectionRequest ? '已有任务待本地执行器处理' : (fieldModal.mode === 'create' ? '保存后可测试' : (canRunFieldModalCollection ? '测试当前字段采集' : '待授权/配置后测试'))}
                    </button>
                    <button
                      onClick={handleFieldModalConfirm}
                      disabled={!fieldModal.form.fieldName.trim()}
                      className="w-full bg-[#1D2129] hover:bg-black text-white py-2.5 rounded text-[13px] font-bold shadow-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Save size={15} /> 保存字段规则
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {mainView === 'dashboard' && (
            <div className="flex-1 flex overflow-hidden">
              <div className="flex-1 flex flex-col min-w-0 bg-[#F2F3F5] p-5">
                <div className="bg-white border border-[#E5E6EB] rounded shadow-sm flex flex-col h-full min-h-0 overflow-hidden">
                  <div className="h-[58px] border-b border-[#E5E6EB] flex items-center justify-between px-5 bg-[#FAFAFA] shrink-0">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded bg-[#F0F5FF] text-[#2954FF] flex items-center justify-center shrink-0">
                        <Gauge size={18} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[15px] font-bold text-[#1D2129] truncate">{activePlatformName} 采集仪表盘</div>
                        <div className="text-[12px] text-[#86909C] mt-0.5">规则存储在字段中，由 Codex 读取后通过 Tabbit MCP 执行</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {activePlatformData?.authStatus === 'verified' && (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-50 text-green-600 border border-green-200 rounded text-xs font-medium">
                          <CheckCircle2 size={13} /> 店铺已校准: {activePlatformData.detectedName}
                        </div>
                      )}
                      {activePlatformData?.authStatus === 'unauthorized' && (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 text-gray-600 border border-gray-200 rounded text-xs font-medium">
                          <Lock size={13} /> 等待店铺校准
                        </div>
                      )}
                      {activePlatformData?.authStatus === 'mismatch' && (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-50 text-red-600 border border-red-200 rounded text-xs font-bold">
                          <AlertTriangle size={13} /> 识别为 {activePlatformData.detectedName || '未知店铺'}，预期 {activePlatformData.expectedShopName || '未填写'}
                        </div>
                      )}
                      <button
                        onClick={handleCalibrateActivePlatform}
                        className="flex items-center gap-1.5 text-[#4E5969] hover:text-[#2954FF] hover:bg-blue-50 text-[13px] transition-colors px-3 py-1.5 rounded border border-[#E5E6EB]"
                      >
                        <RefreshCw size={13} /> 校准店铺
                      </button>
                      {pendingCollectionRequest && (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-[#2954FF] border border-blue-100 rounded text-[12px] font-medium">
                          <RefreshCw size={12} className="animate-spin" /> 待处理: {pendingCollectionRequest.id}
                          <button onClick={copyPendingCollectionPrompt} className="hover:underline">
                            {copiedStates.task ? '已复制' : '复制指令'}
                          </button>
                          <button onClick={cancelPendingCollectionRequest} className="text-[#86909C] hover:text-red-500">
                            取消
                          </button>
                        </div>
                      )}
                      <button
                        onClick={handleRunTabbitCollection}
                        disabled={!canRunCollection}
                        className={`flex items-center gap-1.5 text-[13px] transition-colors px-4 py-1.5 rounded font-medium shadow-sm ${
                          canRunCollection ? 'bg-[#2954FF] text-white hover:bg-blue-700' : 'bg-[#C9CDD4] text-white cursor-not-allowed'
                        }`}
                      >
                        <Bot size={14} />
                        {isRefreshing ? '已生成并复制指令' : (pendingCollectionRequest ? '任务已生成' : (canRunCollection ? '生成采集指令' : '待授权/配置'))}
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-5 customized-scrollbar bg-[#F7F8FA]">
                    <div className="grid grid-cols-4 gap-4 mb-5">
                      <div className="bg-white border border-[#E5E6EB] rounded p-4">
                        <div className="text-[12px] text-[#86909C] mb-2 flex items-center gap-1.5"><ClipboardList size={14} /> 字段规则</div>
                        <div className="text-[26px] font-bold text-[#1D2129]">{extractionTasks.length}</div>
                      </div>
                      <div className="bg-white border border-[#E5E6EB] rounded p-4">
                        <div className="text-[12px] text-[#86909C] mb-2 flex items-center gap-1.5"><CheckCircle2 size={14} /> 可执行规则</div>
                        <div className="text-[26px] font-bold text-[#1D2129]">{readyRuleCount}</div>
                      </div>
                      <div className="bg-white border border-[#E5E6EB] rounded p-4">
                        <div className="text-[12px] text-[#86909C] mb-2 flex items-center gap-1.5"><Camera size={14} /> 标记截图</div>
                        <div className="text-[26px] font-bold text-[#1D2129]">{extractionTasks.filter(task => task.screenshot).length}</div>
                      </div>
                      <div className="bg-white border border-[#E5E6EB] rounded p-4">
                        <div className="text-[12px] text-[#86909C] mb-2 flex items-center gap-1.5"><RefreshCw size={14} /> 最近采集</div>
                        <div className="text-[26px] font-bold text-[#1D2129]">{latestCollectionRequest?.time || latestRecord?.time || '-'}</div>
                        {latestCollectionRequest && (
                          <div className="text-[11px] text-[#86909C] mt-1 truncate">
                            {latestCollectionRequest.status === 'waiting_for_codex' ? '待本地执行器处理' : latestCollectionRequest.status === 'done' ? '已写回表格' : latestCollectionRequest.status === 'cancelled' ? '已取消' : '执行异常'}
                          </div>
                        )}
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
                          <div className="text-[12px] text-[#86909C] mt-2 truncate">{task.recognizedPath || '等待截图识别路径'}</div>
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

          {(mainView === 'api' || mainView === 'settings') && (
            <div className="flex-1 overflow-y-auto p-8 bg-[#F2F3F5] customized-scrollbar">
              <div className="max-w-4xl mx-auto space-y-6">
                {mainView === 'api' ? (
                  <div className="bg-white rounded border border-[#E5E6EB] shadow-sm overflow-hidden flex flex-col min-h-[600px]">
                    <div className="px-8 pt-8 pb-4 border-b border-[#E5E6EB] bg-[#FAFAFA]">
                      <h2 className="text-xl font-bold text-[#1D2129] flex items-center gap-2 mb-2"><Terminal size={20} className="text-[#2954FF]" /> 开放接口与 AI 集成</h2>
                      <p className="text-[#86909C] text-[13px]">将当前店铺中的结构化数据，无缝对接给大语言模型 (LLM) 或自动化业务流。</p>

                      <div className="flex items-center gap-6 mt-6">
                        <button onClick={() => setApiTab('mcp')} className={`pb-3 text-[14px] font-medium border-b-[3px] transition-colors ${apiTab === 'mcp' ? 'border-[#2954FF] text-[#2954FF]' : 'border-transparent text-[#4E5969] hover:text-[#1D2129]'}`}>
                          <div className="flex items-center gap-1.5"><Bot size={15} /> Claude / CodeX (MCP协议)</div>
                        </button>
                        <button onClick={() => setApiTab('cli')} className={`pb-3 text-[14px] font-medium border-b-[3px] transition-colors ${apiTab === 'cli' ? 'border-[#2954FF] text-[#2954FF]' : 'border-transparent text-[#4E5969] hover:text-[#1D2129]'}`}>
                          <div className="flex items-center gap-1.5"><Terminal size={15} /> 终端指令 (CLI Tools)</div>
                        </button>
                        <button onClick={() => setApiTab('rest')} className={`pb-3 text-[14px] font-medium border-b-[3px] transition-colors ${apiTab === 'rest' ? 'border-[#2954FF] text-[#2954FF]' : 'border-transparent text-[#4E5969] hover:text-[#1D2129]'}`}>
                          <div className="flex items-center gap-1.5"><Layers size={15} /> RESTful API</div>
                        </button>
                      </div>
                    </div>

                    <div className="p-8 flex-1">
                      {apiTab === 'mcp' && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                          <div className="bg-blue-50 border border-blue-100 p-4 rounded-md">
                            <h4 className="text-[13px] font-bold text-[#1D2129] mb-1 flex items-center gap-1.5"><CheckCircle2 size={14} className="text-blue-600" /> Model Context Protocol (MCP) 支持</h4>
                            <p className="text-[12px] text-[#4E5969] leading-relaxed">
                              本系统原生支持 MCP 协议。你可以将其作为 Server 添加到 <strong className="text-[#1D2129]">Claude Desktop、Cursor 或 CodeX</strong> 中。AI 助手将自动理解店铺字段，并在对话中直接读取实时数据。
                            </p>
                          </div>

                          <div>
                            <div className="text-[13px] font-bold text-[#1D2129] mb-2 flex items-center justify-between">
                              <span>1. 客户端配置文件 (<code className="bg-[#F2F3F5] px-1 py-0.5 rounded text-[#2954FF]">claude_desktop_config.json</code>)</span>
                              <button onClick={() => handleCopy('mcp', mcpConfigSnippet)} className="text-[#86909C] hover:text-[#2954FF] flex items-center gap-1 text-[12px]">
                                {copiedStates.mcp ? <Check size={13} className="text-green-500" /> : <Copy size={13} />} {copiedStates.mcp ? '已复制' : '复制代码'}
                              </button>
                            </div>
                            <div className="bg-[#1D2129] rounded p-4 relative group overflow-hidden">
                              <pre className="text-green-400 text-[13px] font-mono whitespace-pre-wrap leading-relaxed">
{mcpConfigSnippet}
                              </pre>
                            </div>
                          </div>

                          <div>
                            <div className="text-[13px] font-bold text-[#1D2129] mb-2">2. 可被 AI 调用的 Tools 清单</div>
                            <div className="border border-[#E5E6EB] rounded overflow-hidden">
                              <table className="w-full text-left text-[13px]">
                                <thead className="bg-[#F7F8FA] border-b border-[#E5E6EB] text-[#4E5969]">
                                  <tr><th className="px-4 py-2.5 font-medium">Tool 名称</th><th className="px-4 py-2.5 font-medium">描述</th><th className="px-4 py-2.5 font-medium">参数</th></tr>
                                </thead>
                                <tbody>
                                  <tr className="border-b border-[#E5E6EB]">
                                    <td className="px-4 py-3 font-mono text-[#2954FF]">get_shop_records</td>
                                    <td className="px-4 py-3 text-[#1D2129]">获取指定店铺的最新结构化抓取数据</td>
                                    <td className="px-4 py-3 font-mono text-[#86909C]">shop_id (string)</td>
                                  </tr>
                                  <tr>
                                    <td className="px-4 py-3 font-mono text-[#2954FF]">trigger_extraction</td>
                                    <td className="px-4 py-3 text-[#1D2129]">命令店铺任务立即在后台执行一次采集</td>
                                    <td className="px-4 py-3 font-mono text-[#86909C]">shop_id (string)</td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      )}

                      {apiTab === 'cli' && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                          <div>
                            <div className="text-[13px] font-bold text-[#1D2129] mb-2 flex items-center justify-between">
                              <span>全局安装 NPM 包</span>
                            </div>
                            <div className="bg-[#1D2129] rounded p-4 relative group">
                              <pre className="text-white text-[13px] font-mono whitespace-pre-wrap">npm install -g @data-factory/cli</pre>
                            </div>
                          </div>

                          <div>
                            <div className="text-[13px] font-bold text-[#1D2129] mb-2 flex items-center justify-between">
                              <span>拉取环境数据 (JSON 输出)</span>
                              <button onClick={() => handleCopy('cli', cliSnippet)} className="text-[#86909C] hover:text-[#2954FF] flex items-center gap-1 text-[12px]">
                                {copiedStates.cli ? <Check size={13} className="text-green-500" /> : <Copy size={13} />} {copiedStates.cli ? '已复制' : '复制代码'}
                              </button>
                            </div>
                            <div className="bg-[#1D2129] rounded p-4 relative group">
                              <pre className="text-green-400 text-[13px] font-mono whitespace-pre-wrap leading-relaxed">
                                <span className="text-[#86909C]"># 将此指令投喂给 CodeX 等终端 Agent，它将自动解析返回的 JSON</span>{'\n'}
                                export DATA_FACTORY_API_KEY="sk-factory-xxxxxxxx"{'\n'}
                                data-factory get-records --shop "{activePlatformName}" --format json
                              </pre>
                            </div>
                          </div>
                        </div>
                      )}

                      {apiTab === 'rest' && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                          <div>
                            <div className="text-[13px] font-bold text-[#1D2129] mb-2">专属通信密钥 (Bearer Token)</div>
                            <div className="flex gap-3">
                              <div className="flex-1 bg-[#F7F8FA] border border-[#E5E6EB] px-3 py-2.5 text-[13px] text-[#4E5969] font-mono rounded shadow-inner">{apiKey}</div>
                              <button onClick={() => handleCopy('key', apiKey)} className="bg-[#2954FF] hover:bg-blue-700 text-white px-5 py-2.5 text-[13px] rounded transition-colors flex items-center gap-1.5 shadow-sm">
                                {copiedStates.key ? <Check size={14} /> : <Copy size={14} />} {copiedStates.key ? '已复制' : '复制'}
                              </button>
                            </div>
                          </div>

                          <div className="border border-[#E5E6EB] rounded">
                            <div className="bg-[#FAFAFA] border-b border-[#E5E6EB] px-4 py-3 flex items-center gap-3">
                              <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[12px] font-bold font-mono">GET</span>
                              <span className="text-[13px] font-mono text-[#1D2129]">/api/v1/sandbox/{activePlatform}/records/latest</span>
                            </div>
                            <div className="p-4 bg-[#1D2129]">
                              <pre className="text-blue-300 text-[13px] font-mono whitespace-pre-wrap leading-relaxed">
{restSnippet}
                              </pre>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded border border-[#E5E6EB] shadow-sm overflow-hidden p-8">
                    <div className="mb-8 border-b border-[#E5E6EB] pb-4">
                      <h2 className="text-lg font-bold text-[#1D2129] flex items-center gap-2"><Settings size={18} className="text-[#2954FF]" /> 偏好设置</h2>
                      <p className="text-[#86909C] text-[13px] mt-1">调整系统底层的抓取引擎策略。</p>
                    </div>
                    <div className="space-y-6">
                      <div className="flex items-center justify-between py-2">
                        <div>
                          <h4 className="text-[14px] font-bold text-[#1D2129]">无头静默模式</h4>
                          <p className="text-[12px] text-[#86909C] mt-1">隐藏浏览器窗口执行采集，降低性能占用。</p>
                        </div>
                        <ToggleRight className="text-[#2954FF] cursor-pointer" size={32} />
                      </div>
                      <div className="border-t border-[#E5E6EB] pt-6">
                        <label className="block text-[13px] font-bold text-[#1D2129] mb-2">OCR 识别模型选择</label>
                        <select className="w-full border border-[#E5E6EB] bg-[#FAFAFA] rounded px-3 py-2 text-[13px] focus:border-[#2954FF] focus:outline-none">
                          <option>PaddleOCR v4 (离线高速)</option>
                          <option>Tesseract OCR</option>
                        </select>
                      </div>
                      <div className="flex justify-end pt-4">
                        <button className="px-5 py-2 text-[13px] font-medium text-white bg-[#2954FF] hover:bg-blue-700 rounded transition-colors">
                          保存更改
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {isAddShopModalOpen && (
        <div className="absolute inset-0 z-50 bg-[#1D2129]/40 flex items-center justify-center p-4">
          <div className="bg-white rounded shadow-lg w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-[#E5E6EB] flex justify-between items-center bg-[#FAFAFA]">
              <h3 className="font-bold text-[#1D2129] text-[15px] flex items-center gap-2">
                <Store size={16} className="text-[#2954FF]" />
                添加店铺
              </h3>
              <button onClick={() => setIsAddShopModalOpen(false)} className="text-[#86909C] hover:text-[#1D2129] transition-colors"><X size={16} /></button>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <label className="block text-[13px] font-bold text-[#1D2129] mb-2">平台类型 <span className="text-red-500">*</span></label>
                <select
                  value={newShopForm.platformType}
                  onChange={(e) => {
                    const platformType = e.target.value;
                    const defaults = PLATFORM_IDENTITY_DEFAULTS[platformType] || PLATFORM_IDENTITY_DEFAULTS.other;
                    setNewShopForm({
                      ...newShopForm,
                      platformType,
                      url: defaults.url,
                      allowedDomains: defaults.allowedDomains.join(', ')
                    });
                  }}
                  className="w-full border border-[#E5E6EB] bg-white rounded px-3 py-2 text-[13px] focus:border-[#2954FF] focus:outline-none transition-colors"
                >
                  {Object.entries(PLATFORM_IDENTITY_DEFAULTS).map(([value, config]) => (
                    <option key={value} value={value}>{config.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[13px] font-bold text-[#1D2129] mb-2">店铺备注名 <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  autoFocus
                  placeholder="例如：淘宝店铺A (核心)"
                  className="w-full border border-[#E5E6EB] bg-white rounded px-3 py-2 text-[13px] focus:border-[#2954FF] focus:outline-none transition-colors"
                  value={newShopForm.name}
                  onChange={(e) => setNewShopForm({ ...newShopForm, name: e.target.value })}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddShopSubmit()}
                />
              </div>

              <div>
                <label className="block text-[13px] font-bold text-[#1D2129] mb-2">后台入口链接 <span className="text-red-500">*</span></label>
                <input
                  type="url"
                  placeholder="https://myseller.taobao.com/"
                  className="w-full border border-[#E5E6EB] bg-white rounded px-3 py-2 text-[13px] focus:border-[#2954FF] focus:outline-none transition-colors"
                  value={newShopForm.url}
                  onChange={(e) => {
                    const url = e.target.value;
                    setNewShopForm({
                      ...newShopForm,
                      url,
                      allowedDomains: inferAllowedDomains({ platformType: newShopForm.platformType, url }).join(', ')
                    });
                  }}
                />
              </div>

              <div>
                <label className="block text-[13px] font-bold text-[#1D2129] mb-2">预期店铺名 <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  placeholder="例如：南苏科技；Tabbit 必须先校准到这个店铺"
                  className="w-full border border-[#E5E6EB] bg-white rounded px-3 py-2 text-[13px] focus:border-[#2954FF] focus:outline-none transition-colors"
                  value={newShopForm.expectedShopName}
                  onChange={(e) => setNewShopForm({ ...newShopForm, expectedShopName: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-[13px] font-bold text-[#1D2129] mb-2">允许域名</label>
                <textarea
                  placeholder="例如：myseller.taobao.com, sycm.taobao.com"
                  className="w-full min-h-[72px] border border-[#E5E6EB] bg-white rounded px-3 py-2 text-[13px] leading-relaxed focus:border-[#2954FF] focus:outline-none transition-colors resize-none"
                  value={newShopForm.allowedDomains}
                  onChange={(e) => setNewShopForm({ ...newShopForm, allowedDomains: e.target.value })}
                />
                <div className="text-[12px] text-[#86909C] mt-1">Tabbit 如果跑到其他平台或不在这些域名内，DataFactory 会阻止写回。</div>
              </div>
            </div>

            <div className="px-6 py-4 bg-[#FAFAFA] border-t border-[#E5E6EB] flex justify-end gap-3">
              <button onClick={() => setIsAddShopModalOpen(false)} className="px-4 py-1.5 text-[13px] font-medium text-[#4E5969] border border-[#E5E6EB] bg-white hover:bg-[#F2F3F5] rounded transition-colors">取消</button>
              <button onClick={handleAddShopSubmit} disabled={!newShopForm.name.trim() || !newShopForm.expectedShopName.trim()} className="px-4 py-1.5 text-[13px] font-medium text-white bg-[#2954FF] hover:bg-blue-700 rounded disabled:opacity-50 transition-colors">保存店铺</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
