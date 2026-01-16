"use client";

import React, { useRef, useEffect, useState } from "react";
import { PDFDocument } from "pdf-lib";

interface PDFAnnotatorProps {
  pdfUrl: string;
  onSave: (pdfBlob: Blob) => void;
  title: string;
}

export function PDFAnnotator({ pdfUrl, onSave, title }: PDFAnnotatorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [context, setContext] = useState<CanvasRenderingContext2D | null>(null);
  const [pdfData, setPdfData] = useState<Uint8Array | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.5);
  const [isClient, setIsClient] = useState(false);

  // Ensure client-side only rendering
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Load PDF
  useEffect(() => {
    if (!isClient) return;
    
    const loadPdf = async () => {
      try {
        const response = await fetch(pdfUrl);
        const arrayBuffer = await response.arrayBuffer();
        const pdfDoc = await PDFDocument.load(arrayBuffer);
        setPdfData(new Uint8Array(arrayBuffer));
        setTotalPages(pdfDoc.getPageCount());
        
        // Render first page
        await renderPage(new Uint8Array(arrayBuffer), 1);
      } catch (error) {
        console.error("Error loading PDF:", error);
      }
    };

    if (pdfUrl) {
      loadPdf();
    }
  }, [pdfUrl, isClient]);

  // Render PDF page on canvas
  const renderPage = async (data: Uint8Array, pageNum: number) => {
    if (!canvasRef.current || typeof window === 'undefined') return;

    try {
      // Dynamically import pdfjs-dist only on client side
      const pdfjsLib = await import("pdfjs-dist");
      
      // Configure worker
      pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

      const loadingTask = pdfjsLib.getDocument({ data });
      const pdf = await loadingTask.promise;
      const page = await pdf.getPage(pageNum);

      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      
      if (!ctx) return;

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const renderContext = {
        canvasContext: ctx,
        viewport: viewport,
      };

      await page.render(renderContext).promise;
      setContext(ctx);
    } catch (error) {
      console.error("Error rendering page:", error);
    }
  };

  // Drawing functions
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!context) return;
    
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    context.beginPath();
    context.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !context) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    context.lineTo(x, y);
    context.strokeStyle = "#0000FF";
    context.lineWidth = 2;
    context.lineCap = "round";
    context.stroke();
  };

  const stopDrawing = () => {
    if (!context) return;
    context.closePath();
    setIsDrawing(false);
  };

  // Save annotated PDF
  const handleSave = async () => {
    if (!canvasRef.current || !pdfData) return;

    try {
      const canvas = canvasRef.current;
      
      // Convert canvas to blob
      canvas.toBlob(async (blob) => {
        if (!blob) return;

        // Create a new PDF with the annotated page as an image
        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage([canvas.width, canvas.height]);
        
        // Convert blob to array buffer
        const arrayBuffer = await blob.arrayBuffer();
        const pngImage = await pdfDoc.embedPng(arrayBuffer);
        
        page.drawImage(pngImage, {
          x: 0,
          y: 0,
          width: canvas.width,
          height: canvas.height,
        });

        const pdfBytes = await pdfDoc.save();
        const pdfBlob = new Blob([pdfBytes], { type: "application/pdf" });
        
        onSave(pdfBlob);
      }, "image/png");
    } catch (error) {
      console.error("Error saving PDF:", error);
    }
  };

  const clearAnnotations = async () => {
    if (pdfData) {
      await renderPage(pdfData, currentPage);
    }
  };

  // Don't render until client-side
  if (!isClient) {
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
            className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded"
          >
            Clear
          </button>
          <button
            onClick={handleSave}
            className="px-3 py-1 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded"
          >
            Save
          </button>
        </div>
      </div>

      <div className="border border-gray-300 rounded overflow-auto max-h-[600px]">
        <canvas
          ref={canvasRef}
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
            canvasRef.current?.dispatchEvent(mouseEvent);
          }}
          onTouchMove={(e) => {
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent("mousemove", {
              clientX: touch.clientX,
              clientY: touch.clientY,
            });
            canvasRef.current?.dispatchEvent(mouseEvent);
          }}
          onTouchEnd={() => {
            const mouseEvent = new MouseEvent("mouseup");
            canvasRef.current?.dispatchEvent(mouseEvent);
          }}
          className="cursor-crosshair"
          style={{ touchAction: "none" }}
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

      <p className="text-sm text-gray-600">
        Use your mouse or stylus to draw on the PDF. Touch support enabled for tablets.
      </p>
    </div>
  );
}
