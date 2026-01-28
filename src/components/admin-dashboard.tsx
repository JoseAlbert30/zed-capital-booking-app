import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Calendar as CalendarIcon, LogOut, Users, Clock, Trash2, DollarSign, CheckCircle, AlertCircle, XCircle, Ban, Filter, ChevronDown, ChevronUp, Copy, RefreshCw, CalendarCheck, Eye, Search, ArrowUp, Link2, Mail, Send, FileText, Image as ImageIcon, Paperclip, Building2, Upload, Download, Check, MoreVertical } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "./ui/dropdown-menu";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "./ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Calendar } from "./ui/calendar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { User, sendSOAEmail, cancelBooking, updateBooking, createUnit, bulkUploadUnits, createUserWithUnit, bulkUploadUsers, getAllUnits, completeHandover, getProjectTemplates, uploadHandoverFile, deleteHandoverFile, getSnaggingDefects, createSnaggingDefect, updateSnaggingDefect, deleteSnaggingDefect, downloadServiceChargeAcknowledgement, downloadAllSOAs } from "@/lib/api";
import { useRouter } from "next/navigation";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { toast } from "sonner";
import { Separator } from "./ui/separator";
import { Badge } from "./ui/badge";
import { PDFAnnotator } from "./pdf-annotator-canvas";
import { EmailProgressPopup } from "./EmailProgressPopup";
import { SOAProgressPopup } from "./SOAProgressPopup";

interface Booking {
  id: string;
  date: Date;
  time: string;
  customerEmail: string;
  status?: "confirmed" | "completed" | "cancelled" | "pending_poa_approval";
  is_owner_attending?: boolean;
  poa_document?: string | null;
  attorney_id_document?: string | null;
  poa_document_url?: string | null;
  attorney_id_document_url?: string | null;
  handover_checklist?: string | null;
  handover_declaration?: string | null;
  handover_photo?: string | null;
  client_signature?: string | null;
  handover_checklist_url?: string | null;
  handover_declaration_url?: string | null;
  handover_photo_url?: string | null;
  client_signature_url?: string | null;
  snagging_defects?: Array<{
    id: number;
    description: string;
    location: string;
    agreed_remediation_action: string;
    is_remediated: boolean;
    photo_path?: string;
  }>;
  user?: {
    id: number;
    full_name: string;
    email: string;
    payment_date?: string | null;
    units?: Array<{
      id: number;
      unit: string;
    }>;
  };
  co_owners?: Array<{
    id: number;
    full_name: string;
    email: string;
  }>;
}

interface AdminDashboardProps {
  userEmail: string;
  onLogout: () => void;
  bookings: Booking[];
  onDeleteBooking: (id: string) => void;
  onUpdateBooking: (id: string, date: Date, time: string) => void;
  users: User[];
  onUpdateUserPaymentStatus: (userId: number, status: User["payment_status"], paymentDate: Date | null, receiptFile?: File) => void;
  onRegeneratePassword: (email: string) => void;
  onFilterUsers: (filters: { search?: string; payment_status?: string; project?: string }) => void;
  onFilterBookings: (filters: { search?: string; status?: string; project?: string }) => void;
  authToken: string;
}

const TIME_SLOTS = [
  "09:00", "10:00", "11:00", "12:00", "13:00", "14:00",
  "15:00", "16:00", "17:00", "18:00", "19:00", "20:00"
];

