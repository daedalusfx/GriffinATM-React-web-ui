// =================================================================
// FILE: src/renderer/App.tsx
// توضیحات: نسخه نهایی با چرخه بازخورد واقعی و دکمه هوشمند ریسک-فری
// =================================================================
import React, { useState, useEffect, useMemo } from 'react';
import {
  createTheme,
  ThemeProvider,
  CssBaseline,
  Box,
  AppBar,
  Toolbar,
  Typography,
  Button,
  Chip,
  IconButton,
  Tooltip,
  Container,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Switch,
  FormControlLabel,
  CircularProgress,
  alpha,
  keyframes,
} from '@mui/material';
import {
  Brightness4,
  Brightness7,
  Settings as SettingsIcon,
  Wifi,
  InfoOutlined,
} from '@mui/icons-material';
import toast, { Toaster } from 'react-hot-toast';

// --- ENUMS & INTERFACES ---
enum ConnectionStatus {
  Connected = 'connected',
  Disconnected = 'disconnected',
  Connecting = 'connecting',
}

interface Trade {
  ticket: number;
  symbol: string;
  type: string;
  volume: number;
  profit: number;
  atm_enabled: boolean;
  is_breakeven: boolean;
}

interface Settings {
  triggerPercent?: number;
  moveToBE?: boolean;
  closePercent?: number;
}

interface CommandPayload {
  action: string;
  [key: string]: any;
}

// --- STYLES & ANIMATIONS ---
const blinkAnimation = keyframes`
  50% { opacity: 0.3; }
`;

// let ws = null;

