// Configuration and Constants for Warehouse Analysis Dashboard

// Fixed parameters
const WAREHOUSE_PALLETS = 600;  // warehouse capacity
const PALLETS_PER_TRUCK = 26;   // truck_capacity
const PACKAGING_MAX_SEC_PER_BUNDLE = 35;  // packaging_speed_maximum_seconds (30s + 5s buffer needed between packs otherwise packaging gets overwhelmed ))
const PRODUCT_DIST_RATIO = 0.99; // 16OC Product Ratio
const PRODUCT_DIST_PERCENT = PRODUCT_DIST_RATIO * 100; // 16OC Product Ratio in percent
const NUM_POINTS = 25; // Number of data points for chart lines
const HOURS_VARIATION_SPAN = 1.5; // The span for production hours variations
const KG_PER_PALLET = 100; // kg of wool per pallet

// production speed correction factors
const PLASTIC_CHANGEOVER_SPEED_FACTOR = 0.05; // includes changeover time for plastic
const MACHINE_DOWNTIME_SPEED_FACTOR = 0.2;  // includes breaks, jams, maintenance, sharpener adjustment

// Calculate packaging speed
const PRODUCTION_REDUCE_SPEED_FACTOR = 1 - PLASTIC_CHANGEOVER_SPEED_FACTOR - MACHINE_DOWNTIME_SPEED_FACTOR;  
const PACKAGING_MAX_BUNDLES_PER_HR = (60 / PACKAGING_MAX_SEC_PER_BUNDLE) * 60;
const PACKAGING_ACTUAL_BUNDLES_PER_HR = PACKAGING_MAX_BUNDLES_PER_HR * PRODUCTION_REDUCE_SPEED_FACTOR;

// Fixed revenue targets
const REVENUE_TARGETS = [250000.0, 500000.0, 750000.0, 1000000.0];

// Product data
const PRODUCT_DATA = {
    '16OC': { pallet_capacity: 24 },  // bundles/pallet
    '24OC': { pallet_capacity: 12 }   // bundles/pallet
};

// Chart colors - similar to plasma colormap
const CHART_COLORS = [
    'rgba(13, 8, 135, 1)',
    'rgba(85, 48, 140, 1)',
    'rgba(156, 48, 109, 1)',
    'rgba(208, 70, 58, 1)',
    'rgba(241, 127, 14, 1)'
];

// Revenue target colors
const REVENUE_COLORS = [
    'rgba(255, 204, 102, 1)',
    'rgba(255, 153, 51, 1)',
    'rgba(204, 51, 0, 1)',
    'rgba(153, 0, 0, 1)'
];
