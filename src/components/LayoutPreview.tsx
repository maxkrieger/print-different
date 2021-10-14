import download from "downloadjs";
import { useCallback, useEffect, useState } from "react";
import { Document, Page, Outline } from "react-pdf/dist/esm/entry.webpack";
import { Dispatch, generateLayout, IState, Layout } from "../reducer";

const LayoutPreview = ({
  state,
  dispatch,
}: {
  state: IState;
  dispatch: Dispatch;
}) => {
  const [layout, setLayout] = useState<null | Layout>(null);
  const [pdfBytes, setPdfBytes] = useState<Uint8Array>(new Uint8Array());
  useEffect(() => {
    (async () => {
      const result = await generateLayout(state.doc!);
      setLayout(result);
      const bytes = await result.document.save();
      setPdfBytes(bytes);
    })();
  }, [state]);
  const onDownloadClick = useCallback(() => {
    (async () => {
      download(pdfBytes, "layout.pdf", "application/pdf");
    })();
  }, [pdfBytes]);

  const [pageNumber, setPageNumber] = useState(1);
  return (
    <div style={{ flex: 1 }}>
      {layout === null && "loading..."}
      <button onClick={onDownloadClick}>download</button>
      {layout && (
        <>
          <div style={{ zIndex: 1000 }}>
            <button
              disabled={pageNumber === 1}
              onClick={() => setPageNumber((n) => n - 1)}
            >
              {"<"}
            </button>
            <span>
              page {pageNumber} of {layout.document.getPageCount()}
            </span>
            <button
              disabled={pageNumber === layout.document.getPageCount()}
              onClick={() => setPageNumber((n) => n + 1)}
            >
              {">"}
            </button>
          </div>
          <div style={{ overflow: "hidden" }}>
            <Document file={{ data: pdfBytes, name: "layout.pdf" }}>
              <Page pageNumber={pageNumber} />
            </Document>
          </div>
        </>
      )}
    </div>
  );
};
export default LayoutPreview;