// --- MAIN COMPONENT ---
export function Dashboard() {
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>('dark');
  const [trades, setTrades] = useState<Trade[]>([]);
  const [totalPL, setTotalPL] = useState<number>(0);
  const [symbol, setSymbol] = useState<string>('N/A');
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(ConnectionStatus.Connecting);
  const [settings, setSettings] = useState<Settings>({});
  const [isSettingsOpen, setSettingsOpen] = useState<boolean>(false);
  const [loadingStates, setLoadingStates] = useState<{ [key: string]: boolean }>({});
  const [confirmState, setConfirmState] = useState<{ isOpen: boolean; title: string; description: string; onConfirm: (() => void) | null; }>({ isOpen: false, title: '', description: '', onConfirm: null });
  const [ws, setWs] = useState<WebSocket | null>(null);

  const theme = useMemo(() => createTheme({
    direction: 'rtl',
    palette: {
      mode: themeMode,
      primary: { main: '#818cf8' },
      success: { main: '#4ade80' },
      error: { main: '#f87171' },
      info: { main: '#60a5fa' },
      warning: { main: '#facc15' },
      background: {
        paper: themeMode === 'dark' ? '#1e293b' : '#ffffff',
        default: themeMode === 'dark' ? '#0f172a' : '#f1f5f9',
      },
      text: {
        primary: themeMode === 'dark' ? '#e2e8f0' : '#1e293b',
        secondary: themeMode === 'dark' ? '#94a3b8' : '#64748b',
      }
    },
    typography: { fontFamily: 'Vazirmatn, Arial' },
    components: { MuiButton: { styleOverrides: { root: { borderRadius: '8px', textTransform: 'none', fontWeight: 'bold' } } } }
  }), [themeMode]);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let messageBuffer = ''; // <--- بافر برای نگهداری پیام‌های ناقص

    function connect() {
        if (ws && ws.readyState !== WebSocket.CLOSED) return;

        console.log("Attempting to connect to WebSocket...");
        const socket = new WebSocket('ws://localhost:5000');
        setWs(socket);

        socket.onopen = () => {
            console.log('WebSocket connection established.');
            setConnectionStatus(ConnectionStatus.Connected);
            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
        };

        socket.onclose = () => {
            console.log(`WebSocket connection closed. Reconnecting...`);
            setConnectionStatus(ConnectionStatus.Disconnected);
            setWs(null);
            if (!timeoutId) {
                timeoutId = setTimeout(connect, 3000);
            }
        };

        socket.onerror = (error) => {
            console.error('WebSocket error:', error);
            socket.close();
        };

        socket.onmessage = (event) => {
          console.log('log row data :',event.data);
          
            // 1. داده جدید را به بافر اضافه کن
            messageBuffer += event.data;

            // 2. تا زمانی که جداکننده در بافر وجود دارد، پیام‌ها را پردازش کن
            while (messageBuffer.includes('\n')) {
                const messageEndIndex = messageBuffer.indexOf('\n');
                // پیام کامل را از بافر جدا کن
                const completeMessage = messageBuffer.substring(0, messageEndIndex);
                // پیام پردازش شده را از ابتدای بافر حذف کن
                messageBuffer = messageBuffer.substring(messageEndIndex + 1);

                // 3. حالا پیام کامل و معتبر را parse کن
                try {
                    const message = JSON.parse(completeMessage);
                    // ... بقیه کد سوییچ شما مثل قبل
                    switch (message.type) {
                      case 'trade_data':
                        setTrades(message.data.trades || []);
                        setTotalPL(message.data.total_pl || 0);
                        setSymbol(message.data.symbol || 'N/A');
                        // آپدیت کردن تنظیمات همراه با داده‌های ترید
                        if(message.data.settings) {
                          setSettings(message.data.settings || {});
                        }
                        break;
                      case 'settings':
                        setSettings(message.data || {});
                        break;
                      case 'feedback':
                        const feedback = message.data;
                        if (feedback.status === 'success') toast.success(feedback.message);
                        else if (feedback.status === 'error') toast.error(feedback.message);
                        else toast(feedback.message, { icon: 'ℹ️' });
                        break;
                    }
                } catch (e) {
                    console.error("Error parsing complete message:", e);
                    console.error("The problematic message was:", completeMessage);
                }
            }
        };
    }

    connect();

    return () => {
        if (timeoutId) clearTimeout(timeoutId);
        if (ws) {
            ws.onclose = null;
            ws.close();
        }
    };
}, []); 
  
  const hasProfits = useMemo(() => trades.some((t) => t.profit > 0), [trades]);
  const hasLosses = useMemo(() => trades.some((t) => t.profit < 0), [trades]);
  const hasTrades = useMemo(() => trades.length > 0, [trades]);

  const handleSendCommand = async (command: CommandPayload, loadingKey: string) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      toast.error('اتصال با سرور برقرار نیست!');
      return;
    }

    setLoadingStates((prev) => ({ ...prev, [loadingKey]: true }));
    try {
      ws.send(JSON.stringify(command));
    } catch (error) {
      console.error('Failed to send command via WebSocket:', error);
      toast.error('خطا در ارسال دستور به سرور');
    } finally {
      setTimeout(() => {
        setLoadingStates((prev) => ({ ...prev, [loadingKey]: false }));
      }, 500);
    }
  };
  

  const openConfirmation = (title: string, description: string, command: CommandPayload, loadingKey: string) => {
    setConfirmState({ isOpen: true, title, description, onConfirm: () => { handleSendCommand(command, loadingKey); setConfirmState({ isOpen: false, title: '', description: '', onConfirm: null }); } });
  };

  const getConnectionIcon = () => {
    let color: "success" | "error" | "warning" = "warning";
    let animation = {};
    if (connectionStatus === ConnectionStatus.Connected) color = "success";
    if (connectionStatus === ConnectionStatus.Disconnected) color = "error";
    if (connectionStatus === ConnectionStatus.Connecting) {
      color = "warning";
      animation = { animation: `${blinkAnimation} 2s infinite` };
    }
    return <Tooltip title={connectionStatus}><Wifi sx={{ color: `${color}.main`, ...animation }} /></Tooltip>;
  };

  const TradeListHeader = () => (
    <Box sx={{ display: 'flex', width: '100%', px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
      <Typography sx={{ flex: 1.5, textAlign: 'center', fontWeight: 'bold', color: 'text.secondary' }}>تیکت</Typography>
      <Typography sx={{ flex: 1, textAlign: 'center', fontWeight: 'bold', color: 'text.secondary' }}>نماد</Typography>
      <Typography sx={{ flex: 1, textAlign: 'center', fontWeight: 'bold', color: 'text.secondary' }}>نوع</Typography>
      <Typography sx={{ flex: 1, textAlign: 'center', fontWeight: 'bold', color: 'text.secondary' }}>حجم</Typography>
      <Typography sx={{ flex: 1, textAlign: 'center', fontWeight: 'bold', color: 'text.secondary' }}>سود</Typography>
      <Typography sx={{ flex: 1, textAlign: 'center', fontWeight: 'bold', color: 'text.secondary' }}>ATM</Typography>
      <Typography sx={{ flex: 2, textAlign: 'center', fontWeight: 'bold', color: 'text.secondary' }}>اقدامات</Typography>
    </Box>
  );

  const TradeRow = ({ trade }: { trade: Trade }) => {
    const atmKey = `atm_${trade.ticket}`;
    const beKey = `be_${trade.ticket}`;
    const restoreBeKey = `restore_be_${trade.ticket}`;
    const closeKey = `close_${trade.ticket}`;

    return (
      <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', px: 2, py: 1, bgcolor: alpha(trade.profit > 0 ? theme.palette.success.main : trade.profit < 0 ? theme.palette.error.main : theme.palette.background.paper, 0.15), borderRadius: 2, mb: 1 }}>
        <Typography sx={{ flex: 1.5, textAlign: 'center' }}>{trade.ticket}</Typography>
        <Typography sx={{ flex: 1, textAlign: 'center' }}>{trade.symbol}</Typography>
        <Typography sx={{ flex: 1, textAlign: 'center' }}>{trade.type}</Typography>
        <Typography sx={{ flex: 1, textAlign: 'center' }}>{trade.volume.toFixed(2)}</Typography>
        <Typography sx={{ flex: 1, textAlign: 'center', fontWeight: 'bold', color: trade.profit >= 0 ? 'success.main' : 'error.main' }}>{trade.profit.toFixed(2)} $</Typography>
        <Box sx={{ flex: 1, textAlign: 'center' }}>
          <Chip label={trade.atm_enabled ? "فعال" : "غیرفعال"} color={trade.atm_enabled ? "success" : "default"} size="small" onClick={() => handleSendCommand({ action: 'toggle_atm_trade', ticket: trade.ticket, atm_trade_state: !trade.atm_enabled }, atmKey)} disabled={loadingStates[atmKey]} />
        </Box>
        <Box sx={{ flex: 2, display: 'flex', justifyContent: 'center', gap: 1 }}>
          {trade.is_breakeven ? (
            <Button variant="contained" size="small" sx={{ bgcolor: '#f59e0b', '&:hover': { bgcolor: '#f97316' } }} onClick={() => handleSendCommand({ action: 'restore_breakeven', ticket: trade.ticket }, restoreBeKey)} disabled={loadingStates[restoreBeKey]}>لغو BE</Button>
          ) : (
            <Button variant="contained" size="small" color="info" onClick={() => handleSendCommand({ action: 'breakeven', ticket: trade.ticket }, beKey)} disabled={trade.profit <= 0 || loadingStates[beKey]}>ریسک فری</Button>
          )}
          <Button variant="contained" size="small" color="error" onClick={() => handleSendCommand({ action: 'close', ticket: trade.ticket }, closeKey)} disabled={loadingStates[closeKey]}>بستن</Button>
        </Box>
      </Box>
    );
  };

  return (
    <ThemeProvider theme={theme}>
      <Toaster position="top-center" toastOptions={{ style: { background: '#334155', color: '#e2e8f0' } }} />
      <CssBaseline />
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', bgcolor: 'background.default' }}>
        <AppBar position="static" elevation={0} color="transparent">
          <Toolbar>
            {getConnectionIcon()}
            <Typography variant="h6" sx={{ flexGrow: 1, textAlign: 'center' }}>داشبورد معاملاتی - نماد: <span style={{ fontWeight: 'bold' }}>{symbol}</span></Typography>
            <Tooltip title="تغییر تم"><IconButton onClick={() => setThemeMode(themeMode === 'light' ? 'dark' : 'light')} color="inherit">{themeMode === 'dark' ? <Brightness7 /> : <Brightness4 />}</IconButton></Tooltip>
            <Tooltip title="تنظیمات"><IconButton onClick={() => setSettingsOpen(true)} color="inherit"><SettingsIcon /></IconButton></Tooltip>
          </Toolbar>
        </AppBar>
        <Container maxWidth="xl" sx={{ flexGrow: 1, py: 2, display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ bgcolor: 'background.paper', borderRadius: 2, flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
            <TradeListHeader />
            {hasTrades ? (
              <Box sx={{ overflowY: 'auto', p: 1 }}>
                {trades.map((trade) => <TradeRow key={trade.ticket} trade={trade} />)}
              </Box>
            ) : (
              <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'text.secondary' }}>
                <InfoOutlined sx={{ fontSize: 60, mb: 2 }} />
                <Typography variant="h6">هیچ معامله‌ی بازی وجود ندارد</Typography>
              </Box>
            )}
          </Box>
        </Container>
        <AppBar position="static" elevation={0} color="transparent" sx={{ top: 'auto', bottom: 0 }}>
          <Toolbar>
            <Typography variant="h6" sx={{ color: totalPL >= 0 ? 'success.main' : 'error.main' }}>سود/زیان کل: {totalPL.toFixed(2)} $</Typography>
            <Box sx={{ flexGrow: 1 }} />
            <Button variant="contained" color="primary" sx={{ ml: 1 }} onClick={() => openConfirmation('بستن همه', 'آیا از بستن تمام معاملات مطمئن هستید؟', { action: 'close_all' }, 'close_all')} disabled={!hasTrades || loadingStates['close_all']}>{loadingStates['close_all'] ? <CircularProgress size={24} /> : 'بستن همه'}</Button>
            <Button variant="contained" color="success" sx={{ ml: 1 }} onClick={() => openConfirmation('بستن سودها', 'آیا از بستن تمام معاملات سودده مطمئن هستید؟', { action: 'close_profits' }, 'close_profits')} disabled={!hasProfits || loadingStates['close_profits']}>{loadingStates['close_profits'] ? <CircularProgress size={24} /> : 'بستن سودها'}</Button>
            <Button variant="contained" color="error" onClick={() => openConfirmation('بستن ضررها', 'آیا از بستن تمام معاملات ضررده مطمئن هستید؟', { action: 'close_losses' }, 'close_losses')} disabled={!hasLosses || loadingStates['close_losses']}>{loadingStates['close_losses'] ? <CircularProgress size={24} /> : 'بستن ضررها'}</Button>
          </Toolbar>
        </AppBar>
        <SettingsDialog open={isSettingsOpen} onClose={() => setSettingsOpen(false)} settings={settings} onSave={(newSettings) => handleSendCommand({ action: 'update_settings', settings: newSettings }, 'save_settings')} />
        <ConfirmationDialog {...confirmState} onClose={() => setConfirmState({ ...confirmState, isOpen: false })} />
      </Box>
    </ThemeProvider>
  );
}

// --- HELPER COMPONENTS ---
interface ConfirmationDialogProps { isOpen: boolean; title: string; description: string; onConfirm: (() => void) | null; onClose: () => void; }
function ConfirmationDialog({ isOpen, title, description, onConfirm, onClose }: ConfirmationDialogProps) {
  return (
    <Dialog open={isOpen} onClose={onClose} PaperProps={{ sx: { borderRadius: 2 } }}>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent><Typography>{description}</Typography></DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose}>انصراف</Button>
        <Button onClick={() => onConfirm && onConfirm()} variant="contained" color="primary" autoFocus>تایید</Button>
      </DialogActions>
    </Dialog>
  );
}

