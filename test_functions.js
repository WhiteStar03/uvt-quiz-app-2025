// Manual Migration Test Functions - Copy and paste into browser console

// Test 1: Check current storage state
function testStorageState() {
    console.log("🔍 STORAGE STATE CHECK");
    console.log("=====================");
    
    const allKeys = Object.keys(localStorage);
    console.log("All localStorage keys:", allKeys);
    
    const legacyData = localStorage.getItem('uvt_quiz_stats');
    const currentData = localStorage.getItem('ls');
    
    console.log("Legacy data exists:", !!legacyData);
    console.log("Current data exists:", !!currentData);
    
    if (legacyData) {
        try {
            const parsed = JSON.parse(legacyData);
            console.log("Legacy data structure:", parsed);
            console.log("Legacy tests count:", parsed.totalTests || 0);
        } catch (e) {
            console.error("Failed to parse legacy data:", e);
        }
    }
    
    if (currentData) {
        try {
            // Try decompression if LZ-String is available
            let parsed = null;
            if (typeof LZString !== 'undefined') {
                try {
                    const decompressed = LZString.decompress(currentData);
                    if (decompressed) {
                        parsed = JSON.parse(decompressed);
                    }
                } catch (e) {
                    // Continue to direct parsing
                }
            }
            
            if (!parsed) {
                parsed = JSON.parse(currentData);
            }
            
            console.log("Current data structure:", parsed);
            console.log("Current tests count:", parsed.totalTests || 0);
        } catch (e) {
            console.error("Failed to parse current data:", e);
        }
    }
    
    return {
        hasLegacy: !!legacyData,
        hasCurrent: !!currentData,
        allKeys: allKeys
    };
}

// Test 2: Force migration manually
function testManualMigration() {
    console.log("🔄 MANUAL MIGRATION TEST");
    console.log("========================");
    
    const legacyData = localStorage.getItem('uvt_quiz_stats');
    if (!legacyData) {
        console.log("❌ No legacy data found to migrate");
        console.log("💡 Run the test data creation script first");
        return false;
    }
    
    try {
        const parsed = JSON.parse(legacyData);
        console.log("🎯 Found legacy data to migrate:", parsed);
        
        // Call the migration function directly
        if (typeof migrateLegacyStats === 'function') {
            const migrated = migrateLegacyStats(parsed);
            console.log("✅ Migration completed:", migrated);
            
            // Update userStats manually
            if (typeof userStats !== 'undefined') {
                userStats = { ...userStats, ...migrated };
                console.log("✅ userStats updated:", userStats);
                
                // Save to new format
                if (typeof saveUserStats === 'function') {
                    saveUserStats();
                    console.log("✅ Data saved to new format");
                }
                
                // Clean up legacy data
                localStorage.removeItem('uvt_quiz_stats');
                console.log("✅ Legacy data removed");
                
                // Update dashboard
                if (typeof updateDashboardStats === 'function') {
                    updateDashboardStats();
                    console.log("✅ Dashboard updated");
                }
                
                return true;
            }
        } else {
            console.error("❌ Migration function not available");
        }
    } catch (e) {
        console.error("❌ Migration failed:", e);
    }
    
    return false;
}

// Test 3: Check migration functions availability
function testFunctionAvailability() {
    console.log("🔧 FUNCTION AVAILABILITY CHECK");
    console.log("==============================");
    
    const functions = [
        'loadUserStats',
        'migrateLegacyStats', 
        'debugStorageAndMigration',
        'manualMigration',
        'performComprehensiveLegacySearch',
        'cleanupLegacyData',
        'updateDashboardStats'
    ];
    
    functions.forEach(funcName => {
        const isAvailable = typeof window[funcName] === 'function';
        console.log(`${isAvailable ? '✅' : '❌'} ${funcName}:`, isAvailable ? 'Available' : 'Not Available');
    });
    
    return functions.map(f => ({ name: f, available: typeof window[f] === 'function' }));
}

// Test 4: Complete test sequence
function runCompleteTest() {
    console.log("🎯 COMPLETE MIGRATION TEST");
    console.log("==========================");
    
    console.log("Step 1: Check function availability");
    testFunctionAvailability();
    
    console.log("\nStep 2: Check storage state");
    const state = testStorageState();
    
    console.log("\nStep 3: Attempt manual migration");
    const migrationResult = testManualMigration();
    
    console.log("\nStep 4: Final verification");
    testStorageState();
    
    console.log("\n🏁 Test completed!");
    return {
        functionsAvailable: true,
        initialState: state,
        migrationSuccessful: migrationResult
    };
}

// Make functions available globally
window.testStorageState = testStorageState;
window.testManualMigration = testManualMigration;
window.testFunctionAvailability = testFunctionAvailability;
window.runCompleteTest = runCompleteTest;

console.log("✅ Test functions loaded!");
console.log("📋 Available test commands:");
console.log("  testStorageState() - Check current storage");
console.log("  testManualMigration() - Force migration");
console.log("  testFunctionAvailability() - Check functions");
console.log("  runCompleteTest() - Run all tests");
