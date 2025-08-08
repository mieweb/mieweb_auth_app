#!/usr/bin/env node

/**
 * Test script to verify the MongoDB-based pending responses system
 * This simulates the multi-instance scenario
 */

const fetch = require('node-fetch');

const API_BASE = process.env.API_BASE || 'http://localhost:3000';

async function testMultiInstanceScenario() {
  console.log('=== Testing Multi-Instance Notification Scenario ===\n');

  const testUsername = 'testuser123';
  const notificationData = {
    username: testUsername,
    title: 'Test Notification',
    body: 'This is a test notification for multi-instance handling',
    actions: [
      { id: 'approve', title: 'Approve' },
      { id: 'reject', title: 'Reject' }
    ]
  };

  try {
    console.log('1. Sending notification (simulating from App Instance 1)...');
    
    // Start the notification request (this will create pending response in DB)
    const notificationPromise = fetch(`${API_BASE}/send-notification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(notificationData)
    });

    // Wait a bit to ensure the pending response is created
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('2. Simulating user response (from App Instance 2)...');
    
    // Simulate user responding from different instance
    // In real scenario, this would be called when user interacts with notification
    const responseData = {
      userId: 'test-user-id',
      action: 'approve',
      notificationIdForAction: 'test-notification-id'
    };

    const userResponsePromise = fetch(`${API_BASE}/api/user-response`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(responseData)
    });

    // Wait for both requests to complete
    const [notificationResult, userResponseResult] = await Promise.all([
      notificationPromise,
      userResponsePromise
    ]);

    const notificationResponse = await notificationResult.json();
    const userResponse = await userResponseResult.json();

    console.log('3. Results:');
    console.log('   Notification API Response:', notificationResponse);
    console.log('   User Response API Result:', userResponse);

    if (notificationResponse.success && notificationResponse.action === 'approve') {
      console.log('\n✅ SUCCESS: Multi-instance communication worked!');
      console.log('   - Notification sent from one instance');
      console.log('   - User response received by different instance');
      console.log('   - Response successfully communicated back via database');
    } else {
      console.log('\n❌ FAILED: Multi-instance communication failed');
    }

  } catch (error) {
    console.error('\n❌ ERROR during test:', error.message);
  }
}

async function testDatabaseOperations() {
  console.log('\n=== Testing Database Operations ===\n');

  try {
    // Test creating pending response
    console.log('1. Testing pending response creation...');
    const createResult = await fetch(`${API_BASE}/api/test-pending-create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'testuser',
        requestId: 'test-request-123',
        timeoutMs: 30000
      })
    });
    
    const createResponse = await createResult.json();
    console.log('   Create Result:', createResponse);

    // Test resolving pending response
    console.log('2. Testing pending response resolution...');
    const resolveResult = await fetch(`${API_BASE}/api/test-pending-resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'testuser',
        action: 'approve'
      })
    });
    
    const resolveResponse = await resolveResult.json();
    console.log('   Resolve Result:', resolveResponse);

  } catch (error) {
    console.error('❌ ERROR during database test:', error.message);
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  async function runAllTests() {
    await testDatabaseOperations();
    await testMultiInstanceScenario();
  }
  
  runAllTests().catch(console.error);
}

module.exports = {
  testMultiInstanceScenario,
  testDatabaseOperations
};
