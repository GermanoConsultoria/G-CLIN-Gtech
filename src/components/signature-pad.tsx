import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

export type SignaturePadHandle = {
  clear: () => void;
  isEmpty: () => boolean;
  toDataURL: () => string;
};

export const SignaturePad = forwardRef<SignaturePadHandle, { className?: string }>(
  function SignaturePad({ className }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drawing = useRef(false);
    const hasDrawn = useRef(false);
    const last = useRef<{ x: number; y: number } | null>(null);

    function fillWhite() {
      const c = canvasRef.current;
      if (!c) return;
      const ctx = c.getContext("2d")!;
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, c.width, c.height);
    }

    useEffect(() => {
      fillWhite();
    }, []);

    function pos(e: React.PointerEvent<HTMLCanvasElement>) {
      const c = canvasRef.current!;
      const rect = c.getBoundingClientRect();
      return {
        x: (e.clientX - rect.left) * (c.width / rect.width),
        y: (e.clientY - rect.top) * (c.height / rect.height),
      };
    }

    function handleDown(e: React.PointerEvent<HTMLCanvasElement>) {
      e.preventDefault();
      canvasRef.current!.setPointerCapture(e.pointerId);
      drawing.current = true;
      last.current = pos(e);
    }

    function handleMove(e: React.PointerEvent<HTMLCanvasElement>) {
      if (!drawing.current || !last.current) return;
      e.preventDefault();
      const p = pos(e);
      const ctx = canvasRef.current!.getContext("2d")!;
      ctx.strokeStyle = "#2A2A2A";
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(last.current.x, last.current.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      last.current = p;
      hasDrawn.current = true;
    }

    function handleUp() {
      drawing.current = false;
      last.current = null;
    }

    useImperativeHandle(ref, () => ({
      clear() {
        fillWhite();
        hasDrawn.current = false;
      },
      isEmpty() {
        return !hasDrawn.current;
      },
      toDataURL() {
        return canvasRef.current!.toDataURL("image/png");
      },
    }));

    return (
      <canvas
        ref={canvasRef}
        width={700}
        height={220}
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerLeave={handleUp}
        className={className}
        style={{ touchAction: "none" }}
      />
    );
  },
);
