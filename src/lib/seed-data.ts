import { initializeDatabase, runQuery } from './database';

export async function seedSampleData() {
  try {
    await initializeDatabase();
    console.log('Database initialized');

    // Sample cars
    const sampleCars = [
      {
        make: 'Toyota',
        model: 'Camry',
        year: 2023,
        plate: 'ABC-123',
        color: 'Silver',
        daily_rate: 75.0,
        km_rate: 0.25,
        km_included_per_day: 200,
        status: 'available'
      },
      {
        make: 'Honda',
        model: 'Civic',
        year: 2022,
        plate: 'XYZ-789',
        color: 'Blue',
        daily_rate: 65.0,
        km_rate: 0.20,
        km_included_per_day: 150,
        status: 'available'
      },
      {
        make: 'Tesla',
        model: 'Model 3',
        year: 2023,
        plate: 'ELE-456',
        color: 'Red',
        daily_rate: 120.0,
        km_rate: 0.30,
        km_included_per_day: 250,
        status: 'available'
      },
      {
        make: 'Ford',
        model: 'Mustang',
        year: 2022,
        plate: 'MUS-001',
        color: 'Black',
        daily_rate: 150.0,
        km_rate: 0.40,
        km_included_per_day: 100,
        status: 'rented'
      },
      {
        make: 'BMW',
        model: 'X5',
        year: 2023,
        plate: 'BMW-005',
        color: 'White',
        daily_rate: 200.0,
        km_rate: 0.35,
        km_included_per_day: 200,
        status: 'maintenance'
      }
    ];

    // Insert sample cars
    console.log('Inserting sample cars...');
    for (const car of sampleCars) {
      await runQuery(
        `INSERT INTO cars (make, model, year, plate, color, daily_rate, km_rate, km_included_per_day, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [car.make, car.model, car.year, car.plate, car.color, car.daily_rate, car.km_rate, car.km_included_per_day, car.status]
      );
    }

    // Sample customers
    const sampleCustomers = [
      { name: 'John Smith', phone: '555-0101', email: 'john.smith@email.com' },
      { name: 'Sarah Johnson', phone: '555-0102', email: 'sarah.j@email.com' },
      { name: 'Michael Davis', phone: '555-0103', email: 'm.davis@email.com' },
      { name: 'Emily Wilson', phone: '555-0104', email: 'emily.w@email.com' },
      { name: 'David Brown', phone: '555-0105', email: 'd.brown@email.com' }
    ];

    console.log('Inserting sample customers...');
    for (const customer of sampleCustomers) {
      await runQuery(
        'INSERT INTO customers (name, phone, email) VALUES (?, ?, ?)',
        [customer.name, customer.phone, customer.email]
      );
    }

    // Create a sample rental for the Mustang
    console.log('Creating sample rental...');
    await runQuery(
      `INSERT INTO rentals (car_id, customer_id, start_km, start_date, daily_rate, status, paid)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [4, 1, 15000, '2024-01-15T10:00:00Z', 150.0, 'active', false]
    );

    // Sample damages
    const sampleDamages = [
      {
        car_id: 4,
        rental_id: 1,
        description: 'Small scratch on passenger door',
        severity: 'minor',
        photo_url: null,
        status: 'reported'
      }
    ];

    console.log('Inserting sample damages...');
    for (const damage of sampleDamages) {
      await runQuery(
        `INSERT INTO damages (car_id, rental_id, description, severity, photo_url, status)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [damage.car_id, damage.rental_id, damage.description, damage.severity, damage.photo_url, damage.status]
      );
    }

    // Sample ID verification
    console.log('Creating sample ID verification...');
    await runQuery(
      `INSERT INTO id_verifications (customer_id, rental_id, license_front_url, license_back_url, verified_at)
       VALUES (?, ?, ?, ?, ?)`,
      [1, 1, '/uploads/photos/license_front_sample.jpg', '/uploads/photos/license_back_sample.jpg', '2024-01-15T10:30:00Z']
    );

    console.log('Sample data inserted successfully!');
    console.log(`
    Sample database created with:
    - 5 Cars (Toyota Camry, Honda Civic, Tesla Model 3, Ford Mustang, BMW X5)
    - 5 Customers
    - 1 Active Rental (Ford Mustang rented to John Smith)
    - 1 Damage Report
    - 1 ID Verification
    
    You can now start the development server and visit the dashboard!
    `);

  } catch (error) {
    console.error('Error seeding sample data:', error);
  }
}