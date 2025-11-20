import { NextRequest, NextResponse } from 'next/server';
import { initializeDatabase, runQuery, allQuery, getQuery } from '@/lib/database';
import { calculateRentalDays } from '@/lib/calculations';

// Initialize database on first request
let dbInitialized = false;
async function ensureDb() {
  if (!dbInitialized) {
    await initializeDatabase();
    dbInitialized = true;
  }
}

// GET all rentals or rental history
export async function GET(request: NextRequest) {
  try {
    await ensureDb();
    
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // active, completed, cancelled
    const carId = searchParams.get('car_id');
    const customerId = searchParams.get('customer_id');
    
    let query = `
      SELECT r.*, 
             c.make as car_make, c.model as car_model, c.plate as car_plate, c.color as car_color,
             cust.name as customer_name, cust.phone as customer_phone, cust.email as customer_email
      FROM rentals r
      JOIN cars c ON r.car_id = c.id
      JOIN customers cust ON r.customer_id = cust.id
      WHERE 1=1
    `;
    
    const params: any[] = [];
    
    if (status) {
      query += ` AND r.status = ?`;
      params.push(status);
    }
    
    if (carId) {
      query += ` AND r.car_id = ?`;
      params.push(carId);
    }
    
    if (customerId) {
      query += ` AND r.customer_id = ?`;
      params.push(customerId);
    }
    
    query += ` ORDER BY r.start_date DESC`;
    
    const rentals = await allQuery(query, params);
    
    return NextResponse.json({
      success: true,
      data: rentals
    });
    
  } catch (error) {
    console.error('Error fetching rentals:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch rentals' },
      { status: 500 }
    );
  }
}

// POST create new rental
export async function POST(request: NextRequest) {
  try {
    await ensureDb();
    
    const body = await request.json();
    const {
      car_id,
      customer_id,
      start_km,
      start_date = new Date().toISOString(),
      daily_rate,
      customer_name,
      customer_phone,
      customer_email
    } = body;
    
    // Validate required fields
    if (!car_id || !customer_id || start_km === undefined || !daily_rate) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: car_id, customer_id, start_km, daily_rate' },
        { status: 400 }
      );
    }
    
    // Check if car exists and is available
    const car = await getQuery('SELECT * FROM cars WHERE id = ?', [car_id]);
    if (!car) {
      return NextResponse.json(
        { success: false, error: 'Car not found' },
        { status: 404 }
      );
    }
    
    // Check for active rental on this car
    const activeRental = await getQuery(
      'SELECT id FROM rentals WHERE car_id = ? AND status = \'active\'',
      [car_id]
    );
    
    if (activeRental) {
      return NextResponse.json(
        { success: false, error: 'Car is already rented' },
        { status: 400 }
      );
    }
    
    // Create or update customer
    let finalCustomerId = customer_id;
    if (customer_name) {
      // Check if customer exists
      const existingCustomer = await getQuery('SELECT id FROM customers WHERE id = ?', [customer_id]);
      
      if (existingCustomer) {
        // Update customer info
        await runQuery(
          'UPDATE customers SET name = ?, phone = ?, email = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [customer_name, customer_phone, customer_email, customer_id]
        );
      } else {
        // Create new customer
        const customerResult = await runQuery(
          'INSERT INTO customers (name, phone, email) VALUES (?, ?, ?)',
          [customer_name, customer_phone, customer_email]
        );
        finalCustomerId = customerResult.id;
      }
    }
    
    // Create rental
    const rentalResult = await runQuery(
      `INSERT INTO rentals (car_id, customer_id, start_km, start_date, daily_rate, status)
       VALUES (?, ?, ?, ?, ?, 'active')`,
      [car_id, finalCustomerId, start_km, start_date, daily_rate]
    );
    
    // Update car status to rented
    await runQuery(
      'UPDATE cars SET status = \'rented\', updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [car_id]
    );
    
    // Get the complete rental with car and customer info
    const newRental = await getQuery(`
      SELECT r.*, 
             c.make as car_make, c.model as car_model, c.plate as car_plate, c.color as car_color,
             cust.name as customer_name, cust.phone as customer_phone, cust.email as customer_email
      FROM rentals r
      JOIN cars c ON r.car_id = c.id
      JOIN customers cust ON r.customer_id = cust.id
      WHERE r.id = ?
    `, [rentalResult.id]);
    
    return NextResponse.json({
      success: true,
      data: newRental
    });
    
  } catch (error) {
    console.error('Error creating rental:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create rental' },
      { status: 500 }
    );
  }
}

// PATCH update rental
export async function PATCH(request: NextRequest) {
  try {
    await ensureDb();
    
    const body = await request.json();
    const { rental_id, action, ...updates } = body;
    
    if (!rental_id) {
      return NextResponse.json(
        { success: false, error: 'Missing rental_id' },
        { status: 400 }
      );
    }
    
    // Verify rental exists
    const rental = await getQuery('SELECT * FROM rentals WHERE id = ?', [rental_id]);
    if (!rental) {
      return NextResponse.json(
        { success: false, error: 'Rental not found' },
        { status: 404 }
      );
    }
    
    if (action === 'extend') {
      // Extend rental period
      const { new_end_date, additional_daily_rate } = updates;
      
      if (!new_end_date) {
        return NextResponse.json(
          { success: false, error: 'Missing new_end_date for extension' },
          { status: 400 }
        );
      }
      
      // Calculate additional days and charges
      const currentDays = calculateRentalDays(rental.start_date, rental.end_date);
      const totalDays = calculateRentalDays(rental.start_date, new_end_date);
      const additionalDays = totalDays - currentDays;
      
      const additionalCharges = additionalDays * (additional_daily_rate || rental.daily_rate);
      
      await runQuery(
        'UPDATE rentals SET end_date = ?, total_amount = total_amount + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [new_end_date, additionalCharges, rental_id]
      );
      
      return NextResponse.json({
        success: true,
        message: 'Rental extended successfully',
        additional_days: additionalDays,
        additional_charges: additionalCharges
      });
      
    } else if (action === 'cancel') {
      // Cancel rental
      await runQuery(
        'UPDATE rentals SET status = \'cancelled\', updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [rental_id]
      );
      
      // Update car status back to available
      await runQuery(
        'UPDATE cars SET status = \'available\', updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [rental.car_id]
      );
      
      return NextResponse.json({
        success: true,
        message: 'Rental cancelled successfully'
      });
      
    } else if (action === 'mark_paid') {
      // Mark rental as paid
      await runQuery(
        'UPDATE rentals SET paid = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [rental_id]
      );
      
      return NextResponse.json({
        success: true,
        message: 'Rental marked as paid'
      });
      
    } else {
      // General rental update
      const allowedUpdates = ['start_km', 'end_km', 'end_date', 'km_charges', 'total_amount'];
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
        UPDATE rentals 
        SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [...updateValues, rental_id]);
      
      const updatedRental = await getQuery('SELECT * FROM rentals WHERE id = ?', [rental_id]);
      
      return NextResponse.json({
        success: true,
        data: updatedRental
      });
    }
    
  } catch (error) {
    console.error('Error updating rental:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update rental' },
      { status: 500 }
    );
  }
}