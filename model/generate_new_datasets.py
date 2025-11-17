"""Generate new fraud detection datasets with different data for testing."""

import csv
import random
import hashlib
import time
from datetime import datetime, timedelta

# Categories and merchants from the original data
CATEGORIES = [
    'misc_net', 'grocery_pos', 'entertainment', 'gas_transport', 'misc_pos',
    'grocery_net', 'shopping_net', 'shopping_pos', 'food_dining', 'personal_care',
    'health_fitness', 'travel', 'kids_pets', 'home', 'general_merchandise'
]

MERCHANTS = [
    'fraud_Kirlin and Sons', 'fraud_Sporer-Keebler', 'fraud_Swaniawski, Nitzsche and Welch',
    'fraud_Haley Group', 'fraud_Johnston-Casper', 'fraud_Daugherty LLC',
    'fraud_Romaguera Ltd', 'fraud_Reichel LLC', 'fraud_Goyette, Howell and Collier',
    'fraud_Rippin, Kub and Mann', 'fraud_Heller, Gutmann and Zieme', 'fraud_Lind-Buckridge',
    'fraud_Kutch, Hermiston and Farrell', 'fraud_New Merchant Co', 'fraud_Global Retail Inc'
]

FIRST_NAMES = ['James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda',
               'William', 'Elizabeth', 'David', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica',
               'Thomas', 'Sarah', 'Charles', 'Karen', 'Christopher', 'Nancy', 'Daniel', 'Lisa',
               'Matthew', 'Betty', 'Anthony', 'Margaret', 'Mark', 'Sandra', 'Donald', 'Ashley',
               'Steven', 'Kimberly', 'Paul', 'Emily', 'Andrew', 'Donna', 'Joshua', 'Michelle']

LAST_NAMES = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
              'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Wilson', 'Anderson', 'Thomas',
              'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Thompson', 'White', 'Harris',
              'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker', 'Young', 'Allen',
              'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores', 'Green', 'Adams']

JOBS = [
    'Software engineer', 'Data scientist', 'Product manager', 'Marketing director',
    'Sales representative', 'Accountant', 'Teacher', 'Nurse', 'Doctor', 'Lawyer',
    'Consultant', 'Designer', 'Engineer', 'Manager', 'Analyst', 'Developer',
    'Executive', 'Director', 'Coordinator', 'Specialist'
]

US_STATES = ['AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN',
             'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV',
             'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN',
             'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY']

CITIES = {
    'AL': [('Birmingham', 33.5207, -86.8025, 212237), ('Montgomery', 32.3668, -86.3000, 200603)],
    'CA': [('Los Angeles', 34.0522, -118.2437, 3971883), ('San Francisco', 37.7749, -122.4194, 873965)],
    'NY': [('New York', 40.7128, -74.0060, 8336817), ('Buffalo', 42.8864, -78.8784, 276807)],
    'TX': [('Houston', 29.7604, -95.3698, 2320268), ('Dallas', 32.7767, -96.7970, 1343573)],
    'FL': [('Miami', 25.7617, -80.1918, 442241), ('Tampa', 27.9506, -82.4572, 384959)],
}

def generate_cc_num():
    """Generate a random credit card number."""
    return str(random.randint(1000000000000000, 9999999999999999))

def generate_trans_num():
    """Generate a random transaction number (hex)."""
    return hashlib.md5(str(random.random()).encode()).hexdigest()

def generate_timestamp(start_date, end_date):
    """Generate a random timestamp between start and end dates."""
    time_between = end_date - start_date
    days_between = time_between.days
    random_days = random.randrange(days_between)
    random_seconds = random.randrange(86400)
    return start_date + timedelta(days=random_days, seconds=random_seconds)

def generate_dob():
    """Generate a random date of birth (age 18-80)."""
    end_date = datetime.now() - timedelta(days=365*18)
    start_date = datetime.now() - timedelta(days=365*80)
    return generate_timestamp(start_date, end_date)

def generate_merchant_location(lat, lon):
    """Generate merchant location near user location."""
    # Add small random offset (within ~50km)
    offset_lat = random.uniform(-0.5, 0.5)
    offset_lon = random.uniform(-0.5, 0.5)
    return lat + offset_lat, lon + offset_lon

