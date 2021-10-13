import { Dispatch, IState } from "../reducer";

const ChunkViewer = ({
  state,
  dispatch,
}: {
  state: IState;
  dispatch: Dispatch;
}) => {
  if (!state.doc) {
    return null;
  }
  const chunks = state.doc!.pages.map((page) => page.chunks).flat();
  return (
    <div style={{ height: "100%", overflow: "auto" }}>
      {chunks.map((chunk, k) =>
        chunk.image !== "" ? (
          <div
            key={`chunk-${k}`}
            style={{
              margin: "20px",
              boxShadow: "0 0px 5px 5px rgba(0,0,0,0.2)",
            }}
          >
            <img alt={"chunk"} src={chunk.image} width={100} />
          </div>
        ) : null
      )}
    </div>
  );
};
export default ChunkViewer;
