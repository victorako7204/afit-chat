import React, { useState, useEffect, useCallback, memo } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { List, useListRef } from 'react-window';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const PageRow = memo(({ index, style, data }) => (
  <div style={style} className="flex justify-center py-1">
    <Page
      pageNumber={index + 1}
      width={data}
      renderTextLayer={false}
      renderAnnotationLayer={false}
      className="shadow-lg"
    />
  </div>
));

const PDFViewer = ({ fileUrl, onClose }) => {
  const [numPages, setNumPages] = useState(null);
  const [pageWidth, setPageWidth] = useState(window.innerWidth - 32);
  const listRef = useListRef();

  useEffect(() => {
    const handleResize = () => setPageWidth(window.innerWidth - 32);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleContextMenu = useCallback((e) => e.preventDefault(), []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const style = document.createElement('style');
    style.id = 'pdf-viewer-print-hide';
    style.textContent = `@media print { body { display: none !important; } }`;
    document.head.appendChild(style);
    return () => {
      const el = document.getElementById('pdf-viewer-print-hide');
      if (el) el.remove();
    };
  }, []);

  const onLoadSuccess = ({ numPages }) => setNumPages(numPages);

  return (
    <div
      className="fixed inset-0 bg-slate-900 z-50 flex flex-col"
      onContextMenu={handleContextMenu}
    >
      <button
        onClick={onClose}
        className="absolute top-4 left-4 z-10 w-10 h-10 flex items-center justify-center rounded-full bg-white/20 backdrop-blur-sm text-white hover:bg-white/30 transition-colors"
        aria-label="Close PDF Viewer"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <div className="absolute top-4 right-4 z-10 text-white/50 text-xs bg-black/30 rounded-full px-3 py-1">
        {numPages ? `${numPages} page${numPages > 1 ? 's' : ''}` : ''}
      </div>

      <div className="flex-1">
        <Document
          file={fileUrl}
          onLoadSuccess={onLoadSuccess}
          loading={
            <div className="flex items-center justify-center h-full">
              <div className="text-white/60 text-sm animate-pulse">Loading PDF...</div>
            </div>
          }
          error={
            <div className="flex items-center justify-center h-full">
              <div className="text-red-400 text-sm">Failed to load PDF</div>
            </div>
          }
        >
          {numPages && (
            <List
              listRef={listRef}
              className="h-full w-full"
              defaultHeight={window.innerHeight}
              rowCount={numPages}
              rowHeight={pageWidth * 1.4}
              rowComponent={PageRow}
              rowProps={pageWidth}
              overscanCount={1}
            />
          )}
        </Document>
      </div>
    </div>
  );
};

export default PDFViewer;
