"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { getUserById, updatePaymentStatus, addUserRemark, sendSOAEmail, User, UserAttachment, getHandoverStatus, HandoverStatus, updateMortgageStatus, sendBookingLink } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ArrowLeft, FileText, Download, Building2, Home, Calendar, CreditCard, Upload, CheckCircle, Mail, Image as ImageIcon, File, Eye, Paperclip, Check, X, Link as LinkIcon, Send, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export default function UserDetailPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params.id as string;
  
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [remarks, setRemarks] = useState<Array<{date: string, time: string, event: string, type?: string, admin_name?: string}>>([]);
  const [newRemark, setNewRemark] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<string>("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [updating, setUpdating] = useState(false);
  const [updateSuccess, setUpdateSuccess] = useState(false);
  const [savingRemark, setSavingRemark] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [soaFile, setSoaFile] = useState<File | null>(null);
  const [uploadingSOA, setUploadingSOA] = useState(false);

  // Handover checklist state
  const [handoverStatus, setHandoverStatus] = useState<HandoverStatus | null>(null);
  const [uploadingHandover, setUploadingHandover] = useState<{[key: string]: boolean}>({});
  const [sendingBookingLink, setSendingBookingLink] = useState(false);

  // Document viewer state
  const [viewingDocument, setViewingDocument] = useState<UserAttachment | null>(null);

  // Delete confirmation dialog state
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    attachmentId: number | null;
    filename: string;
  }>({ isOpen: false, attachmentId: null, filename: '' });

  // Payment status modal state
  const [paymentStatusModalOpen, setPaymentStatusModalOpen] = useState(false);

  useEffect(() => {
    const fetchUserDetails = async () => {
      try {
        const token = localStorage.getItem("authToken");
        const isAdmin = localStorage.getItem("isAdmin");

        if (!token || isAdmin !== "true") {
          router.push("/login");
          return;
        }

        const userData = await getUserById(parseInt(userId), token);
        
        // Ensure handover_email_sent field is properly set
        // Check if user has handover email sent status or if there are email-related remarks
        const remarks = Array.isArray(userData.remarks) ? userData.remarks : [];
        const hasEmailSentRemark = remarks.some(remark => 
          remark && remark.event && 
          remark.event.toLowerCase().includes('handover') && 
          remark.event.toLowerCase().includes('email')
        );
        
        // Set user data with proper handover email status
        setUser({
          ...userData,
          handover_email_sent: Boolean(userData.handover_email_sent) || hasEmailSentRemark,
          handover_email_sent_at: userData.handover_email_sent_at || undefined
        });
        
        setPaymentStatus(userData.payment_status);
        setRemarks(Array.isArray(userData.remarks) ? userData.remarks : []);

        // Fetch handover status
        try {
          const status = await getHandoverStatus(parseInt(userId), token);
          if (status && Array.isArray(status.requirements)) {
            setHandoverStatus(status);
          }
        } catch (error) {
          console.error("Failed to fetch handover status:", error);
          // Set a default empty state
          setHandoverStatus({
            handover_ready: false,
            has_mortgage: false,
            requirements: []
          });
        }
      } catch (error) {
        console.error("Failed to fetch user:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserDetails();
  }, [userId, router]);

  const refreshHandoverStatus = async () => {
    try {
      const token = localStorage.getItem("authToken");
      if (!token) return;
      
      const status = await getHandoverStatus(parseInt(userId), token);
      setHandoverStatus(status);
      
      // Also refresh user data to get updated handover_ready status
      const userData = await getUserById(parseInt(userId), token);
      // Preserve handover email status when refreshing user data
      setUser(prevUser => prevUser ? {
        ...userData,
        handover_email_sent: prevUser.handover_email_sent,
        handover_email_sent_at: prevUser.handover_email_sent_at
      } : userData);
    } catch (error) {
      console.error("Failed to refresh handover status:", error);
    }
  };

  const handleUpdatePaymentStatus = async () => {
    if (!user) return;

    // Validate receipt for fully_paid
    if (paymentStatus === "fully_paid" && !receiptFile) {
      toast.error("Please upload a receipt for fully paid status");
      return;
    }

    setUpdating(true);
    setUpdateSuccess(false);

    try {
      const token = localStorage.getItem("authToken");
      if (!token) {
        router.push("/login");
        return;
      }

      const updatedUser = await updatePaymentStatus(
        user.id,
        paymentStatus,
        token,
        receiptFile || undefined
      );

      // Preserve relationships and handover email status when updating user state
      setUser(prevUser => prevUser ? {
        ...prevUser,
        ...updatedUser,
        // Preserve relationships that might not be returned from the update endpoint
        units: prevUser.units,
        attachments: prevUser.attachments,
        remarks: prevUser.remarks,
        handover_email_sent: prevUser.handover_email_sent,
        handover_email_sent_at: prevUser.handover_email_sent_at
      } : updatedUser);
      setUpdateSuccess(true);
      setReceiptFile(null);
      
      // Refresh handover status to reflect payment updates
      await refreshHandoverStatus();
      
      // Refresh remarks to show the payment update remark
      const refreshedUser = await getUserById(parseInt(userId), token);
      setRemarks(Array.isArray(refreshedUser.remarks) ? refreshedUser.remarks : []);
      
      // Reset success message after 3 seconds
      setTimeout(() => setUpdateSuccess(false), 3000);
    } catch (error) {
      console.error("Failed to update payment status:", error);
      toast.error("Failed to update payment status. Please try again.");
    } finally {
      setUpdating(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setReceiptFile(e.target.files[0]);
    }
  };

  const handleSOAFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSoaFile(e.target.files[0]);
    }
  };

  const handleUploadSOA = async () => {
    if (!soaFile || !user) return;

    setUploadingSOA(true);
    try {
      const token = localStorage.getItem("authToken");
      if (!token) {
        toast.error("You must be logged in");
        return;
      }

      const formData = new FormData();
      formData.append("file", soaFile);
      formData.append("type", "soa");

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/${user.id}/upload-attachment`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to upload SOA");
      }

      toast.success("SOA uploaded successfully");
      setSoaFile(null);
      
      // Refresh user data while preserving handover email status
      const updatedUser = await getUserById(parseInt(userId), token);
      setUser(prevUser => prevUser ? {
        ...updatedUser,
        handover_email_sent: prevUser.handover_email_sent,
        handover_email_sent_at: prevUser.handover_email_sent_at
      } : updatedUser);
      setRemarks(Array.isArray(updatedUser.remarks) ? updatedUser.remarks : []);
      
      // Refresh handover status
      await refreshHandoverStatus();
    } catch (error: any) {
      toast.error(error.message || "Failed to upload SOA");
    } finally {
      setUploadingSOA(false);
    }
  };

  const handleUploadHandoverDocument = async (type: string, file: File) => {
    if (!user) return;

    setUploadingHandover(prev => ({ ...prev, [type]: true }));
    try {
      const token = localStorage.getItem("authToken");
      if (!token) {
        toast.error("You must be logged in");
        return;
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", type);

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/${user.id}/upload-attachment`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to upload document");
      }

      toast.success("Document uploaded successfully");
      
      // Refresh user data and handover status while preserving handover email status
      const updatedUser = await getUserById(parseInt(userId), token);
      setUser(prevUser => prevUser ? {
        ...updatedUser,
        handover_email_sent: prevUser.handover_email_sent,
        handover_email_sent_at: prevUser.handover_email_sent_at
      } : updatedUser);
      setRemarks(Array.isArray(updatedUser.remarks) ? updatedUser.remarks : []);
      await refreshHandoverStatus();
    } catch (error: any) {
      toast.error(error.message || "Failed to upload document");
    } finally {
      setUploadingHandover(prev => ({ ...prev, [type]: false }));
    }
  };

  const handleDeleteAttachment = async (attachmentId: number, filename: string) => {
    if (!user) return;
    
    // Show confirmation dialog
    setDeleteConfirmation({
      isOpen: true,
      attachmentId,
      filename
    });
  };

  const confirmDeleteAttachment = async () => {
    const { attachmentId } = deleteConfirmation;
    if (!user || !attachmentId) return;
    
    try {
      const token = localStorage.getItem("authToken");
      if (!token) {
        toast.error("You must be logged in");
        return;
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/${user.id}/attachments/${attachmentId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to delete document");
      }

      toast.success("Document deleted successfully");
      
      // Refresh user data while preserving handover email status
      const updatedUser = await getUserById(parseInt(userId), token);
      setUser(prevUser => prevUser ? {
        ...updatedUser,
        handover_email_sent: prevUser.handover_email_sent,
        handover_email_sent_at: prevUser.handover_email_sent_at
      } : updatedUser);
      setRemarks(Array.isArray(updatedUser.remarks) ? updatedUser.remarks : []);
      
      // Refresh handover status
      await refreshHandoverStatus();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete document");
    } finally {
      // Close confirmation dialog
      setDeleteConfirmation({ isOpen: false, attachmentId: null, filename: '' });
    }
  };

  const handleSendBookingLink = async () => {
    if (!user) return;

    setSendingBookingLink(true);
    try {
      const token = localStorage.getItem("authToken");
      if (!token) {
        toast.error("You must be logged in");
        return;
      }

      const result = await sendBookingLink(user.id, token);
      toast.success(`Booking links sent to ${result.recipients} recipient(s)`);
      
      // Refresh user data to show new remarks while preserving handover email status
      const updatedUser = await getUserById(parseInt(userId), token);
      setUser(prevUser => prevUser ? {
        ...updatedUser,
        handover_email_sent: prevUser.handover_email_sent,
        handover_email_sent_at: prevUser.handover_email_sent_at
      } : updatedUser);
      setRemarks(Array.isArray(updatedUser.remarks) ? updatedUser.remarks : []);
    } catch (error: any) {
      toast.error(error.message || "Failed to send booking links");
    } finally {
      setSendingBookingLink(false);
    }
  };

  const handleToggleMortgage = async () => {
    if (!user || !handoverStatus) return;

    try {
      const token = localStorage.getItem("authToken");
      if (!token) {
        toast.error("You must be logged in");
        return;
      }

      const result = await updateMortgageStatus(user.id, !handoverStatus.has_mortgage, token);
      toast.success("Mortgage status updated");
      
      // Refresh handover status and user data while preserving units, attachments, and other relationships
      await refreshHandoverStatus();
      setUser(prevUser => prevUser ? {
        ...prevUser,
        ...result.user,
        // Preserve relationships that aren't returned from the update endpoint
        units: prevUser.units,
        attachments: prevUser.attachments,
        handover_email_sent: prevUser.handover_email_sent,
        handover_email_sent_at: prevUser.handover_email_sent_at
      } : result.user);
      
      // Refresh remarks to show the mortgage status update remark
      const refreshedUser = await getUserById(parseInt(userId), token);
      setRemarks(Array.isArray(refreshedUser.remarks) ? refreshedUser.remarks : []);
    } catch (error: any) {
      toast.error(error.message || "Failed to update mortgage status");
    }
  };

  const handleSendInitializationEmail = async () => {
    if (!user) return;

    console.log('=== handleSendInitializationEmail called ===');
    console.log('User:', user.full_name, user.email);
    
    setSendingEmail(true);
    setShowEmailPreview(false);
    
    try {
      const token = localStorage.getItem("authToken");
      if (!token) {
        toast.error("You must be logged in");
        setSendingEmail(false);
        return;
      }

      // Get co-owners from user's units
      const coOwnerIds = new Set<number>();
      user.units?.forEach(unit => {
        unit.users?.forEach(u => {
          if (u.id !== user.id) {
            coOwnerIds.add(u.id);
          }
        });
      });

      // Include primary user and co-owners
      const recipientIds = [user.id, ...Array.from(coOwnerIds)];
      const subject = "Handover Notice";
      const message = ""; // Message is now handled by Laravel blade template
      
      console.log('Sending to recipient IDs:', recipientIds);
      console.log('Subject:', subject);
      console.log('Message:', message);
      console.log('Auth token:', token ? 'Present' : 'Missing');
      
      toast.info("Sending email...");
      
      const result = await sendSOAEmail(recipientIds, subject, message, token);
      
      console.log('Email send result:', result);
      
      if (coOwnerIds.size > 0) {
        toast.success(`Handover Notice sent to ${user.email} and ${coOwnerIds.size} co-owner(s)`);
      } else {
        toast.success(`Handover Notice sent successfully to ${user.email}`);
      }
      
      // Update user state to show handover_email_sent immediately
      setUser(prevUser => prevUser ? {
        ...prevUser,
        handover_email_sent: true,
        handover_email_sent_at: new Date().toISOString()
      } : null);
      
      // Refresh user data to get updated remarks
      const updatedUser = await getUserById(parseInt(userId), token);
      setRemarks(Array.isArray(updatedUser.remarks) ? updatedUser.remarks : []);
    } catch (error: any) {
      console.error('Failed to send email:', error);
      toast.error(error.message || "Failed to send email");
    } finally {
      setSendingEmail(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading user details...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">User not found</p>
          <Button onClick={() => router.push("/admin")} className="mt-4">
            Back to Admin
          </Button>
        </div>
      </div>
    );
  }

  const getPaymentStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline", label: string }> = {
      pending: { variant: "destructive", label: "Pending" },
      partial: { variant: "secondary", label: "Partial" },
      fully_paid: { variant: "default", label: "Fully Paid" },
    };
    const config = variants[status] || variants.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  // Get preview image (prefer passport, Emirates ID, or visa)
  const previewImage = user.attachments?.find(att => 
    att.type === 'passport' || att.type === 'emirates_id' || att.type === 'visa' || 
    att.filename.match(/\.(jpg|jpeg|png|gif|webp)$/i)
  );

  // Separate SOA from other attachments
  const soaAttachments = user.attachments?.filter(att => att.type === "soa") || [];
  
  // Get handover requirement types to exclude from other attachments
  const handoverTypes = handoverStatus?.requirements?.map(req => req.type) || [];
  const otherAttachments = user.attachments?.filter(att => 
    att.type !== "soa" && !handoverTypes.includes(att.type)
  ) || [];

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
              <h1 className="text-3xl font-bold text-gray-900">{user.full_name}</h1>
              <p className="text-gray-600">{user.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {user.handover_email_sent === true && (
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
              const hasSOA = user.attachments?.some(att => att.type === "soa");
              return (
                <Button
                  onClick={() => {
                    if (!hasSOA) {
                      toast.error("Please upload SOA before sending initialization email");
                      return;
                    }
                    setShowEmailPreview(true);
                  }}
                  disabled={sendingEmail || !hasSOA}
                  className={`flex items-center gap-2 ${!hasSOA ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <Eye className="w-4 h-4" />
                  Preview & Send Handover Notice
                </Button>
              );
            })()}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - User Info & Units */}
          <div className="lg:col-span-2 space-y-6">

            {/* User Information */}
            <Card>
              <CardHeader>
                <CardTitle>User Information</CardTitle>
                <CardDescription>Basic details and payment status</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Full Name</p>
                    <p className="font-medium">{user.full_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Email</p>
                    <p className="font-medium">{user.email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Mobile Number</p>
                    <p className="font-medium">{user.mobile_number}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Payment Status</p>
                    <div className="mt-1">{getPaymentStatusBadge(user.payment_status)}</div>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Payment Date</p>
                    <div className="flex items-center gap-2 mt-1">
                      {user.payment_date ? (
                        <>
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <p className="font-medium">{format(new Date(user.payment_date), "MMM d, yyyy")}</p>
                        </>
                      ) : (
                        <p className="text-gray-400">Not paid yet</p>
                      )}
                    </div>
                  </div>
                  {user.payment_status === "fully_paid" && user.payment_date && (
                    <div>
                      <p className="text-sm text-gray-500">Fully Paid On</p>
                      <div className="flex items-center gap-2 mt-1">
                        <CreditCard className="w-4 h-4 text-green-600" />
                        <p className="font-medium text-green-600">{format(new Date(user.payment_date), "MMM d, yyyy")}</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Unit Details */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  Unit Details
                </CardTitle>
                <CardDescription>Properties and units owned by this user</CardDescription>
              </CardHeader>
              <CardContent>
                {user.units && user.units.length > 0 ? (
                  <div className="space-y-4">
                    {user.units.map((unit, index) => (
                      <div key={unit.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Home className="w-4 h-4 text-gray-400" />
                              <h3 className="font-semibold text-lg">{unit.property.project_name}</h3>
                              {unit.pivot?.is_primary === false && (
                                <Badge variant="outline">Co-buyer</Badge>
                              )}
                            </div>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <p className="text-gray-500">Unit Number</p>
                                <p className="font-medium">{unit.unit}</p>
                              </div>
                              <div>
                                <p className="text-gray-500">Location</p>
                                <p className="font-medium">{unit.property.location}</p>
                              </div>
                              <div>
                                <p className="text-gray-500">Status</p>
                                <Badge variant={unit.status === "claimed" ? "default" : "secondary"}>
                                  {unit.status}
                                </Badge>
                              </div>
                              <div>
                                <p className="text-gray-500">Ownership</p>
                                <p className="font-medium">
                                  {unit.pivot?.is_primary === false ? "Joint Owner" : "Primary Owner"}
                                </p>
                              </div>
                            </div>
                            
                            {/* Co-owners section */}
                            {unit.users && unit.users.length > 1 && (
                              <div className="mt-4 pt-4 border-t border-gray-200">
                                <p className="text-sm text-gray-500 mb-2">Co-owners ({unit.users.length - 1})</p>
                                <div className="space-y-2">
                                  {unit.users
                                    .filter(u => u.id !== user.id)
                                    .map((coOwner) => (
                                      <div key={coOwner.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-2">
                                        <div>
                                          <p className="text-sm font-medium text-gray-900">{coOwner.full_name}</p>
                                          <p className="text-xs text-gray-500">{coOwner.email}</p>
                                        </div>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => router.push(`/admin/users/${coOwner.id}`)}
                                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                        >
                                          View Details
                                        </Button>
                                      </div>
                                    ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        {index < user.units!.length - 1 && <Separator className="mt-4" />}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-8">No units assigned</p>
                )}
              </CardContent>
            </Card>

            {/* Remarks Timeline */}
            <Card>
              <CardHeader>
                <CardTitle>Activity Timeline</CardTitle>
                <CardDescription>System events and internal notes</CardDescription>
              </CardHeader>
              <CardContent>
                {/* Timeline Display */}
                <div className="space-y-4 max-h-[400px] overflow-y-auto mb-6">
                  {remarks.length > 0 ? (
                    <div className="relative border-l-2 border-gray-300 pl-6 space-y-4">
                      {remarks.map((entry, index) => (
                        <div key={index} className="relative">
                          {/* Timeline dot */}
                          <div className="absolute -left-[26px] w-3 h-3 rounded-full bg-blue-600 border-2 border-white"></div>
                          
                          {/* Timeline content */}
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

                {/* Add New Remark */}
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

                            const result = await addUserRemark(parseInt(userId), newRemark, token);
                            setRemarks(result.remarks);
                            setNewRemark("");
                            
                            toast.success("Note added to timeline successfully");
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
          </div>

          {/* Right Column - Attachments */}
          <div className="space-y-6">

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
                    /* Existing SOA Documents */
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Current SOA Document</Label>
                      {soaAttachments.map((attachment) => (
                        <div
                          key={attachment.id}
                          className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <FileText className="w-4 h-4 text-blue-600 flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate">{attachment.filename}</p>
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
                              onClick={() => setViewingDocument(attachment)}
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
                            {user.payment_status !== "fully_paid" && (
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="flex-shrink-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => handleDeleteAttachment(attachment.id, attachment.filename)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                      <p className="text-xs text-gray-500 mt-2">
                        {user.payment_status === "fully_paid" 
                          ? "SOA cannot be deleted after payment is fully paid"
                          : "Delete the current SOA to upload a new one"
                        }
                      </p>
                    </div>
                  ) : (
                    /* Upload Section - Only show when no SOA exists */
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

            {/* Handover Requirements Checklist - Only show if handover email has been sent */}
            {user.handover_email_sent === true && (
              <Card className="border-2 border-blue-200 ">
                <CardHeader className="bg-blue-50 rounded-t-lg pb-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2 ">
                        <CheckCircle className="w-5 h-5 text-blue-600" />
                        Handover Requirements
                      </CardTitle>
                      <CardDescription className="">
                      {handoverStatus && handoverStatus.handover_ready ? (
                        <span className="text-green-600 font-medium flex items-center gap-1 mt-1">
                          <Check className="w-5 h-5" />
                          Requirements
                        </span>
                      ) : (
                        <span className="text-orange-600 text-sm flex items-center gap-1">
                          <X className="w-5 h-5" />
                          {handoverStatus?.requirements?.filter(r => !r.uploaded).length || 0} document(s) pending
                        </span>
                      )}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleToggleMortgage}
                      className={handoverStatus?.has_mortgage ? "bg-orange-50 border-orange-300" : ""}
                    >
                      {handoverStatus?.has_mortgage ? "Has Mortgage ✓" : "No Mortgage"}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                {handoverStatus && Array.isArray(handoverStatus.requirements) ? (
                  <div className="space-y-4">
                    {/* Checklist */}
                    {handoverStatus.requirements.map((req) => {
                      // Find associated files for this requirement type
                      const associatedFiles = user.attachments?.filter(att => att.type === req.type) || [];
                      
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
                                <h4 className={`font-medium ${
                                  req.uploaded ? 'text-green-800' : 'text-gray-900'
                                }`}>
                                  {req.label}
                                </h4>
                                <p className="text-xs text-gray-500 mt-1">
                                  {req.type === 'payment_proof' 
                                    ? (req.uploaded 
                                        ? 'Document uploaded ✓' 
                                        : 'Use "Update Payment" button above to upload receipt')
                                    : (req.uploaded ? 'Document uploaded ✓' : 'Upload required document')}
                                </p>
                                
                                {/* Show associated files */}
                                {associatedFiles.length > 0 && (
                                  <div className="mt-3 space-y-2">
                                    {associatedFiles.map((file) => (
                                      <div key={file.id} className="flex items-center gap-2 text-xs bg-white p-2 rounded border border-gray-200">
                                        <FileText className="w-3 h-3 text-blue-600 flex-shrink-0" />
                                        <span className="flex-1 truncate font-medium">{file.filename}</span>
                                        <Button 
                                          variant="ghost" 
                                          size="sm"
                                          className="h-6 w-6 p-0"
                                          onClick={() => setViewingDocument(file)}
                                        >
                                          <Eye className="w-3 h-3" />
                                        </Button>
                                        <Button 
                                          variant="ghost" 
                                          size="sm"
                                          className="h-6 w-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                          onClick={() => handleDeleteAttachment(file.id, file.filename)}
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </Button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            {!req.uploaded && req.type !== 'payment_proof' && (
                              <div className="flex-shrink-0">
                                <label className="cursor-pointer">
                                  <input
                                    type="file"
                                    accept=".pdf,.jpg,.jpeg,.png"
                                    className="hidden"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) {
                                        handleUploadHandoverDocument(req.type, file);
                                        e.target.value = ''; // Reset input
                                      }
                                    }}
                                    disabled={uploadingHandover[req.type]}
                                  />
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    disabled={uploadingHandover[req.type]}
                                    className="bg-blue-50 hover:bg-blue-100 border-blue-300"
                                    asChild
                                  >
                                    <span>
                                      <Upload className="w-4 h-4 mr-2" />
                                      {uploadingHandover[req.type] ? 'Uploading...' : 'Upload'}
                                    </span>
                                  </Button>
                                </label>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    <Separator className="my-6" />

                    {/* Send Booking Link Button */}
                    <div className="space-y-3">
                      <Button
                        onClick={handleSendBookingLink}
                        disabled={!handoverStatus.handover_ready || sendingBookingLink}
                        className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                        size="lg"
                      >
                        {sendingBookingLink ? (
                          <>Sending...</>
                        ) : handoverStatus.handover_ready ? (
                          <>
                            <Send className="w-4 h-4 mr-2" />
                            Send Booking Platform Link
                          </>
                        ) : (
                          <>
                            <X className="w-4 h-4 mr-2" />
                            Complete Requirements to Send Link
                          </>
                        )}
                      </Button>
                      
                      {!handoverStatus.handover_ready && (
                        <p className="text-xs text-center text-gray-500">
                          Upload all required documents above to enable sending the booking link
                        </p>
                      )}
                      
                      {handoverStatus.handover_ready === true && (
                        <p className="text-xs text-center text-green-600 font-medium">
                          ✓ All requirements met! You can now send the booking platform access link to the client(s)
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-500">Loading handover status...</p>
                  </div>
                )}
              </CardContent>
            </Card>
            )}

            {/* Other Attachments */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <File className="w-5 h-5" />
                  Other Attachments
                </CardTitle>
                <CardDescription>
                  {otherAttachments.length} document{otherAttachments.length !== 1 ? 's' : ''}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {otherAttachments.length > 0 ? (
                  <div className="space-y-2">
                    {otherAttachments.map((attachment) => {
                      const isImage = attachment.filename.match(/\.(jpg|jpeg|png|gif|webp)$/i);
                      
                      return (
                        <div
                          key={attachment.id}
                          className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            {isImage ? (
                              <ImageIcon className="w-4 h-4 text-purple-600 flex-shrink-0" />
                            ) : (
                              <FileText className="w-4 h-4 text-gray-600 flex-shrink-0" />
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate">{attachment.filename}</p>
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
                              onClick={() => setViewingDocument(attachment)}
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
                  <div className="text-center py-8 text-gray-500">
                    <File className="w-12 h-12 mx-auto mb-2 opacity-20" />
                    <p className="text-sm">No attachments uploaded</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Email Preview Dialog */}
      <Dialog open={showEmailPreview} onOpenChange={setShowEmailPreview}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5" />
              Email Preview - Handover Notice
            </DialogTitle>
            <DialogDescription>
              Review the email content and attachments before sending
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Recipients Section */}
            <div className="space-y-2">
              <Label className="text-base font-semibold">Recipients</Label>
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">To:</p>
                    <div className="space-y-1.5">
                      <div className="flex items-start gap-2">
                        <span className="text-sm font-medium text-blue-600">•</span>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{user.full_name}</p>
                          <p className="text-xs text-gray-600">{user.email}</p>
                        </div>
                      </div>
                      {(() => {
                        // Get unique co-owners
                        const coOwnersMap = new Map();
                        user.units?.forEach(unit => {
                          unit.users?.forEach(u => {
                            if (u.id !== user.id && !coOwnersMap.has(u.id)) {
                              coOwnersMap.set(u.id, {
                                id: u.id,
                                name: u.full_name,
                                email: u.email
                              });
                            }
                          });
                        });
                        const coOwners = Array.from(coOwnersMap.values());
                        
                        return coOwners.map(coOwner => (
                          <div key={coOwner.id} className="flex items-start gap-2">
                            <span className="text-sm font-medium text-blue-600">•</span>
                            <div>
                              <p className="text-sm font-medium text-gray-900">{coOwner.name}</p>
                              <p className="text-xs text-gray-600">{coOwner.email}</p>
                            </div>
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
                  {user.units?.some(unit => unit.users && unit.users.some(u => u.id !== user.id)) && (
                    <div className="p-2 bg-blue-50 border border-blue-200 rounded">
                      <p className="text-xs text-blue-800">
                        ℹ️ All recipients will receive this email together in the To: field
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
                <p className="text-sm font-medium">Handover Notice</p>
              </div>
            </div>

            {/* Email Content Preview */}
            <div className="space-y-2">
              <Label className="text-base font-semibold">Email Content</Label>
              <div className="bg-white rounded-lg border-2 border-gray-300 p-6 max-h-[400px] overflow-y-auto">
                <div className="space-y-4 text-sm">
                  <p>Dear {user.full_name.split(' ')[0]},</p>
                  
                  <p>We are pleased to inform you that your unit at Viera Residences is now ready for final handover following the issuance of the Building Completion Certificate by the Dubai Development Authority.</p>
                  
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
                  
                  <p>We look forward to welcoming you to your new home at <strong>Viera Residences</strong>.</p>
                  
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
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                {soaAttachments.length > 0 ? (
                  <div className="space-y-2">
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
                          onClick={() => setViewingDocument(attachment)}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          View
                        </Button>
                        <Badge variant="outline" className="text-xs">PDF</Badge>
                      </div>
                    ))}
                    
                    <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded">
                      <p className="text-xs text-green-800">
                        ✓ SOA document{soaAttachments.length > 1 ? 's' : ''} will be attached to this email
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-red-50 border border-red-200 rounded">
                    <p className="text-sm text-red-800 font-medium">
                      ⚠️ No SOA uploaded yet. Please upload SOA before sending.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button 
              variant="outline" 
              onClick={() => setShowEmailPreview(false)}
              disabled={sendingEmail}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSendInitializationEmail}
              disabled={sendingEmail}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Mail className="w-4 h-4 mr-2" />
              {sendingEmail ? "Sending..." : "Send Email Now"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Document Viewer Dialog */}
      <Dialog open={!!viewingDocument} onOpenChange={() => setViewingDocument(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              {viewingDocument?.filename}
            </DialogTitle>
            <DialogDescription>
              <div className="flex items-center gap-3 mt-2">
                <Badge variant="outline">{viewingDocument?.type}</Badge>
                {viewingDocument && (
                  <span className="text-xs text-gray-500">
                    {format(new Date(viewingDocument.created_at), "MMM d, yyyy 'at' h:mm a")}
                  </span>
                )}
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-auto bg-gray-50 rounded-lg p-4">
            {viewingDocument && (() => {
              const fileUrl = viewingDocument.full_url;
              const isImage = viewingDocument.filename.match(/\.(jpg|jpeg|png|gif|webp)$/i);
              const isPdf = viewingDocument.filename.match(/\.pdf$/i);

              if (isImage) {
                return (
                  <div className="flex items-center justify-center min-h-[400px]">
                    <img 
                      src={fileUrl} 
                      alt={viewingDocument.filename}
                      className="max-w-full max-h-[70vh] object-contain rounded"
                    />
                  </div>
                );
              } else if (isPdf) {
                return (
                  <iframe
                    src={fileUrl}
                    className="w-full h-[70vh] rounded border-0"
                    title={viewingDocument.filename}
                  />
                );
              } else {
                return (
                  <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
                    <FileText className="w-16 h-16 text-gray-400 mb-4" />
                    <p className="text-gray-600 mb-4">Preview not available for this file type</p>
                    <Button
                      onClick={() => window.open(fileUrl, '_blank')}
                      variant="outline"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download File
                    </Button>
                  </div>
                );
              }
            })()}
          </div>
          <DialogFooter className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={() => viewingDocument && window.open(viewingDocument.full_url, '_blank')}
            >
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
            <Button onClick={() => setViewingDocument(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Status Update Modal */}
      <Dialog open={paymentStatusModalOpen} onOpenChange={setPaymentStatusModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-blue-600" />
              Update Payment Status
            </DialogTitle>
            <DialogDescription>
              Change payment status and upload receipt if required
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Payment Status</Label>
              <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="partial">Partial</SelectItem>
                  <SelectItem value="fully_paid">Fully Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {paymentStatus === "fully_paid" && (
              <div className="space-y-2">
                <Label htmlFor="receipt">Receipt (Required) *</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="receipt"
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={handleFileChange}
                    className="flex-1"
                  />
                  {receiptFile && (
                    <Upload className="w-4 h-4 text-green-600" />
                  )}
                </div>
                {receiptFile && (
                  <p className="text-xs text-gray-600">
                    Selected: {receiptFile.name}
                  </p>
                )}
                <p className="text-xs text-gray-500">
                  Accepted formats: PDF, JPG, PNG (Max 10MB)
                </p>
              </div>
            )}

            {updateSuccess && (
              <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <p className="text-sm text-green-800 font-medium">
                  Payment status updated successfully!
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button 
              variant="outline" 
              onClick={() => setPaymentStatusModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                await handleUpdatePaymentStatus();
                if (!updating) {
                  setPaymentStatusModalOpen(false);
                }
              }}
              disabled={updating || (paymentStatus === "fully_paid" && !receiptFile)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {updating ? "Updating..." : "Update Payment Status"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog 
        open={deleteConfirmation.isOpen} 
        onOpenChange={(open) => !open && setDeleteConfirmation({ isOpen: false, attachmentId: null, filename: '' })}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="w-5 h-5" />
              Delete Document
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this document? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <div className="bg-gray-50 p-3 rounded-lg border">
              <p className="text-sm font-medium text-gray-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                {deleteConfirmation.filename}
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button 
              variant="outline" 
              onClick={() => setDeleteConfirmation({ isOpen: false, attachmentId: null, filename: '' })}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={confirmDeleteAttachment}
              className="bg-red-600 hover:bg-red-700"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
