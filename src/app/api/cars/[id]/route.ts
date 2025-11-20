import { NextRequest, NextResponse } from 'next/server';
import { initializeDatabase, runQuery, allQuery, getQuery } from '@/lib/database';
import { calculateTotalRentalCost, generateInvoice } from '@/lib/calculations';

// Initialize database on first request
let dbInitialized = false;
async function ensureDb() {
  if (!dbInitialized) {
    await initializeDatabase();
    dbInitialized = true;
  }
}

interface RouteParams {
  params: {
    id: string;
  };
}

// GET detailed car information
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await ensureDb();
    
    const carId = params.id;
    
    // Get car details
    const car = await getQuery('SELECT * FROM cars WHERE id = ?', [carId]);
    if (!car) {
      return NextResponse.json(
        { success: false, error: 'Car not found' },
        { status: 404 }
      );
    }
    
    // Get current rental
    const currentRental = await getQuery(`
      SELECT r.*, c.name as customer_name, c.phone, c.email
      FROM rentals r
      JOIN customers c ON r.customer_id = c.id
      WHERE r.car_id = ? AND r.status = 'active'
      ORDER BY r.start_date DESC
      LIMIT 1
    `, [carId]);
    
    // Get rental history
    const rentalHistory = await allQuery(`
      SELECT r.*, c.name as customer_name
      FROM rentals r
      JOIN customers c ON r.customer_id = c.id
      WHERE r.car_id = ? AND r.status != 'active'
      ORDER BY r.start_date DESC
      LIMIT 10
    `, [carId]);
    
    // Get damages
    const damages = await allQuery(`
      SELECT d.*, r.id as rental_id
      FROM damages d
      LEFT JOIN rentals r ON d.rental_id = r.id
      WHERE d.car_id = ?
      ORDER BY d.reported_date DESC
    `, [carId]);
    
    // Get videos for current rental
    let videos: any[] = [];
    if (currentRental) {
      videos = await allQuery(`
        SELECT * FROM videos
        WHERE car_id = ? AND (rental_id = ? OR rental_id IS NULL)
        ORDER BY recorded_at DESC
      `, [carId, currentRental.id]);
    }
    
    // Get ID verification for current rental
    let idVerification: any = null;
    if (currentRental) {
      idVerification = await getQuery(`
        SELECT * FROM id_verifications
        WHERE rental_id = ? OR (customer_id = ? AND rental_id IS NULL)
        ORDER BY created_at DESC
        LIMIT 1
      `, [currentRental.id, currentRental.customer_id]);
    }
    
    const response = {
      success: true,
      data: {
        car,
        current_rental: currentRental,
        rental_history: rentalHistory,
        damages,
        videos,
        id_verification: idVerification
      }
    };
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('Error fetching car details:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch car details' },
      { status: 500 }
    );
  }
}

// PATCH update car or process return
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    await ensureDb();
    
    const carId = params.id;
    const body = await request.json();
    const { action, ...updates } = body;
    
    // Verify car exists
    const car = await getQuery('SELECT * FROM cars WHERE id = ?', [carId]);
    if (!car) {
      return NextResponse.json(
        { success: false, error: 'Car not found' },
        { status: 404 }
      );
    }
    
    if (action === 'process_return') {
      // Process car return
      const { rental_id, end_km, end_date = new Date().toISOString() } = updates;
      
      if (!rental_id || end_km === undefined) {
        return NextResponse.json(
          { success: false, error: 'Missing rental_id or end_km for return processing' },
          { status: 400 }
        );
      }
      
      // Get rental details
      const rental = await getQuery('SELECT * FROM rentals WHERE id = ? AND car_id = ?', [rental_id, carId]);
      if (!rental) {
        return NextResponse.json(
          { success: false, error: 'Rental not found' },
          { status: 404 }
        );
      }
      
      // Calculate charges
      const chargeBreakdown = calculateTotalRentalCost(rental, car, end_km);
      
      // Update rental
      await runQuery(`
        UPDATE rentals 
        SET end_km = ?, end_date = ?, km_charges = ?, total_amount = ?, 
            status = 'completed', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [end_km, end_date, chargeBreakdown.km_charges, chargeBreakdown.total_charges, rental_id]);
      
      // Update car status to available
      await runQuery(`
        UPDATE cars 
        SET status = 'available', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [carId]);
      
      return NextResponse.json({
        success: true,
        data: {
          message: 'Car return processed successfully',
          charge_breakdown: chargeBreakdown,
          total_amount: chargeBreakdown.total_charges
        }
      });
      
    } else if (action === 'update_rates') {
      // Update car rates
      const { daily_rate, km_rate, km_included_per_day } = updates;
      
      await runQuery(`
        UPDATE cars 
        SET daily_rate = ?, km_rate = ?, km_included_per_day = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [daily_rate, km_rate, km_included_per_day, carId]);
      
      const updatedCar = await getQuery('SELECT * FROM cars WHERE id = ?', [carId]);
      
      return NextResponse.json({
        success: true,
        data: updatedCar
      });
      
    } else if (action === 'update_status') {
      // Update car status
      const { status } = updates;
      
      await runQuery(`
        UPDATE cars 
        SET status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [status, carId]);
      
      return NextResponse.json({
        success: true,
        message: 'Car status updated successfully'
      });
      
    } else {
      // General car update
      const allowedUpdates = ['make', 'model', 'year', 'plate', 'color'];
      const updateFields = [];
      const updateValues = [];
      
      for (const field of allowedUpdates) {
        if (updates[field] !== undefined) {
          updateFields.push(`${field} = ?`);
          updateValues.push(updates[field]);
        }
      }
      
      if (updateFields.length === 0) {
        return NextResponse.json(
          { success: false, error: 'No valid fields to update' },
          { status: 400 }
        );
      }
      
      await runQuery(`
        UPDATE cars 
        SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [...updateValues, carId]);
      
      const updatedCar = await getQuery('SELECT * FROM cars WHERE id = ?', [carId]);
      
      return NextResponse.json({
        success: true,
        data: updatedCar
      });
    }
    
  } catch (error) {
    console.error('Error updating car:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update car' },
      { status: 500 }
    );
  }
}

// DELETE car (with safety checks)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    await ensureDb();
    
    const carId = params.id;
    
    // Check for active rentals
    const activeRental = await getQuery(
      'SELECT id FROM rentals WHERE car_id = ? AND status = \'active\'',
      [carId]
    );
    
    if (activeRental) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete car with active rental' },
        { status: 400 }
      );
    }
    
    // Delete related records (damages, videos, etc.)
    await runQuery('DELETE FROM damages WHERE car_id = ?', [carId]);
    await runQuery('DELETE FROM videos WHERE car_id = ?', [carId]);
    
    // Delete the car
    await runQuery('DELETE FROM cars WHERE id = ?', [carId]);
    
    return NextResponse.json({
      success: true,
      message: 'Car deleted successfully'
    });
    
  } catch (error) {
    console.error('Error deleting car:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete car' },
      { status: 500 }
    );
  }
}