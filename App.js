import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  SafeAreaView,
  View,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  useColorScheme,
} from 'react-native';
import axios from 'axios';
import {
  Appbar,
  Button,
  Card,
  Divider,
  MD3DarkTheme,
  MD3LightTheme,
  Provider as PaperProvider,
  Text as PaperText,
  TextInput,
} from 'react-native-paper';
import Constants from 'expo-constants';
axios.defaults.headers.common["ngrok-skip-browser-warning"] = "true";

// ===== サーバー設定 =====
// NOTE: Store sensitive values in `app.json` -> `expo.extra` (or provide via build-time env).
const EXPO_EXTRA =
  Constants.expoConfig?.extra ??
  // Fallback for some Expo runtimes/dev modes
  Constants.manifest?.extra ??
  {};
// API は Electron 側 `main.js` の Express（既定: http://localhost:3000）
const API_ORIGIN = process.env.EXPO_PUBLIC_SERVER_BASE_URL ?? EXPO_EXTRA.SERVER_BASE_URL;;
const API_KEY = process.env.EXPO_PUBLIC_API_KEY ?? EXPO_EXTRA.API_KEY;

const CONFIG_OK = Boolean(API_KEY);

// ======================= iPhone kind / color master =======================
const COLOR_GROUPS = [
  {
    title: 'iPhone 16',
    key: 'iphone-16',
    colors: [
      { key: '0', label: 'ウルトラマリン', value: '#9fb2f6' },
      { key: '1', label: 'ティール', value: '#b5d7d6' },
      { key: '2', label: 'ピンク', value: '#f4b1dc' },
      { key: '3', label: 'ホワイト', value: '#fafafa' },
      { key: '4', label: 'ブラック', value: '#000000' },
    ],
  },
  {
    title: 'iPhone 17 Pro',
    key: 'iphone-17-pro',
    colors: [
      { key: '0', label: 'シルバー', value: '#f5f5f7' },
      { key: '1', label: 'コズミックオレンジ', value: '#f77e39' },
      { key: '2', label: 'ディープブルー', value: '#45517b' },
    ],
  },
];

const PERSONAL_FIELDS = [
  { key: 'lastName', label: '姓（ローマ字）' },
  { key: 'firstName', label: '名（ローマ字）' },
  { key: 'postalCode', label: '郵便番号' },
  { key: 'state', label: '都道府県（コード）' },
  { key: 'city', label: '市区町村' },
  { key: 'street', label: '住所1' },
  { key: 'street2', label: '住所2' },
  { key: 'emailAddress', label: 'メールアドレス' },
  { key: 'mobilePhone', label: '携帯電話' },
  { key: 'cardNumber', label: 'カード番号' },
  { key: 'expiration', label: '有効期限（MM/YY）' },
  { key: 'securityCode', label: 'セキュリティコード' },
  { key: 'appleId', label: 'Apple ID' },
  { key: 'applePassword', label: 'Apple パスワード' },
];

const STORE_OPTIONS = [
  { v: 'R718', l: '丸の内', zip: '100-0005' },
  { v: 'R079', l: '銀座', zip: '104-0061' },
  { v: 'R224', l: '表参道', zip: '150-0001' },
  { v: 'R768', l: '梅田', zip: '530-0011' },
  { v: 'R091', l: '心斎橋', zip: '542-0085' },
  { v: 'R005', l: '名古屋栄', zip: '460-0008' },
  { v: 'R119', l: '渋谷', zip: '150-0042' },
  { v: 'R128', l: '新宿', zip: '160-0022' },
  { v: 'R710', l: '川崎', zip: '210-0007' },
  { v: 'R711', l: '京都', zip: '600-8005' },
];

const LS_KEYS = {
  personalInfo: 'iphoneAutoPurchase.personalInfo.v1',
  iphoneRows: 'iphoneAutoPurchase.iphoneRows.v1',
  flowStep: 'iphoneAutoPurchase.flowStep.v1',
};

function canUseLocalStorage() {
  try {
    return typeof globalThis !== 'undefined' && Boolean(globalThis.localStorage);
  } catch {
    return false;
  }
}

