"use client";

import { useRef } from "react";
import Draggable from "react-draggable";
import BlockRenderer from "@/components/BlockRenderer";

// A draggable + resizable + layerable wrapper used by the editor's Canvas view.
// Renders the block with the SAME <BlockRenderer> as the reader, so it's WYSIWYG.
export default function CanvasBlock({ block, theme, selected, onSelect, onChange, onToFlow, onLayer }) {
  const nodeRef = useRef(null);
  const pos = block.position || { x: 20, y: 20, width: 280, z: 1 };

  // Corner-resize via raw mouse handlers (react-draggable doesn't resize).
  const startResize = (e) => {
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX, startY = e.clientY;
    const startW = pos.width || 280;
    const startH = pos.height || (nodeRef.current?.offsetHeight ?? 120);
    const move = (ev) => {
      const w = Math.max(60, startW + (ev.clientX - startX));
      const h = Math.max(40, startH + (ev.clientY - startY));
      onChange({ ...pos, width: w, height: h });
    };
    const up = () => {
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
    };
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
  };

  return (
    <Draggable
      nodeRef={nodeRef}
      bounds="parent"
      handle=".cb-handle"
      position={{ x: pos.x, y: pos.y }}
      onStart={onSelect}
      onStop={(e, data) => onChange({ ...pos, x: Math.round(data.x), y: Math.round(data.y) })}
    >
      <div
        ref={nodeRef}
        onMouseDown={onSelect}
        style={{
          position: "absolute",
          width: pos.width || 280,
          height: pos.height || "auto",
          zIndex: pos.z ?? 1,
          outline: selected ? `1.5px solid ${theme.accent}` : "1px dashed rgba(128,128,128,.35)",
          outlineOffset: 2,
          borderRadius: 4,
        }}
      >
        {/* drag handle / toolbar */}
        <div
          className="cb-handle"
          style={{
            position: "absolute", top: -22, left: 0, display: "flex", gap: 4, alignItems: "center",
            cursor: "move", opacity: selected ? 1 : 0.4, transition: "opacity .2s",
          }}
        >
          <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, background: theme.accent, color: "#fff" }}>⋮⋮ {block.type}</span>
          {selected && (
            <>
              <button onMouseDown={e => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onLayer("front"); }} title="Bring to front" style={miniBtn}>⬆</button>
              <button onMouseDown={e => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onLayer("back"); }} title="Send to back" style={miniBtn}>⬇</button>
              <button onMouseDown={e => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onToFlow(); }} title="Dock back into flow" style={miniBtn}>⤓ flow</button>
            </>
          )}
        </div>

        <div style={{ pointerEvents: "none", padding: 4 }}>
          <BlockRenderer block={{ ...block, position: null }} theme={theme} />
        </div>

        {/* resize handle */}
        <div
          onMouseDown={startResize}
          style={{
            position: "absolute", right: -5, bottom: -5, width: 12, height: 12,
            borderRadius: 3, background: theme.accent, cursor: "nwse-resize",
            opacity: selected ? 1 : 0.5,
          }}
        />
      </div>
    </Draggable>
  );
}

const miniBtn = {
  fontSize: 9, padding: "2px 5px", borderRadius: 4, cursor: "pointer",
  background: "#0d0f18", color: "#c8cad4", border: "1px solid #2a2d3e",
};
