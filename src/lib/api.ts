/**
 * API Service for Backend Communication
 */

import { API_BASE_URL } from '@/config/api';

export interface Property {
  id: number;
  project_name: string;
  location: string;
}

export interface Unit {
  id: number;
  property_id: number;
  unit: string;
  status: "unclaimed" | "claimed";
  payment_status?: "pending" | "partial" | "fully_paid";
  handover_ready?: boolean;
  handover_status?: "pending" | "ready" | "completed";
  has_mortgage?: boolean;
  property: Property;
  pivot?: {
    is_primary: boolean;
  };
  users?: Array<{
    id: number;
    full_name: string;
    email: string;
    pivot?: {
      is_primary: boolean;
    };
  }>;
}

interface LoginRequest {
  email: string;
  password: string;
}

interface LoginResponse {
  message: string;
  token: string;
  token_type: string;
  user: {
    id: number;
    full_name: string;
    email: string;
    payment_status: string;
    payment_date: string | null;
    mobile_number: string;
    units?: Unit[];
  };
}

export interface UserAttachment {
  id: number;
  user_id: number;
  unit_id?: number;
  filename: string;
  type: string;
  file_path: string;
  full_url: string;
  created_at: string;
  updated_at: string;
}

export interface Booking {
  id: number;
  user_id: number;
  booked_date: string;
  booked_time: string;
  status?: string;
  created_at: string;
  updated_at: string;
  booked_by_name?: string;
  booked_by_email?: string;
  is_own_booking?: boolean;
  user?: User;
  co_owners?: Array<{
    id: number;
    full_name: string;
    email: string;
  }>;
}

export interface User {
  id: number;
  full_name: string;
  email: string;
  payment_status: "pending" | "partial" | "fully_paid";
  payment_date: string | null;
  mobile_number: string;
  passport_number?: string;
  remarks?: string;
  units?: Unit[];
  attachments?: UserAttachment[];
  bookings?: Booking[];
  handover_ready?: boolean;
  has_mortgage?: boolean;
  handover_email_sent?: boolean;
  handover_email_sent_at?: string;
}

interface UserResponse {
  message: string;
  data: User;
}

interface BookingSlot {
  date: string;
  slots: string[];
}

/**
 * Login user with email and password
 */
export async function loginUser(
  email: string,
  password: string
): Promise<{ user: User; token: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        password,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Login failed");
    }

    const data: LoginResponse = await response.json();
    return {
      user: {
        id: data.user.id,
        full_name: data.user.full_name,
        email: data.user.email,
        payment_status: data.user.payment_status as "pending" | "partial" | "fully_paid",
        payment_date: data.user.payment_date,
        mobile_number: data.user.mobile_number,
        units: data.user.units || [],
      },
      token: data.token,
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Get current user profile
 */
export async function getCurrentUser(token: string): Promise<User> {
  try {
    const response = await fetch(`${API_BASE_URL}/me`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch user");
    }

    const data: UserResponse = await response.json();
    return {
      id: data.data.id,
      full_name: data.data.full_name,
      email: data.data.email,
      payment_status: data.data.payment_status as "pending" | "partial" | "fully_paid",
      payment_date: data.data.payment_date,
      mobile_number: data.data.mobile_number,
      units: data.data.units || [],
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Get user profile with bookings
 */
export async function getUserProfile(token: string): Promise<User> {
  try {
    const response = await fetch(`${API_BASE_URL}/profile`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch user profile");
    }

    const data = await response.json();
    return data.user;
  } catch (error) {
    throw error;
  }
}

/**
 * Logout user
 */
export async function logoutUser(token: string): Promise<void> {
  try {
    await fetch(`${API_BASE_URL}/auth/logout`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("Logout error:", error);
  }
}

/**
 * Get available booking slots for a specific date
 */
export async function getAvailableSlots(
  date: string,
  token: string
): Promise<string[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/bookings/available-slots?date=${date}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch available slots");
    }

    const data = await response.json();
    return data.data.available_slots || [];
  } catch (error) {
    throw error;
  }
}

/**
 * Create a new booking
 */
export async function createBooking(
  bookingData: {
    booked_date: string;
    booked_time: string;
  },
  token: string
): Promise<any> {
  try {
    const response = await fetch(`${API_BASE_URL}/bookings`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(bookingData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to create booking");
    }

    const data = await response.json();
    return data.data;
  } catch (error) {
    throw error;
  }
}

/**
 * Get user's bookings
 */
export async function getUserBookings(token: string): Promise<any[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/bookings/user`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch bookings");
    }

    const data = await response.json();
    return data.data || [];
  } catch (error) {
    throw error;
  }
}

/**
 * Get a specific booking by ID with full details
 */
export async function getBooking(bookingId: number, token: string): Promise<any> {
  try {
    const response = await fetch(`${API_BASE_URL}/bookings/${bookingId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch booking");
    }

    const data = await response.json();
    return data.booking || data.data;
  } catch (error) {
    throw error;
  }
}

/**
 * Save declaration signatures incrementally
 */
export async function saveDeclarationSignatures(
  bookingId: number,
  part: number,
  signatures: any[],
  token: string
): Promise<any> {
  try {
    const response = await fetch(`${API_BASE_URL}/bookings/${bookingId}/save-declaration-signatures`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ part, signatures }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to save signatures");
    }

    return await response.json();
  } catch (error) {
    throw error;
  }
}

/**
 * Generate declaration PDF for a booking
 */
export async function generateDeclarationPDF(
  bookingId: number, 
  token: string,
  signatureName?: string,
  signatureImage?: string,
  signaturesData?: any
): Promise<Blob> {
  try {
    const response = await fetch(`${API_BASE_URL}/bookings/${bookingId}/generate-declaration`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        signature_name: signatureName,
        signature_image: signatureImage,
        signatures_data: signaturesData
      })
    });

    if (!response.ok) {
      throw new Error("Failed to generate declaration PDF");
    }

    const data = await response.json();
    
    // Convert base64 to Blob
    const binaryString = atob(data.pdf_content);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    return new Blob([bytes], { type: "application/pdf" });
  } catch (error) {
    throw error;
  }
}