function lsGet(key) {
  try {
    return globalThis.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function lsSet(key, value) {
  try {
    globalThis.localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

export default function App() {
  // ===== index.html のフォームに対応するステート =====
  const [itemUrl, setItemUrl] = useState(
    'https://www.apple.com/jp/shop/buy-iphone/',
  );
  const [spreadsheetId, setSpreadsheetId] = useState(
    'https://docs.google.com/spreadsheets/d/edit?gid=0#gid=0',
  );
  const [pcSelection, setPcSelection] = useState('1'); // 1,2,3,4,all

  const [spreadsheetKey1, setSpreadsheetKey1] = useState(
    '1vK6FqW8HXGpYux03jBRBVfyijz3cc-Ue1NVC54p8brs',
  );
  const [spreadsheetKey2, setSpreadsheetKey2] = useState('');
  const [spreadsheetKey3, setSpreadsheetKey3] = useState('');
  const [spreadsheetKey4, setSpreadsheetKey4] = useState('');

  const [modelOption, setModelOption] = useState('0'); // 0,1,skip
  const [colorOption, setColorOption] = useState('0'); // 0〜3
  const [storageOption, setStorageOption] = useState('0'); // 0〜3
  const [quantityOption, setQuantityOption] = useState('1'); // 1 or 2

  const [deliveryOption, setDeliveryOption] = useState('delivery'); // delivery, convenienceStore, appleStore

  const [storeOption, setStoreOption] = useState('R005'); // R005, R224, ...
  const [zipCode, setZipCode] = useState('460-0008'); // R005, R224, ...


  const [payOption, setPayOption] = useState('creditcard'); // creditcard, bank
  const [confirmOption, setConfirmOption] = useState('true'); // true, false

  const [storeMonitoringInterval, setStoreMonitoringInterval] = useState('10');

  // ===== 3-step flow state =====
  const [flowStep, setFlowStep] = useState(1); // 1: personal, 2: iphone, 3: confirm
  const [personalDraft, setPersonalDraft] = useState(() =>
    Object.fromEntries(PERSONAL_FIELDS.map(f => [f.key, ''])),
  );
  const [personalInfo, setPersonalInfo] = useState(null); // stored once Step1 Next

  const [iphoneKind, setIphoneKind] = useState(COLOR_GROUPS?.[0]?.title ?? 'iPhone 16');
  const [iphoneKindKey, setIphoneKindKey] = useState(COLOR_GROUPS?.[0]?.key ?? 'iphone-16');
  const [iphoneColorKey, setIphoneColorKey] = useState('0');
  const [iphoneModelOption, setIphoneModelOption] = useState('0'); // 0: mini/pro, 1: plus/max (per family)
  const [iphoneIdDraft, setIphoneIdDraft] = useState('');
  const [iphoneRows, setIphoneRows] = useState([]); // [{id, iphoneKind, iphoneColorKey, iphone_id, quantityOption, deliveryOption, storeOption, zipCode, payOption, confirmOption, storeMonitoringInterval, createdAt}]
  const [editingIphoneRowId, setEditingIphoneRowId] = useState(null);
  const [expandedIphoneRowId, setExpandedIphoneRowId] = useState(null);
  const [isAppending, setIsAppending] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // ===== サーバーからのステータス =====
  const [status, setStatus] = useState(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const scheme = useColorScheme();
  const paperTheme = useMemo(() => {
    const base = scheme === 'dark' ? MD3DarkTheme : MD3LightTheme;
    return {
      ...base,
      roundness: 14,
      colors: {
        ...base.colors,
        primary: scheme === 'dark' ? '#4DA3FF' : '#1D78FF',
        secondary: scheme === 'dark' ? '#2DE3C6' : '#00A896',
        background: scheme === 'dark' ? '#0B1220' : '#F6F7FB',
        surface: scheme === 'dark' ? '#101A2B' : '#FFFFFF',
      },
    };
  }, [scheme]);

  const currentColorGroup = useMemo(() => {
    const found = COLOR_GROUPS.find(g => g.title === iphoneKind);
    return found ?? COLOR_GROUPS[0];
  }, [iphoneKind]);

  const getColorLabel = useCallback((kind, colorKey) => {
    const g = COLOR_GROUPS.find(x => x.title === kind);
    const c = g?.colors?.find(x => x.key === String(colorKey));
    return c?.label ?? `カラー${String(colorKey)}`;
  }, []);

  const autoFillAddressByPostalCode = useCallback(async () => {
    const rawZip = String(personalDraft.postalCode ?? '').replace(/-/g, '').trim();
    if (!rawZip || rawZip.length !== 7) {
      setErrorMessage('郵便番号は7桁で入力してください（例: 4600008）。');
      return;
    }

    try {
      setErrorMessage(null);
      const res = await axios.get(`${API_ORIGIN}/zipSearch`, {
        params: { zipcode: rawZip },
      });
      const item = res?.data?.results?.[0];
      if (!item) {
        setErrorMessage('該当する住所が見つかりませんでした。');
        return;
      }

      // zipcloud: address1=都道府県, address2=市区町村, address3=町名
      setPersonalDraft(prev => ({
        ...prev,
        state: item.address1 ?? prev.state,
        city: item.address2 ?? prev.city,
        street: item.address3 ?? prev.street,
        street2: '',
      }));
    } catch (err) {
      setErrorMessage(err?.message || '住所自動入力に失敗しました。');
    }
  }, [personalDraft.postalCode]);

  const getStorageLabel = useCallback((v) => {
    const n = Number(v);
    return Number.isFinite(n) ? `${n + 1}` : '-';
  }, []);

  const getQuantityLabel = useCallback((v) => {
    if (v === undefined || v === null || v === '') return '-';
    return String(v);
  }, []);

  const getDeliveryLabel = useCallback((v) => {
    if (v === 'delivery') return '郵送';
    if (v === 'convenienceStore') return 'コンビニ';
    if (v === 'appleStore') return 'Apple Store';
    return String(v ?? '-');
  }, []);

  const getStoreLabel = useCallback((v) => {
    const s = STORE_OPTIONS.find(x => x.v === v);
    return s?.l ?? String(v ?? '-');
  }, []);

  const getPayLabel = useCallback((v) => {
    if (v === 'creditcard') return 'クレカ';
    if (v === 'bank') return '銀行振込';
    return String(v ?? '-');
  }, []);

  const getConfirmLabel = useCallback((v) => {
    if (v === 'true') return '有効';
    if (v === 'false') return '無効';
    return String(v ?? '-');
  }, []);

  const getModelLabel = useCallback((kind, v) => {
    const m = String(v ?? '0');
    if (kind === 'iPhone 16') return m === '0' ? 'iPhone 16' : 'iPhone 16 Plus';
    if (kind === 'iPhone 17 Pro') return m === '0' ? 'iPhone 17 Pro' : 'iPhone 17 Pro Max';
    return m;
  }, []);


  useEffect(() => {
    // For "add new row": auto-fill iphone_id from selections.
    if (editingIphoneRowId) return;
    const derived = iphoneKindKey;
    if (derived) setIphoneIdDraft(derived);
  }, [iphoneKindKey, iphoneModelOption, editingIphoneRowId]);

  useEffect(() => {
    // Debug-only: helps confirm Expo runtime successfully loaded `app.json` -> `extra`.
    // We log only a suffix to avoid leaking the full secret.
    const apiKeySuffix = typeof API_KEY === 'string' ? API_KEY.slice(-4) : 'n/a';
    // eslint-disable-next-line no-console
    console.log('[mobile-config]', {
      ok: CONFIG_OK,
      apiOrigin: API_ORIGIN,
      apiKeySuffix,
    });
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      if (!CONFIG_OK) {
        setErrorMessage('設定エラー: API_KEY が見つかりません。');
        setStatus(null);
        return;
      }
      const res = await axios.get(`${API_ORIGIN}/status`, {
        headers: { 'x-api-key': API_KEY },
      });
      setStatus(res.data);
      setErrorMessage(null);
    } catch (err) {
      setErrorMessage(
        err?.message || 'ステータスの取得に失敗しました。サーバーを確認してください。',
      );
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const refreshMs = status?.running ? 2500 : 5000;
    const id = setInterval(fetchStatus, refreshMs); // 稼働中は頻繁、停止中はゆっくり
    return () => clearInterval(id);
  }, [fetchStatus, status?.running]);

  // ===== Persist / restore Step1+Step2 inputs =====
  useEffect(() => {
    if (!canUseLocalStorage()) return;

    const rawPersonal = lsGet(LS_KEYS.personalInfo);
    if (rawPersonal) {
      try {
        const parsed = JSON.parse(rawPersonal);
        setPersonalInfo(parsed);
        setPersonalDraft(parsed);
      } catch {
        // ignore parse errors
      }
    }

    const rawRows = lsGet(LS_KEYS.iphoneRows);
    if (rawRows) {
      try {
        const parsed = JSON.parse(rawRows);
        if (Array.isArray(parsed)) setIphoneRows(parsed);
      } catch {
        // ignore
      }
    }

    const rawFlow = lsGet(LS_KEYS.flowStep);
    if (rawFlow) {
      const n = Number(rawFlow);
      if (n === 1 || n === 2 || n === 3) setFlowStep(n);
    } else if (rawPersonal) {
      setFlowStep(2);
    }
  }, []);

  useEffect(() => {
    if (!canUseLocalStorage()) return;
    if (personalInfo) lsSet(LS_KEYS.personalInfo, JSON.stringify(personalInfo));
    else lsSet(LS_KEYS.personalInfo, '');
  }, [personalInfo]);

  useEffect(() => {
    if (!canUseLocalStorage()) return;
    lsSet(LS_KEYS.iphoneRows, JSON.stringify(iphoneRows));
  }, [iphoneRows]);

  useEffect(() => {
    if (!canUseLocalStorage()) return;
    lsSet(LS_KEYS.flowStep, String(flowStep));
  }, [flowStep]);

  // If user switches back to Step 1, show saved personal info
  useEffect(() => {
    if (flowStep === 1 && personalInfo) {
      setPersonalDraft(personalInfo);
    }
  }, [flowStep, personalInfo]);

  const handleStart = async () => {
    try {
      if (!CONFIG_OK) {
        setErrorMessage('設定エラー: API_KEY が見つかりません。');
        return;
      }
      setIsStarting(true);
      setErrorMessage(null);

      const parsedMonitoringInterval = Number.parseInt(storeMonitoringInterval, 10);
      const body = {
        itemUrl,
        zipCode,
        spreadsheetId,
        pcSelection,
        spreadsheetKey: spreadsheetKey1,
        spreadsheetKey2,
        spreadsheetKey3,
        spreadsheetKey4,
        modelOption,
        colorOption,
        storageOption,
        quantityOption,
        deliveryOption,
        storeOption,
        payOption,
        confirmOption,
        storeMonitoringInterval:
          Number.isFinite(parsedMonitoringInterval) && parsedMonitoringInterval > 0
            ? parsedMonitoringInterval
            : 40,
        workerId: 'mobile',
      };

      await axios.post(`${API_ORIGIN}/start`, body, {
        headers: { 'x-api-key': API_KEY },
      });
      await fetchStatus();
    } catch (err) {
      setErrorMessage(
        err?.message || '開始リクエストに失敗しました。サーバーを確認してください。',
      );
    } finally {
      setIsStarting(false);
    }
  };

  const upsertIphoneRow = useCallback(() => {
    const now = Date.now();
    const rowId = editingIphoneRowId ?? `iphone-${now}`;
    const existing = iphoneRows.find(r => r.id === rowId);

    // Derive the required Apple URL slug from the selections.
    // This avoids relying on iphoneIdDraft timing/state lag.
    const derivedIphoneId = iphoneKindKey;

    const next = {
      id: rowId,
      iphoneKind,
      iphoneKindKey,
      iphoneColorKey,
      iphone_id: derivedIphoneId || iphoneIdDraft,
      modelOption: String(iphoneModelOption),
      colorOption: String(iphoneColorKey),
      storageOption,
      quantityOption,
      deliveryOption,
      storeOption,
      zipCode,
      payOption,
      confirmOption,
      storeMonitoringInterval,
      rowNum: existing?.rowNum,
      createdAt: now,
    };

    setIphoneRows(prev => {
      const exists = prev.some(r => r.id === rowId);
      if (exists) return prev.map(r => (r.id === rowId ? next : r));
      return [next, ...prev];
    });
    setEditingIphoneRowId(null);
    setIphoneIdDraft('');
    setExpandedIphoneRowId(null);
    return next;
  }, [
    editingIphoneRowId,
    iphoneKind,
    iphoneKindKey,
    iphoneColorKey,
    iphoneModelOption,
    iphoneIdDraft,
    storageOption,
    quantityOption,
    deliveryOption,
    storeOption,
    zipCode,
    payOption,
    confirmOption,
    storeMonitoringInterval,
    iphoneRows,
  ]);

  const editIphoneRow = useCallback((row) => {
    setEditingIphoneRowId(row.id);
    setIphoneKind(row.iphoneKind);
    const kindKey =
      row.iphoneKindKey ??
      (COLOR_GROUPS.find(g => g.title === row.iphoneKind)?.key ?? '');
    if (kindKey) setIphoneKindKey(String(kindKey));
    setIphoneColorKey(row.iphoneColorKey);
    if (row.modelOption !== undefined) setIphoneModelOption(String(row.modelOption));
    setIphoneIdDraft(row.iphone_id ?? '');
    if (row.storageOption !== undefined) setStorageOption(String(row.storageOption));
    if (row.quantityOption !== undefined) setQuantityOption(String(row.quantityOption));
    if (row.deliveryOption !== undefined) setDeliveryOption(String(row.deliveryOption));
    if (row.storeOption !== undefined) setStoreOption(String(row.storeOption));
    if (row.zipCode !== undefined) setZipCode(String(row.zipCode));
    if (row.payOption !== undefined) setPayOption(String(row.payOption));
    if (row.confirmOption !== undefined) setConfirmOption(String(row.confirmOption));
    if (row.storeMonitoringInterval !== undefined) setStoreMonitoringInterval(String(row.storeMonitoringInterval));
    setFlowStep(2);
  }, []);

  const deleteIphoneRow = useCallback(async (row) => {
    const rowId = row?.id;
    if (!rowId) return;

    try {
      if (row.rowNum && spreadsheetKey1) {
        await axios.post(
          `${API_ORIGIN}/deleteRow`,
          { spreadsheetId: spreadsheetKey1, sheetName: 'list', rowNum: row.rowNum },
          { headers: { 'x-api-key': API_KEY } },
        );
      }
      setIphoneRows(prev => prev.filter(r => r.id !== rowId));
      if (editingIphoneRowId === rowId) {
        setEditingIphoneRowId(null);
        setIphoneIdDraft('');
        setExpandedIphoneRowId(null);
      }
    } catch (err) {
      const serverError =
        err?.response?.data?.error || err?.response?.data?.message || err?.message;
      setErrorMessage(serverError || '削除に失敗しました。');
    }
  }, [editingIphoneRowId, spreadsheetKey1]);

  const appendIphoneRowsToSpreadsheet = useCallback(async () => {
    if (!CONFIG_OK) {
      setErrorMessage('設定エラー: API_KEY が見つかりません。');
      return false;
    }
    if (!personalInfo) {
      setErrorMessage('Step 1 の個人情報が未保存です。');
      return false;
    }
    if (!spreadsheetKey1) {
      setErrorMessage('スプレッドシートキー(PC1)が未設定です。');
      return false;
    }
    if (!iphoneRows.length) {
      setErrorMessage('Step 2 のiPhone情報が未追加です。');
      return false;
    }

    const rowsToAppend = iphoneRows.filter(r => !r.rowNum);
    if (!rowsToAppend.length) {
      // Everything already appended, so just continue to Step 3
      return true;
    }

    setIsAppending(true);
    setErrorMessage(null);

    try {
      const rows = rowsToAppend.map(r => ({
        ...personalInfo,
        iphone_id: r.iphone_id,
        modelOption: r.modelOption ?? (r.iphoneKind === 'iPhone 16' ? '0' : '1'),
        colorOption: r.colorOption ?? String(r.iphoneColorKey ?? '0'),
        storageOption: r.storageOption ?? storageOption,
        quantityOption: r.quantityOption ?? quantityOption,
        deliveryOption: r.deliveryOption ?? deliveryOption,
        storeOption: r.storeOption ?? storeOption,
        zipCode: r.zipCode ?? zipCode,
        payOption: r.payOption ?? payOption,
        confirmOption: r.confirmOption ?? confirmOption,
        storeMonitoringInterval: r.storeMonitoringInterval ?? storeMonitoringInterval,
        // fields that exist in sheet but are handled by worker later
        lockDatetime: '',
        status: '',
        orderNumber: '',
      }));
      console.log('inputRows', rows)

      const resp = await axios.post(
        `${API_ORIGIN}/appendRows`,
        { spreadsheetId: spreadsheetKey1, sheetName: 'list', rows },
        { headers: { 'x-api-key': API_KEY } },
      );

      const appendedRowNums = resp?.data?.appendedRowNums;
      if (Array.isArray(appendedRowNums) && appendedRowNums.length) {
        let cursor = 0;
        setIphoneRows(prev =>
          prev.map(r => {
            if (r.rowNum) return r;
            const newRowNum = appendedRowNums[cursor];
            cursor += 1;
            return { ...r, rowNum: newRowNum ?? r.rowNum };
          }),
        );
      }
      return true;
    } catch (err) {
      const serverError =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message;
      setErrorMessage(serverError || 'スプレッドシート追加に失敗しました。');
      return false;
    } finally {
      setIsAppending(false);
    }
  }, [
    personalInfo,
    iphoneRows,
    spreadsheetKey1,
    iphoneKind,
    iphoneColorKey,
    storageOption,
    quantityOption,
    deliveryOption,
    storeOption,
    zipCode,
    payOption,
    confirmOption,
    storeMonitoringInterval,
  ]);

  const updateIphoneRowInSpreadsheet = useCallback(async (row) => {
    if (!CONFIG_OK) {
      setErrorMessage('設定エラー: API_KEY が見つかりません。');
      return false;
    }
    if (!personalInfo) {
      setErrorMessage('Step 1 の個人情報が未保存です。');
      return false;
    }
    if (!spreadsheetKey1) {
      setErrorMessage('スプレッドシートキー(PC1)が未設定です。');
      return false;
    }
    if (!row?.rowNum) {
      // Not yet appended to spreadsheet
      return false;
    }

    setIsUpdating(true);
    setErrorMessage(null);

    try {
      const sheetRow = {
        ...personalInfo,
        iphone_id: row.iphone_id,
        modelOption: row.modelOption ?? '0',
        colorOption: row.colorOption ?? String(row.iphoneColorKey ?? '0'),
        storageOption: row.storageOption,
        quantityOption: row.quantityOption,
        deliveryOption: row.deliveryOption,
        storeOption: row.storeOption,
        zipCode: row.zipCode,
        payOption: row.payOption,
        confirmOption: row.confirmOption,
        storeMonitoringInterval: row.storeMonitoringInterval,
        lockDatetime: '',
        status: '',
        orderNumber: '',
      };

      const resp = await axios.post(
        `${API_ORIGIN}/updateRow`,
        {
          spreadsheetId: spreadsheetKey1,
          sheetName: 'list',
          rowNum: row.rowNum,
          row: sheetRow,
        },
        { headers: { 'x-api-key': API_KEY } },
      );

      if (resp?.data?.rowNum) {
        setIphoneRows(prev =>
          prev.map(r => (r.id === row.id ? { ...r, rowNum: resp.data.rowNum } : r)),
        );
      }
      return true;
    } catch (err) {
      const serverError =
        err?.response?.data?.error || err?.response?.data?.message || err?.message;
      setErrorMessage(serverError || 'スプレッドシート更新に失敗しました。');
      return false;
    } finally {
      setIsUpdating(false);
    }
  }, [
    personalInfo,
    spreadsheetKey1,
    setErrorMessage,
    setIphoneRows,
  ]);

  const handleStop = async () => {
    try {
      if (!CONFIG_OK) {
        setErrorMessage('設定エラー: API_KEY が見つかりません。');
        return;
      }
      setIsStopping(true);
      setErrorMessage(null);
      await axios.post(
        `${API_ORIGIN}/stop`,
        {},
        { headers: { 'x-api-key': API_KEY } },
      );
      await fetchStatus();
    } catch (err) {
      setErrorMessage(
        err?.message || '停止リクエストに失敗しました。サーバーを確認してください。',
      );
    } finally {
      setIsStopping(false);
    }
  };

  return (
    <PaperProvider theme={paperTheme}>
      <SafeAreaView style={[styles.container, { backgroundColor: paperTheme.colors.background }]}>
        <Appbar.Header>
          <Appbar.Content
            title="iPhone 自動購入モニター 3.0"
            subtitle={status?.running ? '稼働中' : '停止中'}
          />
        </Appbar.Header>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* サーバーステータス */}
          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.sectionHeaderRow}>
                <View
                  style={[
                    styles.statusDot,
                    status?.running ? styles.statusDotRunning : styles.statusDotStopped,
                  ]}
                />
                <PaperText style={styles.sectionTitle}>サーバーステータス</PaperText>
              </View>

              <View style={styles.statGrid}>
                <View style={styles.statCell}>
                  <PaperText style={styles.statLabel}>状態</PaperText>
                  <PaperText style={styles.statValue}>
                    {status?.running ? '稼働中' : '停止中'}
                  </PaperText>
                </View>
                <View style={styles.statCell}>
                  <PaperText style={styles.statLabel}>キュー</PaperText>
                  <PaperText style={styles.statValue}>
                    {status?.queueCountTotal ?? status?.queueCount ?? 0}
                  </PaperText>
                </View>
                <View style={styles.statCell}>
                  <PaperText style={styles.statLabel}>実行中</PaperText>
                  <PaperText style={styles.statValue}>
                    {status?.activeSessionCount ?? 0}
                  </PaperText>
                </View>
              </View>

              {errorMessage ? (
                <PaperText style={styles.errorText}>エラー: {errorMessage}</PaperText>
              ) : null}
            </Card.Content>
          </Card>

          {/* 開始／停止ボタン */}
          <View style={styles.row}>
            <Button
              mode="contained"
              style={styles.startButton}
              buttonColor={paperTheme.colors.primary}
              textColor={paperTheme.colors.onPrimary ?? '#FFFFFF'}
              onPress={handleStart}
              disabled={isStarting || isStopping}
              loading={isStarting}
            >
              {isStarting ? '開始中...' : '自動購入開始'}
            </Button>
            <Button
              mode="contained-tonal"
              style={styles.stopButton}
              onPress={handleStop}
              disabled={isStarting || isStopping}
              loading={isStopping}
            >
              {isStopping ? '停止中...' : '処理停止'}
            </Button>
          </View>

          {/* 設定フォーム */}
          <Card style={styles.card}>
            <Card.Content>
              <PaperText style={styles.sectionTitle}>設定</PaperText>
              <Divider style={styles.divider} />



              <PaperText style={styles.label}>Google スプレッドシートURL（共通）</PaperText>
              <TextInput
                mode="outlined"
                value={spreadsheetId}
                onChangeText={setSpreadsheetId}
                autoCapitalize="none"
                autoCorrect={false}
              />

              <Divider style={styles.divider} />


              <PaperText style={styles.label}>表計算キー </PaperText>
              <TextInput
                mode="outlined"
                value={spreadsheetKey1}
                onChangeText={setSpreadsheetKey1}
                autoCapitalize="none"
                autoCorrect={false}
              />



              <Divider style={styles.divider} />

            </Card.Content>
          </Card>

          {/* ===== 3-step flow ===== */}
          <Card style={styles.card}>
            <Card.Content>
              <PaperText style={styles.sectionTitle}>入力フロー</PaperText>
              <Divider style={styles.divider} />

              <View style={styles.rowWrap}>
                <RadioChip label="ステップ1" selected={flowStep === 1} onPress={() => setFlowStep(1)} />
                <RadioChip label="ステップ2" selected={flowStep === 2} onPress={() => setFlowStep(2)} />
                <RadioChip label="ステップ3" selected={flowStep === 3} onPress={() => setFlowStep(3)} />
              </View>

              {flowStep === 1 ? (
                <>
                  <PaperText style={styles.label}>ステップ1: 個人情報入力</PaperText>
                  {PERSONAL_FIELDS.map(f => {
                    if (f.key === 'postalCode') {
                      return (
                        <View key={f.key} style={{ marginBottom: 10 }}>
                          <PaperText style={{ fontSize: 12, opacity: 0.7 }}>{f.label}</PaperText>
                          <TextInput
                            mode="outlined"
                            value={personalDraft[f.key] ?? ''}
                            onChangeText={(t) =>
                              setPersonalDraft(prev => ({ ...prev, [f.key]: t }))
                            }
                            autoCapitalize="none"
                            autoCorrect={false}
                            keyboardType="number-pad"
                          />
                          <Button
                            mode="text"
                            onPress={autoFillAddressByPostalCode}
                            style={{ alignSelf: 'flex-start', marginTop: 6 }}
                          >
                            郵便番号から住所を自動入力
                          </Button>
                        </View>
                      );
                    }

                    return (
                      <View key={f.key} style={{ marginBottom: 10 }}>
                        <PaperText style={{ fontSize: 12, opacity: 0.7 }}>{f.label}</PaperText>
                        <TextInput
                          mode="outlined"
                          value={personalDraft[f.key] ?? ''}
                          onChangeText={(t) =>
                            setPersonalDraft(prev => ({ ...prev, [f.key]: t }))
                          }
                          autoCapitalize="none"
                          autoCorrect={false}
                        />
                      </View>
                    );
                  })}

                  <Button
                    mode="contained"
                    onPress={() => {
                      setPersonalInfo({ ...personalDraft });
                      setFlowStep(2);
                    }}
                  >
                    次へ
                  </Button>
                </>
              ) : null}

              {flowStep === 2 ? (
                <>
                  <PaperText style={styles.label}>ステップ2: iPhone情報</PaperText>

                  <PaperText style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>
                    機種
                  </PaperText>
                  <View style={styles.rowWrap}>
                    {COLOR_GROUPS.map(g => (
                      <RadioChip
                        key={g.title}
                        label={g.title}
                        selected={iphoneKind === g.title}
                        onPress={() => {
                          setIphoneKind(g.title);
                          setIphoneKindKey(g.key);
                          setIphoneColorKey(g.colors?.[0]?.key ?? '0');
                        }}
                      />
                    ))}
                  </View>

                  <PaperText style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>
                    モデル
                  </PaperText>
                  <View style={styles.rowWrap}>
                    {iphoneKind === 'iPhone 16' ? (
                      <>
                        <RadioChip
                          label="iPhone 16"
                          selected={iphoneModelOption === '0'}
                          onPress={() => setIphoneModelOption('0')}
                        />
                        <RadioChip
                          label="iPhone 16 Plus"
                          selected={iphoneModelOption === '1'}
                          onPress={() => setIphoneModelOption('1')}
                        />
                      </>
                    ) : (
                      <>
                        <RadioChip
                          label="iPhone 17 Pro"
                          selected={iphoneModelOption === '0'}
                          onPress={() => setIphoneModelOption('0')}
                        />
                        <RadioChip
                          label="iPhone 17 Pro Max"
                          selected={iphoneModelOption === '1'}
                          onPress={() => setIphoneModelOption('1')}
                        />
                      </>
                    )}
                  </View>

                  <PaperText style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>
                    カラー（機種ごと）
                  </PaperText>
                  <View style={styles.rowWrap}>
                    {currentColorGroup?.colors?.map(c => (
                      <RadioChip
                        key={`${currentColorGroup.title}-${c.key}`}
                        selected={iphoneColorKey === c.key}
                        onPress={() => setIphoneColorKey(c.key)}
                        BgColor={c.value}
                      />
                    ))}
                  </View>


                  <PaperText style={styles.label}>ストレージ</PaperText>
                  <View style={styles.rowWrap}>
                    {['0', '1', '2', '3'].map(v => (
                      <RadioChip
                        key={v}
                        label={`${Number(v) + 1}`}
                        selected={storageOption === v}
                        onPress={() => setStorageOption(v)}
                      />
                    ))}
                  </View>

                  <PaperText style={styles.label}>注文個数</PaperText>
                  <View style={styles.rowWrap}>
                    <RadioChip label="1" selected={quantityOption === '1'} onPress={() => setQuantityOption('1')} />
                    <RadioChip label="2" selected={quantityOption === '2'} onPress={() => setQuantityOption('2')} />
                  </View>

                  <Divider style={styles.divider} />

                  <PaperText style={styles.label}>受け取り方法</PaperText>
                  <View style={styles.rowWrap}>
                    <RadioChip
                      label="郵送"
                      selected={deliveryOption === 'delivery'}
                      onPress={() => setDeliveryOption('delivery')}
                    />
                    <RadioChip
                      label="コンビニ"
                      selected={deliveryOption === 'convenienceStore'}
                      onPress={() => setDeliveryOption('convenienceStore')}
                    />
                    <RadioChip
                      label="Apple Store"
                      selected={deliveryOption === 'appleStore'}
                      onPress={() => setDeliveryOption('appleStore')}
                    />
                  </View>

                  <PaperText style={styles.label}>対象ストア</PaperText>
                  <View style={styles.rowWrap}>
                    {STORE_OPTIONS.map(s => (
                      <RadioChip
                        key={s.v}
                        label={s.l}
                        selected={storeOption === s.v}
                        onPress={() => {
                          setStoreOption(s.v);
                          setZipCode(s.zip);
                        }}
                      />
                    ))}
                  </View>

                  <PaperText style={styles.label}>注文確定有効</PaperText>
                  <View style={styles.rowWrap}>
                    <RadioChip
                      label="有効"
                      selected={confirmOption === 'true'}
                      onPress={() => setConfirmOption('true')}
                    />
                    <RadioChip
                      label="無効"
                      selected={confirmOption === 'false'}
                      onPress={() => setConfirmOption('false')}
                    />
                  </View>

                  <PaperText style={styles.label}>店舗監視間隔(秒)</PaperText>
                  <TextInput
                    mode="outlined"
                    value={storeMonitoringInterval}
                    onChangeText={setStoreMonitoringInterval}
                    keyboardType="number-pad"
                  />

                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                    <Button
                      mode="contained-tonal"
                      onPress={async () => {
                        const savedRow = upsertIphoneRow();
                        if (savedRow?.rowNum) {
                          await updateIphoneRowInSpreadsheet(savedRow);
                        }
                      }}
                      disabled={isAppending || isUpdating}
                    >
                      {editingIphoneRowId ? '更新' : '追加'}
                    </Button>
                    <Button
                      mode="contained"
                      loading={isAppending}
                      disabled={isAppending || isUpdating || Boolean(editingIphoneRowId)}
                      onPress={async () => {
                        const ok = await appendIphoneRowsToSpreadsheet();
                        if (ok) setFlowStep(3);
                      }}
                    >
                      次へ（スプレッドシートに追加）
                    </Button>
                  </View>

                  <Divider style={styles.divider} />
                  <PaperText style={styles.label}>iPhoneリスト（追加 / 編集 / 削除）</PaperText>

                  {iphoneRows.length ? (
                    iphoneRows.map(r => (
                      <Card key={r.id} style={styles.sessionCard}>
                        <Card.Content>
                          <PaperText style={styles.sessionTitle}>
                            {getModelLabel(r.iphoneKind, r.modelOption)} / {getColorLabel(r.iphoneKind, r.iphoneColorKey)} /{' '}
                            {r.iphone_id || '（iphone_id 未入力）'}
                          </PaperText>

                          <PaperText style={{ fontSize: 12, opacity: 0.7 }}>
                            ストレージ: {getStorageLabel(r.storageOption ?? storageOption)} / 注文個数:{' '}
                            {getQuantityLabel(r.quantityOption ?? quantityOption)}
                          </PaperText>
                          <PaperText style={{ fontSize: 12, opacity: 0.7 }}>
                            受け取り方法: {getDeliveryLabel(r.deliveryOption ?? deliveryOption)} / 対象ストア:{' '}
                            {getStoreLabel(r.storeOption ?? storeOption)}
                          </PaperText>
                          <PaperText style={{ fontSize: 12, opacity: 0.7 }}>
                            支払い方法: {getPayLabel(r.payOption ?? payOption)} / 注文確定:{' '}
                            {getConfirmLabel(r.confirmOption ?? confirmOption)}
                          </PaperText>

                          <View style={styles.rowWrap}>
                            <Button mode="text" onPress={() => editIphoneRow(r)}>
                              編集
                            </Button>
                            <Button
                              mode="text"
                              onPress={() =>
                                setExpandedIphoneRowId(prev => (prev === r.id ? null : r.id))
                              }
                            >
                              {expandedIphoneRowId === r.id ? '詳細を閉じる' : '詳細'}
                            </Button>
                            <Button mode="text" onPress={() => deleteIphoneRow(r)}>削除</Button>
                          </View>

                          {expandedIphoneRowId === r.id ? (
                            <>
                              <Divider style={styles.divider} />
                              <PaperText style={{ fontSize: 12, opacity: 0.75 }}>
                                iPhoneページID: {r.iphone_id || '（未入力）'}
                              </PaperText>
                              <PaperText style={{ fontSize: 12, opacity: 0.75 }}>
                                機種: {getModelLabel(r.iphoneKind, r.modelOption)} / カラー:{' '}
                                {getColorLabel(r.iphoneKind, r.iphoneColorKey)}
                              </PaperText>
                              <PaperText style={{ fontSize: 12, opacity: 0.75 }}>
                                ストレージ: {getStorageLabel(r.storageOption ?? storageOption)} / 注文個数:{' '}
                                {getQuantityLabel(r.quantityOption ?? quantityOption)}
                              </PaperText>
                              <PaperText style={{ fontSize: 12, opacity: 0.75 }}>
                                受け取り方法: {getDeliveryLabel(r.deliveryOption ?? deliveryOption)} / 対象ストア:{' '}
                                {getStoreLabel(r.storeOption ?? storeOption)}
                              </PaperText>
                              <PaperText style={{ fontSize: 12, opacity: 0.75 }}>
                                支払い方法: {getPayLabel(r.payOption ?? payOption)} / 注文確定:{' '}
                                {getConfirmLabel(r.confirmOption ?? confirmOption)}
                              </PaperText>
                              <PaperText style={{ fontSize: 12, opacity: 0.75 }}>
                                郵便番号: {r.zipCode ?? zipCode}
                              </PaperText>
                              <PaperText style={{ fontSize: 12, opacity: 0.75 }}>
                                店舗監視間隔(秒): {String(r.storeMonitoringInterval ?? storeMonitoringInterval)}
                              </PaperText>
                            </>
                          ) : null}
                        </Card.Content>
                      </Card>
                    ))
                  ) : (
                    <PaperText style={styles.emptyText}>iPhone情報がまだありません。</PaperText>
                  )}
                </>
              ) : null}

              {flowStep === 3 ? (
                <>
                  <PaperText style={styles.label}>ステップ3: 確認</PaperText>
                  <PaperText style={{ fontSize: 12, opacity: 0.75 }}>
                    個人情報: {personalInfo ? '保存済み' : '未保存'} / iPhone件数: {iphoneRows.length}
                  </PaperText>

                  {personalInfo ? (
                    <>
                      <Divider style={styles.divider} />
                      <PaperText style={{ fontSize: 13, fontWeight: '700', opacity: 0.85 }}>
                        個人情報（詳細）
                      </PaperText>
                      {PERSONAL_FIELDS.map(f => (
                        <PaperText
                          key={f.key}
                          style={{ fontSize: 12, opacity: 0.78, marginTop: 6 }}
                        >
                          {f.label}: {personalInfo[f.key] || '（未入力）'}
                        </PaperText>
                      ))}

                      <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                        <Button mode="text" onPress={() => setFlowStep(1)}>
                          個人情報を編集
                        </Button>
                        <Button mode="text" onPress={() => setFlowStep(2)}>
                          iPhone情報を編集
                        </Button>
                      </View>
                    </>
                  ) : (
                    <Divider style={styles.divider} />
                  )}

                  <Divider style={styles.divider} />
                  <PaperText style={{ fontSize: 13, fontWeight: '700', opacity: 0.85 }}>
                    iPhone情報（詳細）
                  </PaperText>
                  {iphoneRows.length ? (
                    iphoneRows.map(r => (
                      <PaperText
                        key={r.id}
                        style={{ fontSize: 12, opacity: 0.78, marginTop: 6 }}
                      >
                        {r.iphoneKind} / {getColorLabel(r.iphoneKind, r.iphoneColorKey)} / {r.iphone_id || '（未入力）'} / ストレージ: {getStorageLabel(r.storageOption ?? storageOption)} / 個数: {getQuantityLabel(r.quantityOption ?? quantityOption)} / 受取: {getDeliveryLabel(r.deliveryOption ?? deliveryOption)} / 店舗: {getStoreLabel(r.storeOption ?? storeOption)} / 支払い: {getPayLabel(r.payOption ?? payOption)} / 注文確定: {getConfirmLabel(r.confirmOption ?? confirmOption)}
                      </PaperText>
                    ))
                  ) : (
                    <PaperText style={{ fontSize: 12, opacity: 0.78, marginTop: 6 }}>
                      iPhone情報が未入力です。
                    </PaperText>
                  )}

                  <Button
                    mode="contained"
                    onPress={handleStart}
                    disabled={isStarting || isStopping}
                    loading={isStarting}
                  >
                    スクレイピング開始
                  </Button>
                </>
              ) : null}
            </Card.Content>
          </Card>

          {/* セッション一覧 */}
          <Card style={styles.card}>
            <Card.Content>
              <PaperText style={styles.sectionTitle}>セッション一覧</PaperText>
              <Divider style={styles.divider} />

              {status?.sessions?.length ? (
                status.sessions.map(s => (
                  <Card key={s.id} style={styles.sessionCard}>
                    <Card.Content>
                      <PaperText style={styles.sessionTitle}>
                        セッション #{s.id}（行 {s.rowNum ?? '-'}）
                      </PaperText>

                      <View style={styles.sessionMetaRow}>
                        <PaperText style={styles.sessionMetaLabel}>状態</PaperText>
                        <PaperText style={styles.sessionMetaValue}>
                          {s.statusLabelJa ?? '-'}
                        </PaperText>
                      </View>

                      <View style={styles.sessionProgressRow}>
                        <PaperText style={styles.sessionProgressLabel}>
                          進捗 {s.progress ?? 0}%
                        </PaperText>
                      </View>
                      <View style={styles.progressTrack}>
                        <View
                          style={[
                            styles.progressFill,
                            {
                              width: `${Math.max(0, Math.min(Number(s.progress ?? 0), 100))}%`,
                            },
                          ]}
                        />
                      </View>

                      <View style={styles.sessionMetaRow}>
                        <PaperText style={styles.sessionMetaLabel}>ステップ</PaperText>
                        <PaperText style={styles.sessionMetaValue}>
                          {s.stepLabelJa ?? '-'}
                        </PaperText>
                      </View>

                      {s.messageJa ? (
                        <PaperText style={styles.sessionMessage}>
                          メッセージ: {s.messageJa}
                        </PaperText>
                      ) : null}

                      {s.updatedAt ? (
                        <PaperText style={styles.sessionUpdated}>更新: {s.updatedAt}</PaperText>
                      ) : null}
                    </Card.Content>
                  </Card>
                ))
              ) : (
                <PaperText style={styles.emptyText}>セッションはありません。</PaperText>
              )}
            </Card.Content>
          </Card>
        </ScrollView>
      </SafeAreaView>
    </PaperProvider>
  );
}

const RadioChip = ({ label, selected, onPress, BgColor = 'white' }) => {
  const hasLabel = label !== undefined && label !== null && String(label).trim() !== '';

  const style = StyleSheet.create({
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 12,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: '#A9B3C7',
      backgroundColor: 'transparent',
      marginBottom: 8,
      marginRight: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chipSwatch: {
      width: 36,
      height: 36,
      paddingHorizontal: 0,
      paddingVertical: 0,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: '#A9B3C7',
      marginBottom: 8,
      marginRight: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chipSelected: {
      borderColor: '#1D78FF',
    },
    chipText: {
      fontSize: 12,
      color: BgColor == "white" ? '#334155' : 'white',
      fontWeight: '700',
    },
    chipTextSelected: { color: '#334155' },
  });

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[
        hasLabel ? style.chip : style.chipSwatch,
        !hasLabel ? { backgroundColor: BgColor } : null,
        selected && style.chipSelected,
      ]}
      onPress={onPress}
    >
      {hasLabel ? (
        <PaperText style={[style.chipText, selected && style.chipTextSelected]}>
          {label}
        </PaperText>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  card: { marginBottom: 14, borderRadius: 14 },
  divider: { marginVertical: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  statusDot: { width: 10, height: 10, borderRadius: 999, marginRight: 10 },
  statusDotRunning: { backgroundColor: '#2DE3C6' },
  statusDotStopped: { backgroundColor: '#FF5C7A' },
  statGrid: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  statCell: { flex: 1, paddingRight: 10 },
  statLabel: { fontSize: 12, opacity: 0.7, marginBottom: 4 },
  statValue: { fontSize: 16, fontWeight: '800' },
  statSubValue: { fontSize: 12, opacity: 0.65, fontWeight: '700', marginTop: 2 },
  errorText: { marginTop: 10, color: '#FF5C7A', fontWeight: '600' },
  row: { flexDirection: 'row', marginBottom: 14 },
  startButton: { flex: 1, borderRadius: 12, marginRight: 7 },
  stopButton: { flex: 1, borderRadius: 12, marginLeft: 7 },

  label: { marginTop: 14, marginBottom: 6, fontWeight: '700' },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap' },

  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#A9B3C7',
    backgroundColor: 'transparent',
    marginBottom: 8,
    marginRight: 8,
  },
  chipSelected: {
    borderColor: '#1D78FF',
  },
  chipText: { fontSize: 12, color: '#334155', fontWeight: '700' },
  chipTextSelected: { color: '#FFFFFF' },

  sessionCard: {
    marginTop: 10,
    borderRadius: 12,
  },
  sessionTitle: { fontSize: 14, fontWeight: '800', marginBottom: 8 },
  sessionMetaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  sessionMetaLabel: { fontSize: 12, opacity: 0.7 },
  sessionMetaValue: { fontSize: 12, fontWeight: '700' },
  sessionProgressRow: { marginTop: 10, marginBottom: 6 },
  sessionProgressLabel: { fontSize: 12, fontWeight: '700' },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(29, 120, 255, 0.15)',
    overflow: 'hidden',
  },
  progressFill: {
    height: 10,
    borderRadius: 999,
    backgroundColor: '#1D78FF',
  },
  sessionMessage: { marginTop: 10, fontSize: 12, fontWeight: '700' },
  sessionUpdated: { marginTop: 8, fontSize: 11, opacity: 0.65 },
  emptyText: { opacity: 0.75, fontWeight: '600' },
});

