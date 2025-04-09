// Fixed parameters
const WAREHOUSE_PALLETS = 700;  // warehouse capacity
const PALLETS_PER_TRUCK = 26;   // truck_capacity
const PACKAGING_MAX_SEC_PER_BUNDLE = 35;  // packaging_speed_maximum_seconds (recipe)
const PRODUCTION_REDUCE_SPEED_FACTOR = 0.9;  // buffer factor

// Calculate packaging speed
const PACKAGING_MAX_BUNDLES_PER_HR = (60 / PACKAGING_MAX_SEC_PER_BUNDLE) * 60;
const PACKAGING_ACTUAL_BUNDLES_PER_HR = PACKAGING_MAX_BUNDLES_PER_HR * PRODUCTION_REDUCE_SPEED_FACTOR;

// Fixed revenue targets
const REVENUE_TARGETS = [500000.0, 750000.0, 1000000.0];

// Product data
const PRODUCT_DATA = {
    '16OC': { pallet_capacity: 24 },  // bundles/pallet
    '24OC': { pallet_capacity: 12 }   // bundles/pallet
};

// Chart reference
let analysisChart = null;

// Connect sliders to value displays and update chart on change
document.querySelectorAll('input[type="range"]').forEach(slider => {
    const valueDisplay = document.getElementById(`${slider.id}-value`);
    if (valueDisplay) {
        slider.addEventListener('input', function() {
            valueDisplay.textContent = parseFloat(this.value).toFixed(
                this.id === 'product-dist' ? 2 : 
                this.id === 'num-points' ? 0 : 1
            );
            
            // Special case for truck range (two sliders)
            if (this.id === 'trucks-min' || this.id === 'trucks-max') {
                const minVal = parseFloat(document.getElementById('trucks-min').value);
                const maxVal = parseFloat(document.getElementById('trucks-max').value);
                
                // Keep min <= max
                if (this.id === 'trucks-min' && minVal > maxVal) {
                    document.getElementById('trucks-max').value = minVal;
                    document.getElementById('trucks-range-value').textContent = 
                        `${minVal.toFixed(1)} - ${minVal.toFixed(1)}`;
                } else if (this.id === 'trucks-max' && maxVal < minVal) {
                    document.getElementById('trucks-min').value = maxVal;
                    document.getElementById('trucks-range-value').textContent = 
                        `${maxVal.toFixed(1)} - ${maxVal.toFixed(1)}`;
                } else {
                    document.getElementById('trucks-range-value').textContent = 
                        `${minVal.toFixed(1)} - ${maxVal.toFixed(1)}`;
                }
            }
            
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
    const productDistRatio = parseFloat(document.getElementById('product-dist').value);
    const hoursSpan = parseFloat(document.getElementById('hours-span').value);
    const numPoints = parseInt(document.getElementById('num-points').value);
    const trucksMin = parseFloat(document.getElementById('trucks-min').value);
    const trucksMax = parseFloat(document.getElementById('trucks-max').value);
    const avgBundleCost = parseFloat(document.getElementById('avg-bundle-cost').value);
    
    // Create product distribution data
    const productDist = {
        '16OC': productDistRatio,
        '24OC': 1 - productDistRatio
    };
    
    // Generate production hours variations
    const baseHours = productionHrsPerDay;
    let hoursVariations = [
        baseHours - 2 * hoursSpan,
        baseHours - hoursSpan,
        baseHours,
        baseHours + hoursSpan,
        baseHours + 2 * hoursSpan
    ];
    
    // Ensure no negative hours
    hoursVariations = hoursVariations.map(h => Math.max(0.1, h));
    
    // Generate truck range values
    const trucksPerWeekValues = linspace(trucksMin, trucksMax, numPoints);
    console.log("Truck values:", trucksPerWeekValues);
    
    // Calculate costs for each pallet
    const palletCost = avgBundleCost * PRODUCT_DATA['16OC'].pallet_capacity;
    
    // Calculate revenue targets in pallets per week (Monthly revenue to weekly pallets)
    const revenueTargetPallets = REVENUE_TARGETS.map(target => target / palletCost / 4);
    
    // Create master data structure with all combinations
    const masterData = [];
    
    // Debug information
    console.log("Hours variations:", hoursVariations);
    console.log("Trucks per week values:", trucksPerWeekValues);
    
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
        
        trucksPerWeekValues.forEach(trucks => {
            // Calculate outbound pallets per week
            const outboundPalletsPerWeek = trucks * PALLETS_PER_TRUCK;
            
            // Calculate capacity ratio and warehouse turnover
            const capacityRatio = totalProductionPallets / outboundPalletsPerWeek;
            const warehouseTurnoverWeeks = WAREHOUSE_PALLETS / outboundPalletsPerWeek;
            
            masterData.push({
                productionHours: hours,
                trucksPerWeek: trucks,
                productionHoursPerWeek: productionHoursPerWeek,
                outboundPalletsPerWeek: outboundPalletsPerWeek,
                totalProductionPallets: totalProductionPallets,
                capacityRatio: capacityRatio,
                warehouseTurnoverWeeks: warehouseTurnoverWeeks
            });
        });
    });
    
    // Prepare data for chart
    const chartData = {
        datasets: []
    };
    
    // Setup colors - similar to plasma colormap
    const colors = [
        'rgba(13, 8, 135, 1)',
        'rgba(85, 48, 140, 1)',
        'rgba(156, 48, 109, 1)',
        'rgba(208, 70, 58, 1)',
        'rgba(241, 127, 14, 1)'
    ];
    
    // Add capacity ratio datasets for each production hour variation
    hoursVariations.forEach((hours, i) => {
        // Filter data for this hours scenario
        const scenarioData = masterData.filter(d => d.productionHours === hours);
        
        // Sort data by trucks per week to ensure proper line
        scenarioData.sort((a, b) => a.trucksPerWeek - b.trucksPerWeek);
        
        // Get the total production for this scenario
        const totalProd = scenarioData[0].totalProductionPallets;
        
        // Add dataset for capacity ratio
        chartData.datasets.push({
            label: `Ratio: ${hours.toFixed(1)} hrs/day | Prod: ${totalProd.toFixed(1)} pallets/wk`,
            data: scenarioData.map(d => ({
                x: d.trucksPerWeek,
                y: d.capacityRatio
            })),
            borderColor: colors[i],
            backgroundColor: colors[i],
            yAxisID: 'y',
            pointRadius: 4,
            tension: 0.1
        });
    });
    
    // Add balanced production line
    const balancedLine = {
        label: 'Balanced Production (ratio=1)',
        data: trucksPerWeekValues.map(t => ({
            x: t,
            y: 1.0
        })),
        borderColor: 'rgba(0, 0, 0, 0.7)',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        borderDash: [5, 5],
        pointRadius: 0,
        yAxisID: 'y'
    };
    chartData.datasets.push(balancedLine);
    
    // Add warehouse turnover dataset
    // Use the first hours scenario (turnover only depends on outbound rate)
    const firstScenario = masterData.filter(d => d.productionHours === hoursVariations[0]);
    // Sort data by trucks per week to ensure proper line
    firstScenario.sort((a, b) => a.trucksPerWeek - b.trucksPerWeek);
    
    const turnoverData = {
        label: 'Warehouse Turnover (weeks)',
        data: firstScenario.map(d => ({
            x: d.trucksPerWeek,
            y: d.warehouseTurnoverWeeks
        })),
        borderColor: 'rgba(0, 0, 0, 0.5)',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        borderDash: [3, 3],
        pointStyle: 'rect',
        pointRadius: 3,
        yAxisID: 'y1'
    };
    chartData.datasets.push(turnoverData);
    
    // Add revenue target vertical lines
    const revenueColors = [
        'rgba(255, 153, 51, 1)',
        'rgba(204, 51, 0, 1)',
        'rgba(153, 0, 0, 1)'
    ];
    
    // Find min and max y values across all datasets to make vertical lines span entire chart
    let minY = Infinity;
    let maxY = -Infinity;
    
    chartData.datasets.forEach(ds => {
        ds.data.forEach(point => {
            if (point.y < minY) minY = point.y;
            if (point.y > maxY) maxY = point.y;
        });
    });
    
    // Add a buffer to max Y
    maxY = Math.max(maxY * 1.1, 5);
    minY = Math.max(0, minY * 0.9);
    
    REVENUE_TARGETS.forEach((target, i) => {
        const targetPallets = revenueTargetPallets[i];
        const targetTrucks = targetPallets / PALLETS_PER_TRUCK;
        
        chartData.datasets.push({
            label: `Revenue: $${target.toLocaleString()}/mo = ${targetPallets.toFixed(1)} pallets/wk`,
            data: [
                { x: targetTrucks, y: minY }, 
                { x: targetTrucks, y: maxY }
            ],
            borderColor: revenueColors[i],
            backgroundColor: revenueColors[i],
            borderDash: [5, 5],
            pointRadius: 0,
            yAxisID: 'y'
        });
    });
    
    // Debug the chart data
    console.log("Chart data structure:");
    console.log("Number of datasets:", chartData.datasets.length);
    chartData.datasets.forEach((ds, i) => {
        console.log(`Dataset ${i}: ${ds.label}, points: ${ds.data.length}`);
        if (ds.data.length > 0) {
            console.log(`  First point x,y: ${ds.data[0].x}, ${ds.data[0].y}`);
            console.log(`  Last point x,y: ${ds.data[ds.data.length-1].x}, ${ds.data[ds.data.length-1].y}`);
        }
    });
    
    // Create the chart
    const ctx = document.getElementById('analysisChart').getContext('2d');
    
    // Destroy previous chart if it exists
    if (analysisChart) {
        analysisChart.destroy();
    }
    
    // Create new chart
    analysisChart = new Chart(ctx, {
        type: 'line',
        data: chartData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                title: {
                    display: true,
                    text: `Production Metrics Comparison with Varying Production Hours
(Base: ${baseHours} hrs/day, ${productionDaysPerWeek} days/week, 16OC ratio: ${productDistRatio.toFixed(2)}, Span: ${hoursSpan.toFixed(2)} hrs, Bundle: $${avgBundleCost.toFixed(1)})`,
                    font: {
                        size: 16
                    },
                    padding: 20
                },
                legend: {
                    position: 'bottom',
                    labels: {
                        boxWidth: 15,
                        font: {
                            size: 11
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.dataset.label || '';
                            const value = context.parsed.y.toFixed(2);
                            return `${label}: ${value}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'linear',
                    title: {
                        display: true,
                        text: 'Trucks Per Week',
                        font: {
                            weight: 'bold'
                        }
                    },
                    grid: {
                        display: true,
                        drawBorder: true
                    }
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: 'Production Capacity Ratio',
                        font: {
                            weight: 'bold'
                        }
                    },
                    grid: {
                        display: true,
                        drawBorder: true,
                        color: function(context) {
                            if (context.tick.value === 1) {
                                return 'rgba(0, 0, 0, 0.5)';
                            }
                            return 'rgba(0, 0, 0, 0.1)';
                        },
                        lineWidth: function(context) {
                            if (context.tick.value === 1) {
                                return 2;
                            }
                            return 1;
                        }
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: 'Warehouse Turnover (weeks)',
                        font: {
                            weight: 'bold'
                        }
                    },
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
    
    // Create summary tables
    createSummaryTables(masterData, hoursVariations, baseHours, productionDaysPerWeek, 
                       palletCost, revenueTargetPallets, avgBundleCost);
}

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', function() {
    // Run initial analysis on page load
    updateWarehouseAnalysis();
});

// Function to create summary tables
function createSummaryTables(masterData, hoursVariations, baseHours, productionDaysPerWeek, 
                            palletCost, revenueTargetPallets, avgBundleCost) {
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
        let balancedTruck = null;
        let balancedPallets = null;
        
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
                balancedTruck = interpolate(
                    [lowerPoint.capacityRatio, upperPoint.capacityRatio],
                    [lowerPoint.trucksPerWeek, upperPoint.trucksPerWeek],
                    1.0
                );
                
                balancedPallets = balancedTruck * PALLETS_PER_TRUCK;
            }
        }
        
        balancedPointsList.push({
            productionHours: hours,
            totalProduction: totalProd,
            balancedTrucks: balancedTruck,
            balancedPallets: balancedPallets
        });
    });
    
    // Create balanced points table
    const balancedTable = document.createElement('table');
    balancedTable.innerHTML = `
        <thead>
            <tr>
                <th>Production Hours</th>
                <th>Total Production (pallets/wk)</th>
                <th>Balanced Trucks/Week</th>
                <th>Balanced Pallets/Week</th>
            </tr>
        </thead>
        <tbody>
            ${balancedPointsList.map(point => `
                <tr>
                    <td>${point.productionHours.toFixed(1)}</td>
                    <td>${point.totalProduction.toFixed(1)}</td>
                    <td>${point.balancedTrucks !== null ? point.balancedTrucks.toFixed(2) : 'N/A'}</td>
                    <td>${point.balancedPallets !== null ? point.balancedPallets.toFixed(2) : 'N/A'}</td>
                </tr>
            `).join('')}
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
        const targetTrucks = targetPallets / PALLETS_PER_TRUCK;
        
        // Analysis for each production scenario
        const targetAnalysisList = [];
        
        hoursVariations.forEach(hours => {
            // Filter for this scenario
            const scenarioData = masterData.filter(d => d.productionHours === hours);
            const totalProd = scenarioData[0].totalProductionPallets;
            const capacityRatio = totalProd / targetPallets;
            const diff = totalProd - targetPallets;
            
            targetAnalysisList.push({
                productionHours: hours,
                totalProduction: totalProd,
                capacityRatioToTarget: capacityRatio,
                productionVsTarget: `${diff >= 0 ? '+' : ''}${diff.toFixed(1)} pallets`
            });
        });
        
        return `
            <div class="revenue-target">
                <h4>Monthly Revenue Target: $${target.toLocaleString()}</h4>
                <p>Weekly Pallet Target: ${targetPallets.toFixed(1)} pallets per week = ${targetTrucks.toFixed(2)} trucks per week</p>
                
                <table>
                    <thead>
                        <tr>
                            <th>Production Hours</th>
                            <th>Total Production (pallets/wk)</th>
                            <th>Capacity Ratio to Target</th>
                            <th>Production vs Target</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${targetAnalysisList.map(analysis => `
                            <tr>
                                <td>${analysis.productionHours.toFixed(1)}</td>
                                <td>${analysis.totalProduction.toFixed(1)}</td>
                                <td>${analysis.capacityRatioToTarget.toFixed(2)}</td>
                                <td>${analysis.productionVsTarget}</td>
                            </tr>
                        `).join('')}
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
