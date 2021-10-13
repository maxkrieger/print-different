import { PDFDocument } from "pdf-lib";
import { useCallback, useReducer } from "react";
import { Page, reducer } from "./reducer";
import { pdfjs } from "react-pdf/dist/esm/entry.webpack";
import SelectorBar from "./components/SelectorBar";
import PageViewer from "./components/PageViewer";
import ChunkViewer from "./components/ChunkViewer";
const { ipcRenderer } = window.require("electron");

function App() {
  const [state, dispatch] = useReducer(reducer, {
    doc: undefined,
    loading: false,
  });
  const chooseFile = useCallback(() => {
    (async () => {
      const reply = await ipcRenderer.invoke("pick-file");
      if (reply) {
        dispatch({ kind: "set_loading", loading: true });
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
        dispatch({ kind: "set_loading", loading: false });
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
      </div>
      {state.loading && <p>loading...</p>}
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
    </div>
  );
}

export default App;
