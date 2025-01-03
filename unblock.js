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
      if (data.lastRequestTime) {
        const msSinceLastRequest = Date.now() - data.lastRequestTime;
        const minutesRemaining = Math.max(0, 15 - (msSinceLastRequest / 60000));
        if (minutesRemaining > 0) {
          console.log(`Need to wait ${minutesRemaining.toFixed(1)} minutes before next request`);
          await sleep(minutesRemaining * 60000);
        }
      }
      return data;
    }
  } catch (error) {
    console.error('Error loading saved progress:', error);
  }
  return { 
    processedUsers: {}, 
    paginationToken: null,
    lastRequestTime: 0 
  };
}

async function saveProgress(progress) {
  progress.lastRequestTime = Date.now();
  try {
    await fs.writeJson(SAVE_FILE, progress);
    console.log('Progress saved');
  } catch (error) {
    console.error('Error saving progress:', error);
  }
}

async function unblockAllUsers() {
  try {
    // First, authenticate
    console.log('\nAuthenticating with X...');
    const me = await client.v2.me();
    console.log('Successfully authenticated as:', {
      username: me.data.username,
      name: me.data.name,
      id: me.data.id
    });

    // Load saved progress
    let progress = await loadSavedProgress();
    
    console.log('\n=== PROCESSING BLOCKED USERS ===');
    
    while (true) { // Continue until we run out of blocked users
      try {
        console.log('\nFetching next blocked user...');
        
        const endpoint = `users/${me.data.id}/blocking`;
        const params = {
          "max_results": 1,
          ...(progress.paginationToken && { "pagination_token": progress.paginationToken })
        };
        
        console.log('Making API request...');
        const response = await client.v2.get(endpoint, params);
        console.log('API Response:', JSON.stringify(response, null, 2));
        
        if (!response?.data || response.data.length === 0) {
          if (response?.meta?.next_token) {
            console.log('Got empty page but there are more users (next_token present)');
            progress.paginationToken = response.meta.next_token;
            await saveProgress(progress);
            console.log('\nWaiting 15 minutes before next request...');
            await sleep(15 * 60 * 1000);
            continue;
          }
          console.log('No more blocked users found!');
          break;
        }

        const user = response.data[0];
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
            
            // Save progress after successful unblock
            progress.paginationToken = response?.meta?.next_token;
            await saveProgress(progress);
          } catch (error) {
            console.error(`Failed to unblock user:`, error);
            if (error.code === 429) {
              const resetTime = error.rateLimit?.reset;
              if (resetTime) {
                const now = Math.floor(Date.now() / 1000);
                const waitSeconds = Math.max(resetTime - now + 1, 0);
                console.log(`Rate limit hit. Waiting ${waitSeconds} seconds...`);
                await sleep(waitSeconds * 1000);
                continue;
              }
            }
            throw error;
          }
        }
        
        // Wait 15 minutes before next request
        console.log('\nWaiting 15 minutes before next request...');
        await sleep(15 * 60 * 1000);
        
      } catch (error) {
        console.error('Error during processing:', error);
        if (error.code === 429) {
          const resetTime = error.rateLimit?.reset;
          if (resetTime) {
            const now = Math.floor(Date.now() / 1000);
            const waitSeconds = Math.max(resetTime - now + 1, 0);
            console.log(`Rate limit hit. Waiting ${waitSeconds} seconds...`);
            await sleep(waitSeconds * 1000);
            continue;
          }
        }
        // For other errors, wait 15 minutes and try again
        console.log('Waiting 15 minutes before retrying...');
        await sleep(15 * 60 * 1000);
      }
    }
    
    console.log('\n=== PROCESS COMPLETE! ===');
    
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
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
  process.exit(1);
});