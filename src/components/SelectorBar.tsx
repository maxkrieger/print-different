import { useCallback } from "react";
import { Dispatch, IState } from "../reducer";

const SelectorBar = ({
  state,
  dispatch,
}: {
  state: IState;
  dispatch: Dispatch;
}) => {
  const onPageClick = useCallback(
    (index: number) => {
      dispatch({
        kind: "set_index",
        index,
      });
    },
    [dispatch]
  );
  if (!state.doc) {
    return null;
  }
  return (
    <div>
      {state.doc.pages.map((page, k) => (
        <div
          style={{ display: "inline-block", cursor: "pointer" }}
          key={k}
          onClick={() => onPageClick(k)}
        >
          <img alt={`page ${k}`} src={page.image} width={50} />
        </div>
      ))}
    </div>
  );
};
export default SelectorBar;