/**
 * Generate handover checklist PDF
 */
export async function generateHandoverChecklistPDF(
  bookingId: number,
  token: string,
  formData: any
): Promise<Blob> {
  try {
    const response = await fetch(`${API_BASE_URL}/bookings/${bookingId}/generate-handover-checklist`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(formData)
    });

    if (!response.ok) {
      throw new Error("Failed to generate handover checklist PDF");
    }

    const data = await response.json();
    
    // Convert base64 to Blob
    const binaryString = atob(data.pdf_content);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    return new Blob([bytes], { type: "application/pdf" });
  } catch (error) {
    throw error;
  }
}

/**
 * Cancel a booking
 */
export async function cancelBooking(bookingId: number, token: string): Promise<void> {
  try {
    const response = await fetch(`${API_BASE_URL}/bookings/${bookingId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error("Failed to cancel booking");
    }
  } catch (error) {
    throw error;
  }
}

/**
 * Update a booking
 */
export async function updateBooking(
  bookingId: number, 
  bookingData: { booked_date: string; booked_time: string }, 
  token: string
): Promise<any> {
  try {
    const response = await fetch(`${API_BASE_URL}/bookings/${bookingId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(bookingData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to update booking");
    }

    return await response.json();
  } catch (error) {
    throw error;
  }
}

/**
 * Get template PDFs for a booking's project
 */
export async function getProjectTemplates(
  bookingId: number,
  token: string
): Promise<{ handover_checklist_template: string | null; declaration_template: string | null }> {
  try {
    const response = await fetch(`${API_BASE_URL}/bookings/${bookingId}/templates`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch project templates");
    }

    return await response.json();
  } catch (error) {
    throw error;
  }
}

/**
 * Complete a handover appointment with annotated PDFs and photo
 */
/**
 * Upload individual handover file
 */
export async function uploadHandoverFile(
  bookingId: number,
  fileType: 'handover_checklist' | 'handover_declaration' | 'handover_photo' | 'client_signature',
  file: File,
  token: string
): Promise<any> {
  try {
    const formData = new FormData();
    formData.append('file_type', fileType);
    formData.append('file', file);

    const response = await fetch(`${API_BASE_URL}/bookings/${bookingId}/upload-handover-file`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to upload file");
    }

    return await response.json();
  } catch (error) {
    throw error;
  }
}

/**
 * Delete individual handover file
 */
export async function deleteHandoverFile(
  bookingId: number,
  fileType: 'handover_checklist' | 'handover_declaration' | 'handover_photo' | 'client_signature',
  token: string
): Promise<any> {
  try {
    const response = await fetch(`${API_BASE_URL}/bookings/${bookingId}/delete-handover-file`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ file_type: fileType }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to delete file");
    }

    return await response.json();
  } catch (error) {
    throw error;
  }
}

/**
 * Complete handover (mark as completed)
 */
export async function completeHandover(
  bookingId: number,
  token: string
): Promise<any> {
  try {
    const response = await fetch(`${API_BASE_URL}/bookings/${bookingId}/complete-handover`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to complete handover");
    }

    return await response.json();
  } catch (error) {
    throw error;
  }
}

/**
 * Get snagging defects for a booking
 */
export async function getSnaggingDefects(
  bookingId: number,
  token: string
): Promise<any[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/bookings/${bookingId}/snagging-defects`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to fetch snagging defects");
    }

    const data = await response.json();
    return data.defects || [];
  } catch (error) {
    throw error;
  }
}

/**
 * Create a snagging defect
 */
export async function createSnaggingDefect(
  bookingId: number,
  imageFile: File | null,
  description: string,
  location: string,
  agreedRemediationAction: string,
  token: string
): Promise<any> {
  try {
    const formData = new FormData();
    if (imageFile) {
      formData.append("image", imageFile);
    }
    formData.append("description", description);
    formData.append("location", location);
    formData.append("agreed_remediation_action", agreedRemediationAction);

    const response = await fetch(`${API_BASE_URL}/bookings/${bookingId}/snagging-defects`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to create snagging defect");
    }

    return await response.json();
  } catch (error) {
    throw error;
  }
}

/**
 * Update a snagging defect
 */
export async function updateSnaggingDefect(
  bookingId: number,
  defectId: number,
  description: string,
  location: string,
  agreedRemediationAction: string,
  token: string,
  isRemediated?: boolean
): Promise<any> {
  try {
    const body: any = { description, location, agreed_remediation_action: agreedRemediationAction };
    if (isRemediated !== undefined) {
      body.is_remediated = isRemediated;
    }

    const response = await fetch(`${API_BASE_URL}/bookings/${bookingId}/snagging-defects/${defectId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to update snagging defect");
    }

    return await response.json();
  } catch (error) {
    throw error;
  }
}

