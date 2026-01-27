"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { getUnitById, downloadServiceChargeAcknowledgement, downloadUtilitiesGuide, downloadNOCHandover } from "@/lib/api";
import { getStorageUrl, API_BASE_URL } from "@/config/api";
import { 
  updateUnitPaymentStatus, 
  addUnitRemark, 
  sendUnitSOAEmail,
  sendUnitHandoverEmail, 
  getUnitHandoverStatus, 
  updateUnitMortgageStatus,
  sendUnitBookingLink,
  uploadUnitAttachment,
  deleteUnitAttachment,
  previewDeveloperRequirements,
  sendRequirementsToDeveloper,
  validateHandoverRequirements,
  updateUnitPaymentDetailsAndGenerateSOA,
  HandoverStatus
} from "@/lib/unit-api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { 
  ArrowLeft, 
  Building2, 
  Home, 
  MapPin, 
  Users,
  FileText,
  Upload,
  Calendar,
  CreditCard,
  CheckCircle,
  Eye,
  Download,
  Trash2,
  Check,
  X,
  Send,
  Link as LinkIcon,
  Paperclip,
  Mail
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface Attachment {
  id: number;
  filename: string;
  type: string;
  filepath: string;
  full_url: string;
  created_at: string;
}

interface Unit {
  id: number;
  unit: string;
  floor: string;
  building: string;
  square_footage: number;
  dewa_premise_number: string;
  status: string;
  payment_status: string;
  payment_date: string | null;
  has_mortgage: boolean;
  handover_ready: boolean;
  handover_email_sent: boolean;
  handover_email_sent_at: string | null;
  property: {
    id: number;
    project_name: string;
    location: string;
  };
  users: Array<{
    id: number;
    full_name: string;
    email: string;
    mobile_number: string;
    passport_number?: string;
    payment_status: string;
    pivot: {
      is_primary: boolean;
    };
  }>;
  attachments: Attachment[];
  remarks: Array<{
    date: string;
    time: string;
    event: string;
    type?: string;
    admin_name?: string;
  }>;
  bookings?: Array<{
    id: number;
    status: string;
    handover_checklist?: string;
    handover_declaration?: string;
    handover_photo?: string;
    client_signature?: string;
    handover_completed_at?: string;
  }>;
}

