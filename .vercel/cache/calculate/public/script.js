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
const WAREHOUSE_PALLETS = 600;  // warehouse capacity
const PALLETS_PER_TRUCK = 26;   // truck_capacity
const PACKAGING_MAX_SEC_PER_BUNDLE = 30;  // packaging_speed_maximum_seconds (recipe)
const PRODUCTION_REDUCE_SPEED_FACTOR = 0.8;  // buffer factor - needed b/c 30s is fast and a little extra time is needed for alarms
const PRODUCT_DIST_RATIO = 0.7; // 16OC Product Ratio
const PRODUCT_DIST_PERCENT = PRODUCT_DIST_RATIO * 100; // 16OC Product Ratio in percent
const NUM_POINTS = 20; // Number of data points for chart lines
const HOURS_VARIATION_SPAN = 1.5; // The span for production hours variations
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
async function updateWarehouseAnalysis() {
    // Get values from sliders
    const productionHrsPerDay = parseFloat(document.getElementById('production-hours').value);
    const productionDaysPerWeek = parseFloat(document.getElementById('production-days').value);
    const ordersMin = parseFloat(document.getElementById('orders-min').value);
    const ordersMax = parseFloat(document.getElementById('orders-max').value);
    const avgBundleCost = parseFloat(document.getElementById('avg-bundle-cost').value);
    const avgPalletsPerOrder = parseFloat(document.getElementById('avg-pallets-per-order').value);

    // Call Python serverless function
    try {
        const response = await fetch('/api/calculate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                productionHrsPerDay,
                productionDaysPerWeek,
                ordersMin,
                ordersMax,
                avgBundleCost,
                avgPalletsPerOrder
            })
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const data = await response.json();

        const masterData = data.masterData;
        const hoursVariations = data.hoursVariations;
        const ordersPerWeekValues = data.ordersPerWeekValues;
        const palletCost = data.palletCost;
        const revenueTargetPallets = data.revenueTargetPallets;
        const productDistPercent = data.constants.productDistPercent;
    
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
            (16OC Ratio: ${productDistPercent.toFixed(0)}%)`,
            
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

    // Create summary tables using server data
    createSummaryTablesFromAPI(data, avgBundleCost, avgPalletsPerOrder);

    } catch (error) {
        console.error('Error updating analysis:', error);
        document.getElementById('analysisChart').innerHTML = '<p style="color: red; text-align: center;">Error loading analysis. Please try again.</p>';
    }
}

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', function() {
    // Run initial analysis on page load
    updateWarehouseAnalysis();
});

// Function to create summary tables from API data
function createSummaryTablesFromAPI(data, avgBundleCost, avgPalletsPerOrder) {
    const summaryContainer = document.getElementById('summary-tables');
    const balancedPoints = data.balancedPoints;
    const revenueAnalysis = data.revenueAnalysis;
    const palletCost = data.palletCost;
    const kgPerPallet = data.constants.kgPerPallet;

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
            ${balancedPoints.map(point => {
                const revenue = point.balancedRevenue !== null ?
                    `$${point.balancedRevenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` :
                    'N/A';
                const orders = point.balancedOrders !== null ? point.balancedOrders.toFixed(2) : 'N/A';
                const pallets = point.balancedPallets !== null ? point.balancedPallets.toFixed(2) : 'N/A';
                const kgWool = point.balancedPallets !== null ?
                    (point.balancedPallets * kgPerPallet).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 }) :
                    'N/A';
                return `
                <tr>
                    <td>${point.productionHours.toFixed(1)}</td>
                    <td>${revenue}</td>
                    <td>${orders}</td>
                    <td>${pallets}</td>
                    <td>${kgWool}</td>
                </tr>
            `}).join('')}
        </tbody>
    `;

    // Revenue Target Analysis
    const revenueAnalysisHtml = `
        <h3>Revenue Target Analysis</h3>
        <p>Bundle Cost: $${avgBundleCost.toFixed(2)} per bundle</p>
        <p>Pallet Cost: $${palletCost.toFixed(2)} (based on ${PRODUCT_DATA['16OC'].pallet_capacity} bundles per pallet)</p>
    `;

    const revenueTargetDivs = revenueAnalysis.map(targetData => {
        const targetOrdersMonth = targetData.targetOrders * 4;

        return `
            <div class="revenue-target">
                <h4>Monthly Revenue Target: $${targetData.target.toLocaleString()}</h4>
                <p>Weekly Pallet Target: ${targetData.targetPallets.toFixed(1)} pallets per week = ${targetData.targetOrders.toFixed(1)} orders per week = ${targetOrdersMonth.toFixed(1)} orders per month</p>

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
                        ${targetData.analysis.map(analysis => {
                            const productionVsTarget = `${analysis.diffPallets >= 0 ? '+' : ''}${analysis.diffPallets.toFixed(1)} pallets/wk<br>(${analysis.diffOrders >= 0 ? '+' : ''}${analysis.diffOrders.toFixed(1)} orders/wk)`;
                            return `
                            <tr>
                                <td>${analysis.productionHours.toFixed(1)}</td>
                                <td>$${analysis.monthlyRevenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
                                <td>${analysis.capacityRatioToTarget.toFixed(2)}</td>
                                <td>${productionVsTarget}</td>
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
