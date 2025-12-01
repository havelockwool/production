from http.server import BaseHTTPRequestHandler
import json
import math

# Fixed parameters
WAREHOUSE_PALLETS = 600
PALLETS_PER_TRUCK = 26
PACKAGING_MAX_SEC_PER_BUNDLE = 30
PRODUCTION_REDUCE_SPEED_FACTOR = 0.8
PRODUCT_DIST_RATIO = 0.7
NUM_POINTS = 20
HOURS_VARIATION_SPAN = 1.5
KG_PER_PALLET = 100

PACKAGING_MAX_BUNDLES_PER_HR = (60 / PACKAGING_MAX_SEC_PER_BUNDLE) * 60
PACKAGING_ACTUAL_BUNDLES_PER_HR = PACKAGING_MAX_BUNDLES_PER_HR * PRODUCTION_REDUCE_SPEED_FACTOR

REVENUE_TARGETS = [250000.0, 500000.0, 750000.0, 1000000.0]

PRODUCT_DATA = {
    '16OC': {'pallet_capacity': 24},
    '24OC': {'pallet_capacity': 12}
}

def linspace(start, stop, num):
    if num <= 1:
        return [start]
    step = (stop - start) / (num - 1)
    return [round(start + step * i, 2) for i in range(num)]

def interpolate(x_values, y_values, x_new):
    left_index = 0
    while left_index < len(x_values) - 1 and x_values[left_index] < x_new:
        left_index += 1

    if left_index == 0:
        left_index = 1

    right_index = left_index
    left_index = left_index - 1

    x_left = x_values[left_index]
    x_right = x_values[right_index]
    y_left = y_values[left_index]
    y_right = y_values[right_index]

    slope = (y_right - y_left) / (x_right - x_left)
    return y_left + slope * (x_new - x_left)

def calculate_warehouse_analysis(params):
    production_hrs_per_day = params['productionHrsPerDay']
    production_days_per_week = params['productionDaysPerWeek']
    orders_min = params['ordersMin']
    orders_max = params['ordersMax']
    avg_bundle_cost = params['avgBundleCost']
    avg_pallets_per_order = params['avgPalletsPerOrder']

    product_dist = {
        '16OC': PRODUCT_DIST_RATIO,
        '24OC': 1 - PRODUCT_DIST_RATIO
    }

    base_hours = production_hrs_per_day
    hours_variations = [
        base_hours + HOURS_VARIATION_SPAN * 0,
        base_hours + HOURS_VARIATION_SPAN * 1,
        base_hours + HOURS_VARIATION_SPAN * 2,
        base_hours + HOURS_VARIATION_SPAN * 3,
        base_hours + HOURS_VARIATION_SPAN * 4,
    ]
    hours_variations = [max(0.1, h) for h in hours_variations]

    orders_per_week_values = linspace(orders_min, orders_max, NUM_POINTS)

    pallet_cost = avg_bundle_cost * PRODUCT_DATA['16OC']['pallet_capacity']
    revenue_target_pallets = [target / pallet_cost / 4 for target in REVENUE_TARGETS]

    master_data = []

    for hours in hours_variations:
        production_hours_per_week = hours * production_days_per_week

        max_16oc_pallets = (PACKAGING_ACTUAL_BUNDLES_PER_HR * production_hours_per_week *
                           product_dist['16OC']) / PRODUCT_DATA['16OC']['pallet_capacity']

        max_24oc_pallets = (PACKAGING_ACTUAL_BUNDLES_PER_HR * production_hours_per_week *
                           product_dist['24OC']) / PRODUCT_DATA['24OC']['pallet_capacity']

        total_production_pallets = max_16oc_pallets + max_24oc_pallets

        for orders in orders_per_week_values:
            outbound_pallets_per_week = orders * avg_pallets_per_order
            capacity_ratio = total_production_pallets / outbound_pallets_per_week
            warehouse_turnover_weeks = WAREHOUSE_PALLETS / outbound_pallets_per_week

            master_data.append({
                'productionHours': hours,
                'ordersPerWeek': orders,
                'productionHoursPerWeek': production_hours_per_week,
                'outboundPalletsPerWeek': outbound_pallets_per_week,
                'totalProductionPallets': total_production_pallets,
                'capacityRatio': capacity_ratio,
                'warehouseTurnoverWeeks': warehouse_turnover_weeks
            })

    # Calculate balanced points
    balanced_points = []
    for hours in hours_variations:
        scenario_data = [d for d in master_data if d['productionHours'] == hours]
        scenario_data.sort(key=lambda x: x['capacityRatio'])

        total_prod = scenario_data[0]['totalProductionPallets']
        balanced_order = None
        balanced_pallets = None
        balanced_revenue = None

        min_ratio = min(d['capacityRatio'] for d in scenario_data)
        max_ratio = max(d['capacityRatio'] for d in scenario_data)

        if min_ratio <= 1.0 <= max_ratio:
            lower_index = 0
            while lower_index < len(scenario_data) - 1 and scenario_data[lower_index]['capacityRatio'] < 1.0:
                lower_index += 1

            if lower_index > 0:
                lower_point = scenario_data[lower_index - 1]
                upper_point = scenario_data[lower_index]

                balanced_order = interpolate(
                    [lower_point['capacityRatio'], upper_point['capacityRatio']],
                    [lower_point['ordersPerWeek'], upper_point['ordersPerWeek']],
                    1.0
                )

                balanced_pallets = balanced_order * avg_pallets_per_order
                balanced_revenue = balanced_pallets * pallet_cost * 4

        balanced_points.append({
            'productionHours': hours,
            'balancedRevenue': balanced_revenue,
            'balancedOrders': balanced_order,
            'balancedPallets': balanced_pallets
        })

    # Revenue target analysis
    revenue_analysis = []
    for i, target in enumerate(REVENUE_TARGETS):
        target_pallets = revenue_target_pallets[i]
        target_orders = target_pallets / avg_pallets_per_order

        target_analysis_list = []
        for hours in hours_variations:
            scenario_data = [d for d in master_data if d['productionHours'] == hours]
            total_prod = scenario_data[0]['totalProductionPallets']
            capacity_ratio = total_prod / target_pallets
            diff = total_prod - target_pallets
            diff_orders = diff / avg_pallets_per_order

            production_hours_per_week = hours * production_days_per_week
            total_bundles_per_week = PACKAGING_ACTUAL_BUNDLES_PER_HR * production_hours_per_week
            monthly_revenue = total_bundles_per_week * avg_bundle_cost * 4

            target_analysis_list.append({
                'productionHours': hours,
                'totalProduction': total_prod,
                'capacityRatioToTarget': capacity_ratio,
                'diffPallets': diff,
                'diffOrders': diff_orders,
                'monthlyRevenue': monthly_revenue
            })

        revenue_analysis.append({
            'target': target,
            'targetPallets': target_pallets,
            'targetOrders': target_orders,
            'analysis': target_analysis_list
        })

    return {
        'masterData': master_data,
        'hoursVariations': hours_variations,
        'ordersPerWeekValues': orders_per_week_values,
        'palletCost': pallet_cost,
        'revenueTargetPallets': revenue_target_pallets,
        'balancedPoints': balanced_points,
        'revenueAnalysis': revenue_analysis,
        'constants': {
            'productDistPercent': PRODUCT_DIST_RATIO * 100,
            'kgPerPallet': KG_PER_PALLET
        }
    }

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)
        params = json.loads(post_data.decode('utf-8'))

        result = calculate_warehouse_analysis(params)

        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()

        self.wfile.write(json.dumps(result).encode())
        return

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
        return