interface SettingsDialogProps { open: boolean; onClose: () => void; settings: Settings; onSave: (settings: Settings) => void; }
function SettingsDialog({ open, onClose, settings, onSave }: SettingsDialogProps) {
    const [localSettings, setLocalSettings] = useState<Settings>(settings);
    useEffect(() => { setLocalSettings(settings); }, [settings]);
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;
        setLocalSettings(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : parseFloat(value) || 0 }));
    };
    function SaveAndCloseModal() {
      onSave(localSettings)
      onClose()
    }
    if (!open) return null;
    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" PaperProps={{ sx: { borderRadius: 2 } }}>
            <DialogTitle>تنظیمات مدیریت خودکار</DialogTitle>
            <DialogContent>
                <Box component="form" sx={{ mt: 2 }}>
                    <TextField name="triggerPercent" label="درصد سود برای فعال‌سازی" type="number" fullWidth margin="normal" value={localSettings.triggerPercent || ''} onChange={handleChange} />
                    <TextField name="closePercent" label="درصد بستن بخشی از حجم" type="number" fullWidth margin="normal" value={localSettings.closePercent || ''} onChange={handleChange} />
                    <FormControlLabel control={<Switch name="moveToBE" checked={localSettings.moveToBE || false} onChange={handleChange} />} label="ریسک-فری کردن معامله" />
                </Box>
            </DialogContent>
            <DialogActions sx={{ p: 2 }}>
                <Button onClick={onClose}>انصراف</Button>
                <Button onClick={() => SaveAndCloseModal()} variant="contained">ذخیره</Button>
            </DialogActions>
        </Dialog>
    );
}

