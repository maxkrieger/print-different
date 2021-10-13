import { PageSizes, PDFDocument, RotationTypes } from "pdf-lib";
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

export type PositionedChunk = {
  chunk: Chunk;
  x: number;
  y: number;
  w: number;
  h: number;
  page: number;
};
export type Layout = {
  positionedChunks: PositionedChunk[];
  document: PDFDocument;
};

export enum PageState {
  Empty,
  Loading,
  Viewing,
  Exporting,
}

export type IState = {
  doc?: Doc;
  pageState: PageState;
};

export type Action =
  | {
      kind: "set_doc";
      doc: any;
    }
  | { kind: "set_pagestate"; state: PageState }
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

export const flattenChunks = (doc: Doc): PositionedChunk[] =>
  doc.pages
    .map((page, idx) =>
      page.chunks.map((chunk) => ({
        page: idx,
        x: 0,
        y: 0,
        w: chunk.w,
        h: chunk.h,
        chunk,
      }))
    )
    .flat();

const PADDING = 20;
export const generateLayout = async (doc: Doc): Promise<Layout> => {
  const exportedPdf = await PDFDocument.create();
  const importedPdf = doc.pdfDocument;
  const chunks = flattenChunks(doc);
  let page = exportedPdf.addPage(PageSizes.Letter);
  for (var i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    if (i % 4 === 0 && i !== 0) {
      page = exportedPdf.addPage(PageSizes.Letter);
    }
    chunk.w = page.getWidth() / 2 - PADDING * 2;
    const ratio = chunk.chunk.h / chunk.chunk.w;
    chunk.h = chunk.w * ratio;
    chunk.x = i % 2 === 0 ? PADDING : page.getWidth() / 2 + PADDING;
    chunk.y = i % 4 < 2 ? page.getHeight() - chunk.h - PADDING : PADDING;
    const sourcePage = importedPdf.getPage(chunk.page);
    const clipBox = {
      left: chunk.chunk.x,
      right: chunk.chunk.x + chunk.chunk.w,
      bottom: sourcePage.getHeight() - (chunk.chunk.y + chunk.chunk.h),
      top: sourcePage.getHeight() - chunk.chunk.y,
    };
    const embedded = await exportedPdf.embedPage(sourcePage, clipBox);

    page.drawPage(embedded, {
      //   rotate: { angle: 270, type: RotationTypes.Degrees },
      width: chunk.w,
      height: chunk.h,
      x: chunk.x,
      y: chunk.y,
    });
  }
  return { positionedChunks: chunks, document: exportedPdf };
};

export const reducer = (state: IState, action: Action): IState => {
  switch (action.kind) {
    case "set_doc":
      return {
        ...state,
        doc: action.doc,
      };
    case "set_pagestate":
      return { ...state, pageState: action.state };
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