/**
 * Delete a snagging defect
 */
export async function deleteSnaggingDefect(
  bookingId: number,
  defectId: number,
  token: string
): Promise<any> {
  try {
    const response = await fetch(`${API_BASE_URL}/bookings/${bookingId}/snagging-defects/${defectId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to delete snagging defect");
    }

    return await response.json();
  } catch (error) {
    throw error;
  }
}

/**
 * Admin: Get all users with filters
 */
export async function getAllUsers(
  token: string, 
  filters?: {
    search?: string;
    payment_status?: string;
    project?: string;
  }
): Promise<User[]> {
  try {
    const params = new URLSearchParams();
    if (filters?.search) params.append('search', filters.search);
    if (filters?.payment_status) params.append('payment_status', filters.payment_status);
    if (filters?.project) params.append('project', filters.project);

    const url = `${API_BASE_URL}/users/all${params.toString() ? '?' + params.toString() : ''}`;
    
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error("Unauthorized");
    }

    const data = await response.json();
    return data.users || [];
  } catch (error) {
    throw error;
  }
}

/**
 * Admin: Get all bookings with filters
 */
export async function getAllBookings(
  token: string,
  filters?: {
    search?: string;
    status?: string;
    project?: string;
  }
): Promise<any[]> {
  try {
    const params = new URLSearchParams();
    if (filters?.search) params.append('search', filters.search);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.project) params.append('project', filters.project);

    const url = `${API_BASE_URL}/bookings${params.toString() ? '?' + params.toString() : ''}`;
    
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error("Unauthorized");
    }

    const data = await response.json();
    return data.bookings || [];
  } catch (error) {
    throw error;
  }
}

/**
 * Admin: Update user payment status
 */
export async function updateUserPaymentStatus(
  userId: number,
  paymentStatus: string,
  token: string
): Promise<void> {
  try {
    const response = await fetch(`${API_BASE_URL}/users/${userId}/payment-status`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        payment_status: paymentStatus,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to update payment status");
    }
  } catch (error) {
    throw error;
  }
}

/**
 * Admin: Get user by ID with full details
 */
export async function getUserById(userId: number, token: string): Promise<User> {
  try {
    const response = await fetch(`${API_BASE_URL}/users/${userId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch user");
    }

    const data = await response.json();
    return data.user || data.data;
  } catch (error) {
    throw error;
  }
}

/**
 * Update user payment status
 */
export async function updatePaymentStatus(
  userId: number,
  paymentStatus: string,
  token: string,
  receiptFile?: File
): Promise<User> {
  try {
    const formData = new FormData();
    formData.append("payment_status", paymentStatus);
    
    if (receiptFile) {
      formData.append("receipt", receiptFile);
    }

    const response = await fetch(`${API_BASE_URL}/users/${userId}/payment-status`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Failed to update payment status");
    }

    const data = await response.json();
    return data.user;
  } catch (error) {
    throw error;
  }
}

/**
 * Check API connection
 */
export async function checkApiHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/health`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });
    return response.ok;
  } catch (error) {
    return false;
  }
}

/**
 * Send SOA email to users
 */
export async function sendSOAEmail(
  recipientIds: number[],
  subject: string,
  message: string,
  token: string
): Promise<{ sent_count: number; failed_count: number; message: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}/email/send-soa`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        recipient_ids: recipientIds,
        subject,
        message,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to send email");
    }

    return await response.json();
  } catch (error) {
    throw error;
  }
}

