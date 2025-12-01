# dataset_v4.py
import random
import pandas as pd
import numpy as np

# ---------------------------
# 1. CATEGORY → REAL MERCHANTS
# ---------------------------

MERCHANTS = {
    "grocery": [
    "Whole Foods", "Trader Joe's", "Safeway", "Kroger", "Publix", "Aldi",
    "Costco", "H-E-B", "Wegmans", "Food Lion", "Meijer", "Giant Eagle",
    "Stop & Shop", "Vons", "Ralphs", "King Soopers", "Fred Meyer",
    "WinCo Foods", "Sprouts Farmers Market", "Shaw's", "Albertsons",
    "Hy-Vee", "Piggly Wiggly", "Food 4 Less", "Hannaford", "Market Basket",
    "Save-A-Lot", "Smart & Final", "Harris Teeter", "Price Chopper",
    "SuperValu", "Festival Foods", "Weis Markets", "Big Y", "Smith’s",
    "Food City", "Grocery Outlet", "Brookshire’s", "Stater Bros"
],

"retail": [
    "Target", "Walmart", "IKEA", "Home Depot", "Lowe’s", "Best Buy",
    "Kohl’s", "JC Penney", "Sears", "Macy’s", "Nordstrom", "Costco",
    "Menards", "TJ Maxx", "Marshalls", "Ross Dress for Less", "Bed Bath & Beyond",
    "Dollar General", "Dollar Tree", "Family Dollar", "Staples", "Office Depot",
    "PetSmart", "Petco", "Bath & Body Works", "Old Navy", "Gap",
    "Banana Republic", "The Container Store", "Ace Hardware", "Big Lots",
    "Dillard’s", "Bloomingdale’s", "REI", "Dick’s Sporting Goods",
    "Academy Sports", "GameStop", "Barnes & Noble", "Ulta Beauty", "Sephora",
    "Sam’s Club", "BJ’s Wholesale", "Five Below", "Hobby Lobby", "Michael’s",
    "JoAnn Fabrics", "Ashley Furniture", "Rooms To Go", "Harbor Freight"
],
"electronics": [
    "Apple Store", "Samsung Store", "Best Buy", "Microsoft Store",
    "Micro Center", "GameStop", "B&H Photo Video", "Fry’s Electronics",
    "Staples", "OfficeMax", "Guitar Center", "Crutchfield"
],
    "clothing": [
    "Nike", "Adidas", "Puma", "Under Armour", "Zara", "H&M", "Uniqlo",
    "American Eagle", "Hollister", "Abercrombie", "Lululemon", "Victoria’s Secret",
    "Pink", "Forever 21", "Urban Outfitters", "Anthropologie", "Levi’s",
    "Guess", "Coach", "Michael Kors", "Kate Spade", "Ralph Lauren", 
    "Tommy Hilfiger", "Express", "Banana Republic", "Gap", "J.Crew",
    "Brooks Brothers", "Columbia Sportswear", "The North Face", "Timberland",
    "Aerie", "Champion", "Aritzia", "Superdry", "Diesel"
],
"coffee": [
    "Starbucks", "Dunkin", "Peet’s Coffee", "Philz Coffee", "Dutch Bros",
    "Tim Hortons", "Caribou Coffee", "Blue Bottle Coffee",
    "The Coffee Bean & Tea Leaf", "Intelligentsia Coffee",
    "Stumptown Coffee Roasters", "Joe Coffee", "Lavazza",
    "Gloria Jean’s", "Biggby Coffee", "Scooter’s Coffee",
    "Black Rock Coffee Bar", "Caffe Nero"
],
"restaurant": [
    "McDonalds", "Burger King", "Wendy’s", "Chipotle", "Taco Bell",
    "KFC", "Popeyes", "Subway", "Jersey Mike’s", "Panera Bread",
    "Buffalo Wild Wings", "Domino’s", "Pizza Hut", "Papa John’s",
    "Olive Garden", "Chilis", "Applebee’s", "Red Lobster",
    "Outback Steakhouse", "Texas Roadhouse", "Cheesecake Factory",
    "In-N-Out", "Five Guys", "Shake Shack", "Raising Cane’s",
    "Whataburger", "Jack in the Box", "Zaxby’s", "Del Taco",
    "Noodles & Company", "Qdoba", "Wingstop", "Cracker Barrel",
    "IHOP", "Denny’s", "Waffle House", "Bob Evans", "Carrabba’s",
    "LongHorn Steakhouse", "Moe’s Southwest Grill", "Firehouse Subs",
    "Jimmy John’s", "Cold Stone Creamery", "Baskin Robbins"
],
"gas": [
    "Shell Gas", "Chevron", "Exxon", "BP", "Sunoco", "Circle K",
    "Speedway", "7-Eleven", "Mobil", "Texaco", "Arco", "Valero",
    "Phillips 66", "Wawa Gas", "QuikTrip", "Royal Farms",
    "Casey’s", "Kwik Trip", "RaceTrac", "Pilot Gas", "Flying J",
    "Sheetz", "Love’s Travel Stop"
],
    "clothing": [
        "Nike", "Zara", "H&M", "Uniqlo", "Lululemon", "Adidas Store"
    ],
"travel": [
    "Delta Airlines", "American Airlines", "United Airlines", "Southwest Airlines",
    "JetBlue", "Alaska Airlines", "Spirit Airlines", "Frontier Airlines",
    "Hilton Hotel", "Holiday Inn", "Marriott", "Hyatt", "Sheraton",
    "Four Seasons", "Ritz Carlton", "Motel 6", "Red Roof Inn",
    "Uber", "Lyft", "Avis Rental", "Hertz", "Enterprise", "Budget Rent-A-Car",
    "Greyhound", "Amtrak", "TSA PreCheck", "Airbnb", "VRBO"
]
,
"pharmacy": [
    "CVS", "Walgreens", "Rite Aid", "HealthMart", "Good Neighbor Pharmacy",
    "Walmart Pharmacy", "Safeway Pharmacy", "Kroger Pharmacy",
    "Costco Pharmacy", "Publix Pharmacy"
]

}

