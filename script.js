//Additional Notes from Pete's spreadsheet
// - Avg. ordrer size: 3.75 pallets
// - order per truck: 7
// April 2025 had 63 orders

//SO,
// 150 orders/month
// 563 pallets/month
// 22 trucks/month
//5.4 trucks/week
//// requires running 7 hrs/day, 4.5 days/week
// 100 orders/month
// 3.6 trucks/week
// requires running 5.5 hrs/day, 4 days/week



// Fixed parameters
const WAREHOUSE_PALLETS = 700;  // warehouse capacity
const PALLETS_PER_TRUCK = 26;   // truck_capacity
const PACKAGING_MAX_SEC_PER_BUNDLE = 30;  // packaging_speed_maximum_seconds (recipe)
const PRODUCTION_REDUCE_SPEED_FACTOR = 0.8;  // buffer factor
const PRODUCT_DIST_RATIO = 0.7; // 16OC Product Ratio
const PRODUCT_DIST_PERCENT = PRODUCT_DIST_RATIO * 100; // 16OC Product Ratio in percent
const NUM_POINTS = 20; // Number of data points for chart lines
const HOURS_VARIATION_SPAN = 2.0; // The span for production hours variations
const KG_PER_PALLET = 100; // kg of wool per pallet

// Calculate packaging speed
const PACKAGING_MAX_BUNDLES_PER_HR = (60 / PACKAGING_MAX_SEC_PER_BUNDLE) * 60;
const PACKAGING_ACTUAL_BUNDLES_PER_HR = PACKAGING_MAX_BUNDLES_PER_HR * PRODUCTION_REDUCE_SPEED_FACTOR;

// Fixed revenue targets
const REVENUE_TARGETS = [250000.0, 500000.0, 750000.0, 1000000.0];

// Product data
const PRODUCT_DATA = {
    '16OC': { pallet_capacity: 24 },  // bundles/pallet
    '24OC': { pallet_capacity: 12 }   // bundles/pallet
};

// Connect sliders to value displays and update chart on change
document.querySelectorAll('input[type="range"]').forEach(slider => {
    const valueDisplay = document.getElementById(`${slider.id}-value`);
    if (valueDisplay) {
        const updateValue = () => {
            const step = parseFloat(slider.step);
            // Determine decimals from step value (e.g., 0.1 -> 1, 5 -> 0)
            const decimals = String(step).includes('.') ? String(step).split('.')[1].length : 0;
            valueDisplay.textContent = parseFloat(slider.value).toFixed(decimals);
        };
        // Set initial value on load
        updateValue();
        slider.addEventListener('input', () => {
            updateValue();
            // Update the chart whenever any slider changes
            updateWarehouseAnalysis();
        });
    }
});

// Generate linspace-like array (similar to numpy.linspace)
function linspace(start, stop, num) {
    // Handle edge case of only one point
    if (num <= 1) {
        return [start];
    }
    
    const step = (stop - start) / (num - 1);
    return Array.from({ length: num }, (_, i) => {
        const value = start + step * i;
        // Round to 2 decimal places to avoid floating point issues
        return Math.round(value * 100) / 100;
    });
}

// Linear interpolation function similar to scipy.interpolate.interp1d
function interpolate(xValues, yValues, xNew) {
    // Find the indices where xNew would fit in xValues
    let leftIndex = 0;
    while (leftIndex < xValues.length - 1 && xValues[leftIndex] < xNew) {
        leftIndex++;
    }
    
    if (leftIndex === 0) {
        leftIndex = 1; // Ensure we can interpolate
    }
    
    const rightIndex = leftIndex;
    leftIndex = leftIndex - 1;
    
    // Linear interpolation formula
    const xLeft = xValues[leftIndex];
    const xRight = xValues[rightIndex];
    const yLeft = yValues[leftIndex];
    const yRight = yValues[rightIndex];
    
    const slope = (yRight - yLeft) / (xRight - xLeft);
    return yLeft + slope * (xNew - xLeft);
}

