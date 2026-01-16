"use client";

import React, { useRef, useState } from "react";

interface PDFAnnotatorProps {
  pdfUrl: string;
  onSave: (pdfBlob: Blob) => void;
  title: string;
}

export function PDFAnnotator({ pdfUrl, onSave, title }: PDFAnnotatorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === "application/pdf") {
      setUploadedFile(file);
    }
  };

  const handleSave = () => {
    if (uploadedFile) {
      onSave(uploadedFile);
    }
  };

  const handleDownload = () => {
    // Create a download link for the template
    const link = document.createElement("a");
    link.href = pdfUrl;
    link.download = `${title.replace(/\s+/g, "_")}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">{title}</h3>
        <button
          onClick={handleDownload}
          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
        >
          Download Template
        </button>
      </div>

      <div 
        className="relative border border-gray-300 overflow-hidden"
        style={{ height: "600px", width: "100%" }}
      >
        {/* PDF Display using browser's native viewer with annotation tools */}
        <iframe
          src={pdfUrl}
          className="w-full h-full"
          style={{ border: "none" }}
        />
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded p-4">
        <h4 className="font-semibold text-blue-900 mb-2">How to annotate:</h4>
        <ol className="list-decimal list-inside text-sm text-blue-800 space-y-1">
          <li>Click "Download Template" to save the PDF to your device</li>
          <li>Open the downloaded PDF with your preferred PDF app (Adobe, Preview, etc.)</li>
          <li>Use the app's annotation tools to mark up the document</li>
          <li>Save the annotated PDF</li>
          <li>Upload the annotated version using the button below</li>
        </ol>
      </div>

      <div className="flex items-center gap-4">
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          onChange={handleFileSelect}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded text-sm"
        >
          Upload Annotated PDF
        </button>
        {uploadedFile && (
          <>
            <span className="text-sm text-green-600">✓ {uploadedFile.name}</span>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm"
            >
              Save
            </button>
          </>
        )}
      </div>
    </div>
  );
}
