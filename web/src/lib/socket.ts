"use client";

import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { API_URL, leerToken } from "./api";

export type EstadoConexion = "conectando" | "en-vivo" | "reconectando";

/**
 * Conexión Socket.IO autenticada con el JWT. El servidor decide las salas.
 * `alReconectar` permite resincronizar por REST lo que pudo perderse sin conexión.
 */
export function useTiempoReal(
  manejadores: Record<string, (datos: never) => void>,
  dependencias: unknown[] = [],
  alReconectar?: () => void,
) {
  const [estado, setEstado] = useState<EstadoConexion>("conectando");
  const ref = useRef(manejadores);
  ref.current = manejadores;
  const reconectarRef = useRef(alReconectar);
  reconectarRef.current = alReconectar;

  useEffect(() => {
    const socket: Socket = io(API_URL, { auth: { token: leerToken() }, transports: ["websocket", "polling"] });
    let conectadoAntes = false;
    socket.on("connect", () => {
      setEstado("en-vivo");
      if (conectadoAntes) reconectarRef.current?.();
      conectadoAntes = true;
    });
    socket.on("disconnect", () => setEstado("reconectando"));
    socket.on("connect_error", () => setEstado("reconectando"));
    socket.onAny((evento, datos) => ref.current[evento]?.(datos as never));
    return () => {
      socket.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencias);

  return estado;
}
