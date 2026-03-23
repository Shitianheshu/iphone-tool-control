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

// ===== サーバー設定 =====
// NOTE: Store sensitive values in `app.json` -> `expo.extra` (or provide via build-time env).
const EXPO_EXTRA =
  Constants.expoConfig?.extra ??
  // Fallback for some Expo runtimes/dev modes
  Constants.manifest?.extra ??
  {};
// Vercel(Web)では `EXPO_PUBLIC_*`、Expo Native では `expo.extra` を優先利用する。
const SERVER_BASE_URL =
  process.env.EXPO_PUBLIC_SERVER_BASE_URL ?? EXPO_EXTRA.SERVER_BASE_URL;
const API_KEY = process.env.EXPO_PUBLIC_API_KEY ?? EXPO_EXTRA.API_KEY;

const CONFIG_OK = Boolean(SERVER_BASE_URL && API_KEY);

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

  const [payOption, setPayOption] = useState('creditcard'); // creditcard, bank
  const [confirmOption, setConfirmOption] = useState('true'); // true, false

  const [storeMonitoringInterval, setStoreMonitoringInterval] = useState('10');

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

  useEffect(() => {
    // Debug-only: helps confirm Expo runtime successfully loaded `app.json` -> `extra`.
    // We log only a suffix to avoid leaking the full secret.
    const apiKeySuffix = typeof API_KEY === 'string' ? API_KEY.slice(-4) : 'n/a';
    // eslint-disable-next-line no-console
    console.log('[mobile-config]', { ok: CONFIG_OK, serverBaseUrl: SERVER_BASE_URL, apiKeySuffix });
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      if (!CONFIG_OK) {
        setErrorMessage('設定エラー: SERVER_BASE_URL または API_KEY が見つかりません。');
        setStatus(null);
        return;
      }
      const res = await axios.get(`${SERVER_BASE_URL}/status`, {
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

  const handleStart = async () => {
    try {
      if (!CONFIG_OK) {
        setErrorMessage('設定エラー: SERVER_BASE_URL または API_KEY が見つかりません。');
        return;
      }
      setIsStarting(true);
      setErrorMessage(null);

      const parsedMonitoringInterval = Number.parseInt(storeMonitoringInterval, 10);
      const body = {
        itemUrl,
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

      await axios.post(`${SERVER_BASE_URL}/start`, body, {
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

  const handleStop = async () => {
    try {
      if (!CONFIG_OK) {
        setErrorMessage('設定エラー: SERVER_BASE_URL または API_KEY が見つかりません。');
        return;
      }
      setIsStopping(true);
      setErrorMessage(null);
      await axios.post(
        `${SERVER_BASE_URL}/stop`,
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
            title="iPhone 自動購入モニター"
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
                  <PaperText style={styles.statSubValue}>
                    残り: {status?.queueCountPending ?? 0}
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

              <PaperText style={styles.label}>PC 選択</PaperText>
              <View style={styles.rowWrap}>
                {['1', '2', '3', '4', 'all'].map(v => (
                  <RadioChip
                    key={v}
                    label={v === 'all' ? '全PC' : `PC ${v}`}
                    selected={pcSelection === v}
                    onPress={() => setPcSelection(v)}
                  />
                ))}
              </View>

              <PaperText style={styles.label}>表計算キー (PC 1)</PaperText>
              <TextInput
                mode="outlined"
                value={spreadsheetKey1}
                onChangeText={setSpreadsheetKey1}
                autoCapitalize="none"
                autoCorrect={false}
              />

              {(pcSelection === 'all' || pcSelection === '2') && (
                <>
                  <PaperText style={styles.label}>表計算キー (PC 2)</PaperText>
                  <TextInput
                    mode="outlined"
                    value={spreadsheetKey2}
                    onChangeText={setSpreadsheetKey2}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </>
              )}

              {(pcSelection === 'all' || pcSelection === '3') && (
                <>
                  <PaperText style={styles.label}>表計算キー (PC 3)</PaperText>
                  <TextInput
                    mode="outlined"
                    value={spreadsheetKey3}
                    onChangeText={setSpreadsheetKey3}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </>
              )}

              {(pcSelection === 'all' || pcSelection === '4') && (
                <>
                  <PaperText style={styles.label}>表計算キー (PC 4)</PaperText>
                  <TextInput
                    mode="outlined"
                    value={spreadsheetKey4}
                    onChangeText={setSpreadsheetKey4}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </>
              )}

              <Divider style={styles.divider} />

              <PaperText style={styles.label}>モデル</PaperText>
              <View style={styles.rowWrap}>
                <RadioChip label="1" selected={modelOption === '0'} onPress={() => setModelOption('0')} />
                <RadioChip label="2" selected={modelOption === '1'} onPress={() => setModelOption('1')} />
                <RadioChip label="スキップ" selected={modelOption === 'skip'} onPress={() => setModelOption('skip')} />
              </View>

              <PaperText style={styles.label}>カラー</PaperText>
              <View style={styles.rowWrap}>
                {['0', '1', '2', '3'].map(v => (
                  <RadioChip
                    key={v}
                    label={`${Number(v) + 1}`}
                    selected={colorOption === v}
                    onPress={() => setColorOption(v)}
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
                {[
                  { v: 'R005', l: '名古屋栄' },
                  { v: 'R224', l: '表参道' },
                  { v: 'R119', l: '渋谷' },
                  { v: 'R718', l: '丸の内' },
                  { v: 'R128', l: '新宿' },
                  { v: 'R710', l: '川崎' },
                  { v: 'R091', l: '心斎橋' },
                  { v: 'R711', l: '京都' },
                  { v: 'R079', l: '銀座' },
                ].map(s => (
                  <RadioChip
                    key={s.v}
                    label={s.l}
                    selected={storeOption === s.v}
                    onPress={() => setStoreOption(s.v)}
                  />
                ))}
              </View>

              <PaperText style={styles.label}>支払い方法</PaperText>
              <View style={styles.rowWrap}>
                <RadioChip
                  label="クレカ"
                  selected={payOption === 'creditcard'}
                  onPress={() => setPayOption('creditcard')}
                />
                <RadioChip
                  label="銀行振込"
                  selected={payOption === 'bank'}
                  onPress={() => setPayOption('bank')}
                />
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

const RadioChip = ({ label, selected, onPress }) => (
  <TouchableOpacity
    accessibilityRole="button"
    accessibilityState={{ selected }}
    style={[styles.chip, selected && styles.chipSelected]}
    onPress={onPress}
  >
    <PaperText style={[styles.chipText, selected && styles.chipTextSelected]}>
      {label}
    </PaperText>
  </TouchableOpacity>
);

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
    backgroundColor: '#1D78FF',
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

