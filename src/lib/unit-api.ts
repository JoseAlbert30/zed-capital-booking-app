/**
 * Unit-based API functions for managing units, attachments, payments, and handover process
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

export interface HandoverStatus {
  handover_ready: boolean;
  has_mortgage: boolean;
  requirements: Array<{
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

    const response = await fetch(`${API_BASE_URL}/units/${unitId}/payment-status`, {
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
    const response = await fetch(`${API_BASE_URL}/units/${unitId}/remarks`, {
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

    const response = await fetch(`${API_BASE_URL}/units/${unitId}/send-soa`, {
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
    const response = await fetch(`${API_BASE_URL}/units/${unitId}/send-handover-email`, {
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
    const response = await fetch(`${API_BASE_URL}/units/${unitId}/handover-status`, {
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
    const response = await fetch(`${API_BASE_URL}/units/${unitId}/mortgage-status`, {
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
    const response = await fetch(`${API_BASE_URL}/units/${unitId}/send-booking-link`, {
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

    const response = await fetch(`${API_BASE_URL}/units/${unitId}/upload-attachment`, {
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
    const response = await fetch(`${API_BASE_URL}/units/${unitId}/attachments/${attachmentId}`, {
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
    const response = await fetch(`${API_BASE_URL}/bookings/eligible-units`, {
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