// Main calculation function
function updateWarehouseAnalysis() {
    // Get values from sliders
    const productionHrsPerDay = parseFloat(document.getElementById('production-hours').value);
    const productionDaysPerWeek = parseFloat(document.getElementById('production-days').value);
    const ordersMin = parseFloat(document.getElementById('orders-min').value);
    const ordersMax = parseFloat(document.getElementById('orders-max').value);
    const avgBundleCost = parseFloat(document.getElementById('avg-bundle-cost').value);
    const avgPalletsPerOrder = parseFloat(document.getElementById('avg-pallets-per-order').value);
    
    // Create product distribution data
    const productDist = {
        '16OC': PRODUCT_DIST_RATIO,
        '24OC': 1 - PRODUCT_DIST_RATIO
    };
    
    // Generate production hours variations
    const baseHours = productionHrsPerDay;
    // let hoursVariations = [
    //     baseHours - 2 * HOURS_VARIATION_SPAN,
    //     baseHours - HOURS_VARIATION_SPAN,
    //     baseHours,
    //     baseHours + HOURS_VARIATION_SPAN,
    //     baseHours + 2 * HOURS_VARIATION_SPAN
    // ];

    let hoursVariations = [
        baseHours + HOURS_VARIATION_SPAN * 0,
        baseHours + HOURS_VARIATION_SPAN * 1,
        baseHours + HOURS_VARIATION_SPAN * 2,
        baseHours + HOURS_VARIATION_SPAN * 3,
        baseHours + HOURS_VARIATION_SPAN * 4,
    ];

    // Ensure no negative hours
    hoursVariations = hoursVariations.map(h => Math.max(0.1, h));
    
    // Generate order range values
    const ordersPerWeekValues = linspace(ordersMin, ordersMax, NUM_POINTS);
    console.log("Order values:", ordersPerWeekValues);
    
    // Calculate costs for each pallet
    const palletCost = avgBundleCost * PRODUCT_DATA['16OC'].pallet_capacity;
    console.log("palletCost", palletCost);


    // Calculate production targets in pallets per week (Monthly revenue to weekly pallets)
    const revenueTargetPallets = REVENUE_TARGETS.map(target => target / palletCost / 4);
    console.log("revenueTargetPallets", revenueTargetPallets);

    // Create master data structure with all combinations
    const masterData = [];
    
    // Debug information
    console.log("Hours variations:", hoursVariations);
    console.log("Orders per week values:", ordersPerWeekValues);
    
    hoursVariations.forEach(hours => {
        // Calculate production hours per week
        const productionHoursPerWeek = hours * productionDaysPerWeek;
        
        // Calculate max production capacity for each product type
        const max16ocPallets = (PACKAGING_ACTUAL_BUNDLES_PER_HR * productionHoursPerWeek * 
                                productDist['16OC']) / PRODUCT_DATA['16OC'].pallet_capacity;
                                
        const max24ocPallets = (PACKAGING_ACTUAL_BUNDLES_PER_HR * productionHoursPerWeek * 
                                productDist['24OC']) / PRODUCT_DATA['24OC'].pallet_capacity;
        
        // Total production capacity
        const totalProductionPallets = max16ocPallets + max24ocPallets;
        
        
        ordersPerWeekValues.forEach(orders => {
            // Calculate outbound pallets per week
            const outboundPalletsPerWeek = orders * avgPalletsPerOrder;
            
            // Calculate capacity ratio and warehouse turnover
            const capacityRatio = totalProductionPallets / outboundPalletsPerWeek;
            const warehouseTurnoverWeeks = WAREHOUSE_PALLETS / outboundPalletsPerWeek;
            
            masterData.push({
                productionHours: hours,
                ordersPerWeek: orders,
                productionHoursPerWeek: productionHoursPerWeek,
                outboundPalletsPerWeek: outboundPalletsPerWeek,
                totalProductionPallets: totalProductionPallets,
                capacityRatio: capacityRatio,
                warehouseTurnoverWeeks: warehouseTurnoverWeeks
            });
        });
    });
    
    // Prepare data for Plotly chart
    const plotlyTraces = [];
    
    // Setup colors - similar to plasma colormap
    const colors = [
        'rgba(13, 8, 135, 1)',
        'rgba(85, 48, 140, 1)',
        'rgba(156, 48, 109, 1)',
        'rgba(208, 70, 58, 1)',
        'rgba(241, 127, 14, 1)'
    ];
    
    // Find min and max y values for the plot to set the range
    let minY = Infinity;
    let maxY = -Infinity;
    
    // Add capacity ratio traces for each production hour variation
    hoursVariations.forEach((hours, i) => {
        // Filter data for this hours scenario
        const scenarioData = masterData.filter(d => d.productionHours === hours);
        
        // Sort data by trucks per week to ensure proper line
        scenarioData.sort((a, b) => a.ordersPerWeek - b.ordersPerWeek);
        
        // Get the total production for this scenario
        const totalProd = scenarioData[0].totalProductionPallets;
        const totalProdInOrders = totalProd / avgPalletsPerOrder;
        
        // Extract x and y values
        const x = scenarioData.map(d => d.ordersPerWeek);
        const y = scenarioData.map(d => d.capacityRatio);
        
        // Update min/max Y values
        y.forEach(val => {
            if (val < minY) minY = val;
            if (val > maxY) maxY = val;
        });
        
        // Add trace for capacity ratio
        plotlyTraces.push({
            x: x,
            y: y,
            type: 'scatter',
            mode: 'lines+markers',
            //name: `Ratio: ${hours.toFixed(1)} hrs/day | Prod: ${totalProd.toFixed(1)} pallets/wk (${totalProdInOrders.toFixed(1)} orders/wk)`,
            name: `${hours.toFixed(1)} hrs/day `,
            line: {
                color: colors[i],
                width: 2
            },
            marker: {
                size: 6,
                color: colors[i]
            }
        });
    });
    
    // Add balanced production line
    plotlyTraces.push({
        x: ordersPerWeekValues,
        y: Array(ordersPerWeekValues.length).fill(1.0),
        type: 'scatter',
        mode: 'lines',
        name: 'Balanced Production (ratio=1)',
        line: {
            color: 'rgba(0, 0, 0, 0.7)',
            width: 2,
            dash: 'dash'
        },
        marker: {
            size: 0
        }
    });
    
    // Add warehouse turnover trace
    // Use the first hours scenario (turnover only depends on outbound rate)
    const firstScenario = masterData.filter(d => d.productionHours === hoursVariations[0]);
    firstScenario.sort((a, b) => a.ordersPerWeek - b.ordersPerWeek);
    
    const turnoverTrace = {
        x: firstScenario.map(d => d.ordersPerWeek),
        y: firstScenario.map(d => d.warehouseTurnoverWeeks),
        type: 'scatter',
        mode: 'lines+markers',
        name: 'Warehouse Turnover (weeks)',
        line: {
            color: 'rgba(0, 0, 0, 0.5)',
            width: 2,
            dash: 'dot'
        },
        marker: {
            symbol: 'square',
            size: 6,
            color: 'rgba(0, 0, 0, 0.5)'
        },
        yaxis: 'y2'
    };
    plotlyTraces.push(turnoverTrace);
    
    // Add revenue target vertical lines
    const revenueColors = [
        'rgba(255, 204, 102, 1)',
        'rgba(255, 153, 51, 1)',
        'rgba(204, 51, 0, 1)',
        'rgba(153, 0, 0, 1)'
    ];
    
    // Add a buffer to max Y
    maxY = Math.max(maxY * 1.1, 5);
    minY = Math.max(0, minY * 0.9);
    
    REVENUE_TARGETS.forEach((target, i) => {
        const targetPallets = revenueTargetPallets[i];
        const targetOrders = targetPallets / avgPalletsPerOrder;
        
        plotlyTraces.push({
            x: [targetOrders, targetOrders],
            y: [minY, maxY],
            type: 'scatter',
            mode: 'lines',
            name: `Revenue: $${target.toLocaleString()}/mo = ${targetPallets.toFixed(1)} pallets/wk (${(targetOrders).toFixed(1)} orders/wk)`,
            line: {
                color: revenueColors[i],
                width: 2,
                dash: 'dash'
            },
            marker: {
                size: 0
            }
        });
    });
    
    // Create the Plotly layout
    const layout = {
        title: {
            text: `<b>Production Metrics Comparison with Varying Production Hours</b><br>
            (16OC Ratio: ${PRODUCT_DIST_PERCENT.toFixed(0)}%)`,
            
            font: {
                size: 16
            }
        },
        xaxis: {
            title: {
                text: 'Orders Per Week',
                font: {
                    size: 14,
                    color: '#2c3e50'
                }
            },
            gridcolor: 'rgba(0, 0, 0, 0.1)'
        },
        yaxis: {
            title: {
                text: 'Production Capacity Ratio',
                font: {
                    size: 14,
                    color: '#2c3e50'
                }
            },
            range: [minY, maxY],
            gridcolor: 'rgba(0, 0, 0, 0.1)'
        },
        yaxis2: {
            title: {
                text: 'Warehouse Turnover (weeks)',
                font: {
                    size: 14,
                    color: '#2c3e50'
                }
            },
            overlaying: 'y',
            side: 'right',
            showgrid: false
        },
        legend: {
            orientation: 'h',
            y: -0.15
        },
        shapes: [
            // Add horizontal line at y=1 for balance point
            {
                type: 'line',
                xref: 'paper',
                x0: 0,
                x1: 1,
                y0: 1,
                y1: 1,
                line: {
                    color: 'rgba(0, 0, 0, 0.5)',
                    width: 2,
                    dash: 'dot'
                }
            }
        ],
        hovermode: 'closest',
        height: 600,
        margin: {
            l: 60,
            r: 60,
            t: 80,
            b: 100
        }
    };
    
    // Create the plot
    Plotly.newPlot('analysisChart', plotlyTraces, layout);
    
    // Create summary tables
    createSummaryTables(masterData, hoursVariations, baseHours, productionDaysPerWeek, 
                       palletCost, revenueTargetPallets, avgBundleCost, avgPalletsPerOrder);
}

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', function() {
    // Run initial analysis on page load
    updateWarehouseAnalysis();
});

