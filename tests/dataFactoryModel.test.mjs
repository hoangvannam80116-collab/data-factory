import test from 'node:test';
import assert from 'node:assert/strict';
import {
  completeCollectionRunFromEgoPayload,
  createShop,
  createCollectionRun,
  createInitialDataFactoryState,
  isUrlAllowedForShop,
  markCollectionRunStarted,
  moveShopToTrash,
  normalizeDataFactoryState,
  restoreShopFromTrash
} from '../src/dataFactoryModel.js';

const verifiedState = () => {
  const added = createShop(createInitialDataFactoryState(), {
    id: 'taobao',
    name: '淘宝测试店铺',
    expectedShopName: '测试平台店铺',
    platformType: 'taobao',
    url: 'https://myseller.taobao.com/home.htm/QnworkbenchHome/'
  });
  const state = {
    ...added.state,
    taskRulesByPlatform: {
      taobao: [
        { id: 'field-pay', shopId: 'taobao', fieldName: '支付金额', status: 'ready' },
        { id: 'field-visitors', shopId: 'taobao', fieldName: '访客数', status: 'ready' }
      ]
    }
  };
  return {
    ...state,
    platforms: state.platforms.map(shop => shop.id === 'taobao' ? {
      ...shop,
      authStatus: 'verified',
      detectedName: '测试平台店铺',
      egoBinding: {
        taskSpaceId: 2,
        taskSpaceName: 'DataFactory · 淘宝 / 千牛 · 测试平台店铺',
        shopNameMatched: true,
        verification: {
          platformMatched: true,
          urlAllowed: true,
          loginRequired: false
        }
      }
    } : shop)
  };
};

test('unverified shop cannot create a collection run', () => {
  const state = verifiedState();
  state.platforms = state.platforms.map(shop => ({ ...shop, authStatus: 'unauthorized' }));

  const result = createCollectionRun(state, { shopId: 'taobao' });
  assert.equal(result.ok, false);
  assert.equal(result.error, 'shop_not_verified');
});

test('verified shop completes one run and writes one record', () => {
  const created = createCollectionRun(verifiedState(), { shopId: 'taobao' });
  assert.equal(created.ok, true);
  assert.equal(created.run.rules.length, 2);

  const started = markCollectionRunStarted(created.state, { runId: created.run.id });
  assert.equal(started.ok, true);
  assert.equal(started.run.status, 'running');

  const completed = completeCollectionRunFromEgoPayload(started.state, {
    runId: created.run.id,
    payload: {
      shopCalibration: {
        expectedShopName: '测试平台店铺',
        detectedShopName: '测试平台店铺',
        status: 'verified'
      },
      currentUrl: 'https://myseller.taobao.com/home.htm/QnworkbenchHome/',
      dataUpdatedAt: '2026-08-29 09:00:01',
      fields: [
        { fieldName: '支付金额', value: '20', status: 'success' },
        { fieldName: '访客数', value: '39', status: 'success' }
      ]
    }
  });

  assert.equal(completed.ok, true);
  assert.deepEqual(completed.record.data, { 支付金额: '20', 访客数: '39' });
  assert.equal(completed.state.collectionRequests[0].status, 'done');
  assert.equal(completed.state.collectionRequests[0].recordId, completed.record.id);
});

test('wrong shop, wrong domain, and stale payload are rejected', () => {
  const created = createCollectionRun(verifiedState(), { shopId: 'taobao' });
  const basePayload = {
    shopCalibration: {
      expectedShopName: '测试平台店铺',
      detectedShopName: '测试平台店铺',
      status: 'verified'
    },
    currentUrl: 'https://myseller.taobao.com/home.htm/QnworkbenchHome/',
    dataUpdatedAt: '2026-08-29 09:00:01',
    fields: [{ fieldName: '支付金额', value: '20', status: 'success' }]
  };

  const wrongShop = completeCollectionRunFromEgoPayload(created.state, {
    runId: created.run.id,
    payload: {
      ...basePayload,
      shopCalibration: { ...basePayload.shopCalibration, detectedShopName: '其他店铺' }
    }
  });
  assert.equal(wrongShop.error, 'shop_name_mismatch');

  const wrongDomain = completeCollectionRunFromEgoPayload(created.state, {
    runId: created.run.id,
    payload: { ...basePayload, currentUrl: 'https://mms.pinduoduo.com/' }
  });
  assert.equal(wrongDomain.error, 'current_url_not_allowed');

  const stalePayload = completeCollectionRunFromEgoPayload(created.state, {
    runId: created.run.id,
    payload: { ...basePayload, dataUpdatedAt: '' }
  });
  assert.equal(stalePayload.error, 'data_updated_at_required');
});

