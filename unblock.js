// You'll need to install: npm install twitter-api-v2 fs-extra
// Note: twitter-api-v2 is the package name even though the service is now called X

import { TwitterApi } from 'twitter-api-v2';
import fs from 'fs-extra';

console.log('Script starting...'); // Immediate feedback

// Replace these with your API credentials from the X Developer Portal
const API_KEY = 'your_api_key';
const API_KEY_SECRET = 'your_api_key_secret';
const ACCESS_TOKEN = 'your_access_token';
const ACCESS_TOKEN_SECRET = 'your_access_token_secret';

console.log('Initializing Twitter API client...'); // Immediate feedback

const client = new TwitterApi({
  appKey: API_KEY,
  appSecret: API_KEY_SECRET,
  accessToken: ACCESS_TOKEN,
  accessSecret: ACCESS_TOKEN_SECRET,
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
      console.log(`Loaded saved progress with ${data.blockedUsers.length} users, ${Object.keys(data.unblocked).length} already unblocked`);
      return data;
    }
  } catch (error) {
    console.error('Error loading saved progress:', error);
  }
  return { blockedUsers: [], unblocked: {} };
}

async function saveProgress(blockedUsers, unblocked) {
  try {
    await fs.writeJson(SAVE_FILE, { blockedUsers, unblocked });
    console.log('Progress saved');
  } catch (error) {
    console.error('Error saving progress:', error);
  }
}

async function unblockAllUsers() {
  try {
    // First, authenticate and get user info
    console.log('Attempting to authenticate...');
    const me = await client.v2.me();
    console.log('Successfully authenticated as:', {
      username: me.data.username,
      name: me.data.name,
      id: me.data.id
    });

    // Load any saved progress
    const { blockedUsers, unblocked } = await loadSavedProgress();
    
    // If we don't have blocked users saved, fetch them
    if (blockedUsers.length === 0) {
      console.log('No saved list found. Fetching blocked users...');
      let paginationToken = null;
      // X API rate limits: Free=1, Basic=5, Pro=15 requests per 15 mins
      // Defaulting to Free tier limit to be conservative
      const BATCH_SIZE = 1;
      
      do {
        console.log('Fetching batch of blocked users...');
        
        const endpoint = `users/${me.data.id}/blocking`;
        const params = {
          "max_results": BATCH_SIZE,
          ...(paginationToken && { "pagination_token": paginationToken })
        };
        
        const response = await client.v2.get(endpoint, params);
        
        if (response?.data && Array.isArray(response.data)) {
          blockedUsers.push(...response.data);
          console.log(`Found ${response.data.length} users in this batch. Total: ${blockedUsers.length}`);
          
          // Save progress after each batch
          await saveProgress(blockedUsers, unblocked);
        }
        
        paginationToken = response?.meta?.next_token;
        
        // Respect rate limits - wait 15 minutes between requests
        if (paginationToken) {
          console.log('Waiting 15 minutes before next request...');
          await sleep(15 * 60 * 1000);
        }
        
      } while (paginationToken);
      
      console.log(`Completed fetching blocked users. Total: ${blockedUsers.length}`);
      await saveProgress(blockedUsers, unblocked);
    }
    
    // Now unblock users
    console.log(`Starting unblock process for ${blockedUsers.length} users...`);
    for (const user of blockedUsers) {
      // Skip if already unblocked
      if (unblocked[user.id]) {
        continue;
      }

      try {
        const unblockEndpoint = `users/${me.data.id}/blocking/${user.id}`;
        await client.v2.delete(unblockEndpoint);
        console.log(`Unblocked user: ${user.username || user.id} (${Object.keys(unblocked).length + 1}/${blockedUsers.length})`);
        
        // Mark as unblocked and save progress
        unblocked[user.id] = true;
        await saveProgress(blockedUsers, unblocked);
        
        // Wait 15 minutes between each unblock
        console.log('Waiting 15 minutes before next unblock...');
        await sleep(15 * 60 * 1000);
      } catch (error) {
        console.error(`Failed to unblock user ${user.username || user.id}:`, error);
        // Continue with next user even if one fails
        continue;
      }
    }
    
    console.log('Finished unblocking process!');
    
  } catch (error) {
    console.error('An error occurred:', error);
    if (error.data) {
      console.error('Error details:', error.data);
    }
  }
}

// Run the script
console.log('Starting unblock process...'); // Immediate feedback
unblockAllUsers().catch(error => {
  console.error('Unhandled error:', error);
});