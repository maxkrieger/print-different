import { useCallback, useEffect, useReducer } from "react";
import {
  Action,
  IState,
  Page,
  PageState,
  processFile,
  reducer,
} from "./reducer";
import SelectorBar from "./components/SelectorBar";
import PageViewer from "./components/PageViewer";
import ChunkViewer from "./components/ChunkViewer";
import LayoutPreview from "./components/LayoutPreview";
const { ipcRenderer } = window.require("electron");

function App() {
  const [state, dispatch] = useReducer<
    (state: IState, action: Action) => IState
  >(reducer, {
    doc: undefined,
    pageState: PageState.Empty,
  });
  const chooseFile = useCallback(() => {
    (async () => {
      const reply = await ipcRenderer.invoke("pick-file");
      if (reply) {
        processFile(reply, dispatch);
      }
    })();
  }, [dispatch]);
  useEffect(() => {
    ipcRenderer.on("file-chosen", (event: any, file: Buffer) => {
      processFile(file, dispatch);
    });
  }, [dispatch]);
  return (
    <div
      style={{
        height: "100%",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div>
        Print Different <button onClick={chooseFile}>pick file</button>{" "}
        {state.pageState === PageState.Viewing && (
          <button
            onClick={() =>
              dispatch({ kind: "set_pagestate", state: PageState.Exporting })
            }
          >
            send
          </button>
        )}
        {state.pageState === PageState.Exporting && (
          <button
            onClick={() =>
              dispatch({ kind: "set_pagestate", state: PageState.Viewing })
            }
          >
            back to selecting
          </button>
        )}
      </div>
      {state.pageState === PageState.Loading && <p>loading...</p>}
      {state.pageState === PageState.Viewing && (
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            padding: "1em",
            overflow: "hidden",
            flex: 1,
          }}
        >
          <SelectorBar state={state} dispatch={dispatch} />
          <PageViewer state={state} dispatch={dispatch} />
          <ChunkViewer state={state} dispatch={dispatch} />
        </div>
      )}
      {state.pageState === PageState.Exporting && (
        <LayoutPreview state={state} dispatch={dispatch} />
      )}
    </div>
  );
}

export default App;
