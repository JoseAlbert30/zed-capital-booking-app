import { useState, useEffect } from "react";
import { Calendar } from "./ui/calendar";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { Sheet, SheetContent, SheetTrigger, SheetClose } from "./ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { CalendarCheck, LogOut, Clock, CheckCircle, Building2, MapPin, Home, AlertCircle, Menu, X } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { User, Booking } from "@/lib/api";

interface EligibleUnit {
  id: number;
  unit: string;
  property: {
    id: number;
    project_name: string;
    location: string;
  };
  has_booking: boolean;
  booking?: {
    id: number;
    booked_date: string;
    booked_time: string;
  };
}

interface CustomerBookingProps {
  userEmail: string;
  onLogout: () => void;
  bookings: Booking[];
  onCreateBooking: (booking: { 
    date: Date; 
    time: string; 
    customerEmail: string;
    isOwnerAttending?: boolean;
    poaDocument?: File;
    attorneyIdDocument?: File;
  }, unitId: number) => void;
  onDeleteBooking: (id: string) => void;
  currentUser?: User | null;
  authToken: string | null;
  eligibleUnits: EligibleUnit[];
  selectedUnitId: number | null;
  onSelectUnit: (unitId: number | null) => void;
  isFromBookingLink?: boolean;
}

const TIME_SLOTS = [
  "09:00", "10:00", "11:00", "12:00", "13:00", "14:00",
  "15:00", "16:00", "17:00"
];

