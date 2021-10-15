import { Dispatch, flattenChunks, IState } from "../reducer";

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
  const chunks = flattenChunks(state.doc!);
  return (
    <div style={{ height: "100%", overflow: "auto" }}>
      {chunks.map((chunk, k) =>
        chunk.chunk.image !== "" ? (
          <div
            key={`chunk-${k}`}
            onClick={() => dispatch({ kind: "set_index", index: chunk.page })}
            style={{
              margin: "20px",
              cursor: "pointer",
              boxShadow: "0 0px 5px 5px rgba(0,0,0,0.2)",
              position: "relative",
            }}
          >
            <img alt={"chunk"} src={chunk.chunk.image} width={100} />
            <div
              style={{
                position: "absolute",
                bottom: 0,
                right: 0,
                color: "white",
                fontWeight: "bold",
                padding: "2px",
                backgroundColor: "rgba(0,0,0,0.5)",
                borderRadius: "5px",
              }}
            >
              {chunk.name}
            </div>
          </div>
        ) : null
      )}
    </div>
  );
};
export default ChunkViewer;