# Add 300+ more merchants for realism (expandable)
for _ in range(300):
    MERCHANTS["retail"].append(f"Store_{_}")
    MERCHANTS["restaurant"].append(f"FoodPlace_{_}")
    MERCHANTS["clothing"].append(f"ClothingShop_{_}")

# ---------------------------
# 2. FAKE/UNKNOWN MERCHANTS
# ---------------------------
def random_fake_merchant():
    patterns = [
        "crypto_pay_{}",
        "xxxx_vendor_{}",
        "fastcash_{}",
        "bitpay_{}",
        "unknown_shop_{}",
        "transfer_llc_{}",
        "fraud_inc_{}",
        "merchant_{}",
        "qwejio_{}",
        "randomco_{}"
    ]
    return random.choice(patterns).format(random.randint(1000, 99999))


# ---------------------------
# 3. CATEGORY PRICE RANGES
# ---------------------------
PRICE_RANGES = {
    "grocery": (10, 200),
    "retail": (15, 500),
    "electronics": (100, 3000),
    "coffee": (3, 15),
    "gas": (20, 120),
    "restaurant": (8, 60),
    "clothing": (25, 300),
    "travel": (50, 2000),
    "pharmacy": (10, 150)
}

# ---------------------------
# 4. FRAUD RISK BY CATEGORY
# ---------------------------
CATEGORY_RISK = {
    "grocery": 0.1,
    "retail": 0.2,
    "electronics": 0.6,
    "coffee": 0.05,
    "gas": 0.15,
    "restaurant": 0.1,
    "clothing": 0.2,
    "travel": 0.4,
    "pharmacy": 0.1
}

# ---------------------------
# 5. GENERATE ROWS
# ---------------------------

def sigmoid(x):
    return 1 / (1 + np.exp(-x))

def generate_row():
    category = random.choice(list(MERCHANTS.keys()))

    # Real or fake merchant?
    if random.random() < 0.80:
        merchant = random.choice(MERCHANTS[category])
        known = True
    else:
        merchant = random_fake_merchant()
        known = False

    # Amount
    low, high = PRICE_RANGES[category]
    amount = round(random.uniform(low, high), 2)

    # Distance from home (category-aware)
    if category == "travel":
        distance = random.uniform(50, 2000)
    else:
        distance = random.uniform(0, 40)

    # Time-of-day
    hour = random.randint(0, 23)
    is_night = hour < 5

    # Fraud scoring model (balanced signal)
    logit = 0.0
    # Amount normalized by category cap
    logit += (amount / high) * 1.0
    # Distance: larger boost when far
    if category == "travel":
        logit += (distance / 500) * 1.5
        if distance > 1000:
            logit += 1.0
    else:
        logit += (distance / 40) * 1.5
        if distance > 80:
            logit += 1.0
    # Category baseline risk
    logit += CATEGORY_RISK[category] * 1.5
    # Unknown/suspicious merchant
    if not known:
        logit += 2.0
    # Nighttime penalty
    if is_night:
        logit += 0.5
    # Shift down to avoid saturating to all fraud
    logit -= 2.5

    # Convert logit → probability
    prob = sigmoid(logit)

    # Label: Bernoulli draw from prob
    is_fraud = 1 if random.random() < prob else 0

    return {
        "merchant": merchant,
        "category": category,
        "amount": amount,
        "distance_from_home": round(distance, 3),
        "hour": hour,
        "is_night": int(is_night),
        "is_known_merchant": int(known),
        "fraud_probability": prob,
        "is_fraud": is_fraud
    }

# ---------------------------
# 6. GENERATE FULL DATASET
# ---------------------------

TARGET_ROWS = 500000

print("Generating dataset_v4…")
rows = [generate_row() for _ in range(TARGET_ROWS)]
df = pd.DataFrame(rows)
df.to_csv("synthetic_dataset_v4.csv", index=False)
print("DONE → synthetic_dataset_v4.csv")
print("Fraud rate:", df["is_fraud"].mean())
