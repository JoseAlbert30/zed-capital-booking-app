"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  AlertCircle,
  FileText,
  Download,
  Upload,
  Check,
  ChevronDown,
  CalendarCheck,
  ImageIcon,
  Trash2,
  Eye,
  ArrowLeft,
  Save,
  Zap
} from "lucide-react";
import { DeclarationPreviewDialog } from "@/components/DeclarationPreviewDialog";
import { HandoverChecklistPreviewDialog } from "@/components/HandoverChecklistPreviewDialog";
import {
  getBooking,
  uploadHandoverFile,
  deleteHandoverFile,
  completeHandover,
  createSnaggingDefect,
  updateSnaggingDefect,
  deleteSnaggingDefect,
  getSnaggingDefects,
  downloadServiceChargeAcknowledgement
} from "@/lib/api";

interface SnaggingDefect {
  id: string;
  serverId?: number;
  imageFile: File | null;
  imagePreview: string | null;
  description: string;
  location: string;
  agreedRemediationAction: string;
  is_remediated?: boolean;
}

export default function HandoverCompletionPage() {
  const router = useRouter();
  const params = useParams();
  const bookingId = params.id as string;
  
  const [authToken, setAuthToken] = useState<string>("");
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Document states
  const [handoverChecklistTemplate, setHandoverChecklistTemplate] = useState<string | null>(null);
  const [declarationTemplate, setDeclarationTemplate] = useState<string | null>(null);
  const [annotatedChecklist, setAnnotatedChecklist] = useState<File | null>(null);
  const [annotatedDeclaration, setAnnotatedDeclaration] = useState<File | null>(null);
  const [handoverChecklistPreview, setHandoverChecklistPreview] = useState<string | null>(null);
  const [handoverDeclarationPreview, setHandoverDeclarationPreview] = useState<string | null>(null);
  
  // Photo states
  const [handoverPhoto, setHandoverPhoto] = useState<File | null>(null);
  const [handoverPhotoPreview, setHandoverPhotoPreview] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Signature states - Multiple owners can sign
  const [ownerSignatures, setOwnerSignatures] = useState<Record<string, { name: string; image: string | null; ownerName: string }>>({});
  const [drawingStates, setDrawingStates] = useState<Record<string, boolean>>({});
  const signatureCanvasRefs = useRef<Record<string, HTMLCanvasElement | null>>({});
  
  // Snagging states
  const [snaggingDefects, setSnaggingDefects] = useState<SnaggingDefect[]>([]);
  const [expandedDefects, setExpandedDefects] = useState<Set<string>>(new Set());
  const [showSnaggingCamera, setShowSnaggingCamera] = useState(false);
  const [currentSnaggingDefectId, setCurrentSnaggingDefectId] = useState<string | null>(null);
  const [updatingDefectId, setUpdatingDefectId] = useState<number | null>(null);
  const snaggingVideoRef = useRef<HTMLVideoElement>(null);
  const snaggingCanvasRef = useRef<HTMLCanvasElement>(null);
  
  const [completingHandover, setCompletingHandover] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [showDeclarationDialog, setShowDeclarationDialog] = useState(false);
  const [showChecklistDialog, setShowChecklistDialog] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("authToken");
    if (!token) {
      router.push("/");
      return;
    }
    setAuthToken(token);
    fetchBookingDetails(token);
    loadTemplates();
  }, [bookingId]);

  const fetchBookingDetails = async (token: string) => {
    try {
      const data = await getBooking(Number(bookingId), token);
      setBooking(data);
      
      // Load existing files if any
      if (data.handover_checklist) {
        setHandoverChecklistPreview(`${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '')}/storage/${data.handover_checklist}`);
      }
      if (data.handover_declaration) {
        setHandoverDeclarationPreview(`${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '')}/storage/${data.handover_declaration}`);
      }
      if (data.handover_photo) {
        setHandoverPhotoPreview(`${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '')}/storage/${data.handover_photo}`);
      }
      
      // Initialize owner signatures
      const allOwners = [];
      if (data.user) {
        allOwners.push({ id: data.user.id, name: data.user.full_name, isPrimary: true });
      }
      if (data.unit?.users && Array.isArray(data.unit.users)) {
        data.unit.users.forEach((unitUser: any) => {
          if (unitUser.id !== data.user?.id) {
            allOwners.push({ id: unitUser.id, name: unitUser.full_name || unitUser.name, isPrimary: false });
          }
        });
      }
      
      const initSignatures: Record<string, { name: string; image: string | null; ownerName: string }> = {};
      allOwners.forEach(owner => {
        initSignatures[owner.id] = { name: '', image: null, ownerName: owner.name };
      });
      
      // Load existing signature if available
      if (data.client_signature) {
        const signatureUrl = `${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '')}/storage/${data.client_signature}`;
        // For now, just show that a signature exists by setting the preview
        // The actual signature image will be displayed from the URL
        const primaryOwnerId = data.user?.id?.toString();
        if (primaryOwnerId && initSignatures[primaryOwnerId]) {
          initSignatures[primaryOwnerId] = {
            ...initSignatures[primaryOwnerId],
            image: signatureUrl,
            name: data.user?.full_name || ''
          };
        }
      }
      
      setOwnerSignatures(initSignatures);
      
      // Load snagging defects
      await loadSnaggingDefects(token);
    } catch (error) {
      console.error("Failed to fetch booking:", error);
      toast.error("Failed to load booking details");
    } finally {
      setLoading(false);
    }
  };

  const loadSnaggingDefects = async (token: string) => {
    try {
      const defects = await getSnaggingDefects(Number(bookingId), token);
      const formattedDefects = defects.map((defect: any) => ({
        id: `server-${defect.id}`,
        serverId: defect.id,
        imageFile: null,
        imagePreview: defect.image_url,
        description: defect.description,
        location: defect.location,
        agreedRemediationAction: defect.agreed_remediation_action,
        is_remediated: defect.is_remediated || false
      }));
      setSnaggingDefects(formattedDefects);
    } catch (error) {
      console.error("Failed to load snagging defects:", error);
    }
  };

  const loadTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || '';
      setHandoverChecklistTemplate(`${apiBaseUrl}/storage/handover-templates/Handover Checklist.pdf`);
      setDeclarationTemplate(`${apiBaseUrl}/storage/handover-templates/DECLARATION V3.pdf`);
    } catch (error) {
      console.error("Failed to load templates:", error);
      toast.error("Failed to load document templates");
    } finally {
      setLoadingTemplates(false);
    }
  };

  // Snagging functions
  const addSnaggingDefect = () => {
    const newDefect: SnaggingDefect = {
      id: `temp-${Date.now()}`,
      imageFile: null,
      imagePreview: null,
      description: "",
      location: "",
      agreedRemediationAction: ""
    };
    setSnaggingDefects([...snaggingDefects, newDefect]);
    setExpandedDefects(new Set([...expandedDefects, newDefect.id]));
  };

  const removeSnaggingDefect = async (id: string) => {
    const defect = snaggingDefects.find(d => d.id === id);
    if (defect?.serverId) {
      try {
        await deleteSnaggingDefect(Number(bookingId), defect.serverId, authToken);
        toast.success("Defect deleted");
      } catch (error) {
        toast.error("Failed to delete defect");
        return;
      }
    }
    setSnaggingDefects(snaggingDefects.filter(d => d.id !== id));
    const newExpanded = new Set(expandedDefects);
    newExpanded.delete(id);
    setExpandedDefects(newExpanded);
  };

  const updateSnaggingDefectImage = async (id: string, file: File, preview: string) => {
    const defect = snaggingDefects.find(d => d.id === id);
    if (!defect) return;

    setSnaggingDefects(snaggingDefects.map(d => 
      d.id === id ? { ...d, imageFile: file, imagePreview: preview } : d
    ));

    // If defect has minimal info, save it immediately
    if (file && defect.description) {
      try {
        const response = await createSnaggingDefect(
          Number(bookingId),
          file,
          defect.description,
          defect.location,
          defect.agreedRemediationAction,
          authToken
        );
        
        setSnaggingDefects(snaggingDefects.map(d =>
          d.id === id ? { ...d, serverId: response.defect.id, imagePreview: response.defect.image_url } : d
        ));
        
        toast.success("Defect saved");
      } catch (error) {
        toast.error("Failed to save defect");
      }
    }
  };

  const updateSnaggingDefectDescription = (id: string, description: string) => {
    setSnaggingDefects(snaggingDefects.map(d => 
      d.id === id ? { ...d, description } : d
    ));
  };

  const updateSnaggingDefectLocation = (id: string, location: string) => {
    setSnaggingDefects(snaggingDefects.map(d => 
      d.id === id ? { ...d, location } : d
    ));
  };

  const updateSnaggingDefectRemediation = (id: string, agreedRemediationAction: string) => {
    setSnaggingDefects(snaggingDefects.map(d => 
      d.id === id ? { ...d, agreedRemediationAction } : d
    ));
  };

  const saveSnaggingDefectDetails = async (id: string) => {
    const defect = snaggingDefects.find(d => d.id === id);
    if (!defect) return;

    if (!defect.serverId) {
      if (!defect.imageFile) {
        toast.error("Please add a photo first");
        return;
      }
      try {
        const response = await createSnaggingDefect(
          Number(bookingId),
          defect.imageFile,
          defect.description,
          defect.location,
          defect.agreedRemediationAction,
          authToken
        );
        setSnaggingDefects(snaggingDefects.map(d =>
          d.id === id ? { ...d, serverId: response.defect.id } : d
        ));
        toast.success("Defect saved");
      } catch (error) {
        toast.error("Failed to save defect");
      }
    } else {
      try {
        await updateSnaggingDefect(
          Number(bookingId),
          defect.serverId,
          defect.description,
          defect.location,
          defect.agreedRemediationAction,
          authToken
        );
        toast.success("Defect updated");
        
        // Collapse the defect
        const newExpanded = new Set(expandedDefects);
        newExpanded.delete(id);
        setExpandedDefects(newExpanded);
      } catch (error) {
        toast.error("Failed to update defect");
      }
    }
  };

  const toggleDefectExpanded = (id: string) => {
    const newExpanded = new Set(expandedDefects);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedDefects(newExpanded);
  };

  const handleMarkAsResolved = async (defectId: number) => {
    const defect = snaggingDefects.find(d => d.serverId === defectId);
    if (!defect) return;

    setUpdatingDefectId(defectId);
    try {
      await updateSnaggingDefect(
        Number(bookingId),
        defectId,
        defect.description,
        defect.location,
        defect.agreedRemediationAction,
        authToken,
        true // Mark as remediated
      );
      
      // Update local state
      setSnaggingDefects(prev => prev.map(d => 
        d.serverId === defectId ? { ...d, is_remediated: true } : d
      ));
      
      toast.success("Defect marked as resolved!");
    } catch (error) {
      console.error("Failed to mark defect as resolved:", error);
      toast.error("Failed to update defect status");
    } finally {
      setUpdatingDefectId(null);
    }
  };

  // Camera functions for snagging
  const startSnaggingCamera = async (defectId: string) => {
    setCurrentSnaggingDefectId(defectId);
    setShowSnaggingCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      if (snaggingVideoRef.current) {
        snaggingVideoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error("Camera access denied:", error);
      toast.error("Camera access denied");
      setShowSnaggingCamera(false);
    }
  };

  const stopSnaggingCamera = () => {
    if (snaggingVideoRef.current?.srcObject) {
      const tracks = (snaggingVideoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
    }
    setShowSnaggingCamera(false);
    setCurrentSnaggingDefectId(null);
  };

  const captureSnaggingPhoto = async () => {
    const video = snaggingVideoRef.current;
    const canvas = snaggingCanvasRef.current;
    
    if (!video || !canvas || !currentSnaggingDefectId) return;
    
    const context = canvas.getContext('2d');
    if (!context) return;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0);
    
    canvas.toBlob(async (blob) => {
      if (blob) {
        const file = new File([blob], 'snagging-photo.jpg', { type: 'image/jpeg' });
        const preview = canvas.toDataURL('image/jpeg');
        await updateSnaggingDefectImage(currentSnaggingDefectId, file, preview);
        stopSnaggingCamera();
        toast.success("Photo captured!");
      }
    }, 'image/jpeg', 0.95);
  };

  // Camera functions for handover photo
  const startCamera = async () => {
    setShowCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error("Camera access denied:", error);
      toast.error("Camera access denied");
      setShowCamera(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
    }
    setShowCamera(false);
  };

  const capturePhoto = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (!video || !canvas) return;
    
    const context = canvas.getContext('2d');
    if (!context) return;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0);
    
    canvas.toBlob(async (blob) => {
      if (blob) {
        const file = new File([blob], 'handover-photo.jpg', { type: 'image/jpeg' });
        try {
          await uploadHandoverFile(Number(bookingId), 'handover_photo', file, authToken);
          setHandoverPhoto(file);
          setHandoverPhotoPreview(canvas.toDataURL('image/jpeg'));
          stopCamera();
          toast.success("Photo uploaded!");
        } catch (error) {
          console.error("Upload error:", error);
          toast.error("Failed to upload photo");
        }
      }
    }, 'image/jpeg', 0.95);
  };

  const handleDeclarationGenerated = async (pdfBlob: Blob, filename: string) => {
    try {
      const file = new File([pdfBlob], filename, { type: "application/pdf" });
      await uploadHandoverFile(Number(bookingId), 'handover_declaration', file, authToken);
      setAnnotatedDeclaration(file);
      setHandoverDeclarationPreview(URL.createObjectURL(file));
      toast.success("Declaration generated and uploaded successfully!");
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload generated declaration");
    }
  };

  const handleCompleteHandover = async () => {
    if (!handoverChecklistPreview) {
      toast.error("Please upload the handover checklist");
      return;
    }
    
    if (!handoverDeclarationPreview) {
      toast.error("Please upload the declaration");
      return;
    }
    
    if (!handoverPhotoPreview) {
      toast.error("Please upload a handover photo");
      return;
    }
    
    // Check if at least one owner has signed
    const validSignatures = Object.values(ownerSignatures).filter(sig => sig.name.trim() && sig.image);
    if (validSignatures.length === 0) {
      toast.error("At least one owner must sign the handover acknowledgement");
      return;
    }
    
    setCompletingHandover(true);
    try {
      await completeHandover(Number(bookingId), authToken);
      toast.success("Handover completed successfully!");
      router.push("/admin");
    } catch (error) {
      console.error("Failed to complete handover:", error);
      toast.error("Failed to complete handover");
    } finally {
      setCompletingHandover(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-red-600">Booking not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => router.push("/admin")}
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Complete Handover</h1>
              <p className="text-gray-600">
                {format(new Date(booking.booked_date), "EEEE, MMMM d, yyyy")} at {booking.booked_time} • {(() => {
                  const unit = booking.user?.units?.find((u: any) => u.id === booking.unit_id);
                  return unit ? `${unit.property?.project_name} • Unit ${unit.unit}` : 'N/A';
                })()}
              </p>
            </div>
          </div>
          <Button
            onClick={handleCompleteHandover}
            disabled={completingHandover || !handoverChecklistPreview || !handoverDeclarationPreview || !handoverPhotoPreview || Object.values(ownerSignatures).filter(sig => sig.name.trim() && sig.image).length === 0}
            className="bg-green-600 hover:bg-green-700 text-white"
            size="lg"
          >
            <Save className="w-5 h-5 mr-2" />
            {completingHandover ? "Completing..." : "Complete Handover"}
          </Button>
        </div>

        {/* Validation Warning */}
        {(!handoverChecklistPreview || !handoverDeclarationPreview || !handoverPhotoPreview || Object.values(ownerSignatures).filter(sig => sig.name.trim() && sig.image).length === 0) && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-800 font-medium">
              ⚠️ Please complete all required sections before finalizing the handover
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Snagging List */}
            <Card>
              <CardHeader className="bg-gradient-to-r from-red-50 to-rose-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="w-6 h-6 text-red-600" />
                    <div>
                      <CardTitle className="text-xl">Snagging List</CardTitle>
                      <CardDescription>Document all defects with photos & descriptions</CardDescription>
                    </div>
                  </div>
                  {snaggingDefects.length > 0 && (
                    <Badge variant="secondary" className="text-base px-3 py-1">
                      {snaggingDefects.length} defect{snaggingDefects.length !== 1 ? 's' : ''}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  {snaggingDefects.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <AlertCircle className="w-16 h-16 mx-auto mb-3 text-gray-300" />
                      <p className="font-medium">No defects added yet</p>
                      <p className="text-sm text-gray-400 mt-1">Click "Add Defect" to document issues</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {snaggingDefects.map((defect, index) => {
                        const isExpanded = expandedDefects.has(defect.id);
                        return (
                          <Collapsible 
                            key={defect.id}
                            open={isExpanded}
                            onOpenChange={() => toggleDefectExpanded(defect.id)}
                            className="border rounded-lg overflow-hidden"
                          >
                            <CollapsibleTrigger className="w-full">
                              <div className="flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors">
                                <div className="flex items-center gap-3 flex-1 text-left">
                                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                                    <span className="text-sm font-bold text-red-600">#{index + 1}</span>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <p className="font-medium text-gray-900 truncate">
                                        {defect.description || 'No description'}
                                      </p>
                                      {defect.is_remediated && (
                                        <Badge className="bg-green-100 text-green-700 hover:bg-green-100 flex-shrink-0">
                                          <Check className="w-3 h-3 mr-1" />
                                          Resolved
                                        </Badge>
                                      )}
                                    </div>
                                    {defect.location && (
                                      <p className="text-sm text-gray-500 truncate">📍 {defect.location}</p>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  {defect.imagePreview && (
                                    <div className="w-12 h-12 rounded border border-gray-200 overflow-hidden flex-shrink-0">
                                      <img 
                                        src={defect.imagePreview} 
                                        alt={`Defect ${index + 1}`}
                                        className="w-full h-full object-cover"
                                      />
                                    </div>
                                  )}
                                  <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                </div>
                              </div>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <div className="p-4 bg-white space-y-4 border-t">
                                <div className="flex justify-end">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      removeSnaggingDefect(defect.id);
                                    }}
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                  >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Delete
                                  </Button>
                                </div>
                                
                                {/* Image Upload/Capture */}
                                <div>
                                  <label className="text-sm font-medium text-gray-700 mb-2 block">Photo Evidence</label>
                                  {defect.imagePreview ? (
                                    <div className="space-y-2">
                                      <div className="border rounded-lg overflow-hidden bg-white">
                                        <img 
                                          src={defect.imagePreview} 
                                          alt={`Defect ${index + 1}`}
                                          className="w-full h-64 object-cover"
                                        />
                                      </div>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => updateSnaggingDefectImage(defect.id, null as any, null as any)}
                                        className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
                                      >
                                        <Trash2 className="w-4 h-4 mr-2" />
                                        Remove Photo
                                      </Button>
                                    </div>
                                  ) : (
                                    <div className="grid grid-cols-2 gap-2">
                                      <Button
                                        variant="outline"
                                        onClick={() => startSnaggingCamera(defect.id)}
                                        className="h-24 flex flex-col gap-2 border-dashed border-2 hover:border-red-500 hover:bg-red-50"
                                      >
                                        <CalendarCheck className="w-6 h-6 text-red-600" />
                                        <span className="text-sm font-medium">Take Photo</span>
                                      </Button>
                                      <div>
                                        <input
                                          type="file"
                                          accept="image/*"
                                          onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                              const reader = new FileReader();
                                              reader.onloadend = () => {
                                                updateSnaggingDefectImage(defect.id, file, reader.result as string);
                                              };
                                              reader.readAsDataURL(file);
                                            }
                                            e.target.value = '';
                                          }}
                                          className="hidden"
                                          id={`snagging-upload-${defect.id}`}
                                        />
                                        <label htmlFor={`snagging-upload-${defect.id}`}>
                                          <Button 
                                            variant="outline"
                                            asChild 
                                            className="w-full h-24 flex flex-col gap-2 border-dashed border-2 hover:border-red-500 hover:bg-red-50"
                                          >
                                            <span>
                                              <Upload className="w-6 h-6 text-gray-600" />
                                              <span className="text-sm font-medium">Upload Photo</span>
                                            </span>
                                          </Button>
                                        </label>
                                      </div>
                                    </div>
                                  )}
                                </div>

                                {/* Description */}
                                <div>
                                  <label className="text-sm font-medium text-gray-700 mb-2 block">Defect</label>
                                  <textarea
                                    value={defect.description}
                                    onChange={(e) => updateSnaggingDefectDescription(defect.id, e.target.value)}
                                    placeholder="Describe the defect in detail..."
                                    className="w-full min-h-[100px] px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                                  />
                                </div>

                                {/* Location */}
                                <div>
                                  <label className="text-sm font-medium text-gray-700 mb-2 block">Location</label>
                                  <input
                                    type="text"
                                    value={defect.location}
                                    onChange={(e) => updateSnaggingDefectLocation(defect.id, e.target.value)}
                                    placeholder="e.g., Living Room, Bedroom 1, Kitchen..."
                                    className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                                  />
                                </div>

                                {/* Agreed Remediation Action */}
                                <div>
                                  <label className="text-sm font-medium text-gray-700 mb-2 block">Agreed Remediation Action</label>
                                  <textarea
                                    value={defect.agreedRemediationAction}
                                    onChange={(e) => updateSnaggingDefectRemediation(defect.id, e.target.value)}
                                    placeholder="What action will be taken to fix this defect..."
                                    className="w-full min-h-[80px] px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                                  />
                                </div>

                                {/* Mark as Resolved Button */}
                                {defect.serverId && !defect.is_remediated && (
                                  <Button
                                    onClick={() => handleMarkAsResolved(defect.serverId!)}
                                    disabled={updatingDefectId === defect.serverId}
                                    className="w-full bg-green-600 hover:bg-green-700 text-white"
                                  >
                                    {updatingDefectId === defect.serverId ? (
                                      <>
                                        <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        Updating...
                                      </>
                                    ) : (
                                      <>
                                        <Check className="w-4 h-4 mr-2" />
                                        Mark as Resolved
                                      </>
                                    )}
                                  </Button>
                                )}

                                {/* Save Button */}
                                <Button
                                  onClick={async () => {
                                    if (defect.serverId) {
                                      // Update existing defect
                                      await saveSnaggingDefectDetails(defect.id);
                                    } else {
                                      // Create new defect
                                      const result = await createSnaggingDefect(
                                        Number(bookingId),
                                        defect.imageFile || null,
                                        defect.description || '',
                                        defect.location || '',
                                        defect.agreedRemediationAction || '',
                                        authToken
                                      );
                                      setSnaggingDefects(prev => prev.map(d => 
                                        d.id === defect.id ? { ...d, serverId: result.defect.id } : d
                                      ));
                                      toast.success("Defect saved!");
                                      setExpandedDefects(prev => {
                                        const newSet = new Set(prev);
                                        newSet.delete(defect.id);
                                        return newSet;
                                      });
                                    }
                                  }}
                                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                                >
                                  <Check className="w-4 h-4 mr-2" />
                                  {defect.serverId ? 'Update Details' : 'Save Defect'}
                                </Button>
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        );
                      })}
                    </div>
                  )}
                  
                  <Button
                    onClick={addSnaggingDefect}
                    className="w-full bg-red-600 hover:bg-red-700 text-white"
                    size="lg"
                  >
                    <AlertCircle className="w-5 h-5 mr-2" />
                    Add Defect
                  </Button>

                  <Button
                    onClick={async () => {
                      // Reload defects from server to get latest data with correct image URLs
                      await loadSnaggingDefects(authToken);
                      setShowDeclarationDialog(true);
                    }}
                    className="w-full bg-amber-600 hover:bg-amber-700 text-white"
                    size="lg"
                  >
                    <Zap className="w-5 h-5 mr-2" />
                    Generate Declaration
                  </Button>

                  {/* Declaration Preview Section */}
                  {handoverDeclarationPreview && (
                    <div className="border rounded-lg overflow-hidden mt-4">
                      <div className="p-3 bg-purple-50 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-purple-600" />
                          <span className="text-sm font-medium text-gray-700">Declaration</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={async () => {
                            try {
                              await deleteHandoverFile(Number(bookingId), 'handover_declaration', authToken);
                              setAnnotatedDeclaration(null);
                              setHandoverDeclarationPreview(null);
                              toast.success("Declaration deleted");
                            } catch (error) {
                              toast.error("Failed to delete declaration");
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="p-4 space-y-2">
                        <Button
                          className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                          onClick={() => window.open(handoverDeclarationPreview, '_blank')}
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          View Document
                        </Button>
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() => {
                            const link = document.createElement('a');
                            link.href = handoverDeclarationPreview;
                            link.download = 'Declaration.pdf';
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                          }}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Download Document
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Handover Photo */}
            <Card>
              <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <ImageIcon className="w-6 h-6 text-green-600" />
                    <div>
                      <CardTitle className="text-xl">Handover Photo</CardTitle>
                      <CardDescription>Client with unit keys</CardDescription>
                    </div>
                  </div>
                  {handoverPhotoPreview && <Check className="w-6 h-6 text-green-600" />}
                </div>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Button
                    variant="outline"
                    onClick={startCamera}
                    className="h-28 flex flex-col gap-2 border-dashed border-2 hover:border-green-500 hover:bg-green-50"
                  >
                    <CalendarCheck className="w-8 h-8 text-green-600" />
                    <span className="font-medium">{handoverPhotoPreview ? "✓ Photo Taken" : "Take Photo"}</span>
                  </Button>

                  <div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          try {
                            await uploadHandoverFile(Number(bookingId), 'handover_photo', file, authToken);
                            setHandoverPhoto(file);
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setHandoverPhotoPreview(reader.result as string);
                            };
                            reader.readAsDataURL(file);
                            toast.success("Photo uploaded!");
                          } catch (error) {
                            console.error("Upload error:", error);
                            toast.error("Failed to upload photo");
                          }
                        }
                        e.target.value = '';
                      }}
                      className="hidden"
                      id="handover-photo-upload"
                    />
                    <label htmlFor="handover-photo-upload">
                      <Button variant="outline" asChild className="w-full h-28 flex flex-col gap-2 border-dashed border-2 hover:border-green-500 hover:bg-green-50">
                        <span>
                          {handoverPhoto ? (
                            <>
                              <Check className="w-8 h-8 text-green-600" />
                              <span className="font-medium text-green-600">Photo Uploaded</span>
                            </>
                          ) : (
                            <>
                              <Upload className="w-8 h-8 text-gray-600" />
                              <span className="font-medium">Upload Photo</span>
                            </>
                          )}
                        </span>
                      </Button>
                    </label>
                  </div>
                </div>
                {handoverPhotoPreview && (
                  <div className="space-y-2">
                    <div className="border rounded-lg overflow-hidden">
                      <img 
                        src={handoverPhotoPreview} 
                        alt="Handover photo preview" 
                        className="w-full h-auto max-h-96 object-contain bg-gray-50"
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={async () => {
                        try {
                          await deleteHandoverFile(Number(bookingId), 'handover_photo', authToken);
                          setHandoverPhoto(null);
                          setHandoverPhotoPreview(null);
                          toast.success("Photo deleted");
                        } catch (error) {
                          toast.error("Failed to delete photo");
                        }
                      }}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete Photo
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {!loadingTemplates && handoverChecklistTemplate && (
              <Card>
                <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileText className="w-6 h-6 text-blue-600" />
                      <div>
                        <CardTitle className="text-xl">Handover Checklist</CardTitle>
                        <CardDescription>Download template, annotate & upload</CardDescription>
                      </div>
                    </div>
                    {handoverChecklistPreview && <Check className="w-6 h-6 text-green-600" />}
                  </div>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                  <Button
                    onClick={() => setShowChecklistDialog(true)}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                    size="lg"
                  >
                    <Zap className="w-5 h-5 mr-2" />
                    Generate Checklist
                  </Button>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <Button
                      variant="outline"
                      className="h-28 flex flex-col gap-2 border-dashed border-2 hover:border-blue-500 hover:bg-blue-50"
                      onClick={() => {
                        const link = document.createElement("a");
                        link.href = handoverChecklistTemplate;
                        link.download = "Handover_Checklist_Template.pdf";
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                      }}
                    >
                      <Download className="w-8 h-8 text-blue-600" />
                      <span className="font-medium">Download Template</span>
                    </Button>
                    
                    <div>
                      <input
                        type="file"
                        accept="application/pdf"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file && file.type === "application/pdf") {
                            try {
                              await uploadHandoverFile(Number(bookingId), 'handover_checklist', file, authToken);
                              setAnnotatedChecklist(file);
                              setHandoverChecklistPreview(URL.createObjectURL(file));
                              toast.success("Handover checklist uploaded!");
                            } catch (error) {
                              console.error("Upload error:", error);
                              toast.error("Failed to upload checklist");
                            }
                          }
                          e.target.value = '';
                        }}
                        className="hidden"
                        id="checklist-upload"
                      />
                      <label htmlFor="checklist-upload">
                        <Button variant="outline" className="w-full h-28 flex flex-col gap-2 border-dashed border-2 hover:border-green-500 hover:bg-green-50" asChild>
                          <span>
                            {annotatedChecklist ? (
                              <>
                                <Check className="w-8 h-8 text-green-600" />
                                <span className="font-medium text-green-600">Checklist Uploaded</span>
                              </>
                            ) : (
                              <>
                                <Upload className="w-8 h-8 text-gray-600" />
                                <span className="font-medium">Upload Annotated</span>
                              </>
                            )}
                          </span>
                        </Button>
                      </label>
                    </div>
                  </div>
                  {handoverChecklistPreview && (
                    <div className="border rounded-lg overflow-hidden">
                      <div className="p-3 bg-gray-100 flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">Handover Checklist</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={async () => {
                            try {
                              await deleteHandoverFile(Number(bookingId), 'handover_checklist', authToken);
                              setAnnotatedChecklist(null);
                              setHandoverChecklistPreview(null);
                              toast.success("Checklist deleted");
                            } catch (error) {
                              toast.error("Failed to delete checklist");
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="p-4 space-y-2">
                        <Button
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                          onClick={() => window.open(handoverChecklistPreview, '_blank')}
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          View Document
                        </Button>
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() => {
                            const link = document.createElement('a');
                            link.href = handoverChecklistPreview;
                            link.download = 'Handover_Checklist.pdf';
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                          }}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Download Document
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Camera Dialog for Handover Photo */}
      {showCamera && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-3xl w-full p-6 space-y-4">
            <h2 className="text-2xl font-bold">Take Handover Photo</h2>
            <p className="text-gray-600">Position the client with the unit keys in the frame</p>
            <div className="relative bg-black rounded-lg overflow-hidden" style={{ minHeight: '500px' }}>
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline
                muted
                style={{ width: '100%', height: '100%', display: 'block' }}
              />
            </div>
            <canvas ref={canvasRef} className="hidden" />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={stopCamera}>Cancel</Button>
              <Button onClick={capturePhoto} className="bg-blue-600 hover:bg-blue-700">
                <CalendarCheck className="w-5 h-5 mr-2" />
                Capture Photo
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Camera Dialog for Snagging */}
      {showSnaggingCamera && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-3xl w-full p-6 space-y-4">
            <h2 className="text-2xl font-bold">Capture Defect Photo</h2>
            <p className="text-gray-600">Take a clear photo of the defect for documentation</p>
            <div className="relative bg-black rounded-lg overflow-hidden" style={{ minHeight: '500px' }}>
              <video 
                ref={snaggingVideoRef} 
                autoPlay 
                playsInline
                muted
                style={{ width: '100%', height: '100%', display: 'block' }}
              />
            </div>
            <canvas ref={snaggingCanvasRef} className="hidden" />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={stopSnaggingCamera}>Cancel</Button>
              <Button onClick={captureSnaggingPhoto} className="bg-red-600 hover:bg-red-700">
                <CalendarCheck className="w-5 h-5 mr-2" />
                Capture Photo
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Handover Checklist Preview Dialog */}
      <HandoverChecklistPreviewDialog
        open={showChecklistDialog}
        onOpenChange={setShowChecklistDialog}
        booking={booking}
        onGenerated={async () => {
          try {
            // Backend now saves the file automatically, so just refresh the booking data
            await fetchBookingDetails(authToken);
            toast.success("Checklist generated and saved successfully!");
          } catch (error) {
            console.error("Error refreshing booking:", error);
            toast.error("Checklist saved but failed to refresh view");
          }
        }}
      />

      {/* Declaration Preview Dialog */}
      <DeclarationPreviewDialog
        open={showDeclarationDialog}
        onOpenChange={setShowDeclarationDialog}
        booking={booking}
        defects={snaggingDefects}
        onGenerated={handleDeclarationGenerated}
      />
    </div>
  );
}
