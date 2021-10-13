import { PDFDocument } from "pdf-lib";
import React from "react";

export type Chunk = {
  x: number;
  y: number;
  w: number;
  h: number;
  image: string;
};

export type Page = {
  image: string;
  chunks: Chunk[];
  width: number;
  height: number;
};

export type Doc = {
  pdfDocument: PDFDocument;
  pages: Page[];
  currentPage: number;
};

export type IState = {
  doc?: Doc;
  loading: boolean;
};

export type Action =
  | {
      kind: "set_doc";
      doc: any;
    }
  | { kind: "set_loading"; loading: boolean }
  | { kind: "set_index"; index: number }
  | { kind: "add_chunk"; chunk: Chunk }
  | { kind: "update_chunk"; chunk: Chunk; index: number }
  | { kind: "cleanup_empty_boxes" }
  | { kind: "delete_chunk"; index: number };

const b64ToImage = (b64: string) => {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.src = b64;
    image.onload = function () {
      resolve(image);
    };
    image.onerror = function () {
      reject(this);
    };
  });
};

export const chunkCoordsToImage = async (
  chunk: Chunk,
  page: Page
): Promise<string> => {
  const canvas = document.createElement("canvas");
  canvas.width = chunk.w;
  canvas.height = chunk.h;
  const ctx = canvas.getContext("2d");
  const img = await b64ToImage(page.image);
  ctx?.drawImage(img, -chunk.x, -chunk.y, img.width, img.height);
  return canvas.toDataURL("image/png");
};

export type Dispatch = React.Dispatch<Action>;

export const reducer = (state: IState, action: Action): IState => {
  switch (action.kind) {
    case "set_doc":
      return {
        ...state,
        doc: action.doc,
      };
    case "set_loading":
      return { ...state, loading: action.loading };
    case "set_index":
      return { ...state, doc: { ...state.doc!, currentPage: action.index } };
    case "add_chunk":
      const newAddPages = [...state.doc!.pages];
      newAddPages[state.doc!.currentPage].chunks.push(action.chunk);
      return { ...state, doc: { ...state.doc!, pages: newAddPages } };
    case "update_chunk":
      const newUpdatePages = [...state.doc!.pages];
      newUpdatePages[state.doc!.currentPage].chunks[action.index] =
        action.chunk;
      return { ...state, doc: { ...state.doc!, pages: newUpdatePages } };
    case "cleanup_empty_boxes":
      const newCleanupPages = [...state.doc!.pages];
      newCleanupPages[state.doc!.currentPage].chunks = newCleanupPages[
        state.doc!.currentPage
      ].chunks.filter((chunk) => {
        return chunk.w > 0 && chunk.h > 0;
      });
      return { ...state, doc: { ...state.doc!, pages: newCleanupPages } };
    case "delete_chunk":
      const newDeletePages = [...state.doc!.pages];
      newDeletePages[state.doc!.currentPage] = {
        ...newDeletePages[state.doc!.currentPage],
        chunks: newDeletePages[state.doc!.currentPage].chunks.filter(
          (chunk, index) => {
            return index !== action.index;
          }
        ),
      };
      return { ...state, doc: { ...state.doc!, pages: newDeletePages } };
    default:
      return state;
  }
};
