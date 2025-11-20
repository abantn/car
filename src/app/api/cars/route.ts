import { NextRequest, NextResponse } from 'next/server';
import { initializeDatabase, runQuery, allQuery, getQuery, Car } from '@/lib/database';

// Initialize database on first request
let dbInitialized = false;
async function ensureDb() {
  if (!dbInitialized) {
    await initializeDatabase();
    dbInitialized = true;
  }
}

// GET all cars with current rental status
export async function GET(request: NextRequest) {
  try {
    await ensureDb();
    
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    
    let query = `
      SELECT c.*,
        CASE 
          WHEN r.id IS NOT NULL AND r.status = 'active' THEN 'rented'
          ELSE c.status
        END as current_status,
        r.id as rental_id,
        r.customer_id,
        r.start_date,
        r.paid,
        cust.name as customer_name
      FROM cars c
      LEFT JOIN rentals r ON c.id = r.car_id AND r.status = 'active'
      LEFT JOIN customers cust ON r.customer_id = cust.id
    `;
    
    const params: any[] = [];
    
    if (status) {
      query += ` WHERE c.status = ? OR (r.status = 'active' AND ? = 'rented')`;
      params.push(status, status);
    }
    
    query += ` ORDER BY c.created_at DESC`;
    
    const cars = await allQuery(query, params);
    
    return NextResponse.json({
      success: true,
      data: cars.map(car => ({
        ...car,
        status: car.current_status || car.status
      }))
    });
    
  } catch (error) {
    console.error('Error fetching cars:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch cars' },
      { status: 500 }
    );
  }
}

// POST create new car
export async function POST(request: NextRequest) {
  try {
    await ensureDb();
    
    const body = await request.json();
    const {
      make,
      model,
      year,
      plate,
      color,
      daily_rate = 50.0,
      km_rate = 0.25,
      km_included_per_day = 200
    } = body;
    
    // Validate required fields
    if (!make || !model || !year || !plate || !color) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: make, model, year, plate, color' },
        { status: 400 }
      );
    }
    
    // Check if plate already exists
    const existingCar = await getQuery('SELECT id FROM cars WHERE plate = ?', [plate]);
    if (existingCar) {
      return NextResponse.json(
        { success: false, error: 'Car with this license plate already exists' },
        { status: 400 }
      );
    }
    
    const result = await runQuery(
      `INSERT INTO cars (make, model, year, plate, color, daily_rate, km_rate, km_included_per_day)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [make, model, year, plate, color, daily_rate, km_rate, km_included_per_day]
    );
    
    // Return the created car
    const newCar = await getQuery('SELECT * FROM cars WHERE id = ?', [result.id]);
    
    return NextResponse.json({
      success: true,
      data: newCar
    });
    
  } catch (error) {
    console.error('Error creating car:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create car' },
      { status: 500 }
    );
  }
}

// PATCH update cars (bulk update)
export async function PATCH(request: NextRequest) {
  try {
    await ensureDb();
    
    const body = await request.json();
    const { carIds, updates } = body;
    
    if (!carIds || !Array.isArray(carIds) || !updates) {
      return NextResponse.json(
        { success: false, error: 'Invalid request format' },
        { status: 400 }
      );
    }
    
    // Build dynamic update query
    const updateFields = Object.keys(updates)
      .map(key => `${key} = ?`)
      .join(', ');
    
    const updateValues = Object.values(updates);
    
    const placeholders = carIds.map(() => '?').join(',');
    const query = `UPDATE cars SET ${updateFields}, updated_at = CURRENT_TIMESTAMP WHERE id IN (${placeholders})`;
    
    await runQuery(query, [...updateValues, ...carIds]);
    
    return NextResponse.json({
      success: true,
      message: `${carIds.length} cars updated successfully`
    });
    
  } catch (error) {
    console.error('Error updating cars:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update cars' },
      { status: 500 }
    );
  }
}