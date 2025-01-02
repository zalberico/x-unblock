// You'll need to install: npm install twitter-api-v2 fs-extra
// Note: twitter-api-v2 is the package name even though the service is now called X

import { TwitterApi } from 'twitter-api-v2';
import fs from 'fs-extra';

console.log('Script starting...');

// Load config
let config;
try {
  config = await fs.readJson('config.json');
} catch (error) {
  console.error('Error: Could not find config.json');
  console.error('Please copy config.example.json to config.json and add your API credentials');
  process.exit(1);
}

const client = new TwitterApi({
  appKey: config.API_KEY,
  appSecret: config.API_KEY_SECRET,
  accessToken: config.ACCESS_TOKEN,
  accessSecret: config.ACCESS_TOKEN_SECRET,
});

// File to store our progress
const SAVE_FILE = 'unblock_progress.json';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function loadSavedProgress() {
  try {
    if (await fs.pathExists(SAVE_FILE)) {
      const data = await fs.readJson(SAVE_FILE);
      console.log(`Loaded saved progress:`);
      console.log(`- Processed ${Object.keys(data.processedUsers).length} users`);
      if (data.paginationToken) {
        console.log('- Found saved position in list');
      }
      return data;
    }
  } catch (error) {
    console.error('Error loading saved progress:', error);
  }
  return { 
    processedUsers: {}, // Track which users we've handled
    paginationToken: null // Remember where we are in the list
  };
}

async function saveProgress(progress) {
  try {
    await fs.writeJson(SAVE_FILE, progress);
    console.log('Progress saved to unblock_progress.json');
  } catch (error) {
    console.error('Error saving progress:', error);
  }
}

async function unblockAllUsers() {
  try {
    // Load any saved progress
    const progress = await loadSavedProgress();
    let { unblocked, paginationToken, totalProcessed } = progress;
    
    // First, authenticate
    console.log('\nAuthenticating with X...');
    const me = await client.v2.me();
    console.log('Successfully authenticated as:', {
      username: me.data.username,
      name: me.data.name,
      id: me.data.id
    });

    // X API rate limits: Free=1, Basic=5, Pro=15 requests per 15 mins
    const BATCH_SIZE = 1;  // Free tier limit
    
    console.log('\n=== PROCESSING BLOCKED USERS ===');
    console.log('Fetching and unblocking users one at a time...\n');
    
    do {
      // Fetch next batch of blocked users
      console.log('Fetching next blocked user...');
      
      const endpoint = `users/${me.data.id}/blocking`;
      const params = {
        "max_results": BATCH_SIZE,
        ...(paginationToken && { "pagination_token": paginationToken })
      };
      
      const response = await client.v2.get(endpoint, params);
      
      if (response?.data && Array.isArray(response.data)) {
        // Process each user in the batch (should be just one user on free tier)
        for (const user of response.data) {
          console.log('\nFetched user:');
          console.log('- ID:', user.id);
          console.log('- Username:', user.username);
          console.log('- Name:', user.name);
          
          if (!progress.processedUsers[user.id]) {
            try {
              const unblockEndpoint = `users/${me.data.id}/blocking/${user.id}`;
              await client.v2.delete(unblockEndpoint);
              progress.processedUsers[user.id] = true;
              
              console.log('\nSuccessfully unblocked:');
              console.log('- ID:', user.id);
              console.log('- Username:', user.username);
              console.log('- Name:', user.name);
              console.log(`Total processed: ${Object.keys(progress.processedUsers).length} users`);
              
              // Save progress
              paginationToken = response?.meta?.next_token;
              await saveProgress({ unblocked, paginationToken, totalProcessed });
            } catch (error) {
              console.error(`Failed to unblock user ${user.username || user.id}:`, error);
              // Continue with next user even if one fails
            }
          }
        }
      }
      
      paginationToken = response?.meta?.next_token;
      
      // Wait 15 minutes before next request (covers both the fetch and unblock)
      if (paginationToken) {
        console.log('\nWaiting 15 minutes before next user (X API rate limit)...\n');
        await sleep(15 * 60 * 1000);
      }
      
    } while (paginationToken);
    
    console.log('\n=== PROCESS COMPLETE! ===');
    console.log(`Successfully processed ${totalProcessed} users`);
    
    // Clean up save file since we're done
    await fs.remove(SAVE_FILE);
    
  } catch (error) {
    console.error('An error occurred:', error);
    if (error.data) {
      console.error('Error details:', error.data);
    }
  }
}

// Run the script
console.log('\n=== X MASS UNBLOCK SCRIPT ===');
console.log('This script fetches and unblocks users one at a time.');
console.log('Each user requires two API calls (fetch + unblock).');
console.log('With the free API tier limit of 1 request per 15 minutes:');
console.log('- Processing 50k users will take ~1,042 days total');
console.log('- You will unblock ~48 users per day (2 requests per user)');
console.log('- Progress is immediate - no need to wait for full list');
console.log('Progress is saved so you can stop/restart anytime.\n');

unblockAllUsers().catch(error => {
  console.error('Unhandled error:', error);
});