import React, { useState, useEffect, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const PDFViewer = ({ fileUrl, onClose }) => {
  const [numPages, setNumPages] = useState(null);
  const [containerWidth, setContainerWidth] = useState(window.innerWidth);

  useEffect(() => {
    const handleResize = () => setContainerWidth(window.innerWidth);
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

  useEffect(() => {
    const style = document.createElement('style');
    style.id = 'pdf-viewer-canvas-fix';
    style.textContent = `.react-pdf__Page__canvas { max-width: 100% !important; height: auto !important; }`;
    document.head.appendChild(style);
    return () => {
      const el = document.getElementById('pdf-viewer-canvas-fix');
      if (el) el.remove();
    };
  }, []);

  const onLoadSuccess = ({ numPages }) => setNumPages(numPages);

  return (
    <div
      className="fixed inset-0 bg-slate-900 z-50 flex flex-col w-full h-full"
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

      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 w-full flex flex-col items-center justify-start scroll-smooth">
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
          {numPages && Array.from({ length: numPages }, (_, i) => (
            <Page
              key={i}
              pageNumber={i + 1}
              width={containerWidth - 32}
              renderTextLayer={true}
              renderAnnotationLayer={false}
              className="shadow-xl rounded my-2 mx-auto max-w-full"
            />
          ))}
        </Document>
      </div>
    </div>
  );
};

export default PDFViewer;
