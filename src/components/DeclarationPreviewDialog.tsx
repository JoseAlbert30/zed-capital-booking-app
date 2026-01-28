"use client";

import React, { useState, useRef, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { generateDeclarationPDF, saveDeclarationSignatures } from "@/lib/api";

interface SignatureData {
    type: "primary" | "secondary" | "poa";
    name: string;
    image: string | null;
    ownerName: string; // Name of the owner signing
}

interface DeclarationPreviewDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    booking: any;
    defects?: any[];
    onGenerated?: (pdfBlob: Blob, filename: string) => void;
}

export function DeclarationPreviewDialog({
    open,
    onOpenChange,
    booking,
    defects = [],
    onGenerated,
}: DeclarationPreviewDialogProps) {
    const [generatingPDF, setGeneratingPDF] = useState(false);
    const [savingSignatures, setSavingSignatures] = useState(false);

    // Multiple signatures for each part (one per potential signer)
    const [part1Signatures, setPart1Signatures] = useState<Record<string, SignatureData>>({});
    const [part2Signatures, setPart2Signatures] = useState<Record<string, SignatureData>>({});

    // Track which parts have been signed
    const [part1Signed, setPart1Signed] = useState(false);
    const [part2Signed, setPart2Signed] = useState(false);

    // Drawing state for each owner
    const [drawingStates, setDrawingStates] = useState<Record<string, boolean>>({});
    const canvasRefs = useRef<Record<string, HTMLCanvasElement | null>>({});

    // Get all potential signers (primary owner + co-owners)
    const allOwners = React.useMemo(() => {
        const owners = [];

        // Add the primary booking user first
        if (booking?.user) {
            owners.push({
                id: booking.user.id,
                name: booking.user.full_name,
                isPrimary: true
            });
        }

        // Add all co-owners from unit.users (excluding the primary booking user)
        if (booking?.unit?.users && Array.isArray(booking.unit.users)) {
            booking.unit.users.forEach((unitUser: any) => {
                // Skip if this is the same as the booking user (already added as primary)
                if (unitUser.id !== booking.user?.id) {
                    owners.push({
                        id: unitUser.id,
                        name: unitUser.full_name || unitUser.name,
                        isPrimary: false
                    });
                }
            });
        }

        return owners;
    }, [booking]);

    // Initialize signature data for all owners
    useEffect(() => {
        const initSignatures: Record<string, SignatureData> = {};
        allOwners.forEach(owner => {
            initSignatures[owner.id] = {
                type: owner.isPrimary ? "primary" : "secondary",
                name: owner.name, // Autofill name for owners/co-owners
                image: null,
                ownerName: owner.name
            };
        });

        // Load existing signatures from booking
        if (booking?.declaration_part1_signatures && Array.isArray(booking.declaration_part1_signatures)) {
            const savedPart1: Record<string, SignatureData> = { ...initSignatures };
            booking.declaration_part1_signatures.forEach((sig: SignatureData) => {
                const owner = allOwners.find(o => o.name === sig.ownerName);
                if (owner) {
                    savedPart1[owner.id] = sig;
                }
            });
            setPart1Signatures(savedPart1);
            setPart1Signed(true);
        } else {
            setPart1Signatures(initSignatures);
            setPart1Signed(false);
        }

        if (booking?.declaration_part2_signatures && Array.isArray(booking.declaration_part2_signatures)) {
            const savedPart2: Record<string, SignatureData> = { ...initSignatures };
            booking.declaration_part2_signatures.forEach((sig: SignatureData) => {
                const owner = allOwners.find(o => o.name === sig.ownerName);
                if (owner) {
                    savedPart2[owner.id] = sig;
                }
            });
            setPart2Signatures(savedPart2);
            setPart2Signed(true);
        } else {
            setPart2Signatures(initSignatures);
            setPart2Signed(false);
        }
    }, [allOwners, booking]);

    // Check if all defects are remediated
    const allDefectsRemediated = React.useMemo(() => {
        if (!defects || defects.length === 0) return true;
        return defects.every((defect: any) => defect.is_remediated === true);
    }, [defects]);

    const saveSignaturesToBackend = async (part: number, signatures: Record<string, SignatureData>) => {
        const validSignatures = Object.values(signatures).filter(
            sig => sig.name.trim() && sig.image
        );

        if (validSignatures.length === 0) return;

        try {
            setSavingSignatures(true);
            const token = localStorage.getItem("authToken") || "";
            await saveDeclarationSignatures(booking.id, part, validSignatures, token);

            // Update signed status
            if (part === 1) setPart1Signed(true);
            if (part === 2) setPart2Signed(true);

            toast.success(`Part ${part} signatures saved!`);
        } catch (error) {
            console.error(`Failed to save Part ${part} signatures:`, error);
            toast.error(`Failed to save signatures`);
        } finally {
            setSavingSignatures(false);
        }
    };

    const handleGenerateDeclaration = async () => {
        // Validate Part 1 signatures - all owners required OR POA for missing owners
        const part1ValidSignatures = Object.values(part1Signatures).filter(
            sig => sig.name.trim() && sig.image
        );
        
        // Check if all owners have signed or have POA representation
        const totalOwners = allOwners.length;
        const ownerSignatures = part1ValidSignatures.filter(sig => sig.type !== 'poa');
        const poaSignatures = part1ValidSignatures.filter(sig => sig.type === 'poa');
        
        if (ownerSignatures.length < totalOwners && poaSignatures.length === 0) {
            toast.error(`All ${totalOwners} owner(s) must sign OR provide POA authorization for missing signatures`);
            return;
        }
        
        if (part1ValidSignatures.length === 0) {
            toast.error("At least one signature is required for Part 1 (Declaration)");
            return;
        }

        // Validate Part 2 signatures (only if defects exist) - all owners required OR POA for missing owners
        if (defects && defects.length > 0) {
            const part2ValidSignatures = Object.values(part2Signatures).filter(
                sig => sig.name.trim() && sig.image
            );
            
            const part2OwnerSignatures = part2ValidSignatures.filter(sig => sig.type !== 'poa');
            const part2PoaSignatures = part2ValidSignatures.filter(sig => sig.type === 'poa');
            
            if (part2OwnerSignatures.length < totalOwners && part2PoaSignatures.length === 0) {
                toast.error(`All ${totalOwners} owner(s) must sign Part 2 OR provide POA authorization for missing signatures`);
                return;
            }
            
            if (part2ValidSignatures.length === 0) {
                toast.error("At least one signature is required for Part 2 (Defects acknowledgement)");
                return;
            }
        }

        try {
            setGeneratingPDF(true);

            const token = localStorage.getItem("authToken") || "";

            // Filter and send only valid signatures
            const signaturesData = {
                part1: part1ValidSignatures,
                part2: defects && defects.length > 0 ? Object.values(part2Signatures).filter(
                    sig => sig.name.trim() && sig.image
                ) : null
            };

            const pdfBlob = await generateDeclarationPDF(
                booking.id,
                token,
                part1ValidSignatures[0].name, // First signature for backwards compatibility
                part1ValidSignatures[0].image || undefined, // First signature for backwards compatibility
                signaturesData
            );

            const filename = `Declaration_${booking.id}_${new Date()
                .toISOString()
                .split("T")[0]}.pdf`;

            if (onGenerated) {
                onGenerated(pdfBlob, filename);
            }

            toast.success("Declaration generated successfully");
            onOpenChange(false);
        } catch (error) {
            console.error("Error generating declaration:", error);
            toast.error("Failed to generate declaration");
        } finally {
            setGeneratingPDF(false);
        }
    };

    // Helper function to render signature section for multiple owners
    const renderMultiOwnerSignatureSection = (
        title: string,
        partNumber: number,
        signatures: Record<string, SignatureData>,
        setSignatures: React.Dispatch<React.SetStateAction<Record<string, SignatureData>>>,
        alreadySigned: boolean
    ) => {
        const validSignatures = Object.values(signatures).filter(sig => sig.name.trim() && sig.image);

        return (
            <div className="mt-8 pt-6 border-t-2 border-gray-300">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-base">{title}</h3>
                    {alreadySigned && (
                        <span className="px-3 py-1 bg-green-100 text-green-800 text-sm font-medium rounded-full flex items-center gap-2">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            Already Signed
                        </span>
                    )}
                </div>

                {alreadySigned && validSignatures.length > 0 ? (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                        <p className="text-sm text-green-800 mb-3 font-medium">
                            This section has been signed by {validSignatures.length} {validSignatures.length === 1 ? 'owner' : 'owners'}
                        </p>
                        <div className="space-y-3">
                            {validSignatures.map((sig, idx) => (
                                <div key={idx} className="bg-white rounded p-3 border border-green-300">
                                    <p className="text-xs text-gray-600 mb-1">
                                        {sig.type === 'primary' ? 'Primary Purchaser' : sig.type === 'secondary' ? 'Joint Purchaser' : 'POA'}: {sig.ownerName}
                                    </p>
                                    <p className="text-sm font-medium text-gray-900 mb-2">{sig.name}</p>
                                    {sig.image && (
                                        <img src={sig.image} alt="Signature" className="h-16 object-contain border-t pt-2" />
                                    )}
                                </div>
                            ))}
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            className="w-full mt-3"
                            onClick={() => {
                                if (partNumber === 1) setPart1Signed(false);
                                if (partNumber === 2) setPart2Signed(false);
                            }}
                        >
                            Re-sign this section
                        </Button>
                    </div>
                ) : (
                    <>
                        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded mb-4">
                            <p className="text-sm text-gray-800 font-medium mb-2">
                                📝 Signature Requirements:
                            </p>
                            <p className="text-xs text-gray-700 leading-relaxed">
                                <strong>All {allOwners.length} owner(s) must sign</strong> this section. If any owner cannot sign in person, a Power of Attorney (POA) signature is required on their behalf.
                            </p>
                        </div>

                        {allOwners.map((owner, index) => {
                            const ownerId = owner.id.toString();
                            const canvasId = `canvas-part${partNumber}-owner${ownerId}`;

                            return (
                                <div key={ownerId} className={`mb-8 pb-6 ${index < allOwners.length - 1 ? 'border-b border-gray-200' : ''}`}>
                                    <h4 className="font-medium text-sm mb-4 text-gray-700">
                                        {owner.isPrimary ? '👤 Primary Owner' : '👥 Co-Owner'}: {owner.name}
                                    </h4>

                                    {/* Signatory Type Selection */}
                                    <div className="mb-4">
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Signing as
                                        </label>
                                        <div className="flex gap-3">
                                            <label className="flex items-center cursor-pointer">
                                                <input
                                                    type="radio"
                                                    checked={signatures[ownerId]?.type === "primary"}
                                                    onChange={() => {
                                                        setSignatures(prev => ({
                                                            ...prev,
                                                            [ownerId]: { ...prev[ownerId], type: "primary" }
                                                        }));
                                                    }}
                                                    className="mr-2"
                                                />
                                                <span className="text-sm">Primary Purchaser</span>
                                            </label>
                                            <label className="flex items-center cursor-pointer">
                                                <input
                                                    type="radio"
                                                    checked={signatures[ownerId]?.type === "secondary"}
                                                    onChange={() => {
                                                        setSignatures(prev => ({
                                                            ...prev,
                                                            [ownerId]: { ...prev[ownerId], type: "secondary" }
                                                        }));
                                                    }}
                                                    className="mr-2"
                                                />
                                                <span className="text-sm">Joint Purchaser</span>
                                            </label>
                                            <label className="flex items-center cursor-pointer">
                                                <input
                                                    type="radio"
                                                    checked={signatures[ownerId]?.type === "poa"}
                                                    onChange={() => {
                                                        setSignatures(prev => ({
                                                            ...prev,
                                                            [ownerId]: { ...prev[ownerId], type: "poa" }
                                                        }));
                                                    }}
                                                    className="mr-2"
                                                />
                                                <span className="text-sm">POA</span>
                                            </label>
                                        </div>
                                    </div>

                                    {/* Full Name Input */}
                                    <div className="mb-4">
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Full Name
                                        </label>
                                        <input
                                            type="text"
                                            value={signatures[ownerId]?.name || ""}
                                            onChange={(e) => {
                                                setSignatures(prev => ({
                                                    ...prev,
                                                    [ownerId]: { ...prev[ownerId], name: e.target.value }
                                                }));
                                            }}
                                            placeholder="Type your full name here"
                                            className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                    </div>

                                    {/* Signature Canvas */}
                                    <div className="mb-4">
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Draw Signature
                                        </label>
                                        <div
                                            className="border-2 border-dashed border-gray-300 rounded-lg p-4 bg-gray-50"
                                            style={{
                                                userSelect: 'none',
                                                WebkitUserSelect: 'none',
                                                WebkitTouchCallout: 'none'
                                            }}
                                        >
                                            <canvas
                                                ref={(el) => { canvasRefs.current[canvasId] = el; }}
                                                width={600}
                                                height={200}
                                                className="w-full border border-gray-300 rounded bg-white touch-none"
                                                style={{
                                                    touchAction: 'none',
                                                    userSelect: 'none',
                                                    WebkitUserSelect: 'none',
                                                    WebkitTouchCallout: 'none',
                                                    MozUserSelect: 'none',
                                                    msUserSelect: 'none'
                                                }}
                                                onMouseDown={(e) => {
                                                    setDrawingStates(prev => ({ ...prev, [canvasId]: true }));
                                                    const canvas = canvasRefs.current[canvasId];
                                                    if (!canvas) return;
                                                    const ctx = canvas.getContext('2d', { willReadFrequently: true });
                                                    if (!ctx) return;
                                                    ctx.strokeStyle = '#000';
                                                    ctx.lineWidth = 2;
                                                    ctx.lineCap = 'round';
                                                    ctx.lineJoin = 'round';
                                                    const rect = canvas.getBoundingClientRect();
                                                    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
                                                    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
                                                    ctx.beginPath();
                                                    ctx.moveTo(x, y);
                                                }}
                                                onMouseMove={(e) => {
                                                    if (!drawingStates[canvasId]) return;
                                                    const canvas = canvasRefs.current[canvasId];
                                                    if (!canvas) return;
                                                    const ctx = canvas.getContext('2d', { willReadFrequently: true });
                                                    if (!ctx) return;
                                                    const rect = canvas.getBoundingClientRect();
                                                    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
                                                    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
                                                    ctx.lineTo(x, y);
                                                    ctx.stroke();
                                                }}
                                                onMouseUp={() => setDrawingStates(prev => ({ ...prev, [canvasId]: false }))}
                                                onMouseLeave={() => setDrawingStates(prev => ({ ...prev, [canvasId]: false }))}
                                                onTouchStart={(e) => {
                                                    e.preventDefault();
                                                    setDrawingStates(prev => ({ ...prev, [canvasId]: true }));
                                                    const canvas = canvasRefs.current[canvasId];
                                                    if (!canvas) return;
                                                    const ctx = canvas.getContext('2d', { willReadFrequently: true });
                                                    if (!ctx) return;
                                                    ctx.strokeStyle = '#000';
                                                    ctx.lineWidth = 2;
                                                    ctx.lineCap = 'round';
                                                    ctx.lineJoin = 'round';
                                                    const rect = canvas.getBoundingClientRect();
                                                    const touch = e.touches[0];
                                                    const x = (touch.clientX - rect.left) * (canvas.width / rect.width);
                                                    const y = (touch.clientY - rect.top) * (canvas.height / rect.height);
                                                    ctx.beginPath();
                                                    ctx.moveTo(x, y);
                                                }}
                                                onTouchMove={(e) => {
                                                    e.preventDefault();
                                                    if (!drawingStates[canvasId]) return;
                                                    const canvas = canvasRefs.current[canvasId];
                                                    if (!canvas) return;
                                                    const ctx = canvas.getContext('2d', { willReadFrequently: true });
                                                    if (!ctx) return;
                                                    const rect = canvas.getBoundingClientRect();
                                                    const touch = e.touches[0];
                                                    const x = (touch.clientX - rect.left) * (canvas.width / rect.width);
                                                    const y = (touch.clientY - rect.top) * (canvas.height / rect.height);
                                                    ctx.lineTo(x, y);
                                                    ctx.stroke();
                                                }}
                                                onTouchEnd={(e) => {
                                                    e.preventDefault();
                                                    setDrawingStates(prev => ({ ...prev, [canvasId]: false }));
                                                }}
                                            />
                                        </div>
                                        <div className="flex gap-3 mt-3">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                className="flex-1"
                                                onClick={() => {
                                                    const canvas = canvasRefs.current[canvasId];
                                                    if (!canvas) return;
                                                    const ctx = canvas.getContext('2d');
                                                    if (!ctx) return;
                                                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                                                    setSignatures(prev => ({
                                                        ...prev,
                                                        [ownerId]: { ...prev[ownerId], image: null }
                                                    }));
                                                    toast.success('Signature cleared');
                                                }}
                                            >
                                                Clear
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="default"
                                                size="sm"
                                                className="flex-1"
                                                onClick={() => {
                                                    const canvas = canvasRefs.current[canvasId];
                                                    if (!canvas) return;
                                                    const dataUrl = canvas.toDataURL('image/png');
                                                    setSignatures(prev => ({
                                                        ...prev,
                                                        [ownerId]: { ...prev[ownerId], image: dataUrl }
                                                    }));
                                                    toast.success('Signature validated!');
                                                }}
                                            >
                                                Validate Signature
                                            </Button>
                                        </div>
                                        {signatures[ownerId]?.image && (
                                            <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                                                <p className="text-xs text-green-700 font-medium mb-2">✓ Signature validated</p>
                                                <div className="border rounded bg-white p-2">
                                                    <img
                                                        src={signatures[ownerId].image}
                                                        alt="Signature preview"
                                                        className="w-full h-auto max-h-24 object-contain"
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}

                        <div className="mt-6 pt-4 border-t border-gray-200">
                            <Button
                                type="button"
                                variant="default"
                                className="w-full"
                                onClick={() => saveSignaturesToBackend(partNumber, signatures)}
                                disabled={savingSignatures || Object.values(signatures).filter(sig => sig.name.trim() && sig.image).length === 0}
                            >
                                {savingSignatures ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    `Save Part ${partNumber} Signatures`
                                )}
                            </Button>
                        </div>
                    </>
                )}
            </div>
        );
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-full !max-w-5xl h-[95vh] flex flex-col p-0">
                <DialogHeader className="px-6 pt-6 pb-4 border-b flex-shrink-0">
                </DialogHeader>

                <div className="flex-1 overflow-y-auto px-6 py-4">
                <div className="space-y-6">
                    {/* Header */}
                    <div className="pb-4 border-b">
                        <h1 className="text-xl font-bold mb-1">DECLARATION OF ADHERENCE AND ACKNOWLEDGEMENT</h1>
                        <p className="text-sm text-gray-600">
                            Between the Seller and the Purchaser
                        </p>
                    </div>

                    {/* Seller Information */}
                    <div>
                        <h3 className="font-semibold text-sm mb-2 uppercase">Seller Information</h3>
                        <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                            <div>
                                <p className="text-gray-600 font-medium">Seller</p>
                                <p className="text-gray-900">Vantage Ventures Real Estate Development L.L.C.</p>
                            </div>
                            <div>
                                <p className="text-gray-600 font-medium">Project</p>
                                <p className="text-gray-900">{booking?.unit?.property?.project_name || "N/A"}</p>
                            </div>
                        </div>
                        <div className="border-b"></div>
                    </div>

                    {/* Property Details */}
                    <div>
                        <h3 className="font-semibold text-sm mb-2 uppercase">Property Details</h3>
                        <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                            <div>
                                <p className="text-gray-600 font-medium">Unit Number</p>
                                <p className="text-gray-900">{booking?.unit?.unit || "N/A"}</p>
                            </div>
                            <div>
                                <p className="text-gray-600 font-medium">Building</p>
                                <p className="text-gray-900">{booking?.unit?.building || "N/A"}</p>
                            </div>
                            <div>
                                <p className="text-gray-600 font-medium">Floor</p>
                                <p className="text-gray-900">{booking?.unit?.floor || "N/A"}</p>
                            </div>
                            <div>
                                <p className="text-gray-600 font-medium">Area</p>
                                <p className="text-gray-900">{booking?.unit?.square_footage || "N/A"} Sq.Ft.</p>
                            </div>
                        </div>
                        <div className="border-b"></div>
                    </div>

                    {/* Purchaser Information */}
                    <div>
                        <h3 className="font-semibold text-sm mb-2 uppercase">Purchaser Information</h3>
                        {allOwners && allOwners.length > 0 ? (
                            <div className="space-y-4">
                                {allOwners.map((owner, index) => {
                                    // Find the full user details from booking.unit.users
                                    const userDetails = booking?.unit?.users?.find((u: any) => u.id === owner.id) || booking?.user;

                                    return (
                                        <div key={owner.id}>
                                            <div className="flex items-center gap-2 mb-3">
                                                <span className="text-xs font-semibold px-2 py-1 rounded bg-blue-100 text-blue-800">
                                                    {owner.isPrimary ? 'Primary Purchaser' : 'Co-Purchaser'}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                                                <div>
                                                    <p className="text-gray-600 font-medium">Name</p>
                                                    <p className="text-gray-900">{userDetails?.full_name || owner.name || "N/A"}</p>
                                                </div>
                                                <div>
                                                    <p className="text-gray-600 font-medium">Email</p>
                                                    <p className="text-gray-900">{userDetails?.email || "N/A"}</p>
                                                </div>
                                                <div>
                                                    <p className="text-gray-600 font-medium">Contact Number</p>
                                                    <p className="text-gray-900">{userDetails?.mobile_number || "N/A"}</p>
                                                </div>
                                                <div>
                                                    <p className="text-gray-600 font-medium">Passport Number</p>
                                                    <p className="text-gray-900">{userDetails?.passport_number || "N/A"}</p>
                                                </div>
                                            </div>
                                            {index < allOwners.length - 1 && <div className="border-b mb-4"></div>}
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                                <div>
                                    <p className="text-gray-600 font-medium">Purchaser Name</p>
                                    <p className="text-gray-900">{booking?.user?.full_name || "N/A"}</p>
                                </div>
                                <div>
                                    <p className="text-gray-600 font-medium">Email</p>
                                    <p className="text-gray-900">{booking?.user?.email || "N/A"}</p>
                                </div>
                                <div>
                                    <p className="text-gray-600 font-medium">Contact Number</p>
                                    <p className="text-gray-900">{booking?.user?.mobile_number || "N/A"}</p>
                                </div>
                                <div>
                                    <p className="text-gray-600 font-medium">Passport Number</p>
                                    <p className="text-gray-900">{booking?.user?.passport_number || "N/A"}</p>
                                </div>
                            </div>
                        )}
                        <div className="border-b"></div>
                    </div>

                    {/* Background */}      {/* Opening Statement */}
                    <div className="pb-2">
                        <p className="text-sm text-gray-800">
                            THIS DECLARATION OF ADHERENCE AND ACKNOWLEDGEMENT is made BETWEEN the Seller and the Purchaser as described in and on the date set out in the Particulars (this Declaration).
                        </p>
                    </div>

                    <div>
                        <h3 className="font-semibold text-sm mb-3 uppercase">Background:</h3>
                        <div className="text-xs text-gray-800 space-y-2">
                            <p><strong>(A)</strong> The Parties have entered into a sale and purchase agreement (the SPA) under which the Seller agreed to sell and the Purchaser agreed to purchase the Property subject to the terms of the SPA and the Governance Documents.</p>

                            <p><strong>(B)</strong> In consideration of the Purchaser satisfying its obligations under the SPA, the Seller has handed over the Property to the Purchaser.</p>

                            <p><strong>(C)</strong> The Purchaser acknowledges handover of the Property upon the conditions set out in the SPA and this Declaration.</p>

                            <p><strong>(D)</strong> The Purchaser agrees to be bound by the terms of the Governance Documents as further set out in this Declaration.</p>
                        </div>
                        <div className="border-b mt-4"></div>
                    </div>

                    {/* Terms & Conditions */}
                    <div>
                        <h3 className="font-semibold text-sm mb-3 uppercase">Now The Purchaser Agrees And Declares As Follows:</h3>
                        <div className="text-xs text-gray-800 space-y-3">
                            <div>
                                <p className="font-semibold mb-1">DEFINITIONS AND INTERPRETATION</p>
                                <p className="mb-1">1.1 In this Declaration, except where the context otherwise requires, the capitalized words shall have the meanings defined in the SPA.</p>
                            </div>

                            <div>
                                <p className="font-semibold mb-2">ACKNOWLEDGMENT OF PROPERTY</p>
                                <p className="mb-2">1.2 The Purchaser has inspected the Property (or waived its right to inspect the Property) and unconditionally and irrevocably accepts possession of the Property in good condition ready for occupancy and constructed in accordance with the SPA and free from any and all defects and deficiencies (except as listed in the Annexure attached to this Declaration).</p>

                                <p className="mb-2">1.3 The Purchaser releases and discharges the Seller and its nominees, representatives and subsidiaries (including past, present and future successors, officers, directors, agents and employees) from all claims, damages (including general, special, punitive, liquidated and compensatory damages) and causes of action of every kind, nature and character, known or unknown, fixed or contingent, which the Purchaser may now have or the Purchaser may ever had arising from or in any way connected to the Property.</p>

                                <p className="mb-2">1.4 The foregoing acceptance, release and discharge is without prejudice to the provisions contained in the SPA regarding rectification of any defects in the Property by the Seller following Handover.</p>

                                <p className="mb-2">1.5 The Purchaser acknowledges that it is the sole responsibility of the Purchaser to subscribe (register) to and pay all relevant charges in relation to all utilities provided in the Property.</p>

                                <p className="mb-2">1.6 The Purchaser acknowledges and agrees that all utilities provisions within the Property have been provided and that it is the sole responsibility of the Purchaser that utilities within the Property are available to minimize damage due to the prevailing weather conditions in the UAE.</p>

                                <p className="mb-2">1.7 The Purchaser acknowledges that leaving the Property not air-conditioned, especially during summer months, may result in damage to the woodwork/joinery, flooring, false ceilings, wall paint and appliances. The Purchaser releases and discharges the Seller and any of its nominees or representatives or subsidiaries from all claims, damages and causes of action arising from this effect.</p>
                            </div>

                            <div>
                                <p className="font-semibold mb-1">1.8 PURCHASER'S COVENANTS AND WARRANTIES</p>
                                <p className="mb-1">The Purchaser covenants and warrants that the Purchaser shall observe, perform and comply with all the terms, conditions and obligations contained in the Governance Documents and the SPA at all times.</p>
                            </div>

                            <div>
                                <p className="font-semibold mb-1">1.9 AUTHORITY TO AMEND</p>
                                <p className="mb-1">1.9 The Purchaser agrees that the Governance Documents may be varied as per their terms or as required to comply with any applicable law or as may be required by the Land Department or RERA from time to time.</p>

                                <p className="mb-1">1.10 Once notice of any variation of the Governance Documents is served on the Purchaser such variation shall be deemed to be valid, binding and enforceable upon the Purchaser and shall form an integral part of this Declaration.</p>
                            </div>

                            <div>
                                <p className="font-semibold mb-1">1.11 AUTHORITY TO REGISTER</p>
                                <p className="mb-1">The Purchaser agrees that the Governance Documents may be Registered by the Land Department against the title to the Property or the Community or part thereof as a restriction and/or positive covenant.</p>
                            </div>

                            <div>
                                <p className="font-semibold mb-1">1.12 PURCHASER'S INDEMNITY</p>
                                <p className="mb-1">The Purchaser indemnifies the Seller against all actions, costs, claims, damages, demands, expenses, liabilities and losses suffered by the Seller in connection with the Purchaser's breach of its obligations under this Declaration, the SPA and/or the Governance Documents.</p>
                            </div>

                            <div>
                                <p className="font-semibold mb-1">1.13 ACKNOWLEDGMENT OF UNDERSTANDING</p>
                                <p className="mb-1">The Purchaser agrees that it understands the Purchaser's rights and obligations under this Declaration and the Governance Documents.</p>
                            </div>

                            <div>
                                <p className="font-semibold mb-1">1.14 AUTHORITY TO EXECUTE DOCUMENTS</p>
                                <p className="mb-1">The Purchaser warrants and represents that: (a) in the case of the Purchaser being (or including) an individual, the Purchaser has full authority, power and capacity to execute, deliver and perform this Declaration; and (b) in the case of the Purchaser being (or including) an entity other than an individual, the execution, delivery and performance of this Declaration by the Purchaser has been duly authorized in accordance with the relevant corporate or other procedures of the Purchaser, no further action on the part of the Purchaser is necessary to authorize such execution, delivery and performance and the person signing this Declaration on behalf of the Purchaser is fully authorized to enter into this Declaration on behalf of the Purchaser.</p>
                            </div>

                            <div>
                                <p className="font-semibold mb-1">1.15 FURTHER ASSURANCES</p>
                                <p className="mb-1">The Purchaser agrees to immediately sign any documents required by the Land Department and/or RERA as may be necessary to enable Registration of the Governance Documents.</p>
                            </div>

                            <div>
                                <p className="font-semibold mb-1">1.16 CONFIDENTIALITY</p>
                                <p className="mb-1">The Parties must keep the terms of this Declaration and any information provided by the Seller (and/or its Affiliates) strictly confidential.</p>
                            </div>

                            <div>
                                <p className="font-semibold mb-1">1.17 GOVERNING LAW AND JURISDICTION</p>
                                <p className="mb-1">This Declaration and the rights of the Parties set out in it shall be governed by and construed in accordance with the laws of the Emirate of Dubai and the applicable Federal Laws of the UAE. The Parties agree to submit to the exclusive jurisdiction of the Courts of the Emirate of Dubai.</p>
                            </div>
                        </div>
                    </div>

                    {/* Acknowledgement */}
                    <div className="mt-8 pt-6 border-t-2 border-gray-300">
                        <h3 className="font-semibold text-base mb-4">Acknowledgement</h3>
                        <div className="bg-gray-50 border border-gray-300 rounded-lg p-4">
                            <p className="text-sm text-gray-800 italic leading-relaxed">
                                I hereby confirm that I have read and understood the declaration of adherence and acknowledgement letter and received the keys for the above-mentioned unit.
                            </p>
                        </div>
                    </div>

                    <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded mt-4">
                        <p className="text-xs text-gray-700 leading-relaxed">
                            <strong className="text-amber-800">Legal Notice:</strong> By signing this Declaration, you acknowledge that you have read, understood, and agree to be legally bound by all the terms and conditions set forth in this document.
                        </p>
                    </div>

                    {/* Part 1: Declaration Signature */}
                    {renderMultiOwnerSignatureSection(
                        "Part 1: Declaration Signature",
                        1,
                        part1Signatures,
                        setPart1Signatures,
                        part1Signed
                    )}

                    {/* Snagging Defects */}
                    {defects && defects.length > 0 && (
                        <>
                            <div className="border-b mt-4"></div>
                            <div>
                                <h3 className="font-semibold text-sm mb-3 uppercase">Snagging Defects - Annexure</h3>
                                <div className="space-y-3 mb-4">
                                    {defects.map((defect: any, index: number) => (
                                        <div key={index} className={`text-sm border rounded p-3 ${defect.is_remediated ? 'bg-green-50 border-green-300' : 'bg-white'}`}>
                                            <div className="flex items-center justify-between mb-2">
                                                <p className="font-semibold">Defect #{index + 1}</p>
                                                {defect.is_remediated && (
                                                    <span className="px-3 py-1 bg-green-600 text-white text-xs font-medium rounded-full flex items-center gap-1">
                                                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                                        </svg>
                                                        Resolved
                                                    </span>
                                                )}
                                            </div>
                                            {defect.imagePreview && (
                                                <img
                                                    src={defect.imagePreview}
                                                    alt={`Defect ${index + 1}`}
                                                    className="w-full max-h-40 object-cover rounded mb-2"
                                                />
                                            )}
                                            <p className="text-gray-700 mb-1">
                                                <strong>Location:</strong> {defect.location}
                                            </p>
                                            <p className="text-gray-700 mb-1">
                                                <strong>Description:</strong> {defect.description}
                                            </p>
                                            {defect.agreedRemediationAction && (
                                                <p className="text-gray-700">
                                                    <strong>Agreed Remediation:</strong> {defect.agreedRemediationAction}
                                                </p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Part 2: Defects Signature */}
                            {renderMultiOwnerSignatureSection(
                                "Part 2: Defects Acknowledgement Signature",
                                2,
                                part2Signatures,
                                setPart2Signatures,
                                part2Signed
                            )}
                            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded mt-4">
                                <p className="text-xs text-gray-700 leading-relaxed">
                                    <strong className="text-blue-800">Note:</strong> This signature acknowledges your review and acceptance of the snagging defects listed above. Defects will be marked as resolved upon declaration generation.
                                </p>
                            </div>
                        </>
                    )}
                </div>
                </div>

                <DialogFooter className="flex gap-3 justify-end px-6 py-4 border-t bg-white flex-shrink-0">
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={generatingPDF}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleGenerateDeclaration}
                        disabled={generatingPDF}
                    >
                        {generatingPDF ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Generating...
                            </>
                        ) : (
                            "Generate Declaration"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