export default function UnitDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const unitId = params.id as string;
  
  const [unit, setUnit] = useState<Unit | null>(null);
  const [loading, setLoading] = useState(true);
  const [remarks, setRemarks] = useState<Array<{date: string, time: string, event: string, type?: string, admin_name?: string}>>([]);
  const [newRemark, setNewRemark] = useState("");
  const [savingRemark, setSavingRemark] = useState(false);
  
  // Payment state
  const [paymentStatusModalOpen, setPaymentStatusModalOpen] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<string>("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [updating, setUpdating] = useState(false);
  
  // SOA state
  const [soaFile, setSoaFile] = useState<File | null>(null);
  const [uploadingSOA, setUploadingSOA] = useState(false);
  
  // Payment details state
  const [paymentDetailsDialogOpen, setPaymentDetailsDialogOpen] = useState(false);
  const [paymentDetails, setPaymentDetails] = useState({
    total_unit_price: null as number | null,
    dld_fees: null as number | null,
    admin_fee: null as number | null,
    amount_to_pay: null as number | null,
    total_amount_paid: null as number | null,
    outstanding_amount: null as number | null,
    has_pho: false,
    upon_completion_amount: null as number | null,
    due_after_completion: null as number | null,
  });
  const [updatingPaymentDetails, setUpdatingPaymentDetails] = useState(false);
  
  // Handover state
  const [handoverStatus, setHandoverStatus] = useState<HandoverStatus | null>(null);
  const [uploadingHandover, setUploadingHandover] = useState<{[key: string]: boolean}>({});
  const [sendingHandoverEmail, setSendingHandoverEmail] = useState(false);
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [sendingBookingLink, setSendingBookingLink] = useState(false);
  const [sendingToDeveloper, setSendingToDeveloper] = useState(false);
  const [showDeveloperPreview, setShowDeveloperPreview] = useState(false);
  const [developerPreview, setDeveloperPreview] = useState<any>(null);
  const [validatingHandover, setValidatingHandover] = useState(false);
  
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    attachmentId: number | null;
    filename: string;
  }>({ isOpen: false, attachmentId: null, filename: '' });

  const fetchUnitDetails = async () => {
    try {
      const token = localStorage.getItem("authToken");
      if (!token) {
        router.push("/login");
        return;
      }

      const unitData = await getUnitById(parseInt(unitId), token);
      setUnit(unitData as any);
      setPaymentStatus((unitData as any).payment_status);
      setRemarks(Array.isArray((unitData as any).remarks) ? (unitData as any).remarks : []);
      
      // Fetch handover status
      try {
        const status = await getUnitHandoverStatus(parseInt(unitId), token);
        setHandoverStatus(status);
      } catch (error) {
        console.error("Failed to fetch handover status:", error);
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to load unit details");
      console.error("Error fetching unit details:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("authToken");
    const isAdmin = localStorage.getItem("isAdmin");

    if (!token || isAdmin !== "true") {
      router.push("/login");
      return;
    }

    fetchUnitDetails();
  }, [unitId, router]);

  const handleSOAFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSoaFile(e.target.files[0]);
    }
  };

  const handleUploadSOA = async () => {
    if (!soaFile || !unit) return;

    setUploadingSOA(true);
    try {
      const token = localStorage.getItem("authToken");
      if (!token) {
        toast.error("You must be logged in");
        return;
      }

      await sendUnitSOAEmail(unit.id, soaFile, token);
      toast.success("SOA uploaded successfully");
      setSoaFile(null);
      await fetchUnitDetails();
    } catch (error: any) {
      toast.error(error.message || "Failed to upload SOA");
    } finally {
      setUploadingSOA(false);
    }
  };

  const handleUpdatePaymentDetailsAndGenerateSOA = async () => {
    if (!unit) return;

    setUpdatingPaymentDetails(true);
    try {
      const token = localStorage.getItem("authToken");
      if (!token) {
        toast.error("You must be logged in");
        return;
      }

      const result = await updateUnitPaymentDetailsAndGenerateSOA(unit.id, paymentDetails, token);
      toast.success("Payment details updated and SOA generated successfully");
      setPaymentDetailsDialogOpen(false);
      await fetchUnitDetails();
    } catch (error: any) {
      toast.error(error.message || "Failed to update payment details");
    } finally {
      setUpdatingPaymentDetails(false);
    }
  };

  const handleUpdatePaymentStatus = async () => {
    if (!unit) return;

    setUpdating(true);
    try {
      const token = localStorage.getItem("authToken");
      if (!token) {
        toast.error("You must be logged in");
        return;
      }

      await updateUnitPaymentStatus(unit.id, paymentStatus, token, receiptFile || undefined);
      toast.success("Payment status updated successfully");
      setPaymentStatusModalOpen(false);
      setReceiptFile(null);
      await fetchUnitDetails();
    } catch (error: any) {
      toast.error(error.message || "Failed to update payment status");
    } finally {
      setUpdating(false);
    }
  };

  const handleToggleMortgage = async () => {
    if (!unit) return;

    try {
      const token = localStorage.getItem("authToken");
      if (!token) return;

      await updateUnitMortgageStatus(unit.id, !handoverStatus?.has_mortgage, token);
      toast.success(`Mortgage status updated to: ${!handoverStatus?.has_mortgage ? "Has Mortgage" : "No Mortgage"}`);
      await fetchUnitDetails();
    } catch (error: any) {
      toast.error(error.message || "Failed to update mortgage status");
    }
  };

  const handleHandoverUpload = async (type: string, e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !unit) return;

    const file = e.target.files[0];
    setUploadingHandover({...uploadingHandover, [type]: true});

    try {
      const token = localStorage.getItem("authToken");
      if (!token) return;

      await uploadUnitAttachment(unit.id, file, type, token);
      toast.success("Document uploaded successfully");
      await fetchUnitDetails();
    } catch (error: any) {
      toast.error(error.message || "Failed to upload document");
    } finally {
      setUploadingHandover({...uploadingHandover, [type]: false});
    }
  };

  const handleSendHandoverEmail = async () => {
    if (!unit) return;

    const hasSOA = unit.attachments?.some(att => att.type === "soa");
    if (!hasSOA) {
      toast.error("Please upload SOA before sending handover notice");
      return;
    }

    setSendingHandoverEmail(true);
    try {
      const token = localStorage.getItem("authToken");
      if (!token) {
        toast.error("You must be logged in");
        return;
      }

      await sendUnitHandoverEmail(unit.id, token);
      toast.success(`Handover notice sent to all ${unit.users.length} owner(s)`);
      setShowEmailPreview(false);
      await fetchUnitDetails();
    } catch (error: any) {
      toast.error(error.message || "Failed to send handover notice");
    } finally {
      setSendingHandoverEmail(false);
    }
  };

  const handleSendBookingLink = async () => {
    if (!unit) return;

    setSendingBookingLink(true);
    try {
      const token = localStorage.getItem("authToken");
      if (!token) {
        toast.error("You must be logged in");
        return;
      }

      await sendUnitBookingLink(unit.id, token);
      toast.success(`Booking link sent to all ${unit.users.length} owner(s)`);
      await fetchUnitDetails();
    } catch (error: any) {
      toast.error(error.message || "Failed to send booking link");
    } finally {
      setSendingBookingLink(false);
    }
  };

  const handleSendToDeveloper = async () => {
    if (!unit) return;

    // First show preview
    try {
      const token = localStorage.getItem("authToken");
      if (!token) {
        toast.error("You must be logged in");
        return;
      }

      const preview = await previewDeveloperRequirements(unit.id, token);
      setDeveloperPreview(preview);
      setShowDeveloperPreview(true);
    } catch (error: any) {
      toast.error(error.message || "Failed to load preview");
    }
  };

  const confirmSendToDeveloper = async () => {
    if (!unit) return;

    setSendingToDeveloper(true);
    try {
      const token = localStorage.getItem("authToken");
      if (!token) {
        toast.error("You must be logged in");
        return;
      }

      await sendRequirementsToDeveloper(unit.id, token);
      toast.success("Requirements sent to developer for approval");
      setShowDeveloperPreview(false);
      await fetchUnitDetails();
    } catch (error: any) {
      toast.error(error.message || "Failed to send requirements to developer");
    } finally {
      setSendingToDeveloper(false);
    }
  };

  const handleDeleteAttachment = (attachmentId: number, filename: string) => {
    setDeleteConfirmation({
      isOpen: true,
      attachmentId,
      filename
    });
  };

  const confirmDelete = async () => {
    if (!deleteConfirmation.attachmentId || !unit) return;

    try {
      const token = localStorage.getItem("authToken");
      if (!token) return;

      await deleteUnitAttachment(unit.id, deleteConfirmation.attachmentId, token);
      toast.success("Attachment deleted successfully");
      setDeleteConfirmation({ isOpen: false, attachmentId: null, filename: '' });
      await fetchUnitDetails();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete attachment");
    }
  };

  const handleValidateHandoverRequirements = async () => {
    if (!unit) return;

    setValidatingHandover(true);
    try {
      const token = localStorage.getItem("authToken");
      if (!token) {
        toast.error("You must be logged in");
        return;
      }

      const result = await validateHandoverRequirements(unit.id, token);
      toast.success(result.handover_ready ? "All handover requirements met!" : "Handover requirements validated");
      await fetchUnitDetails();
    } catch (error: any) {
      toast.error(error.message || "Failed to validate handover requirements");
    } finally {
      setValidatingHandover(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading unit details...</p>
        </div>
      </div>
    );
  }

  if (!unit) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Unit not found</p>
          <Button onClick={() => router.push("/admin")} className="mt-4">
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const primaryOwner = unit.users?.find(u => u.pivot?.is_primary) || unit.users?.[0];
  const coOwners = unit.users?.filter(u => !u.pivot?.is_primary) || [];
  const soaAttachments = unit.attachments?.filter(att => att.type === "soa") || [];
  const handoverTypes = handoverStatus?.requirements?.map(req => req.type) || [];
  const otherAttachments = unit.attachments?.filter(att => 
    att.type !== "soa" && !handoverTypes.includes(att.type)
  ) || [];

  const getPaymentStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline", label: string }> = {
      pending: { variant: "destructive", label: "Pending" },
      partial: { variant: "secondary", label: "Partial" },
      fully_paid: { variant: "default", label: "Fully Paid" },
    };
    const config = variants[status] || variants.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

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
              <h1 className="text-3xl font-bold text-gray-900">Unit {unit.unit}</h1>
              <p className="text-gray-600">{unit.property.project_name}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {unit.handover_email_sent && (
              <Button
                onClick={() => setPaymentStatusModalOpen(true)}
                variant="outline"
                className="flex items-center gap-2"
              >
                <CreditCard className="w-4 h-4" />
                Update Payment
              </Button>
            )}
            {(() => {
              const hasSOA = unit.attachments?.some(att => att.type === "soa");
              return (
                <Button
                  onClick={() => {
                    if (!hasSOA) {
                      toast.error("Please upload SOA before sending handover notice");
                      return;
                    }
                    setShowEmailPreview(true);
                  }}
                  disabled={!hasSOA}
                  className={`flex items-center gap-2 ${!hasSOA ? 'opacity-50 cursor-not-allowed' : ''}`}
                  title={!hasSOA ? "Please upload SOA first" : "Preview and send handover notice"}
                >
                  <Eye className="w-4 h-4" />
                  {unit.handover_email_sent ? "Resend Handover Notice" : "Send Handover Notice"}
                </Button>
              );
            })()}
            <Button
              onClick={handleValidateHandoverRequirements}
              disabled={validatingHandover}
              variant="outline"
              className="flex items-center gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              {validatingHandover ? "Validating..." : "Validate Handover"}
            </Button>
            {handoverStatus?.handover_ready && (
              <Button
                onClick={handleSendBookingLink}
                disabled={sendingBookingLink}
                className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
              >
                <LinkIcon className="w-4 h-4" />
                {sendingBookingLink ? "Sending..." : "Send Booking Link"}
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Unit Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  Unit Information
                </CardTitle>
                <CardDescription>Property details and specifications</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Unit Number</p>
                    <p className="font-medium">{unit.unit}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Project</p>
                    <p className="font-medium">{unit.property.project_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Location</p>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-gray-400" />
                      <p className="font-medium">{unit.property.location}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Floor</p>
                    <p className="font-medium">{unit.floor || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Building</p>
                    <p className="font-medium">{unit.building || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Square Footage</p>
                    <p className="font-medium">{unit.square_footage} sq ft</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">DEWA Premise No.</p>
                    <p className="font-medium">{unit.dewa_premise_number || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Status</p>
                    <Badge variant={unit.status === "claimed" ? "default" : "secondary"}>
                      {unit.status}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Payment Status</p>
                    {getPaymentStatusBadge(unit.payment_status)}
                  </div>
                  {unit.payment_date && (
                    <div>
                      <p className="text-sm text-gray-500">Payment Date</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <p className="font-medium">{format(new Date(unit.payment_date), "MMM d, yyyy")}</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Owners */}
            {primaryOwner && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Owners ({unit.users.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Primary Owner */}
                  <div className="flex items-center justify-between p-4 border-2 border-blue-200 rounded-lg bg-blue-50">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-lg">{primaryOwner.full_name}</p>
                        <Badge variant="outline">Primary</Badge>
                      </div>
                      <p className="text-sm text-gray-600">{primaryOwner.email}</p>
                      <p className="text-sm text-gray-600">{primaryOwner.mobile_number}</p>
                      {primaryOwner.passport_number && (
                        <p className="text-sm text-gray-600">Passport: {primaryOwner.passport_number}</p>
                      )}
                    </div>
                    <Button onClick={() => router.push(`/admin/users/${primaryOwner.id}`)}>
                      View Details
                    </Button>
                  </div>

                  {/* Co-Owners */}
                  {coOwners.map((owner) => (
                    <div key={owner.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                      <div>
                        <p className="font-medium">{owner.full_name}</p>
                        <p className="text-sm text-gray-600">{owner.email}</p>
                        {owner.passport_number && (
                          <p className="text-sm text-gray-600">Passport: {owner.passport_number}</p>
                        )}
                      </div>
                      <Button 
                        variant="outline"
                        onClick={() => router.push(`/admin/users/${owner.id}`)}
                      >
                        View Details
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Activity Timeline */}
            <Card>
              <CardHeader>
                <CardTitle>Activity Timeline</CardTitle>
                <CardDescription>System events and internal notes</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 max-h-[400px] overflow-y-auto mb-6">
                  {remarks.length > 0 ? (
                    <div className="relative border-l-2 border-gray-300 pl-6 space-y-4">
                      {[...remarks].reverse().map((entry, index) => (
                        <div key={index} className="relative">
                          <div className="absolute -left-[26px] w-3 h-3 rounded-full bg-blue-600 border-2 border-white"></div>
                          <div className="bg-gray-50 rounded-lg p-4 shadow-sm">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-gray-500" />
                                <span className="text-sm font-medium text-gray-700">
                                  {entry.date} at {entry.time}
                                </span>
                                {entry.admin_name && (
                                  <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-full font-medium">
                                    by {entry.admin_name}
                                  </span>
                                )}
                              </div>
                              {entry.type && (
                                <Badge variant={entry.type === 'email_sent' ? 'default' : 'secondary'}>
                                  {entry.type.replace('_', ' ').toUpperCase()}
                                </Badge>
                              )}
                            </div>
                            <p className="text-gray-800">{entry.event}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-8">No activity recorded yet</p>
                  )}
                </div>

                <Separator className="my-4" />
                <div className="space-y-2">
                  <Label>Add New Note</Label>
                  <Textarea
                    value={newRemark}
                    onChange={(e) => setNewRemark(e.target.value)}
                    placeholder="Add a manual note to the timeline..."
                    className="min-h-[80px]"
                  />
                  <div className="flex justify-end">
                    <Button
                      onClick={async () => {
                        if (newRemark.trim()) {
                          setSavingRemark(true);
                          try {
                            const token = localStorage.getItem("authToken");
                            if (!token) {
                              toast.error("You must be logged in");
                              return;
                            }

                            await addUnitRemark(unit.id, newRemark, token);
                            setNewRemark("");
                            toast.success("Note added to timeline successfully");
                            await fetchUnitDetails();
                          } catch (error: any) {
                            toast.error(error.message || "Failed to add note");
                          } finally {
                            setSavingRemark(false);
                          }
                        }
                      }}
                      disabled={!newRemark.trim() || savingRemark}
                    >
                      {savingRemark ? "Adding..." : "Add to Timeline"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Other Attachments (Receipts, etc.) */}
            {otherAttachments.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Other Documents
                  </CardTitle>
                  <CardDescription>
                    Payment receipts and other attachments ({otherAttachments.length})
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {otherAttachments.map((attachment) => {
                      const truncatedName = attachment.filename.length > 30 
                        ? attachment.filename.substring(0, 15) + '...' 
                        : attachment.filename;
                      
                      return (
                        <div
                          key={attachment.id}
                          className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <FileText className="w-4 h-4 text-blue-600 flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium" title={attachment.filename}>{truncatedName}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-xs">
                                {attachment.type}
                              </Badge>
                              <p className="text-xs text-gray-500">
                                {format(new Date(attachment.created_at), "MMM d, yyyy")}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="flex-shrink-0"
                            onClick={() => window.open(attachment.full_url, '_blank')}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="flex-shrink-0"
                            onClick={() => window.open(attachment.full_url, '_blank')}
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="flex-shrink-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleDeleteAttachment(attachment.id, attachment.filename)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Payment Details & SOA Generation */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  Payment Details & SOA Generation
                </CardTitle>
                <CardDescription>
                  Enter payment details to generate Statement of Account
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  onClick={() => {
                    // Pre-fill with current values if they exist
                    if (unit) {
                      setPaymentDetails({
                        total_unit_price: (unit as any).total_unit_price || null,
                        dld_fees: (unit as any).dld_fees || null,
                        admin_fee: (unit as any).admin_fee || null,
                        amount_to_pay: (unit as any).amount_to_pay || null,
                        total_amount_paid: (unit as any).total_amount_paid || null,
                        outstanding_amount: (unit as any).outstanding_amount || null,
                      });
                    }
                    setPaymentDetailsDialogOpen(true);
                  }}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Enter Payment Details & Generate SOA
                </Button>
              </CardContent>
            </Card>

            {/* SOA Attachments */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Statement of Accounts (SOA)
                </CardTitle>
                <CardDescription>
                  {soaAttachments.length} document{soaAttachments.length !== 1 ? 's' : ''}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {soaAttachments.length > 0 ? (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Current SOA Document</Label>
                      {soaAttachments.map((attachment) => {
                        const truncatedName = attachment.filename.length > 30 
                          ? attachment.filename.substring(0, 15) + '...' 
                          : attachment.filename;
                        
                        return (
                          <div
                            key={attachment.id}
                            className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <FileText className="w-4 h-4 text-blue-600 flex-shrink-0" />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium" title={attachment.filename}>{truncatedName}</p>
                              <p className="text-xs text-gray-500">
                                {format(new Date(attachment.created_at), "MMM d, yyyy")}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="flex-shrink-0"
                              onClick={() => window.open(attachment.full_url, '_blank')}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="flex-shrink-0"
                              onClick={() => window.open(attachment.full_url, '_blank')}
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="flex-shrink-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => handleDeleteAttachment(attachment.id, attachment.filename)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Upload SOA</Label>
                      <div className="flex gap-2">
                        <Input
                          type="file"
                          accept=".pdf"
                          onChange={handleSOAFileChange}
                          className="flex-1"
                        />
                        <Button 
                          onClick={handleUploadSOA}
                          disabled={!soaFile || uploadingSOA}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          <Upload className="w-4 h-4 mr-2" />
                          {uploadingSOA ? "Uploading..." : "Upload"}
                        </Button>
                      </div>
                      {soaFile && (
                        <p className="text-xs text-gray-600">Selected: {soaFile.name}</p>
                      )}
                      <div className="text-center py-4 text-gray-500">
                        <FileText className="w-8 h-8 mx-auto mb-2 opacity-20" />
                        <p className="text-xs">No SOA document uploaded yet</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Handover Requirements */}
            {unit.handover_email_sent && (
              <Card className="border-2 border-blue-200">
                <CardHeader className="bg-blue-50 rounded-t-lg">
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-blue-600" />
                    Handover Requirements
                  </CardTitle>
                  <CardDescription>
                    {handoverStatus && handoverStatus.handover_ready ? (
                      <span className="text-green-600 font-medium flex items-center gap-1 mt-1">
                        <Check className="w-5 h-5" />
                        All Complete
                      </span>
                    ) : (
                      <span className="text-orange-600 flex items-center gap-1">
                        <X className="w-5 h-5" />
                        {handoverStatus?.requirements?.filter(r => !r.uploaded).length || 0} pending
                      </span>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-6 pb-4 border-b">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        try {
                          const token = localStorage.getItem("authToken");
                          if (!token) {
                            toast.error("You must be logged in");
                            return;
                          }
                          const blob = await downloadNOCHandover(unit.id, token);
                          const url = window.URL.createObjectURL(blob);
                          const link = document.createElement('a');
                          link.href = url;
                          link.download = `NOC_Handover_Unit_${unit.unit}.pdf`;
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                          window.URL.revokeObjectURL(url);
                          toast.success('NOC downloaded successfully');
                        } catch (error) {
                          console.error('Download error:', error);
                          toast.error('Failed to download NOC');
                        }
                      }}
                      className="bg-purple-50 border-purple-300 hover:bg-purple-100"
                    >
                      <Download className="w-3 h-3 mr-1" />
                      Download NOC
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleToggleMortgage}
                      className={handoverStatus?.has_mortgage ? "bg-orange-50 border-orange-300" : ""}
                    >
                      {handoverStatus?.has_mortgage ? "Has Mortgage ✓" : "No Mortgage"}
                    </Button>
                  </div>
                  {handoverStatus ? (
                    <div className="space-y-6">
                      {/* Buyer Requirements Section */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 mb-4">
                          <div className={`w-3 h-3 rounded-full ${handoverStatus.buyer_ready ? 'bg-green-500' : 'bg-orange-400'}`} />
                          <h3 className="font-semibold text-lg">Buyer Requirements</h3>
                        </div>
                        {handoverStatus.buyer_requirements?.map((req) => {
                          const associatedFiles = unit.attachments?.filter(att => att.type === req.type) || [];
                          
                          return (
                            <div
                              key={req.type}
                              className={`p-4 border-2 rounded-lg transition-all ${
                                req.uploaded 
                                  ? 'border-green-300 bg-green-50' 
                                  : 'border-gray-200 hover:border-blue-300'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex items-start gap-3 flex-1">
                                  <div className="mt-1">
                                    {req.uploaded ? (
                                      <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                                        <Check className="w-4 h-4 text-white" />
                                      </div>
                                    ) : (
                                      <div className="w-6 h-6 rounded-full border-2 border-gray-300" />
                                    )}
                                  </div>
                                  <div className="flex-1">
                                    <h4 className={`font-medium ${req.uploaded ? 'text-green-800' : 'text-gray-900'}`}>
                                      {req.label}
                                    </h4>
                                    
                                    {associatedFiles.length > 0 && (
                                      <div className="mt-3 space-y-2">
                                        {associatedFiles.map((file) => {
                                          const truncatedName = file.filename.length > 25 
                                            ? file.filename.substring(0,18) + '...' 
                                            : file.filename;
                                          
                                          return (
                                            <div key={file.id} className="flex items-center gap-2 text-xs bg-white p-2 rounded border border-gray-200">
                                              <FileText className="w-3 h-3 text-blue-600 flex-shrink-0" />
                                              <span 
                                                className="flex-1 font-medium" 
                                                title={file.filename}
                                              >
                                                {truncatedName}
                                              </span>
                                              <Button 
                                                variant="ghost" 
                                                size="icon"
                                                className="h-6 w-6"
                                                onClick={() => window.open(file.full_url, '_blank')}
                                                title="View document"
                                              >
                                                <Eye className="w-3 h-3" />
                                              </Button>
                                              <Button 
                                                variant="ghost" 
                                                size="icon"
                                                className="h-6 w-6"
                                                onClick={() => window.open(file.full_url, '_blank')}
                                                title="Download"
                                              >
                                                <Download className="w-3 h-3" />
                                              </Button>
                                              <Button 
                                                variant="ghost" 
                                                size="icon"
                                                className="h-6 w-6 text-red-600 hover:text-red-700"
                                                onClick={() => handleDeleteAttachment(file.id, file.filename)}
                                                title="Delete"
                                              >
                                                <Trash2 className="w-3 h-3" />
                                              </Button>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                {!req.uploaded && req.type !== 'payment_proof' && (
                                  <div>
                                    <Input
                                      type="file"
                                      accept=".pdf,.jpg,.jpeg,.png"
                                      className="hidden"
                                      id={`upload-${req.type}`}
                                      onChange={(e) => handleHandoverUpload(req.type, e)}
                                    />
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      disabled={uploadingHandover[req.type]}
                                      onClick={() => document.getElementById(`upload-${req.type}`)?.click()}
                                    >
                                      {uploadingHandover[req.type] ? (
                                        "Uploading..."
                                      ) : (
                                        <>
                                          <Upload className="w-3 h-3 mr-1" />
                                          Upload
                                        </>
                                      )}
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Send to Developer Button */}
                      {handoverStatus.buyer_ready && !handoverStatus.developer_ready && (
                        <div className="pt-4">
                          <Button
                            onClick={handleSendToDeveloper}
                            disabled={sendingToDeveloper}
                            className="w-full bg-blue-600 hover:bg-blue-700"
                          >
                            <Send className="w-4 h-4 mr-2" />
                            {sendingToDeveloper ? "Sending..." : "Send Requirements to Developer"}
                          </Button>
                          <p className="text-xs text-gray-600 text-center mt-2">
                            This will send all buyer documents to the developer for review and signing
                          </p>
                        </div>
                      )}

                      {/* Developer Requirements Section */}
                      <div className="space-y-3 pt-4 border-t-2">
                        <div className="flex items-center gap-2 mb-4">
                          <div className={`w-3 h-3 rounded-full ${handoverStatus.developer_ready ? 'bg-green-500' : 'bg-orange-400'}`} />
                          <h3 className="font-semibold text-lg">Developer Requirements</h3>
                        </div>
                        {handoverStatus.developer_requirements?.map((req) => {
                          const associatedFiles = unit.attachments?.filter(att => att.type === req.type) || [];
                          
                          return (
                            <div
                              key={req.type}
                              className={`p-4 border-2 rounded-lg transition-all ${
                                req.uploaded 
                                  ? 'border-green-300 bg-green-50' 
                                  : 'border-gray-200 hover:border-blue-300'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex items-start gap-3 flex-1">
                                  <div className="mt-1">
                                    {req.uploaded ? (
                                      <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                                        <Check className="w-4 h-4 text-white" />
                                      </div>
                                    ) : (
                                      <div className="w-6 h-6 rounded-full border-2 border-gray-300" />
                                    )}
                                  </div>
                                  <div className="flex-1">
                                    <h4 className={`font-medium ${req.uploaded ? 'text-green-800' : 'text-gray-900'}`}>
                                      {req.label}
                                    </h4>
                                    
                                    {associatedFiles.length > 0 && (
                                      <div className="mt-3 space-y-2">
                                        {associatedFiles.map((file) => {
                                          const truncatedName = file.filename.length > 25 
                                            ? file.filename.substring(0,18) + '...' 
                                            : file.filename;
                                          
                                          return (
                                            <div key={file.id} className="flex items-center gap-2 text-xs bg-white p-2 rounded border border-gray-200">
                                              <FileText className="w-3 h-3 text-blue-600 flex-shrink-0" />
                                              <span 
                                                className="flex-1 font-medium" 
                                                title={file.filename}
                                              >
                                                {truncatedName}
                                              </span>
                                              <Button 
                                                variant="ghost" 
                                                size="icon"
                                                className="h-6 w-6"
                                                onClick={() => window.open(file.full_url, '_blank')}
                                                title="View document"
                                              >
                                                <Eye className="w-3 h-3" />
                                              </Button>
                                              <Button 
                                                variant="ghost" 
                                                size="icon"
                                                className="h-6 w-6"
                                                onClick={() => window.open(file.full_url, '_blank')}
                                                title="Download"
                                              >
                                                <Download className="w-3 h-3" />
                                              </Button>
                                              <Button 
                                                variant="ghost" 
                                                size="icon"
                                                className="h-6 w-6 text-red-600 hover:text-red-700"
                                                onClick={() => handleDeleteAttachment(file.id, file.filename)}
                                                title="Delete"
                                              >
                                                <Trash2 className="w-3 h-3" />
                                              </Button>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                {!req.uploaded && (
                                  <div>
                                    <Input
                                      type="file"
                                      accept=".pdf,.jpg,.jpeg,.png"
                                      className="hidden"
                                      id={`upload-${req.type}`}
                                      onChange={(e) => handleHandoverUpload(req.type, e)}
                                    />
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      disabled={uploadingHandover[req.type]}
                                      onClick={() => document.getElementById(`upload-${req.type}`)?.click()}
                                    >
                                      {uploadingHandover[req.type] ? (
                                        "Uploading..."
                                      ) : (
                                        <>
                                          <Upload className="w-3 h-3 mr-1" />
                                          Upload
                                        </>
                                      )}
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-4">Loading requirements...</p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Handover Final Checklist */}
            {(() => {
              const completedBooking = unit.bookings?.find(b => b.status === 'completed' && b.handover_checklist);
              if (!completedBooking) return null;
              
              return (
                <Card className="border-2 border-green-200">
                  <CardHeader className="bg-green-50 rounded-t-lg">
                    <CardTitle className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      Handover Final Checklist
                    </CardTitle>
                    <CardDescription>
                      Completed handover documents and signatures
                      {completedBooking.handover_completed_at && (
                        <span className="ml-2 text-green-600 font-medium">
                          • Completed {format(new Date(completedBooking.handover_completed_at), "MMM d, yyyy")}
                        </span>
                      )}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Handover Checklist */}
                      {completedBooking.handover_checklist && (
                        <div className="border-2 border-blue-200 rounded-lg p-4 bg-blue-50 hover:bg-blue-100 transition-colors">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 flex-1">
                              <FileText className="w-5 h-5 text-blue-600 mt-1 flex-shrink-0" />
                              <div>
                                <p className="font-semibold text-sm">Handover Checklist</p>
                                <p className="text-xs text-gray-600 mt-1">Annotated checklist PDF</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="flex-shrink-0 h-8 w-8"
                                onClick={() => completedBooking.handover_checklist && window.open(getStorageUrl(completedBooking.handover_checklist), '_blank')}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="flex-shrink-0 h-8 w-8"
                                onClick={() => {
                                  if (completedBooking.handover_checklist) {
                                    const link = document.createElement('a');
                                    link.href = getStorageUrl(completedBooking.handover_checklist);
                                    link.download = `unit_${unit.unit}_handover_checklist.pdf`;
                                    link.click();
                                  }
                                }}
                              >
                                <Download className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Declaration */}
                      {completedBooking.handover_declaration && (
                        <div className="border-2 border-purple-200 rounded-lg p-4 bg-purple-50 hover:bg-purple-100 transition-colors">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 flex-1">
                              <FileText className="w-5 h-5 text-purple-600 mt-1 flex-shrink-0" />
                              <div>
                                <p className="font-semibold text-sm">Declaration V3</p>
                                <p className="text-xs text-gray-600 mt-1">Signed declaration PDF</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="flex-shrink-0 h-8 w-8"
                                onClick={() => completedBooking.handover_declaration && window.open(getStorageUrl(completedBooking.handover_declaration), '_blank')}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="flex-shrink-0 h-8 w-8"
                                onClick={() => {
                                  if (completedBooking.handover_declaration) {
                                    const link = document.createElement('a');
                                    link.href = getStorageUrl(completedBooking.handover_declaration);
                                    link.download = `unit_${unit.unit}_declaration.pdf`;
                                    link.click();
                                  }
                                }}
                              >
                                <Download className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Handover Photo */}
                      {completedBooking.handover_photo && (
                        <div className="border-2 border-green-200 rounded-lg p-4 bg-green-50 hover:bg-green-100 transition-colors">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 flex-1">
                              <img 
                                src={getStorageUrl(completedBooking.handover_photo)}
                                alt="Handover photo"
                                className="w-16 h-16 object-cover rounded flex-shrink-0"
                              />
                              <div>
                                <p className="font-semibold text-sm">Handover Photo</p>
                                <p className="text-xs text-gray-600 mt-1">Client with unit keys</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="flex-shrink-0 h-8 w-8"
                                onClick={() => completedBooking.handover_photo && window.open(getStorageUrl(completedBooking.handover_photo), '_blank')}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="flex-shrink-0 h-8 w-8"
                                onClick={() => {
                                  if (completedBooking.handover_photo) {
                                    const link = document.createElement('a');
                                    link.href = getStorageUrl(completedBooking.handover_photo);
                                    link.download = `unit_${unit.unit}_handover_photo.jpg`;
                                    link.click();
                                  }
                                }}
                              >
                                <Download className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Client Signature */}
                      {completedBooking.client_signature && (
                        <div className="border-2 border-amber-200 rounded-lg p-4 bg-amber-50 hover:bg-amber-100 transition-colors">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 flex-1">
                              <img 
                                src={getStorageUrl(completedBooking.client_signature)}
                                alt="Client signature"
                                className="w-24 h-16 object-contain bg-white border rounded flex-shrink-0"
                              />
                              <div>
                                <p className="font-semibold text-sm">Client Signature</p>
                                <p className="text-xs text-gray-600 mt-1">Final acknowledgment</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="flex-shrink-0 h-8 w-8"
                                onClick={() => completedBooking.client_signature && window.open(getStorageUrl(completedBooking.client_signature), '_blank')}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="flex-shrink-0 h-8 w-8"
                                onClick={() => {
                                  if (completedBooking.client_signature) {
                                    const link = document.createElement('a');
                                    link.href = getStorageUrl(completedBooking.client_signature);
                                    link.download = `unit_${unit.unit}_signature.png`;
                                    link.click();
                                  }
                                }}
                              >
                                <Download className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Payment Status Modal */}
      <Dialog open={paymentStatusModalOpen} onOpenChange={setPaymentStatusModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Payment Status</DialogTitle>
            <DialogDescription>
              Update the payment status for this unit and optionally upload a receipt.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Payment Status</Label>
              <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="partial">Partial</SelectItem>
                  <SelectItem value="fully_paid">Fully Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Receipt (Optional)</Label>
              <Input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => e.target.files && setReceiptFile(e.target.files[0])}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentStatusModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdatePaymentStatus} disabled={updating}>
              {updating ? "Updating..." : "Update"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>



      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmation.isOpen} onOpenChange={(open) => 
        !open && setDeleteConfirmation({ isOpen: false, attachmentId: null, filename: '' })
      }>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deleteConfirmation.filename}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setDeleteConfirmation({ isOpen: false, attachmentId: null, filename: '' })}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Email Preview & Send Dialog */}
      <Dialog open={showEmailPreview} onOpenChange={setShowEmailPreview}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-blue-600" />
              Preview Handover Notice Email
            </DialogTitle>
            <DialogDescription>
              Review the email content before sending to all unit owners
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-auto space-y-4 py-4">
            {/* Recipients Section */}
            <div className="space-y-2">
              <Label className="text-base font-semibold">Recipients</Label>
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">To:</p>
                    <div className="space-y-1.5">
                      {unit.users.map((owner) => (
                        <div key={owner.id} className="flex items-start gap-2">
                          <span className="text-sm font-medium text-blue-600">&bull;</span>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{owner.full_name}</p>
                            <p className="text-xs text-gray-600">{owner.email}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  {unit.users.length > 1 && (
                    <div className="p-2 bg-blue-50 border border-blue-200 rounded">
                      <p className="text-xs text-blue-800">
                        &#9432; All {unit.users.length} recipient(s) will receive this email together
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Subject Line */}
            <div className="space-y-2">
              <Label className="text-base font-semibold">Subject</Label>
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                <p className="text-sm font-medium">Handover Notice - Unit {unit.unit}, {unit.property.project_name}</p>
              </div>
            </div>

            {/* Email Content Preview */}
            <div className="space-y-2">
              <Label className="text-base font-semibold">Email Content</Label>
              <div className="bg-white rounded-lg border-2 border-gray-300 p-6 max-h-[400px] overflow-y-auto">
                <div className="space-y-4 text-sm">
                  <p>Dear {primaryOwner?.full_name.split(' ')[0] || 'Owner'},</p>
                  
                  <p>We are pleased to inform you that your unit <strong>{unit.unit}</strong> at <strong>{unit.property.project_name}</strong> is now ready for final handover following the issuance of the Building Completion Certificate by the Dubai Development Authority.</p>
                  
                  <p>This letter serves as the <strong>official Handover Notice</strong>. Kindly review and complete the steps outlined below to proceed with the handover process.</p>
                  
                  <Separator className="my-4" />
                  
                  <div>
                    <h3 className="font-bold text-base mb-2">1. Final Payment</h3>
                    <p>Kindly arrange settlement of the final amount due in accordance with the Sale and Purchase Agreement within <strong>30 calendar days</strong> from the date of this notice.</p>
                    <p className="mt-2"><strong>Find your Statement of Account attached to this email.</strong></p>
                  </div>
                  
                  <div>
                    <h3 className="font-bold text-base mb-2">2. Utilities Connections, Registrations & Service Charge</h3>
                    <p>To proceed with the handover, please complete the <strong>DEWA</strong> and <strong>Chilled Water / AC (Zenner)</strong> registrations.</p>
                  </div>
                  
                  <div>
                    <h3 className="font-bold text-base mb-2">3. Handover Appointment</h3>
                    <p>Once your payments have been settled and all utility registrations have been completed, our team will contact you to arrange the unit inspection and key handover.</p>
                  </div>
                  
                  <Separator className="my-4" />
                  
                  <p>For any queries, please contact us at <strong>vantage@zedcapital.ae</strong>.</p>
                  
                  <p>We look forward to welcoming you to your new home at <strong>{unit.property.project_name}</strong>.</p>
                  
                  <p className="mt-4">
                    Warm regards,<br/>
                    <strong>Vantage Ventures Real Estate Development L.L.C.</strong>
                  </p>
                </div>
              </div>
            </div>

            {/* Attachments Section */}
            <div className="space-y-2">
              <Label className="text-base font-semibold flex items-center gap-2">
                <Paperclip className="w-4 h-4" />
                Attachments
              </Label>
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 space-y-4">
                {/* SOA Attachments */}
                {soaAttachments.length > 0 ? (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Statement of Account</Label>
                    {soaAttachments.map((attachment) => (
                      <div key={attachment.id} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-300">
                        <FileText className="w-5 h-5 text-blue-600 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="text-sm font-medium">{attachment.filename}</p>
                          <p className="text-xs text-gray-500">
                            Uploaded {format(new Date(attachment.created_at), "MMM d, yyyy")}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(attachment.full_url, '_blank')}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          View
                        </Button>
                        <Badge variant="outline" className="text-xs">PDF</Badge>
                      </div>
                    ))}
                    
                    <div className="p-3 bg-green-50 border border-green-200 rounded">
                      <p className="text-xs text-green-800">
                        &#10003; SOA document{soaAttachments.length > 1 ? 's' : ''} will be attached to this email
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-red-50 border border-red-200 rounded">
                    <p className="text-sm text-red-800 font-medium">
                      &#9888; No SOA uploaded yet. Please upload SOA before sending.
                    </p>
                  </div>
                )}

                {/* Service Charge Acknowledgement */}
                <div className="border-t border-gray-200 pt-4">
                  <Label className="text-sm font-medium mb-2 block">Service Charge Acknowledgement</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start gap-2 hover:bg-orange-50 hover:border-orange-500"
                    onClick={async () => {
                      try {
                        const token = localStorage.getItem("authToken");
                        if (!token) {
                          toast.error("Authentication required");
                          return;
                        }
                        const blob = await downloadServiceChargeAcknowledgement(unit.id, token);
                        const url = window.URL.createObjectURL(blob);
                        const link = document.createElement("a");
                        link.href = url;
                        link.download = `Service_Charge_Acknowledgement_${unit.unit}.pdf`;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        window.URL.revokeObjectURL(url);
                        toast.success("PDF downloaded successfully!");
                      } catch (error) {
                        toast.error("Failed to download PDF");
                        console.error(error);
                      }
                    }}
                  >
                    <Download className="w-4 h-4 text-orange-600" />
                    <span className="text-sm">Download Service Charge Acknowledgement (Pre-filled)</span>
                  </Button>
                  <p className="text-xs text-gray-500 mt-1">
                    This template is included in the initial handover notice and auto-filled with owner information.
                  </p>
                </div>

                {/* Utilities Registration Guide */}
                <div className="border-t border-gray-200 pt-4">
                  <Label className="text-sm font-medium mb-2 block">Utilities Registration Guide</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start gap-2 hover:bg-orange-50 hover:border-orange-500"
                    onClick={async () => {
                      try {
                        const token = localStorage.getItem("authToken");
                        if (!token) {
                          toast.error("Authentication required");
                          return;
                        }
                        const blob = await downloadUtilitiesGuide(unit.id, token);
                        const url = window.URL.createObjectURL(blob);
                        const link = document.createElement("a");
                        link.href = url;
                        link.download = `Utilities_Registration_Guide_${unit.unit}.pdf`;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        window.URL.revokeObjectURL(url);
                        toast.success("PDF downloaded successfully!");
                      } catch (error) {
                        toast.error("Failed to download PDF");
                        console.error(error);
                      }
                    }}
                  >
                    <Download className="w-4 h-4 text-orange-600" />
                    <span className="text-sm">Download Utilities Registration Guide (Pre-filled)</span>
                  </Button>
                  <p className="text-xs text-gray-500 mt-1">
                    This guide is included in the initial handover notice and auto-filled with DEWA premise number.
                  </p>
                </div>

                {/* Other Handover Notice Attachments */}
                <div className="border-t border-gray-200 pt-4">
                  <Label className="text-sm font-medium mb-2 block">Additional Resources</Label>
                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start gap-2 hover:bg-blue-50 hover:border-blue-500"
                      onClick={() => {
                        const link = document.createElement("a");
                        link.href = `${API_BASE_URL.replace('/api', '')}/storage/handover-notice-attachments/viera-residences/Utilities Registration Guide.pdf`;
                        link.target = "_blank";
                        link.click();
                      }}
                    >
                      <FileText className="w-4 h-4 text-blue-600" />
                      <span className="text-sm">Utilities Registration Guide</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-start gap-2 hover:bg-blue-50 hover:border-blue-500"
                      onClick={() => {
                        const link = document.createElement("a");
                        link.href = `${API_BASE_URL.replace('/api', '')}/storage/handover-notice-attachments/viera-residences/Viera Residences - Escrow Acc.pdf`;
                        link.target = "_blank";
                        link.click();
                      }}
                    >
                      <FileText className="w-4 h-4 text-blue-600" />
                      <span className="text-sm">Viera Residences - Escrow Account</span>
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    &#9432; These documents are included in the handover notice email
                  </p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button 
              variant="outline" 
              onClick={() => setShowEmailPreview(false)}
              disabled={sendingHandoverEmail}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSendHandoverEmail}
              disabled={sendingHandoverEmail || soaAttachments.length === 0}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Mail className="w-4 h-4 mr-2" />
              {sendingHandoverEmail ? "Sending..." : "Send Email Now"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Developer Requirements Preview Dialog */}
      <Dialog open={showDeveloperPreview} onOpenChange={setShowDeveloperPreview}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-blue-600" />
              Preview Developer Email
            </DialogTitle>
            <DialogDescription>
              Review the email and attachments before sending to the developer
            </DialogDescription>
          </DialogHeader>

          {developerPreview && (
            <div className="flex-1 overflow-auto space-y-4 py-4">
              {/* Email Details */}
              <div className="space-y-3">
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="font-medium text-gray-700">To:</p>
                      <p className="text-gray-900">{developerPreview.recipient_email}</p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-700">Subject:</p>
                      <p className="text-gray-900">{developerPreview.subject}</p>
                    </div>
                  </div>
                </div>

                {/* Unit Information */}
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <h3 className="font-semibold text-sm mb-2">Unit Information</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-gray-600">Unit:</span>
                      <span className="ml-2 font-medium">{developerPreview.unit.unit}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Project:</span>
                      <span className="ml-2 font-medium">{developerPreview.unit.project_name}</span>
                    </div>
                  </div>
                </div>

                {/* Owner Information */}
                <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                  <h3 className="font-semibold text-sm mb-2">Owner Information</h3>
                  <div className="space-y-1 text-sm">
                    <div>
                      <span className="text-gray-600">Name:</span>
                      <span className="ml-2 font-medium">{developerPreview.owner.full_name}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Email:</span>
                      <span className="ml-2 font-medium">{developerPreview.owner.email}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Phone:</span>
                      <span className="ml-2 font-medium">{developerPreview.owner.mobile_number}</span>
                    </div>
                  </div>
                </div>

                {/* Attachments */}
                <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                  <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                    <Paperclip className="w-4 h-4" />
                    Attachments ({developerPreview.documents.length})
                  </h3>
                  <div className="space-y-2">
                    {developerPreview.documents.map((doc: any) => {
                      const typeLabels: {[key: string]: string} = {
                        payment_proof: '100% SOA Receipt',
                        ac_connection: 'AC Connection',
                        dewa_connection: 'DEWA Connection',
                        service_charge_ack_buyer: 'Service Charge Acknowledgement (Buyer Signed)',
                        bank_noc: 'Bank NOC'
                      };
                      
                      return (
                        <div key={doc.id} className="flex items-center justify-between bg-white p-3 rounded border border-purple-300">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <FileText className="w-4 h-4 text-purple-600 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{typeLabels[doc.type] || doc.type}</p>
                              <p className="text-xs text-gray-500 truncate">{doc.filename}</p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="flex-shrink-0"
                            onClick={() => window.open(doc.full_url, '_blank')}
                            title="View document"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Next Steps Info */}
                <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
                  <h3 className="font-semibold text-sm mb-2">What happens next?</h3>
                  <ol className="text-xs text-gray-700 space-y-1 ml-4 list-decimal">
                    <li>Developer will receive an email with all buyer documents</li>
                    <li>Developer reviews documents and signs required forms</li>
                    <li>Developer uploads signed Service Charge Ack and NOC</li>
                    <li>System notifies you when developer requirements are complete</li>
                  </ol>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button 
              variant="outline" 
              onClick={() => setShowDeveloperPreview(false)}
              disabled={sendingToDeveloper}
            >
              Cancel
            </Button>
            <Button 
              onClick={confirmSendToDeveloper}
              disabled={sendingToDeveloper}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Mail className="w-4 h-4 mr-2" />
              {sendingToDeveloper ? "Sending..." : "Send to Developer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Details Dialog */}
      <Dialog open={paymentDetailsDialogOpen} onOpenChange={setPaymentDetailsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Enter Payment Details & Generate SOA</DialogTitle>
            <DialogDescription>
              Fill in the payment details for Unit {unit?.unit}. All fields are optional. Negative values are allowed for outstanding balance.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="total_unit_price">Total Unit Price (AED)</Label>
              <Input
                id="total_unit_price"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={paymentDetails.total_unit_price || ''}
                onChange={(e) => setPaymentDetails({
                  ...paymentDetails,
                  total_unit_price: e.target.value ? parseFloat(e.target.value) : null
                })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dld_fees">DLD Fees (AED)</Label>
              <Input
                id="dld_fees"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={paymentDetails.dld_fees || ''}
                onChange={(e) => setPaymentDetails({
                  ...paymentDetails,
                  dld_fees: e.target.value ? parseFloat(e.target.value) : null
                })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="admin_fee">Admin Fee (AED)</Label>
              <Input
                id="admin_fee"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={paymentDetails.admin_fee || ''}
                onChange={(e) => setPaymentDetails({
                  ...paymentDetails,
                  admin_fee: e.target.value ? parseFloat(e.target.value) : null
                })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount_to_pay">Total Amount to Pay (AED)</Label>
              <Input
                id="amount_to_pay"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={paymentDetails.amount_to_pay || ''}
                onChange={(e) => setPaymentDetails({
                  ...paymentDetails,
                  amount_to_pay: e.target.value ? parseFloat(e.target.value) : null
                })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="total_amount_paid">Total Amount Paid (AED)</Label>
              <Input
                id="total_amount_paid"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={paymentDetails.total_amount_paid || ''}
                onChange={(e) => setPaymentDetails({
                  ...paymentDetails,
                  total_amount_paid: e.target.value ? parseFloat(e.target.value) : null
                })}
              />
            </div>

            {!paymentDetails.has_pho && (
              <div className="space-y-2">
                <Label htmlFor="outstanding_amount">Outstanding Balance (AED)</Label>
                <Input
                  id="outstanding_amount"
                  type="number"
                  step="0.01"
                  placeholder="0.00 (negative for overpayment)"
                  value={paymentDetails.outstanding_amount || ''}
                  onChange={(e) => setPaymentDetails({
                    ...paymentDetails,
                    outstanding_amount: e.target.value ? parseFloat(e.target.value) : null
                  })}
                  className={paymentDetails.outstanding_amount && paymentDetails.outstanding_amount < 0 ? 'border-green-500' : ''}
                />
                <p className="text-xs text-gray-500">
                  Positive = amount due | Negative = overpaid | Zero = fully paid
                </p>
              </div>
            )}

            {paymentDetails.has_pho && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="upon_completion_amount">Upon Completion Amount To Pay (AED)</Label>
                  <Input
                    id="upon_completion_amount"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={paymentDetails.upon_completion_amount || ''}
                    onChange={(e) => setPaymentDetails({
                      ...paymentDetails,
                      upon_completion_amount: e.target.value ? parseFloat(e.target.value) : null
                    })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="due_after_completion">Due After Completion (AED)</Label>
                  <Input
                    id="due_after_completion"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={paymentDetails.due_after_completion || ''}
                    onChange={(e) => setPaymentDetails({
                      ...paymentDetails,
                      due_after_completion: e.target.value ? parseFloat(e.target.value) : null
                    })}
                  />
                  <p className="text-xs text-gray-500">
                    Amount remaining after completion payment
                  </p>
                </div>
              </>
            )}
          </div>

          <div className="flex items-center space-x-2 pt-2 border-t">
            <input
              type="checkbox"
              id="has_pho"
              checked={paymentDetails.has_pho}
              onChange={(e) => setPaymentDetails({
                ...paymentDetails,
                has_pho: e.target.checked,
                // Clear fields when switching
                outstanding_amount: e.target.checked ? null : paymentDetails.outstanding_amount,
                upon_completion_amount: e.target.checked ? paymentDetails.upon_completion_amount : null,
                due_after_completion: e.target.checked ? paymentDetails.due_after_completion : null,
              })}
              className="h-4 w-4 rounded border-gray-300"
            />
            <label htmlFor="has_pho" className="text-sm font-medium">
              With PHO (Payment Handover Option)
            </label>
          </div>
          <p className="text-xs text-gray-500">
            {paymentDetails.has_pho 
              ? 'SOA will show: Total Amount Paid, Upon Completion Amount To Pay, Due After Completion' 
              : 'SOA will show: Total Amount Paid, Outstanding Balance'}
          </p>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPaymentDetailsDialogOpen(false)}
              disabled={updatingPaymentDetails}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdatePaymentDetailsAndGenerateSOA}
              disabled={updatingPaymentDetails}
              className="bg-green-600 hover:bg-green-700"
            >
              <FileText className="w-4 h-4 mr-2" />
              {updatingPaymentDetails ? "Generating..." : "Update & Generate SOA"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
