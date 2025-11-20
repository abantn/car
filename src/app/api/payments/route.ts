import { NextRequest, NextResponse } from 'next/server';
import { initializeDatabase, runQuery, allQuery, getQuery } from '@/lib/database';
import { calculateTotalRentalCost, generateInvoice, formatCurrency } from '@/lib/calculations';

// Initialize database on first request
let dbInitialized = false;
async function ensureDb() {
  if (!dbInitialized) {
    await initializeDatabase();
    dbInitialized = true;
  }
}

// GET payment history or calculate charges
export async function GET(request: NextRequest) {
  try {
    await ensureDb();
    
    const { searchParams } = new URL(request.url);
    const rentalId = searchParams.get('rental_id');
    const calculate = searchParams.get('calculate'); // 'true' to calculate charges
    const endKm = searchParams.get('end_km');
    
    if (rentalId && calculate === 'true') {
      // Calculate charges for a specific rental
      const rental = await getQuery(`
        SELECT r.*, c.* 
        FROM rentals r
        JOIN cars c ON r.car_id = c.id
        WHERE r.id = ?
      `, [rentalId]);
      
      if (!rental) {
        return NextResponse.json(
          { success: false, error: 'Rental not found' },
          { status: 404 }
        );
      }
      
      const endKmValue = endKm ? parseInt(endKm) : undefined;
      const breakdown = calculateTotalRentalCost(rental, rental, endKmValue);
      
      // Get customer name
      const customer = await getQuery('SELECT name FROM customers WHERE id = ?', [rental.customer_id]);
      
      const invoice = generateInvoice(rental, rental, customer.name, endKmValue);
      
      return NextResponse.json({
        success: true,
        data: {
          rental_id: rentalId,
          charge_breakdown: breakdown,
          invoice: invoice,
          formatted_total: formatCurrency(breakdown.total_charges),
          calculation_details: {
            rental_days: breakdown.rental_days,
            daily_rate: breakdown.daily_rate,
            daily_charges: breakdown.daily_charges,
            km_used: breakdown.total_km,
            km_included: breakdown.included_km,
            extra_km: breakdown.extra_km,
            km_rate: breakdown.km_rate,
            km_charges: breakdown.km_charges
          }
        }
      });
    }
    
    // Get payment history
    let query = `
      SELECT r.*, 
             c.make as car_make, c.model as car_model, c.plate as car_plate,
             cust.name as customer_name,
             CASE WHEN r.paid = 1 THEN 'Paid' ELSE 'Pending' END as payment_status
      FROM rentals r
      JOIN cars c ON r.car_id = c.id
      JOIN customers cust ON r.customer_id = cust.id
    `;
    
    const params: any[] = [];
    
    if (rentalId) {
      query += ` WHERE r.id = ?`;
      params.push(rentalId);
    }
    
    if (searchParams.get('status')) {
      const status = searchParams.get('status');
      if (status === 'paid') {
        query += rentalId ? ` AND r.paid = 1` : ` WHERE r.paid = 1`;
      } else if (status === 'pending') {
        query += rentalId ? ` AND r.paid = 0` : ` WHERE r.paid = 0`;
      }
      params.push(rentalId);
    }
    
    query += ` ORDER BY r.start_date DESC`;
    
    const payments = await allQuery(query, params);
    
    // Calculate summary statistics
    const totalRevenue = payments
      .filter(p => p.paid)
      .reduce((sum, p) => sum + (p.total_amount || 0), 0);
    
    const pendingAmount = payments
      .filter(p => !p.paid)
      .reduce((sum, p) => sum + (p.total_amount || 0), 0);
    
    return NextResponse.json({
      success: true,
      data: payments,
      summary: {
        total_payments: payments.filter(p => p.paid).length,
        pending_payments: payments.filter(p => !p.paid).length,
        total_revenue: totalRevenue,
        pending_revenue: pendingAmount,
        formatted_total_revenue: formatCurrency(totalRevenue),
        formatted_pending_revenue: formatCurrency(pendingAmount)
      }
    });
    
  } catch (error) {
    console.error('Error fetching payments:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch payments' },
      { status: 500 }
    );
  }
}

// POST record payment
export async function POST(request: NextRequest) {
  try {
    await ensureDb();
    
    const body = await request.json();
    const {
      rental_id,
      amount,
      payment_method,
      payment_date = new Date().toISOString(),
      notes
    } = body;
    
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
    
    // Create payment record
    const paymentResult = await runQuery(
      `INSERT INTO payments (rental_id, amount, payment_method, payment_date, notes)
       VALUES (?, ?, ?, ?, ?)`,
      [rental_id, amount || rental.total_amount, payment_method, payment_date, notes]
    );
    
    // Mark rental as paid
    await runQuery(
      'UPDATE rentals SET paid = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [rental_id]
    );
    
    // Get updated rental with payment info
    const updatedRental = await getQuery(`
      SELECT r.*, 
             c.make as car_make, c.model as car_model, c.plate as car_plate,
             cust.name as customer_name
      FROM rentals r
      JOIN cars c ON r.car_id = c.id
      JOIN customers cust ON r.customer_id = cust.id
      WHERE r.id = ?
    `, [rental_id]);
    
    return NextResponse.json({
      success: true,
      data: {
        payment_id: paymentResult.id,
        rental: updatedRental,
        amount: amount || rental.total_amount,
        payment_method,
        message: 'Payment recorded successfully'
      }
    });
    
  } catch (error) {
    console.error('Error recording payment:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to record payment' },
      { status: 500 }
    );
  }
}