export function AdminDashboard({ 
  userEmail, 
  onLogout, 
  bookings, 
  onDeleteBooking,
  onUpdateBooking,
  users,
  onUpdateUserPaymentStatus,
  onRegeneratePassword,
  onFilterUsers,
  onFilterBookings,
  authToken
}: AdminDashboardProps) {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [bookingsDateRange, setBookingsDateRange] = useState<{ from: Date | undefined, to: Date | undefined }>({ from: undefined, to: undefined });
  const [activeTab, setActiveTab] = useState<"bookings" | "users" | "units">("users");
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [newPaymentStatus, setNewPaymentStatus] = useState<User["payment_status"]>("pending");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [newBookingStatus, setNewBookingStatus] = useState<Booking["status"]>("confirmed");
  const [filterOpen, setFilterOpen] = useState(false);
  const [rebookingBooking, setRebookingBooking] = useState<Booking | null>(null);
  const [rebookDate, setRebookDate] = useState<Date>();
  const [rebookTime, setRebookTime] = useState<string>("");
  const [cancellingBooking, setCancellingBooking] = useState(false);
  const [rebookingInProgress, setRebookingInProgress] = useState(false);
  const [displayedUsersCount, setDisplayedUsersCount] = useState(10);
  const userListRef = useRef<HTMLDivElement>(null);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailRecipients, setEmailRecipients] = useState<User[]>([]);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [projectSelectOpen, setProjectSelectOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<string>("all");
  const [missingSOADialogOpen, setMissingSOADialogOpen] = useState(false);
  const [usersWithoutSOA, setUsersWithoutSOA] = useState<User[]>([]);
  const [addClientDialogOpen, setAddClientDialogOpen] = useState(false);
  const [bulkUploadDialogOpen, setBulkUploadDialogOpen] = useState(false);
  const [uploadUnitsDialogOpen, setUploadUnitsDialogOpen] = useState(false);
  const [addUnitDialogOpen, setAddUnitDialogOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadingBulkClients, setUploadingBulkClients] = useState(false);
  const [uploadUnitsFile, setUploadUnitsFile] = useState<File | null>(null);
  const [selectedProjectForClient, setSelectedProjectForClient] = useState<string>("");
  const [selectedProjectForBulk, setSelectedProjectForBulk] = useState<string>("");
  const [selectedProjectForUnits, setSelectedProjectForUnits] = useState<string>("");
  const [selectedProjectForNewUnit, setSelectedProjectForNewUnit] = useState<string>("");
  const [selectedUnitId, setSelectedUnitId] = useState<string>("");
  const [newUnitData, setNewUnitData] = useState({
    unit_number: "",
    floor: "",
    building: "",
    square_footage: "",
    dewa_premise_number: "",
  });
  const [newClientData, setNewClientData] = useState({
    full_name: "",
    email: "",
    unit_number: "",
    mobile_number: "",
    passport_number: "",
    is_primary: true,
  });
  const [allUnits, setAllUnits] = useState<any[]>([]);
  const [loadingUnits, setLoadingUnits] = useState(false);
  const [allUnitsForListing, setAllUnitsForListing] = useState<any[]>([]);
  const [loadingAllUnits, setLoadingAllUnits] = useState(false);
  
  // Unit Management filter states
  const [unitSearch, setUnitSearch] = useState("");
  const [unitSOAStatus, setUnitSOAStatus] = useState("all");
  const [unitPaymentStatus, setUnitPaymentStatus] = useState("all");
  const [unitHandoverStatus, setUnitHandoverStatus] = useState("all");
  const [unitHandoverRequirements, setUnitHandoverRequirements] = useState("all");
  const [unitBookingStatus, setUnitBookingStatus] = useState("all");
  const [bookingDateRange, setBookingDateRange] = useState<{ from: Date | undefined, to: Date | undefined }>({ from: undefined, to: undefined });

  // Handover completion states
  const [handoverBooking, setHandoverBooking] = useState<Booking | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Snagging defects state
  const [snaggingDefects, setSnaggingDefects] = useState<Array<{ 
    id: string; 
    serverId?: number;
    image: File | null; 
    imagePreview: string | null; 
    description: string;
    location: string;
    agreedRemediationAction: string;
    is_remediated?: boolean;
  }>>([]);
  const [expandedDefects, setExpandedDefects] = useState<Set<string>>(new Set());
  const [showSnaggingCamera, setShowSnaggingCamera] = useState(false);
  const [activeSnaggingDefectId, setActiveSnaggingDefectId] = useState<string | null>(null);
  const snaggingVideoRef = useRef<HTMLVideoElement>(null);
  const snaggingCanvasRef = useRef<HTMLCanvasElement>(null);

  // Celebration dialog state (for testing)
  const [showCelebration, setShowCelebration] = useState(false);

  // Bulk SOA upload states
  const [bulkSOADialogOpen, setBulkSOADialogOpen] = useState(false);
  const [soaFiles, setSOAFiles] = useState<File[]>([]);
  const [uploadingSOAs, setUploadingSOAs] = useState(false);

  // Bulk send handover states
  const [bulkHandoverDialogOpen, setBulkHandoverDialogOpen] = useState(false);
  const [selectedUnitsForHandover, setSelectedUnitsForHandover] = useState<Set<number>>(new Set());
  const [sendingHandovers, setSendingHandovers] = useState(false);
  
  // Bulk send SOA email states
  const [bulkSOAEmailDialogOpen, setBulkSOAEmailDialogOpen] = useState(false);
  const [sendingSOAEmails, setSendingSOAEmails] = useState(false);

  // POA approval states
  const [poaBooking, setPoaBooking] = useState<Booking | null>(null);
  const [poaActionLoading, setPoaActionLoading] = useState(false);
  const [poaRejectionReason, setPoaRejectionReason] = useState("");
  const [viewPoaDialogOpen, setViewPoaDialogOpen] = useState(false);
  
  // Email progress tracking
  const [emailProgressBatchId, setEmailProgressBatchId] = useState<string | null>(null);
  const [emailProgressOpen, setEmailProgressOpen] = useState(false);
  const [checkingEmailProgress, setCheckingEmailProgress] = useState(false);
  
  // SOA generation progress tracking
  const [soaProgressBatchId, setSOAProgressBatchId] = useState<string | null>(null);
  const [soaProgressOpen, setSOAProgressOpen] = useState(false);
  const [generatingSOAs, setGeneratingSOAs] = useState(false);
  const [checkingSOAProgress, setCheckingSOAProgress] = useState(false);
  const [downloadingAllSOAs, setDownloadingAllSOAs] = useState(false);
  
  // SOA regeneration confirmation
  const [soaRegenerationDialogOpen, setSOARegenerationDialogOpen] = useState(false);
  const [soaRegenerationData, setSOARegenerationData] = useState<{ unitsWithSoa: number; unitsWithoutSoa: number } | null>(null);

  // Payment details upload state
  const [paymentDetailsDialogOpen, setPaymentDetailsDialogOpen] = useState(false);
  const [withPho, setWithPho] = useState(false);
  const [paymentDetailsFile, setPaymentDetailsFile] = useState<File | null>(null);
  const [uploadingPaymentDetails, setUploadingPaymentDetails] = useState(false);
  const [selectedPropertyForPaymentDetails, setSelectedPropertyForPaymentDetails] = useState<string>("");
  const [uploadedUnitIds, setUploadedUnitIds] = useState<number[]>([]);

  // Check for active email batch
  const checkForActiveEmailBatch = async () => {
    setCheckingEmailProgress(true);
    
    // First check if we have a stored batch ID
    const storedBatchId = localStorage.getItem('currentEmailBatchId');
    
    if (storedBatchId) {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/units/handover-batch/${storedBatchId}/progress`,
          {
            headers: {
              Authorization: `Bearer ${authToken}`,
            },
          }
        );
        
        const data = await response.json();
        
        if (data.success) {
          // If batch is still in progress or just completed, show it
          if (data.batch.status !== 'completed' || data.batch.failed_count > 0) {
            setEmailProgressBatchId(storedBatchId);
            setEmailProgressOpen(true);
          } else {
            // Batch is completed with no failures, clear storage
            localStorage.removeItem('currentEmailBatchId');
            toast.info('No active email batches found');
          }
        }
      } catch (error) {
        console.error('Error checking email batch:', error);
        toast.error('Failed to check batch status');
      }
    } else {
      toast.info('No active email batches found');
    }
    
    setCheckingEmailProgress(false);
  };

  // Check for active SOA generation batch
  const checkForActiveSOABatch = async () => {
    setCheckingSOAProgress(true);
    
    // First check if we have a stored batch ID
    const storedBatchId = localStorage.getItem('currentSOABatchId');
    
    if (storedBatchId) {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/units/soa-batch/${storedBatchId}/progress`,
          {
            headers: {
              Authorization: `Bearer ${authToken}`,
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.batch.status !== 'completed') {
            // Active batch found
            setSOAProgressBatchId(storedBatchId);
            setSOAProgressOpen(true);
            setCheckingSOAProgress(false);
            return;
          } else if (data.success && data.batch.status === 'completed') {
            // Batch completed, clear from localStorage
            localStorage.removeItem('currentSOABatchId');
          }
        }
      } catch (error) {
        console.error('Error checking batch:', error);
      }
    }
    
    // No active batch found
    toast.info('No active SOA generation process found');
    setCheckingSOAProgress(false);
  };

  // Download all SOAs as zip
  const handleDownloadAllSOAs = async () => {
    setDownloadingAllSOAs(true);
    try {
      const blob = await downloadAllSOAs(authToken);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `all-soas-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('All SOAs downloaded successfully');
    } catch (error: any) {
      console.error('Error downloading SOAs:', error);
      toast.error(error.message || 'Failed to download SOAs');
    } finally {
      setDownloadingAllSOAs(false);
    }
  };

  // Helper function to get property ID by project name
  const getPropertyIdByName = (projectName: string): number | null => {
    const user = users.find(u => 
      u.units?.some(unit => unit.property.project_name === projectName)
    );
    return user?.units?.find(unit => unit.property.project_name === projectName)?.property.id || null;
  };

  // Fetch all units when component mounts or when selectedProjectForClient changes
  useEffect(() => {
    if (selectedProjectForClient && authToken) {
      const fetchUnits = async () => {
        setLoadingUnits(true);
        try {
          const propertyId = getPropertyIdByName(selectedProjectForClient);
          if (propertyId) {
            const response = await getAllUnits(authToken, propertyId, "unclaimed");
            setAllUnits(response.units || []);
          }
        } catch (error) {
          console.error("Failed to fetch units:", error);
          toast.error("Failed to load units");
        } finally {
          setLoadingUnits(false);
        }
      };
      fetchUnits();
    }
  }, [selectedProjectForClient, authToken]);

  // Fetch all units for listing tab when component mounts or tab changes to units or users
  const fetchAllUnitsForListing = async () => {
    setLoadingAllUnits(true);
    try {
      const filters = {
        search: unitSearch,
        soa_status: unitSOAStatus !== 'all' ? unitSOAStatus : undefined,
        payment_status: unitPaymentStatus !== 'all' ? unitPaymentStatus : undefined,
        handover_status: unitHandoverStatus !== 'all' ? unitHandoverStatus : undefined,
        handover_requirements: unitHandoverRequirements !== 'all' ? unitHandoverRequirements : undefined,
        booking_status: unitBookingStatus !== 'all' ? unitBookingStatus : undefined,
        booking_date_from: bookingDateRange.from ? format(bookingDateRange.from, 'yyyy-MM-dd') : undefined,
        booking_date_to: bookingDateRange.to ? format(bookingDateRange.to, 'yyyy-MM-dd') : undefined,
        occupied: activeTab === 'users' ? 'true' : 'false', // Unit Management shows occupied, Unit Listing shows unoccupied
      };
      console.log('Fetching units with filters:', filters);
      const response = await getAllUnits(authToken, undefined, undefined, filters);
      console.log('Units response:', response);
      setAllUnitsForListing(response.units || []);
    } catch (error) {
      console.error("Failed to fetch all units:", error);
      toast.error("Failed to load units");
    } finally {
      setLoadingAllUnits(false);
    }
  };

  // Debounced search effect (2 second delay)
  useEffect(() => {
    if ((activeTab === "units" || activeTab === "users") && authToken) {
      const timeoutId = setTimeout(() => {
        fetchAllUnitsForListing();
      }, 2000);

      return () => clearTimeout(timeoutId);
    }
  }, [unitSearch]);

  // Immediate effect for dropdown filters and tab changes
  useEffect(() => {
    if ((activeTab === "units" || activeTab === "users") && authToken) {
      fetchAllUnitsForListing();
    }
  }, [activeTab, authToken, unitSOAStatus, unitPaymentStatus, unitHandoverStatus, unitHandoverRequirements, unitBookingStatus, bookingDateRange]);

  // Refresh units when page becomes visible (e.g., when navigating back from unit detail page)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && (activeTab === "units" || activeTab === "users") && authToken) {
        console.log('Page visible, refreshing units...');
        fetchAllUnitsForListing();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [activeTab, authToken]);

  // Pagination for users
  const displayedUsers = users.slice(0, displayedUsersCount);
  const hasMoreUsers = displayedUsersCount < users.length;

  // Get unique projects from users
  const userProjects = Array.from(
    new Set(users.flatMap(u => u.units?.map(unit => unit.property.project_name) || []))
  ).filter(Boolean);

  // Fetch all properties for bulk upload
  const [allProperties, setAllProperties] = useState<Array<{id: number; project_name: string}>>([]);
  
  useEffect(() => {
    const fetchProperties = async () => {
      try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/properties`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (response.ok) {
          const data = await response.json();
          setAllProperties(data);
        }
      } catch (error) {
        console.error('Failed to fetch properties:', error);
      }
    };
    fetchProperties();
  }, []);

  // Reset pagination when users change
  useEffect(() => {
    setDisplayedUsersCount(10);
  }, [users.length]);

  // Infinite scroll handler for main window scroll
  useEffect(() => {
    const handleScroll = () => {
      if (activeTab !== "users" || !hasMoreUsers) return;

      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const scrollHeight = document.documentElement.scrollHeight;
      const clientHeight = window.innerHeight;
      
      // Load more when scrolled to 80% of the page
      if (scrollTop + clientHeight >= scrollHeight - 300) {
        setDisplayedUsersCount(prev => Math.min(prev + 10, users.length));
      }
    };

    if (activeTab === "users") {
      window.addEventListener('scroll', handleScroll);
      return () => window.removeEventListener('scroll', handleScroll);
    }
  }, [activeTab, hasMoreUsers, users.length]);

  // Get unique dates with bookings
  const datesWithBookings = Array.from(
    new Set(bookings.map((b) => b.date.toDateString()))
  ).map((dateStr) => new Date(dateStr));

  // Filter bookings by selected date
  const filteredBookings = bookings.filter((b) => {
    // Filter by selected date (single date filter)
    if (selectedDate && b.date.toDateString() !== selectedDate.toDateString()) {
      return false;
    }
    // Filter by date range
    if (bookingsDateRange.from && b.date < bookingsDateRange.from) {
      return false;
    }
    if (bookingsDateRange.to) {
      const endOfDay = new Date(bookingsDateRange.to);
      endOfDay.setHours(23, 59, 59, 999);
      if (b.date > endOfDay) {
        return false;
      }
    }
    return true;
  });

  const sortedBookings = [...filteredBookings].sort((a, b) => {
    const dateCompare = a.date.getTime() - b.date.getTime();
    if (dateCompare !== 0) return dateCompare;
    return a.time.localeCompare(b.time);
  });

  const handleUpdatePaymentStatus = () => {
    if (editingUser) {
      // Validate receipt for fully_paid status
      if (newPaymentStatus === "fully_paid" && !receiptFile) {
        toast.error("Please upload a receipt before marking as fully paid");
        return;
      }
      
      const paymentDate = newPaymentStatus === "fully_paid" ? new Date() : null;
      onUpdateUserPaymentStatus(editingUser.id, newPaymentStatus, paymentDate, receiptFile || undefined);
      setEditingUser(null);
      setReceiptFile(null);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const validTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
      if (!validTypes.includes(file.type)) {
        toast.error("Please upload a PDF, JPEG, JPG, or PNG file");
        return;
      }
      
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast.error("File size must be less than 10MB");
        return;
      }
      
      setReceiptFile(file);
    }
  };

  const handleSendEmail = async (sendToAll: boolean) => {
    if (sendToAll) {
      // Show project selection dialog
      setProjectSelectOpen(true);
    } else {
      // Send to selected recipients
      if (emailRecipients.length === 0) {
        toast.error("Please select at least one user from the table using checkboxes");
        return;
      }
      
      // Check if all selected users have SOA uploaded
      const missingSOA = emailRecipients.filter(user => 
        !user.attachments?.some(att => att.type === "soa")
      );
      
      if (missingSOA.length > 0) {
        setUsersWithoutSOA(missingSOA);
        setMissingSOADialogOpen(true);
        return;
      }
      
      openEmailDialog(emailRecipients);
    }
  };

  const handleProjectSelected = () => {
    let recipients = users;
    
    // Filter by project if not "all"
    if (selectedProject !== "all") {
      recipients = users.filter(user => 
        user.units?.some(unit => unit.property.project_name === selectedProject)
      );
    }
    
    if (recipients.length === 0) {
      toast.error("No users found for the selected project");
      return;
    }

    // Check if all users have SOA uploaded
    const usersWithoutSOA = recipients.filter(user => 
      !user.attachments?.some(att => att.type === "soa")
    );

    if (usersWithoutSOA.length > 0) {
      const userNames = usersWithoutSOA.slice(0, 3).map(u => u.full_name).join(", ");
      const moreText = usersWithoutSOA.length > 3 ? ` and ${usersWithoutSOA.length - 3} more` : "";
      toast.error(`Cannot send: ${usersWithoutSOA.length} user(s) missing SOA (${userNames}${moreText})`);
      return;
    }
    
    setProjectSelectOpen(false);
    openEmailDialog(recipients);
  };

  const openEmailDialog = (recipients: User[]) => {
    // Use Handover Notice template (same as individual user emails)
    const defaultSubject = "Handover Notice";
    const defaultBody = ""; // Message handled by Laravel blade template
    
    setEmailRecipients(recipients);
    setEmailSubject(defaultSubject);
    setEmailBody(defaultBody);
    setEmailDialogOpen(true);
  };

  const handleSendEmailSubmit = async () => {
    console.log('=== handleSendEmailSubmit called ===');
    console.log('Recipients count:', emailRecipients.length);
    console.log('Subject:', emailSubject);
    
    if (emailRecipients.length === 0) {
      toast.error("Please select at least one recipient");
      return;
    }
    
    if (!emailSubject.trim()) {
      toast.error("Please provide email subject");
      return;
    }
    
    toast.info("Starting email send process...");
    setSendingEmail(true);
    
    try {
      const recipientIds = emailRecipients.map(user => user.id);
      console.log('Sending email to:', recipientIds);
      console.log('Subject:', emailSubject);
      console.log('Message:', emailBody);
      console.log('Auth token:', authToken ? 'Present' : 'Missing');
      
      const result = await sendSOAEmail(recipientIds, emailSubject, emailBody, authToken);
      
      console.log('Email send result:', result);
      toast.success(`${result.message}\n\nSent: ${result.sent_count}, Failed: ${result.failed_count}`);
      setEmailDialogOpen(false);
      setEmailRecipients([]);
      setEmailSubject("");
      setEmailBody("");
    } catch (error: any) {
      console.error('Failed to send email:', error);
      const errorMessage = error?.message || 'Failed to send email. Please try again.';
      toast.error(errorMessage);
    } finally {
      setSendingEmail(false);
    }
  };

  const toggleRecipient = (user: User) => {
    setEmailRecipients(prev => {
      const exists = prev.find(u => u.id === user.id);
      
      if (exists) {
        // When deselecting, also deselect co-owners
        const coOwnerIds = new Set<number>();
        user.units?.forEach(unit => {
          unit.users?.forEach(u => {
            if (u.id !== user.id) coOwnerIds.add(u.id);
          });
        });
        
        return prev.filter(u => u.id !== user.id && !coOwnerIds.has(u.id));
      } else {
        // When selecting, also select co-owners
        const toAdd = [user];
        const coOwnerIds = new Set<number>();
        
        user.units?.forEach(unit => {
          unit.users?.forEach(u => {
            if (u.id !== user.id && !coOwnerIds.has(u.id)) {
              coOwnerIds.add(u.id);
              const coOwner = users.find(usr => usr.id === u.id);
              if (coOwner && !prev.find(p => p.id === coOwner.id)) {
                toAdd.push(coOwner);
              }
            }
          });
        });
        
        return [...prev, ...toAdd];
      }
    });
  };

  const handleUpdateBookingStatus = async () => {
    if (editingBooking) {
      // If cancelled, delete the booking via API
      if (newBookingStatus === "cancelled") {
        setCancellingBooking(true);
        try {
          const token = localStorage.getItem('authToken');
          if (!token) {
            toast.error('No authentication token found');
            return;
          }
          
          await cancelBooking(parseInt(editingBooking.id), token);
          onDeleteBooking(editingBooking.id);
          toast.success('Booking cancelled successfully');
          setEditingBooking(null);
        } catch (error: any) {
          console.error('Error cancelling booking:', error);
          toast.error(error.message || 'Failed to cancel booking');
        } finally {
          setCancellingBooking(false);
        }
      } else {
        setEditingBooking(null);
      }
    }
  };

  const handleRebook = async () => {
    if (rebookingBooking && rebookDate && rebookTime) {
      setRebookingInProgress(true);
      try {
        const token = localStorage.getItem('authToken');
        if (!token) {
          toast.error('No authentication token found');
          return;
        }
        
        // Format date as YYYY-MM-DD
        const formattedDate = format(rebookDate, 'yyyy-MM-dd');
        
        await updateBooking(
          parseInt(rebookingBooking.id),
          {
            booked_date: formattedDate,
            booked_time: rebookTime
          },
          token
        );
        
        // Update local state only after successful API call
        onUpdateBooking(rebookingBooking.id, rebookDate, rebookTime);
        toast.success('Booking rescheduled successfully');
        setRebookingBooking(null);
        setRebookDate(undefined);
        setRebookTime("");
      } catch (error: any) {
        console.error('Error rebooking:', error);
        toast.error(error.message || 'Failed to reschedule booking');
      } finally {
        setRebookingInProgress(false);
      }
    }
  };

  // POA approval handlers
  const handleApprovePoaBooking = async (bookingId: string) => {
    setPoaActionLoading(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/bookings/${bookingId}/approve-poa`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'approve' }),
      });

      if (!response.ok) {
        throw new Error('Failed to approve POA booking');
      }

      toast.success('POA booking approved successfully!');
      setViewPoaDialogOpen(false);
      setPoaBooking(null);
      
      // Refresh bookings list
      window.location.reload();
    } catch (error: any) {
      console.error('Error approving POA booking:', error);
      toast.error(error.message || 'Failed to approve POA booking');
    } finally {
      setPoaActionLoading(false);
    }
  };

  const handleRejectPoaBooking = async (bookingId: string) => {
    if (!poaRejectionReason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }

    setPoaActionLoading(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/bookings/${bookingId}/approve-poa`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          action: 'reject',
          rejection_reason: poaRejectionReason,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to reject POA booking');
      }

      toast.success('POA booking rejected');
      setViewPoaDialogOpen(false);
      setPoaBooking(null);
      setPoaRejectionReason("");
      
      // Refresh bookings list
      window.location.reload();
    } catch (error: any) {
      console.error('Error rejecting POA booking:', error);
      toast.error(error.message || 'Failed to reject POA booking');
    } finally {
      setPoaActionLoading(false);
    }
  };

  // Snagging defect functions
  const addSnaggingDefect = () => {
    const newDefect = {
      id: `defect-${Date.now()}`,
      image: null,
      imagePreview: null,
      description: '',
      location: '',
      agreedRemediationAction: ''
    };
    setSnaggingDefects([...snaggingDefects, newDefect]);
    // Expand the new defect by default
    setExpandedDefects(prev => new Set([...prev, newDefect.id]));
  };

  const toggleDefectExpanded = (defectId: string) => {
    setExpandedDefects(prev => {
      const newSet = new Set(prev);
      if (newSet.has(defectId)) {
        newSet.delete(defectId);
      } else {
        newSet.add(defectId);
      }
      return newSet;
    });
  };

  const removeSnaggingDefect = async (defectId: string) => {
    const defect = snaggingDefects.find(d => d.id === defectId);
    
    // If it has a server ID, delete from server
    if (defect?.serverId && handoverBooking) {
      try {
        await deleteSnaggingDefect(Number(handoverBooking.id), defect.serverId, authToken);
        toast.success("Defect deleted");
      } catch (error) {
        console.error("Failed to delete defect:", error);
        toast.error("Failed to delete defect");
        return;
      }
    }
    
    setSnaggingDefects(snaggingDefects.filter(d => d.id !== defectId));
  };

  const updateSnaggingDefectDescription = (defectId: string, description: string) => {
    setSnaggingDefects(snaggingDefects.map(d => 
      d.id === defectId ? { ...d, description } : d
    ));
  };

  const updateSnaggingDefectLocation = (defectId: string, location: string) => {
    setSnaggingDefects(snaggingDefects.map(d => 
      d.id === defectId ? { ...d, location } : d
    ));
  };

  const updateSnaggingDefectRemediation = (defectId: string, agreedRemediationAction: string) => {
    setSnaggingDefects(snaggingDefects.map(d => 
      d.id === defectId ? { ...d, agreedRemediationAction } : d
    ));
  };

  const updateSnaggingDefectImage = async (defectId: string, file: File | null, preview: string | null) => {
    if (!file || !handoverBooking) {
      setSnaggingDefects(snaggingDefects.map(d => 
        d.id === defectId ? { ...d, image: file, imagePreview: preview } : d
      ));
      return;
    }

    // Update local state first
    setSnaggingDefects(snaggingDefects.map(d => 
      d.id === defectId ? { ...d, image: file, imagePreview: preview } : d
    ));

    // Get the defect to save
    const defect = snaggingDefects.find(d => d.id === defectId);
    if (!defect) return;

    // Save to server immediately
    try {
      const result = await createSnaggingDefect(
        Number(handoverBooking.id),
        file,
        defect.description || '',
        defect.location || '',
        defect.agreedRemediationAction || '',
        authToken
      );
      
      // Update with server ID
      setSnaggingDefects(prev => prev.map(d => 
        d.id === defectId ? { ...d, serverId: result.defect.id } : d
      ));
      
      toast.success("Defect saved!");
    } catch (error) {
      console.error("Failed to save defect:", error);
      toast.error("Failed to save defect");
      // Remove from local state if save failed
      setSnaggingDefects(prev => prev.filter(d => d.id !== defectId));
    }
  };

  const saveSnaggingDefectDetails = async (defectId: string) => {
    const defect = snaggingDefects.find(d => d.id === defectId);
    if (!defect || !defect.serverId || !handoverBooking) return;

    try {
      await updateSnaggingDefect(
        Number(handoverBooking.id),
        defect.serverId,
        defect.description || '',
        defect.location || '',
        defect.agreedRemediationAction || '',
        authToken,
        defect.is_remediated
      );
      toast.success("Defect details updated!");
      // Collapse the defect after saving
      setExpandedDefects(prev => {
        const newSet = new Set(prev);
        newSet.delete(defectId);
        return newSet;
      });
    } catch (error) {
      console.error("Failed to update defect:", error);
      toast.error("Failed to update defect details");
    }
  };

  const toggleDefectRemediation = (defectId: string) => {
    setSnaggingDefects(snaggingDefects.map(d => 
      d.id === defectId ? { ...d, is_remediated: !d.is_remediated } : d
    ));
  };

  const startSnaggingCamera = async (defectId: string) => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast.error(
        "Camera access requires HTTPS connection. Please access this page via https:// or use file upload instead.",
        { duration: 6000 }
      );
      return;
    }

    setActiveSnaggingDefectId(defectId);
    setShowSnaggingCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment', width: 1280, height: 720 } 
      });
      if (snaggingVideoRef.current) {
        snaggingVideoRef.current.srcObject = stream;
        await snaggingVideoRef.current.play();
      }
    } catch (err: any) {
      console.error("Error accessing camera:", err);
      
      if (err.name === 'NotAllowedError') {
        toast.error("Camera permission denied. Please allow camera access in your browser settings.");
      } else if (err.name === 'NotFoundError') {
        toast.error("No camera found on this device.");
      } else if (err.name === 'NotReadableError') {
        toast.error("Camera is already in use by another application.");
      } else {
        toast.error("Could not access camera. Please check permissions or use file upload.");
      }
      
      setShowSnaggingCamera(false);
      setActiveSnaggingDefectId(null);
    }
  };

  const stopSnaggingCamera = () => {
    if (snaggingVideoRef.current && snaggingVideoRef.current.srcObject) {
      const tracks = (snaggingVideoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
      snaggingVideoRef.current.srcObject = null;
      setShowSnaggingCamera(false);
      setActiveSnaggingDefectId(null);
    }
  };

  const captureSnaggingPhoto = async () => {
    if (snaggingVideoRef.current && snaggingCanvasRef.current && activeSnaggingDefectId) {
      const video = snaggingVideoRef.current;
      const canvas = snaggingCanvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        canvas.toBlob(async (blob) => {
          if (blob) {
            const file = new File([blob], `snagging-defect-${Date.now()}.jpg`, { type: 'image/jpeg' });
            const preview = canvas.toDataURL('image/jpeg');
            updateSnaggingDefectImage(activeSnaggingDefectId, file, preview);
            stopSnaggingCamera();
            toast.success("Defect photo captured!");
          }
        }, 'image/jpeg', 0.9);
      }
    }
  };

  const getBookedTimesForDate = (date: Date | undefined) => {
    if (!date) return [];
    // Exclude the current booking being rebooked from the check
    return bookings
      .filter((b) => b.id !== rebookingBooking?.id && b.date.toDateString() === date.toDateString())
      .map((b) => b.time);
  };

  const bookedTimesForRebookDate = getBookedTimesForDate(rebookDate);

  const getBookingStatusBadge = (status?: Booking["status"]) => {
    const bookingStatus = status || "confirmed";
    switch (bookingStatus) {
      case "completed":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3" />
            Completed
          </span>
        );
      case "cancelled":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <XCircle className="w-3 h-3" />
            Cancelled
          </span>
        );
      case "pending_poa_approval":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
            <AlertCircle className="w-3 h-3" />
            Pending POA Approval
          </span>
        );
      case "confirmed":
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            <CalendarIcon className="w-3 h-3" />
            Confirmed
          </span>
        );
    }
  };

  const getStatusBadge = (status: User["payment_status"]) => {
    switch (status) {
      case "fully_paid":
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3" />
            Fully Paid
          </span>
        );
      case "partial":
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <AlertCircle className="w-3 h-3" />
            Partial
          </span>
        );
      case "pending":
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <XCircle className="w-3 h-3" />
            Pending
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-white p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 bg-black text-white rounded-lg p-6 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
              <Users className="w-5 h-5 text-black" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Admin Dashboard</h1>
              <p className="text-sm text-gray-300">{userEmail}</p>
            </div>
          </div>
          <Button variant="outline" onClick={onLogout} className="gap-2 bg-white text-black hover:bg-gray-100 border-0">
            <LogOut className="w-4 h-4" />
            Logout
          </Button>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex gap-2">
            <Button
              onClick={() => setActiveTab("users")}
              className={activeTab === "users" ? "bg-black text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"}
            >
              <Building2 className="w-4 h-4 mr-2" />
              Unit Management
              <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-semibold ${
                activeTab === "users" ? "bg-white text-black" : "bg-gray-300 text-gray-700"
              }`}>
                {allUnitsForListing.length}
              </span>
            </Button>
            <Button
              onClick={() => setActiveTab("units")}
              className={activeTab === "units" ? "bg-black text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"}
            >
              <Building2 className="w-4 h-4 mr-2" />
              Unit Listing
            </Button>
            <Button
              onClick={() => setActiveTab("bookings")}
              className={activeTab === "bookings" ? "bg-black text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"}
            >
              <CalendarIcon className="w-4 h-4 mr-2" />
              Bookings
              <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-semibold ${
                activeTab === "bookings" ? "bg-white text-black" : "bg-gray-300 text-gray-700"
              }`}>
                {bookings.length}
              </span>
            </Button>
          </div>
          
          {/* <div className="flex gap-2">
            {activeTab === "users" && (
              <>
                <Button
                  onClick={() => handleSendEmail(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
                >
                  <Mail className="w-4 h-4" />
                  Send Email to All
                </Button>
                <Button
                  onClick={() => handleSendEmail(false)}
                  variant="outline"
                  className="border border-blue-600 text-blue-600 hover:bg-blue-50 gap-2"
                >
                  <Send className="w-4 h-4" />
                  Send to Selected
                </Button>
              </>
            )}
          </div> */}
        </div>

        {/* Bookings Tab */}
        {activeTab === "bookings" && (
          <>
            {/* Filter Section */}
            {filterOpen && (
              <div className="mb-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
                <div className="mb-3">
                  <div className="flex items-center gap-3">
                    <label className="text-sm font-medium text-gray-700">Date Range:</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-[240px] justify-start text-left font-normal"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {bookingsDateRange.from ? (
                            bookingsDateRange.to ? (
                              <>
                                {format(bookingsDateRange.from, "MMM dd")} -{" "}
                                {format(bookingsDateRange.to, "MMM dd, y")}
                              </>
                            ) : (
                              format(bookingsDateRange.from, "LLL dd, y")
                            )
                          ) : (
                            <span>Pick date range</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="range"
                          selected={{ from: bookingsDateRange.from, to: bookingsDateRange.to }}
                          onSelect={(range: any) => setBookingsDateRange({ from: range?.from, to: range?.to })}
                          numberOfMonths={2}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    {(bookingsDateRange.from || bookingsDateRange.to) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setBookingsDateRange({ from: undefined, to: undefined })}
                      >
                        Clear Range
                      </Button>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedDate && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedDate(null)}
                      className="bg-white border-gray-300 hover:bg-gray-100"
                    >
                      Clear Single Date
                    </Button>
                  )}
                  {datesWithBookings.map((date) => (
                    <Button
                      key={date.toISOString()}
                      variant="outline"
                      onClick={() => setSelectedDate(date)}
                      className={
                        selectedDate?.toDateString() === date.toDateString()
                          ? "bg-black text-white hover:bg-gray-800 border-black"
                          : "bg-white border-gray-300 hover:bg-gray-100"
                      }
                    >
                      <CalendarIcon className="w-4 h-4 mr-2" />
                      {format(date, "MMM d, yyyy")}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Bookings List */}
            <Card className="border border-gray-200 shadow">
              <CardHeader className="bg-black text-white pb-4 rounded-t-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-white">All Bookings</CardTitle>
                    <CardDescription className="text-gray-300">
                      {filteredBookings.length === 0
                        ? "No bookings found"
                        : `${filteredBookings.length} booking${filteredBookings.length !== 1 ? "s" : ""}`}
                      {selectedDate && ` for ${format(selectedDate, "MMM d, yyyy")}`}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {sortedBookings.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <CalendarIcon className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p>No bookings to display</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unit Number</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Booked Time</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time Paid</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {sortedBookings.map((booking) => {
                          const user = booking.user || users.find(u => u.email === booking.customerEmail);
                          const allOwners = user ? [user.full_name] : [];
                          if (booking.co_owners && booking.co_owners.length > 0) {
                            allOwners.push(...booking.co_owners.map(co => co.full_name));
                          }
                          const ownerNames = allOwners.join(', ');
                          
                          // Find the correct unit by unit_id from the booking
                          const bookedUnit = user?.units?.find(u => u.id === (booking as any).unit_id);
                          
                          return (
                            <tr key={booking.id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                {bookedUnit?.unit || user?.units?.[0]?.unit || "N/A"}
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-900">
                                {ownerNames || "Unknown"}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-900">{format(booking.date, "MMM d, yyyy")}</div>
                                <div className="text-sm text-gray-500 flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {booking.time}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {user?.payment_date ? format(new Date(user.payment_date), "MMM d, yyyy") : "N/A"}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="space-y-2">
                                  {getBookingStatusBadge(booking.status)}
                                  {/* Handover Completion Checklist */}
                                  {booking.status === 'confirmed' && (
                                    <div className="text-xs">
                                      {(() => {
                                        // Check if declaration is truly complete (no unresolved defects)
                                        const hasUnresolvedDefects = booking.snagging_defects?.some((d: any) => !d.is_remediated) || false;
                                        const isDeclarationComplete = booking.handover_declaration && !hasUnresolvedDefects;
                                        
                                        const completedItems = [
                                          isDeclarationComplete ? 1 : 0,
                                          booking.handover_checklist ? 1 : 0,
                                          booking.handover_photo ? 1 : 0,
                                          booking.client_signature ? 1 : 0
                                        ].reduce((a, b) => a + b, 0);
                                        
                                        return (
                                          <div className="flex items-center gap-1.5 mt-1">
                                            <span className={`font-medium ${completedItems === 4 ? 'text-green-600' : 'text-orange-600'}`}>
                                              {completedItems}/4
                                            </span>
                                            <div className="flex gap-0.5">
                                              <span className={`w-2 h-2 rounded-full ${isDeclarationComplete ? 'bg-green-500' : 'bg-gray-300'}`} title={hasUnresolvedDefects ? "Declaration (Unresolved Defects)" : "Declaration"} />
                                              <span className={`w-2 h-2 rounded-full ${booking.handover_checklist ? 'bg-green-500' : 'bg-gray-300'}`} title="Checklist" />
                                              <span className={`w-2 h-2 rounded-full ${booking.handover_photo ? 'bg-green-500' : 'bg-gray-300'}`} title="Photo" />
                                              <span className={`w-2 h-2 rounded-full ${booking.client_signature ? 'bg-green-500' : 'bg-gray-300'}`} title="Signature" />
                                            </div>
                                          </div>
                                        );
                                      })()}
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <div className="flex items-center justify-end gap-2">
                                  {(() => {
                                    console.log('Booking ID:', booking.id, 'Status:', booking.status, 'Type:', typeof booking.status);
                                    return null;
                                  })()}
                                  {booking.status === "pending_poa_approval" && (
                                    <>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                          setPoaBooking(booking);
                                          setViewPoaDialogOpen(true);
                                        }}
                                        className="bg-orange-50 hover:bg-orange-100 border-orange-200 text-orange-700"
                                      >
                                        <FileText className="w-3 h-3 mr-1" />
                                        Review POA
                                      </Button>
                                    </>
                                  )}
                                  {(!booking.status || booking.status === "confirmed") && (
                                    <>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                          // Navigate to handover completion page
                                          router.push(`/admin/handover/${booking.id}`);
                                        }}
                                        className="bg-green-50 hover:bg-green-100 border-green-200 text-green-700"
                                      >
                                        <CheckCircle className="w-3 h-3 mr-1" />
                                        Complete Handover
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                          setEditingBooking(booking);
                                          setNewBookingStatus("cancelled");
                                        }}
                                        className="bg-red-50 hover:bg-red-100 border-red-200 text-red-700"
                                      >
                                        <Ban className="w-3 h-3 mr-1" />
                                        Cancel
                                      </Button>
                                    </>
                                  )}
                                  {booking.status !== "pending_poa_approval" && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setRebookingBooking(booking)}
                                    className="bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-700"
                                  >
                                    <CalendarCheck className="w-3 h-3 mr-1" />
                                    Rebook
                                  </Button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* Users Tab */}
        {activeTab === "users" && (
          <Card className="border border-gray-200 shadow">
            <CardHeader className="bg-black text-white pb-4 rounded-t-lg">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-white">Unit Management</CardTitle>
                  <CardDescription className="text-gray-300">
                    Manage units and their owners
                  </CardDescription>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button className="bg-white text-black hover:bg-gray-100" size="sm">
                      <MoreVertical className="w-4 h-4 mr-2" />
                      Actions
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem onClick={handleDownloadAllSOAs} disabled={downloadingAllSOAs}>
                      {downloadingAllSOAs ? (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          Downloading...
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4 mr-2" />
                          Download All SOAs
                        </>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setBulkSOADialogOpen(true)}>
                      <Upload className="w-4 h-4 mr-2" />
                      Bulk Upload SOA
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => setPaymentDetailsDialogOpen(true)}
                      disabled={generatingSOAs}
                    >
                      {generatingSOAs ? (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <FileText className="w-4 h-4 mr-2" />
                          Generate SOAs
                        </>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={() => setBulkHandoverDialogOpen(true)}
                      disabled={selectedUnitsForHandover.size === 0}
                    >
                      <Send className="w-4 h-4 mr-2" />
                      Bulk Send Handover ({selectedUnitsForHandover.size})
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => setBulkSOAEmailDialogOpen(true)}
                      disabled={selectedUnitsForHandover.size === 0}
                    >
                      <Mail className="w-4 h-4 mr-2" />
                      Bulk Send SOA Email ({selectedUnitsForHandover.size})
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setAddClientDialogOpen(true)}>
                      <Users className="w-4 h-4 mr-2" />
                      Add Client
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setBulkUploadDialogOpen(true)}>
                      <FileText className="w-4 h-4 mr-2" />
                      Bulk Upload Clients
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {/* Search and Filters */}
              <div className="p-4 border-b border-gray-200 bg-gray-50">
                <div className="flex flex-wrap items-center gap-3">
                  {/* Search */}
                  <div className="w-[180px]">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <Input
                        placeholder="Search..."
                        value={unitSearch}
                        onChange={(e) => setUnitSearch(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                  </div>
                  
                  {/* SOA Status Filter */}
                  <div className="w-[120px]">
                    <Select value={unitSOAStatus} onValueChange={setUnitSOAStatus}>
                      <SelectTrigger>
                        <SelectValue placeholder="SOA" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All SOA</SelectItem>
                        <SelectItem value="uploaded">Uploaded</SelectItem>
                        <SelectItem value="not_uploaded">Not Uploaded</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Payment Status Filter */}
                  <div className="w-[120px]">
                    <Select value={unitPaymentStatus} onValueChange={setUnitPaymentStatus}>
                      <SelectTrigger>
                        <SelectValue placeholder="Payment" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Payment</SelectItem>
                        <SelectItem value="fully_paid">Fully Paid</SelectItem>
                        <SelectItem value="partial">Partial</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Handover Status Filter */}
                  <div className="w-[120px]">
                    <Select value={unitHandoverStatus} onValueChange={setUnitHandoverStatus}>
                      <SelectTrigger>
                        <SelectValue placeholder="H. Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="scheduled">Scheduled</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Handover Requirements Filter */}
                  <div className="w-[120px]">
                    <Select value={unitHandoverRequirements} onValueChange={setUnitHandoverRequirements}>
                      <SelectTrigger>
                        <SelectValue placeholder="H. Req" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Req</SelectItem>
                        <SelectItem value="complete">Complete</SelectItem>
                        <SelectItem value="incomplete">Incomplete</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Booking Status Filter */}
                  <div className="w-[120px]">
                    <Select value={unitBookingStatus} onValueChange={setUnitBookingStatus}>
                      <SelectTrigger>
                        <SelectValue placeholder="Booking" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Booking</SelectItem>
                        <SelectItem value="booked">Booked</SelectItem>
                        <SelectItem value="not_booked">Not Booked</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Booking Date Range Filter */}
                  <div className="flex items-center gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-[240px] justify-start text-left font-normal"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {bookingDateRange.from ? (
                            bookingDateRange.to ? (
                              <>
                                {format(bookingDateRange.from, "MMM dd")} -{" "}
                                {format(bookingDateRange.to, "MMM dd, y")}
                              </>
                            ) : (
                              format(bookingDateRange.from, "LLL dd, y")
                            )
                          ) : (
                            <span>Date range</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="range"
                          selected={{ from: bookingDateRange.from, to: bookingDateRange.to }}
                          onSelect={(range: any) => setBookingDateRange({ from: range?.from, to: range?.to })}
                          numberOfMonths={2}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    {(bookingDateRange.from || bookingDateRange.to) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setBookingDateRange({ from: undefined, to: undefined })}
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left">
                        <input
                          type="checkbox"
                          className="rounded border-gray-300"
                          checked={(() => {
                            const eligibleUnits = allUnitsForListing.filter(u => {
                              const hasSOA = u.attachments?.some((att: any) => att.type === 'soa');
                              return hasSOA;
                            });
                            return eligibleUnits.length > 0 && eligibleUnits.every(u => selectedUnitsForHandover.has(u.id));
                          })()}
                          onChange={(e) => {
                            const eligibleUnits = allUnitsForListing.filter(u => {
                              const hasSOA = u.attachments?.some((att: any) => att.type === 'soa');
                              return hasSOA;
                            });
                            if (e.target.checked) {
                              setSelectedUnitsForHandover(new Set(eligibleUnits.map(u => u.id)));
                            } else {
                              setSelectedUnitsForHandover(new Set());
                            }
                          }}
                        />
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unit Number</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client Names</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SOA Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Handover Requirements</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Handover Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Booking Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {loadingAllUnits ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                          Loading units...
                        </td>
                      </tr>
                    ) : (() => {
                      // Build units map from allUnitsForListing (which has full unit data)
                      const unitsMap = new Map();
                      
                      // Start with all units from backend (including full details)
                      allUnitsForListing.forEach(unit => {
                        unitsMap.set(unit.id, {
                          ...unit,
                          owners: []
                        });
                      });
                      
                      // Then add owner information ONLY for units that are already in the map
                      users.forEach(user => {
                        user.units?.forEach(unit => {
                          if (unitsMap.has(unit.id)) {
                            // Unit exists in map (passed filters), add owner
                            unitsMap.get(unit.id).owners.push({
                              ...user,
                              is_primary: unit.pivot?.is_primary
                            });
                          }
                          // Don't add units that were filtered out by backend
                        });
                      });

                      // Get all units from the map (backend already filtered)
                      const allUnits = Array.from(unitsMap.values());

                      if (allUnits.length === 0) {
                        const hasActiveFilters = unitSearch || unitSOAStatus !== 'all' || unitPaymentStatus !== 'all' || 
                                                 unitHandoverStatus !== 'all' || unitHandoverRequirements !== 'all' || 
                                                 unitBookingStatus !== 'all' || bookingDateRange.from || bookingDateRange.to;
                        return (
                          <tr>
                            <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                              {hasActiveFilters ? 'No units match the selected filters.' : 'No units found. Add units and owners to get started.'}
                            </td>
                          </tr>
                        );
                      }

                      return allUnits.map((unit) => {
                        const hasOwners = unit.owners && unit.owners.length > 0;
                        const primaryOwner = unit.owners?.find((o: any) => o.is_primary);
                        const coOwners = unit.owners?.filter((o: any) => !o.is_primary) || [];
                        
                        // Get all owner names (full names)
                        const ownerNames = unit.owners?.map((o: any) => o.full_name).join(', ') || 'No owner';
                        
                        // Check SOA status
                        const attachments = unit.attachments || [];
                        const hasSOA = attachments.some((att: any) => att.type === 'soa');
                        
                        // Calculate handover requirements - split into client and developer
                        
                        // Client requirements: 4 total
                        // 1. 100% SOA receipt (payment_proof)
                        // 2. AC connection
                        // 3. DEWA connection
                        // 4. Service charge acknowledgement signed by buyer (service_charge_ack_buyer)
                        const clientRequiredTypes = ['payment_proof', 'ac_connection', 'dewa_connection', 'service_charge_ack_buyer'];
                        const clientUploadedCount = clientRequiredTypes.filter(type => 
                          attachments.some((att: any) => att.type === type)
                        ).length;
                        const clientTotalRequirements = 4;
                        
                        // Developer requirements: 1 total
                        // 1. Developer NOC signed (developer_noc_signed)
                        const developerRequiredTypes = ['developer_noc_signed'];
                        const developerUploadedCount = developerRequiredTypes.filter(type => 
                          attachments.some((att: any) => att.type === type)
                        ).length;
                        const developerTotalRequirements = 1;
                        
                        const allRequirementsMet = clientUploadedCount === clientTotalRequirements && 
                                                   developerUploadedCount === developerTotalRequirements;
                        
                        // Get booking info
                        const booking = unit.booking;
                        
                        // Check if unit is eligible for handover email (has SOA)
                        const isEligibleForHandover = hasSOA;
                        
                        return (
                          <tr 
                            key={unit.id} 
                            className="hover:bg-gray-50 transition-colors"
                          >
                            <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                className="rounded border-gray-300"
                                disabled={!isEligibleForHandover}
                                checked={selectedUnitsForHandover.has(unit.id)}
                                onChange={(e) => {
                                  const newSet = new Set(selectedUnitsForHandover);
                                  if (e.target.checked) {
                                    newSet.add(unit.id);
                                  } else {
                                    newSet.delete(unit.id);
                                  }
                                  setSelectedUnitsForHandover(newSet);
                                }}
                              />
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap cursor-pointer" onClick={() => router.push(`/admin/units/${unit.id}`)}>
                              <div className="text-sm font-medium text-gray-900">{unit.unit}</div>
                              <div className="text-xs text-gray-500">{unit.property?.project_name || 'N/A'}</div>
                            </td>
                            <td className="px-6 py-4 cursor-pointer" onClick={() => router.push(`/admin/units/${unit.id}`)}>
                              <div className="text-sm text-gray-900">
                                {ownerNames}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap cursor-pointer" onClick={() => router.push(`/admin/units/${unit.id}`)}>
                              {hasSOA ? (
                                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                  ✓ Uploaded
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                                  Not Uploaded
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {unit.payment_status ? (
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  unit.payment_status === 'fully_paid' 
                                    ? 'bg-green-100 text-green-800' 
                                    : unit.payment_status === 'partial'
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : 'bg-red-100 text-red-800'
                                }`}>
                                  {unit.payment_status === 'fully_paid' ? 'Fully Paid' : 
                                   unit.payment_status === 'partial' ? 'Partial' : 'Pending'}
                                </span>
                              ) : (
                                <span className="text-sm text-gray-400">N/A</span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="space-y-1">
                                {/* Client Requirements */}
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-gray-500 w-12">Client:</span>
                                  <span className={`text-sm ${clientUploadedCount === clientTotalRequirements ? 'text-green-600 font-medium' : 'text-gray-600'}`}>
                                    {clientUploadedCount}/{clientTotalRequirements}
                                  </span>
                                  {clientUploadedCount === clientTotalRequirements && <CheckCircle className="w-3.5 h-3.5 text-green-600" />}
                                </div>
                                {/* Developer Requirements */}
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-gray-500 w-12">Dev:</span>
                                  <span className={`text-sm ${developerUploadedCount === developerTotalRequirements ? 'text-green-600 font-medium' : 'text-gray-600'}`}>
                                    {developerUploadedCount}/{developerTotalRequirements}
                                  </span>
                                  {developerUploadedCount === developerTotalRequirements && <CheckCircle className="w-3.5 h-3.5 text-green-600" />}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {unit.handover_status ? (
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  unit.handover_status === 'completed' 
                                    ? 'bg-green-100 text-green-800' 
                                    : unit.handover_status === 'ready'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-gray-100 text-gray-800'
                                }`}>
                                  {unit.handover_status === 'completed' ? 'Completed' : 
                                   unit.handover_status === 'ready' ? 'Ready' : 'Pending'}
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                  Pending
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {booking && booking.booked_date ? (
                                <div className="text-sm">
                                  <div className="font-medium text-gray-900">
                                    {format(new Date(booking.booked_date), 'MMM d, yyyy')}
                                  </div>
                                  <div className="text-gray-500 flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {booking.booked_time}
                                  </div>
                                  {/* Handover Completion Checklist */}
                                  {booking.status === 'confirmed' && (
                                    <div className="mt-2 text-xs">
                                      {(() => {
                                        // Check if declaration is truly complete (no unresolved defects)
                                        const hasUnresolvedDefects = booking.snagging_defects?.some((d: any) => !d.is_remediated) || false;
                                        const isDeclarationComplete = booking.handover_declaration && !hasUnresolvedDefects;
                                        
                                        const completedItems = [
                                          isDeclarationComplete ? 1 : 0,
                                          booking.handover_checklist ? 1 : 0,
                                          booking.handover_photo ? 1 : 0,
                                          booking.client_signature ? 1 : 0
                                        ].reduce((a, b) => a + b, 0);
                                        
                                        return (
                                          <div className="flex items-center gap-1.5">
                                            <span className={`font-medium ${completedItems === 4 ? 'text-green-600' : 'text-orange-600'}`}>
                                              {completedItems}/4
                                            </span>
                                            <div className="flex gap-0.5">
                                              <span className={`w-1.5 h-1.5 rounded-full ${isDeclarationComplete ? 'bg-green-500' : 'bg-gray-300'}`} title={hasUnresolvedDefects ? "Declaration (Unresolved Defects)" : "Declaration"} />
                                              <span className={`w-1.5 h-1.5 rounded-full ${booking.handover_checklist ? 'bg-green-500' : 'bg-gray-300'}`} title="Checklist" />
                                              <span className={`w-1.5 h-1.5 rounded-full ${booking.handover_photo ? 'bg-green-500' : 'bg-gray-300'}`} title="Photo" />
                                              <span className={`w-1.5 h-1.5 rounded-full ${booking.client_signature ? 'bg-green-500' : 'bg-gray-300'}`} title="Signature" />
                                            </div>
                                          </div>
                                        );
                                      })()}
                                    </div>
                                  )}
                                  {booking.status === 'completed' && (
                                    <div className="mt-1">
                                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                        <CheckCircle className="w-3 h-3 mr-1" />
                                        Completed
                                      </span>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-sm text-gray-400">Not Booked</span>
                              )}
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Units Tab */}
        {activeTab === "units" && (
          <Card className="border border-gray-200 shadow">
            <CardHeader className="bg-black text-white pb-4 rounded-t-lg">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-white">Unit Listing</CardTitle>
                  <CardDescription className="text-gray-300">
                    All units with their owners and status
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => setAddUnitDialogOpen(true)}
                    className="bg-white text-black hover:bg-gray-100"
                    size="sm"
                  >
                    <Building2 className="w-4 h-4 mr-2" />
                    Add Unit
                  </Button>
                  <Button
                    onClick={() => setUploadUnitsDialogOpen(true)}
                    className="bg-white text-black hover:bg-gray-100"
                    size="sm"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Units
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unit Number</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Project</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">DEWA Premise Number</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {loadingAllUnits ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                          Loading units...
                        </td>
                      </tr>
                    ) : (() => {
                      // Start with all units from the backend
                      const unitsMap = new Map();
                      
                      // Add all units from backend (including unowned ones)
                      allUnitsForListing.forEach(unit => {
                        unitsMap.set(unit.id, {
                          ...unit,
                          owners: []
                        });
                      });
                      
                      // Then add owner information from users
                      users.forEach(user => {
                        user.units?.forEach(unit => {
                          if (!unitsMap.has(unit.id)) {
                            unitsMap.set(unit.id, {
                              ...unit,
                              owners: []
                            });
                          }
                          unitsMap.get(unit.id).owners.push({
                            ...user,
                            is_primary: unit.pivot?.is_primary
                          });
                        });
                      });

                      // Filter to show only unoccupied units (units with no owners)
                      const allDisplayUnits = Array.from(unitsMap.values()).filter(unit => unit.owners.length === 0);

                      if (allDisplayUnits.length === 0) {
                        return (
                          <tr>
                            <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                              No units found. Click "Add Unit" or "Upload Units" to get started.
                            </td>
                          </tr>
                        );
                      }

                      return allDisplayUnits.map((unit) => {
                        return (
                          <tr 
                            key={unit.id} 
                            className="hover:bg-gray-50 cursor-pointer transition-colors"
                            onClick={() => router.push(`/admin/units/${unit.id}`)}
                          >
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">{unit.unit}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-600">{unit.property?.project_name || 'N/A'}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-600">{unit.dewa_premise_number || 'N/A'}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                Unoccupied
                              </span>
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>


      {/* Rebook Dialog */}
      <Dialog open={!!rebookingBooking} onOpenChange={(open) => {
        if (!open) {
          setRebookingBooking(null);
          setRebookDate(undefined);
          setRebookTime("");
        }
      }}>
        <DialogContent className="border border-gray-200 max-w-6xl">
          <DialogHeader>
            <DialogTitle>Rebook Appointment</DialogTitle>
            <DialogDescription>
              Select a new date and time for this booking
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Current Booking</Label>
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-sm text-gray-900">
                  {rebookingBooking && format(rebookingBooking.date, "EEEE, MMMM d, yyyy")} at {rebookingBooking?.time}
                </p>
                <p className="text-xs text-gray-600 mt-1">{rebookingBooking?.customerEmail}</p>
              </div>
            </div>
            
            <div className="flex flex-col md:flex-row gap-6">
              <div className="md:w-[55%] space-y-2">
                <Label>Select New Date</Label>
                <Calendar
                  mode="single"
                  selected={rebookDate}
                  onSelect={setRebookDate}
                  disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                  className="rounded-md border"
                />
              </div>
              
              <div className="md:w-[45%] space-y-2">
                <Label>Select New Time Slot</Label>
                {!rebookDate ? (
                  <div className="flex items-center justify-center h-full text-sm text-gray-500">
                    <p>Please select a date first</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 max-h-[350px] overflow-y-auto pr-2">
                    {TIME_SLOTS.map((time) => {
                      const isBooked = bookedTimesForRebookDate.includes(time);
                      return (
                        <Button
                          key={time}
                          onClick={() => setRebookTime(time)}
                          disabled={isBooked}
                          variant={rebookTime === time ? "default" : "outline"}
                          className={`
                            ${rebookTime === time ? "bg-black text-white" : ""}
                            ${isBooked ? "opacity-50 cursor-not-allowed" : ""}
                          `}
                        >
                          <Clock className="w-3 h-3 mr-2" />
                          {time}
                          {isBooked && " (Booked)"}
                        </Button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {rebookDate && rebookTime && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  ✓ New appointment: {format(rebookDate, "EEEE, MMMM d, yyyy")} at {rebookTime}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setRebookingBooking(null);
                setRebookDate(undefined);
                setRebookTime("");
              }}
              disabled={rebookingInProgress}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleRebook}
              disabled={!rebookDate || !rebookTime || rebookingInProgress}
              className="bg-black hover:bg-gray-800 text-white"
            >
              {rebookingInProgress ? "Rebooking..." : "Confirm Rebook"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* POA Review Dialog */}
      <Dialog open={viewPoaDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setViewPoaDialogOpen(false);
          setPoaBooking(null);
          setPoaRejectionReason("");
        }
      }}>
        <DialogContent className="border border-gray-200 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-orange-600" />
              Review Power of Attorney Documents
            </DialogTitle>
            <DialogDescription>
              Review the POA and attorney ID documents submitted for this booking
            </DialogDescription>
          </DialogHeader>
          
          {poaBooking && (
            <div className="space-y-4 py-4">
              {/* Booking Details */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-2">
                <h4 className="font-semibold text-sm">Booking Details</h4>
                <p className="text-sm text-gray-600">
                  <strong>Unit:</strong> {(poaBooking as any).unit?.unit || 'N/A'}
                </p>
                <p className="text-sm text-gray-600">
                  <strong>Owner:</strong> {poaBooking.user?.full_name || poaBooking.customerEmail}
                </p>
                <p className="text-sm text-gray-600">
                  <strong>Date & Time:</strong> {format(poaBooking.date, "EEEE, MMMM d, yyyy")} at {poaBooking.time}
                </p>
              </div>

              {/* POA Documents */}
              <div className="space-y-3">
                <div className="border border-gray-200 rounded-lg p-4">
                  <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Power of Attorney Document
                  </h4>
                  {(poaBooking as any).poa_document_url ? (
                    <a
                      href={(poaBooking as any).poa_document_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 underline text-sm flex items-center gap-2"
                    >
                      <Eye className="w-4 h-4" />
                      View POA Document
                    </a>
                  ) : (
                    <p className="text-sm text-gray-500">No document uploaded</p>
                  )}
                </div>

                <div className="border border-gray-200 rounded-lg p-4">
                  <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Attorney's ID Document
                  </h4>
                  {(poaBooking as any).attorney_id_document_url ? (
                    <a
                      href={(poaBooking as any).attorney_id_document_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 underline text-sm flex items-center gap-2"
                    >
                      <Eye className="w-4 h-4" />
                      View Attorney ID
                    </a>
                  ) : (
                    <p className="text-sm text-gray-500">No document uploaded</p>
                  )}
                </div>
              </div>

              {/* Rejection Reason Input */}
              <div className="space-y-2">
                <Label htmlFor="rejection-reason">Rejection Reason (required if rejecting)</Label>
                <Textarea
                  id="rejection-reason"
                  placeholder="Enter the reason for rejection..."
                  value={poaRejectionReason}
                  onChange={(e) => setPoaRejectionReason(e.target.value)}
                  rows={3}
                  className="resize-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <Button
                  onClick={() => handleApprovePoaBooking(poaBooking.id)}
                  disabled={poaActionLoading}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                >
                  {poaActionLoading ? 'Processing...' : (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Approve & Send Confirmation
                    </>
                  )}
                </Button>
                <Button
                  onClick={() => handleRejectPoaBooking(poaBooking.id)}
                  disabled={poaActionLoading || !poaRejectionReason.trim()}
                  variant="outline"
                  className="flex-1 bg-red-50 hover:bg-red-100 border-red-200 text-red-700"
                >
                  {poaActionLoading ? 'Processing...' : (
                    <>
                      <XCircle className="w-4 h-4 mr-2" />
                      Reject & Delete Booking
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Booking Status Dialog */}
      <Dialog open={!!editingBooking} onOpenChange={(open) => !open && setEditingBooking(null)}>
        <DialogContent className="border border-gray-200">
          <DialogHeader>
            <DialogTitle>Update Booking Status</DialogTitle>
            <DialogDescription>
              {newBookingStatus === "completed" 
                ? "Mark this booking as completed" 
                : "Cancel this booking - the customer will be able to rebook"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Booking Details</Label>
              <p className="text-sm text-gray-600">
                {editingBooking && format(editingBooking.date, "EEEE, MMMM d, yyyy")} at {editingBooking?.time}
              </p>
              <p className="text-sm text-gray-600">{editingBooking?.customerEmail}</p>
            </div>
            {newBookingStatus === "cancelled" && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-yellow-800">
                  ⚠️ This will remove the booking and allow the customer to book a new appointment.
                </p>
              </div>
            )}
            {newBookingStatus === "completed" && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-sm text-green-800">
                  ✓ This booking will be marked as completed.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setEditingBooking(null)}
              disabled={cancellingBooking}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleUpdateBookingStatus}
              disabled={cancellingBooking}
              className={newBookingStatus === "completed" 
                ? "bg-green-600 hover:bg-green-700 text-white" 
                : "bg-red-600 hover:bg-red-700 text-white"}
            >
              {cancellingBooking ? "Cancelling..." : (newBookingStatus === "completed" ? "Mark as Completed" : "Cancel Booking")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Project Selection Dialog for Send All */}
      <Dialog open={projectSelectOpen} onOpenChange={setProjectSelectOpen}>
        <DialogContent className="border border-gray-200">
          <DialogHeader>
            <DialogTitle>Select Project</DialogTitle>
            <DialogDescription>
              Choose which project's users should receive the SOA email
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Project Filter</Label>
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Projects ({users.length} users)</SelectItem>
                  {userProjects.map((project) => {
                    const projectUsers = users.filter(u => 
                      u.units?.some(unit => unit.property.project_name === project)
                    );
                    const usersWithSOA = projectUsers.filter(u => 
                      u.attachments?.some(att => att.type === "soa")
                    );
                    return (
                      <SelectItem key={project} value={project}>
                        {project} ({usersWithSOA.length}/{projectUsers.length} SOA uploaded)
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* SOA Upload Status */}
            {(() => {
              let filteredUsers = users;
              if (selectedProject !== "all") {
                filteredUsers = users.filter(u => 
                  u.units?.some(unit => unit.property.project_name === selectedProject)
                );
              }
              const usersWithSOA = filteredUsers.filter(u => 
                u.attachments?.some(att => att.type === "soa")
              );
              const usersWithoutSOA = filteredUsers.filter(u => 
                !u.attachments?.some(att => att.type === "soa")
              );
              const percentage = filteredUsers.length > 0 
                ? Math.round((usersWithSOA.length / filteredUsers.length) * 100) 
                : 0;

              return (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">SOA Upload Progress</span>
                      <span className="text-gray-600">{usersWithSOA.length}/{filteredUsers.length} ({percentage}%)</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                      <div 
                        className={`h-2.5 rounded-full transition-all ${
                          percentage === 100 ? 'bg-green-600' : 'bg-blue-600'
                        }`}
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                  </div>

                  {usersWithoutSOA.length > 0 && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                      <p className="text-sm font-medium text-yellow-800 mb-2">
                        ⚠️ {usersWithoutSOA.length} user(s) missing SOA:
                      </p>
                      <div className="max-h-32 overflow-y-auto space-y-1">
                        {usersWithoutSOA.map(u => (
                          <p key={u.id} className="text-xs text-yellow-700">
                            • {u.full_name} ({u.email})
                          </p>
                        ))}
                      </div>
                    </div>
                  )}

                  {percentage === 100 && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <p className="text-sm text-green-800">
                        ✓ All users have SOA uploaded. Ready to send!
                      </p>
                    </div>
                  )}
                </div>
              );
            })()}

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-800">
                ℹ️ All users must have SOA uploaded before sending emails.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProjectSelectOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleProjectSelected} 
              className="bg-blue-600 hover:bg-blue-700 text-white"
              disabled={(() => {
                let filteredUsers = users;
                if (selectedProject !== "all") {
                  filteredUsers = users.filter(u => 
                    u.units?.some(unit => unit.property.project_name === selectedProject)
                  );
                }
                const usersWithoutSOA = filteredUsers.filter(u => 
                  !u.attachments?.some(att => att.type === "soa")
                );
                return usersWithoutSOA.length > 0;
              })()}
            >
              Continue to Compose Email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Missing SOA Dialog */}
      <Dialog open={missingSOADialogOpen} onOpenChange={setMissingSOADialogOpen}>
        <DialogContent className="border border-gray-200 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-red-600">Missing Statement of Account</DialogTitle>
            <DialogDescription>
              The following users do not have SOA uploaded. Please upload SOA for all users before sending emails.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-yellow-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <div className="flex-1">
                  <h4 className="font-semibold text-yellow-800 mb-2">
                    {usersWithoutSOA.length} User{usersWithoutSOA.length !== 1 ? 's' : ''} Without SOA
                  </h4>
                  <div className="space-y-1 max-h-60 overflow-y-auto">
                    {usersWithoutSOA.map((user) => (
                      <div key={user.id} className="text-sm text-yellow-700 bg-white rounded px-3 py-2 border border-yellow-200">
                        <div className="font-medium">{user.full_name}</div>
                        <div className="text-xs text-yellow-600">{user.email}</div>
                        {user.units && user.units.length > 0 && (
                          <div className="text-xs text-yellow-600">
                            Unit: {user.units[0].unit} - {user.units[0].property.project_name}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMissingSOADialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send Email Dialog */}
      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent className="border border-gray-200 max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Send Email with SOA</DialogTitle>
            <DialogDescription>
              Compose and send Statement of Account to {emailRecipients.length} recipient(s)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Recipients Section */}
            <div className="space-y-2">
              <Label>Recipients ({emailRecipients.length})</Label>
              <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-3 bg-gray-50">
                {emailRecipients.length === 0 ? (
                  <p className="text-sm text-gray-500">No recipients selected. Check users from the table above.</p>
                ) : (
                  <div className="space-y-2">
                    {emailRecipients.map((user) => (
                      <div key={user.id} className="flex items-center justify-between bg-white p-2 rounded border border-gray-200">
                        <div className="flex-1">
                          <p className="text-sm font-medium">{user.full_name}</p>
                          <p className="text-xs text-gray-500">{user.email}</p>
                          <p className="text-xs text-gray-400">
                            {user.units?.map(u => `${u.unit} (${u.property.project_name})`).join(', ') || 'No units'}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => toggleRecipient(user)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Email Template Preview */}
            <div className="space-y-2">
              <Label>Email Subject</Label>
              <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md">
                <p className="text-sm font-medium">Handover Notice</p>
              </div>
            </div>

            {/* Email Body Preview */}
            <div className="space-y-2">
              <Label>Email Template</Label>
              <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md space-y-2">
                <p className="text-sm">Dear <span className="text-blue-600 font-medium">[Customer Name]</span>,</p>
                <p className="text-sm">This email uses the Handover Notice template with dynamic values:</p>
                <ul className="text-sm space-y-1 ml-4 list-disc">
                  <li><span className="text-blue-600 font-medium">[Customer Name]</span> - Recipient's first name</li>
                  <li><span className="text-blue-600 font-medium">[Unit Number]</span> - Unit details</li>
                  <li><span className="text-blue-600 font-medium">[Project Name]</span> - Property project</li>
                  <li><span className="text-blue-600 font-medium">[SOA Attachment]</span> - Statement of Account PDF</li>
                </ul>
                <p className="text-xs text-gray-500 mt-2">
                  ℹ️ Template content is managed in the backend and will be automatically populated for each recipient.
                </p>
              </div>
            </div>

            {/* Email Preview */}
            {emailRecipients.length > 0 && (
              <div className="space-y-2">
                <Label className="text-base font-semibold">Email Content Preview</Label>
                <div className="bg-white rounded-lg border-2 border-gray-300 overflow-hidden">
                  {/* Email Header */}
                  <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                    <div className="text-sm text-gray-700 mb-1">
                      <span className="font-medium">To:</span> {emailRecipients[0].email}
                    </div>
                    <div className="text-sm text-gray-700">
                      <span className="font-medium">Subject:</span> Handover Notice
                    </div>
                  </div>
                  
                  {/* Email Body */}
                  <div className="p-6 max-h-[400px] overflow-y-auto">
                    <div className="space-y-4 text-sm">
                      <p>Dear {emailRecipients[0].full_name.split(' ')[0]},</p>
                      
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
                  
                  {/* Attachments */}
                  <div className="bg-gray-50 px-4 py-3 border-t border-gray-200">
                    <Label className="text-sm font-semibold flex items-center gap-2">
                      <Paperclip className="w-4 h-4" />
                      Attachments
                    </Label>
                    <div className="mt-2 space-y-3">
                      {emailRecipients[0].attachments?.some(att => att.type === "soa") ? (
                        <div className="space-y-2">
                          {emailRecipients[0].attachments
                            .filter(att => att.type === "soa")
                            .map((attachment) => (
                              <div key={attachment.id} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-300">
                                <FileText className="w-5 h-5 text-blue-600 flex-shrink-0" />
                                <div className="flex-1">
                                  <p className="text-sm font-medium">{attachment.filename}</p>
                                  <p className="text-xs text-gray-500">
                                    Uploaded {format(new Date(attachment.created_at), "MMM d, yyyy")}
                                  </p>
                                </div>
                                <Badge variant="outline" className="text-xs">PDF</Badge>
                              </div>
                            ))}
                          <div className="p-2 bg-green-50 border border-green-200 rounded">
                            <p className="text-xs text-green-800">
                              ✓ SOA document will be attached to this email
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="p-3 bg-red-50 border border-red-200 rounded">
                          <p className="text-sm text-red-800 font-medium">
                            ⚠️ No SOA uploaded for this user
                          </p>
                        </div>
                      )}
                      
                      {/* Service Charge Acknowledgement Download */}
                      {emailRecipients[0].units && emailRecipients[0].units.length > 0 && (
                        <div className="border-t border-gray-200 pt-3">
                          <Label className="text-sm font-medium mb-2 block">Service Charge Acknowledgement</Label>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full justify-start gap-2 hover:bg-orange-50 hover:border-orange-500"
                            onClick={async () => {
                              try {
                                const unitId = emailRecipients[0].units![0].id;
                                const blob = await downloadServiceChargeAcknowledgement(unitId, authToken);
                                const url = window.URL.createObjectURL(blob);
                                const link = document.createElement("a");
                                link.href = url;
                                link.download = `Service_Charge_Acknowledgement_${emailRecipients[0].units![0].unit}.pdf`;
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
                            <span className="text-sm">Download Template (Pre-filled)</span>
                          </Button>
                          <p className="text-xs text-gray-500 mt-1">
                            This template is included in the initial handover notice and auto-filled with owner information.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Info Banners */}
            {emailRecipients.length > 200 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-800 font-medium">
                  ⚠️ Maximum 200 recipients per batch! You have {emailRecipients.length} selected.
                </p>
                <p className="text-xs text-red-700 mt-1">
                  Please reduce the number of recipients or contact support to enable queue-based bulk sending.
                </p>
              </div>
            )}
            
            {emailRecipients.length > 100 && emailRecipients.length <= 200 && (
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                <p className="text-sm text-orange-800">
                  📊 Large batch ({emailRecipients.length} recipients). This may take a few minutes to process.
                </p>
              </div>
            )}
            
            {emailRecipients.length > 0 && emailRecipients.length <= 100 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-sm text-green-800">
                  ✅ Ready to send to {emailRecipients.length} recipient(s). Each email will be personalized and logged.
                </p>
              </div>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
              <p className="text-sm text-blue-800 font-medium">
                📧 Email System Features:
              </p>
              <ul className="text-xs text-blue-700 space-y-1 ml-4 list-disc">
                <li>Each email is personalized with recipient's name, unit, and project</li>
                <li>All sent emails are logged to database with timestamps</li>
                <li>System can handle up to 200 recipients per batch</li>
                <li>Failed emails are tracked separately for retry</li>
                <li>SOA attachments will be automatically included (requires SMTP setup)</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSendEmailSubmit}
              disabled={sendingEmail || emailRecipients.length === 0 || emailRecipients.length > 200 || !emailSubject.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sendingEmail ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Send Email
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Upload SOA Dialog */}
      <Dialog open={bulkSOADialogOpen} onOpenChange={(open) => {
        setBulkSOADialogOpen(open);
        if (!open) {
          setSOAFiles([]);
        }
      }}>
        <DialogContent className="border border-gray-200 max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Bulk Upload SOA</DialogTitle>
            <DialogDescription>
              Upload multiple SOA files. Files should be named as: [unit_no]-SOA.pdf (e.g., 202-SOA.pdf)
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Dropzone */}
            <div
              className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors cursor-pointer"
              onDragOver={(e) => {
                e.preventDefault();
                e.currentTarget.classList.add('border-blue-500', 'bg-blue-50');
              }}
              onDragLeave={(e) => {
                e.currentTarget.classList.remove('border-blue-500', 'bg-blue-50');
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.currentTarget.classList.remove('border-blue-500', 'bg-blue-50');
                const files = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf');
                if (files.length > 0) {
                  setSOAFiles(prev => [...prev, ...files]);
                } else {
                  toast.error('Please upload PDF files only');
                }
              }}
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.multiple = true;
                input.accept = 'application/pdf';
                input.onchange = (e) => {
                  const files = Array.from((e.target as HTMLInputElement).files || []);
                  setSOAFiles(prev => [...prev, ...files]);
                };
                input.click();
              }}
            >
              <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p className="text-sm text-gray-600 mb-2">
                Drag and drop SOA files here, or click to browse
              </p>
              <p className="text-xs text-gray-500">
                Only PDF files accepted
              </p>
            </div>

            {/* File Preview with Unit Matching */}
            {soaFiles.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-medium text-sm">Files to Upload ({soaFiles.length})</h3>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium text-gray-700">File Name</th>
                        <th className="px-4 py-2 text-left font-medium text-gray-700">Matched Unit</th>
                        <th className="px-4 py-2 text-left font-medium text-gray-700">Status</th>
                        <th className="px-4 py-2 text-center font-medium text-gray-700">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {soaFiles.map((file, index) => {
                        // Extract unit number from filename: [unit_no]-SOA.pdf or [unit_no]-soa.pdf
                        const match = file.name.match(/^([^-]+)-soa[.]pdf$/i);
                        const extractedUnitNo = match ? match[1].trim() : null;
                        
                        // Find matching unit from allUnitsForListing
                        const matchedUnit = extractedUnitNo 
                          ? allUnitsForListing.find(u => u.unit === extractedUnitNo)
                          : null;
                        
                        const hasValidFormat = match !== null;
                        const hasMatch = matchedUnit !== null;
                        
                        return (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <FileText className="w-4 h-4 text-red-500" />
                                <span className="text-gray-900">{file.name}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              {matchedUnit ? (
                                <div className="text-sm">
                                  <div className="font-medium text-gray-900">Unit {matchedUnit.unit}</div>
                                  <div className="text-gray-500">{matchedUnit.property?.project_name || 'N/A'}</div>
                                </div>
                              ) : (
                                <span className="text-gray-400 italic">No match</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {!hasValidFormat ? (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                  Invalid format
                                </span>
                              ) : !hasMatch ? (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                  Unit not found
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                  <Check className="w-3 h-3 mr-1" />
                                  Ready
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSOAFiles(prev => prev.filter((_, i) => i !== index));
                                }}
                                className="h-8 w-8 p-0"
                              >
                                <Trash2 className="w-4 h-4 text-gray-500 hover:text-red-600" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                
                {/* Summary */}
                <div className="flex items-center gap-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className="text-gray-700">
                      Ready: <span className="font-medium">{soaFiles.filter(f => {
                        const match = f.name.match(/^([^-]+)-soa[.]pdf$/i);
                        const extractedUnitNo = match ? match[1].trim() : null;
                        return extractedUnitNo && allUnitsForListing.find(u => u.unit === extractedUnitNo);
                      }).length}</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-yellow-600" />
                    <span className="text-gray-700">
                      Issues: <span className="font-medium">{soaFiles.filter(f => {
                        const match = f.name.match(/^([^-]+)-soa[.]pdf$/i);
                        const extractedUnitNo = match ? match[1].trim() : null;
                        return !extractedUnitNo || !allUnitsForListing.find(u => u.unit === extractedUnitNo);
                      }).length}</span>
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setBulkSOADialogOpen(false);
                setSOAFiles([]);
              }}
              disabled={uploadingSOAs}
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                // Filter only valid files
                const validFiles = soaFiles.filter(f => {
                  const match = f.name.match(/^([^-]+)-soa[.]pdf$/i);
                  const extractedUnitNo = match ? match[1].trim() : null;
                  return extractedUnitNo && allUnitsForListing.find(u => u.unit === extractedUnitNo);
                });

                if (validFiles.length === 0) {
                  toast.error('No valid files to upload');
                  return;
                }

                setUploadingSOAs(true);

                try {
                  // Prepare data for bulk upload
                  const formData = new FormData();
                  const unitIds: number[] = [];

                  validFiles.forEach((file) => {
                    const match = file.name.match(/^([^-]+)-soa[.]pdf$/i);
                    const unitNo = match![1].trim();
                    const unit = allUnitsForListing.find(u => u.unit === unitNo);
                    
                    if (unit) {
                      formData.append('files[]', file);
                      unitIds.push(unit.id);
                    }
                  });

                  // Append unit IDs as individual form fields
                  unitIds.forEach((id) => {
                    formData.append('unit_ids[]', id.toString());
                  });

                  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/units/bulk-upload-soa`, {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bearer ${authToken}`,
                    },
                    body: formData,
                  });

                  const result = await response.json();

                  if (response.ok) {
                    toast.success(result.message || `Successfully uploaded ${result.uploaded_count} SOA file(s)`);
                    if (result.errors && result.errors.length > 0) {
                      console.error('Some files failed:', result.errors);
                      toast.error(`${result.errors.length} file(s) failed to upload`);
                    }
                    fetchAllUnitsForListing(); // Refresh units
                  } else {
                    toast.error(result.message || 'Failed to upload SOA files');
                  }
                } catch (error) {
                  console.error('Error uploading SOA files:', error);
                  toast.error('Failed to upload SOA files');
                }

                setUploadingSOAs(false);
                setBulkSOADialogOpen(false);
                setSOAFiles([]);
              }}
              disabled={uploadingSOAs || soaFiles.filter(f => {
                const match = f.name.match(/^([^-]+)-soa[.]pdf$/i);
                const extractedUnitNo = match ? match[1].trim() : null;
                return extractedUnitNo && allUnitsForListing.find(u => u.unit === extractedUnitNo);
              }).length === 0}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {uploadingSOAs ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload {soaFiles.filter(f => {
                    const match = f.name.match(/^([^-]+)-soa[.]pdf$/i);
                    const extractedUnitNo = match ? match[1].trim() : null;
                    return extractedUnitNo && allUnitsForListing.find(u => u.unit === extractedUnitNo);
                  }).length} File(s)
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Send Handover Dialog */}
      <Dialog open={bulkHandoverDialogOpen} onOpenChange={(open) => {
        setBulkHandoverDialogOpen(open);
        if (!open) {
          setSelectedUnitsForHandover(new Set());
        }
      }}>
        <DialogContent className="border border-gray-200 max-w-2xl">
          <DialogHeader>
            <DialogTitle>Confirm Bulk Send Handover Notice</DialogTitle>
            <DialogDescription>
              You are about to send handover notice emails to the selected units. This action will queue the emails for background processing.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Summary */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-blue-600 mt-0.5" />
                <div className="flex-1 space-y-2">
                  <div className="font-medium text-gray-900">
                    {selectedUnitsForHandover.size} unit{selectedUnitsForHandover.size !== 1 ? 's' : ''} selected
                  </div>
                  <div className="text-sm text-gray-600">
                    Units: {Array.from(selectedUnitsForHandover).map(id => {
                      const unit = allUnitsForListing.find(u => u.id === id);
                      return unit?.unit;
                    }).filter(Boolean).join(', ')}
                  </div>
                  <div className="text-sm text-gray-600 mt-2">
                    Each email will include:
                    <ul className="list-disc list-inside mt-1 ml-2 space-y-1">
                      <li>SOA document(s)</li>
                      <li>Service Charge Acknowledgement PDF</li>
                      <li>Project-specific handover documents</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* Warning */}
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                <div className="text-sm text-gray-700">
                  <p className="font-medium mb-1">Please note:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Emails will be queued and sent in the background</li>
                    <li>Units without owners will be automatically skipped</li>
                    <li>You can continue working while emails are being sent</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setBulkHandoverDialogOpen(false);
                setSelectedUnitsForHandover(new Set());
              }}
              disabled={sendingHandovers}
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (selectedUnitsForHandover.size === 0) {
                  toast.error('Please select at least one unit');
                  return;
                }

                setSendingHandovers(true);

                try {
                  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/units/bulk-send-handover`, {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bearer ${authToken}`,
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      unit_ids: Array.from(selectedUnitsForHandover)
                    }),
                  });

                  const result = await response.json();

                  if (response.ok) {
                    toast.success(result.message || `Queued ${result.queued_count} handover email(s)`);
                    
                    // Show progress popup if we got a batch_id
                    if (result.batch_id) {
                      localStorage.setItem('currentEmailBatchId', result.batch_id);
                      setEmailProgressBatchId(result.batch_id);
                      setEmailProgressOpen(true);
                    }
                    
                    if (result.skipped && result.skipped.length > 0) {
                      console.log('Skipped units:', result.skipped);
                      toast.warning(`${result.skipped.length} unit(s) were skipped`);
                    }
                    fetchAllUnitsForListing(); // Refresh units
                  } else {
                    toast.error(result.message || 'Failed to queue handover emails');
                  }
                } catch (error) {
                  console.error('Error sending handover emails:', error);
                  toast.error('Failed to queue handover emails');
                }

                setSendingHandovers(false);
                setBulkHandoverDialogOpen(false);
                setSelectedUnitsForHandover(new Set());
              }}
              disabled={sendingHandovers || selectedUnitsForHandover.size === 0}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {sendingHandovers ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Queueing...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Send to {selectedUnitsForHandover.size} Unit(s)
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Send SOA Email Dialog */}
      <Dialog open={bulkSOAEmailDialogOpen} onOpenChange={(open) => {
        setBulkSOAEmailDialogOpen(open);
      }}>
        <DialogContent className="border border-gray-200 max-w-2xl">
          <DialogHeader>
            <DialogTitle>Confirm Bulk Send SOA Email</DialogTitle>
            <DialogDescription>
              You are about to send SOA emails to the selected units. Each email will contain only the Statement of Account (SOA) document.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Summary */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-blue-600 mt-0.5" />
                <div className="flex-1 space-y-2">
                  <div className="font-medium text-gray-900">
                    {selectedUnitsForHandover.size} unit{selectedUnitsForHandover.size !== 1 ? 's' : ''} selected
                  </div>
                  <div className="text-sm text-gray-600">
                    Units: {Array.from(selectedUnitsForHandover).map(id => {
                      const unit = allUnitsForListing.find(u => u.id === id);
                      return unit?.unit;
                    }).filter(Boolean).join(', ')}
                  </div>
                  <div className="text-sm text-gray-600 mt-2">
                    Each email will include:
                    <ul className="list-disc list-inside mt-1 ml-2 space-y-1">
                      <li>Statement of Account (SOA) document</li>
                      <li>Payment instructions and bank details</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* Email Preview */}
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <div className="text-sm">
                <p className="font-medium mb-2 text-gray-900">Email Content:</p>
                <div className="text-gray-700 space-y-2 text-xs">
                  <p>Dear [Client Name],</p>
                  <p>Referring to our email earlier with regards to the issuance of Viera Residences Building Completion Certificate (BCC), please find attached your Statement of Account (SOA) summary, which outlines the payments received to date and the outstanding balance for your property.</p>
                  <p>We kindly request you to review the attached SOA and proceed with the settlement of the remaining balance.</p>
                  <p className="font-medium">Escrow Account Details:</p>
                  <ul className="list-none ml-2 space-y-0.5">
                    <li>• Account Name: VIERA RESIDENCES</li>
                    <li>• Bank: COMMERCIAL BANK INTERNATIONAL PJSC (CBI)</li>
                    <li>• Account No.: 100110040083</li>
                    <li>• IBAN: AE740220000100110040083</li>
                  </ul>
                  <p className="italic">Your new home will be ready very soon!</p>
                </div>
              </div>
            </div>

            {/* Warning */}
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                <div className="text-sm text-gray-700">
                  <p className="font-medium mb-1">Please note:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Only units with uploaded SOA will receive emails</li>
                    <li>Emails will be queued and sent in the background</li>
                    <li>Units without owners will be automatically skipped</li>
                    <li>You can continue working while emails are being sent</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setBulkSOAEmailDialogOpen(false);
              }}
              disabled={sendingSOAEmails}
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (selectedUnitsForHandover.size === 0) {
                  toast.error('Please select at least one unit');
                  return;
                }

                setSendingSOAEmails(true);

                try {
                  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/units/bulk-send-soa-email`, {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bearer ${authToken}`,
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      unit_ids: Array.from(selectedUnitsForHandover)
                    }),
                  });

                  const result = await response.json();

                  if (response.ok) {
                    toast.success(result.message || `Queued ${result.queued_count} SOA email(s)`);
                    
                    // Show progress popup if we got a batch_id
                    if (result.batch_id) {
                      localStorage.setItem('currentEmailBatchId', result.batch_id);
                      setEmailProgressBatchId(result.batch_id);
                      setEmailProgressOpen(true);
                    }
                    
                    if (result.skipped && result.skipped.length > 0) {
                      console.log('Skipped units:', result.skipped);
                      toast.warning(`${result.skipped.length} unit(s) were skipped (missing SOA or owners)`);
                    }
                    fetchAllUnitsForListing(); // Refresh units
                  } else {
                    toast.error(result.message || 'Failed to queue SOA emails');
                  }
                } catch (error) {
                  console.error('Error sending SOA emails:', error);
                  toast.error('Failed to queue SOA emails');
                }

                setSendingSOAEmails(false);
                setBulkSOAEmailDialogOpen(false);
              }}
              disabled={sendingSOAEmails || selectedUnitsForHandover.size === 0}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {sendingSOAEmails ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Queueing...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Send to {selectedUnitsForHandover.size} Unit(s)
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Client Dialog */}
      <Dialog open={addClientDialogOpen} onOpenChange={setAddClientDialogOpen}>
        <DialogContent className="border border-gray-200">
          <DialogHeader>
            <DialogTitle>Add New Client</DialogTitle>
            <DialogDescription>
              Create a new client and assign them to a unit
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="project">Project *</Label>
              <Select value={selectedProjectForClient} onValueChange={setSelectedProjectForClient}>
                <SelectTrigger>
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  {userProjects.map((project) => (
                    <SelectItem key={project} value={project}>
                      {project}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="full_name">Full Name *</Label>
              <Input
                id="full_name"
                value={newClientData.full_name}
                onChange={(e) => setNewClientData({...newClientData, full_name: e.target.value})}
                placeholder="John Doe"
              />
            </div>
            <div>
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={newClientData.email}
                onChange={(e) => setNewClientData({...newClientData, email: e.target.value})}
                placeholder="john@example.com"
              />
            </div>
            <div>
              <Label htmlFor="unit_select">Unit *</Label>
              <Select 
                value={selectedUnitId} 
                onValueChange={setSelectedUnitId}
                disabled={!selectedProjectForClient || loadingUnits}
              >
                <SelectTrigger>
                  <SelectValue placeholder={
                    loadingUnits ? "Loading units..." :
                    !selectedProjectForClient ? "Select project first" : 
                    "Select an available unit"
                  } />
                </SelectTrigger>
                <SelectContent>
                  {loadingUnits ? (
                    <SelectItem value="loading" disabled>
                      Loading units...
                    </SelectItem>
                  ) : allUnits.length === 0 ? (
                    <SelectItem value="none" disabled>
                      No available units in this project
                    </SelectItem>
                  ) : (
                    allUnits.map((unit) => (
                      <SelectItem key={unit.id} value={unit.id.toString()}>
                        {unit.unit}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 mt-1">Only showing unoccupied units</p>
            </div>
            <div>
              <Label htmlFor="mobile">Mobile Number (Optional)</Label>
              <Input
                id="mobile"
                value={newClientData.mobile_number}
                onChange={(e) => setNewClientData({...newClientData, mobile_number: e.target.value})}
                placeholder="+971 50 123 4567"
              />
            </div>
            <div>
              <Label htmlFor="passport">Passport Number (Required)</Label>
              <Input
                id="passport"
                value={newClientData.passport_number || ''}
                onChange={(e) => setNewClientData({...newClientData, passport_number: e.target.value})}
                placeholder="Passport number"
                required
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_primary"
                checked={newClientData.is_primary}
                onChange={(e) => setNewClientData({...newClientData, is_primary: e.target.checked})}
                className="w-4 h-4"
              />
              <Label htmlFor="is_primary">Primary Owner</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setAddClientDialogOpen(false);
              setSelectedProjectForClient("");
              setSelectedUnitId("");
            }}>
              Cancel
            </Button>
            <Button 
              onClick={async () => {
                try {
                  if (!selectedUnitId || !selectedProjectForClient) {
                    toast.error("Please select a project and unit");
                    return;
                  }

                  if (!newClientData.passport_number) {
                    toast.error("Passport number is required");
                    return;
                  }

                  const response = await createUserWithUnit({
                    unit_id: parseInt(selectedUnitId),
                    full_name: newClientData.full_name,
                    email: newClientData.email,
                    mobile_number: newClientData.mobile_number || undefined,
                    passport_number: newClientData.passport_number,
                    is_primary: newClientData.is_primary
                  }, authToken);

                  if (response.success) {
                    toast.success(`Client added successfully! Password: ${response.password}`);
                    setAddClientDialogOpen(false);
                    setSelectedProjectForClient("");
                    setSelectedUnitId("");
                    setNewClientData({
                      full_name: "",
                      email: "",
                      unit_number: "",
                      mobile_number: "",
                      passport_number: "",
                      is_primary: true,
                    });
                    // Refresh units data
                    fetchAllUnitsForListing();
                  } else {
                    toast.error(response.message || "Failed to add client");
                  }
                } catch (error: any) {
                  console.error("Failed to add client:", error);
                  toast.error(error.message || "Failed to add client");
                }
              }}
              disabled={!newClientData.full_name || !newClientData.email || !selectedUnitId || !selectedProjectForClient}
            >
              Add Client
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Upload Dialog */}
      <Dialog open={bulkUploadDialogOpen} onOpenChange={setBulkUploadDialogOpen}>
        <DialogContent className="border border-gray-200">
          <DialogHeader>
            <DialogTitle>Bulk Upload Clients</DialogTitle>
            <DialogDescription>
              Upload a CSV or Excel file with client data
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="bulk_project">Project *</Label>
              <Select value={selectedProjectForBulk} onValueChange={setSelectedProjectForBulk}>
                <SelectTrigger>
                  <SelectValue placeholder="Select project for all units in this file" />
                </SelectTrigger>
                <SelectContent>
                  {allProperties.map((property) => (
                    <SelectItem key={property.id} value={property.id.toString()}>
                      {property.project_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 mt-1">All units in the uploaded file will be assigned to this project</p>
            </div>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                className="hidden"
                id="bulk-upload"
              />
              <label htmlFor="bulk-upload" className="cursor-pointer">
                <div className="text-sm text-gray-600">
                  {uploadFile ? (
                    <span className="text-black font-medium">{uploadFile.name}</span>
                  ) : (
                    <>Click to upload or drag and drop</>
                  )}
                </div>
                <div className="text-xs text-gray-500 mt-1">CSV or Excel file</div>
              </label>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-800 font-medium mb-2">Expected Format:</p>
              <ul className="text-xs text-blue-700 space-y-1">
                <li>• Full Name (required)</li>
                <li>• Email (required)</li>
                <li>• Mobile Number (optional)</li>
                <li>• Unit Number (required)</li>
              </ul>
              <p className="text-xs text-blue-700 mt-2">
                <strong>Note:</strong> The first person listed for each unit will automatically be set as the primary buyer.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setBulkUploadDialogOpen(false);
              setUploadFile(null);
              setSelectedProjectForBulk("");
            }}>
              Cancel
            </Button>
            <Button 
              onClick={async () => {
                try {
                  if (!uploadFile || !selectedProjectForBulk) {
                    toast.error("Please select a project and file");
                    return;
                  }

                  // selectedProjectForBulk is already the property ID as a string
                  const propertyId = parseInt(selectedProjectForBulk);
                  if (!propertyId || isNaN(propertyId)) {
                    toast.error("Failed to find property ID");
                    return;
                  }

                  setUploadingBulkClients(true);
                  toast.info("Uploading clients... This may take a moment.");

                  const response = await bulkUploadUsers({
                    property_id: propertyId,
                    file: uploadFile
                  }, authToken);

                  if (response.success) {
                    const created = response.results?.created || 0;
                    const skipped = response.results?.skipped || 0;
                    const errors = response.results?.errors?.length || 0;
                    
                    toast.success(
                      `Upload complete! Created: ${created}, Skipped: ${skipped}` + 
                      (errors > 0 ? `, Errors: ${errors}` : ''),
                      { duration: 5000 }
                    );
                    
                    if (response.results && response.results.errors.length > 0) {
                      console.log("Upload errors:", response.results.errors);
                    }
                    
                    setBulkUploadDialogOpen(false);
                    setUploadFile(null);
                    setSelectedProjectForBulk("");
                    // Refresh units data
                    fetchAllUnitsForListing();
                  } else {
                    toast.error(response.message || "Failed to upload file");
                  }
                } catch (error: any) {
                  console.error("Failed to bulk upload clients:", error);
                  toast.error(error.message || "Failed to upload file");
                } finally {
                  setUploadingBulkClients(false);
                }
              }}
              disabled={!uploadFile || !selectedProjectForBulk || uploadingBulkClients}
            >
              {uploadingBulkClients ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Unit Dialog */}
      <Dialog open={addUnitDialogOpen} onOpenChange={setAddUnitDialogOpen}>
        <DialogContent className="border border-gray-200">
          <DialogHeader>
            <DialogTitle>Add New Unit</DialogTitle>
            <DialogDescription>
              Add a single unit to the system
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="unit_project">Project *</Label>
              <Select value={selectedProjectForNewUnit} onValueChange={setSelectedProjectForNewUnit}>
                <SelectTrigger>
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  {userProjects.map((project) => (
                    <SelectItem key={project} value={project}>
                      {project}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="unit_number">Unit Number *</Label>
              <Input
                id="unit_number"
                value={newUnitData.unit_number}
                onChange={(e) => setNewUnitData({...newUnitData, unit_number: e.target.value})}
                placeholder="A-101"
              />
            </div>
            <div>
              <Label htmlFor="floor">Floor (Optional)</Label>
              <Input
                id="floor"
                value={newUnitData.floor}
                onChange={(e) => setNewUnitData({...newUnitData, floor: e.target.value})}
                placeholder="10"
              />
            </div>
            <div>
              <Label htmlFor="building">Building/Block (Optional)</Label>
              <Input
                id="building"
                value={newUnitData.building}
                onChange={(e) => setNewUnitData({...newUnitData, building: e.target.value})}
                placeholder="Tower A"
              />
            </div>
            <div>
              <Label htmlFor="square_footage">Square Footage (Optional)</Label>
              <Input
                id="square_footage"
                value={newUnitData.square_footage}
                onChange={(e) => setNewUnitData({...newUnitData, square_footage: e.target.value})}
                placeholder="1200"
                type="number"
              />
            </div>
            <div>
              <Label htmlFor="dewa_premise_number">DEWA Premise Number *</Label>
              <Input
                id="dewa_premise_number"
                value={newUnitData.dewa_premise_number}
                onChange={(e) => setNewUnitData({...newUnitData, dewa_premise_number: e.target.value})}
                placeholder="685151093"
              />
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs text-blue-700">
                This unit will be added as available (unoccupied). You can assign owners later from the Unit Management tab.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setAddUnitDialogOpen(false);
              setSelectedProjectForNewUnit("");
              setNewUnitData({
                unit_number: "",
                floor: "",
                building: "",
                square_footage: "",
                dewa_premise_number: "",
              });
            }}>
              Cancel
            </Button>
            <Button 
              onClick={async () => {
                try {
                  if (!newUnitData.unit_number || !selectedProjectForNewUnit) {
                    toast.error("Please fill in required fields");
                    return;
                  }

                  const propertyId = getPropertyIdByName(selectedProjectForNewUnit);
                  if (!propertyId) {
                    toast.error("Failed to find property ID");
                    return;
                  }

                  const response = await createUnit({
                    property_id: propertyId,
                    unit: newUnitData.unit_number,
                    floor: newUnitData.floor || undefined,
                    building: newUnitData.building || undefined,
                    square_footage: newUnitData.square_footage ? parseFloat(newUnitData.square_footage) : undefined,
                    dewa_premise_number: newUnitData.dewa_premise_number || undefined
                  }, authToken);

                  if (response.success) {
                    toast.success("Unit added successfully");
                    setAddUnitDialogOpen(false);
                    setSelectedProjectForNewUnit("");
                    setNewUnitData({
                      unit_number: "",
                      floor: "",
                      building: "",
                      square_footage: "",
                      dewa_premise_number: "",
                    });
                    // Refresh units data
                    fetchAllUnitsForListing();
                  } else {
                    toast.error(response.message || "Failed to add unit");
                  }
                } catch (error: any) {
                  console.error("Failed to add unit:", error);
                  toast.error(error.message || "Failed to add unit");
                }
              }}
              disabled={!newUnitData.unit_number || !selectedProjectForNewUnit}
            >
              <Building2 className="w-4 h-4 mr-2" />
              Add Unit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Units Dialog */}
      <Dialog open={uploadUnitsDialogOpen} onOpenChange={setUploadUnitsDialogOpen}>
        <DialogContent className="border border-gray-200">
          <DialogHeader>
            <DialogTitle>Upload Units</DialogTitle>
            <DialogDescription>
              Upload a CSV or Excel file with unit data (without owners)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="units_project">Project *</Label>
              <Select value={selectedProjectForUnits} onValueChange={setSelectedProjectForUnits}>
                <SelectTrigger>
                  <SelectValue placeholder="Select project for all units in this file" />
                </SelectTrigger>
                <SelectContent>
                  {userProjects.map((project) => (
                    <SelectItem key={project} value={project}>
                      {project}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 mt-1">All units in the uploaded file will be assigned to this project</p>
            </div>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={(e) => setUploadUnitsFile(e.target.files?.[0] || null)}
                className="hidden"
                id="units-upload"
              />
              <label htmlFor="units-upload" className="cursor-pointer">
                <div className="text-sm text-gray-600">
                  {uploadUnitsFile ? (
                    <span className="text-black font-medium">{uploadUnitsFile.name}</span>
                  ) : (
                    <>Click to upload or drag and drop</>
                  )}
                </div>
                <div className="text-xs text-gray-500 mt-1">CSV or Excel file</div>
              </label>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-800 font-medium mb-2">Expected Format:</p>
              <ul className="text-xs text-blue-700 space-y-1">
                <li>• Unit Number (required)</li>
                <li>• Floor (optional)</li>
                <li>• Building/Block (optional)</li>
                <li>• Square Footage (optional)</li>
                <li>• DEWA Premise Number (optional)</li>
              </ul>
              <p className="text-xs text-blue-700 mt-2">
                These units will be added to the system as available (unoccupied) units.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setUploadUnitsDialogOpen(false);
              setUploadUnitsFile(null);
              setSelectedProjectForUnits("");
            }}>
              Cancel
            </Button>
            <Button 
              onClick={async () => {
                try {
                  if (!uploadUnitsFile || !selectedProjectForUnits) {
                    toast.error("Please select a project and file");
                    return;
                  }

                  const propertyId = getPropertyIdByName(selectedProjectForUnits);
                  if (!propertyId) {
                    toast.error("Failed to find property ID");
                    return;
                  }

                  const response = await bulkUploadUnits({
                    property_id: propertyId,
                    file: uploadUnitsFile
                  }, authToken);

                  if (response.success) {
                    toast.success(response.message || "Units uploaded successfully");
                    if (response.results && response.results.errors.length > 0) {
                      console.log("Upload errors:", response.results.errors);
                      toast.info(`${response.results.errors.length} rows had errors. Check console for details.`);
                    }
                    setUploadUnitsDialogOpen(false);
                    setUploadUnitsFile(null);
                    setSelectedProjectForUnits("");
                    // Refresh units data
                    fetchAllUnitsForListing();
                  } else {
                    toast.error(response.message || "Failed to upload units");
                  }
                } catch (error: any) {
                  console.error("Failed to bulk upload units:", error);
                  toast.error(error.message || "Failed to upload units");
                }
              }}
              disabled={!uploadUnitsFile || !selectedProjectForUnits}
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload Units
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Test Celebration Button - Fixed position
      <Button
        onClick={() => setShowCelebration(true)}
        className="fixed bottom-4 right-4 bg-purple-600 hover:bg-purple-700 text-white shadow-lg z-50"
      >
        🎉 Test Celebration
      </Button> */}

      {/* Celebration Dialog */}
      <Dialog open={showCelebration} onOpenChange={setShowCelebration}>
        <DialogContent className="max-w-md border-0 bg-gradient-to-br from-green-50 to-blue-50 overflow-hidden">
          <style jsx global>{`
            @keyframes float-up {
              0% {
                transform: translateY(100vh) rotate(0deg);
                opacity: 1;
              }
              100% {
                transform: translateY(-100vh) rotate(360deg);
                opacity: 0;
              }
            }
            
            @keyframes confetti {
              0% {
                transform: translateY(0) rotate(0deg);
                opacity: 1;
              }
              100% {
                transform: translateY(100vh) rotate(720deg);
                opacity: 0;
              }
            }
            
            .balloon {
              position: absolute;
              bottom: -100px;
              animation: float-up 6s ease-in infinite;
              font-size: 3rem;
            }
            
            .balloon:nth-child(1) { left: 10%; animation-delay: 0s; }
            .balloon:nth-child(2) { left: 25%; animation-delay: 0.5s; }
            .balloon:nth-child(3) { left: 40%; animation-delay: 1s; }
            .balloon:nth-child(4) { left: 55%; animation-delay: 1.5s; }
            .balloon:nth-child(5) { left: 70%; animation-delay: 2s; }
            .balloon:nth-child(6) { left: 85%; animation-delay: 2.5s; }
            
            .confetti {
              position: absolute;
              width: 10px;
              height: 10px;
              background: #f0f;
              top: -10px;
              animation: confetti 3s ease-in infinite;
            }
            
            .confetti:nth-child(odd) { background: #0ff; }
            .confetti:nth-child(3n) { background: #ff0; }
            .confetti:nth-child(5n) { background: #0f0; }
          `}</style>
          
          <div className="absolute inset-0 pointer-events-none">
            <div className="balloon">🎈</div>
            <div className="balloon">🎈</div>
            <div className="balloon">🎈</div>
            <div className="balloon">🎈</div>
            <div className="balloon">🎈</div>
            <div className="balloon">🎈</div>
            
            {[...Array(20)].map((_, i) => (
              <div 
                key={i}
                className="confetti"
                style={{
                  left: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 3}s`,
                  animationDuration: `${2 + Math.random() * 2}s`
                }}
              />
            ))}
          </div>
          
          <div className="relative z-10 text-center py-8">
            <div className="text-6xl mb-4 animate-bounce">🎉</div>
            <h2 className="text-3xl font-bold text-green-600 mb-2">
              Congratulations!
            </h2>
            <p className="text-xl text-gray-700 mb-4">
              Handover Completed Successfully!
            </p>
            <div className="bg-white rounded-lg p-4 shadow-md mb-6">
              <p className="text-sm text-gray-600 mb-2">
                All documents have been verified and submitted.
              </p>
              <p className="text-sm font-semibold text-blue-600">
                A congratulations email has been sent to the client.
              </p>
            </div>
            <div className="flex gap-2 justify-center">
              <Button
                onClick={() => setShowCelebration(false)}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                ✓ Great!
              </Button>
              <Button
                onClick={() => {
                  setShowCelebration(false);
                  // Could navigate somewhere or refresh
                }}
                variant="outline"
              >
                View Details
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Email Progress Popup */}
      <EmailProgressPopup
        batchId={emailProgressBatchId}
        open={emailProgressOpen}
        onOpenChange={(open) => {
          setEmailProgressOpen(open);
          // Clear batch ID from localStorage when manually closing completed batch
          if (!open && emailProgressBatchId) {
            const checkCompletion = async () => {
              try {
                const response = await fetch(
                  `${process.env.NEXT_PUBLIC_API_URL}/units/handover-batch/${emailProgressBatchId}/progress`,
                  {
                    headers: {
                      Authorization: `Bearer ${authToken}`,
                    },
                  }
                );
                const data = await response.json();
                if (data.success && data.batch.status === 'completed') {
                  localStorage.removeItem('currentEmailBatchId');
                }
              } catch (error) {
                console.error('Error checking batch status:', error);
              }
            };
            checkCompletion();
          }
        }}
      />

      {/* SOA Generation Progress Popup */}
      <SOAProgressPopup
        batchId={soaProgressBatchId}
        open={soaProgressOpen}
        onOpenChange={(open) => {
          setSOAProgressOpen(open);
          // Clear batch ID from localStorage when manually closing completed batch
          if (!open && soaProgressBatchId) {
            const checkCompletion = async () => {
              try {
                const response = await fetch(
                  `${process.env.NEXT_PUBLIC_API_URL}/units/soa-batch/${soaProgressBatchId}/progress`,
                  {
                    headers: {
                      Authorization: `Bearer ${authToken}`,
                    },
                  }
                );
                const data = await response.json();
                if (data.success && data.batch.status === 'completed') {
                  localStorage.removeItem('currentSOABatchId');
                }
              } catch (error) {
                console.error('Error checking batch status:', error);
              }
            };
            checkCompletion();
          }
        }}
        onComplete={() => {
          // Refresh the units table when SOA generation completes
          fetchAllUnitsForListing();
        }}
      />

      {/* Sticky Track Progress Buttons */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3">
        <Button
          onClick={checkForActiveEmailBatch}
          disabled={checkingEmailProgress}
          className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg rounded-full px-6 py-6 flex items-center gap-2"
          size="lg"
        >
          {checkingEmailProgress ? (
            <>
              <RefreshCw className="w-5 h-5 animate-spin" />
              <span>Checking...</span>
            </>
          ) : (
            <>
              <Mail className="w-5 h-5" />
              <span>Track Email Progress</span>
            </>
          )}
        </Button>
        <Button
          onClick={checkForActiveSOABatch}
          disabled={checkingSOAProgress}
          className="bg-purple-600 hover:bg-purple-700 text-white shadow-lg rounded-full px-6 py-6 flex items-center gap-2"
          size="lg"
        >
          {checkingSOAProgress ? (
            <>
              <RefreshCw className="w-5 h-5 animate-spin" />
              Checking...
            </>
          ) : (
            <>
              <FileText className="w-5 h-5" />
              Track SOA Progress
            </>
          )}
        </Button>
      </div>

      {/* SOA Regeneration Confirmation Dialog */}
      <Dialog open={soaRegenerationDialogOpen} onOpenChange={setSOARegenerationDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Regenerate SOAs?</DialogTitle>
            <DialogDescription>
              All {soaRegenerationData?.unitsWithSoa || 0} units already have SOAs generated.
              <br /><br />
              Do you want to regenerate all SOAs? This will delete the existing SOAs and create new ones.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setSOARegenerationDialogOpen(false);
                setSOARegenerationData(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                setSOARegenerationDialogOpen(false);
                setGeneratingSOAs(true);
                try {
                  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/units/bulk-generate-soa`, {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bearer ${authToken}`,
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      regenerate: true,
                      with_pho: withPho,
                      unit_ids: uploadedUnitIds.length > 0 ? uploadedUnitIds : undefined
                    }),
                  });

                  const result = await response.json();

                  if (response.ok) {
                    toast.success(result.message || `Queued ${result.queued_count} SOA(s) for regeneration`);
                    
                    if (result.batch_id && result.queued_count > 0) {
                      // Store batch ID in localStorage
                      localStorage.setItem('currentSOABatchId', result.batch_id);
                      setSOAProgressBatchId(result.batch_id);
                      setSOAProgressOpen(true);
                    }
                    
                    fetchAllUnitsForListing();
                  } else {
                    toast.error(result.message || 'Failed to queue SOA regeneration');
                  }
                } catch (error) {
                  console.error('Error regenerating SOAs:', error);
                  toast.error('Failed to queue SOA regeneration');
                }
                setGeneratingSOAs(false);
                setSOARegenerationData(null);
              }}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Yes, Regenerate All
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Details Upload Dialog */}
      <Dialog open={paymentDetailsDialogOpen} onOpenChange={setPaymentDetailsDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Upload Payment Details for SOA Generation</DialogTitle>
            <DialogDescription>
              Upload a CSV/Excel file containing payment details for all units. This data will be used to generate professional Statements of Account.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Select Property</label>
              <Select 
                value={selectedPropertyForPaymentDetails} 
                onValueChange={setSelectedPropertyForPaymentDetails}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select property" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from(new Set(allUnitsForListing.map(u => u.property?.id).filter(Boolean))).map(propertyId => {
                    const unit = allUnitsForListing.find(u => u.property?.id === propertyId);
                    return unit?.property ? (
                      <SelectItem key={propertyId} value={propertyId.toString()}>
                        {unit.property.project_name}
                      </SelectItem>
                    ) : null;
                  })}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Upload CSV/Excel File</label>
              <Input
                type="file"
                accept=".csv,.xlsx"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setPaymentDetailsFile(file);
                  }
                }}
                className="mt-1"
              />
              <p className="text-xs text-gray-500 mt-2">
                Expected columns: Unit Number, Buyer1, Total Unit Price, 4% DLD FEES, ADMIN FEE 5000+VAT, Amount to Pay, Total Amount Paid, {withPho ? 'Upon Completion Amount To Pay, Due After Completion' : 'Outstanding Amount To Pay'}
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="withPho"
                checked={withPho}
                onChange={(e) => setWithPho(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <label htmlFor="withPho" className="text-sm font-medium">
                With PHO (Payment Handover Option)
              </label>
            </div>
            <p className="text-xs text-gray-500">
              {withPho 
                ? 'SOAs will show: Total Amount Paid, Upon Completion Amount To Pay, Due After Completion' 
                : 'SOAs will show: Total Amount Paid, Outstanding Amount To Pay'}
            </p>

            {paymentDetailsFile && (
              <div className="p-3 bg-green-50 border border-green-200 rounded">
                <p className="text-sm text-green-800">
                  <strong>File selected:</strong> {paymentDetailsFile.name}
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setPaymentDetailsDialogOpen(false);
                setPaymentDetailsFile(null);
                setSelectedPropertyForPaymentDetails("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!paymentDetailsFile || !selectedPropertyForPaymentDetails) {
                  toast.error('Please select a property and upload a file');
                  return;
                }

                setUploadingPaymentDetails(true);
                try {
                  const formData = new FormData();
                  formData.append('file', paymentDetailsFile);
                  formData.append('property_id', selectedPropertyForPaymentDetails);
                  formData.append('with_pho', withPho.toString());

                  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/units/upload-payment-details`, {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bearer ${authToken}`,
                    },
                    body: formData,
                  });

                  const result = await response.json();

                  if (response.ok) {
                    toast.success(result.message || `Updated payment details for ${result.updated_count} unit(s)`);
                    const unitIds = result.updated_unit_ids || [];
                    setUploadedUnitIds(unitIds);
                    setPaymentDetailsDialogOpen(false);
                    setPaymentDetailsFile(null);
                    setSelectedPropertyForPaymentDetails("");
                    
                    // Now proceed with SOA generation, passing unit IDs directly
                    await proceedWithSOAGeneration(unitIds);
                  } else {
                    toast.error(result.message || 'Failed to upload payment details');
                  }
                } catch (error) {
                  console.error('Error uploading payment details:', error);
                  toast.error('Failed to upload payment details');
                }
                setUploadingPaymentDetails(false);
              }}
              disabled={!paymentDetailsFile || !selectedPropertyForPaymentDetails || uploadingPaymentDetails}
            >
              {uploadingPaymentDetails ? 'Uploading...' : 'Upload & Generate SOAs'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

  // Function to proceed with SOA generation after payment details upload
  async function proceedWithSOAGeneration(unitIds?: number[]) {
    setGeneratingSOAs(true);
    
    // Use passed unitIds if available, otherwise fall back to state
    const idsToUse = unitIds && unitIds.length > 0 ? unitIds : uploadedUnitIds;
    
    try {
      // First check SOA status (only for uploaded units if available)
      const statusResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/units/check-soa-status`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          unit_ids: idsToUse.length > 0 ? idsToUse : undefined
        }),
      });

      if (!statusResponse.ok) {
        throw new Error('Failed to check SOA status');
      }

      const statusResult = await statusResponse.json();
      
      // If all units have SOAs, show regeneration dialog
      if (statusResult.units_without_soa === 0 && statusResult.units_with_soa > 0) {
        setSOARegenerationData({
          unitsWithSoa: statusResult.units_with_soa,
          unitsWithoutSoa: statusResult.units_without_soa
        });
        setSOARegenerationDialogOpen(true);
        setGeneratingSOAs(false);
        return;
      }

      // Some units are missing SOAs, proceed with generation of missing ones
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/units/bulk-generate-soa`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          with_pho: withPho,
          unit_ids: idsToUse.length > 0 ? idsToUse : undefined
        }),
      });

      const result = await response.json();

      if (response.ok) {
        toast.success(result.message || `Queued ${result.queued_count} SOA(s) for generation`);
        
        if (result.batch_id && result.queued_count > 0) {
          localStorage.setItem('currentSOABatchId', result.batch_id);
          setSOAProgressBatchId(result.batch_id);
          setSOAProgressOpen(true);
        }
        
        fetchAllUnitsForListing();
      } else {
        toast.error(result.message || 'Failed to queue SOA generation');
      }
    } catch (error) {
      console.error('Error generating SOAs:', error);
      toast.error('Failed to queue SOA generation');
    }
    setGeneratingSOAs(false);
  }
}
