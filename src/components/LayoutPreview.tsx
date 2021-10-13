import { useEffect, useState } from "react";
import { Dispatch, generateLayout, IState, Layout } from "../reducer";

const LayoutPreview = ({
  state,
  dispatch,
}: {
  state: IState;
  dispatch: Dispatch;
}) => {
  const [layout, setLayout] = useState<null | Layout>(null);
  const [pdfStr, setPdfStr] = useState<string>("");
  useEffect(() => {
    (async () => {
      const result = await generateLayout(state.doc!);
      setLayout(result);
      const pdfBytes = await result.document.saveAsBase64({ dataUri: true });
      setPdfStr(pdfBytes);
    })();
  }, [state]);
  return (
    <div style={{ flex: 1 }}>
      {pdfStr === "" && "loading..."}
      {pdfStr !== "" && (
        <iframe
          title="pdf"
          src={pdfStr}
          style={{ width: "100%", height: "100%" }}
        />
      )}
    </div>
  );
};
export default LayoutPreview;
