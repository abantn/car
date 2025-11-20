import { Rental, Car } from './database';
import { differenceInDays, parseISO } from 'date-fns';

export interface ChargeBreakdown {
  daily_charges: number;
  km_charges: number;
  damage_fees: number;
  total_charges: number;
  rental_days: number;
  total_km: number;
  included_km: number;
  extra_km: number;
  daily_rate: number;
  km_rate: number;
}

export interface InvoiceDetails {
  rental: Rental;
  car: Car;
  breakdown: ChargeBreakdown;
  customer_name: string;
  charges_summary: {
    description: string;
    amount: number;
    quantity: number;
    unit_price: number;
  }[];
}

export function calculateRentalDays(startDate: string, endDate?: string): number {
  const end = endDate ? parseISO(endDate) : new Date();
  const start = parseISO(startDate);
  
  // Calculate days difference, rounding up to handle partial days
  const days = differenceInDays(end, start);
  return Math.max(1, days + 1); // Minimum 1 day
}

export function calculateKMCharges(
  startKm: number,
  endKm: number,
  includedKmPerDay: number,
  rentalDays: number,
  kmRate: number
): { totalKm: number; includedKm: number; extraKm: number; kmCharges: number } {
  const totalKm = endKm - startKm;
  const includedKm = includedKmPerDay * rentalDays;
  const extraKm = Math.max(0, totalKm - includedKm);
  const kmCharges = extraKm * kmRate;
  
  return { totalKm, includedKm, extraKm, kmCharges };
}

export function calculateDailyCharges(dailyRate: number, rentalDays: number): number {
  return dailyRate * rentalDays;
}

export function calculateTotalRentalCost(
  rental: Rental,
  car: Car,
  endKm?: number
): ChargeBreakdown {
  const rentalDays = calculateRentalDays(rental.start_date, rental.end_date);
  const dailyCharges = calculateDailyCharges(rental.daily_rate, rentalDays);
  
  let kmCharges = 0;
  let totalKm = 0;
  let includedKm = car.km_included_per_day * rentalDays;
  let extraKm = 0;
  
  if (endKm !== undefined) {
    const kmCalculation = calculateKMCharges(
      rental.start_km,
      endKm,
      car.km_included_per_day,
      rentalDays,
      car.km_rate
    );
    totalKm = kmCalculation.totalKm;
    includedKm = kmCalculation.includedKm;
    extraKm = kmCalculation.extraKm;
    kmCharges = kmCalculation.kmCharges;
  }
  
  const damageFees = 0; // Would be calculated based on damages table
  
  const totalCharges = dailyCharges + kmCharges + damageFees;
  
  return {
    daily_charges: dailyCharges,
    km_charges: kmCharges,
    damage_fees: damageFees,
    total_charges: totalCharges,
    rental_days: rentalDays,
    total_km: totalKm,
    included_km: includedKm,
    extra_km: extraKm,
    daily_rate: rental.daily_rate,
    km_rate: car.km_rate
  };
}

export function generateInvoice(
  rental: Rental,
  car: Car,
  customerName: string,
  endKm?: number
): InvoiceDetails {
  const breakdown = calculateTotalRentalCost(rental, car, endKm);
  
  const chargesSummary = [
    {
      description: 'Daily Rental Charges',
      amount: breakdown.daily_charges,
      quantity: breakdown.rental_days,
      unit_price: breakdown.daily_rate
    }
  ];
  
  if (breakdown.km_charges > 0) {
    chargesSummary.push({
      description: 'Extra KM Charges',
      amount: breakdown.km_charges,
      quantity: breakdown.extra_km,
      unit_price: breakdown.km_rate
    });
  }
  
  if (breakdown.damage_fees > 0) {
    chargesSummary.push({
      description: 'Damage Repair Fees',
      amount: breakdown.damage_fees,
      quantity: 1,
      unit_price: breakdown.damage_fees
    });
  }
  
  return {
    rental,
    car,
    breakdown,
    customer_name: customerName,
    charges_summary: chargesSummary
  };
}

export function formatCurrency(amount: number, currency: string = '$'): string {
  return `${currency}${amount.toFixed(2)}`;
}

export function calculateStorageUsage(videos: { file_size: number }[]): {
  totalSize: number;
  totalSizeMB: number;
  totalSizeGB: number;
} {
  const totalSize = videos.reduce((sum, video) => sum + video.file_size, 0);
  const totalSizeMB = totalSize / (1024 * 1024);
  const totalSizeGB = totalSize / (1024 * 1024 * 1024);
  
  return {
    totalSize,
    totalSizeMB,
    totalSizeGB
  };
}

export function calculateVideoDeletionDate(
  recordedAt: string,
  daysToKeep: number = 30
): string {
  const date = new Date(recordedAt);
  date.setDate(date.getDate() + daysToKeep);
  return date.toISOString();
}

export function getTimeUntilDeletion(deleteAfterDate: string): {
  days: number;
  hours: number;
  minutes: number;
  isExpired: boolean;
  formatted: string;
} {
  const now = new Date();
  const deletionDate = new Date(deleteAfterDate);
  
  const isExpired = deletionDate <= now;
  
  if (isExpired) {
    return {
      days: 0,
      hours: 0,
      minutes: 0,
      isExpired: true,
      formatted: 'Expired'
    };
  }
  
  const diffMs = deletionDate.getTime() - now.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  
  let formatted = '';
  if (days > 0) formatted += `${days}d `;
  if (hours > 0 || days > 0) formatted += `${hours}h `;
  formatted += `${minutes}m`;
  
  return {
    days,
    hours,
    minutes,
    isExpired: false,
    formatted: formatted.trim()
  };
}