test('taobao shop allows workbench domains but not loginmyseller', () => {
  const added = createShop(createInitialDataFactoryState(), {
    id: 'taobao',
    name: '淘宝测试店铺',
    expectedShopName: '测试平台店铺',
    platformType: 'taobao',
    url: 'https://myseller.taobao.com/home.htm/QnworkbenchHome/'
  });
  const shop = added.shop;
  assert.equal(Boolean(shop), true);
  assert.equal(isUrlAllowedForShop(shop, 'https://loginmyseller.taobao.com/'), false);
  assert.equal(isUrlAllowedForShop(shop, 'https://myseller.taobao.com/home.htm/QnworkbenchHome/'), true);
  assert.equal(isUrlAllowedForShop(shop, 'https://sycm.taobao.com/'), true);
  assert.equal(isUrlAllowedForShop(shop, 'https://qn.taobao.com/home.htm'), true);
});

test('shop can be added, moved to trash, and restored without losing related data', () => {
  const initial = createInitialDataFactoryState();
  const added = createShop(initial, {
    id: 'shop-test',
    name: '测试店铺',
    expectedShopName: '测试店铺',
    platformType: 'taobao',
    url: 'https://myseller.taobao.com/home.htm/QnworkbenchHome/',
    autoSyncTime: '10:30'
  });
  assert.equal(added.ok, true);
  assert.equal(added.state.activePlatform, 'shop-test');

  const withRelatedData = {
    ...added.state,
    taskRulesByPlatform: {
      ...added.state.taskRulesByPlatform,
      'shop-test': [{ id: 'field-1', fieldName: '支付金额', status: 'ready' }]
    },
    historyRecords: [{ id: 'record-1', shopId: 'shop-test', platform: '测试店铺', data: {} }],
    collectionRequests: [{ id: 'run-1', shopId: 'shop-test', status: 'waiting_for_runner' }]
  };
  const trashed = moveShopToTrash(withRelatedData, { shopId: 'shop-test' });
  assert.equal(trashed.ok, true);
  assert.equal(trashed.state.platforms.some(shop => shop.id === 'shop-test'), false);
  assert.equal(trashed.state.trashedShops[0].id, 'shop-test');
  assert.equal(trashed.state.taskRulesByPlatform['shop-test'].length, 1);
  assert.equal(trashed.state.historyRecords[0].shopId, 'shop-test');
  assert.equal(trashed.state.collectionRequests[0].status, 'cancelled');

  const restored = restoreShopFromTrash(trashed.state, { shopId: 'shop-test' });
  assert.equal(restored.ok, true);
  assert.equal(restored.shop.authStatus, 'unauthorized');
  assert.equal(restored.shop.egoBinding, null);
  assert.equal(restored.state.activePlatform, 'shop-test');
  assert.equal(restored.state.taskRulesByPlatform['shop-test'].length, 1);
});

test('duplicate shop in trash must be restored instead of re-created', () => {
  const added = createShop(createInitialDataFactoryState(), {
    id: 'shop-duplicate',
    name: '测试店铺',
    expectedShopName: '平台真实店名',
    platformType: 'taobao',
    url: 'https://myseller.taobao.com/'
  });
  const trashed = moveShopToTrash(added.state, { shopId: 'shop-duplicate' });
  const duplicate = createShop(trashed.state, {
    name: '另一个显示名',
    expectedShopName: '平台真实店名',
    platformType: 'taobao',
    url: 'https://myseller.taobao.com/'
  });
  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.error, 'shop_in_trash');
});

test('normalization preserves a valid empty active shop list', () => {
  const normalized = normalizeDataFactoryState({
    ...createInitialDataFactoryState(),
    platforms: [],
    activePlatform: ''
  });
  assert.deepEqual(normalized.platforms, []);
  assert.equal(normalized.activePlatform, '');
});

test('fresh install starts without demo shops or fake records', () => {
  const state = createInitialDataFactoryState();
  assert.deepEqual(state.platforms, []);
  assert.deepEqual(state.historyRecords, []);
  assert.deepEqual(state.taskRulesByPlatform, {});
  assert.equal(state.activePlatform, '');
});
