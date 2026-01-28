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
import { Loader2, Eye } from "lucide-react";
import { toast } from "sonner";
import { generateHandoverChecklistPDF } from "@/lib/api";

interface SignatureData {
    name: string;
    image: string | null;
}

interface HandoverChecklistPreviewDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    booking: any;
    onGenerated?: (pdfBlob: Blob, filename: string) => void;
}

export function HandoverChecklistPreviewDialog({
    open,
    onOpenChange,
    booking,
    onGenerated,
}: HandoverChecklistPreviewDialogProps) {
    const [generatingPDF, setGeneratingPDF] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [showPreview, setShowPreview] = useState(false);
    
    // Document verification checkboxes
    const [originalSPA, setOriginalSPA] = useState(false);
    const [powerOfAttorney, setPowerOfAttorney] = useState(false);
    const [bankNOC, setBankNOC] = useState(false);
    const [letterOfDischarge, setLetterOfDischarge] = useState(false);
    const [tradeLicense, setTradeLicense] = useState(false);
    const [articles, setArticles] = useState(false);
    const [registeredShareholders, setRegisteredShareholders] = useState(false);
    
    // Registration checkboxes
    const [dewaRegistration, setDewaRegistration] = useState(false);
    const [acRegistration, setAcRegistration] = useState(false);
    const [passportID, setPassportID] = useState(false);
    
    // Visit checkboxes
    const [unitVisit, setUnitVisit] = useState(false);
    const [parkingVisit, setParkingVisit] = useState(false);
    const [amenitiesVisit, setAmenitiesVisit] = useState(false);
    const [checklistReceived, setChecklistReceived] = useState(false);
    
    // Text inputs
    const [dewaPremiseNumber, setDewaPremiseNumber] = useState("");
    const [mainDoorKeys, setMainDoorKeys] = useState("");
    const [handoverPack, setHandoverPack] = useState("");
    const [accessCardsIssued, setAccessCardsIssued] = useState("");
    const [cardNumbers, setCardNumbers] = useState("");
    const [remarks, setRemarks] = useState("");
    const [deficienciesIssued, setDeficienciesIssued] = useState("");
    const [handoverCompletedBy, setHandoverCompletedBy] = useState("");
    
    // Signatures - dynamic for multiple owners
    const [ownerSignatures, setOwnerSignatures] = useState<Record<string, SignatureData>>({});
    const [poaSignature, setPoaSignature] = useState<SignatureData>({ name: "", image: null });
    const [staffSignature, setStaffSignature] = useState<SignatureData>({ name: "", image: null });
    
    // Drawing states - dynamic for multiple owners
    const [drawingStates, setDrawingStates] = useState<Record<string, boolean>>({});
    const [drawingPOA, setDrawingPOA] = useState(false);
    const [drawingStaff, setDrawingStaff] = useState(false);
    
    const ownerCanvasRefs = useRef<Record<string, HTMLCanvasElement | null>>({});
    const poaCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const staffCanvasRef = useRef<HTMLCanvasElement | null>(null);

    // Get all owners
    const allOwners = React.useMemo(() => {
        const owners = [];
        
        if (booking?.user) {
            owners.push({
                id: booking.user.id,
                name: booking.user.full_name,
                isPrimary: true
            });
        }
        
        if (booking?.unit?.users && Array.isArray(booking.unit.users)) {
            booking.unit.users.forEach((unitUser: any) => {
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

    // Initialize owner signatures and DEWA premise number
    useEffect(() => {
        const initSignatures: Record<string, SignatureData> = {};
        allOwners.forEach((owner, index) => {
            initSignatures[owner.id] = {
                name: owner.name, // Autofill owner names
                image: null
            };
        });
        setOwnerSignatures(initSignatures);
        
        if (booking?.unit?.dewa_premise_number) {
            setDewaPremiseNumber(booking.unit.dewa_premise_number);
        }
        // Autofill staff signature name and handover completed by name
        setStaffSignature(prev => ({ ...prev, name: "Mohamad" }));
        setHandoverCompletedBy("Mohamad");
    }, [booking, allOwners]);

    const handleGenerateChecklist = async () => {
        // Validate signatures - all owners required OR POA for missing owners
        const totalOwners = allOwners.length;
        const validOwnerSignatures = Object.values(ownerSignatures).filter(
            sig => sig.name.trim() && sig.image
        );
        const hasPOA = poaSignature.name.trim() && poaSignature.image;
        
        // Validate: all owners must sign OR have POA representation
        if (validOwnerSignatures.length < totalOwners && !hasPOA) {
            toast.error(`All ${totalOwners} owner(s) must sign OR provide POA authorization for missing signatures`);
            return;
        }
        
        if (validOwnerSignatures.length === 0 && !hasPOA) {
            toast.error("At least one signature is required");
            return;
        }

        // Validate staff signature
        if (!staffSignature.name.trim() || !staffSignature.image) {
            toast.error("Staff signature is required");
            return;
        }

        try {
            setGeneratingPDF(true);
            
            const authToken = localStorage.getItem("authToken") || "";
            
            // Build owner signatures array
            const ownerSignaturesArray = allOwners.map(owner => {
                const sig = ownerSignatures[owner.id];
                return {
                    name: sig?.name || owner.name,
                    image: sig?.image || null
                };
            }).filter(sig => sig.image); // Only include signatures that have been drawn
            
            // Prepare form data
            const formData = {
                // Document verification
                original_spa: originalSPA,
                poa: powerOfAttorney,
                bank_noc: bankNOC,
                letter_of_discharge: letterOfDischarge,
                trade_license: tradeLicense,
                articles_association: articles,
                shareholders_list: registeredShareholders,
                
                // Registration
                dewa_registration: dewaRegistration,
                ac_registration: acRegistration,
                passport_id_copy: passportID,
                
                // Visits
                visit_to_unit: unitVisit,
                visit_to_parking: parkingVisit,
                amenities_tour: amenitiesVisit,
                checklist_received: checklistReceived,
                
                // Receivables
                dewa_premise_no: dewaPremiseNumber,
                main_door_keys: mainDoorKeys,
                access_cards: accessCardsIssued,
                card_numbers: cardNumbers,
                handover_pack: handoverPack,
                
                // Remarks
                remarks: remarks,
                deficiencies: deficienciesIssued,
                
                // Signatures - new format with multiple owners
                owner_signatures: ownerSignaturesArray,
                // Keep legacy format for backward compatibility
                purchaser_signature_name: ownerSignaturesArray[0]?.name || '',
                purchaser_signature_image: ownerSignaturesArray[0]?.image || null,
                joint_signature_name: ownerSignaturesArray[1]?.name || '',
                joint_signature_image: ownerSignaturesArray[1]?.image || null,
                has_poa: poaSignature.image !== null,
                poa_signature_name: poaSignature.name,
                poa_signature_image: poaSignature.image,
                staff_signature_name: staffSignature.name,
                staff_signature_image: staffSignature.image,
            };
            
            // Backend now generates AND saves the PDF
            const result = await generateHandoverChecklistPDF(
                Number(booking.id),
                authToken,
                formData
            );
            
            toast.success(result.message || "Checklist generated and saved successfully!");
            
            // Notify parent if callback provided
            if (onGenerated) {
                // Create a dummy blob for compatibility with parent component
                const dummyBlob = new Blob([], { type: "application/pdf" });
                const filename = `Handover_Checklist_${booking.id}_${new Date().getTime()}.pdf`;
                onGenerated(dummyBlob, filename);
            }
            
            onOpenChange(false);
        } catch (error) {
            console.error("Error generating checklist:", error);
            toast.error("Failed to generate checklist");
        } finally {
            setGeneratingPDF(false);
        }
    };

    const handlePreview = async () => {
        // Validate signatures - all owners required OR POA for missing owners
        const totalOwners = allOwners.length;
        const validOwnerSignatures = Object.values(ownerSignatures).filter(
            sig => sig.name.trim() && sig.image
        );
        const hasPOA = poaSignature.name.trim() && poaSignature.image;
        
        // Validate: all owners must sign OR have POA representation
        if (validOwnerSignatures.length < totalOwners && !hasPOA) {
            toast.error(`All ${totalOwners} owner(s) must sign OR provide POA authorization for missing signatures`);
            return;
        }

        // Validate staff signature
        if (!staffSignature.name.trim() || !staffSignature.image) {
            toast.error("Staff signature is required to preview");
            return;
        }

        toast.info("Preview feature temporarily disabled. Click 'Generate & Save' to create the checklist.");
        return;

        /* Preview temporarily disabled since backend now saves directly
        try {
            setGeneratingPDF(true);
            
            const authToken = localStorage.getItem("authToken") || "";
            
            // Prepare form data
            const formData = {
                original_spa: originalSPA,
                poa: powerOfAttorney,
                bank_noc: bankNOC,
                letter_of_discharge: letterOfDischarge,
                trade_license: tradeLicense,
                articles_association: articles,
                shareholders_list: registeredShareholders,
                dewa_registration: dewaRegistration,
                ac_registration: acRegistration,
                passport_id_copy: passportID,
                visit_to_unit: unitVisit,
                visit_to_parking: parkingVisit,
                amenities_tour: amenitiesVisit,
                checklist_received: checklistReceived,
                dewa_premise_no: dewaPremiseNumber,
                main_door_keys: mainDoorKeys,
                access_cards: accessCardsIssued,
                card_numbers: cardNumbers,
                handover_pack: handoverPack,
                remarks: remarks,
                deficiencies: deficienciesIssued,
                purchaser_signature_name: purchaserSignature.name,
                purchaser_signature_image: purchaserSignature.image,
                has_joint_purchaser: allOwners.length > 1 && jointPurchaserSignature.image,
                joint_signature_name: jointPurchaserSignature.name,
                joint_signature_image: jointPurchaserSignature.image,
                has_poa: poaSignature.image !== null,
                poa_signature_name: poaSignature.name,
                poa_signature_image: poaSignature.image,
                staff_signature_name: staffSignature.name,
                staff_signature_image: staffSignature.image,
            };
            
            const pdfBlob = await generateHandoverChecklistPDF(
                Number(booking.id),
                authToken,
                formData
            );
            
            // Create preview URL
            const url = URL.createObjectURL(pdfBlob);
            setPreviewUrl(url);
            setShowPreview(true);
            
        } catch (error) {
            console.error("Error generating preview:", error);
            toast.error("Failed to generate preview");
        } finally {
            setGeneratingPDF(false);
        }
        */
    };

    const renderSignatureCanvas = (
        label: string,
        canvasRef: React.MutableRefObject<HTMLCanvasElement | null>,
        signature: SignatureData,
        setSignature: React.Dispatch<React.SetStateAction<SignatureData>>,
        isDrawing: boolean,
        setIsDrawing: React.Dispatch<React.SetStateAction<boolean>>,
        nameEditable: boolean = true
    ) => {
        return (
            <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">{label}</label>
                
                {nameEditable && (
                    <input
                        type="text"
                        value={signature.name}
                        onChange={(e) => setSignature(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Full Name"
                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                )}
                
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 bg-gray-50">
                    <canvas
                        ref={canvasRef}
                        width={500}
                        height={150}
                        className="w-full border border-gray-300 rounded bg-white touch-none"
                        style={{ 
                            touchAction: 'none',
                            userSelect: 'none',
                            WebkitUserSelect: 'none',
                            WebkitTouchCallout: 'none'
                        }}
                        onMouseDown={(e) => {
                            setIsDrawing(true);
                            const canvas = canvasRef.current;
                            if (!canvas) return;
                            const ctx = canvas.getContext('2d');
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
                            if (!isDrawing) return;
                            const canvas = canvasRef.current;
                            if (!canvas) return;
                            const ctx = canvas.getContext('2d');
                            if (!ctx) return;
                            const rect = canvas.getBoundingClientRect();
                            const x = (e.clientX - rect.left) * (canvas.width / rect.width);
                            const y = (e.clientY - rect.top) * (canvas.height / rect.height);
                            ctx.lineTo(x, y);
                            ctx.stroke();
                        }}
                        onMouseUp={() => setIsDrawing(false)}
                        onMouseLeave={() => setIsDrawing(false)}
                        onTouchStart={(e) => {
                            e.preventDefault();
                            setIsDrawing(true);
                            const canvas = canvasRef.current;
                            if (!canvas) return;
                            const ctx = canvas.getContext('2d');
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
                            if (!isDrawing) return;
                            const canvas = canvasRef.current;
                            if (!canvas) return;
                            const ctx = canvas.getContext('2d');
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
                            setIsDrawing(false);
                        }}
                    />
                </div>
                
                <div className="flex gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => {
                            const canvas = canvasRef.current;
                            if (!canvas) return;
                            const ctx = canvas.getContext('2d');
                            if (!ctx) return;
                            ctx.clearRect(0, 0, canvas.width, canvas.height);
                            setSignature(prev => ({ ...prev, image: null }));
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
                            const canvas = canvasRef.current;
                            if (!canvas) return;
                            const dataUrl = canvas.toDataURL('image/png');
                            setSignature(prev => ({ ...prev, image: dataUrl }));
                            toast.success('Signature validated!');
                        }}
                    >
                        Validate Signature
                    </Button>
                </div>
                
                {signature.image && (
                    <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded">
                        <p className="text-xs text-green-700 font-medium mb-1">✓ Signature validated</p>
                        <img src={signature.image} alt="Signature preview" className="w-full h-auto max-h-16 object-contain border-t pt-1" />
                    </div>
                )}
            </div>
        );
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-full !max-w-5xl h-[95vh] flex flex-col p-0">
                <DialogHeader className="px-6 pt-6 pb-4 border-b flex-shrink-0">
                    <DialogTitle>Handover Checklist</DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto px-6 py-4">
                    <div className="space-y-6">
                    {/* Header */}
                    <div className="pb-4 border-b">
                        <h1 className="text-xl font-bold mb-1">HANDOVER CHECKLIST</h1>
                    </div>

                    {/* Building and Unit Info */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-sm font-medium text-gray-700">Building Name:</p>
                            <p className="text-base font-semibold">{booking?.unit?.property?.project_name || "N/A"}</p>
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-700">Unit No:</p>
                            <p className="text-base font-semibold">{booking?.unit?.unit || "N/A"}</p>
                        </div>
                    </div>

                    {/* Purchaser Information */}
                    <div>
                        <h3 className="font-semibold text-base mb-3 uppercase">Purchaser</h3>
                        <div className="space-y-2">
                            {allOwners.map((owner, index) => (
                                <div key={owner.id} className="flex items-start gap-2">
                                    <p className="text-sm font-medium text-gray-700 min-w-[60px]">Name {index + 1}:</p>
                                    <p className="text-sm font-semibold">{owner.name}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="border-b"></div>

                    {/* Document Verification */}
                    <div>
                        <h3 className="font-semibold text-base mb-3 uppercase">Document Verification</h3>
                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div className="space-y-3">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={originalSPA}
                                        onChange={(e) => setOriginalSPA(e.target.checked)}
                                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                    />
                                    <span className="text-sm">Original SPA</span>
                                </label>
                                
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={powerOfAttorney}
                                        onChange={(e) => setPowerOfAttorney(e.target.checked)}
                                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                    />
                                    <span className="text-sm">Power of Attorney</span>
                                </label>
                                
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={bankNOC}
                                        onChange={(e) => setBankNOC(e.target.checked)}
                                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                    />
                                    <span className="text-sm">Bank NOC (verified for mortgage)</span>
                                </label>
                                
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={letterOfDischarge}
                                        onChange={(e) => setLetterOfDischarge(e.target.checked)}
                                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                    />
                                    <span className="text-sm">Letter of Discharge and Adherence signed</span>
                                </label>
                            </div>

                            <div className="space-y-3">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={dewaRegistration}
                                        onChange={(e) => setDewaRegistration(e.target.checked)}
                                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                    />
                                    <span className="text-sm">DEWA registration</span>
                                </label>
                                
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={acRegistration}
                                        onChange={(e) => setAcRegistration(e.target.checked)}
                                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                    />
                                    <span className="text-sm">AC registration</span>
                                </label>
                                
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={passportID}
                                        onChange={(e) => setPassportID(e.target.checked)}
                                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                    />
                                    <span className="text-sm">Passport / ID</span>
                                </label>
                            </div>
                        </div>

                        <div className="pl-6 space-y-3 mt-4 border-t pt-4">
                            <p className="text-sm font-medium text-gray-700">For Companies:</p>
                            
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={tradeLicense}
                                    onChange={(e) => setTradeLicense(e.target.checked)}
                                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                />
                                <span className="text-sm">Trade License / Certificate of Incorporation*</span>
                            </label>
                            
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={articles}
                                    onChange={(e) => setArticles(e.target.checked)}
                                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                />
                                <span className="text-sm">Articles & Memorandum of Association*</span>
                            </label>
                            
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={registeredShareholders}
                                    onChange={(e) => setRegisteredShareholders(e.target.checked)}
                                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                />
                                <span className="text-sm">Registered shareholders & Directors of the Company - Share Certificate & Notarised Attested Power of Attorney with company stamp signed by</span>
                            </label>
                            
                            <p className="text-xs text-gray-500 italic">*In case originals are not available, legally attested copies to be presented</p>
                        </div>
                    </div>

                    <div className="border-b"></div>

                    {/* Visits */}
                    <div>
                        <h3 className="font-semibold text-base mb-3 uppercase">Visits</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={unitVisit}
                                    onChange={(e) => setUnitVisit(e.target.checked)}
                                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                />
                                <span className="text-sm">Unit visit</span>
                            </label>
                            
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={parkingVisit}
                                    onChange={(e) => setParkingVisit(e.target.checked)}
                                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                />
                                <span className="text-sm">Parking visit</span>
                            </label>
                            
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={amenitiesVisit}
                                    onChange={(e) => setAmenitiesVisit(e.target.checked)}
                                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                />
                                <span className="text-sm">Amenities visit</span>
                            </label>
                            
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={checklistReceived}
                                    onChange={(e) => setChecklistReceived(e.target.checked)}
                                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                />
                                <span className="text-sm">Checklist received</span>
                            </label>
                        </div>
                    </div>

                    <div className="border-b"></div>

                    {/* Remarks & Deficiencies */}
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Deficiencies list issued/signed:</label>
                            <select
                                value={deficienciesIssued}
                                onChange={(e) => setDeficienciesIssued(e.target.value)}
                                className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">Select option...</option>
                                <option value="Yes">Yes</option>
                                <option value="No">No</option>
                                <option value="Not Applicable">Not Applicable</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Remarks:</label>
                            <textarea
                                value={remarks}
                                onChange={(e) => setRemarks(e.target.value)}
                                placeholder="Enter any remarks..."
                                className="w-full min-h-[80px] px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        
                    </div>

                    <div className="border-b"></div>

                    {/* DEWA & Receivables */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">DEWA Premise Number:</label>
                            <input
                                type="text"
                                value={dewaPremiseNumber}
                                onChange={(e) => setDewaPremiseNumber(e.target.value)}
                                placeholder="Enter DEWA premise number..."
                                className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>

                    <div className="border-b"></div>

                    {/* Receivables */}
                    <div>
                        <h3 className="font-semibold text-base mb-3 uppercase">Receivables</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">No. of Main Door Keys:</label>
                                <input
                                    type="text"
                                    value={mainDoorKeys}
                                    onChange={(e) => setMainDoorKeys(e.target.value)}
                                    placeholder="Enter number..."
                                    className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Handover Pack:</label>
                                <input
                                    type="text"
                                    value={handoverPack}
                                    onChange={(e) => setHandoverPack(e.target.value)}
                                    placeholder="Enter details..."
                                    className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">No. of Access Cards Issued:</label>
                                <input
                                    type="text"
                                    value={accessCardsIssued}
                                    onChange={(e) => setAccessCardsIssued(e.target.value)}
                                    placeholder="Enter number..."
                                    className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Card Numbers:</label>
                                <input
                                    type="text"
                                    value={cardNumbers}
                                    onChange={(e) => setCardNumbers(e.target.value)}
                                    placeholder="Enter card numbers..."
                                    className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="border-b"></div>

                    {/* Declaration */}
                    <div className="bg-blue-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-800 italic">
                            I/We hereby declare that I/we have checked all the items above and have received back all the original documents.
                        </p>
                    </div>

                    {/* Signatures */}
                    <div className="space-y-6">
                        <h3 className="font-semibold text-base uppercase">Signatures</h3>
                        
                        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded mb-4">
                            <p className="text-sm text-gray-800 font-medium mb-2">
                                📝 Signature Requirements:
                            </p>
                            <p className="text-xs text-gray-700 leading-relaxed">
                                <strong>All {allOwners.length} owner(s) must sign.</strong> If any owner cannot sign in person, a Power of Attorney (POA) signature is required on their behalf.
                            </p>
                        </div>
                        
                        {/* Dynamic owner signatures */}
                        <div className="space-y-6">
                            {allOwners.map((owner, index) => {
                                const ownerId = owner.id.toString();
                                const canvasId = `owner-canvas-${ownerId}`;
                                
                                return (
                                    <div key={ownerId} className={`pb-6 ${index < allOwners.length - 1 ? 'border-b border-gray-200' : ''}`}>
                                        <h4 className="font-medium text-sm mb-4 text-gray-700">
                                            {index === 0 ? '👤 Primary Purchaser' : `👥 Co-Purchaser ${index}`}: {owner.name}
                                        </h4>
                                        
                                        <div className="space-y-3">
                                            <label className="block text-sm font-medium text-gray-700">Full Name</label>
                                            <input
                                                type="text"
                                                value={ownerSignatures[ownerId]?.name || ""}
                                                onChange={(e) => {
                                                    setOwnerSignatures(prev => ({
                                                        ...prev,
                                                        [ownerId]: { ...prev[ownerId], name: e.target.value }
                                                    }));
                                                }}
                                                placeholder="Full Name"
                                                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                            
                                            <label className="block text-sm font-medium text-gray-700">Draw Signature</label>
                                            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 bg-gray-50">
                                                <canvas
                                                    ref={(el) => { ownerCanvasRefs.current[canvasId] = el; }}
                                                    width={500}
                                                    height={150}
                                                    className="w-full border border-gray-300 rounded bg-white touch-none"
                                                    style={{ 
                                                        touchAction: 'none',
                                                        userSelect: 'none',
                                                        WebkitUserSelect: 'none',
                                                        WebkitTouchCallout: 'none'
                                                    }}
                                                    onMouseDown={(e) => {
                                                        setDrawingStates(prev => ({ ...prev, [canvasId]: true }));
                                                        const canvas = ownerCanvasRefs.current[canvasId];
                                                        if (!canvas) return;
                                                        const ctx = canvas.getContext('2d');
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
                                                        const canvas = ownerCanvasRefs.current[canvasId];
                                                        if (!canvas) return;
                                                        const ctx = canvas.getContext('2d');
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
                                                        const canvas = ownerCanvasRefs.current[canvasId];
                                                        if (!canvas) return;
                                                        const ctx = canvas.getContext('2d');
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
                                                        const canvas = ownerCanvasRefs.current[canvasId];
                                                        if (!canvas) return;
                                                        const ctx = canvas.getContext('2d');
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
                                            
                                            <div className="flex gap-2">
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    className="flex-1"
                                                    onClick={() => {
                                                        const canvas = ownerCanvasRefs.current[canvasId];
                                                        if (!canvas) return;
                                                        const ctx = canvas.getContext('2d');
                                                        if (!ctx) return;
                                                        ctx.clearRect(0, 0, canvas.width, canvas.height);
                                                        setOwnerSignatures(prev => ({
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
                                                        const canvas = ownerCanvasRefs.current[canvasId];
                                                        if (!canvas) return;
                                                        const dataUrl = canvas.toDataURL('image/png');
                                                        setOwnerSignatures(prev => ({
                                                            ...prev,
                                                            [ownerId]: { ...prev[ownerId], image: dataUrl }
                                                        }));
                                                        toast.success('Signature saved!');
                                                    }}
                                                >
                                                    Save Signature
                                                </Button>
                                            </div>
                                            
                                            {ownerSignatures[ownerId]?.image && (
                                                <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                                                    <p className="text-xs text-green-700 font-medium mb-2">✓ Signature saved</p>
                                                    <div className="border rounded bg-white p-2">
                                                        <img
                                                            src={ownerSignatures[ownerId].image}
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
                        </div>
                        
                        {/* POA Signature */}
                        <div className="pt-4 border-t border-gray-200">
                            {renderSignatureCanvas(
                                "Purchaser POA (if applicable)",
                                poaCanvasRef,
                                poaSignature,
                                setPoaSignature,
                                drawingPOA,
                                setDrawingPOA
                            )}
                        </div>
                    </div>

                    <div className="border-b"></div>

                    {/* Staff Signature */}
                    <div>
                        <h3 className="font-semibold text-base mb-3 uppercase">Handover Completed By</h3>
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Name:</label>
                            <input
                                type="text"
                                value={handoverCompletedBy}
                                onChange={(e) => setHandoverCompletedBy(e.target.value)}
                                placeholder="Enter staff name..."
                                className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        
                        {renderSignatureCanvas(
                            "Staff Signature",
                            staffCanvasRef,
                            staffSignature,
                            setStaffSignature,
                            drawingStaff,
                            setDrawingStaff
                        )}
                    </div>

                    {/* Preview Section */}
                    {showPreview && previewUrl && (
                        <div className="mt-6">
                            <div className="border rounded-lg overflow-hidden">
                                <div className="p-3 bg-gray-100 flex items-center justify-between">
                                    <span className="text-sm font-medium text-gray-700">PDF Preview</span>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => window.open(previewUrl, '_blank')}
                                        >
                                            <Eye className="w-4 h-4 mr-1" />
                                            Open Full
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => {
                                                setShowPreview(false);
                                                if (previewUrl) {
                                                    URL.revokeObjectURL(previewUrl);
                                                    setPreviewUrl(null);
                                                }
                                            }}
                                        >
                                            Close Preview
                                        </Button>
                                    </div>
                                </div>
                                <iframe 
                                    src={previewUrl} 
                                    className="w-full h-96 border-0"
                                    title="Handover Checklist Preview"
                                />
                            </div>
                        </div>
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
                        variant="outline"
                        onClick={handlePreview}
                        disabled={generatingPDF}
                    >
                        {generatingPDF ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Generating...
                            </>
                        ) : (
                            <>
                                <Eye className="mr-2 h-4 w-4" />
                                Preview
                            </>
                        )}
                    </Button>
                    <Button
                        onClick={handleGenerateChecklist}
                        disabled={generatingPDF}
                    >
                        {generatingPDF ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Generating...
                            </>
                        ) : (
                            "Generate & Upload"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
