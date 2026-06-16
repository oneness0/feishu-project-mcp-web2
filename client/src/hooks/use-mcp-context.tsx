import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

export interface McpContextValue {
  sessionToken: string | null;
  connected: boolean;
  expiresAt: number | undefined;
  readonly: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  refreshStatus: () => Promise<void>;
}

const McpContext = createContext<McpContextValue | null>(null);

const SESSION_TOKEN_KEY = 'feishu_mcp_session_token';

export function McpProvider({ children }: { children: React.ReactNode }) {
  const [sessionToken, setSessionToken] = useState<string | null>(
    () => localStorage.getItem(SESSION_TOKEN_KEY),
  );
  const [connected, setConnected] = useState(false);
  const [expiresAt, setExpiresAt] = useState<number | undefined>(undefined);
  const [readonly, setReadonly] = useState(false);
  const popupRef = useRef<Window | null>(null);

  const refreshStatus = useCallback(async () => {
    const token = sessionToken || localStorage.getItem(SESSION_TOKEN_KEY);
    if (!token) {
      setConnected(false);
      return;
    }
    try {
      const res = await fetch('/api/oauth/status', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setConnected(Boolean(data.connected));
      setExpiresAt(data.expiresAt);
      setReadonly(Boolean(data.readonly));
    } catch {
      setConnected(false);
    }
  }, [sessionToken]);

  // 页面加载时检查会话状态
  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  const connect = useCallback(async () => {
    const returnOrigin = window.location.origin;
    const startUrl = `/api/oauth/start?return_origin=${encodeURIComponent(returnOrigin)}`;

    return new Promise<void>((resolve, reject) => {
      const popup = window.open(startUrl, 'feishu-mcp-auth', 'width=500,height=700');
      if (!popup) {
        reject(new Error('弹窗被拦截，请允许弹窗后重试'));
        return;
      }
      popupRef.current = popup;

      function onMessage(e: MessageEvent) {
        if (e.data?.type !== 'feishu-mcp-auth') return;
        window.removeEventListener('message', onMessage);
        popup?.close();

        if (e.data.ok && e.data.sessionToken) {
          const token: string = e.data.sessionToken;
          localStorage.setItem(SESSION_TOKEN_KEY, token);
          setSessionToken(token);
          setConnected(true);
          resolve();
        } else {
          reject(new Error(e.data.error || '授权失败'));
        }
      }

      window.addEventListener('message', onMessage);

      // 兜底：弹窗被手动关闭
      const timer = setInterval(() => {
        if (popup.closed) {
          clearInterval(timer);
          window.removeEventListener('message', onMessage);
          reject(new Error('授权窗口已关闭'));
        }
      }, 500);
    });
  }, []);

  const disconnect = useCallback(async () => {
    const token = sessionToken || localStorage.getItem(SESSION_TOKEN_KEY);
    if (token) {
      try {
        await fetch('/api/oauth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        // 忽略
      }
    }
    localStorage.removeItem(SESSION_TOKEN_KEY);
    setSessionToken(null);
    setConnected(false);
    setExpiresAt(undefined);
  }, [sessionToken]);

  return (
    <McpContext.Provider
      value={{ sessionToken, connected, expiresAt, readonly, connect, disconnect, refreshStatus }}
    >
      {children}
    </McpContext.Provider>
  );
}

export function useMcpContext(): McpContextValue {
  const ctx = useContext(McpContext);
  if (!ctx) throw new Error('useMcpContext must be used within McpProvider');
  return ctx;
}