export async function addUserRemark(
  userId: number,
  remark: string,
  token: string
): Promise<{ message: string; remarks: Array<{ date: string; time: string; event: string; type: string }> }> {
  try {
    const response = await fetch(`${API_BASE_URL}/users/${userId}/remarks`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ remark }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to add remark");
    }

    return await response.json();
  } catch (error) {
    throw error;
  }
}

export interface HandoverRequirement {
  type: string;
  label: string;
  uploaded: boolean;
  required: boolean;
}

export interface HandoverStatus {
  handover_ready: boolean;
  has_mortgage: boolean;
  requirements: HandoverRequirement[];
}

export async function getHandoverStatus(
  userId: number,
  token: string
): Promise<HandoverStatus> {
  try {
    const response = await fetch(`${API_BASE_URL}/users/${userId}/handover-status`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to get handover status");
    }

    const data = await response.json();
    
    // Ensure requirements is an array
    if (!Array.isArray(data.requirements)) {
      data.requirements = [];
    }
    
    return data;
  } catch (error) {
    throw error;
  }
}

export async function updateMortgageStatus(
  userId: number,
  hasMortgage: boolean,
  token: string
): Promise<{ message: string; user: User }> {
  try {
    const response = await fetch(`${API_BASE_URL}/users/${userId}/mortgage-status`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ has_mortgage: hasMortgage }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to update mortgage status");
    }

    return await response.json();
  } catch (error) {
    throw error;
  }
}

export async function sendBookingLink(
  userId: number,
  token: string
): Promise<{ message: string; recipients: number }> {
  try {
    const response = await fetch(`${API_BASE_URL}/users/${userId}/send-booking-link`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to send booking link");
    }

    return await response.json();
  } catch (error) {
    throw error;
  }
}

// ===== UNIT MANAGEMENT =====

export interface CreateUnitRequest {
  property_id: number;
  unit: string;
  floor?: string;
  building?: string;
  square_footage?: number;
  dewa_premise_number?: string;
}

export interface CreateUnitResponse {
  success: boolean;
  message: string;
  unit?: Unit;
  error?: string;
}

