'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

interface CarCardProps {
  car: {
    id: number;
    make: string;
    model: string;
    year: number;
    plate: string;
    color: string;
    daily_rate: number;
    status: 'available' | 'rented' | 'maintenance';
    customer_name?: string;
    paid?: boolean;
    start_date?: string;
  };
  index: number;
}

const CarCard: React.FC<CarCardProps> = ({ car, index }) => {
  const router = useRouter();
  const [isHovered, setIsHovered] = useState(false);
  const [imageError, setImageError] = useState(false);

  const getStatusColor = () => {
    switch (car.status) {
      case 'available':
        return 'status-available';
      case 'rented':
        return 'status-rented';
      case 'maintenance':
        return 'status-maintenance';
      default:
        return 'status-available';
    }
  };

  const getStatusText = () => {
    switch (car.status) {
      case 'available':
        return 'Available';
      case 'rented':
        return 'Rented';
      case 'maintenance':
        return 'Maintenance';
      default:
        return 'Available';
    }
  };

  const getPaymentStatusColor = () => {
    return car.paid ? 'status-paid' : 'status-pending';
  };

  const getPaymentStatusText = () => {
    return car.paid ? 'Paid' : 'Pending';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getCarImage = () => {
    // Use a placeholder car image service with car make/model
    const make = car.make.toLowerCase().replace(/\s+/g, '');
    const model = car.model.toLowerCase().replace(/\s+/g, '');
    return `https://via.placeholder.com/300x200/667eea/ffffff?text=${car.make}%20${car.model}`;
  };

  const handleCardClick = () => {
    router.push(`/cars/${car.id}`);
  };

  return (
    <div
      className={`card-animated animate-slide-in-up cursor-pointer transform transition-all duration-300 hover:scale-105`}
      style={{
        animationDelay: `${index * 0.1}s`,
      }}
      onClick={handleCardClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Card Header with Status */}
      <div className="relative overflow-hidden rounded-t-2xl">
        {/* Status Badge */}
        <div className={`absolute top-4 right-4 z-10 px-3 py-1 rounded-full text-white text-xs font-bold ${getStatusColor()} animate-pulse-slow`}>
          {getStatusText()}
        </div>

        {/* Payment Status Badge (if rented) */}
        {car.status === 'rented' && (
          <div className={`absolute top-4 left-4 z-10 px-3 py-1 rounded-full text-white text-xs font-bold ${getPaymentStatusColor()}`}>
            {getPaymentStatusText()}
          </div>
        )}

        {/* Car Image */}
        <div className="relative h-48 overflow-hidden bg-gradient-to-br from-purple-100 to-pink-100">
          {!imageError ? (
            <img
              src={getCarImage()}
              alt={`${car.make} ${car.model}`}
              className={`w-full h-full object-cover transition-transform duration-500 ${isHovered ? 'scale-110' : 'scale-100'}`}
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-200 to-pink-200">
              <div className="text-center">
                <div className="text-4xl mb-2">🚗</div>
                <p className="text-sm font-semibold text-gray-700">{car.make} {car.model}</p>
              </div>
            </div>
          )}

          {/* Gradient Overlay */}
          <div className={`absolute inset-0 bg-gradient-to-t from-black/50 to-transparent transition-opacity duration-300 ${isHovered ? 'opacity-100' : 'opacity-60'}`} />
        </div>
      </div>

      {/* Card Content */}
      <div className="p-6 space-y-4">
        {/* Car Info */}
        <div>
          <h3 className="text-xl font-bold text-gradient mb-1">
            {car.year} {car.make} {car.model}
          </h3>
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span className="flex items-center">
              <span className="inline-block w-3 h-3 bg-gray-400 rounded-full mr-2"></span>
              {car.plate}
            </span>
            <span className="flex items-center">
              <span 
                className="inline-block w-3 h-3 rounded-full mr-2" 
                style={{ backgroundColor: car.color.toLowerCase() }}
              ></span>
              {car.color}
            </span>
          </div>
        </div>

        {/* Customer Info (if rented) */}
        {car.status === 'rented' && car.customer_name && (
          <div className="bg-purple-50 rounded-lg p-3 animate-slide-in-up">
            <p className="text-sm font-semibold text-purple-900">
              👤 {car.customer_name}
            </p>
            {car.start_date && (
              <p className="text-xs text-purple-700">
                Since {formatDate(car.start_date)}
              </p>
            )}
          </div>
        )}

        {/* Price */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xl font-bold text-gradient">${car.daily_rate}</p>
            <p className="text-xs text-gray-500">per day</p>
          </div>
          
          {/* Quick Action Button */}
          <div className={`transition-all duration-300 ${isHovered ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>
            <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center text-white shadow-lg">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
        </div>

        {/* Hover Effect Line */}
        <div className={`h-1 gradient-primary rounded-full transition-all duration-300 ${isHovered ? 'w-full' : 'w-0'}`} />
      </div>

      {/* Animated Border Effect */}
      {isHovered && (
        <div className="absolute inset-0 rounded-2xl animate-glow pointer-events-none" />
      )}
    </div>
  );
};

export default CarCard;