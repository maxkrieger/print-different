import {
  Duplex,
  PageSizes,
  PDFDocument,
  rgb,
  RotationTypes,
  StandardFonts,
} from "pdf-lib";
import { pdfjs } from "react-pdf/dist/esm/entry.webpack";
import React from "react";
import ShelfPack from "@mapbox/shelf-pack";

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
  name: string;
  page: number;
  new_page: number;
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

export const processFile = async (fileBytes: Buffer, dispatch: Dispatch) => {
  dispatch({ kind: "set_pagestate", state: PageState.Loading });
  const pdfDocument = await PDFDocument.load(fileBytes);
  const pdf = await pdfjs.getDocument({ data: fileBytes }).promise;
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
};

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
    .map((page, idx) => {
      const chunks = page.chunks.slice();
      chunks.sort((a, b) => a.x + a.y - (b.x + b.y));
      return chunks.map((chunk, idx2) => ({
        page: idx,
        new_page: 0,
        name: `${idx}.${idx2}`,
        x: 0,
        y: 0,
        w: chunk.w,
        h: chunk.h,
        chunk,
      }));
    })
    .flat();

export const PAGE_SIZE = PageSizes.Letter;
const packBins = (chunks: PositionedChunk[]): PositionedChunk[] => {
  const pageShelves = [
    new ShelfPack(PAGE_SIZE[0] - PADDING, PAGE_SIZE[1] - PADDING),
  ];
  for (var i = 0; i < chunks.length; i++) {
    let j = 0;
    let found = false;
    chunks[i].w = chunks[i].chunk.w;
    chunks[i].h = chunks[i].chunk.h;
    while (j < pageShelves.length && !found) {
      const bin = pageShelves[j].packOne(
        chunks[i].w + PADDING,
        chunks[i].h + PADDING,
        i
      );
      if (bin !== null) {
        chunks[i].x = bin.x;
        chunks[i].y = PAGE_SIZE[1] - bin.y - bin.h;
        chunks[i].new_page = j;
        found = true;
      } else {
        j++;
      }
    }
    if (!found) {
      pageShelves.push(new ShelfPack(PAGE_SIZE[0], PAGE_SIZE[1]));
      let properSize = false;
      while (!properSize) {
        const bin = pageShelves[pageShelves.length - 1].packOne(
          chunks[i].w + PADDING,
          chunks[i].h + PADDING,
          i
        );
        if (bin) {
          chunks[i].x = bin.x;
          chunks[i].y = PAGE_SIZE[1] - bin.y - bin.h;
          properSize = true;
        } else {
          chunks[i].w *= 0.8;
          chunks[i].h *= 0.8;
        }
      }
      chunks[i].new_page = pageShelves.length - 1;
    }
  }
  chunks.sort((a, b) => a.new_page - b.new_page);
  return chunks;
};

const PADDING = 20;
export const generateLayout = async (doc: Doc): Promise<Layout> => {
  const exportedPdf = await PDFDocument.create();
  exportedPdf.catalog.getOrCreateViewerPreferences().setDuplex(Duplex.Simplex);
  exportedPdf.setTitle(`Printing of ${doc.pdfDocument.getTitle()}`);
  const font = exportedPdf.embedStandardFont(StandardFonts.CourierBold);
  const importedPdf = doc.pdfDocument;
  const chunks = packBins(flattenChunks(doc));

  let page = exportedPdf.addPage(PAGE_SIZE);
  let page_idx = 0;
  for (var i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const oldH = chunk.chunk.h / 2;
    const oldW = chunk.chunk.w / 2;
    const oldX = chunk.chunk.x / 2;
    const oldY = chunk.chunk.y / 2;
    const sourcePage = importedPdf.getPage(chunk.page);
    const clipBox = {
      left: oldX,
      right: oldX + oldW,
      bottom: sourcePage.getHeight() - (oldY + oldH),
      top: sourcePage.getHeight() - oldY,
    };
    const embedded = await exportedPdf.embedPage(sourcePage, clipBox);
    if (page_idx < chunk.new_page) {
      page = exportedPdf.addPage(PAGE_SIZE);
      page_idx++;
    }
    const labelWidth = 7 * chunk.name.length;
    page.drawRectangle({
      x: chunk.x + PADDING,
      y: chunk.y + PADDING / 2,
      width: chunk.w + labelWidth,
      height: chunk.h,
      opacity: 0,
      borderOpacity: 1,
      borderColor: rgb(0.5, 0.5, 0.5),
      borderWidth: 1,
    });
    page.drawPage(embedded, {
      width: chunk.w,
      height: chunk.h,
      x: chunk.x + PADDING,
      y: chunk.y + PADDING / 2,
    });
    page.drawRectangle({
      x: chunk.x + chunk.w + PADDING,
      y: chunk.y + 5 + PADDING / 2,
      width: labelWidth,
      height: 12,
      color: rgb(0.95, 0.95, 0.95),
    });
    page.drawText(chunk.name, {
      x: chunk.x + chunk.w + PADDING,
      y: chunk.y + 5 + PADDING / 2,
      font,
      size: 12,
      color: rgb(0.4, 0.4, 0.4),
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
