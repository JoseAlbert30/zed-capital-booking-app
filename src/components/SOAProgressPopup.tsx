"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import { CheckCircle, XCircle, FileText, Clock } from "lucide-react"
import { API_BASE_URL } from "@/config/api"

interface SOAProgressPopupProps {
  batchId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete?: () => void
}

interface BatchProgress {
  batch_id: string
  total_soas: number
  generated_count: number
  failed_count: number
  status: string
  progress_percentage: number
  started_at: string
  completed_at: string | null
}

export function SOAProgressPopup({ batchId, open, onOpenChange, onComplete }: SOAProgressPopupProps) {
  const [progress, setProgress] = useState<BatchProgress | null>(null)
  const [loading, setLoading] = useState(true)
  const [hasCalledComplete, setHasCalledComplete] = useState(false)

  useEffect(() => {
    if (!batchId || !open) {
      setProgress(null)
      setLoading(true)
      setHasCalledComplete(false)
      return
    }

    const fetchProgress = async () => {
      try {
        const token = localStorage.getItem("authToken")
        const response = await fetch(
          `${API_BASE_URL}/units/soa-batch/${batchId}/progress`,
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
          
          // Call onComplete callback when batch is completed
          if (data.batch.status === 'completed' && !hasCalledComplete && onComplete) {
            setHasCalledComplete(true)
            onComplete()
          }
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
  }, [batchId, open, progress?.status, hasCalledComplete, onComplete])

  if (!open || !batchId) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            Generating SOA Documents
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
                  <div className="text-2xl font-bold text-gray-900">{progress.total_soas}</div>
                  <div className="text-xs text-gray-500 mt-1">Total</div>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600 flex items-center justify-center gap-1">
                    {progress.generated_count}
                    <CheckCircle className="w-4 h-4" />
                  </div>
                  <div className="text-xs text-green-600 mt-1">Generated</div>
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
                    <p className="text-lg font-semibold text-green-600">All SOAs Generated!</p>
                    <p className="text-sm text-gray-500">
                      Successfully generated {progress.generated_count} of {progress.total_soas} SOA documents
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
                      <p className="text-sm text-gray-600">Generating SOAs...</p>
                    </div>
                    <p className="text-xs text-gray-500">
                      {progress.generated_count + progress.failed_count} of {progress.total_soas} processed
                    </p>
                  </div>
                )}
              </div>

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