export async function createUnit(
  data: CreateUnitRequest,
  token: string
): Promise<CreateUnitResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/units`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });

    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.message || "Failed to create unit");
    }

    return result;
  } catch (error) {
    throw error;
  }
}

export interface BulkUploadUnitsRequest {
  property_id: number;
  file: File;
}

export interface BulkUploadResponse {
  success: boolean;
  message: string;
  results?: {
    total: number;
    created: number;
    skipped: number;
    errors: string[];
  };
  error?: string;
}

export async function bulkUploadUnits(
  data: BulkUploadUnitsRequest,
  token: string
): Promise<BulkUploadResponse> {
  try {
    const formData = new FormData();
    formData.append("property_id", data.property_id.toString());
    formData.append("file", data.file);

    const response = await fetch(`${API_BASE_URL}/units/bulk`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.message || "Failed to bulk upload units");
    }

    return result;
  } catch (error) {
    throw error;
  }
}

export async function getAllUnits(
  token: string,
  propertyId?: number,
  status?: "unclaimed" | "claimed",
  filters?: {
    search?: string;
    soa_status?: string;
    payment_status?: string;
    handover_status?: string;
    booking_status?: string;
    booking_date_from?: string;
    booking_date_to?: string;
    occupied?: string;
  }
): Promise<{ success: boolean; units: Unit[] }> {
  try {
    const params = new URLSearchParams();
    if (propertyId) params.append("property_id", propertyId.toString());
    if (status) params.append("status", status);
    if (filters?.search && filters.search.trim()) params.append("search", filters.search.trim());
    if (filters?.soa_status && filters.soa_status !== 'all') params.append("soa_status", filters.soa_status);
    if (filters?.payment_status && filters.payment_status !== 'all') params.append("payment_status", filters.payment_status);
    if (filters?.handover_status && filters.handover_status !== 'all') params.append("handover_status", filters.handover_status);
    if (filters?.booking_status && filters.booking_status !== 'all') params.append("booking_status", filters.booking_status);
    if (filters?.booking_date_from) params.append("booking_date_from", filters.booking_date_from);
    if (filters?.booking_date_to) params.append("booking_date_to", filters.booking_date_to);
    if (filters?.occupied) params.append("occupied", filters.occupied);

    const url = `${API_BASE_URL}/units${params.toString() ? `?${params.toString()}` : ''}`;
    
    console.log('API URL:', url); // Debug log
    
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to fetch units");
    }

    return await response.json();
  } catch (error) {
    throw error;
  }
}

// ===== CLIENT/USER MANAGEMENT =====

export interface CreateUserWithUnitRequest {
  unit_id: number;
  full_name: string;
  email: string;
  mobile_number?: string;
  passport_number?: string;
  is_primary?: boolean;
}

export interface CreateUserResponse {
  success: boolean;
  message: string;
  user?: User;
  password?: string;
  error?: string;
}

export async function createUserWithUnit(
  data: CreateUserWithUnitRequest,
  token: string
): Promise<CreateUserResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/users/create-with-unit`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });

    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.message || "Failed to create client");
    }

    return result;
  } catch (error) {
    throw error;
  }
}

/**
 * Get unit by ID with owners and related data
 */
export async function getUnitById(unitId: number, token: string): Promise<Unit & { 
  floor?: string | null;
  building?: string | null;
  square_footage?: string | null;
  dewa_premise_number?: string | null;
}> {
  try {
    const response = await fetch(`${API_BASE_URL}/units/${unitId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch unit");
    }

    const data = await response.json();
    return data.unit || data.data;
  } catch (error) {
    throw error;
  }
}

export interface BulkUploadUsersRequest {
  property_id: number;
  file: File;
}

export async function bulkUploadUsers(
  data: BulkUploadUsersRequest,
  token: string
): Promise<BulkUploadResponse> {
  try {
    const formData = new FormData();
    formData.append("property_id", data.property_id.toString());
    formData.append("file", data.file);

    const response = await fetch(`${API_BASE_URL}/users/bulk`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.message || "Failed to bulk upload clients");
    }

    return result;
  } catch (error) {
    throw error;
  }
}

export async function downloadServiceChargeAcknowledgement(
  unitId: number,
  token: string
): Promise<Blob> {
  try {
    const response = await fetch(`${API_BASE_URL}/units/${unitId}/service-charge-acknowledgement`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to generate PDF");
    }

    return await response.blob();
  } catch (error) {
    throw error;
  }
}

export async function downloadUtilitiesGuide(
  unitId: number,
  token: string
): Promise<Blob> {
  try {
    const response = await fetch(`${API_BASE_URL}/units/${unitId}/utilities-guide`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to generate utilities guide PDF");
    }

    return await response.blob();
  } catch (error) {
    throw error;
  }
}

export async function downloadNOCHandover(
  unitId: number,
  token: string
): Promise<Blob> {
  try {
    const response = await fetch(`${API_BASE_URL}/units/${unitId}/noc-handover`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to generate NOC PDF");
    }

    return await response.blob();
  } catch (error) {
    throw error;
  }
}
