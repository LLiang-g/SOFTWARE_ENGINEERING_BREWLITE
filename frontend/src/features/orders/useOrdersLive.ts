'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { API_URL } from '@/lib/api';

type LoadOrders = (signal: AbortSignal) => Promise<void>;

export function useOrdersLive(enabled: boolean, load: LoadOrders) {
    const [connected, setConnected] = useState(false);
    const [isLoading, setIsLoading] = useState(enabled);
    const request = useRef<AbortController | null>(null);
    const activeLoad = useRef<LoadOrders | null>(null);

    const refresh = useCallback(async () => {
        if (activeLoad.current !== load) return;
        // Chỉ lần tải mới nhất được cập nhật giao diện.
        request.current?.abort();
        const controller = new AbortController();
        request.current = controller;
        setIsLoading(true);
        try {
            await load(controller.signal);
        } finally {
            if (!controller.signal.aborted) setIsLoading(false);
        }
    }, [load]);

    useEffect(() => {
        if (!enabled) return;
        activeLoad.current = load;
        const socket = io(`${API_URL.replace(/\/$/, '')}/orders-live`, {
            transports: ['websocket'],
        });

        socket.on('connect', () => {
            setConnected(true);
            void refresh();
        });
        socket.on('disconnect', () => setConnected(false));
        socket.on('connect_error', () => setConnected(false));
        socket.on('orders.changed', () => void refresh());

        // Vẫn tải bằng HTTP ngay cả khi WebSocket chưa kết nối.
        queueMicrotask(() => {
            if (socket.active) void refresh();
        });

        const poll = setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, 15000);
        return () => {
            clearInterval(poll);
            activeLoad.current = null;
            request.current?.abort();
            socket.removeAllListeners();
            socket.disconnect();
        };
    }, [enabled, load, refresh]);

    return { connected, isLoading, refresh };
}
