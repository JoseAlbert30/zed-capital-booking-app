/**
 * Unit-based API functions for managing units, attachments, payments, and handover process
 */

import { API_BASE_URL } from '@/config/api';

export interface HandoverStatus {
  handover_ready: boolean;
  buyer_ready: boolean;
  developer_ready: boolean;
  has_mortgage: boolean;
  buyer_requirements: Array<{
    type: string;
    label: string;
    required: boolean;
    uploaded: boolean;
  }>;
  developer_requirements: Array<{
    type: string;
    label: string;
    required: boolean;
    uploaded: boolean;
  }>;
  // Legacy support
  requirements?: Array<{
    type: string;
    label: string;
    required: boolean;
    uploaded: boolean;
  }>;
}

/**
 * Update unit payment status
 */
export async function updateUnitPaymentStatus(
  unitId: number,
  paymentStatus: string,
  token: string,
  receiptFile?: File
): Promise<any> {
  try {
    const formData = new FormData();
    formData.append("payment_status", paymentStatus);
    
    if (receiptFile) {
      formData.append("receipt", receiptFile);
    }

    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/units/${unitId}/payment-status`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error("Failed to update payment status");
    }

    return await response.json();
  } catch (error) {
    throw error;
  }
}

/**
 * Add remark to unit
 */
export async function addUnitRemark(
  unitId: number,
  remark: string,
  token: string
): Promise<any> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/units/${unitId}/remarks`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ remark }),
    });

    if (!response.ok) {
      throw new Error("Failed to add remark");
    }

    return await response.json();
  } catch (error) {
    throw error;
  }
}

/**
 * Send SOA email for unit
 */
export async function sendUnitSOAEmail(
  unitId: number,
  soaFile: File,
  token: string
): Promise<any> {
  try {
    const formData = new FormData();
    formData.append("soa", soaFile);

    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/units/${unitId}/send-soa`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error("Failed to send SOA email");
    }

    return await response.json();
  } catch (error) {
    throw error;
  }
}

/**
 * Send handover initialization email to all unit owners
 */
export async function sendUnitHandoverEmail(
  unitId: number,
  token: string
): Promise<any> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/units/${unitId}/send-handover-email`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error("Failed to send handover email");
    }

    return await response.json();
  } catch (error) {
    throw error;
  }
}

/**
 * Get handover status for unit
 */
export async function getUnitHandoverStatus(
  unitId: number,
  token: string
): Promise<HandoverStatus> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/units/${unitId}/handover-status`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch handover status");
    }

    return await response.json();
  } catch (error) {
    throw error;
  }
}

/**
 * Update unit mortgage status
 */
export async function updateUnitMortgageStatus(
  unitId: number,
  hasMortgage: boolean,
  token: string
): Promise<any> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/units/${unitId}/mortgage-status`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ has_mortgage: hasMortgage }),
    });

    if (!response.ok) {
      throw new Error("Failed to update mortgage status");
    }

    return await response.json();
  } catch (error) {
    throw error;
  }
}

/**
 * Send booking link for unit
 */
export async function sendUnitBookingLink(
  unitId: number,
  token: string
): Promise<any> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/units/${unitId}/send-booking-link`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error("Failed to send booking link");
    }

    return await response.json();
  } catch (error) {
    throw error;
  }
}

/**
 * Upload attachment for unit
 */
export async function uploadUnitAttachment(
  unitId: number,
  file: File,
  type: string,
  token: string
): Promise<any> {
  try {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", type);

    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/units/${unitId}/upload-attachment`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error("Failed to upload attachment");
    }

    return await response.json();
  } catch (error) {
    throw error;
  }
}

/**
 * Delete unit attachment
 */
export async function deleteUnitAttachment(
  unitId: number,
  attachmentId: number,
  token: string
): Promise<any> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/units/${unitId}/attachments/${attachmentId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to delete attachment");
    }

    return await response.json();
  } catch (error) {
    throw error;
  }
}

/**
 * Get eligible units for booking (fully paid + handover ready)
 */
export async function getEligibleUnits(token: string): Promise<any> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/bookings/eligible-units`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch eligible units");
    }

    return await response.json();
  } catch (error) {
    throw error;
  }
}

/**
 * Get preview of developer requirements email
 */
export async function previewDeveloperRequirements(
  unitId: number,
  token: string
): Promise<any> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/units/${unitId}/developer-requirements-preview`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to load preview");
    }

    return await response.json();
  } catch (error) {
    throw error;
  }
}

/**
 * Send buyer requirements to developer for approval
 */
export async function sendRequirementsToDeveloper(
  unitId: number,
  token: string
): Promise<any> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/units/${unitId}/send-to-developer`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to send requirements to developer");
    }

    return await response.json();
  } catch (error) {
    throw error;
  }
}

/**
 * Validate and update handover requirements status
 */
export async function validateHandoverRequirements(
  unitId: number,
  token: string
): Promise<any> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/units/${unitId}/validate-handover-requirements`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to validate handover requirements");
    }

    return await response.json();
  } catch (error) {
    throw error;
  }
}

/**
 * Download Utilities Registration Guide PDF
 */
export async function downloadUtilitiesGuide(
  unitId: number,
  token: string
): Promise<void> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/units/${unitId}/utilities-guide`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error("Failed to download utilities guide");
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Utilities_Registration_Guide_Unit_${unitId}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    throw error;
  }
}
