'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

interface Car {
  id: number;
  make: string;
  model: string;
  year: number;
  plate: string;
  color: string;
  daily_rate: number;
  km_rate: number;
  km_included_per_day: number;
  status: string;
}

interface Rental {
  id: number;
  car_id: number;
  customer_id: number;
  start_km: number;
  end_km?: number;
  start_date: string;
  end_date?: string;
  daily_rate: number;
  km_charges: number;
  total_amount: number;
  status: string;
  paid: boolean;
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
}

interface Damage {
  id: number;
  car_id: number;
  rental_id?: number;
  description: string;
  severity: string;
  reported_date: string;
  repaired_date?: string;
  photo_url?: string;
  status: string;
}

interface Video {
  id: number;
  car_id: number;
  rental_id?: number;
  video_type: string;
  video_url: string;
  file_size: number;
  recorded_at: string;
  delete_after_date?: string;
}

interface IDVerification {
  id: number;
  customer_id: number;
  rental_id?: number;
  license_front_url?: string;
  license_back_url?: string;
  verified_at?: string;
  created_at: string;
}

export default function CarDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const carId = params.id as string;

  const [carData, setCarData] = useState<{
    car: Car;
    current_rental?: Rental;
    rental_history: Rental[];
    damages: Damage[];
    videos: Video[];
    id_verification?: IDVerification;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [showStartRentalModal, setShowStartRentalModal] = useState(false);
  const [showProcessReturnModal, setShowProcessReturnModal] = useState(false);

  // Fetch car details
  const fetchCarDetails = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/cars/${carId}`);
      const data = await response.json();

      if (data.success) {
        setCarData(data.data);
      } else {
        console.error('Failed to fetch car details:', data.error);
      }
    } catch (error) {
      console.error('Error fetching car details:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCarDetails();
  }, [carId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="loading-spinner mx-auto mb-4"></div>
          <p className="text-lg text-gradient font-semibold">Loading Car Details...</p>
        </div>
      </div>
    );
  }

  if (!carData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">❌</div>
          <h2 className="text-2xl font-bold text-gray-700 mb-2">Car Not Found</h2>
          <p className="text-gray-500 mb-4">The car you're looking for doesn't exist.</p>
          <button
            onClick={() => router.push('/')}
            className="btn-gradient px-6 py-2 text-white font-medium"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const { car, current_rental, rental_history, damages, videos, id_verification } = carData;

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'status-available';
      case 'rented': return 'status-rented';
      case 'maintenance': return 'status-maintenance';
      case 'reported': return 'status-pending';
      case 'repaired': return 'status-paid';
      default: return 'status-available';
    }
  };

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 animate-slide-in-down">
          <div>
            <button
              onClick={() => router.push('/')}
              className="text-purple-600 hover:text-purple-800 mb-4 flex items-center gap-2"
            >
              ← Back to Dashboard
            </button>
            <h1 className="text-4xl font-bold text-gradient mb-2">
              {car.year} {car.make} {car.model}
            </h1>
            <div className="flex items-center gap-4 text-gray-600">
              <span className="flex items-center gap-2">
                <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                {car.plate}
              </span>
              <span className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: car.color.toLowerCase() }}
                ></div>
                {car.color}
              </span>
              <span className={`px-3 py-1 rounded-full text-white text-xs font-bold ${getStatusColor(car.status)}`}>
                {car.status.toUpperCase()}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4">
            {car.status === 'available' && (
              <button
                onClick={() => setShowStartRentalModal(true)}
                className="btn-gradient px-6 py-3 text-white font-medium"
              >
                🚗 Start Rental
              </button>
            )}
            {car.status === 'rented' && current_rental && (
              <button
                onClick={() => setShowProcessReturnModal(true)}
                className="btn-gradient px-6 py-3 text-white font-medium"
              >
                🔑 Process Return
              </button>
            )}
          </div>
        </div>

        {/* Rate Information */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="card-animated p-6 animate-slide-in-up">
            <h3 className="text-lg font-semibold text-gray-700 mb-2">Daily Rate</h3>
            <p className="text-3xl font-bold text-gradient">${car.daily_rate}</p>
            <p className="text-sm text-gray-500">per day</p>
          </div>
          <div className="card-animated p-6 animate-slide-in-up" style={{ animationDelay: '0.1s' }}>
            <h3 className="text-lg font-semibold text-gray-700 mb-2">KM Rate</h3>
            <p className="text-3xl font-bold text-gradient">${car.km_rate}</p>
            <p className="text-sm text-gray-500">per extra km</p>
          </div>
          <div className="card-animated p-6 animate-slide-in-up" style={{ animationDelay: '0.2s' }}>
            <h3 className="text-lg font-semibold text-gray-700 mb-2">Included KM</h3>
            <p className="text-3xl font-bold text-gradient">{car.km_included_per_day}</p>
            <p className="text-sm text-gray-500">km per day</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-200">
          {['overview', 'current-rental', 'history', 'damages', 'media'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 font-medium transition-all duration-200 border-b-2 ${
                activeTab === tab
                  ? 'text-purple-600 border-purple-600'
                  : 'text-gray-500 border-transparent hover:text-gray-700'
              }`}
            >
              {tab.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="animate-fade-in">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Current Rental Summary */}
              {current_rental && (
                <div className="card-animated p-6">
                  <h2 className="text-2xl font-bold text-gradient mb-4">Current Rental</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <p className="text-sm text-gray-500">Customer</p>
                      <p className="font-semibold">{current_rental.customer_name}</p>
                      {current_rental.customer_phone && (
                        <p className="text-sm text-gray-600">{current_rental.customer_phone}</p>
                      )}
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Start Date</p>
                      <p className="font-semibold">{formatDate(current_rental.start_date)}</p>
                      <p className="text-sm text-gray-600">Starting KM: {current_rental.start_km}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <span className={`px-4 py-2 rounded-full text-white font-medium ${getStatusColor(current_rental.paid ? 'paid' : 'pending')}`}>
                      {current_rental.paid ? 'PAID' : 'PAYMENT PENDING'}
                    </span>
                    <button
                      onClick={() => setShowProcessReturnModal(true)}
                      className="btn-gradient px-6 py-2 text-white font-medium"
                    >
                      Process Return
                    </button>
                  </div>
                </div>
              )}

              {/* Quick Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="card-animated p-6 text-center">
                  <div className="text-3xl mb-2">📊</div>
                  <p className="text-2xl font-bold text-gradient">{rental_history.length}</p>
                  <p className="text-gray-600">Total Rentals</p>
                </div>
                <div className="card-animated p-6 text-center">
                  <div className="text-3xl mb-2">⚠️</div>
                  <p className="text-2xl font-bold text-gradient">{damages.length}</p>
                  <p className="text-gray-600">Damage Reports</p>
                </div>
                <div className="card-animated p-6 text-center">
                  <div className="text-3xl mb-2">🎥</div>
                  <p className="text-2xl font-bold text-gradient">{videos.length}</p>
                  <p className="text-gray-600">Videos</p>
                </div>
                <div className="card-animated p-6 text-center">
                  <div className="text-3xl mb-2">✅</div>
                  <p className="text-2xl font-bold text-gradient">
                    {id_verification ? 'Verified' : 'Not Verified'}
                  </p>
                  <p className="text-gray-600">ID Status</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'current-rental' && current_rental && (
            <div className="card-animated p-6">
              <h2 className="text-2xl font-bold text-gradient mb-6">Current Rental Details</h2>
              {/* Current rental details would go here */}
              <p className="text-gray-600">Detailed rental information will be displayed here.</p>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-gradient mb-6">Rental History</h2>
              {rental_history.length === 0 ? (
                <div className="card-animated p-8 text-center">
                  <div className="text-4xl mb-4">📋</div>
                  <p className="text-gray-500">No rental history available</p>
                </div>
              ) : (
                rental_history.map((rental) => (
                  <div key={rental.id} className="card-animated p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold">{rental.customer_name}</p>
                        <p className="text-sm text-gray-600">{formatDate(rental.start_date)}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">${rental.total_amount}</p>
                        <span className={`px-3 py-1 rounded-full text-white text-xs font-medium ${getStatusColor(rental.paid ? 'paid' : 'pending')}`}>
                          {rental.paid ? 'PAID' : 'PENDING'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'damages' && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-gradient mb-6">Damage Reports</h2>
              {damages.length === 0 ? (
                <div className="card-animated p-8 text-center">
                  <div className="text-4xl mb-4">✨</div>
                  <p className="text-gray-500">No damage reports - Car is in excellent condition!</p>
                </div>
              ) : (
                damages.map((damage) => (
                  <div key={damage.id} className="card-animated p-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-lg">{damage.description}</p>
                        <p className="text-sm text-gray-600">Reported: {formatDate(damage.reported_date)}</p>
                        <span className={`px-3 py-1 rounded-full text-white text-xs font-medium ${getStatusColor(damage.severity)}`}>
                          {damage.severity.toUpperCase()}
                        </span>
                      </div>
                      {damage.photo_url && (
                        <img src={damage.photo_url} alt="Damage" className="w-20 h-20 object-cover rounded-lg" />
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'media' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-gradient mb-6">Media Files</h2>
              
              {/* Videos Section */}
              <div>
                <h3 className="text-xl font-semibold mb-4">Videos</h3>
                {videos.length === 0 ? (
                  <div className="card-animated p-6 text-center">
                    <p className="text-gray-500">No videos uploaded</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {videos.map((video) => (
                      <div key={video.id} className="card-animated p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium capitalize">{video.video_type} Video</span>
                          <span className="text-sm text-gray-500">{formatFileSize(video.file_size)}</span>
                        </div>
                        <video src={video.video_url} className="w-full rounded-lg mb-2" controls />
                        <p className="text-xs text-gray-500">Recorded: {formatDate(video.recorded_at)}</p>
                        {video.delete_after_date && (
                          <p className="text-xs text-orange-600">Auto-delete: {formatDate(video.delete_after_date)}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ID Verification Section */}
              {id_verification && (
                <div>
                  <h3 className="text-xl font-semibold mb-4">ID Verification</h3>
                  <div className="card-animated p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {id_verification.license_front_url && (
                        <div>
                          <p className="font-medium mb-2">License Front</p>
                          <img src={id_verification.license_front_url} alt="License Front" className="w-full rounded-lg" />
                        </div>
                      )}
                      {id_verification.license_back_url && (
                        <div>
                          <p className="font-medium mb-2">License Back</p>
                          <img src={id_verification.license_back_url} alt="License Back" className="w-full rounded-lg" />
                        </div>
                      )}
                    </div>
                    {id_verification.verified_at && (
                      <p className="text-sm text-green-600 mt-4">
                        ✅ Verified on {formatDate(id_verification.verified_at)}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Placeholder for modals */}
      {(showStartRentalModal || showProcessReturnModal) && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
          <div className="card-glass p-8 max-w-md w-full mx-4 animate-slide-in-up">
            <h2 className="text-2xl font-bold text-gradient mb-4">
              {showStartRentalModal ? 'Start Rental' : 'Process Return'}
            </h2>
            <p className="text-gray-600 mb-6">
              This functionality will be implemented with form inputs for starting rentals or processing returns with charge calculations.
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => {
                  setShowStartRentalModal(false);
                  setShowProcessReturnModal(false);
                }}
                className="btn-gradient px-6 py-2 text-white font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}