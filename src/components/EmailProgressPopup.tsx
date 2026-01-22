"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import { CheckCircle, XCircle, Mail, Clock } from "lucide-react"
import { API_BASE_URL } from "@/config/api"

interface EmailProgressPopupProps {
  batchId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface BatchProgress {
  batch_id: string
  total_emails: number
  sent_count: number
  failed_count: number
  status: string
  progress_percentage: number
  started_at: string
  completed_at: string | null
  failed_units?: Array<{
    id: number
    unit_number: string
    property: string
    owners: string[]
  }>
}

export function EmailProgressPopup({ batchId, open, onOpenChange }: EmailProgressPopupProps) {
  const [progress, setProgress] = useState<BatchProgress | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!batchId || !open) {
      setProgress(null)
      setLoading(true)
      return
    }

    const fetchProgress = async () => {
      try {
        const token = localStorage.getItem("authToken")
        const response = await fetch(
          `${API_BASE_URL}/units/handover-batch/${batchId}/progress`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        )

        if (!response.ok) {
          throw new Error("Failed to fetch progress")
        }

        const data = await response.json()
        if (data.success) {
          setProgress(data.batch)
          setLoading(false)
        }
      } catch (error) {
        console.error("Error fetching progress:", error)
        setLoading(false)
      }
    }

    // Initial fetch
    fetchProgress()

    // Poll for updates every 2 seconds if not completed
    const interval = setInterval(() => {
      if (progress?.status !== "completed") {
        fetchProgress()
      } else {
        clearInterval(interval)
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [batchId, open, progress?.status])

  if (!open || !batchId) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-blue-600" />
            Sending Handover Emails
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {loading ? (
            <div className="text-center py-8">
              <Clock className="w-12 h-12 animate-spin text-blue-500 mx-auto mb-4" />
              <p className="text-gray-500">Initializing...</p>
            </div>
          ) : progress ? (
            <>
              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Progress</span>
                  <span className="font-semibold">{progress.progress_percentage}%</span>
                </div>
                <Progress value={progress.progress_percentage} className="h-3" />
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-gray-900">{progress.total_emails}</div>
                  <div className="text-xs text-gray-500 mt-1">Total</div>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600 flex items-center justify-center gap-1">
                    {progress.sent_count}
                    <CheckCircle className="w-4 h-4" />
                  </div>
                  <div className="text-xs text-green-600 mt-1">Sent</div>
                </div>
                <div className="text-center p-3 bg-red-50 rounded-lg">
                  <div className="text-2xl font-bold text-red-600 flex items-center justify-center gap-1">
                    {progress.failed_count}
                    <XCircle className="w-4 h-4" />
                  </div>
                  <div className="text-xs text-red-600 mt-1">Failed</div>
                </div>
              </div>

              {/* Status */}
              <div className="text-center">
                {progress.status === "completed" ? (
                  <div className="space-y-2">
                    <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
                    <p className="text-lg font-semibold text-green-600">Batch Complete!</p>
                    <p className="text-sm text-gray-500">
                      Successfully sent {progress.sent_count} of {progress.total_emails} emails
                      {progress.failed_count > 0 && (
                        <span className="block text-red-500 mt-1">
                          {progress.failed_count} failed
                        </span>
                      )}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-center gap-2">
                      <Clock className="w-5 h-5 animate-spin text-blue-500" />
                      <p className="text-sm text-gray-600">Sending emails...</p>
                    </div>
                    <p className="text-xs text-gray-500">
                      {progress.sent_count + progress.failed_count} of {progress.total_emails} processed
                    </p>
                  </div>
                )}
              </div>

              {/* Failed Units List */}
              {progress.failed_units && progress.failed_units.length > 0 && (
                <div className="border-t pt-4">
                  <h4 className="text-sm font-semibold text-red-600 mb-3">Failed Email Submissions:</h4>
                  <div className="max-h-40 overflow-y-auto space-y-2">
                    {progress.failed_units.map((unit, index) => (
                      <div key={unit.id} className="bg-red-50 p-2 rounded text-sm">
                        <div className="font-medium text-red-900">
                          Unit {unit.unit_number} - {unit.property}
                        </div>
                        <div className="text-xs text-red-700 mt-1">
                          Owners: {unit.owners.join(', ')}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Timestamp */}
              <div className="text-xs text-gray-400 text-center pt-2 border-t">
                Started: {new Date(progress.started_at).toLocaleTimeString()}
                {progress.completed_at && (
                  <span className="ml-2">
                    · Completed: {new Date(progress.completed_at).toLocaleTimeString()}
                  </span>
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <p className="text-gray-500">Failed to load progress</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
