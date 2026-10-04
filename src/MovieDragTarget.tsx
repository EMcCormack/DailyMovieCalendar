import { type ReactNode, useEffect, useRef } from "react";
import { Platform, Pressable, View } from "react-native";

export function MovieDragTarget({
  title,
  index,
  count,
  dateLabel,
  drag,
  isActive,
  onMove,
  children,
}: {
  title: string;
  index: number;
  count: number;
  dateLabel: string;
  drag: () => void;
  isActive: boolean;
  onMove: (offset: number) => void;
  children: ReactNode;
}) {
  const target = useRef<View>(null);
  const holding = useRef(false);
  const dragAction = useRef(drag);
  dragAction.current = drag;
  useEffect(() => {
    if (!isActive) holding.current = false;
  }, [isActive]);
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const element = target.current as unknown as HTMLElement;
    const document = element.ownerDocument;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let pointer: { id: number; x: number; y: number } | undefined;
    const cancelHold = () => {
      clearTimeout(timer);
      timer = undefined;
      pointer = undefined;
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!event.isPrimary || event.button !== 0) return;
      cancelHold();
      pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
      timer = setTimeout(() => {
        holding.current = true;
        dragAction.current();
      }, 300);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!pointer || event.pointerId !== pointer.id || holding.current) return;
      if (Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > 8) cancelHold();
    };
    // Allow ordinary swipes to scroll; prevent browser panning once a hold starts dragging.
    const onTouchMove = (event: TouchEvent) => {
      if (holding.current && event.cancelable) event.preventDefault();
    };
    element.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", cancelHold);
    document.addEventListener("pointercancel", cancelHold);
    element.addEventListener("touchmove", onTouchMove, { passive: false });
    return () => {
      cancelHold();
      element.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", cancelHold);
      document.removeEventListener("pointercancel", cancelHold);
      element.removeEventListener("touchmove", onTouchMove);
    };
  }, []);
  return (
    <Pressable
      ref={target}
      accessibilityRole="adjustable"
      accessibilityLabel={`Reorder ${title}`}
      accessibilityHint="Hold to drag, or use the move earlier and move later actions."
      accessibilityValue={{ min: 1, max: count, now: index + 1, text: dateLabel }}
      accessibilityActions={[
        { name: "increment", label: "Move later" },
        { name: "decrement", label: "Move earlier" },
      ]}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === "increment") onMove(1);
        if (event.nativeEvent.actionName === "decrement") onMove(-1);
      }}
      {...(Platform.OS === "web"
        ? {
            onContextMenu: (event: { preventDefault: () => void }) => event.preventDefault(),
            onKeyDown: (event: { key: string; preventDefault: () => void }) => {
              if (event.key === "ArrowUp" || event.key === "ArrowDown") {
                event.preventDefault();
                onMove(event.key === "ArrowUp" ? -1 : 1);
              }
            },
          }
        : {})}
      onLongPress={Platform.OS === "web" ? undefined : drag}
      delayLongPress={300}
      className="flex-1 self-stretch flex-row items-center gap-3 px-3 py-3"
      style={{ cursor: "pointer", ...(Platform.OS === "web" ? { userSelect: "none" } : {}) }}
    >
      {children}
    </Pressable>
  );
}
