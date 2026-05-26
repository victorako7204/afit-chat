import React, { useState, useEffect, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const PDFViewer = ({ fileUrl, onClose }) => {
  const [numPages, setNumPages] = useState(null);
  const [containerWidth, setContainerWidth] = useState(window.innerWidth);
  const [scale, setScale] = useState(1.0);

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
    style.textContent = `.react-pdf__Page__canvas { max-width: none !important; height: auto !important; margin: 0 auto; } .react-pdf__Page__textLayer { display: none !important; }`;
    document.head.appendChild(style);
    return () => {
      const el = document.getElementById('pdf-viewer-canvas-fix');
      if (el) el.remove();
    };
  }, []);

  const onLoadSuccess = ({ numPages }) => setNumPages(numPages);

  return (
    <div
      className="fixed inset-0 bg-slate-950 z-50 flex flex-col w-screen h-screen"
      onContextMenu={handleContextMenu}
    >
      <div className="flex items-center justify-between px-3 py-2 bg-slate-900/80 backdrop-blur-sm">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 text-white/80 text-sm hover:text-white transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Library
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setScale(prev => Math.max(prev - 0.2, 0.7))}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 text-white text-xs hover:bg-white/20 transition-colors"
            aria-label="Zoom Out"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
          <span className="text-white/70 text-xs font-mono w-10 text-center">{Math.round(scale * 100)}%</span>
          <button
            onClick={() => setScale(prev => Math.min(prev + 0.2, 2.5))}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 text-white text-xs hover:bg-white/20 transition-colors"
            aria-label="Zoom In"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
          <button
            onClick={() => setScale(1.0)}
            className="px-2.5 py-1 text-xs font-medium text-white bg-white/10 rounded hover:bg-white/20 transition-colors"
          >
            Reset
          </button>
          {numPages && (
            <span className="text-white/40 text-xs ml-1">{numPages} p.</span>
          )}
        </div>
      </div>

      <div className="flex-1 w-full h-full flex flex-col items-center overflow-x-auto overflow-y-auto [webkit-overflow-scrolling:touch]">
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
              width={Math.min(containerWidth - 32, 800) * scale}
              renderTextLayer={true}
              renderAnnotationLayer={false}
              className="shadow-2xl rounded-sm border border-slate-800/80 my-3 transition-transform duration-150 ease-out max-w-none"
            />
          ))}
        </Document>
      </div>
    </div>
  );
};

export default PDFViewer;
