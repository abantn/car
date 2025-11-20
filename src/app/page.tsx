'use client';

import React, { useState, useEffect } from 'react';
import CarCard from '@/components/CarCard';

interface Car {
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
}

export default function Home() {
  const [cars, setCars] = useState<Car[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showAddCarModal, setShowAddCarModal] = useState(false);

  // Fetch cars from API
  const fetchCars = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/cars');
      const data = await response.json();

      if (data.success) {
        setCars(data.data);
      } else {
        console.error('Failed to fetch cars:', data.error);
      }
    } catch (error) {
      console.error('Error fetching cars:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCars();
  }, []);

  // Filter cars based on search and status
  const filteredCars = cars.filter(car => {
    const matchesSearch = searchTerm === '' ||
      car.make.toLowerCase().includes(searchTerm.toLowerCase()) ||
      car.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
      car.plate.toLowerCase().includes(searchTerm.toLowerCase()) ||
      car.color.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = filterStatus === 'all' || car.status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  // Get statistics
  const stats = {
    total: cars.length,
    available: cars.filter(car => car.status === 'available').length,
    rented: cars.filter(car => car.status === 'rented').length,
    maintenance: cars.filter(car => car.status === 'maintenance').length,
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="loading-spinner mx-auto mb-4"></div>
          <p className="text-lg text-gradient font-semibold">Loading Cars...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto">
        <div className="animate-slide-in-down mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-gradient mb-4">
            Car Rental Dashboard
          </h1>
          <p className="text-gray-600 text-lg">
            Manage your car fleet with ease and style
          </p>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="card-animated p-6 animate-slide-in-up" style={{ animationDelay: '0.1s' }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">Total Cars</p>
                <p className="text-3xl font-bold text-gradient">{stats.total}</p>
              </div>
              <div className="w-12 h-12 rounded-full gradient-info flex items-center justify-center text-white">
                🚗
              </div>
            </div>
          </div>

          <div className="card-animated p-6 animate-slide-in-up" style={{ animationDelay: '0.2s' }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">Available</p>
                <p className="text-3xl font-bold text-green-600">{stats.available}</p>
              </div>
              <div className="w-12 h-12 rounded-full status-available flex items-center justify-center text-white">
                ✓
              </div>
            </div>
          </div>

          <div className="card-animated p-6 animate-slide-in-up" style={{ animationDelay: '0.3s' }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">Rented</p>
                <p className="text-3xl font-bold text-red-600">{stats.rented}</p>
              </div>
              <div className="w-12 h-12 rounded-full status-rented flex items-center justify-center text-white">
                🚙
              </div>
            </div>
          </div>

          <div className="card-animated p-6 animate-slide-in-up" style={{ animationDelay: '0.4s' }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">Maintenance</p>
                <p className="text-3xl font-bold text-yellow-600">{stats.maintenance}</p>
              </div>
              <div className="w-12 h-12 rounded-full status-maintenance flex items-center justify-center text-white">
                🔧
              </div>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="card-animated p-6 mb-8 animate-slide-in-up">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search by make, model, plate, or color..."
                className="input-glass w-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Status Filter */}
            <div className="flex gap-2">
              {['all', 'available', 'rented', 'maintenance'].map((status) => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                    filterStatus === status
                      ? 'btn-gradient text-white'
                      : 'bg-white/50 hover:bg-white/70 text-gray-700'
                  }`}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>

            {/* Add Car Button */}
            <button
              onClick={() => setShowAddCarModal(true)}
              className="btn-gradient px-6 py-2 text-white font-medium"
            >
              + Add Car
            </button>
          </div>
        </div>

        {/* Cars Grid */}
        {filteredCars.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No cars found</h3>
            <p className="text-gray-500">
              {searchTerm || filterStatus !== 'all'
                ? 'Try adjusting your search or filters'
                : 'Start by adding your first car to the fleet'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCars.map((car, index) => (
              <CarCard key={car.id} car={car} index={index} />
            ))}
          </div>
        )}
      </div>

      {/* Add Car Modal (placeholder) */}
      {showAddCarModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
          <div className="card-glass p-8 max-w-md w-full mx-4 animate-slide-in-up">
            <h2 className="text-2xl font-bold text-gradient mb-4">Add New Car</h2>
            <p className="text-gray-600 mb-6">
              This feature will be available soon. For now, you can add cars through the API.
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => setShowAddCarModal(false)}
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
