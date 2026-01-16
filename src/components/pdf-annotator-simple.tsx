"use client";

import React, { useRef, useEffect, useState } from "react";
import { PDFDocument, rgb } from "pdf-lib";

interface PDFAnnotatorProps {
  pdfUrl: string;
  onSave: (pdfBlob: Blob) => void;
  title: string;
}

export function PDFAnnotator({ pdfUrl, onSave, title }: PDFAnnotatorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [pdfData, setPdfData] = useState<ArrayBuffer | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale] = useState(1.5);
  const [isClient, setIsClient] = useState(false);
  const [pdfLib, setPdfLib] = useState<any>(null);

  // Ensure client-side only
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Load PDF.js library dynamically
  useEffect(() => {
    if (!isClient) return;

    const loadPdfJs = async () => {
      try {
        const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf");
        pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
        setPdfLib(pdfjsLib);
      } catch (error) {
        console.error("Error loading PDF.js:", error);
      }
    };

    loadPdfJs();
  }, [isClient]);

  // Load PDF file
  useEffect(() => {
    if (!isClient || !pdfLib || !pdfUrl) return;

    const loadPdf = async () => {
      try {
        const response = await fetch(pdfUrl);
        const arrayBuffer = await response.arrayBuffer();
        
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        setPdfData(arrayBuffer);
        setTotalPages(pdfDoc.getPageCount());
        
        // Render first page
        await renderPage(arrayBuffer, 1);
      } catch (error) {
        console.error("Error loading PDF:", error);
      }
    };

    loadPdf();
  }, [pdfUrl, isClient, pdfLib]);

  // Render PDF page
  const renderPage = async (data: ArrayBuffer, pageNum: number) => {
    if (!canvasRef.current || !overlayCanvasRef.current || !pdfLib) return;

    try {
      const loadingTask = pdfLib.getDocument({ data });
      const pdf = await loadingTask.promise;
      const page = await pdf.getPage(pageNum);

      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      
      if (!ctx) return;

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      // Setup overlay canvas
      const overlayCanvas = overlayCanvasRef.current;
      overlayCanvas.height = viewport.height;
      overlayCanvas.width = viewport.width;

      const renderContext = {
        canvasContext: ctx,
        viewport: viewport,
      };

      await page.render(renderContext).promise;
    } catch (error) {
      console.error("Error rendering page:", error);
    }
  };

  // Drawing functions
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.strokeStyle = "#0000ff";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const canvas = overlayCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  // Save annotated PDF
  const handleSave = async () => {
    if (!pdfData || !canvasRef.current || !overlayCanvasRef.current) return;

    try {
      const pdfDoc = await PDFDocument.load(pdfData);
      
      // Get overlay canvas as image
      const overlayCanvas = overlayCanvasRef.current;
      const imageDataUrl = overlayCanvas.toDataURL("image/png");
      const imageBytes = await fetch(imageDataUrl).then(res => res.arrayBuffer());
      const image = await pdfDoc.embedPng(imageBytes);
      
      const pages = pdfDoc.getPages();
      const page = pages[currentPage - 1];
      
      const { width, height } = page.getSize();
      page.drawImage(image, {
        x: 0,
        y: 0,
        width: width,
        height: height,
      });

      const pdfBytes = await pdfDoc.save();
      const pdfBlob = new Blob([pdfBytes], { type: "application/pdf" });
      
      onSave(pdfBlob);
    } catch (error) {
      console.error("Error saving PDF:", error);
    }
  };

  const clearAnnotations = () => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  // Don't render until client-side
  if (!isClient || !pdfLib) {
    return (
      <div className="flex flex-col space-y-4">
        <div className="text-center py-8">Loading PDF viewer...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">{title}</h3>
        <div className="flex gap-2">
          <button
            onClick={clearAnnotations}
            className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm"
          >
            Clear
          </button>
          <button
            onClick={handleSave}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
          >
            Save
          </button>
        </div>
      </div>

      <div className="relative border border-gray-300 overflow-auto max-h-[600px]">
        <canvas ref={canvasRef} className="absolute top-0 left-0" />
        <canvas
          ref={overlayCanvasRef}
          className="absolute top-0 left-0 cursor-crosshair"
          style={{ touchAction: "none" }}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={(e) => {
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent("mousedown", {
              clientX: touch.clientX,
              clientY: touch.clientY,
            });
            overlayCanvasRef.current?.dispatchEvent(mouseEvent);
          }}
          onTouchMove={(e) => {
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent("mousemove", {
              clientX: touch.clientX,
              clientY: touch.clientY,
            });
            overlayCanvasRef.current?.dispatchEvent(mouseEvent);
          }}
          onTouchEnd={() => {
            const mouseEvent = new MouseEvent("mouseup");
            overlayCanvasRef.current?.dispatchEvent(mouseEvent);
          }}
        />
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-4">
          <button
            onClick={async () => {
              if (currentPage > 1 && pdfData) {
                const newPage = currentPage - 1;
                setCurrentPage(newPage);
                await renderPage(pdfData, newPage);
              }
            }}
            disabled={currentPage <= 1}
            className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded disabled:opacity-50"
          >
            Previous
          </button>
          <span>
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={async () => {
              if (currentPage < totalPages && pdfData) {
                const newPage = currentPage + 1;
                setCurrentPage(newPage);
                await renderPage(pdfData, newPage);
              }
            }}
            disabled={currentPage >= totalPages}
            className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