// Function to create summary tables
function createSummaryTables(masterData, hoursVariations, baseHours, productionDaysPerWeek, 
                            palletCost, revenueTargetPallets, avgBundleCost, avgPalletsPerOrder) {
    const summaryContainer = document.getElementById('summary-tables');
    summaryContainer.innerHTML = '';
    
    // 1. Balanced Points Summary Table
    const balancedPointsList = [];
    
    hoursVariations.forEach(hours => {
        // Filter data for this scenario
        const scenarioData = masterData.filter(d => d.productionHours === hours);
        
        // Sort by capacity ratio for proper interpolation
        scenarioData.sort((a, b) => a.capacityRatio - b.capacityRatio);
        
        // Get total production
        const totalProd = scenarioData[0].totalProductionPallets;
        
        // Find balanced point if possible
        let balancedOrder = null;
        let balancedPallets = null;
        let balancedRevenue = null;
        
        // Check if balanced point is within range
        const minRatio = Math.min(...scenarioData.map(d => d.capacityRatio));
        const maxRatio = Math.max(...scenarioData.map(d => d.capacityRatio));
        
        if (minRatio <= 1.0 && maxRatio >= 1.0) {
            // Find points to interpolate between
            let lowerIndex = 0;
            while (lowerIndex < scenarioData.length - 1 && 
                   scenarioData[lowerIndex].capacityRatio < 1.0) {
                lowerIndex++;
            }
            
            if (lowerIndex > 0) {
                const lowerPoint = scenarioData[lowerIndex - 1];
                const upperPoint = scenarioData[lowerIndex];
                
                // Interpolate to find x (trucks) where y (ratio) = 1.0
                balancedOrder = interpolate(
                    [lowerPoint.capacityRatio, upperPoint.capacityRatio],
                    [lowerPoint.ordersPerWeek, upperPoint.ordersPerWeek],
                    1.0
                );
                
                balancedPallets = balancedOrder * avgPalletsPerOrder;
                balancedRevenue = balancedPallets * palletCost * 4; // Monthly revenue
            }
        }
        
        balancedPointsList.push({
            productionHours: hours,
            balancedRevenues: balancedRevenue,
            balancedOrders: balancedOrder,
            balancedPallets: balancedPallets
        });
    });
    
    // Create balanced points table
    const balancedTable = document.createElement('table');
    balancedTable.innerHTML = `
        <thead>
            <tr>
                <th>Production Hours</th>
                <th>Balanced Monthly Revenue</th>
                <th>Balanced Orders/Week</th>
                <th>Balanced Pallets/Week</th>
                <th>KG's Wool/Week</th>
            </tr>
        </thead>
        <tbody>
            ${balancedPointsList.map(point => {
                // const productionHoursPerWeek = point.productionHours * productionDaysPerWeek;
                // const totalBundlesPerWeek = PACKAGING_ACTUAL_BUNDLES_PER_HR * productionHoursPerWeek;
                // const monthlyRevenue = totalBundlesPerWeek * avgBundleCost * 4; // 4 weeks per month
                // const kgWool = point.balancedPallets * KG_PER_PALLET;
                return `
                <tr>
                    <td>${point.productionHours.toFixed(1)}</td>
                    <td>$${point.balancedRevenues.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
                    <td>${point.balancedOrders.toFixed(2)}</td>
                    <td>${point.balancedPallets.toFixed(2)}</td>
                    <td>${(point.balancedPallets * KG_PER_PALLET).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
                </tr>
            `}).join('')}
        </tbody>
    `;
    
    // 2. Revenue Target Analysis
    const revenueAnalysisHtml = `
        <h3>Revenue Target Analysis</h3>
        <p>Bundle Cost: $${avgBundleCost.toFixed(2)} per bundle</p>
        <p>Pallet Cost: $${palletCost.toFixed(2)} (based on ${PRODUCT_DATA['16OC'].pallet_capacity} bundles per pallet)</p>
    `;
    
    const revenueTargetDivs = REVENUE_TARGETS.map((target, i) => {
        const targetPallets = revenueTargetPallets[i];
        const targetOrders = targetPallets / avgPalletsPerOrder;
        const targetOrdersMonth = targetOrders * 4; // Monthly orders
        
        // Analysis for each production scenario
        const targetAnalysisList = [];
        
        hoursVariations.forEach(hours => {
            // Filter for this scenario
            const scenarioData = masterData.filter(d => d.productionHours === hours);
            const totalProd = scenarioData[0].totalProductionPallets;
            const capacityRatio = totalProd / targetPallets;
            const diff = totalProd - targetPallets;
            const diffOrders = diff / avgPalletsPerOrder;
            
            targetAnalysisList.push({
                productionHours: hours,
                totalProduction: totalProd,
                capacityRatioToTarget: capacityRatio,
                productionVsTarget: `${diff >= 0 ? '+' : ''}${diff.toFixed(1)} pallets/wk<br>(${(diffOrders >= 0 ? '+' : '')}${diffOrders.toFixed(1)} orders/wk)`
            });
        });
        
        return `
            <div class="revenue-target">
                <h4>Monthly Revenue Target: $${target.toLocaleString()}</h4>
                <p>Weekly Pallet Target: ${targetPallets.toFixed(1)} pallets per week = ${targetOrders.toFixed(1)} orders per week = ${targetOrdersMonth.toFixed(1)} orders per month</p>
                
                <table>
                    <thead>
                        <tr>
                            <th>Production Hours</th>
                            <th>Monthly Revenue Potential</th>
                            <th>Capacity Ratio to Target</th>
                            <th>Production vs Target (Surplus/Deficit)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${targetAnalysisList.map(analysis => {
                            const productionHoursPerWeek = analysis.productionHours * productionDaysPerWeek;
                            const totalBundlesPerWeek = PACKAGING_ACTUAL_BUNDLES_PER_HR * productionHoursPerWeek;
                            const monthlyRevenue = totalBundlesPerWeek * avgBundleCost * 4;
                            return `
                            <tr>
                                <td>${analysis.productionHours.toFixed(1)}</td>
                                <td>$${monthlyRevenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
                                <td>${analysis.capacityRatioToTarget.toFixed(2)}</td>
                                <td>${analysis.productionVsTarget}</td>
                            </tr>
                        `}).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }).join('');
    
    // Add all the summary content
    summaryContainer.innerHTML = `
        <h3>Production Scenarios Summary</h3>
        ${balancedTable.outerHTML}
        ${revenueAnalysisHtml}
        ${revenueTargetDivs}
    `;
}