def generate_row(index, start_date, end_date, fraud_rate=0.001):
    """Generate a single row of fraud detection data with realistic fraud patterns."""
    is_fraud = 1 if random.random() < fraud_rate else 0
    
    # Generate person data
    first = random.choice(FIRST_NAMES)
    last = random.choice(LAST_NAMES)
    gender = random.choice(['M', 'F'])
    dob = generate_dob()
    
    # Generate location
    state = random.choice(US_STATES)
    if state in CITIES:
        city, lat, lon, city_pop = random.choice(CITIES[state])
    else:
        city = f"City{random.randint(1, 100)}"
        lat = random.uniform(25.0, 49.0)
        lon = random.uniform(-125.0, -66.0)
        city_pop = random.randint(1000, 1000000)
    
    zip_code = random.randint(10000, 99999)
    street = f"{random.randint(1, 9999)} {random.choice(['Main', 'Oak', 'Park', 'Maple', 'Cedar'])} St"
    
    # Generate transaction data with fraud patterns
    cc_num = generate_cc_num()
    merchant = random.choice(MERCHANTS)
    category = random.choice(CATEGORIES)
    
    # Realistic fraud patterns
    if is_fraud:
        # Fraud transactions have specific characteristics:
        # 1. Higher amounts (70% chance of high amount)
        if random.random() < 0.7:
            amt = random.uniform(500, 10000)  # Higher amounts
        else:
            amt = random.uniform(50, 500)  # Some smaller fraud attempts
        
        # 2. More likely to occur at night (40% chance)
        if random.random() < 0.4:
            hour = random.choice([0, 1, 2, 3, 4, 5, 6, 22, 23])  # Night/early morning
        else:
            hour = random.randint(0, 23)
        
        # 3. Merchant location far from user (fraudsters use distant merchants)
        # Generate merchant far away (50-500km)
        distance_km = random.uniform(50, 500)
        # Convert distance to lat/lon offset (rough approximation: 1 degree ≈ 111km)
        offset_deg = distance_km / 111.0
        angle = random.uniform(0, 2 * 3.14159)  # Random direction
        merch_lat = lat + offset_deg * random.uniform(0.5, 1.5) * (1 if random.random() > 0.5 else -1)
        merch_lon = lon + offset_deg * random.uniform(0.5, 1.5) * (1 if random.random() > 0.5 else -1)
        # Keep within US bounds
        merch_lat = max(25.0, min(49.0, merch_lat))
        merch_lon = max(-125.0, min(-66.0, merch_lon))
        
        # 4. Certain categories more associated with fraud
        fraud_categories = ['misc_net', 'grocery_pos', 'shopping_net', 'misc_pos']
        if random.random() < 0.6:
            category = random.choice(fraud_categories)
    else:
        # Legitimate transactions
        # Normal amount distribution
        if random.random() < 0.8:
            amt = random.uniform(1, 200)  # Most transactions are small
        else:
            amt = random.uniform(200, 2000)  # Some larger purchases
        
        # Normal time distribution (less likely at night)
        if random.random() < 0.15:  # Only 15% at night
            hour = random.choice([0, 1, 2, 3, 4, 5, 6, 22, 23])
        else:
            hour = random.randint(7, 21)  # Daytime hours
        
        # Merchant location close to user (normal shopping)
        merch_lat, merch_lon = generate_merchant_location(lat, lon)
    
    # Generate timestamp with the determined hour
    trans_time = generate_timestamp(start_date, end_date)
    # Adjust hour while keeping the same date
    trans_time = trans_time.replace(hour=hour, minute=random.randint(0, 59), second=random.randint(0, 59))
    unix_time = int(trans_time.timestamp())
    
    trans_num = generate_trans_num()
    job = random.choice(JOBS)
    
    return [
        index,
        trans_time.strftime('%Y-%m-%d %H:%M:%S'),
        cc_num,
        merchant,
        category,
        round(amt, 2),
        first,
        last,
        gender,
        street,
        city,
        state,
        zip_code,
        round(lat, 4),
        round(lon, 4),
        city_pop,
        job,
        dob.strftime('%Y-%m-%d'),
        trans_num,
        unix_time,
        round(merch_lat, 6),
        round(merch_lon, 6),
        is_fraud
    ]

def generate_dataset(output_file, num_rows, start_date, end_date, fraud_rate=0.001):
    """Generate a complete dataset."""
    header = [
        '', 'trans_date_trans_time', 'cc_num', 'merchant', 'category', 'amt',
        'first', 'last', 'gender', 'street', 'city', 'state', 'zip', 'lat', 'long',
        'city_pop', 'job', 'dob', 'trans_num', 'unix_time', 'merch_lat', 'merch_long', 'is_fraud'
    ]
    
    print(f"Generating {num_rows} rows for {output_file}...")
    
    with open(output_file, 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(header)
        
        for i in range(num_rows):
            if (i + 1) % 10000 == 0:
                print(f"  Progress: {i + 1}/{num_rows} rows ({100 * (i + 1) / num_rows:.1f}%)")
            row = generate_row(i, start_date, end_date, fraud_rate)
            writer.writerow(row)
    
    print(f"Completed {output_file}")

if __name__ == '__main__':
    # Generate new training set (similar size to original: ~1.3M rows)
    # Using different date range: 2021-2022
    train_start = datetime(2021, 1, 1)
    train_end = datetime(2022, 12, 31, 23, 59, 59)
    generate_dataset('fraudTrain_new.csv', 1296676, train_start, train_end, fraud_rate=0.001)
    
    # Generate new test set (similar size to original: ~555K rows)
    # Using different date range: 2023
    test_start = datetime(2023, 1, 1)
    test_end = datetime(2023, 12, 31, 23, 59, 59)
    generate_dataset('fraudTest_new.csv', 555720, test_start, test_end, fraud_rate=0.001)
    
    print("\nDone! Generated fraudTrain_new.csv and fraudTest_new.csv")

