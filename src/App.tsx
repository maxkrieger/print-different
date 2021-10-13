import { PDFDocument } from "pdf-lib";
import { useCallback, useReducer } from "react";
import { Page, reducer } from "./reducer";
import { pdfjs } from "react-pdf/dist/esm/entry.webpack";
import SelectorBar from "./components/SelectorBar";
import PageViewer from "./components/PageViewer";
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
            image: canvas.toDataURL(),
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
    <div>
      <h1>
        Print Different <button onClick={chooseFile}>pick file</button>{" "}
      </h1>
      <p>{state.loading && "loading..."}</p>
      <SelectorBar state={state} dispatch={dispatch} />
      <PageViewer state={state} dispatch={dispatch} />
    </div>
  );
}

export default App;
