// UI and DOM Manipulation for Warehouse Analysis Dashboard

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
                // Handle null values when balanced point is not found
                const revenueDisplay = point.balancedRevenues !== null
                    ? '$' + point.balancedRevenues.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })
                    : 'N/A';
                const ordersDisplay = point.balancedOrders !== null
                    ? point.balancedOrders.toFixed(2)
                    : 'N/A';
                const palletsDisplay = point.balancedPallets !== null
                    ? point.balancedPallets.toFixed(2)
                    : 'N/A';
                const kgDisplay = point.balancedPallets !== null
                    ? (point.balancedPallets * KG_PER_PALLET).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })
                    : 'N/A';

                return `
                <tr>
                    <td>${point.productionHours.toFixed(1)}</td>
                    <td>${revenueDisplay}</td>
                    <td>${ordersDisplay}</td>
                    <td>${palletsDisplay}</td>
                    <td>${kgDisplay}</td>
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
