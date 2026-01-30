// Calculation and Data Processing Functions for Warehouse Analysis

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
    const productDistRatio = parseFloat(document.getElementById('product-dist-ratio').value);

    // Create product distribution data
    const productDist = {
        '16OC': productDistRatio,
        '24OC': 1 - productDistRatio
    };

    // Generate production hours variations
    const baseHours = productionHrsPerDay;
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
            name: `${hours.toFixed(1)} hrs/day `,
            line: {
                color: CHART_COLORS[i],
                width: 2
            },
            marker: {
                size: 6,
                color: CHART_COLORS[i]
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
    // Add a buffer to max Y
    maxY = Math.max(maxY * 1.1, 5);
    minY = Math.max(0, minY * 0.9);

    // Store annotations for revenue labels
    const revenueAnnotations = [];

    REVENUE_TARGETS.forEach((target, i) => {
        const targetPallets = revenueTargetPallets[i];
        const targetOrders = targetPallets / avgPalletsPerOrder;

        plotlyTraces.push({
            x: [targetOrders, targetOrders],
            y: [minY, maxY],
            type: 'scatter',
            mode: 'lines',
            name: `Revenue: $${target.toLocaleString()}/mo`,
            showlegend: false,
            line: {
                color: REVENUE_COLORS[i],
                width: 2,
                dash: 'dash'
            },
            marker: {
                size: 0
            }
        });

        // Add vertical text annotation to the left of the line
        revenueAnnotations.push({
            x: targetOrders,
            y: maxY,
            xanchor: 'right',
            yanchor: 'top',
            text: `$${target.toLocaleString()}/mo = ${targetPallets.toFixed(1)} pallets/wk`,
            textangle: -90,
            showarrow: false,
            font: {
                size: 13,
                color: 'black'
            },
            xshift: -5
        });
    });

    // Create the Plotly layout
    const layout = {
        title: {
            text: `
            <b>Production Metrics Comparison with Varying Production Hours</b><br>
            16OC Ratio: ${(productDistRatio * 100).toFixed(0)}%<br>
            Production Speed Factor: ${PRODUCTION_REDUCE_SPEED_FACTOR.toFixed(2)} (plastic change, repair downtime)
            `,
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
            t: 100,
            b: 100
        },
        annotations: revenueAnnotations
    };

    // Create the plot
    Plotly.newPlot('analysisChart', plotlyTraces, layout);

    // Create summary tables
    createSummaryTables(masterData, hoursVariations, baseHours, productionDaysPerWeek,
                       palletCost, revenueTargetPallets, avgBundleCost, avgPalletsPerOrder);
}
