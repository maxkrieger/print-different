import { PDFDocument } from "pdf-lib";
import { useCallback, useReducer } from "react";
import { Action, IState, Page, PageState, reducer } from "./reducer";
import { pdfjs } from "react-pdf/dist/esm/entry.webpack";
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
        dispatch({ kind: "set_pagestate", state: PageState.Loading });
        const pdfDocument = await PDFDocument.load(reply);
        const pdf = await pdfjs.getDocument({ data: reply }).promise;
        const canvas = document.createElement("canvas");
        const pages: Page[] = [];
        for (let i = 0; i < pdf.numPages; i++) {
          const page = await pdf.getPage(i + 1);
          const viewport = page.getViewport({ scale: 2 });
          const context = canvas.getContext("2d");
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          await page.render({
            canvasContext: context as any,
            viewport: viewport,
          }).promise;
          pages.push({
            image: canvas.toDataURL("image/png"),
            width: viewport.width,
            height: viewport.height,
            chunks: [],
          });
        }
        canvas.remove();
        dispatch({
          kind: "set_doc",
          doc: { pdfDocument, pages, currentPage: 0 },
        });
        dispatch({ kind: "set_pagestate", state: PageState.Viewing });
      }
    })();
  }, []);
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
