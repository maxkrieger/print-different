import { useCallback, useEffect, useRef, useState } from "react";
import { chunkCoordsToImage, Dispatch, IState } from "../reducer";

enum ChunkState {
  None,
  SE,
  NW,
  NE,
  SW,
  Move,
}

const PageViewer = ({
  state,
  dispatch,
}: {
  state: IState;
  dispatch: Dispatch;
}) => {
  const svgNode = useRef<SVGSVGElement | null>(null);
  const [dragMode, setDragMode] = useState<ChunkState>(ChunkState.None);
  const [initialCoords, setInitialCoords] = useState<[number, number]>([0, 0]);
  const [offset, setOffset] = useState<[number, number]>([0, 0]);
  const fixCoords = useCallback(
    (x: number, y: number): [number, number] => {
      const currentPage = state.doc!.pages[state.doc!.currentPage];
      const svgRect = svgNode.current!.getBoundingClientRect();
      const svgX = x - svgRect.left;
      const svgY = y - svgRect.top;
      const viewBoxX = (svgX * currentPage.width) / svgRect.width;
      const viewBoxY = (svgY * currentPage.height) / svgRect.height;
      return [viewBoxX, viewBoxY];
    },
    [svgNode, state]
  );
  const currentChunk = state.doc!.currentChunk;
  const onDragChunk = useCallback(
    ({ clientX, clientY }) => {
      if (currentChunk === -1 || dragMode === ChunkState.None) {
        return;
      }
      const currentPage = state.doc!.pages[state.doc!.currentPage];
      const currentChunkData = currentPage.chunks[currentChunk];
      const [x, y] = fixCoords(clientX, clientY);
      const chunk = { ...currentChunkData };

      if (dragMode === ChunkState.Move) {
        chunk.x = x - offset[0];
        chunk.y = y - offset[1];
      } else {
        const corners = [
          [x, y],
          [initialCoords[0], initialCoords[1]],
          [x, initialCoords[1]],
          [initialCoords[0], y],
        ];
        corners.sort((a, b) => a[0] + a[1] - (b[0] + b[1]));

        chunk.x = corners[0][0];
        chunk.y = corners[0][1];
        chunk.w = corners[3][0] - corners[0][0];
        chunk.h = corners[3][1] - corners[0][1];
      }
      dispatch({
        kind: "update_chunk",
        index: currentChunk,
        chunk,
      });
    },
    [state, dispatch, currentChunk, dragMode, fixCoords, initialCoords, offset]
  );
  const doneDragging = useCallback(() => {
    setDragMode(ChunkState.None);
    dispatch({ kind: "cleanup_empty_boxes" });
    if (currentChunk !== -1) {
      (async () => {
        const newChunk = {
          ...state.doc!.pages[state.doc!.currentPage].chunks[currentChunk],
        };
        newChunk.image = await chunkCoordsToImage(
          newChunk,
          state.doc!.pages[state.doc!.currentPage]
        );
        dispatch({
          kind: "update_chunk",
          chunk: newChunk,
          index: currentChunk,
        });
      })();
    }
  }, [dispatch, state, currentChunk]);
  const onDragExistingChunk = useCallback(
    (chunkIndex: number, { clientX, clientY }) => {
      const chunk = state.doc!.pages[state.doc!.currentPage].chunks[chunkIndex];
      dispatch({
        kind: "set_index",
        pageIndex: state.doc!.currentPage,
        chunkIndex,
      });
      setDragMode(ChunkState.Move);
      const [x, y] = fixCoords(clientX, clientY);
      setOffset([x - chunk.x, y - chunk.y]);
    },
    [fixCoords, state, dispatch]
  );
  //   TODO: https://developer.mozilla.org/en-US/docs/Web/API/Element/setPointerCapture
  const onStartNewChunk = useCallback(
    ({ clientX, clientY }) => {
      const currentPage = state.doc!.pages[state.doc!.currentPage];
      const [x, y] = fixCoords(clientX, clientY);
      dispatch({
        kind: "set_index",
        pageIndex: state.doc!.currentPage,
        chunkIndex: currentPage.chunks.length,
      });
      setInitialCoords([x, y]);
      dispatch({
        kind: "add_chunk",
        chunk: {
          x: x,
          y: y,
          w: 0,
          h: 0,
          image: "",
        },
      });
      setDragMode(ChunkState.SE);
    },
    [state, dispatch, fixCoords]
  );
  const onResizeExistingChunk = useCallback(
    (direction: ChunkState, k: number, e) => {
      const chunk = state.doc!.pages[state.doc!.currentPage].chunks[k];
      dispatch({
        kind: "set_index",
        pageIndex: state.doc!.currentPage,
        chunkIndex: k,
      });
      if (direction === ChunkState.SE) {
        setInitialCoords([chunk.x, chunk.y]);
      } else if (direction === ChunkState.NW) {
        setInitialCoords([chunk.x + chunk.w, chunk.y + chunk.h]);
      } else if (direction === ChunkState.SW) {
        setInitialCoords([chunk.x + chunk.w, chunk.y]);
      } else if (direction === ChunkState.NE) {
        setInitialCoords([chunk.x, chunk.y + chunk.h]);
      }
      setDragMode(direction);
    },
    [state, dispatch]
  );
  const onKey = useCallback(
    (e) => {
      if (e.key === "Escape") {
        dispatch({
          kind: "set_index",
          pageIndex: state.doc!.currentPage,
          chunkIndex: -1,
        });
        doneDragging();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        if (currentChunk !== -1) {
          dispatch({ kind: "delete_chunk", index: currentChunk });
        }
        dispatch({
          kind: "set_index",
          pageIndex: state.doc!.currentPage,
          chunkIndex: -1,
        });
        doneDragging();
      }
    },
    [doneDragging, currentChunk, dispatch]
  );
  useEffect(() => {
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [onKey]);
  if (!state.doc || state.doc.pages.length <= state.doc.currentPage) {
    return null;
  }
  const currentPage = state.doc.pages[state.doc.currentPage];
  return (
    <div
      onMouseMove={onDragChunk}
      onMouseUp={doneDragging}
      style={{ flex: 1, height: "100%", overflow: "auto" }}
    >
      <svg
        viewBox={`0 0 ${currentPage.width} ${currentPage.height}`}
        ref={svgNode}
        onMouseLeave={doneDragging}
      >
        <image
          href={currentPage.image}
          style={{ cursor: "crosshair" }}
          onMouseDown={onStartNewChunk}
        />
        {currentPage.chunks.map((chunk, k) => (
          <g key={`chunk-${k}`}>
            <rect
              x={chunk.x}
              y={chunk.y}
              width={chunk.w}
              height={chunk.h}
              fill={"orange"}
              fillOpacity={0.5}
              stroke={"orange"}
              strokeOpacity={0.8}
              strokeWidth={currentChunk === k ? 4 : 0}
              onMouseDown={(e) => onDragExistingChunk(k, e)}
              style={{ cursor: "grab" }}
            />
            {currentChunk === k && (
              <>
                <rect
                  style={{ cursor: "nw-resize" }}
                  x={chunk.x - 8}
                  y={chunk.y - 8}
                  onMouseDown={(e) =>
                    onResizeExistingChunk(ChunkState.NW, k, e)
                  }
                  width={16}
                  height={16}
                  fill={"white"}
                  stroke="black"
                />
                <rect
                  style={{ cursor: "ne-resize" }}
                  x={chunk.x + chunk.w - 8}
                  y={chunk.y - 8}
                  onMouseDown={(e) =>
                    onResizeExistingChunk(ChunkState.NE, k, e)
                  }
                  width={16}
                  height={16}
                  fill={"white"}
                  stroke="black"
                />
                <rect
                  style={{ cursor: "sw-resize" }}
                  x={chunk.x - 8}
                  y={chunk.y + chunk.h - 8}
                  onMouseDown={(e) =>
                    onResizeExistingChunk(ChunkState.SW, k, e)
                  }
                  width={16}
                  height={16}
                  fill={"white"}
                  stroke="black"
                />
                <rect
                  style={{ cursor: "se-resize" }}
                  x={chunk.x + chunk.w - 8}
                  y={chunk.y + chunk.h - 8}
                  onMouseDown={(e) =>
                    onResizeExistingChunk(ChunkState.SE, k, e)
                  }
                  width={16}
                  height={16}
                  fill={"white"}
                  stroke="black"
                />
              </>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
};
export default PageViewer;