export function CustomerBooking({ userEmail, onLogout, bookings, onCreateBooking, currentUser, authToken, eligibleUnits = [], selectedUnitId, onSelectUnit, isFromBookingLink = false }: CustomerBookingProps) {
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [showThankYou, setShowThankYou] = useState(false);
  const [confirmedBooking, setConfirmedBooking] = useState<{ date: Date; time: string; unit: string; project: string; isPending?: boolean } | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [isBooking, setIsBooking] = useState(false);
  const [availableSlots, setAvailableSlots] = useState<string[]>(TIME_SLOTS);
  const [isOwnerAttending, setIsOwnerAttending] = useState<boolean | null>(null);
  const [poaDocument, setPoaDocument] = useState<File | null>(null);
  const [attorneyIdDocument, setAttorneyIdDocument] = useState<File | null>(null);

  console.log('CustomerBooking render - selectedUnitId:', selectedUnitId);
  console.log('CustomerBooking render - currentUser units:', currentUser?.units?.length);
  console.log('CustomerBooking render - eligibleUnits:', eligibleUnits?.length);

  // Get selected unit details
  const selectedUnit = eligibleUnits?.find(u => u.id === selectedUnitId);

  // Check if user has already booked the selected unit
  const hasBookedSelectedUnit = selectedUnit?.has_booking || false;

  const handleCreateBooking = async () => {
    console.log('=== handleCreateBooking called ===');
    console.log('selectedDate:', selectedDate);
    console.log('selectedDate toString:', selectedDate?.toString());
    console.log('selectedDate toDateString:', selectedDate?.toDateString());
    console.log('selectedDate getDate():', selectedDate?.getDate());
    console.log('selectedDate getMonth():', selectedDate?.getMonth());
    console.log('selectedDate getFullYear():', selectedDate?.getFullYear());
    console.log('selectedTime:', selectedTime);
    console.log('selectedUnitId:', selectedUnitId);
    
    if (selectedDate && selectedTime && selectedUnitId && isOwnerAttending !== null) {
      setIsBooking(true);
      setBookingError(null);
      
      try {
        const unit = currentUser?.units?.find(u => u.id === selectedUnitId);
        
        await onCreateBooking({
          date: selectedDate,
          time: selectedTime,
          customerEmail: userEmail,
          isOwnerAttending: isOwnerAttending,
          poaDocument: poaDocument || undefined,
          attorneyIdDocument: attorneyIdDocument || undefined,
        }, selectedUnitId);
        
        setConfirmedBooking({ 
          date: selectedDate, 
          time: selectedTime,
          unit: unit?.unit || '',
          project: unit?.property.project_name || '',
          isPending: !isOwnerAttending,
        });
        setShowThankYou(true);
        setSelectedDate(undefined);
        setSelectedTime("");
        setIsOwnerAttending(null);
        setPoaDocument(null);
        setAttorneyIdDocument(null);
      } catch (error: any) {
        console.error('Booking error:', error);
        setBookingError(error.message || 'Failed to create booking. Please try again.');
      } finally {
        setIsBooking(false);
      }
    } else if (!selectedUnitId) {
      setBookingError('Please select a unit to book');
    }
  };

  const bookedDates = bookings.map((b) => new Date(b.booked_date).toDateString());

  // Fetch available time slots from backend when date is selected
  useEffect(() => {
    const fetchAvailableSlots = async () => {
      if (!selectedDate || !authToken) {
        setAvailableSlots(TIME_SLOTS);
        return;
      }

      try {
        const formattedDate = format(selectedDate, 'yyyy-MM-dd');
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/bookings/available-slots?date=${formattedDate}`,
          {
            headers: {
              Authorization: `Bearer ${authToken}`,
            },
          }
        );

        if (!response.ok) {
          console.error('Failed to fetch available slots');
          setAvailableSlots(TIME_SLOTS);
          return;
        }

        const data = await response.json();
        setAvailableSlots(data.available_slots || TIME_SLOTS);
      } catch (error) {
        console.error('Error fetching available slots:', error);
        setAvailableSlots(TIME_SLOTS);
      }
    };

    fetchAvailableSlots();
  }, [selectedDate, authToken]);

  // Fetch available slots from backend when date is selected
  useEffect(() => {
    const fetchAvailableSlots = async () => {
      if (!selectedDate || !authToken) {
        setAvailableSlots(TIME_SLOTS);
        return;
      }

      try {
        const formattedDate = format(selectedDate, 'yyyy-MM-dd');
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/bookings/available-slots?date=${formattedDate}`,
          {
            headers: {
              Authorization: `Bearer ${authToken}`,
            },
          }
        );

        if (!response.ok) {
          console.error('Failed to fetch available slots');
          setAvailableSlots(TIME_SLOTS);
          return;
        }

        const data = await response.json();
        setAvailableSlots(data.available_slots || TIME_SLOTS);
      } catch (error) {
        console.error('Error fetching available slots:', error);
        setAvailableSlots(TIME_SLOTS);
      }
    };

    fetchAvailableSlots();
  }, [selectedDate, authToken]);

  // Details Panel Content (reusable for both desktop and mobile)
  const DetailsPanel = () => (
    <>
      {/* Header with Logout */}
      <div className="flex items-center justify-between mb-12">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center">
            <CalendarCheck className="w-6 h-6 text-black" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">Handover Appointment</h2>
          </div>
        </div>
        <Button 
          variant="outline" 
          onClick={onLogout} 
          className="gap-2 bg-white text-black hover:bg-gray-100 border-0"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </Button>
      </div>

      {/* User Details */}
      <div className="mb-12">
        <h3 className="text-sm uppercase tracking-wider text-gray-400 mb-4">Your Account</h3>
        <div className="space-y-3">
          <div className="bg-white/10 rounded-lg p-6 border border-white/10">
            <p className="text-sm text-gray-400 mb-1">Email</p>
            <p className="text-lg">{userEmail}</p>
          </div>
          
          {/* Show booking for selected unit if it exists */}
          {selectedUnit?.has_booking && selectedUnit?.booking && (
            <div className="bg-white/10 rounded-lg p-6 border border-white/10">
              <div className="flex items-start gap-3">
                <CalendarCheck className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                <div className="w-full">
                  <h4 className="font-semibold mb-2 text-green-100">Appointment Confirmed</h4>
                  <p className="text-sm text-gray-300 mb-2">
                    {selectedUnit.property.project_name} - Unit {selectedUnit.unit}
                  </p>
                  <div className="space-y-1">
                    <p className="text-sm text-gray-300">
                      {format(new Date(selectedUnit.booking.booked_date), "EEEE, MMMM d, yyyy")}
                    </p>
                    <p className="text-sm text-gray-300 flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {selectedUnit.booking.booked_time}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Unit & Property Details (for booking link access) */}
      {isFromBookingLink && selectedUnit && (
        <div className="mb-12">
          <h3 className="text-sm uppercase tracking-wider text-gray-400 mb-4">Unit Details</h3>
          <div className="space-y-4">
            {/* Unit Information Card */}
            <div className="bg-white/10 rounded-lg p-6 border border-white/10">
              <div className="flex items-start gap-3 mb-4">
                <Home className="w-6 h-6 text-white mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h4 className="text-xl font-semibold mb-1">Unit {selectedUnit.unit}</h4>
                  <p className="text-sm text-gray-300">{selectedUnit.property.project_name}</p>
                </div>
              </div>
              
              {/* Property Location */}
              <div className="flex items-center gap-2 text-gray-300 mb-4 pb-4 border-b border-white/10">
                <MapPin className="w-4 h-4 flex-shrink-0" />
                <span className="text-sm">{selectedUnit.property.location}</span>
              </div>

              {/* Additional Property Details if available */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Property Type</span>
                  <span className="text-white font-medium">Residential</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Status</span>
                  <span className="text-green-300 font-medium flex items-center gap-1">
                    <CheckCircle className="w-4 h-4" />
                    Ready for Handover
                  </span>
                </div>
              </div>
            </div>

            {/* Important Information Card */}
            <div className="bg-white/10 rounded-lg p-6 border border-white/10">
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                About {selectedUnit.property.project_name}
              </h4>
              <p className="text-sm text-gray-300 leading-relaxed">
                Your new home is located in one of Dubai's premier residential developments. 
                We're excited to hand over your property and welcome you to the community.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Property Details */}
      {!isFromBookingLink && (
      <div>
        <h3 className="text-sm uppercase tracking-wider text-gray-400 mb-4">Your Units</h3>
        <div className="space-y-4">
          {currentUser?.units && currentUser.units.length > 0 ? (
            <>
              {/* Desktop: Unit cards */}
              <div className="hidden md:block space-y-3">
                <Label className="text-sm text-gray-400 mb-2 block">Select Unit to Book</Label>
                {currentUser.units.map((unit) => {
                  const isEligible = unit.payment_status === 'fully_paid' && unit.handover_ready;
                  const hasBooking = eligibleUnits?.find(eu => eu.id === unit.id)?.has_booking;
                  const isSelected = selectedUnitId === unit.id;
                  
                  return (
                    <button
                      key={unit.id}
                      onClick={() => {
                        console.log('Unit card clicked:', unit.id, 'isEligible:', isEligible);
                        if (isEligible && onSelectUnit) {
                          onSelectUnit(unit.id);
                        }
                      }}
                      disabled={!isEligible}
                      className={`
                        w-full text-left rounded-lg p-4 border transition-all
                        ${
                          isSelected
                            ? 'bg-white/20 border-white/40'
                            : isEligible
                            ? 'bg-white/10 border-white/10 hover:bg-white/15 hover:border-white/20 cursor-pointer'
                            : 'bg-white/5 border-white/5 opacity-50 cursor-not-allowed'
                        }
                      `}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Home className="w-4 h-4 text-gray-400" />
                            <p className="font-semibold text-white">Unit {unit.unit}</p>
                            {isSelected && (
                              <CheckCircle className="w-4 h-4 text-green-400" />
                            )}
                          </div>
                          <p className="text-sm text-gray-300 mb-1">{unit.property.project_name}</p>
                          <div className="flex items-center gap-1 text-xs text-gray-400">
                            <MapPin className="w-3 h-3" />
                            <span>{unit.property.location}</span>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {unit.payment_status === 'fully_paid' ? (
                              <span className="text-xs px-2 py-1 bg-green-500/20 text-green-300 rounded">Paid</span>
                            ) : (
                              <span className="text-xs px-2 py-1 bg-yellow-500/20 text-yellow-300 rounded">Payment Pending</span>
                            )}
                            {unit.handover_ready ? (
                              <span className="text-xs px-2 py-1 bg-green-500/20 text-green-300 rounded">Ready</span>
                            ) : (
                              <span className="text-xs px-2 py-1 bg-gray-500/20 text-gray-300 rounded">Not Ready</span>
                            )}
                            {hasBooking && (
                              <span className="text-xs px-2 py-1 bg-blue-500/20 text-blue-300 rounded">Booked</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="bg-white/10 rounded-lg p-6 border border-white/10">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-semibold mb-2">No Units Available</h4>
                  <p className="text-sm text-gray-300">
                    You don't have any units assigned to your account.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Unit Status Messages */}
          {selectedUnitId && currentUser?.units && (() => {
            const unit = currentUser.units.find(u => u.id === selectedUnitId);
            if (!unit) return null;
            
            const isEligible = unit.payment_status === 'fully_paid' && unit.handover_ready;
            const hasBooking = eligibleUnits?.find(eu => eu.id === unit.id)?.has_booking;
            
            if (!isEligible) {
              return (
                <div className="bg-white/10 rounded-lg p-6 border border-white/10">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold mb-2 text-yellow-100">Not Available for Booking</h4>
                      <p className="text-sm text-gray-300">
                        {unit.payment_status !== 'fully_paid' && 'Payment must be completed. '}
                        {!unit.handover_ready && 'Handover requirements must be fulfilled.'}
                      </p>
                    </div>
                  </div>
                </div>
              );
            }
            
            if (hasBooking) {
              return (
                <div className="bg-white/10 rounded-lg p-6 border border-white/10">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold mb-2 text-green-100">Already Booked</h4>
                      <p className="text-sm text-gray-300">This unit already has a handover appointment scheduled.</p>
                    </div>
                  </div>
                </div>
              );
            }
            
            return (
              <div className="bg-white/10 rounded-lg p-6 border border-white/10">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold mb-2 text-green-100">Ready to Book</h4>
                    <p className="text-sm text-gray-300">This unit is ready for handover booking.</p>
                  </div>
                </div>
              </div>
            );
          })()}

          <div className="bg-white/10 rounded-lg p-6 border border-white/10">
            <h4 className="font-semibold mb-3">What to Bring</h4>
            <ul className="space-y-2 text-sm text-gray-300">
              <li className="flex items-start gap-2">
                <span className="text-white mt-1">•</span>
                <span>Valid government-issued ID</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-white mt-1">•</span>
                <span>Original purchase agreement</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-white mt-1">•</span>
                <span>Proof of final payment</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-white mt-1">•</span>
                <span>Any correspondence from the developer</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
      )}

      {/* Footer Note */}
      <div className="mt-8 pt-6 border-t border-white/10">
        <p className="text-sm text-gray-400">
          Need to reschedule? Contact us at <span className="text-white">vantage@zedcapital.ae</span>
        </p>
      </div>
    </>
  );

  return (
    <div className="min-h-screen md:h-screen flex flex-col md:flex-row overflow-hidden">
      {/* Left Side - Booking Schedule (White) */}
      <div className="flex-1 md:flex-[0.7] bg-white p-4 md:p-8 flex flex-col overflow-y-auto">
        {/* Mobile Header with Burger Menu */}
        <div className="md:hidden sticky top-0 bg-white z-10 py-2 space-y-4">
          {/* Header with burger menu */}
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Book Handover</h1>
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
            <SheetContent side="right" className="w-[85vw] sm:w-[400px] bg-black text-white border-0 p-0 overflow-y-auto">
              {/* Sheet Header */}
              <div className="sticky top-0 bg-black z-10 px-6 py-4 border-b border-white/10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
                      <CalendarCheck className="w-5 h-5 text-black" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold">Account Details</h2>
                      <p className="text-sm text-gray-400">Property Information</p>
                    </div>
                  </div>
                  <SheetClose asChild>
                    <Button variant="ghost" size="icon" className="text-white hover:bg-white/10">
                      <X className="h-5 w-5" />
                    </Button>
                  </SheetClose>
                </div>
              </div>
              
              {/* Sheet Content */}
              <div className="px-6 py-6">
                <div className="flex flex-col justify-between min-h-full">
                  <div>
                    <DetailsPanel />
                  </div>
                </div>
              </div>
            </SheetContent>
          </Sheet>
          </div>
          
          {/* Unit Selector Cards - Mobile Only */}
          {!isFromBookingLink && currentUser?.units && currentUser.units.length > 0 && (
            <div className="w-full overflow-x-auto">
              <div className="flex gap-2 pb-2">
                {currentUser.units.map((unit) => {
                  const isEligible = unit.payment_status === 'fully_paid' && unit.handover_ready;
                  const hasBooking = eligibleUnits?.find(eu => eu.id === unit.id)?.has_booking;
                  const isSelected = selectedUnitId === unit.id;
                  
                  return (
                    <button
                      key={unit.id}
                      onClick={() => {
                        if (isEligible && onSelectUnit) {
                          onSelectUnit(unit.id);
                        }
                      }}
                      disabled={!isEligible}
                      className={`
                        flex-shrink-0 rounded-lg px-4 py-3 border transition-all text-left min-w-[200px]
                        ${
                          isSelected
                            ? 'bg-black text-white border-black'
                            : isEligible
                            ? 'bg-white text-black border-gray-300 hover:border-black hover:bg-gray-50'
                            : 'bg-gray-100 text-gray-400 border-gray-200 opacity-60 cursor-not-allowed'
                        }
                      `}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Home className="w-4 h-4" />
                        <span className="font-semibold">Unit {unit.unit}</span>
                        {isSelected && (
                          <CheckCircle className="w-4 h-4 ml-auto" />
                        )}
                      </div>
                      <p className="text-xs opacity-80">{unit.property.project_name}</p>
                      {!isEligible && (
                        <p className="text-xs mt-1 font-medium">Not Available</p>
                      )}
                      {hasBooking && (
                        <p className="text-xs mt-1 font-medium">Booked</p>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="max-w-2xl mx-auto w-full space-y-6 md:space-y-10 pb-6 md:py-8">
          <div className="hidden md:block">
            <h1 className="text-4xl font-bold mb-3">Schedule Your Handover</h1>
            <p className="text-lg text-gray-600">Select a date and time for your property handover appointment</p>
          </div>

          {/* Show confirmation if user already has a booking for selected unit */}
          {(() => {
            if (!selectedUnitId || !currentUser?.units) return null;
            
            const unit = currentUser.units.find(u => u.id === selectedUnitId);
            if (!unit) return null;
            
            const eligibleUnit = eligibleUnits?.find(eu => eu.id === selectedUnitId);
            const hasBooking = eligibleUnit?.has_booking && eligibleUnit?.booking;
            
            if (hasBooking && eligibleUnit?.booking) {
              return (
                <div className="flex flex-col items-center justify-center py-12 space-y-6">
                  <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-12 h-12 text-green-600" />
                  </div>
                  <div className="text-center space-y-3">
                    <h2 className="text-3xl font-bold text-black">Appointment Confirmed!</h2>
                    <p className="text-lg text-gray-600">Your handover appointment for this unit is scheduled</p>
                  </div>
                  <div className="bg-gray-50 border-2 border-gray-200 rounded-2xl p-8 w-full max-w-md space-y-4">
                    <div className="flex items-center gap-3 pb-4 border-b border-gray-200">
                      <CalendarCheck className="w-6 h-6 text-black" />
                      <div>
                        <p className="text-sm text-gray-500 font-medium">Appointment Details</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Unit</p>
                        <p className="text-xl font-bold text-black">
                          {unit.property.project_name} - Unit {unit.unit}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Date</p>
                        <p className="text-2xl font-bold text-black">
                          {format(new Date(eligibleUnit.booking.booked_date), "EEEE, MMMM d, yyyy")}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Time</p>
                        <p className="text-2xl font-bold text-black flex items-center gap-2">
                          <Clock className="w-6 h-6" />
                          {eligibleUnit.booking.booked_time}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-md">
                    <p className="text-sm text-blue-800 text-center">
                      Need to reschedule? Please contact us at <strong>vantage@zedcapital.ae</strong>
                    </p>
                  </div>
                </div>
              );
            }
            
            return null;
          })()}

          {/* Show "Select a Unit" message */}
          {!selectedUnitId && (
            <div className="flex flex-col items-center justify-center py-12 space-y-6">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center">
                <Home className="w-12 h-12 text-gray-400" />
              </div>
              <div className="text-center space-y-3">
                <h2 className="text-2xl font-bold text-black">Select a Unit</h2>
                <p className="text-lg text-gray-600 max-w-md">
                  {currentUser?.units && currentUser.units.length > 0
                    ? "Please select a unit from the sidebar to book your handover appointment"
                    : "You don't have any units assigned yet"
                  }
                </p>
              </div>
            </div>
          )}

          {/* Show calendar and time slots if unit is selected, eligible, and not booked */}
          {(() => {
            console.log('=== Calendar display logic ===');
            console.log('selectedUnitId:', selectedUnitId);
            console.log('currentUser?.units:', currentUser?.units?.length);
            
            if (!selectedUnitId || !currentUser?.units) {
              console.log('Returning null: no selectedUnitId or no units');
              return null;
            }
            
            const unit = currentUser.units.find(u => u.id === selectedUnitId);
            console.log('Found unit:', unit);
            
            if (!unit) {
              console.log('Returning null: unit not found');
              return null;
            }
            
            const isEligible = unit.payment_status === 'fully_paid' && unit.handover_ready;
            console.log('isEligible:', isEligible, 'payment_status:', unit.payment_status, 'handover_ready:', unit.handover_ready);
            
            const eligibleUnit = eligibleUnits?.find(eu => eu.id === selectedUnitId);
            const hasBooking = eligibleUnit?.has_booking;
            console.log('hasBooking:', hasBooking);
            
            // Only show calendar if unit is eligible and not booked
            if (!isEligible || hasBooking) {
              console.log('Returning null: not eligible or has booking');
              return null;
            }
            
            console.log('Showing calendar!');
            return (
            <>
              {/* Owner Attendance Confirmation */}
              {isOwnerAttending === null && (
                <div className="space-y-4 mb-8">
                  <h3 className="text-xl md:text-2xl font-bold">Will you be attending the handover in person?</h3>
                  <p className="text-gray-600">Please confirm if you will personally attend the handover appointment or if an attorney will represent you.</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button
                      onClick={() => {
                        setIsOwnerAttending(true);
                        setPoaDocument(null);
                        setAttorneyIdDocument(null);
                      }}
                      className="p-6 border-2 border-gray-300 rounded-lg hover:border-black hover:bg-gray-50 transition-all text-left"
                    >
                      <div className="flex items-start gap-3">
                        <CheckCircle className="w-6 h-6 text-green-600 mt-1" />
                        <div>
                          <h4 className="font-semibold text-lg mb-2">Yes, I/We will attend</h4>
                          <p className="text-sm text-gray-600">I/We confirm that I/we will personally attend the handover appointment</p>
                        </div>
                      </div>
                    </button>

                    <button
                      onClick={() => setIsOwnerAttending(false)}
                      className="p-6 border-2 border-gray-300 rounded-lg hover:border-black hover:bg-gray-50 transition-all text-left"
                    >
                      <div className="flex items-start gap-3">
                        <AlertCircle className="w-6 h-6 text-orange-600 mt-1" />
                        <div>
                          <h4 className="font-semibold text-lg mb-2">No, attorney will attend</h4>
                          <p className="text-sm text-gray-600">An authorized attorney will attend on my/our behalf (POA required)</p>
                        </div>
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {/* POA Document Upload */}
              {isOwnerAttending === false && (
                <div className="space-y-4 mb-8 p-6 border-2 border-orange-200 bg-orange-50 rounded-lg">
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <AlertCircle className="w-6 h-6 text-orange-600" />
                    Required Documents for Attorney Representation
                  </h3>
                  <p className="text-sm text-gray-700 mb-4">
                    Since you won't be attending personally, please upload the following documents. Your booking will be pending approval until these documents are reviewed by our team.
                  </p>

                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="poa-upload" className="text-base font-semibold">Power of Attorney (POA) Document *</Label>
                      <p className="text-xs text-gray-600 mb-2">Accepted formats: PDF, JPG, PNG (Max 10MB)</p>
                      <input
                        id="poa-upload"
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => setPoaDocument(e.target.files?.[0] || null)}
                        className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-black file:text-white hover:file:bg-gray-800 file:cursor-pointer"
                      />
                      {poaDocument && (
                        <p className="text-sm text-green-600 mt-2 flex items-center gap-2">
                          <CheckCircle className="w-4 h-4" />
                          {poaDocument.name}
                        </p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="attorney-id-upload" className="text-base font-semibold">Attorney's ID Document *</Label>
                      <p className="text-xs text-gray-600 mb-2">Accepted formats: PDF, JPG, PNG (Max 10MB)</p>
                      <input
                        id="attorney-id-upload"
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) => setAttorneyIdDocument(e.target.files?.[0] || null)}
                        className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-black file:text-white hover:file:bg-gray-800 file:cursor-pointer"
                      />
                      {attorneyIdDocument && (
                        <p className="text-sm text-green-600 mt-2 flex items-center gap-2">
                          <CheckCircle className="w-4 h-4" />
                          {attorneyIdDocument.name}
                        </p>
                      )}
                    </div>

                    <button
                      onClick={() => {
                        setIsOwnerAttending(null);
                        setPoaDocument(null);
                        setAttorneyIdDocument(null);
                      }}
                      className="text-sm text-gray-600 hover:text-black underline"
                    >
                      ← Go back and select a different option
                    </button>
                  </div>
                </div>
              )}

              {/* Calendar - only show after owner attendance confirmation */}
              {isOwnerAttending !== null && (
              <div className="flex justify-center py-3 md:py-6">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => {
                    if (date) {
                      // Create date at noon Dubai time to avoid timezone boundary issues
                      // Get the date components as they appear in the calendar (Dubai date)
                      const year = date.getFullYear();
                      const month = date.getMonth();
                      const day = date.getDate();
                      
                      // Create a new date with these components at noon
                      const dubaiDate = new Date(year, month, day, 12, 0, 0);
                      
                      console.log('Calendar selected - year:', year, 'month:', month + 1, 'day:', day);
                      console.log('Dubai date created:', dubaiDate);
                      console.log('Dubai date components:', dubaiDate.getFullYear(), dubaiDate.getMonth() + 1, dubaiDate.getDate());
                      
                      setSelectedDate(dubaiDate);
                    } else {
                      setSelectedDate(undefined);
                    }
                  }}
                  className="rounded-lg border border-gray-200 p-3 md:p-6 md:scale-110"
                  modifiers={{
                    booked: (date) => bookedDates.includes(date.toDateString()),
                  }}
                  modifiersStyles={{
                    booked: {
                      backgroundColor: "#f3f4f6",
                      fontWeight: "bold",
                    },
                  }}
                  disabled={(date) => {
                    // Disable all dates if POA is required but documents not uploaded
                    if (isOwnerAttending === false && (!poaDocument || !attorneyIdDocument)) {
                      return true;
                    }
                    
                    // Disable past dates
                    if (date < new Date(new Date().setHours(0, 0, 0, 0))) return true;
                    
                    // Block today and the next 3 days (4 days blocked total)
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const earliestBookableDate = new Date(today);
                    earliestBookableDate.setDate(earliestBookableDate.getDate() + 4);
                    
                    // Set maximum bookable date: 4th blocked day + 30 days
                    const maxBookableDate = new Date(today);
                    maxBookableDate.setDate(maxBookableDate.getDate() + 4 + 30); // Day after 4 blocked days + 30 days
                    
                    // Disable dates before the earliest bookable date
                    const checkDate = new Date(date);
                    checkDate.setHours(0, 0, 0, 0);
                    if (checkDate < earliestBookableDate) {
                      return true;
                    }
                    
                    // Disable dates after the max bookable date (30 day cap)
                    if (checkDate > maxBookableDate) {
                      return true;
                    }
                    
                    return false;
                  }}
                />
              </div>
              )}

              {/* Time Slots */}
              {isOwnerAttending !== null && (
              <div className="space-y-3 md:space-y-5">
                <Label className="flex items-center gap-2 text-lg md:text-xl">
                  <Clock className="w-5 h-5 md:w-6 md:h-6" />
                  Available Time Slots
                </Label>
                {isOwnerAttending === false && (!poaDocument || !attorneyIdDocument) ? (
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-center">
                    <p className="text-sm text-orange-800">Please upload both POA and Attorney ID documents to select a time slot</p>
                  </div>
                ) : (
                <div className="grid grid-cols-3 md:grid-cols-4 gap-2 md:gap-3">
                  {TIME_SLOTS.map((time) => {
                    const isAvailable = availableSlots.includes(time);
                    const isSelected = selectedTime === time;
                    return (
                      <button
                        key={time}
                        type="button"
                        onClick={() => isAvailable && selectedDate && setSelectedTime(time)}
                        disabled={!selectedDate || !isAvailable}
                        className={`
                          px-3 py-2 md:px-4 md:py-3 rounded-lg font-medium transition-all text-sm md:text-base
                          ${isSelected 
                            ? 'bg-black text-white' 
                            : !isAvailable
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed line-through' 
                            : 'bg-white border border-gray-300 hover:border-black hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed'}
                        `}
                      >
                        {time}
                      </button>
                    );
                  })}
                </div>
                )}
              </div>
              )}

              {isOwnerAttending !== null && (
              <>
              {bookingError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-red-800">Booking Error</p>
                      <p className="text-sm text-red-700 mt-1">{bookingError}</p>
                    </div>
                  </div>
                </div>
              )}

              <Button
                onClick={handleCreateBooking}
                disabled={!selectedDate || !selectedTime || !selectedUnitId || isBooking || (isOwnerAttending === false && (!poaDocument || !attorneyIdDocument))}
                className="w-full bg-black hover:bg-gray-800 text-white py-5 md:py-7 text-base md:text-lg mt-4"
              >
                {isBooking ? 'Creating Booking...' : isOwnerAttending === false ? 'Submit for Approval' : 'Confirm Handover Appointment'}
              </Button>
              </>
              )}
            </>
            );
          })()}
        </div>
      </div>

      {/* Right Side - Property & User Details (Desktop Only) */}
      <div className="hidden md:flex flex-[0.3] bg-black text-white p-8 flex-col justify-between overflow-y-auto">
        <div>
          <DetailsPanel />
        </div>
      </div>

      {/* Thank You Modal */}
      <Dialog open={showThankYou} onOpenChange={setShowThankYou}>
        <DialogContent className="border border-gray-200">
          <DialogHeader>
            <div className="mx-auto w-16 h-16 bg-black rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="w-10 h-10 text-white" />
            </div>
            <DialogTitle className="text-center text-2xl">{confirmedBooking?.isPending ? 'Submitted for Approval' : 'Thank You!'}</DialogTitle>
            <DialogDescription className="text-center space-y-4 pt-4">
              {confirmedBooking?.isPending ? (
                <>
                  <p className="text-base text-gray-700">
                    Your handover appointment request has been submitted successfully.
                  </p>
                  <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                    <p className="text-sm font-semibold text-orange-800 mb-2">
                      <AlertCircle className="w-5 h-5 inline mr-2" />
                      Pending POA Approval
                    </p>
                    <p className="text-sm text-gray-700">
                      Your Power of Attorney documents are currently under review. You will receive a confirmation email once your documents have been approved.
                    </p>
                  </div>
                  {confirmedBooking && (
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                      <p className="text-sm text-gray-600 mb-2">
                        <strong className="text-black">{confirmedBooking.project}</strong>
                        <br />
                        Unit {confirmedBooking.unit}
                      </p>
                      <p className="font-semibold text-black">
                        {format(confirmedBooking.date, "EEEE, MMMM d, yyyy")}
                      </p>
                      <p className="text-gray-600 mt-1 flex items-center justify-center gap-1">
                        <Clock className="w-4 h-4" />
                        {confirmedBooking.time}
                      </p>
                    </div>
                  )}
                  <p className="text-sm text-gray-600">
                    This appointment is pending approval. We'll contact you at <strong>{userEmail}</strong> once reviewed.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-base text-gray-700">
                    Your handover appointment has been successfully scheduled.
                  </p>
                  {confirmedBooking && (
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                      <p className="text-sm text-gray-600 mb-2">
                        <strong className="text-black">{confirmedBooking.project}</strong>
                        <br />
                        Unit {confirmedBooking.unit}
                      </p>
                      <p className="font-semibold text-black">
                        {format(confirmedBooking.date, "EEEE, MMMM d, yyyy")}
                      </p>
                      <p className="text-gray-600 mt-1 flex items-center justify-center gap-1">
                        <Clock className="w-4 h-4" />
                        {confirmedBooking.time}
                      </p>
                    </div>
                  )}
                  <p className="text-sm text-gray-600">
                    A confirmation email has been sent to <strong>{userEmail}</strong>
                  </p>
                  <p className="text-sm text-gray-600">
                    Please bring a valid ID and any required documentation to your appointment.
                  </p>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <Button 
            onClick={() => setShowThankYou(false)} 
            className="w-full bg-black hover:bg-gray-800 text-white"
          >
            Close
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}